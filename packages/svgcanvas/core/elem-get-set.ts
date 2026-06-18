/**
 * @module elem-get-set get and set methods.
 * @license MIT
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access -- ISvgCanvas properties flow `any` into assignments */

import Paint from './paint.js'
import { NS } from './namespaces.js'
import {
  getVisibleElements, getStrokedBBoxDefaultVisible, findDefs,
  walkTree, getHref, setHref, getElement
} from './utilities.js'
import {
  convertToNum
} from './units.js'
import { getParents } from '../common/util.js'
import { isSafeImageHref } from './sanitize.js'
import { warn } from '../common/logger.js'

import type { ISvgCanvas } from './svgcanvas-types.js'

// Background color / paint values that fetch or script — never write these to fill (#49).
const UNSAFE_PAINT = /url\s*\(|expression\s*\(|image-set\s*\(|javascript:/i

let svgCanvas = null as unknown as ISvgCanvas

/**
* Initializes this module by binding all get/set methods onto the canvas instance.
* @function module:elem-get-set.init
*/
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
  svgCanvas.getBold = getBoldMethod
  svgCanvas.setBold = setBoldMethod
  svgCanvas.getItalic = getItalicMethod
  svgCanvas.setItalic = setItalicMethod
  svgCanvas.hasTextDecoration = hasTextDecorationMethod
  svgCanvas.addTextDecoration = addTextDecorationMethod
  svgCanvas.removeTextDecoration = removeTextDecorationMethod
  svgCanvas.setTextAnchor = setTextAnchorMethod
  svgCanvas.setLetterSpacing = setLetterSpacingMethod
  svgCanvas.setWordSpacing = setWordSpacingMethod
  svgCanvas.setTextLength = setTextLengthMethod
  svgCanvas.setLengthAdjust = setLengthAdjustMethod
  svgCanvas.getFontFamily = getFontFamilyMethod
  svgCanvas.setFontFamily = setFontFamilyMethod
  svgCanvas.setFontColor = setFontColorMethod
  svgCanvas.getFontColor = getFontColorMethod
  svgCanvas.getFontSize = getFontSizeMethod
  svgCanvas.setFontSize = setFontSizeMethod
  svgCanvas.getText = getTextMethod
  svgCanvas.setTextContent = setTextContentMethod
  svgCanvas.setImageURL = setImageURLMethod
  svgCanvas.setLinkURL = setLinkURLMethod
  svgCanvas.setRectRadius = setRectRadiusMethod
  svgCanvas.makeHyperlink = makeHyperlinkMethod
  svgCanvas.removeHyperlink = removeHyperlinkMethod
  svgCanvas.setSegType = setSegTypeMethod
  svgCanvas.setStrokeWidth = setStrokeWidthMethod
  svgCanvas.getResolution = getResolutionMethod
  svgCanvas.getTitle = getTitleMethod
  svgCanvas.setGroupTitle = setGroupTitleMethod
  svgCanvas.setStrokeAttr = setStrokeAttrMethod
  svgCanvas.setBackground = setBackgroundMethod
  svgCanvas.setDocumentTitle = setDocumentTitleMethod
  svgCanvas.getEditorNS = getEditorNSMethod
  svgCanvas.setResolution = setResolutionMethod
  svgCanvas.setBBoxZoom = setBBoxZoomMethod
  svgCanvas.setCurrentZoom = setZoomMethod
  svgCanvas.setColor = setColorMethod
  svgCanvas.setGradient = setGradientMethod
  svgCanvas.setPaint = setPaintMethod
}

/**
* @function module:elem-get-set.SvgCanvas#getResolution
* @returns The current dimensions and zoom level in an object
*/
const getResolutionMethod = (): { w: number; h: number; zoom: number } => {
  const zoom: number = svgCanvas.getZoom()
  const w: number = Number(svgCanvas.getSvgContent().getAttribute('width')) / zoom
  const h: number = Number(svgCanvas.getSvgContent().getAttribute('height')) / zoom

  return {
    w,
    h,
    zoom
  }
}

/**
* @function module:elem-get-set.SvgCanvas#getTitle
*/
const getTitleMethod = (elem?: Element): string | undefined => {
  const selectedElements = svgCanvas.getSelectedElements()
  const dataStorage = svgCanvas.getDataStorage()
  elem = elem ?? selectedElements[0] ?? undefined
  if (!elem) { return undefined }
  if (dataStorage.has(elem, 'gsvg')) {
    elem = dataStorage.get(elem, 'gsvg') as Element
  } else if (dataStorage.has(elem, 'symbol')) {
    elem = dataStorage.get(elem, 'symbol') as Element
  }
  if (!elem) { return undefined }
  const childs = elem.childNodes
  for (const child of childs) {
    if (child.nodeName === 'title') {
      return child.textContent ?? ''
    }
  }
  return ''
}

/**
* Sets the group/SVG's title content.
* @function module:elem-get-set.SvgCanvas#setGroupTitle
* @param val
*/
const setGroupTitleMethod = (val: string): void => {
  const {
    InsertElementCommand, RemoveElementCommand,
    ChangeElementCommand, BatchCommand
  } = svgCanvas.history
  const selectedElements = svgCanvas.getSelectedElements()
  const dataStorage = svgCanvas.getDataStorage()
  let elem: Element | null = selectedElements[0] ?? null
  if (!elem) { return }
  if (dataStorage.has(elem, 'gsvg')) {
    elem = dataStorage.get(elem, 'gsvg') as Element | null
  } else if (dataStorage.has(elem, 'symbol')) {
    elem = dataStorage.get(elem, 'symbol') as Element | null
  }
  if (!elem) { return }

  const batchCmd = new BatchCommand('Set Label')

  let title: ChildNode | null = null
  for (const child of elem.childNodes) {
    if (child.nodeName === 'title') {
      title = child
      break
    }
  }

  if (val.length === 0) {
    if (!title) { return }
    const { nextSibling } = title
    title.remove()
    batchCmd.addSubCommand(new RemoveElementCommand(title as unknown as Element, nextSibling, elem))
  } else if (title) {
    const oldText = title.textContent
    if (oldText === val) { return }
    title.textContent = val
    batchCmd.addSubCommand(new ChangeElementCommand(title as unknown as Element, { '#text': oldText }))
  } else {
    const newTitle = svgCanvas.getDOMDocument().createElementNS(NS.SVG, 'title')
    newTitle.textContent = val
    elem.insertBefore(newTitle, elem.firstChild)
    batchCmd.addSubCommand(new InsertElementCommand(newTitle))
  }

  if (!batchCmd.isEmpty()) {
    svgCanvas.addCommandToHistory(batchCmd)
  }
}

/**
* Adds/updates a title element for the document with the given name.
* @function module:elem-get-set.SvgCanvas#setDocumentTitle
* @param newTitle
*/
const setDocumentTitleMethod = (newTitle: string): void => {
  const {
    InsertElementCommand, RemoveElementCommand,
    ChangeElementCommand, BatchCommand
  } = svgCanvas.history
  const svgContent: Element = svgCanvas.getSvgContent()

  const batchCmd = new BatchCommand('Change Image Title')

  let docTitle: ChildNode | null = null
  for (const child of svgContent.childNodes) {
    if (child.nodeName === 'title') {
      docTitle = child
      break
    }
  }

  if (!docTitle) {
    if (!newTitle.length) { return }
    const created = svgCanvas.getDOMDocument().createElementNS(NS.SVG, 'title')
    created.textContent = newTitle
    svgContent.insertBefore(created, svgContent.firstChild)
    batchCmd.addSubCommand(new InsertElementCommand(created))
  } else if (newTitle.length) {
    const oldTitle = docTitle.textContent
    if (oldTitle === newTitle) { return }
    docTitle.textContent = newTitle
    batchCmd.addSubCommand(new ChangeElementCommand(docTitle as unknown as Element, { '#text': oldTitle }))
  } else {
    const { nextSibling } = docTitle
    docTitle.remove()
    batchCmd.addSubCommand(new RemoveElementCommand(docTitle as unknown as Element, nextSibling, svgContent))
  }

  if (!batchCmd.isEmpty()) {
    svgCanvas.addCommandToHistory(batchCmd)
  }
}

/**
* Changes the document's dimensions to the given size.
* @function module:elem-get-set.SvgCanvas#setResolution
* @param x
* @param y
*/
const setResolutionMethod = (x: number | 'fit', y: number): boolean => {
  const { ChangeElementCommand, BatchCommand } = svgCanvas.history
  const res: { w: number; h: number } = svgCanvas.getResolution()
  const { w, h } = res
  let batchCmd: InstanceType<typeof svgCanvas.history.BatchCommand> | undefined

  if (x === 'fit') {
    const bbox = getStrokedBBoxDefaultVisible()

    if (bbox) {
      batchCmd = new BatchCommand('Fit Canvas to Content')
      const visEls: Element[] = getVisibleElements()
      svgCanvas.addToSelection(visEls)
      const dx: number[] = []
      const dy: number[] = []
      visEls.forEach(() => {
        dx.push(bbox.x * -1)
        dy.push(bbox.y * -1)
      })

      const cmd = svgCanvas.moveSelectedElements(dx, dy, false)
      if (cmd && batchCmd) {
        batchCmd.addSubCommand(cmd)
      }
      svgCanvas.clearSelection()

      x = Math.round(bbox.width)
      y = Math.round(bbox.height)
    } else {
      return false
    }
  }
  const newW = convertToNum('width', String(x))
  const newH = convertToNum('height', String(y))
  if (newW !== w || newH !== h) {
    if (!batchCmd) {
      batchCmd = new BatchCommand('Change Image Dimensions')
    }
    const svgContent: Element = svgCanvas.getSvgContent()
    const oldViewBox = svgContent.getAttribute('viewBox')

    svgContent.setAttribute('width', String(newW))
    svgContent.setAttribute('height', String(newH))

    svgCanvas.contentW = newW
    svgCanvas.contentH = newH
    svgContent.setAttribute('viewBox', [0, 0, newW, newH].join(' '));
    batchCmd.addSubCommand(new ChangeElementCommand(svgContent, { width: String(w), height: String(h), viewBox: oldViewBox }))

    svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.call('changed', [svgContent])
  }
  return true
}

/**
* Returns the editor's namespace URL.
* @function module:elem-get-set.SvgCanvas#getEditorNS
*/
const getEditorNSMethod = (add?: boolean): string => {
  if (add) {
    svgCanvas.getSvgContent().setAttribute('xmlns:se', NS.SE)
  }
  return NS.SE
}

/**
* Sets the zoom level on the canvas-side based on the given value.
* @function module:elem-get-set.SvgCanvas#setBBoxZoom
*/
const setBBoxZoomMethod = (val: unknown, editorW: number, editorH: number): { zoom: number; bbox: unknown } | undefined => {
  const zoom: number = svgCanvas.getZoom()
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  let spacer = 0.85
  let bb: { width: number; height: number; x: number; y: number; zoom?: number; factor?: number } | undefined

  const calcZoom = (bbox: { width: number; height: number; x: number; y: number } | undefined): { zoom: number; bbox: unknown } | undefined => {
    if (!bbox) { return undefined }
    if (!Number.isFinite(editorW) || !Number.isFinite(editorH) || editorW <= 0 || editorH <= 0) {
      return undefined
    }
    if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
      return undefined
    }
    const wZoom = Math.round((editorW / bbox.width) * 100 * spacer) / 100
    const hZoom = Math.round((editorH / bbox.height) * 100 * spacer) / 100
    const newZoom = Math.min(wZoom, hZoom)
    if (!Number.isFinite(newZoom) || newZoom <= 0) {
      return undefined
    }
    svgCanvas.setZoom(newZoom)
    return { zoom: newZoom, bbox }
  }

  if (val && typeof val === 'object') {
    bb = val as { width: number; height: number; x: number; y: number; zoom?: number; factor?: number }
    if (bb.width === 0 || bb.height === 0) {
      let newzoom = zoom
      if (Number.isFinite(bb.zoom) && (bb.zoom ?? 0) > 0) {
        newzoom = bb.zoom ?? zoom
      } else if (Number.isFinite(bb.factor) && (bb.factor ?? 0) > 0) {
        newzoom = zoom * (bb.factor ?? 1)
      }
      if (Number.isFinite(newzoom) && newzoom > 0) {
        svgCanvas.setZoom(newzoom)
      }
      return { zoom: newzoom, bbox: bb }
    }
    return calcZoom(bb)
  }

  switch (val) {
    case 'selection': {
      if (!selectedElements[0]) { return undefined }
      const selectedElems = selectedElements.filter((e): e is Element => e !== null)
      bb = getStrokedBBoxDefaultVisible(selectedElems) as typeof bb
      break
    } case 'canvas': {
      const res: { w: number; h: number } = svgCanvas.getResolution()
      spacer = 0.95
      bb = { width: res.w, height: res.h, x: 0, y: 0 }
      break
    } case 'content':
      bb = getStrokedBBoxDefaultVisible() as typeof bb
      break
    case 'layer':
      bb = getStrokedBBoxDefaultVisible(getVisibleElements(svgCanvas.getCurrentDrawing().getCurrentLayer())) as typeof bb
      break
    default:
      return undefined
  }
  return calcZoom(bb)
}

/**
* Sets the zoom to the given level.
* @function module:elem-get-set.SvgCanvas#setZoom
* @param zoomLevel
*/
const setZoomMethod = (zoomLevel: number): void => {
  if (!Number.isFinite(zoomLevel) || zoomLevel <= 0) {
    return
  }
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const res: { w: number; h: number } = svgCanvas.getResolution()
  const w = res.w / zoomLevel
  const h = res.h / zoomLevel
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return
  }
  svgCanvas.getSvgContent().setAttribute('viewBox', `0 0 ${w} ${h}`)
  svgCanvas.setZoom(zoomLevel)
  selectedElements.forEach((elem) => {
    if (!elem) { return }
    const selector = svgCanvas.selectorManager.requestSelector(elem)
    if (selector) { selector.resize() }
  })
  svgCanvas.pathActions.zoomChange()
  svgCanvas.runExtensions({ action: 'zoomChanged', vars: zoomLevel })
}

