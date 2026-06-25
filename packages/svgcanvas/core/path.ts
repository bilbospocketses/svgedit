/**
 * Path functionality.
 * @module path
 * @license MIT
 *
 */


import { transformPoint, getTransformList } from './math.js'
import {
  getRotationAngle, getBBox,
  getRefElem, findDefs
} from './utilities.js'
import { getPathDataReadonly } from './path-data.js'
import { toPathSeg } from './path-method.js'
import {
  init as pathMethodInit,
  ptObjToArrMethod,
  getGripPtMethod,
  getPointFromGripMethod,
  addPointGripMethod,
  getGripContainerMethod,
  addCtrlGripMethod,
  getCtrlLineMethod,
  getPointGripMethod,
  getControlPointsMethod,
  replacePathSegMethod,
  getSegSelectorMethod,
  Path
} from './path-method.js'
import {
  init as pathActionsInit,
  pathActionsMethod
} from './path-actions.js'

const segData: Record<number, string[]> = {
  2: ['x', 'y'], // PATHSEG_MOVETO_ABS
  4: ['x', 'y'], // PATHSEG_LINETO_ABS
  6: ['x', 'y', 'x1', 'y1', 'x2', 'y2'], // PATHSEG_CURVETO_CUBIC_ABS
  8: ['x', 'y', 'x1', 'y1'], // PATHSEG_CURVETO_QUADRATIC_ABS
  10: ['x', 'y', 'r1', 'r2', 'angle', 'largeArcFlag', 'sweepFlag'], // PATHSEG_ARC_ABS
  12: ['x'], // PATHSEG_LINETO_HORIZONTAL_ABS
  14: ['y'], // PATHSEG_LINETO_VERTICAL_ABS
  16: ['x', 'y', 'x2', 'y2'], // PATHSEG_CURVETO_CUBIC_SMOOTH_ABS
  18: ['x', 'y'] // PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS
}

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas
const uiStrings: Record<string, string> = {}
/**
* Merge UI string labels (e.g., tooltip text) used by path grip elements.
* @function module:path.setUiStrings
*/
export const setUiStrings = (strs: { ui: Record<string, string> }): void => {
  Object.assign(uiStrings, strs.ui)
}

let pathFuncs: (string | number)[] = []

let linkControlPts = true

// Stores references to paths via IDs.
// TODO: Make this cross-document happy.
let pathData: Record<string, Path> = {}

/**
* Set whether moving one Bezier control point automatically mirrors the opposite control point.
* @function module:path.setLinkControlPoints
*/
export const setLinkControlPoints = (lcp: boolean): void => {
  linkControlPts = lcp
}

let activePath: Path | null = null

/** Return the currently active Path instance, or null when no path is being edited. */
export function getPath (): Path | null {
  return activePath
}

/** Set the currently active Path instance; pass null to deactivate. */
export function setPath (p: Path | null): void {
  activePath = p
}

/**
* @external MouseEvent
*/

/**
 * @interface module:path.EditorContext
 * @property {module:select.SelectorManager} selectorManager
 * @property {module:svgcanvas.SvgCanvas} canvas
 */
/**
 * Dispatch a named canvas event to registered listeners.
 * @function module:path.EditorContext#call
 * @param arg - Argument to pass through to the callback function.
 *  If the event is "changed", an array of `Element`s is passed; if "selected", a single-item array of `Element` is passed.
 */
/**
 * Note: This doesn't round to an integer necessarily.
 * @function module:path.EditorContext#round
 * @returns Rounded value to nearest value based on `zoom`
 */
/**
 * Deselect all currently selected elements.
 * @function module:path.EditorContext#clearSelection
 * @param [noCall] - When `true`, does not call the "selected" handler
*/
/**
 * Add elements to the current selection, optionally showing resize grips.
 * @function module:path.EditorContext#addToSelection
 * @param elemsToAdd - An array of DOM elements to add to the selection
 * @param showGrips - Indicates whether the resize grips should be shown
*/
/**
 * Push a command onto the undo history stack.
 * @function module:path.EditorContext#addCommandToHistory
 */
