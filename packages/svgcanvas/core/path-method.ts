/* Path editing data structures and segment operations. */
/**
 * Path functionality.
 * @module path
 * @license MIT
 *
 */


import { NS } from './namespaces.js'
import { ChangeElementCommand } from './history.js'
import {
  transformPoint, getMatrix, isIdentity
} from './math.js'
import {
  assignAttributes,
  getElement
} from './utilities.js'
import { getPathData, getPathDataReadonly, setPathData } from './path-data.js'
import type { SVGPathDataCommand } from './path-data.js'

/** Seg object shape used by the path editing subsystem. */
export interface PathSeg {
  pathSegType: number
  pathSegTypeAsLetter: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  r1?: number
  r2?: number
  angle?: number
  largeArcFlag?: boolean | number
  sweepFlag?: boolean | number
  [key: string]: number | boolean | string | undefined
}

/** Map from SVGPathSeg numeric type constants to their single-letter command strings. */
export const TYPE_TO_CMD: Record<number, string> = {
  1: 'Z',
  2: 'M',
  3: 'm',
  4: 'L',
  5: 'l',
  6: 'C',
  7: 'c',
  8: 'Q',
  9: 'q',
  10: 'A',
  11: 'a',
  12: 'H',
  13: 'h',
  14: 'V',
  15: 'v',
  16: 'S',
  17: 's',
  18: 'T',
  19: 't'
}

/**
 * Named SVGPathSeg ABS type constants, replacing the bare 1/2/4/6 magic numbers
 * in the path-edit comparisons. Values match the SVGPathSeg enumeration
 * (see TYPE_TO_CMD above: Z=1, M=2, L=4, C=6).
 */
export const SEG_TYPE = {
  CLOSEPATH: 1,
  MOVETO: 2,
  LINETO: 4,
  CUBICBEZIER: 6
} as const

/** Inverse of TYPE_TO_CMD — maps command letter strings to their numeric type constants. */
export const CMD_TO_TYPE: Record<string, number> = Object.fromEntries(
  Object.entries(TYPE_TO_CMD).map(([k, v]) => [v, Number(k)])
)

/** Convert a path-data command entry to a PathSeg with named properties. */
export function toPathSeg (entry: SVGPathDataCommand): PathSeg {
  const { type, values = [] } = entry
  const cmd = CMD_TO_TYPE[type] ?? CMD_TO_TYPE[type?.toUpperCase?.() ?? '']
  const seg: PathSeg = { pathSegType: cmd ?? 0, pathSegTypeAsLetter: type }
  const U = String(type).toUpperCase()
  switch (U) {
    case 'H':
      seg.x = values[0] ?? 0
      break
    case 'V':
      seg.y = values[0] ?? 0
      break
    case 'M':
    case 'L':
    case 'T':
      seg.x = values[0] ?? 0
      seg.y = values[1] ?? 0
      break
    case 'S':
      seg.x2 = values[0] ?? 0; seg.y2 = values[1] ?? 0; seg.x = values[2] ?? 0; seg.y = values[3] ?? 0
      break
    case 'C':
      seg.x1 = values[0] ?? 0; seg.y1 = values[1] ?? 0; seg.x2 = values[2] ?? 0; seg.y2 = values[3] ?? 0; seg.x = values[4] ?? 0; seg.y = values[5] ?? 0
      break
    case 'Q':
      seg.x1 = values[0] ?? 0; seg.y1 = values[1] ?? 0; seg.x = values[2] ?? 0; seg.y = values[3] ?? 0
      break
    case 'A':
      seg.r1 = values[0] ?? 0; seg.r2 = values[1] ?? 0; seg.angle = values[2] ?? 0
      seg.largeArcFlag = values[3] ?? 0; seg.sweepFlag = values[4] ?? 0; seg.x = values[5] ?? 0; seg.y = values[6] ?? 0
      break
    default:
      break
  }
  return seg
}