/**
* Change the current stroke/fill color/gradient value.
* @function module:elem-get-set.SvgCanvas#setColor
*/
const setColorMethod = (type: string, val: string, preventUndo?: boolean): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  svgCanvas.setCurShape(type, val)
  svgCanvas.setCurProperties(`${type}_paint`, { type: 'solidColor' })
  const elems: Element[] = []

  const addNonG = (e: Element): void => {
    if (e.nodeName !== 'g') {
      elems.push(e)
    }
  }
  let i = selectedElements.length
  while (i--) {
    const elem = selectedElements[i]
    if (elem) {
      if (elem.tagName === 'g') {
        walkTree(elem, addNonG)
      } else if (type === 'fill') {
        if (elem.tagName !== 'polyline' && elem.tagName !== 'line') {
          elems.push(elem)
        }
      } else {
        elems.push(elem)
      }
    }
  }
  if (elems.length > 0) {
    if (!preventUndo) {
      svgCanvas.changeSelectedAttribute(type, val, elems)
      svgCanvas.call('changed', elems)
    } else {
      svgCanvas.changeSelectedAttributeNoUndo(type, val, elems)
    }
  }
}

/**
* Apply the current gradient to selected element's fill or stroke.
* @function module:elem-get-set.SvgCanvas#setGradient
*/
const setGradientMethod = (type: string): void => {
  if (!svgCanvas.getCurProperties(`${type}_paint`) ||
    svgCanvas.getCurProperties(`${type}_paint`).type === 'solidColor') { return }
  const canvas = svgCanvas
  let grad = canvas[type + 'Grad']
  if (!grad) { return }
  const duplicateGrad = findDuplicateGradient(grad as SVGGradientElement)
  const defs = findDefs()
  if (!duplicateGrad) {
    grad = svgCanvas.getDOMDocument().importNode(grad, true)
    defs.append(grad)
    grad.id = svgCanvas.getNextId()
  } else {
    grad = duplicateGrad
  }
  svgCanvas.setColor(type, `url(#${grad.id})`)
}

