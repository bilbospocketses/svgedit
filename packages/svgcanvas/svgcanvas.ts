/**
 * Numerous tools for working with the editor's "canvas".
 * @module svgcanvas
 *
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria, 2010 Pavol Rusnak, 2010 Jeff Schiller, 2021 OptimistikSAS
 *
 */

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/unbound-method */

// SVG 2 getPathData/setPathData polyfill. Not yet natively supported in shipping
// browsers as of this writing -- the polyfill installs on SVGPathElement.prototype
// before any other import touches path elements. Enables the PathDataListShim in
// core/path-method.js to install pathSegList delegation, which core/path-actions.js
// relies on.
import 'path-data-polyfill'
import Paint from './core/paint.js'
import * as pathModule from './core/path.js'
import * as history from './core/history.js'
import * as draw from './core/draw.js'
import { init as pasteInit, pasteElementsMethod } from './core/paste-elem.js'
import { init as touchInit } from './core/touch.js'
import { svgRootElement } from './core/svgroot.js'
import {
  init as undoInit,
  changeSelectedAttributeNoUndoMethod,
  changeSelectedAttributeMethod
} from './core/undo.js'
import { init as selectionInit } from './core/selection.js'
import { init as textActionsInit, textActionsMethod } from './core/text-actions.js'
import { init as eventInit } from './core/event.js'
import {
  init as jsonInit,
  getJsonFromSvgElements,
  addSVGElementsFromJson
} from './core/json.js'
import * as elemGetSet from './core/elem-get-set.js'
import { init as selectedElemInit } from './core/selected-elem.js'
import {
  init as blurInit,
  setBlurNoUndo,
  setBlurOffsets,
  setBlur
} from './core/blur-event.js'
import { sanitizeSvg } from './core/sanitize.js'
import { getReverseNS, NS } from './core/namespaces.js'
import {
  assignAttributes,
  cleanupElement,
  getElement,
  getUrlFromAttr,
  findDefs,
  getHref,
  setHref,
  getRefElem,
  getRotationAngle,
  getBBoxOfElementAsPath,
  convertToPath as utilitiesConvertToPath,
  encode64,
  decode64,
  getVisibleElements,
  init as utilsInit,
  getBBox as utilsGetBBox,
  getStrokedBBoxDefaultVisible,
  blankPageObjectURL,
  $id,
  $qa,
  $qq,
  $click,
  getFeGaussianBlur,
  stringToHTML,
  insertChildAtIndex
} from './core/utilities.js'
import {
  matrixMultiply,
  hasMatrixTransform,
  transformListToTransform
} from './core/math.js'
import { convertToNum, init as unitsInit, getTypeMap, isValidUnit, convertUnit } from './core/units.js'
import { init as svgInit } from './core/svg-exec.js'
import { remapElement, init as coordsInit } from './core/coords.js'
import {
  recalculateDimensions,
  init as recalculateInit
} from './core/recalculate.js'
import { getSelectorManager, Selector, init as selectInit } from './core/select.js'
import { clearSvgContentElementInit, init as clearInit } from './core/clear.js'
import {
  getClosest,
  getParents,
  mergeDeep
} from './common/util.js'

import dataStorage from './core/dataStorage.js'

const visElems =
  'a,circle,ellipse,foreignObject,g,image,line,path,polygon,polyline,rect,svg,text,tspan,use'
const refAttrs = [
  'clip-path',
  'fill',
  'filter',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke'
]

const THRESHOLD_DIST = 0.8
const STEP_COUNT = 10
const CLIPBOARD_ID = 'svgedit_clipboard'

/**
 * The main SvgCanvas class that manages all SVG-related functions.
 * @memberof module:svgcanvas
 *
 */
class SvgCanvas {
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
  idprefix: string
  encodableImages: Record<string, string | false>
  curConfig: Record<string, any>
  lastGoodImgUrl: string
  svgdoc: HTMLDocument
  container: HTMLElement
  svgroot: SVGSVGElement
  svgContent: SVGSVGElement
  current_drawing_: InstanceType<typeof draw.Drawing>
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
  curCommand: any
  filter: any
  filterHidden: boolean
  modeEvent: CustomEvent | null
  contentW: number
  contentH: number
  // parameter / nextParameter are set dynamically by event handlers
  parameter?: any
  nextParameter?: any

  // ── Instance fields: wired on by core/*.ts init() calls ──────────────────
  // These are augmented via svgcanvas.augment.d.ts for external consumers.
  // Declared here with `declare` so the class body can reference them without
  // TS2339 (property does not exist) errors inside this file.
  declare clearSelection: (noCall?: boolean) => void
  declare addToSelection: (elemsToAdd: Element[], showGrips?: boolean) => void
  declare undoMgr: import('./core/history.js').UndoManager
  declare getResolution: () => { w: number; h: number; zoom: number }
  declare mouseDownEvent: (evt: MouseEvent) => void
  declare mouseMoveEvent: (evt: MouseEvent) => void
  declare dblClickEvent: (evt: MouseEvent) => void
  declare mouseUpEvent: (evt: MouseEvent) => void
  declare mouseOutEvent: (evt: MouseEvent) => void
  declare DOMMouseScrollEvent: (e: WheelEvent) => void
  declare getTitle: (...args: unknown[]) => unknown
  declare setPaint: (...args: unknown[]) => unknown
  declare svgCanvasToString: () => string
  declare copySelectedElements: () => void
  declare deleteSelectedElements: () => void