/** Convert a PathSeg with named properties back to a path-data command entry. */
export function fromPathSeg (seg: PathSeg): SVGPathDataCommand {
  const type: string | undefined = TYPE_TO_CMD[seg.pathSegType] ?? (seg as unknown as { type?: string }).type
  if (!type) {
    return { type: 'Z', values: [] }
  }
  const U = String(type).toUpperCase()
  let values: number[] = []
  switch (U) {
    case 'H':
      values = [seg.x ?? 0]
      break
    case 'V':
      values = [seg.y ?? 0]
      break
    case 'M':
    case 'L':
    case 'T':
      values = [seg.x ?? 0, seg.y ?? 0]
      break
    case 'S':
      values = [seg.x2 ?? 0, seg.y2 ?? 0, seg.x ?? 0, seg.y ?? 0]
      break
    case 'C':
      values = [seg.x1 ?? 0, seg.y1 ?? 0, seg.x2 ?? 0, seg.y2 ?? 0, seg.x ?? 0, seg.y ?? 0]
      break
    case 'Q':
      values = [seg.x1 ?? 0, seg.y1 ?? 0, seg.x ?? 0, seg.y ?? 0]
      break
    case 'A':
      values = [
        seg.r1 ?? 0,
        seg.r2 ?? 0,
        seg.angle ?? 0,
        Number(seg.largeArcFlag ?? 0),
        Number(seg.sweepFlag ?? 0),
        seg.x ?? 0,
        seg.y ?? 0
      ]
      break
    default:
      values = []
  }
  return { type, values }
}

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/**
* Initialize path-method module with the canvas context.
* @function module:path-actions.init
*/
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
}


/**
* Convert a PathSeg object to a flat number array ordered by segment type properties.
* @function module:path.ptObjToArr
* @todo See if this should just live in `replacePathSeg`
*/
export const ptObjToArrMethod = (type: number, segItem: PathSeg): number[] => {
  const segData = svgCanvas.getSegData()
  const props = segData[type] ?? []
  return props.map((prop) => {
    return (segItem[prop] as number) ?? 0
  })
}

/**
* Return the canvas-coordinate position of a path segment's grip, applying any path matrix and zoom.
* @function module:path.getGripPt
*/
export const getGripPtMethod = (seg: Segment, altPt?: { x: number; y: number } | null): { x: number; y: number } => {
  const { path: pth } = seg
  let out = {
    x: altPt ? altPt.x : (seg.item.x ?? 0),
    y: altPt ? altPt.y : (seg.item.y ?? 0)
  }

  if (pth?.matrix) {
    const pt = transformPoint(out.x, out.y, pth.matrix)
    out = pt
  }
  const zoom = svgCanvas.getZoom()
  out.x *= zoom
  out.y *= zoom

  return out
}

/**
* Convert a grip canvas-coordinate position back to path-data coordinates, reversing matrix and zoom.
* @function module:path.getPointFromGrip
*/
export const getPointFromGripMethod = (pt: { x: number; y: number }, pth: Path): { x: number; y: number } => {
  const out = {
    x: pt.x,
    y: pt.y
  }

  if (pth.matrix) {
    const transformed = transformPoint(out.x, out.y, pth.imatrix as SVGMatrix)
    out.x = transformed.x
    out.y = transformed.y
  }
  const zoom = svgCanvas.getZoom()
  out.x /= zoom
  out.y /= zoom

  return out
}

/**
* Return (creating if absent) the SVG group element that holds all path-edit grip elements.
* @function module:path.getGripContainer
*/
export const getGripContainerMethod = (): Element => {
  let c = getElement('pathpointgrip_container')
  if (!c) {
    const parentElement = getElement('selectorParentGroup')
    c = document.createElementNS(NS.SVG, 'g')
    parentElement?.append(c)
    c.id = 'pathpointgrip_container'
  }
  return c
}

/**
* Requires prior call to `setUiStrings` if `xlink:title`
*    to be set on the grip.
* @function module:path.addPointGrip
*/
export const addPointGripMethod = (index: number, x?: number, y?: number): SVGCircleElement => {
  // create the container of all the point grips
  const pointGripContainer = getGripContainerMethod()

  let pointGrip = getElement(`pathpointgrip_${index}`) as SVGCircleElement | null
  // create it
  if (!pointGrip) {
    pointGrip = document.createElementNS(NS.SVG, 'circle')
    const atts: Record<string, string | number> = {
      id: `pathpointgrip_${index}`,
      display: 'none',
      r: 4,
      fill: '#0FF',
      stroke: '#00F',
      'stroke-width': 2,
      cursor: 'move',
      style: 'pointer-events:all'
    }
    const uiStrings = svgCanvas.getUIStrings()
    if ('pathNodeTooltip' in uiStrings) { // May be empty if running path.js without svg-editor
      atts['xlink:title'] = uiStrings.pathNodeTooltip
    }
    assignAttributes(pointGrip, atts)
    pointGripContainer.append(pointGrip)

    const grip = document.getElementById('pathpointgrip_' + index)
    grip?.addEventListener('dblclick', () => {
      const path = svgCanvas.getPathObj() as Path | null
      if (path) {
        path.setSegType()
      }
    })
  }
  if (x && y) {
    // set up the point grip element and display it
    assignAttributes(pointGrip, {
      cx: x,
      cy: y,
      display: 'inline'
    })
  }
  return pointGrip
}

