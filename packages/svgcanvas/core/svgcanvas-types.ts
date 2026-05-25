/**
 * ISvgCanvas — the public contract of SvgCanvas.
 *
 * This file is a pure-type module (no runtime code).  Core modules can
 * `import type { ISvgCanvas } from './svgcanvas-types.js'` without
 * creating a circular dependency on the class implementation.
 *
 * @module svgcanvas-types
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── type-only imports (safe — no runtime cycle) ─────────────────────────
import type { BatchCommand, UndoManager } from './history.js'
import type * as history from './history.js'
import type * as draw from './draw.js'
import type * as pathModule from './path.js'
import type { SVGElementJSON } from './utilities.js'
import type { Selector, getSelectorManager } from './select.js'
import type { NS } from './namespaces.js'
import type dataStorage from './dataStorage.js'

// functions whose `typeof` we need for declare-field mirroring
import type { getJsonFromSvgElements, addSVGElementsFromJson } from './json.js'
import type { clearSvgContentElementInit } from './clear.js'
import type { textActionsMethod } from './text-actions.js'
import type {
  getStrokedBBoxDefaultVisible,
  getVisibleElements,
  stringToHTML,
  insertChildAtIndex,
  assignAttributes,
  cleanupElement,
  getElement,
  getUrlFromAttr,
  findDefs,
  getHref,
  setHref,
  getRefElem,
  getRotationAngle,
  encode64,
  decode64,
  getBBox as utilsGetBBox,
  $id,
  $qa,
  $qq,
  $click
} from './utilities.js'
import type {
  matrixMultiply,
  hasMatrixTransform,
  transformListToTransform
} from './math.js'
import type { convertToNum, getTypeMap, convertUnit } from './units.js'
import type { remapElement } from './coords.js'
import type { recalculateDimensions } from './recalculate.js'
import type { sanitizeSvg } from './sanitize.js'
import type { pasteElementsMethod } from './paste-elem.js'
import type {
  changeSelectedAttributeNoUndoMethod,
  changeSelectedAttributeMethod
} from './undo.js'
import type {
  setBlurNoUndo,
  setBlurOffsets,
  setBlur
} from './blur-event.js'
import type {
  getClosest,
  getParents,
  mergeDeep
} from '../common/util.js'

export interface ISvgCanvas {
  // ── Instance fields: primitive / simple state ──────────────────────────
  saveOptions: { round_digits: number; apply?: boolean; images?: string }
  importIds: Record<string, any>
  extensions: Record<string, any>
  removedElements: Record<string, Element>
  started: boolean
  startTransform: string | null
  currentMode: string
  currentResizeMode: string
  justSelected: Element | null
  rubberBox: Element | null
  curBBoxes: any[]
  lastClickPoint: { x: number; y: number } | null
  events: Record<string, (...args: any[]) => any>
  rootSctm: SVGMatrix | null
  drawnPath: SVGPathElement | null
  freehand: { minx: number | null; miny: number | null; maxx: number | null; maxy: number | null }
  dAttr: string | null
  startX: number | null
  startY: number | null
  rStartX: number | null
  rStartY: number | null
  initBbox: Record<string, number>
  sumDistance: number
  controlPoint2: { x: number; y: number }
  controlPoint1: { x: number; y: number }
  start: { x: number; y: number }
  end: { x: number; y: number }
  bSpline: { x: number; y: number }
  nextPos: { x: number; y: number }
  idPrefix: string
  encodableImages: Record<string, string | false>
  curConfig: Record<string, any>
  lastGoodImgUrl: string
  svgdoc: HTMLDocument
  container: HTMLElement
  svgroot: SVGSVGElement
  svgContent: SVGSVGElement
  currentDrawing: InstanceType<typeof draw.Drawing>
  zoom: number
  currentGroup: Element | null
  curText: Record<string, any>
  curShape: Record<string, any>
  curProperties: Record<string, any>
  selectedElements: (Element | null)[]
  nsMap: Record<string, string>
  selectorManager: ReturnType<typeof getSelectorManager>
  pathActions: typeof pathModule.pathActions
  uiStrings: Record<string, string>
  opacAni: SVGAnimateElement
  linkControlPoints: typeof pathModule.pathActions.linkControlPoints
  curCommand: BatchCommand | null
  filter: Element | null
  filterHidden: boolean
  modeEvent: CustomEvent | null
  contentW: number
  contentH: number
  parameter?: any
  nextParameter?: any
  spaceKey: boolean
  canvas: ISvgCanvas

  // ── Instance fields: wired on by core/*.ts init() calls ────────────────

  // From core/elem-get-set (init wires these on)
  getBold: () => boolean
  setBold: (b: boolean) => void
  getItalic: () => boolean
  setItalic: (i: boolean) => void
  hasTextDecoration: (value: string) => boolean
  addTextDecoration: (value: string) => void
  removeTextDecoration: (value: string) => void
  setTextAnchor: (value: string) => void
  setLetterSpacing: (value: string) => void
  setWordSpacing: (value: string) => void
  setTextLength: (value: string) => void
  setLengthAdjust: (value: string) => void
  getFontFamily: () => string
  setFontFamily: (val: string) => void
  setFontColor: (val: string) => void
  getFontColor: () => string
  getFontSize: () => number
  setFontSize: (val: number) => void
  getText: () => string
  setTextContent: (val: string) => void
  setImageURL: (val: string) => void
  setLinkURL: (val: string) => void
  setRectRadius: (val: string | number) => void
  makeHyperlink: (url: string) => void
  removeHyperlink: () => void
  setSegType: (newType: number) => void
  setStrokeWidth: (val: number) => void
  getTitle: (elem?: Element) => string | undefined
  setGroupTitle: (val: string) => void
  setStrokeAttr: (attr: string, val: string | number) => void
  setBackground: (color: string, url: string) => void
  setDocumentTitle: (newTitle: string) => void
  getEditorNS: (add?: boolean) => string
  setBBoxZoom: (val: unknown, editorW: number, editorH: number) => { zoom: number; bbox: unknown } | undefined
  setCurrentZoom: (zoomLevel: number) => void
  setColor: (type: string, val: string, preventUndo?: boolean) => void
  setGradient: (type: string) => void
  setPaint: (type: string, paint: any) => void
  getResolution: () => { w: number; h: number; zoom: number }
  setResolution: (x: number | 'fit', y: number) => boolean

  // From core/event (init wires these on)
  mouseDownEvent: (evt: MouseEvent) => void
  mouseMoveEvent: (evt: MouseEvent) => void
  dblClickEvent: (evt: MouseEvent) => void
  mouseUpEvent: (evt: MouseEvent) => void
  mouseOutEvent: (evt: MouseEvent) => void
  DOMMouseScrollEvent: (e: WheelEvent) => void
  dragStartTransforms?: Map<Element, string>
  hasDragStartTransform?: boolean
  addedNew?: boolean

  // From core/path (init wires these on)
  replacePathSeg: (type: number, index: number, pts: number[], elem?: SVGPathElement | SVGElement | null) => void
  addPointGrip: (index: number, x?: number, y?: number) => SVGCircleElement
  removePath_: (id: string) => void
  getPath_: (elem: SVGPathElement) => any
  addCtrlGrip: (id: string) => SVGCircleElement
  getCtrlLine: (id: string) => SVGLineElement
  getGripPt: (seg: any, altPt?: { x: number; y: number } | null) => { x: number; y: number }
  getPointFromGrip: (pt: { x: number; y: number }, pth: any) => { x: number; y: number }
  setLinkControlPoints: (lcp: boolean) => void
  reorientGrads: (elem: Element, m: SVGMatrix) => void
  recalcRotatedPath: () => void
  getSegData: () => Record<number, string[]>
  getPathObj: () => any
  setPathObj: (obj: any) => void
  getPathFuncs: () => (string | number)[]
  getLinkControlPts: () => boolean

  // From core/selected-elem (init wires these on)
  pushGroupProperties: (g: Element, undoable: boolean) => any
  flipSelectedElements: (scaleX: number, scaleY: number) => void
  alignSelectedElements: (type: string, relativeTo: string) => void
  updateCanvas: (w: number, h: number) => { x: number; y: number; old_x: number; old_y: number; d_x: number; d_y: number }
  cycleElement: (next: boolean | number) => void
  cloneSelectedElements: (x: number, y: number) => void
  copySelectedElements: () => void
  groupSelectedElements: (type?: string, urlArg?: string) => void
  ungroupSelectedElement: () => void
  moveToTopSelectedElement: () => void
  moveToBottomSelectedElement: () => void
  moveUpDownSelected: (dir: 'Up' | 'Down') => void
  moveSelectedElements: (dx: number | number[], dy: number | number[], undoable?: boolean) => any
  deleteSelectedElements: () => void

  // From core/selection (init wires these on)
  clearSelection: (noCall?: boolean) => void
  getMouseTarget: (evt: MouseEvent | null) => Element | null
  addToSelection: (elemsToAdd: Element[], showGrips?: boolean) => void
  getIntersectionList: (rect?: { x: number; y: number; width: number; height: number }) => Element[] | null
  runExtensions: (opts: { action: string; vars?: unknown }) => unknown[]
  groupSvgElem: (elem: Element) => void
  prepareSvg: (newDoc: XMLDocument) => void
  recalculateAllSelectedDimensions: () => void
  setRotationAngle: (val: string | number, preventUndo?: boolean) => void

  // From core/undo (init wires these on)
  undoMgr: UndoManager

  // From core/svg-exec (init wires these on)
  importSvgString: (xmlString: string, preserveDimension?: boolean) => Element | null
  uniquifyElems: (g: Element) => void
  setUseData: (parent: Element) => void
  convertGradients: (elem: Element) => void
  removeUnusedDefElems: () => number
  svgCanvasToString: () => string
  svgToString: (elem: Element, indent: number) => string
  rasterExport: (imgType?: string, quality?: number, windowName?: string, opts?: Record<string, unknown>) => Promise<Record<string, unknown>>
  exportPDF: (windowName?: string, outputType?: string) => Promise<Record<string, unknown>>
  setSvgString: (xmlString: string, preventUndo?: boolean) => boolean
  embedImage: (src: string) => Promise<string | false>

  // ── Instance fields: set in initializeSvgCanvasMethods() ───────────────
  getJsonFromSvgElements: typeof getJsonFromSvgElements
  addSVGElementsFromJson: typeof addSVGElementsFromJson
  clearSvgContentElement: typeof clearSvgContentElementInit
  textActions: typeof textActionsMethod
  getStrokedBBox: typeof getStrokedBBoxDefaultVisible
  getVisibleElements: typeof getVisibleElements
  stringToHTML: typeof stringToHTML
  insertChildAtIndex: typeof insertChildAtIndex
  getClosest: typeof getClosest
  getParents: typeof getParents
  isLayer: typeof draw.Layer.isLayer
  matrixMultiply: typeof matrixMultiply
  hasMatrixTransform: typeof hasMatrixTransform
  transformListToTransform: typeof transformListToTransform
  convertToNum: typeof convertToNum
  convertUnit: typeof convertUnit
  findDefs: typeof findDefs
  getUrlFromAttr: typeof getUrlFromAttr
  getHref: typeof getHref
  setHref: typeof setHref
  getBBox: typeof utilsGetBBox
  getRotationAngle: typeof getRotationAngle
  getElement: typeof getElement
  getRefElem: typeof getRefElem
  assignAttributes: typeof assignAttributes
  cleanupElement: typeof cleanupElement
  remapElement: typeof remapElement
  recalculateDimensions: typeof recalculateDimensions
  sanitizeSvg: typeof sanitizeSvg
  pasteElements: typeof pasteElementsMethod
  identifyLayers: typeof draw.identifyLayers
  createLayer: typeof draw.createLayer
  cloneLayer: typeof draw.cloneLayer
  deleteCurrentLayer: typeof draw.deleteCurrentLayer
  setCurrentLayer: typeof draw.setCurrentLayer
  renameCurrentLayer: typeof draw.renameCurrentLayer
  setCurrentLayerPosition: typeof draw.setCurrentLayerPosition
  indexCurrentLayer: typeof draw.indexCurrentLayer
  setLayerVisibility: typeof draw.setLayerVisibility
  moveSelectedToLayer: typeof draw.moveSelectedToLayer
  mergeLayer: typeof draw.mergeLayer
  mergeAllLayers: typeof draw.mergeAllLayers
  leaveContext: typeof draw.leaveContext
  setContext: typeof draw.setContext
  changeSelectedAttributeNoUndo: typeof changeSelectedAttributeNoUndoMethod
  changeSelectedAttribute: typeof changeSelectedAttributeMethod
  setBlurNoUndo: typeof setBlurNoUndo
  setBlurOffsets: typeof setBlurOffsets
  setBlur: typeof setBlur
  smoothControlPoints: typeof pathModule.smoothControlPoints
  getTypeMap: typeof getTypeMap
  history: typeof history
  NS: typeof NS
  $id: typeof $id
  $qq: typeof $qq
  $qa: typeof $qa
  $click: typeof $click
  encode64: typeof encode64
  decode64: typeof decode64
  mergeDeep: typeof mergeDeep

  // ── Methods ─────────────────────────────────────────────────────────────
  getSvgOption (): { round_digits: number; apply?: boolean; images?: string }
  setSvgOption (key: string, value: any): void
  getSelectedElements (): (Element | null)[]
  setSelectedElements (key: number, value: Element | null): void
  setEmptySelectedElements (): void
  getSvgRoot (): SVGSVGElement
  getDOMDocument (): HTMLDocument
  getDOMContainer (): HTMLElement
  getCurConfig (): Record<string, any>
  setIdPrefix (p: string): void
  getCurrentDrawing (): InstanceType<typeof draw.Drawing>
  getCurShape (): Record<string, any>
  getCurrentGroup (): Element | null
  getBaseUnit (): string
  getHeight (): number
  getWidth (): number
  getRoundDigits (): number
  getSnappingStep (): number | string
  getGridSnapping (): boolean
  getStartTransform (): string | null
  setStartTransform (transform: string | null): void
  getZoom (): number
  round (val: number): number
  createSVGElement (jsonMap: SVGElementJSON): Element
  getContainer (): HTMLElement
  setStarted (s: boolean): void
  getRubberBox (): Element | null
  setRubberBox (rb: Element | null): Element | null
  addPtsToSelection (opts: { closedSubpath: boolean; grips: Element[] }): void
  endChanges (changes: { cmd: any; elem: Element }): void
  getCurrentMode (): string
  setCurrentMode (cm: string): string
  getDrawnPath (): SVGPathElement | null
  setDrawnPath (dp: SVGPathElement | null): SVGPathElement | null
  setCurrentGroup (cg: Element | null): void
  changeSvgContent (): void
  getStarted (): boolean
  getCanvas (): this
  getRootSctm (): SVGMatrix | null
  getStartX (): number | null
  setStartX (value: number | null): void
  getStartY (): number | null
  setStartY (value: number | null): void
  getRStartX (): number | null
  getRStartY (): number | null
  getInitBbox (): Record<string, number>
  getCurrentResizeMode (): string
  getJustSelected (): Element | null
  getOpacAni (): SVGAnimateElement
  getParameter (): any
  getNextParameter (): any
  getStepCount (): number
  getThreSholdDist (): number
  getSumDistance (): number
  getStart (key: string): number
  getEnd (key: string): number
  getBSpline (key: string): number
  getNextPos (key: string): number
  getControlPoint1 (key: string): number
  getControlPoint2 (key: string): number
  getFreehand (key: string): number | null
  getDrawing (): InstanceType<typeof draw.Drawing>
  getDAttr (): string | null
  getLastGoodImgUrl (): string
  getCurText (key: string): any
  setDAttr (value: string | null): void
  setEnd (key: string, value: number): void
  setControlPoint1 (key: string, value: number): void
  setControlPoint2 (key: string, value: number): void
  setJustSelected (value: Element | null): void
  setParameter (value: any): void
  setStart (value: { x: number; y: number }): void
  setRStartX (value: number | null): void
  setRStartY (value: number | null): void
  setSumDistance (value: number): void
  setBSpline (value: { x: number; y: number }): void
  setNextPos (value: { x: number; y: number }): void
  setNextParameter (value: any): void
  setCurText (key: string, value: any): void
  setFreehand (key: string, value: number | null): void
  setCurBBoxes (value: any[]): void
  getCurBBoxes (): any[]
  setInitBbox (value: Record<string, number>): void
  setRootSctm (value: SVGMatrix | null): void
  setCurrentResizeMode (value: string): void
  getLastClickPoint (key: string): number
  setLastClickPoint (value: { x: number; y: number } | null): void
  getId (elem?: Element): string
  getElem (id: string): Element | null
  getUIStrings (): Record<string, string>
  getNsMap (): Record<string, string>
  getSvgOptionApply (): boolean | undefined
  getSvgOptionImages (): string | undefined
  getEncodableImages (key: string): string | false | undefined
  setEncodableImages (key: string, value: string | false): void
  getVisElems (): string
  getIdPrefix (): string
  getDataStorage (): typeof dataStorage
  setZoom (value: number): void
  getImportIds (key: string): any
  setImportIds (key: string, value: any): void
  setRemovedElements (key: string, value: Element): void
  setSvgContent (value: SVGSVGElement): void
  getRefAttrs (): string[]
  setCanvas (key: string, value: any): void
  setCurProperties (key: string, value: any): void
  getCurProperties (key: string): any
  setCurShape (key: string, value: any): void
  getSelectorManager (): ReturnType<typeof getSelectorManager>
  getContentW (): number
  getContentH (): number
  getClipboardID (): string
  getSvgContent (): SVGSVGElement
  getExtensions (): Record<string, any>
  getSelector (): typeof Selector
  getMode (): string
  getNextId (): string
  getCurCommand (): BatchCommand | null
  setCurCommand (value: BatchCommand | null): void
  getFilter (): Element | null
  setFilter (value: Element | null): void
  getFilterHidden (): boolean
  setFilterHidden (value: boolean): void
  setMode (name: string): void
  clear (): void
  addExtension (name: string, extInitFunc: (...args: any[]) => any, opts: { importLocale: any }): Promise<any>
  addCommandToHistory (cmd: any): void
  restoreRefElements (elem: Element): void
  call (ev: string, arg?: any): any
  bind (ev: string, f: (...args: any[]) => any): ((...args: any[]) => any) | undefined
  flashStorage (): void
  selectOnly (elems: Element[], showGrips?: boolean): void
  removeFromSelection (elemsToRemove: Element[]): void
  selectAllInCurrentLayer (): void
  getOpacity (): number
  getSnapToGrid (): boolean
  getVersion (): string
  setUiStrings (strs: any): void
  setConfig (opts: Record<string, any>): void
  getDocumentTitle (): string | undefined
  getOffset (): { x: number; y: number }
  getColor (type: string): any
  setStrokePaint (paint: any): void
  setFillPaint (paint: any): void
  getStrokeWidth (): number | string
  getStyle (): Record<string, any>
  setOpacity (val: string): void
  getFillOpacity (): number
  getStrokeOpacity (): string
  setPaintOpacity (type: string, val: number, preventUndo?: boolean): void
  getPaintOpacity (type: 'fill' | 'stroke'): number
  getBlur (elem: Element | null): string | number
  setGoodImage (val: string): void
  getSvgString (): string
  randomizeIds (enableRandomization?: boolean): void
  convertToPath (elem?: Element | null, getBBox?: boolean): any
  cutSelectedElements (): void
  initializeSvgCanvasMethods (): void
  modeChangeEvent (): void
}