/**
* Check if exact gradient already exists.
*/
const findDuplicateGradient = (grad: SVGGradientElement | null): SVGGradientElement | null => {
  if (!grad) {
    return null
  }
  if (!['linearGradient', 'radialGradient'].includes(grad.tagName)) {
    return null
  }
  const defs = findDefs()
  const existingGrads = defs.querySelectorAll('linearGradient, radialGradient')
  let i = existingGrads.length
  const radAttrs = ['r', 'cx', 'cy', 'fx', 'fy'] as const
  while (i--) {
    const og = existingGrads[i]
    if (!og) { continue }
    if (og.tagName !== grad.tagName) {
      continue
    }
    if (grad.tagName === 'linearGradient') {
      if (grad.getAttribute('x1') !== og.getAttribute('x1') ||
        grad.getAttribute('y1') !== og.getAttribute('y1') ||
        grad.getAttribute('x2') !== og.getAttribute('x2') ||
        grad.getAttribute('y2') !== og.getAttribute('y2')
      ) {
        continue
      }
    } else {
      const gradAttrs: Record<string, number> = {
        r: Number(grad.getAttribute('r')),
        cx: Number(grad.getAttribute('cx')),
        cy: Number(grad.getAttribute('cy')),
        fx: Number(grad.getAttribute('fx')),
        fy: Number(grad.getAttribute('fy'))
      }
      const ogAttrs: Record<string, number> = {
        r: Number(og.getAttribute('r')),
        cx: Number(og.getAttribute('cx')),
        cy: Number(og.getAttribute('cy')),
        fx: Number(og.getAttribute('fx')),
        fy: Number(og.getAttribute('fy'))
      }

      let diff = false
      radAttrs.forEach((attr) => {
        if (gradAttrs[attr] !== ogAttrs[attr]) { diff = true }
      })

      if (diff) { continue }
    }

    const stops = grad.getElementsByTagNameNS(NS.SVG, 'stop')
    const ostops = og.getElementsByTagNameNS(NS.SVG, 'stop')

    if (stops.length !== ostops.length) {
      continue
    }

    let j = stops.length
    while (j--) {
      const stop = stops[j]
      const ostop = ostops[j]
      if (!stop || !ostop) { break }

      if (stop.getAttribute('offset') !== ostop.getAttribute('offset') ||
        stop.getAttribute('stop-opacity') !== ostop.getAttribute('stop-opacity') ||
        stop.getAttribute('stop-color') !== ostop.getAttribute('stop-color')) {
        break
      }
    }

    if (j === -1) {
      return og as SVGGradientElement
    }
  }

  return null
}

