/**
 * Tools for SVG selected element operation.
 * @module selected-elem
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria, 2010 Jeff Schiller
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion */

import { NS } from './namespaces.js'
import type { CommandAttributes } from './history.js'
import * as hstry from './history.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path.js not yet converted to TS
import * as pathModule from './path.js'
import { warn, error } from '../common/logger.js'
import {
  getStrokedBBoxDefaultVisible,
  setHref,
  getElement,
  getHref,
  getVisibleElements,
  findDefs,
  getRotationAngle,
  getRefElem,
  getBBox as utilsGetBBox,
  walkTreePost,
  assignAttributes,
  getFeGaussianBlur
} from './utilities.js'
import {
  transformPoint,
  matrixMultiply,
  transformListToTransform,
  getTransformList
} from './math.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — recalculate.js not yet converted to TS
import { recalculateDimensions } from './recalculate.js'
import { isGecko } from '../common/browser.js'
import { getParents } from '../common/util.js'

const {
  MoveElementCommand,
  BatchCommand,
  InsertElementCommand,
  RemoveElementCommand,
  ChangeElementCommand
} = hstry

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/**
 * @function module:selected-elem.init
 */
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
  svgCanvas.copySelectedElements = copySelectedElements
  svgCanvas.groupSelectedElements = groupSelectedElements
  svgCanvas.pushGroupProperties = pushGroupProperty
  svgCanvas.ungroupSelectedElement = ungroupSelectedElement
  svgCanvas.moveToTopSelectedElement = moveToTopSelectedElem
  svgCanvas.moveToBottomSelectedElement = moveToBottomSelectedElem
  svgCanvas.moveUpDownSelected = moveUpDownSelected
  svgCanvas.moveSelectedElements = moveSelectedElements
  svgCanvas.cloneSelectedElements = cloneSelectedElements
  svgCanvas.alignSelectedElements = alignSelectedElements
  svgCanvas.updateCanvas = updateCanvas
  svgCanvas.cycleElement = cycleElement as any
  svgCanvas.deleteSelectedElements = deleteSelectedElements
  svgCanvas.flipSelectedElements = flipSelectedElements
}

/**
 * Repositions the selected element to the bottom in the DOM to appear on top.
 */
const moveToTopSelectedElem = (): void => {
  const [selected] = svgCanvas.getSelectedElements()
  if (selected) {
    const t = selected
    const oldParent = t.parentNode
    const oldNextSibling = t.nextSibling
    if (t.parentNode) { t.parentNode.append(t) }
    if (oldNextSibling !== t.nextSibling) {
      svgCanvas.addCommandToHistory(
        new MoveElementCommand(t, oldNextSibling, oldParent as Node, 'top')
      )
      svgCanvas.call('changed', [t])
    }
  }
}

/**
 * Repositions the selected element to the top in the DOM to appear under other elements.
 */
const moveToBottomSelectedElem = (): void => {
  const [selected] = svgCanvas.getSelectedElements()
  if (selected) {
    let t: Element = selected
    const oldParent = t.parentNode
    const oldNextSibling = t.nextSibling
    let firstChild: Element | null = (t.parentNode as Element).firstElementChild
    if (firstChild?.tagName === 'title') {
      firstChild = firstChild.nextElementSibling
    }
    if (firstChild?.tagName === 'defs') {
      firstChild = firstChild.nextElementSibling
    }
    if (!firstChild) {
      return
    }
    t = (t.parentNode as Element).insertBefore(t, firstChild)
    if (oldNextSibling !== t.nextSibling) {
      svgCanvas.addCommandToHistory(
        new MoveElementCommand(t, oldNextSibling, oldParent as Node, 'bottom')
      )
      svgCanvas.call('changed', [t])
    }
  }
}

/**
 * Moves the select element up or down the stack.
 */
const moveUpDownSelected = (dir: 'Up' | 'Down'): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const selected = selectedElements[0]
  if (!selected) {
    return
  }

  svgCanvas.setCurBBoxes([])
  let closest: Element | undefined
  let foundCur: boolean | undefined
  const list: Element[] = (svgCanvas.getIntersectionList(
    getStrokedBBoxDefaultVisible([selected]) as any
  ) ?? []) as Element[]
  if (dir === 'Down') {
    list.reverse()
  }

  Array.prototype.forEach.call(list, (el: Element) => {
    if (!foundCur) {
      if (el === selected) {
        foundCur = true
      }
      return true
    }
    if (closest === undefined) {
      closest = el
    }
    return false
  })
  if (!closest) {
    return
  }

  const t = selected
  const oldParent = t.parentNode
  const oldNextSibling = t.nextSibling
  if (dir === 'Down') {
    closest.insertAdjacentElement('beforebegin', t)
  } else {
    closest.insertAdjacentElement('afterend', t)
  }
  if (oldNextSibling !== t.nextSibling) {
    svgCanvas.addCommandToHistory(
      new MoveElementCommand(t, oldNextSibling, oldParent as Node, `Move ${dir}`)
    )
    svgCanvas.call('changed', [t])
  }
}