  // ── Instance fields: set in initializeSvgCanvasMethods() ───────────────
  // `declare` tells TS "these are definitely assigned (via initializeSvgCanvasMethods)
  // but not in a field initializer — suppress TS2564".
  declare getJsonFromSvgElements: typeof getJsonFromSvgElements
  declare addSVGElementsFromJson: typeof addSVGElementsFromJson
  declare clearSvgContentElement: typeof clearSvgContentElementInit
  declare textActions: typeof textActionsMethod
  declare getStrokedBBox: typeof getStrokedBBoxDefaultVisible
  declare getVisibleElements: typeof getVisibleElements
  declare stringToHTML: typeof stringToHTML
  declare insertChildAtIndex: typeof insertChildAtIndex
  declare getClosest: typeof getClosest
  declare getParents: typeof getParents
  declare isLayer: typeof draw.Layer.isLayer
  declare matrixMultiply: typeof matrixMultiply
  declare hasMatrixTransform: typeof hasMatrixTransform
  declare transformListToTransform: typeof transformListToTransform
  declare convertToNum: typeof convertToNum
  declare convertUnit: typeof convertUnit
  declare findDefs: typeof findDefs
  declare getUrlFromAttr: typeof getUrlFromAttr
  declare getHref: typeof getHref
  declare setHref: typeof setHref
  declare getBBox: typeof utilsGetBBox
  declare getRotationAngle: typeof getRotationAngle
  declare getElement: typeof getElement
  declare getRefElem: typeof getRefElem
  declare assignAttributes: typeof assignAttributes
  declare cleanupElement: typeof cleanupElement
  declare remapElement: typeof remapElement
  declare recalculateDimensions: typeof recalculateDimensions
  declare sanitizeSvg: typeof sanitizeSvg
  declare pasteElements: typeof pasteElementsMethod
  declare identifyLayers: typeof draw.identifyLayers
  declare createLayer: typeof draw.createLayer
  declare cloneLayer: typeof draw.cloneLayer
  declare deleteCurrentLayer: typeof draw.deleteCurrentLayer
  declare setCurrentLayer: typeof draw.setCurrentLayer
  declare renameCurrentLayer: typeof draw.renameCurrentLayer
  declare setCurrentLayerPosition: typeof draw.setCurrentLayerPosition
  declare indexCurrentLayer: typeof draw.indexCurrentLayer
  declare setLayerVisibility: typeof draw.setLayerVisibility
  declare moveSelectedToLayer: typeof draw.moveSelectedToLayer
  declare mergeLayer: typeof draw.mergeLayer
  declare mergeAllLayers: typeof draw.mergeAllLayers
  declare leaveContext: typeof draw.leaveContext
  declare setContext: typeof draw.setContext
  declare changeSelectedAttributeNoUndo: typeof changeSelectedAttributeNoUndoMethod
  declare changeSelectedAttribute: typeof changeSelectedAttributeMethod
  declare setBlurNoUndo: typeof setBlurNoUndo
  declare setBlurOffsets: typeof setBlurOffsets
  declare setBlur: typeof setBlur
  declare smoothControlPoints: typeof pathModule.smoothControlPoints
  declare getTypeMap: typeof getTypeMap
  declare history: typeof history
  declare NS: typeof NS
  declare $id: typeof $id
  declare $qq: typeof $qq
  declare $qa: typeof $qa
  declare $click: typeof $click
  declare encode64: typeof encode64
  declare decode64: typeof decode64
  declare mergeDeep: typeof mergeDeep

  // ── Static properties ───────────────────────────────────────────────────
  static $id: typeof $id
  static $qq: typeof $qq
  static $qa: typeof $qa
  static $click: typeof $click
  static encode64: typeof encode64
  static decode64: typeof decode64
  static mergeDeep: typeof mergeDeep
  static getClosest: typeof getClosest
  static getParents: typeof getParents
  static blankPageObjectURL: typeof blankPageObjectURL
  static Paint: typeof Paint
  static getTypeMap: typeof getTypeMap
  static convertToNum: typeof convertToNum
  static isValidUnit: typeof isValidUnit
  static convertUnit: typeof convertUnit

