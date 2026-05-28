/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment -- DOM traversal uses non-null assertions; ISvgCanvas any-typed API */
/**
 * Tools for selection.
 * @module selection
 * @license MIT
 */

import { NS } from './namespaces.js'
import {
  getBBox,
  getStrokedBBoxDefaultVisible
} from './utilities.js'
import {
  transformPoint,
  transformListToTransform,
  rectsIntersect,
  getTransformList
} from './math.js'
import * as hstry from './history.js'
import { getClosest } from '../common/util.js'

const { BatchCommand } = hstry
import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/**
 * @function module:selection.init
 */
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
  svgCanvas.getMouseTarget = getMouseTargetMethod
  svgCanvas.clearSelection = clearSelectionMethod
  svgCanvas.addToSelection = addToSelectionMethod
  svgCanvas.getIntersectionList = getIntersectionListMethod
  svgCanvas.runExtensions = runExtensionsMethod
  svgCanvas.groupSvgElem = groupSvgElem
  svgCanvas.prepareSvg = prepareSvg
  svgCanvas.recalculateAllSelectedDimensions = recalculateAllSelectedDimensions
  svgCanvas.setRotationAngle = setRotationAngle
}

/**
 * Clears the selection.
 */
const clearSelectionMethod = (noCall?: boolean): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  selectedElements.forEach((elem) => {
    if (!elem) {
      return
    }

    svgCanvas.selectorManager.releaseSelector(elem)
  })
  svgCanvas?.setEmptySelectedElements()

  if (!noCall) {
    svgCanvas.call('selected', svgCanvas.getSelectedElements())
  }
}

/**
 * Adds a list of elements to the selection.
 */
const addToSelectionMethod = (elemsToAdd: Element[], showGrips?: boolean): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  if (!elemsToAdd.length) {
    return
  }

  let firstNull = 0
  while (firstNull < selectedElements.length) {
    if (selectedElements[firstNull] === null) {
      break
    }
    ++firstNull
  }

  let i = elemsToAdd.length
  while (i--) {
    let elem: Element | null = elemsToAdd[i] ?? null
    if (!elem || !(elem as Element & { getBBox?: () => unknown }).getBBox) {
      continue
    }

    if (elem.tagName === 'a' && elem.childNodes.length === 1) {
      elem = elem.firstChild as Element
    }

    if (!selectedElements.includes(elem)) {
      selectedElements[firstNull] = elem

      firstNull++
      const sel = svgCanvas.selectorManager.requestSelector(elem)

      if (selectedElements.length > 1) {
        sel!.showGrips(false)
      }
    }
  }
  if (!selectedElements.length) {
    return
  }
  svgCanvas.call('selected', selectedElements)

  if (selectedElements.length === 1) {
    svgCanvas.selectorManager
      .requestSelector(selectedElements[0] ?? null)!
      .showGrips(showGrips ?? false)
  }

  selectedElements.sort((a: Element | null, b: Element | null) => {
    if (a && b) {
      return 3 - (b.compareDocumentPosition(a) & 6)
    }
    if (!a) {
      return 1
    }
    return 0
  })

  while (!selectedElements[0]) {
    selectedElements.shift()
  }
}

/**
 * Returns the mouse target for the given event.
 */
const getMouseTargetMethod = (evt: MouseEvent | null): Element | null => {
  if (!evt) {
    return null
  }
  let mouseTarget = evt.target as Element & { correspondingUseElement?: Element; namespaceURI?: string }

  if (mouseTarget.correspondingUseElement) {
    mouseTarget = mouseTarget.correspondingUseElement as Element & { correspondingUseElement?: Element; namespaceURI?: string }
  }

  if (
    mouseTarget.namespaceURI === NS.HTML &&
    mouseTarget.id !== 'svgcanvas'
  ) {
    while (mouseTarget.nodeName !== 'foreignObject') {
      mouseTarget = mouseTarget.parentNode as Element & { correspondingUseElement?: Element; namespaceURI?: string }
      if (!mouseTarget) {
        return svgCanvas.getSvgRoot()
      }
    }
  }

  const currentLayer: Element = svgCanvas.getCurrentDrawing().getCurrentLayer() as Element
  const svgRoot = svgCanvas.getSvgRoot()
  const container = svgCanvas.getDOMContainer()
  const content = svgCanvas.getSvgContent()
  if ([svgRoot, container, content, currentLayer].includes(mouseTarget)) {
    return svgCanvas.getSvgRoot()
  }

  if (getClosest(mouseTarget.parentNode as Element | null, '#selectorParentGroup')) {
    return svgCanvas.selectorManager.selectorParentGroup
  }

  while (
    !(mouseTarget as Element)?.parentNode?.isSameNode(
      svgCanvas.getCurrentGroup() ?? currentLayer
    )
  ) {
    mouseTarget = mouseTarget.parentNode as Element & { correspondingUseElement?: Element; namespaceURI?: string }
  }

  return mouseTarget
}