/**
 * Apply a transform matrix to an element's coordinate attributes, updating them in place.
 * @function module:path.EditorContext#remapElement
 * @param selected - DOM element to be changed
 * @param changes - Object with changes to be remapped
 * @param m - Matrix object to use for remapping coordinates
 */
/**
 * Create and insert SVG elements from a JSON descriptor, returning the created element.
 * @function module:path.EditorContext#addSVGElementsFromJson
*/
/**
 * Return whether grid-snapping is currently enabled.
 * @function module:path.EditorContext#getGridSnapping
 */
/**
 * Return the current fill/stroke opacity value.
 * @function module:path.EditorContext#getOpacity
 */
/**
 * Return the list of currently selected DOM elements.
 * @function module:path.EditorContext#getSelectedElements
 * @returns the array with selected DOM elements
*/
/**
 * Return the root container element of the SVG editor canvas.
 * @function module:path.EditorContext#getContainer
 */
/**
 * Set the drawing-started flag indicating a mouse-drag operation is in progress.
 * @function module:path.EditorContext#setStarted
 */
/**
 * Return the rubber-band selection rectangle SVG element.
 * @function module:path.EditorContext#getRubberBox
*/
/**
 * Assign and return the rubber-band selection rectangle element.
 * @function module:path.EditorContext#setRubberBox
 */
/**
 * Register grip elements as selected and notify the canvas, indicating whether the subpath is closed.
 * @function module:path.EditorContext#addPtsToSelection
 */
/**
 * Finalize a change command by recording it to history and firing the changed event.
 * @function module:path.EditorContext#endChanges
*/
/**
 * Return the current zoom level as a numeric multiplier.
 * @function module:path.EditorContext#getZoom
 */
/**
 * Returns the last created DOM element ID string.
 * @function module:path.EditorContext#getId
 */
/**
 * Creates and returns a unique ID string for a DOM element.
 * @function module:path.EditorContext#getNextId
*/
/**
 * Gets the desired element from a mouse event.
 * @function module:path.EditorContext#getMouseTarget
 * @param evt - Event object from the mouse event
 */
/**
 * Return the current editor interaction mode string (e.g., 'select', 'path', 'pathedit').
 * @function module:path.EditorContext#getCurrentMode
 */
/**
 * Change the current editor interaction mode and return the new mode string.
 * @function module:path.EditorContext#setCurrentMode
*/
/**
 * Update the in-progress drawn path element reference and return the new value.
 * @function module:path.EditorContext#setDrawnPath
 */
/**
 * Return the root SVGSVGElement of the editor document.
 * @function module:path.EditorContext#getSvgRoot
*/

/**
* Initialize the path module, wiring all path-editing methods onto the canvas context object.
* @function module:path.init
*/
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
  svgCanvas.replacePathSeg = replacePathSegMethod
  svgCanvas.addPointGrip = addPointGripMethod
  svgCanvas.removePath_ = removePath_
  svgCanvas.getPath_ = getPath_
  svgCanvas.addCtrlGrip = addCtrlGripMethod
  svgCanvas.getCtrlLine = getCtrlLineMethod
  svgCanvas.getGripPt = getGripPt
  svgCanvas.getPointFromGrip = getPointFromGripMethod
  svgCanvas.setLinkControlPoints = setLinkControlPoints
  svgCanvas.reorientGrads = reorientGrads
  svgCanvas.recalcRotatedPath = recalcRotatedPath
  svgCanvas.getSegData = () => { return segData }
  svgCanvas.getUIStrings = () => { return uiStrings }
  svgCanvas.getPathObj = () => { return activePath }
  svgCanvas.setPathObj = (obj: Path | null) => { activePath = obj }
  svgCanvas.getPathFuncs = () => { return pathFuncs }
  svgCanvas.getLinkControlPts = () => { return linkControlPts }
  pathFuncs = [0, 'ClosePath']
  const pathFuncsStrs = [
    'Moveto', 'Lineto', 'CurvetoCubic', 'CurvetoQuadratic', 'Arc',
    'LinetoHorizontal', 'LinetoVertical', 'CurvetoCubicSmooth', 'CurvetoQuadraticSmooth'
  ]
  pathFuncsStrs.forEach((s) => {
    pathFuncs.push(s + 'Abs')
    pathFuncs.push(s + 'Rel')
  })
  pathActionsInit(svgCanvas)
  pathMethodInit(svgCanvas)
}