  /**
   * @param {HTMLElement} container - The container HTML element that should hold the SVG root element
   * @param {module:SVGeditor.configObj.curConfig} config - An object that contains configuration data
   */
  constructor (container: HTMLElement, config?: Record<string, any>) {
    // imported function made available as methods
    this.initializeSvgCanvasMethods()
    unitsInit(this)
    const { pathActions } = pathModule

    // initialize class variables
    this.saveOptions = { round_digits: 2 }
    this.importIds = {}
    this.extensions = {}
    this.removedElements = {}
    this.started = false
    this.startTransform = null
    this.currentMode = 'select'
    this.currentResizeMode = 'none'
    this.justSelected = null
    this.rubberBox = null
    this.curBBoxes = []
    this.lastClickPoint = null
    this.events = {}
    this.rootSctm = null
    this.drawnPath = null
    this.freehand = {
      minx: null,
      miny: null,
      maxx: null,
      maxy: null
    }
    this.dAttr = null
    this.startX = null
    this.startY = null
    this.rStartX = null
    this.rStartY = null
    this.initBbox = {}
    this.sumDistance = 0
    this.controlPoint2 = { x: 0, y: 0 }
    this.controlPoint1 = { x: 0, y: 0 }
    this.start = { x: 0, y: 0 }
    this.end = { x: 0, y: 0 }
    this.bSpline = { x: 0, y: 0 }
    this.nextPos = { x: 0, y: 0 }
    this.idprefix = 'svg_'
    this.encodableImages = {}

    this.curConfig = {
      show_outside_canvas: true,
      selectNew: true,
      dimensions: [640, 480]
    }
    if (config) {
      this.curConfig = SvgCanvas.mergeDeep(this.curConfig as Record<string, unknown>, config as Record<string, unknown>) as Record<string, any>
    }
    this.lastGoodImgUrl = `${this.curConfig.imgPath}/logo.svg`
    const { dimensions } = this.curConfig

    this.svgdoc = window.document
    this.container = container
    this.svgroot = svgRootElement(this.svgdoc, dimensions)
    container.append(this.svgroot)
    this.svgContent = this.svgdoc.createElementNS(NS.SVG, 'svg') as SVGSVGElement
    touchInit(this)
    clearInit(this)
    this.clearSvgContentElement()
    this.current_drawing_ = new draw.Drawing(this.svgContent, this.idprefix)
    this.zoom = 1

    this.currentGroup = null

    const allProperties: Record<string, Record<string, any>> = {
      shape: {
        fill:
          (this.curConfig.initFill.color === 'none' ? '' : '#') +
          this.curConfig.initFill.color,
        fill_paint: null,
        fill_opacity: this.curConfig.initFill.opacity,
        stroke:
          (this.curConfig.initStroke.color === 'none' ? '' : '#') +
          this.curConfig.initStroke.color,
        stroke_paint: null,
        stroke_opacity: this.curConfig.initStroke.opacity,
        stroke_width: this.curConfig.initStroke.width,
        stroke_dasharray: 'none',
        stroke_linejoin: 'miter',
        stroke_linecap: 'butt',
        opacity: this.curConfig.initOpacity
      }
    }
    allProperties.text = SvgCanvas.mergeDeep({}, allProperties.shape as Record<string, unknown>) as Record<string, any>
    allProperties.text = SvgCanvas.mergeDeep(allProperties.text as Record<string, unknown>, {
      fill: '#000000',
      stroke_width: this.curConfig.text?.stroke_width as unknown,
      font_size: this.curConfig.text?.font_size as unknown,
      font_family: this.curConfig.text?.font_family as unknown
    }) as Record<string, any>
    this.curText = allProperties.text ?? {}
    this.curShape = allProperties.shape ?? {}
    this.curProperties = this.curShape

    this.selectedElements = []

    jsonInit(this as any)
    utilsInit(this)
    coordsInit(this)
    recalculateInit(this)
    selectInit(this)
    undoInit(this)
    selectionInit(this)

    this.nsMap = getReverseNS()
    this.selectorManager = getSelectorManager()

    this.pathActions = pathActions
    pathModule.init(this)
    this.uiStrings = {}

    this.opacAni = document.createElementNS(NS.SVG, 'animate') as SVGAnimateElement
    this.opacAni.setAttribute('attributeName', 'opacity')
    this.opacAni.setAttribute('begin', 'indefinite')
    this.opacAni.setAttribute('dur', '1')
    this.opacAni.setAttribute('fill', 'freeze')
    this.svgroot.appendChild(this.opacAni)

    eventInit(this)
    textActionsInit(this)
    svgInit(this)
    draw.init(this)
    elemGetSet.init(this)

    const handleLinkInCanvas = (e: Event): false => {
      e.preventDefault()
      return false
    }
    container.addEventListener('mousedown', this.mouseDownEvent)
    container.addEventListener('mousemove', this.mouseMoveEvent)
    $click(container, handleLinkInCanvas)
    container.addEventListener('dblclick', this.dblClickEvent)
    container.addEventListener('mouseup', this.mouseUpEvent)
    container.addEventListener('mouseleave', this.mouseOutEvent)
    container.addEventListener('mousewheel', this.DOMMouseScrollEvent as EventListenerOrEventListenerObject)
    container.addEventListener('DOMMouseScroll', this.DOMMouseScrollEvent as EventListenerOrEventListenerObject)

    this.linkControlPoints = pathActions.linkControlPoints
    this.curCommand = null
    this.filter = null
    this.filterHidden = false
    this.modeEvent = null

    blurInit(this)
    selectedElemInit(this)

    const storageChange = (ev: StorageEvent): void => {
      if (!ev.newValue) return
      if (ev.key === `${CLIPBOARD_ID}_startup`) {
        localStorage.removeItem(`${CLIPBOARD_ID}_startup`)
        this.flashStorage()
      } else if (ev.key === CLIPBOARD_ID) {
        sessionStorage.setItem(CLIPBOARD_ID, ev.newValue)
      }
    }

    window.addEventListener('storage', storageChange, false)
    localStorage.setItem(`${CLIPBOARD_ID}_startup`, String(Math.random()))

    pasteInit(this)

    this.contentW = this.getResolution().w
    this.contentH = this.getResolution().h
    this.clear()

    this.modeChangeEvent()
  } // End constructor

  getSvgOption (): { round_digits: number; apply?: boolean; images?: string } {
    return this.saveOptions
  }

  setSvgOption (key: string, value: any): void {
    ;(this.saveOptions as Record<string, any>)[key] = value
  }

  getSelectedElements (): (Element | null)[] {
    return this.selectedElements
  }

  setSelectedElements (key: number, value: Element | null): void {
    this.selectedElements[key] = value
  }

  setEmptySelectedElements (): void {
    this.selectedElements = []
  }

  getSvgRoot (): SVGSVGElement {
    return this.svgroot
  }

  getDOMDocument (): HTMLDocument {
    return this.svgdoc
  }

  getDOMContainer (): HTMLElement {
    return this.container
  }

  getCurConfig (): Record<string, any> {
    return this.curConfig
  }

  setIdPrefix (p: string): void {
    this.idprefix = p
  }

  getCurrentDrawing (): InstanceType<typeof draw.Drawing> {
    return this.current_drawing_
  }

  getCurShape (): Record<string, any> {
    return this.curShape
  }

  getCurrentGroup (): Element | null {
    return this.currentGroup
  }

  getBaseUnit (): string {
    return this.curConfig.baseUnit
  }

