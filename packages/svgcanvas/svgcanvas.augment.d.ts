// Module augmentation declaring methods that core/*.ts init() functions
// attach to the SvgCanvas instance at runtime. Hand-maintained.
//
// Drift is caught immediately by usage failing to compile -- when a new
// wired-on method is added in core/*.ts (Tasks 5-9), the matching
// declaration must be added here too.
//
// As of Task 10 (C6), the legacy packages/svgcanvas/svgcanvas.d.ts shim
// has been deleted.  This augment file plus the class in svgcanvas.ts are
// now the sole SvgCanvas type sources.
//
// NOTE: remaining core/*.js files (clear.js, draw.js, undo.js, select.js,
// copy-elem.js, historyrecording.js) still wire methods covered below.
// All of path-actions.ts, path-method.ts, recalculate.ts, svg-exec.ts are
// now .ts (Task 9b complete). svgroot.ts is a leaf with no wired-on methods.

import type {} from './svgcanvas'

declare module './svgcanvas' {
  interface SvgCanvas {
    // From core/elem-get-set.js (init wires these on)
    getBold: (...args: unknown[]) => unknown
    setBold: (...args: unknown[]) => unknown
    getItalic: (...args: unknown[]) => unknown
    setItalic: (...args: unknown[]) => unknown
    hasTextDecoration: (...args: unknown[]) => unknown
    addTextDecoration: (...args: unknown[]) => unknown
    removeTextDecoration: (...args: unknown[]) => unknown
    setTextAnchor: (...args: unknown[]) => unknown
    setLetterSpacing: (...args: unknown[]) => unknown
    setWordSpacing: (...args: unknown[]) => unknown
    setTextLength: (...args: unknown[]) => unknown
    setLengthAdjust: (...args: unknown[]) => unknown
    getFontFamily: (...args: unknown[]) => unknown
    setFontFamily: (...args: unknown[]) => unknown
    setFontColor: (...args: unknown[]) => unknown
    getFontColor: (...args: unknown[]) => unknown
    getFontSize: (...args: unknown[]) => unknown
    setFontSize: (...args: unknown[]) => unknown
    getText: (...args: unknown[]) => unknown
    setTextContent: (...args: unknown[]) => unknown
    setImageURL: (...args: unknown[]) => unknown
    setLinkURL: (...args: unknown[]) => unknown
    setRectRadius: (...args: unknown[]) => unknown
    makeHyperlink: (...args: unknown[]) => unknown
    removeHyperlink: (...args: unknown[]) => unknown
    // setSegType is wired top-level here, separate from shim's pathActions.setSegType
    // (the nested one is a path-actions module method; this one delegates to it)
    setSegType: (...args: unknown[]) => unknown
    setStrokeWidth: (...args: unknown[]) => unknown
    getTitle: (...args: unknown[]) => unknown
    setGroupTitle: (...args: unknown[]) => unknown
    setStrokeAttr: (...args: unknown[]) => unknown
    setBackground: (...args: unknown[]) => unknown
    setDocumentTitle: (...args: unknown[]) => unknown
    getEditorNS: (...args: unknown[]) => unknown
    setBBoxZoom: (...args: unknown[]) => unknown
    setCurrentZoom: (...args: unknown[]) => unknown
    setColor: (...args: unknown[]) => unknown
    setGradient: (...args: unknown[]) => unknown
    setPaint: (...args: unknown[]) => unknown
    // getResolution / setResolution are wired by elem-get-set init()
    getResolution: () => { w: number; h: number; zoom: number }
    setResolution: (x: number | 'fit', y: number) => boolean

    // From core/event.ts (init wires these on)
    mouseDownEvent: (evt: MouseEvent) => void
    mouseMoveEvent: (evt: MouseEvent) => void
    dblClickEvent: (evt: MouseEvent) => void
    mouseUpEvent: (evt: MouseEvent) => void
    mouseOutEvent: (evt: MouseEvent) => void
    DOMMouseScrollEvent: (e: WheelEvent) => void
    // dragStartTransforms and hasDragStartTransform are never initialized in
    // init(); only set conditionally inside event handlers — optional under exactOptionalPropertyTypes
    dragStartTransforms?: Map<Element, string>
    hasDragStartTransform?: boolean
    // addedNew is only ever set inside a conditional (event.js:972) and is
    // never initialized in init(); optional under exactOptionalPropertyTypes
    addedNew?: boolean