/**
* Requires prior call to `setUiStrings` if `xlink:title`
*    to be set on the grip.
* @function module:path.addCtrlGrip
*/
export const addCtrlGripMethod = (id: string): SVGCircleElement => {
  let pointGrip = getElement('ctrlpointgrip_' + id) as SVGCircleElement | null
  if (pointGrip) { return pointGrip }

  pointGrip = document.createElementNS(NS.SVG, 'circle')
  const atts: Record<string, string | number> = {
    id: 'ctrlpointgrip_' + id,
    display: 'none',
    r: 4,
    fill: '#0FF',
    stroke: '#55F',
    'stroke-width': 1,
    cursor: 'move',
    style: 'pointer-events:all'
  }
  const uiStrings = svgCanvas.getUIStrings()
  if ('pathCtrlPtTooltip' in uiStrings) { // May be empty if running path.js without svg-editor
    atts['xlink:title'] = uiStrings.pathCtrlPtTooltip
  }
  assignAttributes(pointGrip, atts)
  getGripContainerMethod().append(pointGrip)
  return pointGrip
}

/**
* Return (creating if absent) the SVG line element used to draw a control-point handle arm.
* @function module:path.getCtrlLine
*/
export const getCtrlLineMethod = (id: string): SVGLineElement => {
  let ctrlLine = getElement('ctrlLine_' + id) as SVGLineElement | null
  if (ctrlLine) { return ctrlLine }

  ctrlLine = document.createElementNS(NS.SVG, 'line')
  assignAttributes(ctrlLine, {
    id: 'ctrlLine_' + id,
    stroke: '#555',
    'stroke-width': 1,
    style: 'pointer-events:none'
  })
  getGripContainerMethod().append(ctrlLine)
  return ctrlLine
}

/**
* Return the point-grip circle for a segment, optionally updating its position to the current grip coordinates.
* @function module:path.getPointGrip
*/
export const getPointGripMethod = (seg: Segment, update?: boolean): SVGCircleElement => {
  const { index } = seg
  const pointGrip = addPointGripMethod(index)

  if (update) {
    const pt = getGripPtMethod(seg)
    assignAttributes(pointGrip, {
      cx: pt.x,
      cy: pt.y,
      display: 'inline'
    })
  }

  return pointGrip
}

/**
* Build and display Bezier control-point grips and their connecting lines for a cubic segment; returns null for non-cubic segments.
* @function module:path.getControlPoints
*/
export const getControlPointsMethod = (seg: Segment): Record<string, SVGLineElement | SVGCircleElement> | null => {
  const { item, index } = seg
  if (!('x1' in item) || !('x2' in item)) { return null }
  const cpt: Record<string, SVGLineElement | SVGCircleElement> = {}
  /* const pointGripContainer = */ getGripContainerMethod()

  // Note that this is intentionally not seg.prev.item
  const path = svgCanvas.getPathObj() as Path
  const prev = path.segs[index - 1]?.item

  const segItems = [prev, item]

  for (let i = 1; i < 3; i++) {
    const id = index + 'c' + i

    const ctrlLine = getCtrlLineMethod(id)
    cpt[`c${i}_line`] = ctrlLine

    const pt = getGripPtMethod(seg, { x: (item)['x' + i] as number ?? 0, y: (item)['y' + i] as number ?? 0 })
    const gpt = getGripPtMethod(seg, { x: (segItems[i - 1])?.x ?? 0, y: (segItems[i - 1])?.y ?? 0 })

    assignAttributes(ctrlLine, {
      x1: pt.x,
      y1: pt.y,
      x2: gpt.x,
      y2: gpt.y,
      display: 'inline'
    })

    // create it
    const pointGrip = addCtrlGripMethod(id)
    cpt[`c${i}`] = pointGrip

    assignAttributes(pointGrip, {
      cx: pt.x,
      cy: pt.y,
      display: 'inline'
    })
  }
  return cpt
}