  getHeight (): number {
    return Number(this.svgContent.getAttribute('height')) / this.zoom
  }

  getWidth (): number {
    return Number(this.svgContent.getAttribute('width')) / this.zoom
  }

  getRoundDigits (): number {
    return this.saveOptions.round_digits
  }

  getSnappingStep (): number | string {
    return this.curConfig.snappingStep
  }

  getGridSnapping (): boolean {
    return this.curConfig.gridSnapping
  }

  getStartTransform (): string | null {
    return this.startTransform
  }

  setStartTransform (transform: string | null): void {
    this.startTransform = transform
  }

  getZoom (): number {
    return this.zoom
  }

  round (val: number): number {
    return Number.parseInt(String(val * this.zoom)) / this.zoom
  }

  createSVGElement (jsonMap: any): Element {
    return this.addSVGElementsFromJson(jsonMap) as Element
  }

  getContainer (): HTMLElement {
    return this.container
  }

  setStarted (s: boolean): void {
    this.started = s
  }

  getRubberBox (): Element | null {
    return this.rubberBox
  }

  setRubberBox (rb: Element | null): Element | null {
    this.rubberBox = rb
    return this.rubberBox
  }

  addPtsToSelection ({ closedSubpath, grips }: { closedSubpath: boolean; grips: Element[] }): void {
    this.pathActions.canDeleteNodes = true
    this.pathActions.closed_subpath = closedSubpath
    this.call('pointsAdded', { closedSubpath, grips })
    this.call('selected', grips)
  }

  /**
   * @param {PlainObject} changes
   * @param {ChangeElementCommand} changes.cmd
   * @param {SVGPathElement} changes.elem
   * @fires module:svgcanvas.SvgCanvas#event:changed
   * @returns {void}
   */
  endChanges ({ cmd, elem }: { cmd: any; elem: Element }): void {
    this.addCommandToHistory(cmd)
    this.call('changed', [elem])
  }

  getCurrentMode (): string {
    return this.currentMode
  }

  setCurrentMode (cm: string): string {
    this.currentMode = cm
    return this.currentMode
  }

  getDrawnPath (): SVGPathElement | null {
    return this.drawnPath
  }

  setDrawnPath (dp: SVGPathElement | null): SVGPathElement | null {
    this.drawnPath = dp
    return this.drawnPath
  }

  setCurrentGroup (cg: Element | null): void {
    this.currentGroup = cg
  }

  changeSvgContent (): void {
    this.call('changed', [this.svgContent])
  }

  getStarted (): boolean {
    return this.started
  }

  getCanvas (): this {
    return this
  }

  getrootSctm (): SVGMatrix | null {
    return this.rootSctm
  }

  getStartX (): number | null {
    return this.startX
  }

  setStartX (value: number | null): void {
    this.startX = value
  }

  getStartY (): number | null {
    return this.startY
  }

  setStartY (value: number | null): void {
    this.startY = value
  }

  getRStartX (): number | null {
    return this.rStartX
  }

  getRStartY (): number | null {
    return this.rStartY
  }

  getInitBbox (): Record<string, number> {
    return this.initBbox
  }

  getCurrentResizeMode (): string {
    return this.currentResizeMode
  }

  getJustSelected (): Element | null {
    return this.justSelected
  }

  getOpacAni (): SVGAnimateElement {
    return this.opacAni
  }

  getParameter (): any {
    return this.parameter
  }

  getNextParameter (): any {
    return this.nextParameter
  }

  getStepCount (): number {
    return STEP_COUNT
  }

  getThreSholdDist (): number {
    return THRESHOLD_DIST
  }

  getSumDistance (): number {
    return this.sumDistance
  }

  getStart (key: string): number {
    return this.start[key as keyof typeof this.start]
  }

  getEnd (key: string): number {
    return this.end[key as keyof typeof this.end]
  }

  getbSpline (key: string): number {
    return this.bSpline[key as keyof typeof this.bSpline]
  }

  getNextPos (key: string): number {
    return this.nextPos[key as keyof typeof this.nextPos]
  }

  getControlPoint1 (key: string): number {
    return this.controlPoint1[key as keyof typeof this.controlPoint1]
  }

  getControlPoint2 (key: string): number {
    return this.controlPoint2[key as keyof typeof this.controlPoint2]
  }

  getFreehand (key: string): number | null {
    return this.freehand[key as keyof typeof this.freehand]
  }

  getDrawing (): InstanceType<typeof draw.Drawing> {
    return this.getCurrentDrawing()
  }

  getDAttr (): string | null {
    return this.dAttr
  }

  getLastGoodImgUrl (): string {
    return this.lastGoodImgUrl
  }

  getCurText (key: string): any {
    return this.curText[key]
  }

  setDAttr (value: string | null): void {
    this.dAttr = value
  }

  setEnd (key: string, value: number): void {
    this.end[key as keyof typeof this.end] = value
  }

  setControlPoint1 (key: string, value: number): void {
    this.controlPoint1[key as keyof typeof this.controlPoint1] = value
  }

  setControlPoint2 (key: string, value: number): void {
    this.controlPoint2[key as keyof typeof this.controlPoint2] = value
  }

  setJustSelected (value: Element | null): void {
    this.justSelected = value
  }

  setParameter (value: any): void {
    this.parameter = value
  }

  setStart (value: { x: number; y: number }): void {
    this.start = value
  }

  setRStartX (value: number | null): void {
    this.rStartX = value
  }

  setRStartY (value: number | null): void {
    this.rStartY = value
  }

  setSumDistance (value: number): void {
    this.sumDistance = value
  }

  setbSpline (value: { x: number; y: number }): void {
    this.bSpline = value
  }