/**
* Set a color/gradient to a fill/stroke.
* @function module:elem-get-set.SvgCanvas#setPaint
*/
const setPaintMethod = (type: string, paint: ConstructorParameters<typeof Paint>[0]): void => {
  const p = new Paint(paint)
  svgCanvas.setPaintOpacity(type, p.alpha / 100, true)

  svgCanvas.setCurProperties(`${type}_paint`, p)
  switch (p.type) {
    case 'solidColor':
      svgCanvas.setColor(type, p.solidColor !== 'none' ? `#${p.solidColor}` : 'none')
      break
    case 'linearGradient':
    case 'radialGradient':
      svgCanvas.setCanvas(type + 'Grad', p[p.type])
      svgCanvas.setGradient(type)
      break
  }
}

/**
* Sets the stroke width for the current selected elements.
* @function module:elem-get-set.SvgCanvas#setStrokeWidth
*/
const setStrokeWidthMethod = (val: number): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  if (val === 0 && ['line', 'path'].includes(svgCanvas.getMode())) {
    svgCanvas.setStrokeWidth(1)
    return
  }
  svgCanvas.setCurProperties('stroke_width', val)

  const elems: Element[] = []

  const addNonG = (e: Element): void => {
    if (e.nodeName !== 'g') {
      elems.push(e)
    }
  }
  let i = selectedElements.length
  while (i--) {
    const elem = selectedElements[i]
    if (elem) {
      if (elem.tagName === 'g') {
        walkTree(elem, addNonG)
      } else {
        elems.push(elem)
      }
    }
  }
  if (elems.length > 0) {
    svgCanvas.changeSelectedAttribute('stroke-width', val, elems)
    svgCanvas.call('changed', selectedElements)
  }
}

