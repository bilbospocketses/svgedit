/**
 * Path functionality.
 * @module path
 * @license MIT
 *
 * @copyright 2011 Alexis Deveria, 2011 Jeff Schiller
 */

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion */

import { NS } from './namespaces.js'
import { ChangeElementCommand } from './history.js'
import {
  transformPoint, getMatrix
} from './math.js'
import {
  assignAttributes, getRotationAngle,
  getElement
} from './utilities.js'

// Augment SVGPathElement with the pathSegList shim.
// getPathData and setPathData are already declared by path-data-polyfill/types.d.ts.
declare global {
  interface SVGPathElement {
    readonly pathSegList: PathDataListShim
  }
}

/** Seg object shape returned by PathDataListShim */
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

const TYPE_TO_CMD: Record<number, SVGPathDataCommand> = {
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

const CMD_TO_TYPE: Record<string, number> = Object.fromEntries(
  Object.entries(TYPE_TO_CMD).map(([k, v]) => [v, Number(k)])
)

export class PathDataListShim {
  private elem: SVGPathElement

  constructor (elem: SVGPathElement) {
    this.elem = elem
  }

  private _getData (): SVGPathSegment[] {
    return this.elem.getPathData()
  }

  private _setData (data: SVGPathSegment[]): void {
    this.elem.setPathData(data)
  }

  get numberOfItems (): number {
    return this._getData().length
  }

  private _entryToSeg (entry: { type: string; values: number[] }): PathSeg {
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

  private _segToEntry (seg: PathSeg): SVGPathSegment {
    const type: SVGPathDataCommand | undefined = TYPE_TO_CMD[seg.pathSegType] ?? (seg as unknown as { type?: SVGPathDataCommand }).type
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

  getItem (index: number): PathSeg | null {
    const data = this._getData()
    const entry = data[index]
    return entry ? this._entryToSeg(entry) : null
  }

  replaceItem (seg: PathSeg, index: number): PathSeg {
    const data = this._getData()
    data[index] = this._segToEntry(seg)
    this._setData(data)
    return seg
  }

  insertItemBefore (seg: PathSeg, index: number): PathSeg {
    const data = this._getData()
    data.splice(index, 0, this._segToEntry(seg))
    this._setData(data)
    return seg
  }

  appendItem (seg: PathSeg): PathSeg {
    const data = this._getData()
    data.push(this._segToEntry(seg))
    this._setData(data)
    return seg
  }

  removeItem (index: number): void {
    const data = this._getData()
    data.splice(index, 1)
    this._setData(data)
  }

  clear (): void {
    this._setData([])
  }
}

if (
  typeof SVGPathElement !== 'undefined' &&
  typeof SVGPathElement.prototype.getPathData === 'function' &&
  typeof SVGPathElement.prototype.setPathData === 'function' &&
  !('pathSegList' in SVGPathElement.prototype)
) {
  Object.defineProperty(SVGPathElement.prototype, 'pathSegList', {
    get (this: SVGPathElement): PathDataListShim {
      const self = this as SVGPathElement & { _pathSegListShim?: PathDataListShim }
      if (!self._pathSegListShim) {
        self._pathSegListShim = new PathDataListShim(this)
      }
      return self._pathSegListShim
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any = null

/**
* @function module:path-actions.init
* @param pathMethodsContext
*/
export const init = (canvas: unknown): void => {
  svgCanvas = canvas
}


/**
* @function module:path.ptObjToArr
* @todo See if this should just live in `replacePathSeg`
* @param type
* @param segItem
*/
export const ptObjToArrMethod = (type: number, segItem: PathSeg): number[] => {
  const segData = svgCanvas.getSegData() as Record<number, string[]>
  const props = segData[type] ?? []
  return props.map((prop) => {
    return (segItem[prop] as number) ?? 0
  })
}

/**
* @function module:path.getGripPt
* @param seg
* @param altPt
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
  const zoom = svgCanvas.getZoom() as number
  out.x *= zoom
  out.y *= zoom

  return out
}

/**
* @function module:path.getPointFromGrip
* @param pt
* @param pth
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
  const zoom = svgCanvas.getZoom() as number
  out.x /= zoom
  out.y /= zoom

  return out
}

/**
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
* @param index
* @param [x]
* @param [y]
*/
export const addPointGripMethod = (index: number, x?: number, y?: number): SVGCircleElement => {
  // create the container of all the point grips
  const pointGripContainer = getGripContainerMethod()

  let pointGrip = getElement(`pathpointgrip_${index}`) as SVGCircleElement | null
  // create it
  if (!pointGrip) {
    pointGrip = document.createElementNS(NS.SVG, 'circle') as SVGCircleElement
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
    const uiStrings = svgCanvas.getUIStrings() as Record<string, string>
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
* @param id
*/
export const addCtrlGripMethod = (id: string): SVGCircleElement => {
  let pointGrip = getElement('ctrlpointgrip_' + id) as SVGCircleElement | null
  if (pointGrip) { return pointGrip }

  pointGrip = document.createElementNS(NS.SVG, 'circle') as SVGCircleElement
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
  const uiStrings = svgCanvas.getUIStrings() as Record<string, string>
  if ('pathCtrlPtTooltip' in uiStrings) { // May be empty if running path.js without svg-editor
    atts['xlink:title'] = uiStrings.pathCtrlPtTooltip
  }
  assignAttributes(pointGrip, atts)
  getGripContainerMethod().append(pointGrip)
  return pointGrip
}

/**
* @function module:path.getCtrlLine
* @param id
*/
export const getCtrlLineMethod = (id: string): SVGLineElement => {
  let ctrlLine = getElement('ctrlLine_' + id) as SVGLineElement | null
  if (ctrlLine) { return ctrlLine }

  ctrlLine = document.createElementNS(NS.SVG, 'line') as SVGLineElement
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
* @function module:path.getPointGrip
* @param seg
* @param [update]
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
* @function module:path.getControlPoints
* @param seg
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

    const pt = getGripPtMethod(seg, { x: (item as PathSeg)['x' + i] as number ?? 0, y: (item as PathSeg)['y' + i] as number ?? 0 })
    const gpt = getGripPtMethod(seg, { x: (segItems[i - 1] as PathSeg | undefined)?.x ?? 0, y: (segItems[i - 1] as PathSeg | undefined)?.y ?? 0 })

    assignAttributes(ctrlLine, {
      x1: pt.x,
      y1: pt.y,
      x2: gpt.x,
      y2: gpt.y,
      display: 'inline'
    })

    cpt[`c${i}_line`] = ctrlLine

    // create it
    const pointGrip = addCtrlGripMethod(id)
    cpt[`c${i}`] = pointGrip

    assignAttributes(pointGrip, {
      cx: pt.x,
      cy: pt.y,
      display: 'inline'
    })
    cpt['c' + i] = pointGrip
  }
  return cpt
}

/**
* This replaces the segment at the given index. Type is given as number.
* @function module:path.replacePathSeg
* @param type Possible values set during {@link module:path.init}
* @param index
* @param pts
* @param [elem]
*/
export const replacePathSegMethod = (type: number, index: number, pts: number[], elem?: SVGPathElement | SVGElement | null): void => {
  const path = svgCanvas.getPathObj() as Path | null
  const pth = (elem as SVGPathElement | null | undefined) ?? path?.elem
  if (!pth) return
  const pathFuncs = svgCanvas.getPathFuncs() as (string | number)[]
  const func = 'createSVGPathSeg' + pathFuncs[type]
  const segData = svgCanvas.getSegData?.() as Record<number, string[]> | undefined
  const props = segData?.[type] ?? segData?.[type - 1]
  if (props && pts.length < props.length) {
    const currentSeg = (pth as SVGPathElement).pathSegList?.getItem?.(index)
    if (currentSeg) {
      pts = props.map((prop, i) => (pts[i] !== undefined ? (pts[i] as number) : ((currentSeg[prop] as number) ?? 0)))
    }
  }
  let seg: PathSeg
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (pth as any)[func] === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seg = (pth as any)[func](...pts) as PathSeg
  } else {
    const safeProps = props ?? []
    seg = { pathSegType: type, pathSegTypeAsLetter: '' }
    safeProps.forEach((prop, i) => {
      seg[prop] = pts[i]
    })
  }

  ;(pth as SVGPathElement).pathSegList.replaceItem(seg, index)
}

/**
* @function module:path.getSegSelector
* @param seg
* @param [update]
*/
export const getSegSelectorMethod = (seg: Segment, update?: boolean): SVGPathElement => {
  const { index } = seg
  let segLine = getElement(`segline_${index}`) as SVGPathElement | null
  if (!segLine) {
    const pointGripContainer = getGripContainerMethod()
    // create segline
    segLine = document.createElementNS(NS.SVG, 'path') as SVGPathElement
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

/**
*
*/
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  olditem?: any

  /**
  * @param index
  * @param item
  */
  constructor (index: number, item: PathSeg) {
    this.selected = false
    this.index = index
    this.item = item
    this.type = item.pathSegType

    this.ctrlpts = null
    this.ptgrip = null
    this.segsel = null
  }

  /**
   * @param y
   */
  showCtrlPts (y: boolean): void {
    for (const i in this.ctrlpts) {
      if ({}.hasOwnProperty.call(this.ctrlpts, i)) {
        this.ctrlpts[i]?.setAttribute('display', y ? 'inline' : 'none')
      }
    }
  }

  /**
   * @param y
   */
  selectCtrls (y: boolean): void {
    document.getElementById(`ctrlpointgrip_${this.index}c1`)?.setAttribute('fill', y ? '#0FF' : '#EEE')
    document.getElementById(`ctrlpointgrip_${this.index}c2`)?.setAttribute('fill', y ? '#0FF' : '#EEE')
  }

  /**
   * @param y
   */
  show (y: boolean): void {
    if (this.ptgrip) {
      this.ptgrip.setAttribute('display', y ? 'inline' : 'none')
      this.segsel?.setAttribute('display', y ? 'inline' : 'none')
      // Show/hide all control points if available
      this.showCtrlPts(y)
    }
  }

  /**
   * @param y
   */
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

  /**
   */
  addGrip (): void {
    this.ptgrip = getPointGripMethod(this, true)
    this.ctrlpts = getControlPointsMethod(this) // , true);
    this.segsel = getSegSelectorMethod(this, true)
  }

  /**
   * @param [full]
   */
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
          this.item = path.elem.pathSegList.getItem(this.index) ?? this.item
          this.type = this.item.pathSegType
        }
        getControlPointsMethod(this)
      }
      // this.segsel.setAttribute('display', y ? 'inline' : 'none');
    }
  }

  /**
   * @param dx
   * @param dy
   */
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

  /**
   * @param num
   */
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

  /**
   * @param num
   * @param dx
   * @param dy
   */
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
   * @param pts
   */
  setType (newType: number, pts: number[]): void {
    replacePathSegMethod(newType, this.index, pts)
    this.type = newType
    const path = svgCanvas.getPathObj() as Path
    this.item = path.elem.pathSegList.getItem(this.index) ?? this.item
    this.showCtrlPts(newType === 6)
    this.ctrlpts = getControlPointsMethod(this)
    this.update(true)
  }
}

/**
*
*/
export class Path {
  elem: SVGPathElement
  segs: Segment[]
  selected_pts: number[]
  first_seg: Segment | null = null
  matrix: SVGMatrix | null = null
  imatrix: SVGMatrix | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldbbox?: any
  dragging?: [number, number] | false
  cur_pt?: number
  dragctrl?: number | false
  last_d?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any

  /**
  * @param elem
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

    const segList = this.elem.pathSegList
    const len = segList.numberOfItems
    this.segs = []
    this.selected_pts = []
    this.first_seg = null

    // Set up segs array
    for (let i = 0; i < len; i++) {
      const item = segList.getItem(i)
      if (!item) continue
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

  /**
  * @param fn
  */
  eachSeg (fn: (this: Segment, i: number) => boolean | void): void {
    const len = this.segs.length
    for (let i = 0; i < len; i++) {
      const seg = this.segs[i]
      if (!seg) continue
      const ret = fn.call(seg, i)
      if (ret === false) { break }
    }
  }

  /**
  * @param index
  */
  addSeg (index: number): void {
    // Adds a new segment
    const seg = this.segs[index]
    if (!seg?.prev) { return }

    const { prev } = seg
    let newEntry: SVGPathSegment | undefined
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
    const data = this.elem.getPathData()
    data.splice(index, 0, newEntry)
    this.elem.setPathData(data)
  }

  /**
  * @param index
  */
  deleteSeg (index: number): void {
    const seg = this.segs[index]
    if (!seg) return
    const list = this.elem.pathSegList

    seg.show(false)
    const { next } = seg
    if (seg.mate) {
      // Make the next point be the "M" point
      const pt = [next?.item.x ?? 0, next?.item.y ?? 0]
      if (next) replacePathSegMethod(2, next.index, pt)

      // Reposition last node
      replacePathSegMethod(4, seg.index, pt)

      list.removeItem(seg.mate.index)
    } else if (!seg.prev) {
      // First node of open path, make next point the M
      const pt = [next?.item.x ?? 0, next?.item.y ?? 0]
      if (seg.next) replacePathSegMethod(2, seg.next.index, pt)
      list.removeItem(index)
    } else {
      list.removeItem(index)
    }
  }

  /**
  * @param index
  */
  removePtFromSelection (index: number): void {
    const pos = this.selected_pts.indexOf(index)
    if (pos === -1) {
      return
    }
    this.segs[index]?.select(false)
    this.selected_pts.splice(pos, 1)
  }

  /**
  */
  clearSelection (): void {
    this.eachSeg(function () {
      // 'this' is the segment here
      this.select(false)
    })
    this.selected_pts = []
  }

  /**
  */
  storeD (): void {
    this.last_d = this.elem.getAttribute('d')
  }

  /**
  * @param y
  */
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
  * @param dx
  * @param dy
  */
  movePts (dx: number, dy: number): void {
    let i = this.selected_pts.length
    while (i--) {
      const seg = this.segs[this.selected_pts[i] ?? 0]
      seg?.move(dx, dy)
    }
  }

  /**
  * @param dx
  * @param dy
  */
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
            const old = cur.olditem as PathSeg
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

  /**
  * @param [pt]
  * @param [ctrlNum]
  */
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
    if (getRotationAngle(elem)) {
      this.matrix = getMatrix(elem)
      this.imatrix = this.matrix.inverse()
    } else {
      this.matrix = null
      this.imatrix = null
    }

    this.eachSeg(function (i) {
      this.item = elem.pathSegList.getItem(i) ?? this.item
      this.update()
    })

    return this
  }

  /**
  * @param [text]
  */
  endChanges (text?: string): void {
    const cmd = new ChangeElementCommand(this.elem, { d: this.last_d ?? null }, text)
    svgCanvas.endChanges({ cmd, elem: this.elem })
  }

  /**
  * @param indexes
  */
  addPtsToSelection (indexes: number | number[]): void {
    if (!Array.isArray(indexes)) { indexes = [indexes] }
    indexes.forEach((index) => {
      const seg = this.segs[index]
      if (seg?.ptgrip && !this.selected_pts.includes(index) && index >= 0) {
        this.selected_pts.push(index)
      }
    })
    this.selected_pts.sort()
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

    const closedSubpath = Path.subpathIsClosed(this.selected_pts[0] ?? 0)
    svgCanvas.addPtsToSelection({ grips, closedSubpath })
  }

  // STATIC
  /**
  * @param index
  */
  static subpathIsClosed (index: number): boolean {
    let clsd = false
    // Check if subpath is already open
    const path = svgCanvas.getPathObj() as Path
    path.eachSeg(function (i) {
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