  setNextPos (value: { x: number; y: number }): void {
    this.nextPos = value
  }

  setNextParameter (value: any): void {
    this.nextParameter = value
  }

  setCurText (key: string, value: any): void {
    this.curText[key] = value
  }

  setFreehand (key: string, value: number | null): void {
    this.freehand[key as keyof typeof this.freehand] = value
  }

  setCurBBoxes (value: any[]): void {
    this.curBBoxes = value
  }

  getCurBBoxes (): any[] {
    return this.curBBoxes
  }

  setInitBbox (value: Record<string, number>): void {
    this.initBbox = value
  }

  setRootSctm (value: SVGMatrix | null): void {
    this.rootSctm = value
  }

  setCurrentResizeMode (value: string): void {
    this.currentResizeMode = value
  }

  getLastClickPoint (key: string): number {
    return (this.lastClickPoint as any)[key]
  }

  setLastClickPoint (value: { x: number; y: number } | null): void {
    this.lastClickPoint = value
  }

  getId (): string {
    return this.getCurrentDrawing().getId()
  }

  getUIStrings (): Record<string, string> {
    return this.uiStrings
  }

  getNsMap (): Record<string, string> {
    return this.nsMap
  }

  getSvgOptionApply (): boolean | undefined {
    return this.saveOptions.apply
  }

  getSvgOptionImages (): string | undefined {
    return this.saveOptions.images
  }

  getEncodableImages (key: string): string | false | undefined {
    return this.encodableImages[key]
  }

  setEncodableImages (key: string, value: string | false): void {
    this.encodableImages[key] = value
  }

  getVisElems (): string {
    return visElems
  }

  getIdPrefix (): string {
    return this.idprefix
  }

  getDataStorage (): typeof dataStorage {
    return dataStorage
  }

  setZoom (value: number): void {
    this.zoom = value
  }

  getImportIds (key: string): any {
    return this.importIds[key]
  }

  setImportIds (key: string, value: any): void {
    this.importIds[key] = value
  }

  setRemovedElements (key: string, value: Element): void {
    this.removedElements[key] = value
  }

  setSvgContent (value: SVGSVGElement): void {
    this.svgContent = value
  }

  getrefAttrs (): string[] {
    return refAttrs
  }

  setCanvas (key: string, value: any): void {
    (this as any)[key] = value
  }

  setCurProperties (key: string, value: any): void {
    this.curProperties[key] = value
  }

  getCurProperties (key: string): any {
    return this.curProperties[key]
  }

  setCurShape (key: string, value: any): void {
    this.curShape[key] = value
  }

  gettingSelectorManager (): ReturnType<typeof getSelectorManager> {
    return this.selectorManager
  }

  getContentW (): number {
    return this.contentW
  }

  getContentH (): number {
    return this.contentH
  }

  getClipboardID (): string {
    return CLIPBOARD_ID
  }

  getSvgContent (): SVGSVGElement {
    return this.svgContent
  }

  getExtensions (): Record<string, any> {
    return this.extensions
  }

  getSelector (): typeof Selector {
    return Selector
  }

  getMode (): string {
    return this.currentMode
  }

  getNextId (): string {
    return this.getCurrentDrawing().getNextId()
  }

  getCurCommand (): any {
    return this.curCommand
  }

  setCurCommand (value: any): void {
    this.curCommand = value
  }

  getFilter (): any {
    return this.filter
  }

  setFilter (value: any): void {
    this.filter = value
  }

  getFilterHidden (): boolean {
    return this.filterHidden
  }

  setFilterHidden (value: boolean): void {
    this.filterHidden = value
  }

  /**
   * Sets the editor's mode to the given string.
   * @function module:svgcanvas.SvgCanvas#setMode
   * @param {string} name - String with the new mode to change to
   * @returns {void}
   */
  setMode (name: string): void {
    this.pathActions.clear(true)
    this.textActions.clear()
    this.curProperties =
      (this.selectedElements[0] as Element | undefined)?.nodeName === 'text'
        ? this.curText
        : this.curShape
    this.currentMode = name

    if (this.modeEvent) {
      document.dispatchEvent(this.modeEvent)
    }
  }

  /**
   * Clears the current document. This is not an undoable action.
   * @function module:svgcanvas.SvgCanvas#clear
   * @fires module:svgcanvas.SvgCanvas#event:beforeClear|afterClear
   * @returns {void}
   */
  clear (): void {
    this.call('beforeClear')
    this.pathActions.clear()
    this.clearSelection()
    this.clearSvgContentElement()
    this.current_drawing_ = new draw.Drawing(this.svgContent)
    this.createLayer(undefined as unknown as string)
    this.undoMgr.resetUndoStack()
    this.selectorManager.initGroup()
    this.rubberBox = this.selectorManager.getRubberBandBox()
    this.call('afterClear')
  }

  async addExtension (name: string, extInitFunc: (...args: any[]) => any, { importLocale }: { importLocale: any }): Promise<any> {
    if (typeof extInitFunc !== 'function') {
      throw new TypeError(
        'Function argument expected for `svgcanvas.addExtension`'
      )
    }
    if (name in this.extensions) {
      throw new Error(
        'Cannot add extension "' +
          name +
          '", an extension by that name already exists.'
      )
    }
    const argObj = {
      importLocale,
      svgroot: this.svgroot,
      svgContent: this.svgContent,
      nonce: this.getCurrentDrawing().getNonce(),
      selectorManager: this.selectorManager
    }
    const extObj = await extInitFunc(argObj)
    if (extObj) {
      extObj.name = name
    }
    this.extensions[name] = extObj
    return this.call('extension_added', extObj)
  }

  addCommandToHistory (cmd: any): void {
    this.undoMgr.addCommandToHistory(cmd)
  }