/**
* This replaces the segment at the given index. Type is given as number.
* @function module:path.replacePathSeg
* @param type Possible values set during {@link module:path.init}
*/
export const replacePathSegMethod = (type: number, index: number, pts: number[], elem?: SVGPathElement | SVGElement | null): void => {
  const path = svgCanvas.getPathObj() as Path | null
  const pth = (elem as SVGPathElement | null | undefined) ?? path?.elem
  if (!pth) return
  const segData = svgCanvas.getSegData?.() as Record<number, string[]> | undefined
  const props = segData?.[type] ?? segData?.[type - 1]
  if (props && pts.length < props.length) {
    const data = getPathDataReadonly(pth)
    const currentSeg = data[index] ? toPathSeg(data[index]) : null
    if (currentSeg) {
      pts = props.map((prop, i) => (pts[i] !== undefined ? (pts[i]) : ((currentSeg[prop] as number) ?? 0)))
    }
  }
  const safeProps = props ?? []
  const seg: PathSeg = { pathSegType: type, pathSegTypeAsLetter: TYPE_TO_CMD[type] ?? '' }
  safeProps.forEach((prop, i) => {
    seg[prop] = pts[i]
  })

  const data = getPathData(pth)
  data[index] = fromPathSeg(seg)
  setPathData(pth, data)
}

/**
* Return (creating if absent) the highlight path element for a segment, optionally updating its geometry.
* @function module:path.getSegSelector
*/
export const getSegSelectorMethod = (seg: Segment, update?: boolean): SVGPathElement => {
  const { index } = seg
  let segLine = getElement(`segline_${index}`) as SVGPathElement | null
  if (!segLine) {
    const pointGripContainer = getGripContainerMethod()
    // create segline
    segLine = document.createElementNS(NS.SVG, 'path')
    assignAttributes(segLine, {
      id: `segline_${index}`,
      display: 'none',
      fill: 'none',
      stroke: '#0FF',
      'stroke-width': 2,
      style: 'pointer-events:none',
      d: 'M0,0 0,0'
    })
    pointGripContainer.append(segLine)
  }

  if (update) {
    const { prev } = seg
    if (!prev) {
      segLine.setAttribute('display', 'none')
      return segLine
    }

    const pt = getGripPtMethod(prev)
    // Set start point
    replacePathSegMethod(2, 0, [pt.x, pt.y], segLine)

    const pts = ptObjToArrMethod(seg.type, seg.item) // , true);
    for (let i = 0; i < pts.length; i += 2) {
      const point = getGripPtMethod(seg, { x: pts[i] ?? 0, y: pts[i + 1] ?? 0 })
      pts[i] = point.x
      pts[i + 1] = point.y
    }

    replacePathSegMethod(seg.type, 1, pts, segLine)
  }
  return segLine
}

/** Represents one segment within a path, holding its grip, control-point elements, and selection state. */
export class Segment {
  selected: boolean
  index: number
  item: PathSeg
  type: number
  ctrlpts: Record<string, SVGLineElement | SVGCircleElement> | null
  ptgrip: SVGCircleElement | null
  segsel: SVGPathElement | null
  path?: Path
  prev?: Segment
  next?: Segment
  mate?: Segment
  olditem?: PathSeg

  constructor (index: number, item: PathSeg) {
    this.selected = false
    this.index = index
    this.item = item
    this.type = item.pathSegType

    this.ctrlpts = null
    this.ptgrip = null
    this.segsel = null
  }

  showCtrlPts (y: boolean): void {
    for (const i in this.ctrlpts) {
      if ({}.hasOwnProperty.call(this.ctrlpts, i)) {
        this.ctrlpts[i]?.setAttribute('display', y ? 'inline' : 'none')
      }
    }
  }

  selectCtrls (y: boolean): void {
    document.getElementById(`ctrlpointgrip_${this.index}c1`)?.setAttribute('fill', y ? '#0FF' : '#EEE')
    document.getElementById(`ctrlpointgrip_${this.index}c2`)?.setAttribute('fill', y ? '#0FF' : '#EEE')
  }

  show (y: boolean): void {
    if (this.ptgrip) {
      this.ptgrip.setAttribute('display', y ? 'inline' : 'none')
      this.segsel?.setAttribute('display', y ? 'inline' : 'none')
      // Show/hide all control points if available
      this.showCtrlPts(y)
    }
  }

  select (y: boolean): void {
    if (this.ptgrip) {
      this.ptgrip.setAttribute('stroke', y ? '#0FF' : '#00F')
      this.segsel?.setAttribute('display', y ? 'inline' : 'none')
      if (this.ctrlpts) {
        this.selectCtrls(y)
      }
      this.selected = y
    }
  }