/**
 * Moves selected elements on the X/Y axis.
 */
const moveSelectedElements = (dx: number | number[], dy: number | number[], undoable = true): unknown => {
  svgCanvas.call('before-move')
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const zoom: number = svgCanvas.getZoom()
  if (!Array.isArray(dx)) {
    dx = dx / zoom
    dy = (dy as number) / zoom
  }

  const batchCmd = new BatchCommand('position')
  selectedElements.forEach((selected, i) => {
    if (selected) {
      const existingTransform = selected.getAttribute('transform') ?? ''

      const xform = svgCanvas.getSvgRoot().createSVGTransform()
      const tlist = getTransformList(selected)

      if (Array.isArray(dx)) {
        xform.setTranslate(dx[i] ?? 0, (dy as number[])[i] ?? 0)
      } else {
        xform.setTranslate(dx as number, dy as number)
      }

      if (tlist) {
        if (tlist.numberOfItems) {
          tlist.insertItemBefore(xform, 0)
        } else {
          tlist.appendItem(xform)
        }
      }

      const cmd = recalculateDimensions(selected)
      if (cmd) {
        batchCmd.addSubCommand(cmd)
      } else if ((selected.getAttribute('transform') ?? '') !== existingTransform) {
        batchCmd.addSubCommand(
          new ChangeElementCommand(selected, { transform: existingTransform })
        )
      }

      svgCanvas
        .getSelectorManager()
        .requestSelector(selected)!
        .resize()
    }
  })
  if (!batchCmd.isEmpty()) {
    if (undoable) {
      svgCanvas.addCommandToHistory(batchCmd)
    }
    svgCanvas.call('changed', selectedElements)
    svgCanvas.call('after-move')
    return batchCmd
  }
  svgCanvas.call('after-move')
  return undefined
}

/**
 * Create deep DOM copies (clones) of all selected elements and move them slightly.
 */
const cloneSelectedElements = (x: number, y: number): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const currentGroup = svgCanvas.getCurrentGroup()
  let i: number
  let elem: Element | null | undefined
  const batchCmd = new BatchCommand('Clone Elements')
  const len = selectedElements.length

  const index = (el: Element | null | undefined): number => {
    if (!el) { return -1 }
    let idx = 0
    let current: Element | null = el
    do {
      idx++
      current = current.previousElementSibling
    } while (current)
    return idx
  }

  const sortfunction = (a: Element | null, b: Element | null): number => {
    return index(b) - index(a)
  }
  selectedElements.sort(sortfunction)
  for (i = 0; i < len; ++i) {
    elem = selectedElements[i]
    if (!elem) {
      break
    }
  }
  const copiedElements = (selectedElements).slice(0, i) as Element[]
  svgCanvas.clearSelection(true)
  const drawing = svgCanvas.getDrawing()
  let j = copiedElements.length
  while (j--) {
    const cloned: Element = drawing.copyElem(copiedElements[j]!)
    copiedElements[j] = cloned
    ;(currentGroup ?? drawing.getCurrentLayer())!.append(cloned)
    batchCmd.addSubCommand(new InsertElementCommand(cloned))
  }

  if (!batchCmd.isEmpty()) {
    svgCanvas.addToSelection(copiedElements.reverse())
    moveSelectedElements(x, y, false)
    svgCanvas.addCommandToHistory(batchCmd)
  }
}

/**
 * Aligns selected elements.
 */