  restoreRefElements (elem: Element): void {
    const attrs: Record<string, string | null> = {}
    refAttrs.forEach((item, _) => {
      attrs[item] = elem.getAttribute(item)
    })
    Object.values(attrs).forEach(val => {
      if (val?.startsWith('url(')) {
        const urlRef = getUrlFromAttr(val)
        if (!urlRef) return
        const id = urlRef.slice(1)
        const ref = getElement(id)
        if (!ref) {
          findDefs().append(this.removedElements[id] as Node)
          delete this.removedElements[id]
        }
      }
    })
    const childs = elem.getElementsByTagName('*')

    if (childs.length) {
      for (let i = 0, l = childs.length; i < l; i++) {
        this.restoreRefElements(childs[i] as Element)
      }
    }
  }

  call (ev: string, arg?: any): any {
    if (this.events[ev]) {
      return this.events[ev](window, arg)
    }
    return undefined
  }

  /**
   * Attaches a callback function to an event.
   * @function module:svgcanvas.SvgCanvas#bind
   * @param  {string} ev - String indicating the name of the event
   * @param {module:svgcanvas.EventHandler} f - The callback function to bind to the event
   * @returns {module:svgcanvas.EventHandler} The previous event
   */
  bind (ev: string, f: (...args: any[]) => any): ((...args: any[]) => any) | undefined {
    const old = this.events[ev]
    this.events[ev] = f
    return old
  }

  /**
   * Flash the clipboard data momentarily on localStorage so all tabs can see.
   * @returns {void}
   */
  flashStorage (): void {
    const data = sessionStorage.getItem(CLIPBOARD_ID)
    localStorage.setItem(CLIPBOARD_ID, data ?? '' )
    setTimeout(() => {
      localStorage.removeItem(CLIPBOARD_ID)
    }, 1)
  }

  /**
   * Selects only the given elements, shortcut for `clearSelection(); addToSelection()`.
   * @function module:svgcanvas.SvgCanvas#selectOnly
   * @param {Element[]} elems - an array of DOM elements to be selected
   * @param {boolean} showGrips - Indicates whether the resize grips should be shown
   * @returns {void}
   */
  selectOnly (elems: Element[], showGrips?: boolean): void {
    this.clearSelection(true)
    this.addToSelection(elems, showGrips)
  }

  /**
   * Removes elements from the selection.
   * @function module:svgcanvas.SvgCanvas#removeFromSelection
   * @param {Element[]} elemsToRemove - An array of elements to remove from selection
   * @returns {void}
   */
  removeFromSelection (elemsToRemove: Element[]): void {
    if (!this.selectedElements[0]) {
      return
    }
    if (!elemsToRemove.length) {
      return
    }

    const newSelectedItems: (Element | null)[] = []
    const len = this.selectedElements.length
    for (let i = 0; i < len; ++i) {
      const elem = this.selectedElements[i]
      if (elem) {
        if (!elemsToRemove.includes(elem)) {
          newSelectedItems.push(elem)
        } else {
          this.selectorManager.releaseSelector(elem)
        }
      }
    }
    this.selectedElements = newSelectedItems
  }

  /**
   * Clears the selection, then adds all elements in the current layer to the selection.
   * @function module:svgcanvas.SvgCanvas#selectAllInCurrentLayer
   * @returns {void}
   */
  selectAllInCurrentLayer (): void {
    const currentLayer = this.getCurrentDrawing().getCurrentLayer()
    if (currentLayer) {
      this.currentMode = 'select'
      if (this.currentGroup) {
        this.selectOnly([...currentLayer.children] as Element[])
      } else {
        this.selectOnly([...currentLayer.children] as Element[])
      }
    }
  }

  getOpacity (): number {
    return this.curShape.opacity
  }

  /**
   * @function module:svgcanvas.SvgCanvas#getSnapToGrid
   * @returns {boolean} The current snap to grid setting
   */
  getSnapToGrid (): boolean {
    return this.curConfig.gridSnapping
  }

  /**
   * @function module:svgcanvas.SvgCanvas#getVersion
   * @returns {string} A string which describes the revision number of SvgCanvas.
   */
  getVersion (): string {
    return 'svgcanvas.js ($Rev$)'
  }

  /**
   * Update interface strings with given values.
   * @function module:svgcanvas.SvgCanvas#setUiStrings
   * @param {module:path.uiStrings} strs - Object with strings
   * @returns {void}
   */
  setUiStrings (strs: any): void {
    Object.assign(this.uiStrings, (strs as { notification?: Record<string, string> }).notification)
    pathModule.setUiStrings(strs as { ui: Record<string, string> })
  }

  /**
   * Update configuration options with given values.
   * @function module:svgcanvas.SvgCanvas#setConfig
   * @param {module:SVGEditor.Config} opts - Object with options
   * @returns {void}
   */
  setConfig (opts: Record<string, any>): void {
    Object.assign(this.curConfig, opts)
  }

  /**
   * @function module:svgcanvas.SvgCanvas#getDocumentTitle
   * @returns {string|void} The current document title or an empty string if not found
   */
  getDocumentTitle (): string | undefined {
    return this.getTitle(this.svgContent) as string | undefined
  }

  getOffset (): { x: number; y: number } {
    return {
      x: Number(this.svgContent.getAttribute('x')),
      y: Number(this.svgContent.getAttribute('y'))
    }
  }

  getColor (type: string): any {
    return this.curProperties[type]
  }

  setStrokePaint (paint: any): void {
    this.setPaint('stroke', paint)
  }

  /**
   * @function module:svgcanvas.SvgCanvas#setFillPaint
   * @param {module:jGraduate~Paint} paint
   * @returns {void}
   */
  setFillPaint (paint: any): void {
    this.setPaint('fill', paint)
  }