  addGrip (): void {
    this.ptgrip = getPointGripMethod(this, true)
    this.ctrlpts = getControlPointsMethod(this) // , true);
    this.segsel = getSegSelectorMethod(this, true)
  }

  update (full?: boolean): void {
    if (this.ptgrip) {
      const pt = getGripPtMethod(this)
      assignAttributes(this.ptgrip, {
        cx: pt.x,
        cy: pt.y
      })

      getSegSelectorMethod(this, true)

      if (this.ctrlpts) {
        if (full) {
          const path = svgCanvas.getPathObj() as Path
          const data = getPathDataReadonly(path.elem)
          const cmd = data[this.index]
          if (cmd) { this.item = toPathSeg(cmd) }
          this.type = this.item.pathSegType
        }
        getControlPointsMethod(this)
      }
      // this.segsel.setAttribute('display', y ? 'inline' : 'none');
    }
  }

  move (dx: number, dy: number): void {
    const { item } = this

    if (item.x !== undefined) item.x += dx
    if (item.y !== undefined) item.y += dy

    // `x2/y2` are the control point attached to this node (when present)
    if ('x2' in item && item.x2 !== undefined) { item.x2 += dx }
    if ('y2' in item && item.y2 !== undefined) { item.y2 += dy }

    replacePathSegMethod(
      this.type,
      this.index,
      ptObjToArrMethod(this.type, item)
    )

    const next = this.next?.item
    // `x1/y1` are the control point attached to this node on the next segment (when present)
    if (next && 'x1' in next && 'y1' in next) {
      if (next.x1 !== undefined) next.x1 += dx
      if (next.y1 !== undefined) next.y1 += dy
      if (this.next) {
        replacePathSegMethod(this.next.type, this.next.index, ptObjToArrMethod(this.next.type, next))
      }
    }

    if (this.mate) {
      // The last point of a closed subpath has a 'mate',
      // which is the 'M' segment of the subpath
      const { item: itm } = this.mate
      if (itm.x !== undefined) itm.x += dx
      if (itm.y !== undefined) itm.y += dy
      const pts = [itm.x ?? 0, itm.y ?? 0]
      replacePathSegMethod(this.mate.type, this.mate.index, pts)
      // Has no grip, so does not need 'updating'?
    }

    this.update(true)
    if (this.next) { this.next.update(true) }
  }

  setLinked (num: number): void {
    let seg: Segment | undefined; let anum: number; let pt: PathSeg
    if (num === 2) {
      anum = 1
      seg = this.next
      if (!seg) { return }
      pt = this.item
    } else {
      anum = 2
      seg = this.prev
      if (!seg) { return }
      pt = seg.item
    }

    const { item } = seg
    item['x' + anum] = (pt.x ?? 0) + (pt.x ?? 0) - ((this.item['x' + num] as number) ?? 0)
    item['y' + anum] = (pt.y ?? 0) + (pt.y ?? 0) - ((this.item['y' + num] as number) ?? 0)

    const pts = [
      item.x ?? 0, item.y ?? 0,
      item.x1 ?? 0, item.y1 ?? 0,
      item.x2 ?? 0, item.y2 ?? 0
    ]

    replacePathSegMethod(seg.type, seg.index, pts)
    seg.update(true)
  }

  moveCtrl (num: number, dx: number, dy: number): void {
    const { item } = this
    const xKey = 'x' + num
    const yKey = 'y' + num
    const xVal = item[xKey]
    const yVal = item[yKey]
    if (typeof xVal === 'number') item[xKey] = xVal + dx
    if (typeof yVal === 'number') item[yKey] = yVal + dy

    const pts = [
      item.x ?? 0, item.y ?? 0,
      item.x1 ?? 0, item.y1 ?? 0, item.x2 ?? 0, item.y2 ?? 0
    ]

    replacePathSegMethod(this.type, this.index, pts)
    this.update(true)
  }

  /**
   * @param newType Possible values set during {@link module:path.init}
   */
  setType (newType: number, pts: number[]): void {
    replacePathSegMethod(newType, this.index, pts)
    this.type = newType
    const path = svgCanvas.getPathObj() as Path
    const data = getPathDataReadonly(path.elem)
    const cmd = data[this.index]
    if (cmd) { this.item = toPathSeg(cmd) }
    this.showCtrlPts(newType === 6)
    this.ctrlpts = getControlPointsMethod(this)
    this.update(true)
  }
}