const alignSelectedElements = (type: string, relativeTo: string): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const bboxes: { x: number; y: number; width: number; height: number }[] = []
  const len = selectedElements.length
  if (!len) {
    return
  }
  let minx = Number.MAX_VALUE
  let maxx = Number.MIN_VALUE
  let miny = Number.MAX_VALUE
  let maxy = Number.MIN_VALUE

  const isHorizontalAlign = (t: string): boolean => ['l', 'c', 'r', 'left', 'center', 'right'].includes(t)
  const isVerticalAlign = (t: string): boolean => ['t', 'm', 'b', 'top', 'middle', 'bottom'].includes(t)

  for (let i = 0; i < len; ++i) {
    const el = selectedElements[i]
    if (!el) {
      break
    }
    const bb = getStrokedBBoxDefaultVisible([el])
    if (bb) {
      bboxes[i] = bb
    }
  }

  if (['smallest', 'largest'].includes(relativeTo) && ['dh', 'distrib_horiz', 'dv', 'distrib_verti'].includes(type)) {
    relativeTo = 'selected'
  }

  switch (relativeTo) {
    case 'smallest':
      if (isHorizontalAlign(type) || isVerticalAlign(type)) {
        const sortedBboxes = bboxes.slice().sort((a, b) => a.width - b.width)
        const minBbox = sortedBboxes[0]
        if (minBbox) {
          minx = minBbox.x
          miny = minBbox.y
          maxx = minBbox.x + minBbox.width
          maxy = minBbox.y + minBbox.height
        }
      }
      break
    case 'largest':
      if (isHorizontalAlign(type) || isVerticalAlign(type)) {
        const sortedBboxes = bboxes.slice().sort((a, b) => a.width - b.width)
        const maxBbox = sortedBboxes[bboxes.length - 1]
        if (maxBbox) {
          minx = maxBbox.x
          miny = maxBbox.y
          maxx = maxBbox.x + maxBbox.width
          maxy = maxBbox.y + maxBbox.height
        }
      }
      break
    case 'page':
      minx = 0
      miny = 0
      maxx = svgCanvas.getContentW()
      maxy = svgCanvas.getContentH()
      break
    default:
      // 'selected'
      minx = Math.min(...bboxes.map(box => box.x))
      miny = Math.min(...bboxes.map(box => box.y))
      maxx = Math.max(...bboxes.map(box => box.x + box.width))
      maxy = Math.max(...bboxes.map(box => box.y + box.height))
      break
  }

  let dx: number[] = []
  let dy: number[] = []

  if (['dh', 'distrib_horiz'].includes(type)) {
    ;[dx, dy] = _getDistributeHorizontalDistances(relativeTo, selectedElements, bboxes, minx, maxx, miny, maxy)
  } else if (['dv', 'distrib_verti'].includes(type)) {
    ;[dx, dy] = _getDistributeVerticalDistances(relativeTo, selectedElements, bboxes, minx, maxx, miny, maxy)
  } else {
    ;[dx, dy] = _getNormalDistances(type, selectedElements, bboxes, minx, maxx, miny, maxy)
  }

  moveSelectedElements(dx, dy)
}

/**
 * get distribution horizontal distances.
 */
const _getDistributeHorizontalDistances = (
  relativeTo: string,
  selectedElements: (Element | null)[],
  bboxes: { x: number; y: number; width: number; height: number }[],
  minx: number,
  maxx: number,
  _miny: number,
  maxy: number
): [number[], number[]] => {
  const dx: number[] = []
  const dy: number[] = []

  for (let i = 0; i < selectedElements.length; i++) {
    dy[i] = 0
  }

  const bboxesSortedClone = bboxes
    .slice()
    .sort((firstBox, secondBox) => {
      const firstMaxX = firstBox.x + firstBox.width
      const secondMaxX = secondBox.x + secondBox.width
      if (firstMaxX === secondMaxX) { return 0 } else if (firstMaxX > secondMaxX) { return 1 } else { return -1 }
    })

  if (relativeTo === 'page') {
    bboxesSortedClone.unshift({ x: 0, y: 0, width: 0, height: maxy })
    bboxesSortedClone.push({ x: maxx, y: 0, width: 0, height: maxy })
  }

  const totalWidth = maxx - minx
  const totalBoxWidth = bboxesSortedClone.map(b => b.width).reduce((w1, w2) => w1 + w2, 0)
  const space = (totalWidth - totalBoxWidth) / (bboxesSortedClone.length - 1)
  const _dx: number[] = []

  for (let i = 0; i < bboxesSortedClone.length; ++i) {
    _dx[i] = 0
    if (i === 0) { continue }
    const cur = bboxesSortedClone[i]
    const prev = bboxesSortedClone[i - 1]
    if (!cur || !prev) { continue }
    const orgX = cur.x
    cur.x = prev.x + prev.width + space
    _dx[i] = cur.x - orgX
  }

  bboxesSortedClone.forEach((boxClone, idx) => {
    const orgIdx = bboxes.findIndex(box => box === boxClone)
    if (orgIdx !== -1) {
      dx[orgIdx] = _dx[idx] ?? 0
    }
  })

  return [dx, dy]
}

/**
 * get distribution vertical distances.
 */