/**
* Re-export of ptObjToArrMethod — converts a PathSeg object to a flat number array ordered by segment type properties.
* @function module:path.ptObjToArr
* @todo See if this should just live in `replacePathSeg`
*/
export const ptObjToArr: typeof ptObjToArrMethod = ptObjToArrMethod

/**
* Re-export of getGripPtMethod — return the canvas-coordinate position of a path segment's grip.
* @function module:path.getGripPt
*/
export const getGripPt: typeof getGripPtMethod = getGripPtMethod

/**
* Re-export of getPointFromGripMethod — convert a grip canvas-coordinate position back to path-data coordinates.
* @function module:path.getPointFromGrip
*/
export const getPointFromGrip: typeof getPointFromGripMethod = getPointFromGripMethod

/**
* Requires prior call to `setUiStrings` if `xlink:title`
*    to be set on the grip.
* @function module:path.addPointGrip
*/
export const addPointGrip: typeof addPointGripMethod = addPointGripMethod

/**
* Return (creating if absent) the SVG group element that holds all path-edit grip elements.
* @function module:path.getGripContainer
*/
export const getGripContainer: typeof getGripContainerMethod = getGripContainerMethod

/**
* Requires prior call to `setUiStrings` if `xlink:title`
*    to be set on the grip.
* @function module:path.addCtrlGrip
*/
export const addCtrlGrip: typeof addCtrlGripMethod = addCtrlGripMethod

/**
* Return (creating if absent) the SVG line element used to draw a control-point handle arm.
* @function module:path.getCtrlLine
*/
export const getCtrlLine: typeof getCtrlLineMethod = getCtrlLineMethod

/**
* Return the point-grip circle for a segment, optionally updating its position.
* @function module:path.getPointGrip
*/
export const getPointGrip: typeof getPointGripMethod = getPointGripMethod

/**
* Build and display Bezier control-point grips and their connecting lines for a cubic segment.
* @function module:path.getControlPoints
*/
export const getControlPoints: typeof getControlPointsMethod = getControlPointsMethod

/**
* This replaces the segment at the given index. Type is given as number.
* @function module:path.replacePathSeg
* @param type Possible values set during {@link module:path.init}
*/
export const replacePathSeg: typeof replacePathSegMethod = replacePathSegMethod

/**
* Return (creating if absent) the highlight path element for a segment, optionally updating its geometry.
* @function module:path.getSegSelector
*/
export const getSegSelector: typeof getSegSelectorMethod = getSegSelectorMethod

interface XYPoint {
  x: number
  y: number
}

/**
* Takes three points and creates a smoother line based on them.
* @function module:path.smoothControlPoints
* @param ct1 - Object with x and y values (first control point)
* @param ct2 - Object with x and y values (second control point)
* @param pt - Object with x and y values (third point)
* @returns Array of two "smoothed" point objects
*/
export const smoothControlPoints = (ct1: XYPoint, ct2: XYPoint, pt: XYPoint): SVGPoint[] | undefined => {
  // each point must not be the origin
  const x1 = ct1.x - pt.x
  const y1 = ct1.y - pt.y
  const x2 = ct2.x - pt.x
  const y2 = ct2.y - pt.y

  if ((x1 !== 0 || y1 !== 0) && (x2 !== 0 || y2 !== 0)) {
    const
      r1 = Math.sqrt(x1 * x1 + y1 * y1)
    const r2 = Math.sqrt(x2 * x2 + y2 * y2)
    const nct1 = svgCanvas.getSvgRoot().createSVGPoint()
    const nct2 = svgCanvas.getSvgRoot().createSVGPoint()
    let anglea = Math.atan2(y1, x1)
    let angleb = Math.atan2(y2, x2)
    if (anglea < 0) { anglea += 2 * Math.PI }
    if (angleb < 0) { angleb += 2 * Math.PI }

    const angleBetween = Math.abs(anglea - angleb)
    const angleDiff = Math.abs(Math.PI - angleBetween) / 2

    let newAnglea: number; let newAngleb: number
    if (anglea - angleb > 0) {
      newAnglea = angleBetween < Math.PI ? (anglea + angleDiff) : (anglea - angleDiff)
      newAngleb = angleBetween < Math.PI ? (angleb - angleDiff) : (angleb + angleDiff)
    } else {
      newAnglea = angleBetween < Math.PI ? (anglea - angleDiff) : (anglea + angleDiff)
      newAngleb = angleBetween < Math.PI ? (angleb + angleDiff) : (angleb - angleDiff)
    }

    // rotate the points
    nct1.x = r1 * Math.cos(newAnglea) + pt.x
    nct1.y = r1 * Math.sin(newAnglea) + pt.y
    nct2.x = r2 * Math.cos(newAngleb) + pt.x
    nct2.y = r2 * Math.sin(newAngleb) + pt.y

    return [nct1, nct2]
  }
  return undefined
}