/** Manages the full editing state of a single SVGPathElement, including segments, grips, and undo data. */
export class Path {
  elem: SVGPathElement
  segs: Segment[]
  selected_pts: number[]
  first_seg: Segment | null = null
  matrix: SVGMatrix | null = null
  imatrix: SVGMatrix | null = null
  oldbbox?: { x: number; y: number; width: number; height: number }
  dragging?: [number, number] | false
  cur_pt?: number
  dragctrl?: number | false
  last_d?: string | null

  /**
  * @throws {Error} If constructed without a path element
  */
  constructor (elem: SVGPathElement) {
    if (!elem || elem.tagName !== 'path') {
      throw new Error('svgedit.path.Path constructed without a <path> element')
    }

    this.elem = elem
    this.segs = []
    this.selected_pts = []
    svgCanvas.setPathObj(this)

    this.init()
  }

  setPathContext (): void {
    svgCanvas.setPathObj(this)
  }

  /**
  * Reset path data.
  */
  init (): this {
    // Hide all grips, etc

    // fixed, needed to work on all found elements, not just first
    const pointGripContainer = getGripContainerMethod()
    const elements = pointGripContainer.querySelectorAll('*')
    Array.prototype.forEach.call(elements, function (el: Element) {
      el.setAttribute('display', 'none')
    })

    const pathData = getPathDataReadonly(this.elem)
    const len = pathData.length
    this.segs = []
    this.selected_pts = []
    this.first_seg = null

    // Set up segs array
    for (let i = 0; i < len; i++) {
      const cmd = pathData[i]
      if (!cmd) continue
      const item = toPathSeg(cmd)
      const segment = new Segment(i, item)
      segment.path = this
      this.segs.push(segment)
    }

    const { segs } = this

    let startI: number | null = null
    for (let i = 0; i < len; i++) {
      const seg = segs[i]
      if (!seg) continue
      const nextSeg = (i + 1) >= len ? null : (segs[i + 1] ?? null)
      const prevSeg = (i - 1) < 0 ? null : (segs[i - 1] ?? null)
      if (seg.type === 2) {
        if (prevSeg && prevSeg.type !== 1) {
          // New sub-path, last one is open,
          // so add a grip to last sub-path's first point
          if (startI !== null && segs[startI] && segs[startI + 1]) {
            const startSeg = segs[startI] as Segment
            startSeg.next = segs[startI + 1] as Segment
            startSeg.next.prev = startSeg
            startSeg.addGrip()
          }
        }
        // Remember that this is a starter seg
        startI = i
      } else if (nextSeg?.type === 1) {
        // This is the last real segment of a closed sub-path
        // Next is first seg after "M"
        if (startI !== null && segs[startI + 1]) {
          seg.next = segs[startI + 1] as Segment

          // First seg after "M"'s prev is this
          seg.next.prev = seg
          if (startI !== null) {
            const mateSeg = segs[startI]
            if (mateSeg) seg.mate = mateSeg
          }
          seg.addGrip()
          if (!this.first_seg) {
            this.first_seg = seg
          }
        }
      } else if (!nextSeg) {
        if (seg.type !== 1) {
          // Last seg, doesn't close so add a grip
          // to last sub-path's first point
          if (startI !== null && segs[startI] && segs[startI + 1]) {
            const startSeg = segs[startI] as Segment
            startSeg.next = segs[startI + 1] as Segment
            startSeg.next.prev = startSeg
            startSeg.addGrip()
          }
          seg.addGrip()

          if (!this.first_seg) {
            // Open path, so set first as real first and add grip
            this.first_seg = startI !== null ? (segs[startI] ?? null) : null
          }
        }
      } else if (seg.type !== 1) {
        // Regular segment, so add grip and its "next"
        seg.addGrip()

        // Don't set its "next" if it's an "M"
        if (nextSeg && nextSeg.type !== 2) {
          seg.next = nextSeg
          seg.next.prev = seg
        }
      }
    }
    return this
  }

  eachSeg (fn: (this: Segment, i: number) => boolean | void): void {
    const len = this.segs.length
    for (let i = 0; i < len; i++) {
      const seg = this.segs[i]
      if (!seg) continue
      const ret = fn.call(seg, i)
      if (ret === false) { break }
    }
  }