const _getDistributeVerticalDistances = (
  relativeTo: string,
  selectedElements: (Element | null)[],
  bboxes: { x: number; y: number; width: number; height: number }[],
  _minx: number,
  maxx: number,
  miny: number,
  maxy: number
): [number[], number[]] => {
  const dx: number[] = []
  const dy: number[] = []

  for (let i = 0; i < selectedElements.length; i++) {
    dx[i] = 0
  }

  const bboxesSortedClone = bboxes
    .slice()
    .sort((firstBox, secondBox) => {
      const firstMaxY = firstBox.y + firstBox.height
      const secondMaxY = secondBox.y + secondBox.height
      if (firstMaxY === secondMaxY) { return 0 } else if (firstMaxY > secondMaxY) { return 1 } else { return -1 }
    })

  if (relativeTo === 'page') {
    bboxesSortedClone.unshift({ x: 0, y: 0, width: maxx, height: 0 })
    bboxesSortedClone.push({ x: 0, y: maxy, width: maxx, height: 0 })
  }

  const totalHeight = maxy - miny
  const totalBoxHeight = bboxesSortedClone.map(b => b.height).reduce((h1, h2) => h1 + h2, 0)
  const space = (totalHeight - totalBoxHeight) / (bboxesSortedClone.length - 1)
  const _dy: number[] = []

  for (let i = 0; i < bboxesSortedClone.length; ++i) {
    _dy[i] = 0
    if (i === 0) { continue }
    const cur = bboxesSortedClone[i]
    const prev = bboxesSortedClone[i - 1]
    if (!cur || !prev) { continue }
    const orgY = cur.y
    cur.y = prev.y + prev.height + space
    _dy[i] = cur.y - orgY
  }

  bboxesSortedClone.forEach((boxClone, idx) => {
    const orgIdx = bboxes.findIndex(box => box === boxClone)
    if (orgIdx !== -1) {
      dy[orgIdx] = _dy[idx] ?? 0
    }
  })

  return [dx, dy]
}

/**
 * get normal align distances.
 */
const _getNormalDistances = (
  type: string,
  selectedElements: (Element | null)[],
  bboxes: { x: number; y: number; width: number; height: number }[],
  minx: number,
  maxx: number,
  miny: number,
  maxy: number
): [number[], number[]] => {
  const len = selectedElements.length
  const dx = new Array<number>(len)
  const dy = new Array<number>(len)

  for (let i = 0; i < len; ++i) {
    if (!selectedElements[i]) {
      break
    }
    const bbox = bboxes[i]
    if (!bbox) { continue }
    dx[i] = 0
    dy[i] = 0

    switch (type) {
      case 'l':
      case 'left':
        dx[i] = minx - bbox.x
        break
      case 'c':
      case 'center':
        dx[i] = (minx + maxx) / 2 - (bbox.x + bbox.width / 2)
        break
      case 'r':
      case 'right':
        dx[i] = maxx - (bbox.x + bbox.width)
        break
      case 't':
      case 'top':
        dy[i] = miny - bbox.y
        break
      case 'm':
      case 'middle':
        dy[i] = (miny + maxy) / 2 - (bbox.y + bbox.height / 2)
        break
      case 'b':
      case 'bottom':
        dy[i] = maxy - (bbox.y + bbox.height)
        break
    }
  }

  return [dx, dy]
}

/**
 * Removes all selected elements from the DOM.
 */
const deleteSelectedElements = (): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const batchCmd = new BatchCommand('Delete Elements')
  const selectedCopy: Element[] = []

  selectedElements.forEach(selected => {
    if (selected) {
      let parent = selected.parentNode as Element
      let t: Element = selected
      svgCanvas.getSelectorManager().releaseSelector(t)
      pathModule.removePath_(t.id)
      if (parent.tagName === 'a' && parent.childNodes.length === 1) {
        t = parent
        parent = parent.parentNode as Element
      }
      const { nextSibling } = t
      t.remove()
      const elem = t
      selectedCopy.push(selected)
      batchCmd.addSubCommand(new RemoveElementCommand(elem, nextSibling, parent))
    }
  })
  svgCanvas.setEmptySelectedElements()

  if (!batchCmd.isEmpty()) {
    svgCanvas.addCommandToHistory(batchCmd)
  }
  svgCanvas.call('changed', selectedCopy)
  svgCanvas.clearSelection()
}

/**
 * Flips selected elements horizontally or vertically.
 */
const flipSelectedElements = (scaleX: number, scaleY: number): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const batchCmd = new BatchCommand('Flip Elements')
  const svgRoot = svgCanvas.getSvgRoot()

  selectedElements.forEach(selected => {
    if (!selected) { return }

    const bbox = getStrokedBBoxDefaultVisible([selected])
    if (!bbox) { return }

    const cx = bbox.x + bbox.width / 2
    const cy = bbox.y + bbox.height / 2
    const existingTransform = selected.getAttribute('transform') ?? ''

    const flipMatrix = svgRoot
      .createSVGMatrix()
      .translate(cx, cy)
      .scaleNonUniform(scaleX, scaleY)
      .translate(-cx, -cy)

    const tlist = getTransformList(selected)
    if (!tlist) { return }
    const combinedMatrix = matrixMultiply(
      transformListToTransform(tlist).matrix,
      flipMatrix
    )

    const flipTransform = svgRoot.createSVGTransform()
    flipTransform.setMatrix(combinedMatrix)

    tlist.clear()
    tlist.appendItem(flipTransform)

    const prevStartTransform = svgCanvas.getStartTransform
      ? svgCanvas.getStartTransform()
      : null
    if (svgCanvas.setStartTransform) {
      svgCanvas.setStartTransform(existingTransform)
    }

    const cmd = recalculateDimensions(selected)

    if (svgCanvas.setStartTransform) {
      svgCanvas.setStartTransform(prevStartTransform)
    }

    if (cmd) {
      batchCmd.addSubCommand(cmd)
    } else if ((selected.getAttribute('transform') ?? '') !== existingTransform) {
      batchCmd.addSubCommand(
        new ChangeElementCommand(selected, { transform: existingTransform })
      )
    }

    svgCanvas
      .getSelectorManager()
      .requestSelector(selected)!
      .resize()
  })

  if (!batchCmd.isEmpty()) {
    svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.call('changed', selectedElements.filter((e): e is Element => e !== null))
  }
}