/**
* Return the Path editing object for the given element, creating and caching it on first access.
* @function module:path.getPath_
*/
export const getPath_ = (elem: SVGPathElement): Path => {
  let p = pathData[elem.id]
  if (!p) {
    p = pathData[elem.id] = new Path(elem)
  }
  return p
}

/**
* Remove the cached Path editing object for the given element ID.
* @function module:path.removePath_
*/
export const removePath_ = (id: string): void => {
  if (id in pathData) { delete pathData[id] }
}

let newcx: number
let newcy: number
let oldcx: number
let oldcy: number
let angle: number

const getRotVals = (x: number, y: number): XYPoint => {
  let dx = x - oldcx
  let dy = y - oldcy

  // rotate the point around the old center
  let r = Math.sqrt(dx * dx + dy * dy)
  let theta = Math.atan2(dy, dx) + angle
  dx = r * Math.cos(theta) + oldcx
  dy = r * Math.sin(theta) + oldcy

  // dx,dy should now hold the actual coordinates of each
  // point after being rotated

  // now we want to rotate them around the new center in the reverse direction
  dx -= newcx
  dy -= newcy

  r = Math.sqrt(dx * dx + dy * dy)
  theta = Math.atan2(dy, dx) - angle

  return {
    x: r * Math.cos(theta) + newcx,
    y: r * Math.sin(theta) + newcy
  }
}

// If the path was rotated, we must now pay the piper:
// Every path point must be rotated into the rotated coordinate system of
// its old center, then determine the new center, then rotate it back
// This is because we want the path to remember its rotation

