/* eslint-disable @typescript-eslint/no-explicit-any */
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
    getUIStrings: () => Record<string, string>
    getPathObj: () => any
    setPathObj: (obj: any) => void
    getPathFuncs: () => (string | number)[]
    getLinkControlPts: () => boolean

    // From core/selected-elem.js (init wires these on)
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

    // From core/selection.js (init wires these on)
    clearSelection: (noCall?: boolean) => void
    getMouseTarget: (evt: MouseEvent | null) => Element | null
    addToSelection: (elemsToAdd: Element[], showGrips?: boolean) => void
    getIntersectionList: (rect?: { x: number; y: number; width: number; height: number }) => Element[] | null
    runExtensions: (opts: { action: string; vars?: unknown }) => unknown[]
    groupSvgElem: (elem: Element) => void
    prepareSvg: (newDoc: XMLDocument) => void
    recalculateAllSelectedDimensions: () => void
    setRotationAngle: (val: string | number, preventUndo?: boolean) => void

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
    // currentDrawing was formerly current_drawing_ (trailing-underscore pseudo-private);
    // renamed to currentDrawing in Task 17 (C13). Attached in svgcanvas.ts constructor,
    // not by an init() call.
    currentDrawing: unknown
  }
}