/**
 * Remembers the current selected elements on the clipboard.
 */
const copySelectedElements = (): void => {
  const selectedElements = svgCanvas.getSelectedElements().filter((e): e is Element => e !== null)
  const data = JSON.stringify(
    selectedElements.map((x: Element) => svgCanvas.getJsonFromSvgElements(x) as unknown)
  )
  sessionStorage.setItem(svgCanvas.getClipboardID(), data)
  svgCanvas.flashStorage()

  const canvMenu = document.getElementById('se-cmenu_canvas')
  canvMenu?.setAttribute('enablemenuitems', '#paste,#paste_in_place')
}

/**
 * Wraps all the selected elements in a group (`g`) element.
 */
const groupSelectedElements = (type?: string, urlArg?: string): void => {
  svgCanvas.call('before-group')
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  if (!type) {
    type = 'g'
  }
  let cmdStr = ''
  let url: string | undefined

  switch (type) {
    case 'a': {
      cmdStr = 'Make hyperlink'
      url = urlArg ?? ''
      break
    }
    default: {
      type = 'g'
      cmdStr = 'Group Elements'
      break
    }
  }

  const batchCmd = new BatchCommand(cmdStr)

  const g: Element = svgCanvas.addSVGElementsFromJson({
    element: type,
    attr: {
      id: svgCanvas.getNextId()
    }
  })
  if (type === 'a' && url !== undefined) {
    setHref(g, url)
  }
  batchCmd.addSubCommand(new InsertElementCommand(g))

  let i = selectedElements.length
  while (i--) {
    let elem = selectedElements[i]
    if (!elem) {
      continue
    }

    if (
      elem.parentNode && (elem.parentNode as Element).tagName === 'a' &&
      elem.parentNode.childNodes.length === 1
    ) {
      elem = elem.parentNode as Element
    }

    const oldNextSibling = elem.nextSibling
    const oldParent = elem.parentNode
    g.append(elem)
    batchCmd.addSubCommand(
      new MoveElementCommand(elem, oldNextSibling, oldParent as Node)
    )
  }
  if (!batchCmd.isEmpty()) {
    svgCanvas.addCommandToHistory(batchCmd)
  }

  svgCanvas.selectOnly([g], true)
  svgCanvas.call('after-group')
}

/**
 * Pushes all appropriate parent group properties down to its children.
 * @param g
 * @param undoable
 */