/**
* Re-apply the path's rotation transform, recalculating every point coordinate relative to the new center.
* @function module:path.recalcRotatedPath
* @todo This is still using ye olde transform methods, can probably
* be optimized or even taken care of by `recalculateDimensions`
*/
export const recalcRotatedPath = (): void => {
  const p = getPath()
  const pathElem = p?.elem
  if (!pathElem || !p) { return }
  angle = getRotationAngle(pathElem, true)
  if (!angle) { return }
  const oldbox = p.oldbbox
  if (!oldbox) { return }
  oldcx = oldbox.x + oldbox.width / 2
  oldcy = oldbox.y + oldbox.height / 2
  const box = getBBox(pathElem)
  if (!box) { return }
  newcx = box.x + box.width / 2
  newcy = box.y + box.height / 2

  // un-rotate the new center to the proper position
  const dx = newcx - oldcx
  const dy = newcy - oldcy
  const r = Math.sqrt(dx * dx + dy * dy)
  const theta = Math.atan2(dy, dx) + angle

  newcx = r * Math.cos(theta) + oldcx
  newcy = r * Math.sin(theta) + oldcy

  const recalcData = getPathDataReadonly(pathElem)
  if (!recalcData.length) { return }

  let i = recalcData.length
  while (i) {
    i -= 1
    const cmd = recalcData[i]
    if (!cmd) { continue }
    const seg = toPathSeg(cmd)
    const type = seg.pathSegType
    if (type === 1) { continue }

    const props = segData[type]
    if (!props) { continue }

    const newVals: Record<string, number> = {}
    if (seg.x !== null && seg.x !== undefined && seg.y !== null && seg.y !== undefined) {
      const rvals = getRotVals(seg.x, seg.y)
      newVals.x = rvals.x
      newVals.y = rvals.y
    }
    if (seg.x1 !== null && seg.x1 !== undefined && seg.y1 !== null && seg.y1 !== undefined) {
      const cVals1 = getRotVals(seg.x1, seg.y1)
      newVals.x1 = cVals1.x
      newVals.y1 = cVals1.y
    }
    if (seg.x2 !== null && seg.x2 !== undefined && seg.y2 !== null && seg.y2 !== undefined) {
      const cVals2 = getRotVals(seg.x2, seg.y2)
      newVals.x2 = cVals2.x
      newVals.y2 = cVals2.y
    }

    const points = props.map((prop) => {
      if (Object.prototype.hasOwnProperty.call(newVals, prop)) {
        return newVals[prop] as number
      }
      const val = seg[prop]
      return (val === null || val === undefined) ? 0 : (val as number)
    })
    replacePathSeg(type, i, points)
  } // loop for each point

  /* box = */ getBBox(pathElem)
  // selectedBBoxes[0].x = box.x; selectedBBoxes[0].y = box.y;
  // selectedBBoxes[0].width = box.width; selectedBBoxes[0].height = box.height;

  // now we must set the new transform to be rotated around the new center
  const Rnc = svgCanvas.getSvgRoot().createSVGTransform()
  const tlist = getTransformList(pathElem)
  if (!tlist) { return }
  Rnc.setRotate((angle * 180.0 / Math.PI), newcx, newcy)
  if (tlist.numberOfItems) {
    if (typeof tlist.replaceItem === 'function') {
      tlist.replaceItem(Rnc, 0)
    } else {
      tlist.removeItem(0)
      tlist.insertItemBefore(Rnc, 0)
    }
  } else {
    tlist.appendItem(Rnc)
  }
}

// ====================================
// Public API starts here

/**
* Clear all cached Path editing objects, releasing references to DOM elements.
* @function module:path.clearData
*/
export const clearData = (): void => {
  pathData = {}
}

// Making public for mocking
/**
* Remap gradient coordinates on an element to account for an applied transform matrix.
* @function module:path.reorientGrads
*/
export const reorientGrads = (elem: Element, m: SVGMatrix): void => {
  const bb = getBBox(elem)
  if (!bb) { return }
  for (let i = 0; i < 2; i++) {
    const type = i === 0 ? 'fill' : 'stroke'
    const attrVal = elem.getAttribute(type)
    if (attrVal && attrVal.startsWith('url(')) {
      const grad = getRefElem(attrVal)
      if (grad && grad.tagName === 'linearGradient') {
        let x1: number = Number(grad.getAttribute('x1') ?? '0') || 0
        let y1: number = Number(grad.getAttribute('y1') ?? '0') || 0
        let x2: number = Number(grad.getAttribute('x2') ?? '1') || 1
        let y2: number = Number(grad.getAttribute('y2') ?? '0') || 0

        // Convert to USOU points
        x1 = (bb.width * x1) + bb.x
        y1 = (bb.height * y1) + bb.y
        x2 = (bb.width * x2) + bb.x
        y2 = (bb.height * y2) + bb.y

        // Transform those points
        const pt1 = transformPoint(x1, y1, m)
        const pt2 = transformPoint(x2, y2, m)

        // Convert back to BB points
        const gCoords = {
          x1: (pt1.x - bb.x) / bb.width,
          y1: (pt1.y - bb.y) / bb.height,
          x2: (pt2.x - bb.x) / bb.width,
          y2: (pt2.y - bb.y) / bb.height
        }

        const newgrad = grad.cloneNode(true) as Element
        for (const [key, value] of Object.entries(gCoords)) {
          newgrad.setAttribute(key, String(value))
        }
        newgrad.id = svgCanvas.getNextId()
        findDefs().append(newgrad)
        elem.setAttribute(type, `url(#${newgrad.id})`)
      }
    }
  }
}

export { convertPath } from './path-actions.js'

/**
* Group: Path edit functions.
* Functions relating to editing path elements.
*/
export const pathActions: typeof pathActionsMethod = pathActionsMethod
// end pathActions