/**
 * Options for {@link RunExtensions}.
 *
 * `vars` may be a resolver function — if supplied as a function it is invoked once
 * (with the first extension's name) and the resolved value is reused for the
 * remaining extensions in iteration order. This mirrors the historical behavior.
 */
export interface RunExtensionsOpts {
  action: string
  vars?: unknown
}

/**
 * Invoke every registered extension's `action` handler. Always returns an array
 * of each extension's return value (or no entry for extensions that don't define
 * the action). Event-based extensions receive a `svgedit` CustomEvent instead.
 *
 * Closes audit input #2 (svgedit todo #4 / embed-API spec): the historical opt-in
 * `returnArray` boolean and positional `(action, vars)` shape are gone; the API
 * now always aggregates results and takes a typed options object.
 */
const runExtensionsMethod = (opts: RunExtensionsOpts): unknown[] => {
  const result: unknown[] = []
  let { vars } = opts
  for (const [name, ext] of Object.entries(svgCanvas.getExtensions() as Record<string, Record<string, unknown>>)) {
    if (typeof vars === 'function') {
      vars = (vars as (n: string) => unknown)(name)
    }
    if ((ext as { eventBased?: boolean }).eventBased) {
      const event = new CustomEvent('svgedit', { detail: { action: opts.action, vars } })
      document.dispatchEvent(event)
    } else if (ext[opts.action]) {
      result.push((ext[opts.action] as (v: unknown) => unknown)(vars))
    }
  }
  return result
}

/**
 * Get all elements that have a BBox.
 */
const getVisibleElementsAndBBoxes = (parent: Element | HTMLCollection | undefined): { elem: Element; bbox: { x: number; y: number; width: number; height: number } | null }[] => {
  if (!parent) {
    const svgContent: Element = svgCanvas.getSvgContent()
    parent = svgContent.children
  }
  const contentElems: { elem: Element; bbox: { x: number; y: number; width: number; height: number } | null }[] = []
  const elements: HTMLCollection = (parent as HTMLCollection).length !== undefined
    ? parent as HTMLCollection
    : (parent as Element).children
  Array.from(elements).forEach((elem) => {
    if ((elem as Element & { getBBox?: () => unknown }).getBBox) {
      contentElems.push({ elem, bbox: getStrokedBBoxDefaultVisible([elem]) as { x: number; y: number; width: number; height: number } | null })
    }
  })
  return contentElems.reverse()
}

/**
 * Returns elements that intersect the multi-select rubber-band-box.
 */
const getIntersectionListMethod = (rect?: { x: number; y: number; width: number; height: number }): Element[] | null => {
  const zoom: number = svgCanvas.getZoom()
  if (!svgCanvas.getRubberBox()) {
    return null
  }

  const parent: Element = (
    svgCanvas.getCurrentGroup() ??
    svgCanvas.getCurrentDrawing().getCurrentLayer()
  )!

  let rubberBBox: SVGRect
  if (!rect) {
    const rawBBox = getBBox(svgCanvas.getRubberBox()!) as { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number }
    const bb: SVGRect = svgCanvas.getSvgContent().createSVGRect();

    ['x', 'y', 'width', 'height', 'top', 'right', 'bottom', 'left'].forEach(
      (o) => {
        (bb as unknown as Record<string, number>)[o] = ((rawBBox as Record<string, number>)[o] ?? 0) / zoom
      }
    )
    rubberBBox = bb
  } else {
    rubberBBox = svgCanvas.getSvgContent().createSVGRect()
    rubberBBox.x = rect.x
    rubberBBox.y = rect.y
    rubberBBox.width = rect.width
    rubberBBox.height = rect.height
  }

  const resultList: Element[] = []
  if (svgCanvas.getCurBBoxes().length === 0) {
    svgCanvas.setCurBBoxes(getVisibleElementsAndBBoxes(parent))
  }
  let i: number = svgCanvas.getCurBBoxes().length
  while (i--) {
    const curBBoxes: { elem: Element; bbox: { x: number; y: number; width: number; height: number } | null }[] = svgCanvas.getCurBBoxes()
    const entry = curBBoxes[i]
    if (!entry) { continue }
    if (!rubberBBox.width) {
      continue
    }
    if (entry.bbox && rectsIntersect(rubberBBox, entry.bbox)) {
      resultList.push(entry.elem)
    }
  }

  return resultList
}

