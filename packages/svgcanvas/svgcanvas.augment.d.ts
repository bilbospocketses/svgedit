// Module augmentation declaring methods that core/*.ts init() functions
// attach to the SvgCanvas instance at runtime. Hand-maintained.
//
// Drift is caught immediately by usage failing to compile -- when a new
// wired-on method is added in core/*.ts (Tasks 5-9), the matching
// declaration must be added here too.
//
// During Tasks 3-9, this file coexists with the legacy
// packages/svgcanvas/svgcanvas.d.ts shim. Methods the shim already
// declares are omitted here (no duplicate / conflicting declarations).
// Task 10 (C6) deletes the shim; at that point this augment file plus
// the future svgcanvas.ts class become the SvgCanvas type source.
//
// NOTE: other core/*.js files (clear.js, draw.js, undo.js, select.js,
// paint.js, blur-event.js, text-actions.js, copy-elem.js, paste-elem.js,
// historyrecording.js, recalculate.js, path-actions.js,
// path-method.js) also wire methods that the shim currently covers.
// svgroot.ts is a leaf with no wired-on methods (pure factory function).
// Each will be added here as their core/*.js converts to .ts in Tasks
// 5-9 — at which point Task 10 can remove the shim safely. Task 10
// MUST audit the shim's surviving declarations and migrate any that
// aren't class-owned on SvgCanvas (svgcanvas.js) to this augment file.

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

    // From core/event.ts (init wires these on)
    mouseDownEvent: (evt: MouseEvent) => void
    mouseMoveEvent: (evt: MouseEvent) => void
    dblClickEvent: (evt: MouseEvent) => void
    mouseUpEvent: (evt: MouseEvent) => void
    mouseOutEvent: (evt: MouseEvent) => void
    DOMMouseScrollEvent: (e: WheelEvent) => void
    dragStartTransforms: Map<Element, string> | null
    hasDragStartTransform: boolean
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

    // From core/selection.js (init wires these on)
    getMouseTarget: (...args: unknown[]) => unknown
    addToSelection: (...args: unknown[]) => unknown
    getIntersectionList: (...args: unknown[]) => unknown
    runExtensions: (...args: unknown[]) => unknown
    groupSvgElem: (...args: unknown[]) => unknown
    prepareSvg: (...args: unknown[]) => unknown
    recalculateAllSelectedDimensions: (...args: unknown[]) => unknown
    setRotationAngle: (...args: unknown[]) => unknown

    // From core/svg-exec.js (init wires these on)
    importSvgString: (...args: unknown[]) => unknown
    uniquifyElems: (...args: unknown[]) => unknown
    setUseData: (...args: unknown[]) => unknown
    convertGradients: (...args: unknown[]) => unknown
    removeUnusedDefElems: (...args: unknown[]) => unknown
    svgCanvasToString: (...args: unknown[]) => unknown
    svgToString: (...args: unknown[]) => unknown
    rasterExport: (...args: unknown[]) => unknown
    exportPDF: (...args: unknown[]) => unknown
    // current_drawing_ is a pseudo-private (trailing-underscore); attached
    // in svgcanvas.js constructor, not by an init() call. Renamed to
    // currentDrawing in Task 17 (C13) — keep the underscore form here
    // until then so consumers don't break.
    current_drawing_: unknown
  }
}