  /**
   * @function module:svgcanvas.SvgCanvas#getStrokeWidth
   * @returns {Float|string} The current stroke-width value
   */
  getStrokeWidth (): number | string {
    return this.curProperties.stroke_width
  }

  /**
   * @function module:svgcanvas.SvgCanvas#getStyle
   * @returns {module:svgcanvas.StyleOptions} current style options
   */
  getStyle (): Record<string, any> {
    return this.curShape
  }

  /**
   * Sets the given opacity on the current selected elements.
   * @function module:svgcanvas.SvgCanvas#setOpacity
   * @param {string} val
   * @returns {void}
   */
  setOpacity (val: string): void {
    this.curShape.opacity = val
    this.changeSelectedAttribute('opacity', val)
  }

  /**
   * @function module:svgcanvas.SvgCanvas#getFillOpacity
   * @returns {Float} the current fill opacity
   */
  getFillOpacity (): number {
    return this.curShape.fill_opacity
  }

  /**
   * @function module:svgcanvas.SvgCanvas#getStrokeOpacity
   * @returns {string} the current stroke opacity
   */
  getStrokeOpacity (): string {
    return this.curShape.stroke_opacity
  }

  /**
   * Sets the current fill/stroke opacity.
   * @function module:svgcanvas.SvgCanvas#setPaintOpacity
   * @param {string} type - String with "fill" or "stroke"
   * @param {Float} val - Float with the new opacity value
   * @param {boolean} preventUndo - Indicates whether or not this should be an undoable action
   * @returns {void}
   */
  setPaintOpacity (type: string, val: number, preventUndo?: boolean): void {
    this.curShape[`${type}_opacity`] = val
    if (!preventUndo) {
      this.changeSelectedAttribute(`${type}-opacity`, val)
    } else {
      this.changeSelectedAttributeNoUndo(`${type}-opacity`, val, this.selectedElements as Element[])
    }
  }

  /**
   * Gets the current fill/stroke opacity.
   * @function module:svgcanvas.SvgCanvas#getPaintOpacity
   * @param {"fill"|"stroke"} type - String with "fill" or "stroke"
   * @returns {Float} Fill/stroke opacity
   */
  getPaintOpacity (type: 'fill' | 'stroke'): number {
    return type === 'fill' ? this.getFillOpacity() : this.getStrokeOpacity() as unknown as number
  }

  /**
   * Gets the `stdDeviation` blur value of the given element.
   * @function module:svgcanvas.SvgCanvas#getBlur
   * @param {Element} elem - The element to check the blur value for
   * @returns {string|number} stdDeviation blur attribute value
   */
  getBlur (elem: Element | null): string | number {
    let val: string | number = 0
    if (elem) {
      const filterUrl = elem.getAttribute('filter')
      if (filterUrl) {
        const blur = getElement(`${(elem as HTMLElement).id}_blur`)
        if (blur) {
          val = blur.firstChild ? (blur.firstChild as Element).getAttribute('stdDeviation') ?? 0 : 0
        } else {
          const filterElem = getRefElem(filterUrl)
          const blurElem = getFeGaussianBlur(filterElem)
          if (blurElem !== null) {
            val = blurElem.getAttribute('stdDeviation') ?? 0
          }
        }
      }
    }
    return val
  }

  /**
   * Sets a given URL to be a "last good image" URL.
   * @function module:svgcanvas.SvgCanvas#setGoodImage
   * @param {string} val
   * @returns {void}
   */
  setGoodImage (val: string): void {
    this.lastGoodImgUrl = val
  }

  /**
   * Returns the current drawing as raw SVG XML text.
   * @function module:svgcanvas.SvgCanvas#getSvgString
   * @returns {string} The current drawing as raw SVG XML text.
   */
  getSvgString (): string {
    this.saveOptions.apply = false
    return this.svgCanvasToString()
  }

  /**
   * This function determines whether to use a nonce in the prefix, when
   * generating IDs for future documents in svgedit.
   * @function module:svgcanvas.SvgCanvas#randomizeIds
   * @param {boolean} [enableRandomization]
   * @returns {void}
   */
  randomizeIds (enableRandomization?: boolean): void {
    if (arguments.length > 0 && enableRandomization === false) {
      draw.randomizeIds(false, this.getCurrentDrawing())
    } else {
      draw.randomizeIds(true, this.getCurrentDrawing())
    }
  }

  /**
   * Convert selected element to a path, or get the BBox of an element-as-path.
   * @function module:svgcanvas.SvgCanvas#convertToPath
   * @param {Element} elem - The DOM element to be converted
   * @param {boolean} getBBox - Boolean on whether or not to only return the path's BBox
   * @returns {void|DOMRect|false|SVGPathElement|null}
   */
  convertToPath (elem?: Element | null, getBBox?: boolean): any {
    if (!elem) {
      const elems = this.selectedElements
      elems.forEach(el => {
        if (el) {
          this.convertToPath(el)
        }
      })
      return undefined
    }
    if (getBBox) {
      return getBBoxOfElementAsPath(
        elem,
        this.addSVGElementsFromJson as any,
        this.pathActions
      )
    }
    const attrs = {
      fill: this.curShape.fill,
      'fill-opacity': this.curShape.fill_opacity,
      stroke: this.curShape.stroke,
      'stroke-width': this.curShape.stroke_width,
      'stroke-dasharray': this.curShape.stroke_dasharray,
      'stroke-linejoin': this.curShape.stroke_linejoin,
      'stroke-linecap': this.curShape.stroke_linecap,
      'stroke-opacity': this.curShape.stroke_opacity,
      opacity: this.curShape.opacity,
      visibility: 'hidden'
    }
    return utilitiesConvertToPath(elem, attrs as Record<string, unknown>, this)
  }