/**
 * Wrap an SVG element into a group element, mark the group as 'gsvg'.
 */
const groupSvgElem = (elem: Element): void => {
  const dataStorage = svgCanvas.getDataStorage()
  const g = document.createElementNS(NS.SVG, 'g')
  elem.replaceWith(g)
  g.appendChild(elem)
  dataStorage.put(g, 'gsvg', elem)
  g.id = svgCanvas.getNextId()
}

/**
 * Runs the SVG Document through the sanitizer and then updates its paths.
 */
const prepareSvg = (newDoc: XMLDocument): void => {
  svgCanvas.sanitizeSvg(newDoc.documentElement)

  const paths = [...newDoc.getElementsByTagNameNS(NS.SVG, 'path')]
  paths.forEach((path) => {
    const pathEl = path as unknown as SVGPathElement
    const convertedPath: string = svgCanvas.pathActions.convertPath(pathEl, true)
    pathEl.setAttribute('d', convertedPath)
    svgCanvas.pathActions.fixEnd(pathEl)
  })
}

/**
 * Removes any old rotations if present, prepends a new rotation at the
 * transformed center.
 */
const setRotationAngle = (val: string | number, preventUndo?: boolean): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  val = Number.parseFloat(String(val))
  const elem = selectedElements[0]
  if (!elem) { return }
  const oldTransform = elem.getAttribute('transform')
  const bbox = getBBox(elem) as { x: number; y: number; width: number; height: number }
  const cx = bbox.x + bbox.width / 2
  const cy = bbox.y + bbox.height / 2
  const tlist = getTransformList(elem)
  if (!tlist) { return }

  if (tlist.numberOfItems > 0) {
    const xform = tlist.getItem(0)
    if (xform.type === 4) {
      tlist.removeItem(0)
    }
  }
  if (val !== 0) {
    const center = transformPoint(
      cx,
      cy,
      transformListToTransform(tlist).matrix
    )
    const centerX = Number.isFinite(center.x) ? center.x : cx
    const centerY = Number.isFinite(center.y) ? center.y : cy
    const Rnc = svgCanvas.getSvgRoot().createSVGTransform()
    Rnc.setRotate(val, centerX, centerY)
    if (tlist.numberOfItems) {
      tlist.insertItemBefore(Rnc, 0)
    } else {
      tlist.appendItem(Rnc)
    }
  } else if (tlist.numberOfItems === 0) {
    elem.removeAttribute('transform')
  }

  if (!preventUndo) {
    let newTransform = elem.getAttribute('transform')

    if (newTransform && newTransform.startsWith('rotate(')) {
      const match = newTransform.match(/^rotate\(([\d.\-e]+)\s+([\d.\-e]+)\s+([\d.\-e]+)\)(.*)/)
      if (match) {
        const angle = Number.parseFloat(match[1] ?? '0')
        const round = (num: string | undefined): number => Math.round(Number(num ?? '0') + Number.EPSILON)
        const x = round(match[2])
        const y = round(match[3])
        const restOfTransform = match[4] ?? ''
        newTransform = `rotate(${angle} ${x} ${y})${restOfTransform}`
      }
    }

    if (oldTransform) {
      elem.setAttribute('transform', oldTransform)
    } else {
      elem.removeAttribute('transform')
    }
    svgCanvas.changeSelectedAttribute(
      'transform',
      newTransform as string | number,
      selectedElements
    )
    svgCanvas.call('changed', selectedElements)
  }
  const selector = svgCanvas.selectorManager.requestSelector(
    selectedElements[0] ?? null
  )
  if (selector) { selector.resize() }
  svgCanvas.getSelector().updateGripCursors(val)
}

/**
 * Runs `recalculateDimensions` on the selected elements.
 */
const recalculateAllSelectedDimensions = (): void => {
  const text: string =
    svgCanvas.getCurrentResizeMode() === 'none' ? 'position' : 'size'
  const batchCmd = new BatchCommand(text)
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()

  selectedElements.forEach((elem) => {
    if (!elem) { return }
    const cmd = svgCanvas.recalculateDimensions(elem)
    if (cmd) {
      batchCmd.addSubCommand(cmd)
    }
  })

  if (!batchCmd.isEmpty()) {
    svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.call('changed', selectedElements)
  }
}