  addSeg (index: number): void {
    // Adds a new segment
    const seg = this.segs[index]
    if (!seg?.prev) { return }

    const { prev } = seg
    let newEntry: SVGPathDataCommand | undefined
    let newX: number
    let newY: number
    switch (seg.item.pathSegType) {
      case 4: {
        newX = ((seg.item.x ?? 0) + (prev.item.x ?? 0)) / 2
        newY = ((seg.item.y ?? 0) + (prev.item.y ?? 0)) / 2
        newEntry = { type: 'L', values: [newX, newY] }
        break
      } case 6: { // make it a curved segment to preserve the shape (WRS)
      // https://en.wikipedia.org/wiki/De_Casteljau%27s_algorithm#Geometric_interpretation
        const p0x = ((prev.item.x ?? 0) + (seg.item.x1 ?? 0)) / 2
        const p1x = ((seg.item.x1 ?? 0) + (seg.item.x2 ?? 0)) / 2
        const p2x = ((seg.item.x2 ?? 0) + (seg.item.x ?? 0)) / 2
        const p01x = (p0x + p1x) / 2
        const p12x = (p1x + p2x) / 2
        newX = (p01x + p12x) / 2
        const p0y = ((prev.item.y ?? 0) + (seg.item.y1 ?? 0)) / 2
        const p1y = ((seg.item.y1 ?? 0) + (seg.item.y2 ?? 0)) / 2
        const p2y = ((seg.item.y2 ?? 0) + (seg.item.y ?? 0)) / 2
        const p01y = (p0y + p1y) / 2
        const p12y = (p1y + p2y) / 2
        newY = (p01y + p12y) / 2
        newEntry = { type: 'C', values: [p0x, p0y, p01x, p01y, newX, newY] }
        const pts = [seg.item.x ?? 0, seg.item.y ?? 0, p12x, p12y, p2x, p2y]
        replacePathSegMethod(seg.type, index, pts)
        break
      }
    }
    if (!newEntry) return
    const data = getPathData(this.elem)
    data.splice(index, 0, newEntry)
    setPathData(this.elem, data)
  }

  deleteSeg (index: number): void {
    const seg = this.segs[index]
    if (!seg) return

    seg.show(false)
    const { next } = seg
    if (seg.mate) {
      // Make the next point be the "M" point
      const pt = [next?.item.x ?? 0, next?.item.y ?? 0]
      if (next) replacePathSegMethod(2, next.index, pt)

      // Reposition last node
      replacePathSegMethod(4, seg.index, pt)

      const d1 = getPathData(this.elem)
      d1.splice(seg.mate.index, 1)
      setPathData(this.elem, d1)
    } else if (!seg.prev) {
      // First node of open path, make next point the M
      const pt = [next?.item.x ?? 0, next?.item.y ?? 0]
      if (seg.next) replacePathSegMethod(2, seg.next.index, pt)
      const d2 = getPathData(this.elem)
      d2.splice(index, 1)
      setPathData(this.elem, d2)
    } else {
      const d3 = getPathData(this.elem)
      d3.splice(index, 1)
      setPathData(this.elem, d3)
    }
  }

  removePtFromSelection (index: number): void {
    const pos = this.selected_pts.indexOf(index)
    if (pos === -1) {
      return
    }
    this.segs[index]?.select(false)
    this.selected_pts.splice(pos, 1)
  }

  clearSelection (): void {
    this.eachSeg(function () {
      // 'this' is the segment here
      this.select(false)
    })
    this.selected_pts = []
  }

  storeD (): void {
    this.last_d = this.elem.getAttribute('d')
  }

  show (y: boolean): this {
    // Shows this path's segment grips
    this.eachSeg(function () {
      // 'this' is the segment here
      this.show(y)
    })
    if (y && this.first_seg) {
      this.selectPt(this.first_seg.index)
    }
    return this
  }

  /**
  * Move selected points.
  */
  movePts (dx: number, dy: number): void {
    let i = this.selected_pts.length
    while (i--) {
      const seg = this.segs[this.selected_pts[i] ?? 0]
      seg?.move(dx, dy)
    }
  }

  moveCtrl (dx: number, dy: number): void {
    const seg = this.segs[this.selected_pts[0] ?? 0]
    seg?.moveCtrl(this.dragctrl as number, dx, dy)
    if (svgCanvas.getLinkControlPts()) {
      seg?.setLinked(this.dragctrl as number)
    }
  }