    // From core/path.ts (init wires these on)
    replacePathSeg: (...args: unknown[]) => unknown
    addPointGrip: (...args: unknown[]) => unknown
    removePath_: (id: string) => void
    getPath_: (elem: SVGPathElement) => unknown
    addCtrlGrip: (...args: unknown[]) => unknown
    getCtrlLine: (...args: unknown[]) => unknown
    getGripPt: (...args: unknown[]) => unknown
    getPointFromGrip: (...args: unknown[]) => unknown
    setLinkControlPoints: (lcp: boolean) => void
    reorientGrads: (elem: Element, m: SVGMatrix) => void
    recalcRotatedPath: () => void
    getSegData: () => Record<number, string[]>
    getUIStrings: () => Record<string, string>
    getPathObj: () => unknown
    setPathObj: (obj: unknown) => void
    getPathFuncs: () => (string | number)[]
    getLinkControlPts: () => boolean

    // From core/selected-elem.js (init wires these on)
    pushGroupProperties: (...args: unknown[]) => unknown
    flipSelectedElements: (...args: unknown[]) => unknown
    alignSelectedElements: (...args: unknown[]) => unknown
    updateCanvas: (...args: unknown[]) => unknown
    cycleElement: (...args: unknown[]) => unknown
    cloneSelectedElements: (...args: unknown[]) => unknown
    copySelectedElements: () => void
    groupSelectedElements: (type?: string, urlArg?: string) => void
    ungroupSelectedElement: () => void
    moveToTopSelectedElement: () => void
    moveToBottomSelectedElement: () => void
    moveUpDownSelected: (dir: 'Up' | 'Down') => void
    moveSelectedElements: (dx: number | number[], dy: number | number[], undoable?: boolean) => unknown
    deleteSelectedElements: () => void

    // From core/selection.js (init wires these on)
    clearSelection: (noCall?: boolean) => void
    getMouseTarget: (...args: unknown[]) => unknown
    addToSelection: (...args: unknown[]) => unknown
    getIntersectionList: (...args: unknown[]) => unknown
    runExtensions: (...args: unknown[]) => unknown
    groupSvgElem: (...args: unknown[]) => unknown
    prepareSvg: (...args: unknown[]) => unknown
    recalculateAllSelectedDimensions: (...args: unknown[]) => unknown
    setRotationAngle: (...args: unknown[]) => unknown

    // From core/undo.js (init wires these on)
    // undoMgr is attached by undo.init() — typed via the history module's UndoManager class
    undoMgr: import('./core/history.js').UndoManager

    // From core/svg-exec.ts (init wires these on)
    importSvgString: (xmlString: string, preserveDimension?: boolean) => Element | null
    uniquifyElems: (g: Element) => void
    setUseData: (parent: Element) => void
    convertGradients: (elem: Element) => void
    removeUnusedDefElems: () => number
    svgCanvasToString: () => string
    svgToString: (elem: Element, indent: number) => string
    rasterExport: (imgType?: string, quality?: number, windowName?: string, opts?: Record<string, unknown>) => Promise<Record<string, unknown>>
    exportPDF: (windowName?: string, outputType?: string) => Promise<Record<string, unknown>>
    // setSvgString and embedImage were missing from the pre-Task-10 augment file;
    // added here with signatures verified from svg-exec.ts implementation.
    setSvgString: (xmlString: string, preventUndo?: boolean) => boolean
    embedImage: (src: string) => Promise<string | false>
    // current_drawing_ is a pseudo-private (trailing-underscore); attached
    // in svgcanvas.js constructor, not by an init() call. Renamed to
    // currentDrawing in Task 17 (C13) — keep the underscore form here
    // until then so consumers don't break.
    current_drawing_: unknown
  }
}