// @preserve audit-flagged:823 — fill/stroke ungroup pushdown preserved as-is
const pushGroupProperty = (g: Element, undoable: boolean): hstry.BatchCommand | undefined => {
  const children = g.childNodes
  const len = children.length
  const xform = g.getAttribute('transform')

  const glist = getTransformList(g)
  const m = glist ? transformListToTransform(glist).matrix : (document.createElementNS('http://www.w3.org/2000/svg', 'svg')).createSVGMatrix()

  const batchCmd = new BatchCommand('Push group properties')

  const gangle = getRotationAngle(g)

  const gattrs = {
    filter: g.getAttribute('filter'),
    opacity: g.getAttribute('opacity'),
    fill: g.getAttribute('fill'),
    stroke: g.getAttribute('stroke')
  }
  let gfilter: Element | null = null
  let gblur: string | number | null = null
  let changes: CommandAttributes
  const drawing = svgCanvas.getDrawing()

  for (let i = 0; i < len; i++) {
    const elem = children[i] as Element

    if (elem.nodeType !== 1) {
      continue
    }

    if (gattrs.opacity !== null && gattrs.opacity !== '1') {
      const newOpac =
        Math.round((Number(elem.getAttribute('opacity') ?? 1)) * Number(gattrs.opacity) * 100) /
        100
      svgCanvas.changeSelectedAttribute('opacity', newOpac, [elem])
    }

    if (gattrs.fill && !elem.getAttribute('fill')) {
      svgCanvas.changeSelectedAttribute('fill', gattrs.fill, [elem])
    }

    if (gattrs.stroke && !elem.getAttribute('stroke')) {
      svgCanvas.changeSelectedAttribute('stroke', gattrs.stroke, [elem])
    }

    if (gattrs.filter) {
      let cblur: string | number | null = svgCanvas.getBlur(elem)
      const origCblur = cblur
      if (!gblur) {
        gblur = svgCanvas.getBlur(g)
      }
      if (cblur) {
        cblur = Number(gblur) + Number(cblur)
      } else if (cblur === 0) {
        cblur = gblur
      }

      if (!origCblur) {
        if (!gfilter) {
          gfilter = getRefElem(gattrs.filter)
        } else {
          gfilter = drawing.copyElem(gfilter)
          if (gfilter) { findDefs().append(gfilter) }

          const blurElem = getFeGaussianBlur(gfilter)
          const suffix =
            blurElem?.tagName === 'feGaussianBlur' ? 'blur' : 'filter'
          if (gfilter) {
            (gfilter).id = `${elem.id}_${suffix}`
            svgCanvas.changeSelectedAttribute(
              'filter',
              `url(#${(gfilter).id})`,
              [elem]
            )
          }
        }
      } else {
        gfilter = getRefElem(elem.getAttribute('filter'))
      }
      const blurElem = getFeGaussianBlur(gfilter)

      if (cblur) {
        svgCanvas.changeSelectedAttribute('stdDeviation', cblur, [blurElem])
        svgCanvas.setBlurOffsets(gfilter!, Number(cblur))
      }
    }

    let chtlist = getTransformList(elem)

    if (elem.tagName.includes('Gradient')) {
      chtlist = null as unknown as SVGTransformList
    }

    if (!chtlist) {
      continue
    }

    if (elem.tagName === 'defs') {
      continue
    }

    if (glist?.numberOfItems) {
      if (gangle && glist.numberOfItems === 1) {
        const rgm = glist.getItem(0).matrix

        let rcm = svgCanvas.getSvgRoot().createSVGMatrix()
        const cangle = getRotationAngle(elem)
        if (cangle) {
          rcm = chtlist.getItem(0).matrix
        }

        const cbox = utilsGetBBox(elem)
        if (!cbox) { continue }
        const ceqm = transformListToTransform(chtlist).matrix
        const coldc = transformPoint(
          cbox.x + cbox.width / 2,
          cbox.y + cbox.height / 2,
          ceqm
        )

        const sangle = gangle + cangle

        const r2 = svgCanvas.getSvgRoot().createSVGTransform()
        r2.setRotate(sangle, coldc.x, coldc.y)

        const trm = matrixMultiply(rgm, rcm, r2.matrix.inverse())

        if (cangle) {
          chtlist.removeItem(0)
        }

        if (sangle) {
          if (chtlist.numberOfItems) {
            chtlist.insertItemBefore(r2, 0)
          } else {
            chtlist.appendItem(r2)
          }
        }

        if (trm.e || trm.f) {
          const tr = svgCanvas.getSvgRoot().createSVGTransform()
          tr.setTranslate(trm.e, trm.f)
          if (chtlist.numberOfItems) {
            chtlist.insertItemBefore(tr, 0)
          } else {
            chtlist.appendItem(tr)
          }
        }
      } else {
        const oldxform = elem.getAttribute('transform')
        changes = {}
        changes.transform = oldxform ?? ''

        const newxform = svgCanvas.getSvgRoot().createSVGTransform()
        newxform.setMatrix(m)

        if (chtlist.numberOfItems) {
          chtlist.insertItemBefore(newxform, 0)
        } else {
          chtlist.appendItem(newxform)
        }

        if (undoable) {
          batchCmd.addSubCommand(new ChangeElementCommand(elem, changes))
        }
      }
    }
  }

  if (xform) {
    changes = {}
    changes.transform = xform
    g.setAttribute('transform', '')
    g.removeAttribute('transform')
    batchCmd.addSubCommand(new ChangeElementCommand(g, changes))
  }

  if (undoable && !batchCmd.isEmpty()) {
    return batchCmd
  }
  return undefined
}

/**
 * Converts selected/given `<use>` or child SVG element to a group.
 */