  /**
  * @param [newType] See {@link https://www.w3.org/TR/SVG/single-page.html#paths-InterfaceSVGPathSeg}
  */
  setSegType (newType?: number | null): void {
    this.storeD()
    let i = this.selected_pts.length
    let text: string | undefined
    while (i--) {
      const selPt = this.selected_pts[i] ?? 0

      // Selected seg
      const cur = this.segs[selPt]
      if (!cur) continue
      const { prev } = cur
      if (!prev) { continue }

      if (!newType) { // double-click, so just toggle
        text = 'Toggle Path Segment Type'

        // Toggle segment to curve/straight line
        const oldType = cur.type

        newType = (oldType === 6) ? 4 : 6
      }

      newType = Number(newType)

      const curX = cur.item.x ?? 0
      const curY = cur.item.y ?? 0
      const prevX = prev.item.x ?? 0
      const prevY = prev.item.y ?? 0
      let points: number[] | undefined
      switch (newType) {
        case 6: {
          if (cur.olditem) {
            const old = cur.olditem
            points = [curX, curY, old.x1 ?? 0, old.y1 ?? 0, old.x2 ?? 0, old.y2 ?? 0]
          } else {
            const diffX = curX - prevX
            const diffY = curY - prevY
            // create control points on the line to preserve the shape (WRS)
            const ct1x = (prevX + (diffX / 3))
            const ct1y = (prevY + (diffY / 3))
            const ct2x = (curX - (diffX / 3))
            const ct2y = (curY - (diffY / 3))
            points = [curX, curY, ct1x, ct1y, ct2x, ct2y]
          }
          break
        } case 4: {
          points = [curX, curY]

          // Store original segment nums
          cur.olditem = cur.item
          break
        }
      }

      if (points) cur.setType(newType, points)
    }
    const path = svgCanvas.getPathObj() as Path
    path.endChanges(text)
  }

  selectPt (pt?: number, ctrlNum?: number): void {
    this.clearSelection()
    if (pt === undefined || pt === null) {
      this.eachSeg(function (i) {
        // 'this' is the segment here.
        if (this.prev) {
          pt = i
        }
      })
    }
    if (pt !== undefined) this.addPtsToSelection(pt)
    if (ctrlNum) {
      this.dragctrl = ctrlNum

      if (svgCanvas.getLinkControlPts()) {
        if (pt !== undefined) this.segs[pt]?.setLinked(ctrlNum)
      }
    }
  }

  /**
  * Update position of all points.
  */
  update (): this {
    const { elem } = this
    // Apply the element's full transform (not just rotation) when positioning
    // grips. A pure-translate matrix(1 0 0 1 tx ty) — e.g. left on a child by
    // ungroupSelectedElement — must be honored too, else grips render at the
    // path's local coords, offset by the translate (#30).
    const m = getMatrix(elem)
    if (isIdentity(m)) {
      this.matrix = null
      this.imatrix = null
    } else {
      this.matrix = m
      this.imatrix = m.inverse()
    }

    const updateData = getPathDataReadonly(elem)
    this.eachSeg(function (i) {
      const cmd = updateData[i]
      if (cmd) { this.item = toPathSeg(cmd) }
      this.update()
    })

    return this
  }

  endChanges (text?: string): void {
    const cmd = new ChangeElementCommand(this.elem, { d: this.last_d ?? null }, text)
    svgCanvas.endChanges({ cmd, elem: this.elem })
  }

  addPtsToSelection (indexes: number | number[]): void {
    if (!Array.isArray(indexes)) { indexes = [indexes] }
    indexes.forEach((index) => {
      const seg = this.segs[index]
      if (seg?.ptgrip && !this.selected_pts.includes(index) && index >= 0) {
        this.selected_pts.push(index)
      }
    })
    this.selected_pts.sort((a, b) => a - b)
    let i = this.selected_pts.length
    const grips: (SVGCircleElement | null)[] = []
    grips.length = i
    // Loop through points to be selected and highlight each
    while (i--) {
      const pt = this.selected_pts[i] ?? 0
      const seg = this.segs[pt]
      seg?.select(true)
      grips[i] = seg?.ptgrip ?? null
    }

    const closedSubpath = this.subpathIsClosed(this.selected_pts[0] ?? 0)
    svgCanvas.addPtsToSelection({ grips: grips.filter((g): g is SVGCircleElement => g !== null), closedSubpath })
  }

  // Check if the subpath containing `index` is closed (a Z before the next M).
  // Instance method (#18): operate on `this` directly rather than re-fetching the
  // active path via svgCanvas.getPathObj() — the caller is always this same Path.
  subpathIsClosed (index: number): boolean {
    let clsd = false
    this.eachSeg(function (i) {
      if (i <= index) { return true }
      if (this.type === 2) {
        // Found M first, so open
        return false
      }
      if (this.type === 1) {
        // Found Z first, so closed
        clsd = true
        return false
      }
      return true
    })

    return clsd
  }
}