  /**
   * Removes all selected elements from the DOM and adds the change to the
   * history stack. Remembers removed elements on the clipboard.
   * @function module:svgcanvas.SvgCanvas#cutSelectedElements
   * @returns {void}
   */
  cutSelectedElements (): void {
    this.copySelectedElements()
    this.deleteSelectedElements()
  }

  initializeSvgCanvasMethods (): void {
    this.getJsonFromSvgElements = getJsonFromSvgElements
    this.addSVGElementsFromJson = addSVGElementsFromJson
    this.clearSvgContentElement = clearSvgContentElementInit
    this.textActions = textActionsMethod
    this.getStrokedBBox = getStrokedBBoxDefaultVisible
    this.getVisibleElements = getVisibleElements
    this.stringToHTML = stringToHTML
    this.insertChildAtIndex = insertChildAtIndex
    this.getClosest = getClosest
    this.getParents = getParents
    this.isLayer = draw.Layer.isLayer
    this.matrixMultiply = matrixMultiply
    this.hasMatrixTransform = hasMatrixTransform
    this.transformListToTransform = transformListToTransform
    this.convertToNum = convertToNum
    this.convertUnit = convertUnit
    this.findDefs = findDefs
    this.getUrlFromAttr = getUrlFromAttr
    this.getHref = getHref
    this.setHref = setHref
    this.getBBox = utilsGetBBox
    this.getRotationAngle = getRotationAngle
    this.getElement = getElement
    this.getRefElem = getRefElem
    this.assignAttributes = assignAttributes
    this.cleanupElement = cleanupElement
    this.remapElement = remapElement
    this.recalculateDimensions = recalculateDimensions
    this.sanitizeSvg = sanitizeSvg
    this.pasteElements = pasteElementsMethod
    this.identifyLayers = draw.identifyLayers
    this.createLayer = draw.createLayer
    this.cloneLayer = draw.cloneLayer
    this.deleteCurrentLayer = draw.deleteCurrentLayer
    this.setCurrentLayer = draw.setCurrentLayer
    this.renameCurrentLayer = draw.renameCurrentLayer
    this.setCurrentLayerPosition = draw.setCurrentLayerPosition
    this.indexCurrentLayer = draw.indexCurrentLayer
    this.setLayerVisibility = draw.setLayerVisibility
    this.moveSelectedToLayer = draw.moveSelectedToLayer
    this.mergeLayer = draw.mergeLayer
    this.mergeAllLayers = draw.mergeAllLayers
    this.leaveContext = draw.leaveContext
    this.setContext = draw.setContext
    this.changeSelectedAttributeNoUndo = changeSelectedAttributeNoUndoMethod
    this.changeSelectedAttribute = changeSelectedAttributeMethod
    this.setBlurNoUndo = setBlurNoUndo
    this.setBlurOffsets = setBlurOffsets
    this.setBlur = setBlur
    this.smoothControlPoints = pathModule.smoothControlPoints
    this.getTypeMap = getTypeMap
    this.history = history
    this.NS = NS
    this.$id = $id
    this.$qq = $qq
    this.$qa = $qa
    this.$click = $click
    this.encode64 = encode64
    this.decode64 = decode64
    this.mergeDeep = mergeDeep
  }

  /**
   * Creates modeChange event, adds it as an svgCanvas property
   **/
  modeChangeEvent (): void {
    const modeEvent = new CustomEvent('modeChange', { detail: { getMode: () => this.getMode() } })
    this.modeEvent = modeEvent
  }
} // End class

// attach utilities function to the class that are used by SvgEdit so
// we can avoid using the whole utilities.js file in svgEdit.js
SvgCanvas.$id = $id
SvgCanvas.$qq = $qq
SvgCanvas.$qa = $qa
SvgCanvas.$click = $click
SvgCanvas.encode64 = encode64
SvgCanvas.decode64 = decode64
SvgCanvas.mergeDeep = mergeDeep
SvgCanvas.getClosest = getClosest
SvgCanvas.getParents = getParents
SvgCanvas.blankPageObjectURL = blankPageObjectURL
SvgCanvas.Paint = Paint
SvgCanvas.getTypeMap = getTypeMap
SvgCanvas.convertToNum = convertToNum
SvgCanvas.isValidUnit = isValidUnit
SvgCanvas.convertUnit = convertUnit

export default SvgCanvas

// Re-export additional utilities (previously in svgcanvas.d.ts shim).
// Both units.js and utilities.js export an internal `init` symbol;
// use explicit re-exports to exclude `init` from both and avoid TS2308.
export * from './common/logger.js'
export { NS } from './core/namespaces.js'
export * from './core/math.js'
export {
  convertToNum,
  shortFloat,
  convertUnit,
  getTypeMap,
  isValidUnit,
  setUnitAttr
} from './core/units.js'
export {
  assignAttributes,
  cleanupElement,
  getElement,
  getUrlFromAttr,
  findDefs,
  getHref,
  setHref,
  getRefElem,
  getRotationAngle,
  getBBoxOfElementAsPath,
  convertToPath,
  encode64,
  decode64,
  getVisibleElements,
  getBBox,
  getStrokedBBoxDefaultVisible,
  blankPageObjectURL,
  $id,
  $qa,
  $qq,
  $click,
  getFeGaussianBlur,
  stringToHTML,
  insertChildAtIndex,
  walkTree,
  walkTreePost,
  text2xml,
  toXml,
  preventClickDefault,
  hashCode
} from './core/utilities.js'
export { sanitizeSvg } from './core/sanitize.js'
export { default as dataStorage } from './core/dataStorage.js'