const convertToGroup = (elem: Element): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  if (!elem) {
    elem = selectedElements[0] as Element
  }
  const $elem = elem
  const batchCmd = new BatchCommand()
  let ts: string
  const dataStorage = svgCanvas.getDataStorage()
  if (dataStorage.has($elem, 'gsvg')) {
    const svg = elem.firstChild as Element
    const pt = {
      x: Number(svg.getAttribute('x')),
      y: Number(svg.getAttribute('y'))
    }

    const firstChild = elem.firstChild?.firstChild as Element | null
    if (firstChild) {
      firstChild.outerHTML = firstChild.innerHTML
    }
    dataStorage.remove(elem, 'gsvg')

    const tlist = getTransformList(elem)
    const xform = svgCanvas.getSvgRoot().createSVGTransform()
    xform.setTranslate(pt.x, pt.y)
    if (tlist) { tlist.appendItem(xform) }
    recalculateDimensions(elem)
    svgCanvas.call('selected', [elem])
  } else if (dataStorage.has($elem, 'symbol')) {
    elem = dataStorage.get($elem, 'symbol') as Element
    if (!elem) {
      warn('Unable to convert <use>: missing symbol reference', null, 'selected-elem')
      return
    }

    ts = $elem.getAttribute('transform') ?? ''
    const pos = {
      x: Number($elem.getAttribute('x')),
      y: Number($elem.getAttribute('y'))
    }

    const vb = elem.getAttribute('viewBox')

    if (vb) {
      const nums = vb.split(/[ ,]+/)
      pos.x -= Number(nums[0])
      pos.y -= Number(nums[1])
    }

    ts += ' translate(' + (pos.x || 0) + ',' + (pos.y || 0) + ')'

    const useParent = $elem.parentNode
    const useNextSibling = $elem.nextSibling

    batchCmd.addSubCommand(
      new RemoveElementCommand(
        $elem,
        useNextSibling,
        useParent as Node
      )
    )
    $elem.remove()

    const svgContent: Element = svgCanvas.getSvgContent()
    const hasMore = elem.id
      ? svgContent.querySelectorAll(`use[href="#${elem.id}"], use[*|href="#${elem.id}"]`).length
      : 0

    const g = svgCanvas.getDOMDocument().createElementNS(NS.SVG, 'g') as Element
    const childs = elem.childNodes

    let ci: number
    for (ci = 0; ci < childs.length; ci++) {
      const child = childs[ci]
      if (child) { g.append(child.cloneNode(true)) }
    }

    if (isGecko()) {
      const svgElement = findDefs()
      const gradients = svgElement.querySelectorAll(
        'linearGradient,radialGradient,pattern'
      )
      for (let gi = 0, im = gradients.length; im > gi; gi++) {
        const grad = gradients[gi]
        if (grad) { g.appendChild(grad.cloneNode(true)) }
      }
    }

    if (ts) {
      g.setAttribute('transform', ts)
    }

    const parent = elem.parentNode as Element | null

    svgCanvas.uniquifyElems(g)

    if (isGecko()) {
      const svgElement = findDefs()
      const elements = g.querySelectorAll(
        'linearGradient,radialGradient,pattern'
      )
      for (let gi = 0, im = elements.length; im > gi; gi++) {
        const el = elements[gi]
        if (el) { svgElement.appendChild(el) }
      }
    }

    g.id = svgCanvas.getNextId()

    if (useParent) {
      (useParent as Element).insertBefore(g, useNextSibling)
    }

    if (parent) {
      if (!hasMore) {
        const { nextSibling } = elem
        elem.remove()
        batchCmd.addSubCommand(
          new RemoveElementCommand(elem, nextSibling, parent)
        )
      }
      batchCmd.addSubCommand(new InsertElementCommand(g))
    }

    svgCanvas.setUseData(g)

    if (isGecko()) {
      svgCanvas.convertGradients(findDefs())
    } else {
      svgCanvas.convertGradients(g)
    }

    walkTreePost(g, (n: Node) => {
      try {
        recalculateDimensions(n as Element)
      } catch (e) {
        error('Error recalculating dimensions', e, 'selected-elem')
      }
    })

    const visElems = g.querySelectorAll(svgCanvas.getVisElems())
    Array.prototype.forEach.call(visElems, (el: Element) => {
      if (!el.id) {
        el.id = svgCanvas.getNextId()
      }
    })

    svgCanvas.selectOnly([g])

    const cm = pushGroupProperty(g, true)
    if (cm) {
      batchCmd.addSubCommand(cm)
    }

    svgCanvas.addCommandToHistory(batchCmd)
  } else {
    warn('Unexpected element to ungroup:', elem, 'selected-elem')
  }
}

/**
 * Unwraps all the elements in a selected group (`g`) element.
 */