/**
* Set the given stroke-related attribute the given value for selected elements.
* @function module:elem-get-set.SvgCanvas#setStrokeAttr
*/
const setStrokeAttrMethod = (attr: string, val: string | number): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  svgCanvas.setCurShape(attr.replace('-', '_'), val)
  const elems: Element[] = []

  let i = selectedElements.length
  while (i--) {
    const elem = selectedElements[i]
    if (elem) {
      if (elem.tagName === 'g') {
        walkTree(elem, (e: Element) => { if (e.nodeName !== 'g') { elems.push(e) } })
      } else {
        elems.push(elem)
      }
    }
  }
  if (elems.length > 0) {
    svgCanvas.changeSelectedAttribute(attr, val, elems)
    svgCanvas.call('changed', selectedElements)
  }
}

const getSelectedTextElements = (): Element[] => {
  return svgCanvas.getSelectedElements().filter((el): el is Element => el?.tagName === 'text')
}

const getChangedTextElements = (textElements: Element[], attr: string, newValue: string | number): Element[] => {
  const normalizedValue = String(newValue)
  return textElements.filter((elem) => {
    const oldValue = attr === '#text' ? elem.textContent : elem.getAttribute(attr)
    return (oldValue ?? '') !== normalizedValue
  })
}

const notifyTextChange = (textElements: Element[]): void => {
  if (textElements.length > 0) {
    svgCanvas.call('changed', textElements)
  }
}