const ungroupSelectedElement = (): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const dataStorage = svgCanvas.getDataStorage()
  let g: Element | null = selectedElements[0] ?? null
  if (!g) {
    return
  }
  if (dataStorage.has(g, 'gsvg') || dataStorage.has(g, 'symbol')) {
    convertToGroup(g)
    return
  }
  if (g.tagName === 'use') {
    const href = getHref(g)
    if (!href || !href.startsWith('#')) {
      warn('Unexpected <use> without local reference:', g, 'selected-elem')
      return
    }
    const symbol = getElement(href.slice(1))
    if (!symbol) {
      warn('Unexpected <use> without resolved reference:', g, 'selected-elem')
      return
    }
    dataStorage.put(g, 'symbol', symbol)
    dataStorage.put(g, 'ref', symbol)
    convertToGroup(g)
    return
  }
  const parentsA = getParents(g.parentNode, 'a')
  if (parentsA?.length) {
    g = (parentsA[0] as Element) ?? null
  }
  if (!g) { return }

  if (g.tagName === 'g' || g.tagName === 'a') {
    const batchCmd = new BatchCommand('Ungroup Elements')
    const cmd = pushGroupProperty(g, true)
    if (cmd) {
      batchCmd.addSubCommand(cmd)
    }

    const parent = g.parentNode as Element
    const anchor = g.nextSibling
    const children: (Element | null)[] = new Array(g.childNodes.length)

    let i = 0
    while (g.firstChild) {
      const el = g.firstChild as Element
      const oldNextSibling = el.nextSibling
      const oldParent = el.parentNode

      if (el.tagName === 'title') {
        const { nextSibling } = el
        batchCmd.addSubCommand(
          new RemoveElementCommand(el, nextSibling, oldParent as Node)
        )
        el.remove()
        continue
      }

      children[i++] = parent.insertBefore(el, anchor)
      batchCmd.addSubCommand(
        new MoveElementCommand(el, oldNextSibling, oldParent as Node)
      )
    }

    svgCanvas.clearSelection()

    const gNextSibling = g.nextSibling
    g.remove()
    batchCmd.addSubCommand(new RemoveElementCommand(g, gNextSibling, parent))

    if (!batchCmd.isEmpty()) {
      svgCanvas.addCommandToHistory(batchCmd)
    }

    svgCanvas.addToSelection(children as Element[])
  }
}

/**
 * Updates the editor canvas width/height/position after a zoom has occurred.
 */
const updateCanvas = (w: number, h: number): { x: number; y: number; old_x: number; old_y: number; d_x: number; d_y: number } => {
  svgCanvas.getSvgRoot().setAttribute('width', String(w))
  svgCanvas.getSvgRoot().setAttribute('height', String(h))
  const zoom: number = svgCanvas.getZoom()
  const bg: Element | null = document.getElementById('canvasBackground')
  const oldX = Number(svgCanvas.getSvgContent().getAttribute('x'))
  const oldY = Number(svgCanvas.getSvgContent().getAttribute('y'))
  const x = (w - svgCanvas.contentW * zoom) / 2
  const y = (h - svgCanvas.contentH * zoom) / 2

  assignAttributes(svgCanvas.getSvgContent(), {
    width: svgCanvas.contentW * zoom,
    height: svgCanvas.contentH * zoom,
    x,
    y,
    viewBox: `0 0 ${svgCanvas.contentW} ${svgCanvas.contentH}`
  })

  if (bg) {
    assignAttributes(bg, {
      width: svgCanvas.getSvgContent().getAttribute('width') ?? undefined,
      height: svgCanvas.getSvgContent().getAttribute('height') ?? undefined,
      x,
      y
    })
  }

  const bgImg: Element | null = getElement('background_image')
  if (bgImg) {
    assignAttributes(bgImg, {
      width: '100%',
      height: '100%'
    })
  }

  svgCanvas.selectorManager.selectorParentGroup!.setAttribute(
    'transform',
    `translate(${x},${y})`
  )

  svgCanvas.runExtensions({
    action: 'canvasUpdated',
    vars: {
      new_x: x,
      new_y: y,
      old_x: oldX,
      old_y: oldY,
      d_x: x - oldX,
      d_y: y - oldY
    }
  })
  return { x, y, old_x: oldX, old_y: oldY, d_x: x - oldX, d_y: y - oldY }
}

/**
 * Select the next/previous element within the current layer.
 */
const cycleElement = (next: boolean): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const currentGroup: Element | null = svgCanvas.getCurrentGroup()
  let num: number
  const curElem = selectedElements[0]
  let elem: Element | false = false
  const allElems: Element[] = getVisibleElements(
    currentGroup ?? svgCanvas.getCurrentDrawing().getCurrentLayer()
  )
  if (!allElems.length) {
    return
  }
  if (!curElem) {
    num = next ? allElems.length - 1 : 0
    elem = allElems[num] ?? false
  } else {
    let i = allElems.length
    while (i--) {
      if (allElems[i] === curElem) {
        num = next ? i - 1 : i + 1
        if (num >= allElems.length) {
          num = 0
        } else if (num < 0) {
          num = allElems.length - 1
        }
        elem = allElems[num] ?? false
        break
      }
    }
  }
  svgCanvas.selectOnly([elem as Element], true)
  svgCanvas.call('selected', selectedElements)
}