/**
 * Check if all selected text elements are in bold.
 */
const getBoldMethod = (): boolean => {
  const textElements = getSelectedTextElements()
  return textElements.every(el => el.getAttribute('font-weight') === 'bold')
}

/**
 * Make the selected element(s) bold or normal.
 */
const setBoldMethod = (b: boolean): void => {
  const textElements = getSelectedTextElements()
  const value = b ? 'bold' : 'normal'
  const changedTextElements = getChangedTextElements(textElements, 'font-weight', value)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('font-weight', value, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

/**
 * Check if all selected elements have the given text decoration value.
 */
const hasTextDecorationMethod = (value: string): boolean => {
  const textElements = getSelectedTextElements()
  return textElements.every(el => (el.getAttribute('text-decoration') ?? '').includes(value))
}

/**
 * Adds the given text decoration value.
 */
const addTextDecorationMethod = (value: string): void => {
  const { ChangeElementCommand, BatchCommand } = svgCanvas.history
  const textElements = getSelectedTextElements()

  const batchCmd = new BatchCommand()
  textElements.forEach((elem: Element) => {
    const oldValue = elem.getAttribute('text-decoration') ?? ''
    if (!oldValue.includes(value)) {
      batchCmd.addSubCommand(new ChangeElementCommand(elem, { 'text-decoration': oldValue }))
      svgCanvas.changeSelectedAttributeNoUndo('text-decoration', `${oldValue} ${value}`.trim(), [elem])
    }
  })
  if (!batchCmd.isEmpty()) {
    svgCanvas.undoMgr.addCommandToHistory(batchCmd)
  }

  if (!textElements.some((el: Element) => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
}

/**
 * Removes the given text decoration value.
 */
const removeTextDecorationMethod = (value: string): void => {
  const { ChangeElementCommand, BatchCommand } = svgCanvas.history
  const textElements = getSelectedTextElements()

  const batchCmd = new BatchCommand()
  textElements.forEach((elem: Element) => {
    const actualValues = elem.getAttribute('text-decoration') ?? ''
    batchCmd.addSubCommand(new ChangeElementCommand(elem, { 'text-decoration': actualValues }))
    svgCanvas.changeSelectedAttributeNoUndo('text-decoration', actualValues.replace(value, '').trim(), [elem])
  })
  if (!batchCmd.isEmpty()) {
    svgCanvas.undoMgr.addCommandToHistory(batchCmd)
  }

  if (!textElements.some((el: Element) => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
}

/**
 * Check if all selected elements have an italic font style.
 */
const getItalicMethod = (): boolean => {
  const textElements = getSelectedTextElements()
  return textElements.every(el => el.getAttribute('font-style') === 'italic')
}

/**
 * Make the selected element(s) italic or normal.
 */
const setItalicMethod = (i: boolean): void => {
  const textElements = getSelectedTextElements()
  const value = i ? 'italic' : 'normal'
  const changedTextElements = getChangedTextElements(textElements, 'font-style', value)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('font-style', value, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

/**
 * Set the new text anchor.
 */
const setTextAnchorMethod = (value: string): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'text-anchor', value)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('text-anchor', value, changedTextElements)
  }
  notifyTextChange(changedTextElements)
}

/**
 * Set the new letter spacing.
 */
const setLetterSpacingMethod = (value: string): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'letter-spacing', value)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('letter-spacing', value, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

/**
 * Set the new word spacing.
 */
const setWordSpacingMethod = (value: string): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'word-spacing', value)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('word-spacing', value, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

/**
 * Set the new text length.
 */
const setTextLengthMethod = (value: string): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'textLength', value)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('textLength', value, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

/**
 * Set the new length adjust.
 */
const setLengthAdjustMethod = (value: string): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'lengthAdjust', value)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('lengthAdjust', value, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

const getFontFamilyMethod = (): string => {
  return svgCanvas.getCurText('font_family') as string
}

/**
 * Set the new font family.
 */
const setFontFamilyMethod = (val: string): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'font-family', val)
  svgCanvas.setCurText('font_family', val)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('font-family', val, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

/**
 * Set the new font color.
 */
const setFontColorMethod = (val: string): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'fill', val)
  svgCanvas.setCurText('fill', val)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('fill', val, changedTextElements)
  }
  notifyTextChange(changedTextElements)
}

const getFontColorMethod = (): string => {
  return svgCanvas.getCurText('fill') as string
}

const getFontSizeMethod = (): number => {
  return svgCanvas.getCurText('font_size') as number
}

/**
 * Applies the given font size to the selected element.
 */
const setFontSizeMethod = (val: number): void => {
  const textElements = getSelectedTextElements()
  const changedTextElements = getChangedTextElements(textElements, 'font-size', val)
  svgCanvas.setCurText('font_size', val)
  if (changedTextElements.length > 0) {
    svgCanvas.changeSelectedAttribute('font-size', val, changedTextElements)
  }
  if (!textElements.some(el => el.textContent)) {
    svgCanvas.textActions.setCursor()
  }
  notifyTextChange(changedTextElements)
}

const getTextMethod = (): string => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const selected = selectedElements[0]
  return selected ? (selected.textContent ?? '') : ''
}

/**
 * Updates the text element with the given string.
 */
const setTextContentMethod = (val: string): void => {
  svgCanvas.changeSelectedAttribute('#text', val)
  svgCanvas.textActions.init(val)
  svgCanvas.textActions.setCursor()
}

/**
 * Sets the new image URL for the selected image element.
 */
const setImageURLMethod = (val: string): void => {
  const { ChangeElementCommand, BatchCommand } = svgCanvas.history
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const elem = selectedElements[0]
  if (!elem) { return }

  // Only a local/http(s)/data:image/same-origin source may be set + loaded — reject
  // javascript:, data:text/html, and other non-image schemes (#48), mirroring the
  // import sanitizer's <image> href policy.
  if (!isSafeImageHref(val)) {
    warn(`unsafe image URL ignored (${val})`, null, 'elem-get-set')
    return
  }

  const attrs = {
    width: elem.getAttribute('width'),
    height: elem.getAttribute('height')
  }
  const setsize = (!attrs.width || !attrs.height)

  const curHref = getHref(elem)
  const hrefChanged = curHref !== val

  if (!hrefChanged && !setsize) {
    return
  }

  const batchCmd = new BatchCommand('Change Image URL')

  if (hrefChanged) {
    setHref(elem, val)
    batchCmd.addSubCommand(new ChangeElementCommand(elem, {
      '#href': curHref
    }))
  }

  let finalized = false
  const finalize = (): void => {
    if (finalized) { return }
    finalized = true
    if (batchCmd.isEmpty()) { return }
    svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.call('changed', [elem])
  }

  const img = new Image()
  img.onload = (): void => {
    const changes = {
      width: elem.getAttribute('width'),
      height: elem.getAttribute('height')
    }
    elem.setAttribute('width', String(img.width))
    elem.setAttribute('height', String(img.height))

    const selector = svgCanvas.selectorManager.requestSelector(elem)
    if (selector) { selector.resize() }

    batchCmd.addSubCommand(new ChangeElementCommand(elem, changes))
    finalize()
  }
  img.onerror = (): void => {
    finalize()
  }
  img.src = val
}

/**
 * Sets the new link URL for the selected anchor element.
 */
const setLinkURLMethod = (val: string): void => {
  const { ChangeElementCommand, BatchCommand } = svgCanvas.history
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  let elem: Element | null = selectedElements[0] ?? null
  if (!elem) { return }
  if (elem.tagName !== 'a') {
    const parentsA = getParents(elem.parentNode, 'a')
    if (parentsA?.length) {
      elem = (parentsA[0] as Element) ?? null
    } else {
      return
    }
  }
  if (!elem) { return }

  const curHref = getHref(elem)

  if (curHref === val) { return }

  const batchCmd = new BatchCommand('Change Link URL')

  setHref(elem, val)
  batchCmd.addSubCommand(new ChangeElementCommand(elem, {
    '#href': curHref
  }))

  svgCanvas.addCommandToHistory(batchCmd)
}

/**
 * Sets the `rx` and `ry` values to the selected `rect` element.
 */
const setRectRadiusMethod = (val: string | number): void => {
  const { ChangeElementCommand } = svgCanvas.history
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const selected = selectedElements[0]
  if (selected?.tagName !== 'rect') { return }

  const radius = Number(val)
  if (!Number.isFinite(radius) || radius < 0) {
    return
  }

  const oldRx = selected.getAttribute('rx')
  const oldRy = selected.getAttribute('ry')
  const currentRx = Number(oldRx)
  const currentRy = Number(oldRy)
  const hasCurrentRx = oldRx !== null && Number.isFinite(currentRx)
  const hasCurrentRy = oldRy !== null && Number.isFinite(currentRy)
  const already = (radius === 0 && oldRx === null && oldRy === null) ||
    (hasCurrentRx && hasCurrentRy && currentRx === radius && currentRy === radius)
  if (already) { return }

  selected.setAttribute('rx', String(radius))
  selected.setAttribute('ry', String(radius))
  svgCanvas.addCommandToHistory(new ChangeElementCommand(selected, { rx: oldRx, ry: oldRy }, 'Radius'))
  svgCanvas.call('changed', [selected])
}

/**
 * Wraps the selected element(s) in an anchor element.
 */
const makeHyperlinkMethod = (url: string): void => {
  svgCanvas.groupSelectedElements('a', url)
}

/**
 * Removes the hyperlink wrapping.
 */
const removeHyperlinkMethod = (): void => {
  svgCanvas.ungroupSelectedElement()
}

/**
 * Sets the new segment type to the selected segment(s).
 */
const setSegTypeMethod = (newType: number): void => {
  svgCanvas.pathActions.setSegType(newType)
}

/**
 * Set the background of the editor.
 */
const setBackgroundMethod = (color: string, url: string): void => {
  const bg = getElement('canvasBackground')
  if (!bg) { return }
  const border = bg.querySelector('rect')
  if (!border) { return }
  let bgImg: Element | null = getElement('background_image')
  let bgPattern: Element | null = getElement('background_pattern')
  const fillVal = color === 'chessboard' ? '#fff' : color
  if (UNSAFE_PAINT.test(fillVal)) {
    warn(`unsafe background color ignored (${fillVal})`, null, 'elem-get-set')
  } else {
    border.setAttribute('fill', fillVal)
  }
  if (color === 'chessboard') {
    if (!bgPattern) {
      bgPattern = svgCanvas.getDOMDocument().createElementNS(NS.SVG, 'foreignObject')
      svgCanvas.assignAttributes(bgPattern, {
        id: 'background_pattern',
        width: '100%',
        height: '100%',
        preserveAspectRatio: 'xMinYMin',
        style: 'pointer-events:none'
      })
      const div = document.createElement('div')
      svgCanvas.assignAttributes(div, {
        style: 'pointer-events:none;width:100%;height:100%;' +
          'background-image:url(data:image/gif;base64,' +
          'R0lGODlhEAAQAIAAAP///9bW1iH5BAAAAAAALAAAAAAQABAAAAIfjG+' +
          'gq4jM3IFLJgpswNly/XkcBpIiVaInlLJr9FZWAQA7);'
      })
      if (bgPattern) {
        bgPattern.append(div)
        bg.append(bgPattern)
      }
    }
  } else if (bgPattern) {
    bgPattern.remove()
  }
  if (url && !isSafeImageHref(url)) {
    warn(`unsafe background image URL ignored (${url})`, null, 'elem-get-set')
    if (bgImg) { bgImg.remove() }
  } else if (url) {
    if (!bgImg) {
      bgImg = svgCanvas.getDOMDocument().createElementNS(NS.SVG, 'image')
      svgCanvas.assignAttributes(bgImg, {
        id: 'background_image',
        width: '100%',
        height: '100%',
        preserveAspectRatio: 'xMinYMin',
        style: 'pointer-events:none'
      })
    }
    setHref(bgImg, url)
    bg.append(bgImg)
  } else if (bgImg) {
    bgImg.remove()
  }
}
