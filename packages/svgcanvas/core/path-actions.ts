/**
 * Path functionality.
 * @module path
 * @license MIT
 *
 * @copyright 2011 Alexis Deveria, 2011 Jeff Schiller
 */

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion */

import { NS } from './namespaces.js'
import { shortFloat } from './units.js'
import { ChangeElementCommand, BatchCommand } from './history.js'
import {
  transformPoint, snapToAngle, rectsIntersect,
  transformListToTransform, getTransformList
} from './math.js'
import {
  assignAttributes, getElement, getRotationAngle, snapToGrid,
  getBBox
} from './utilities.js'
import type { PathSeg, Segment } from './path-method.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let path: any = null

/**
* @function module:path-actions.init
* @param {module:path-actions.svgCanvas} pathActionsContext
* @returns {void}
*/
export const init = (canvas: unknown): void => {
  svgCanvas = canvas
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (svgCanvas.getCurrentMode() !== 'path') return
    if (!svgCanvas.getDrawnPath()) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.key === 'Enter') {
      e.preventDefault()
      pathActionsMethod.finishPath()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      pathActionsMethod.cancelPath()
    }
  })
}

/**
 * Convert a path to one with only absolute or relative values.
 * @todo move to pathActions.js
 * @function module:path.convertPath
 * @param {SVGPathElement} pth - the path to convert
 * @param {boolean} toRel - true of convert to relative
 * @returns {string}
 */
export const convertPath = (pth: SVGPathElement, toRel: boolean): string => {
  const { pathSegList } = pth
  const len = pathSegList.numberOfItems
  let curx = 0; let cury = 0
  let d = ''
  let lastM: [number, number] | null = null

  for (let i = 0; i < len; ++i) {
    const seg = pathSegList.getItem(i)
    if (!seg) continue
    // if these properties are not in the segment, set them to zero
    let x = seg.x ?? 0
    let y = seg.y ?? 0
    let x1 = seg.x1 ?? 0
    let y1 = seg.y1 ?? 0
    let x2 = seg.x2 ?? 0
    let y2 = seg.y2 ?? 0

    let letter = seg.pathSegTypeAsLetter

    switch (letter) {
      case 'z': // z,Z closepath (Z/z)
      case 'Z':
        d += 'z'
        if (lastM) {
          curx = lastM[0]
          cury = lastM[1]
        }
        break
      // @ts-expect-error: intentional fallthrough — H adjusts x then shares h path
      case 'H': // absolute horizontal line (H)
        x -= curx
      // Fallthrough
      case 'h': // relative horizontal line (h)
        if (toRel) {
          y = 0
          curx += x
          letter = 'l'
        } else {
          y = cury
          x += curx
          curx = x
          letter = 'L'
        }
        // Convert to "line" for easier editing
        d += pathDSegment(letter, [[x, y]])
        break
      // @ts-expect-error: intentional fallthrough — V adjusts y then shares v path
      case 'V': // absolute vertical line (V)
        y -= cury
      // Fallthrough
      case 'v': // relative vertical line (v)
        if (toRel) {
          x = 0
          cury += y
          letter = 'l'
        } else {
          x = curx
          y += cury
          cury = y
          letter = 'L'
        }
        // Convert to "line" for easier editing
        d += pathDSegment(letter, [[x, y]])
        break
      case 'M': // absolute move (M)
      case 'L': // absolute line (L)
      // @ts-expect-error: intentional fallthrough — T (and M, L above) adjust coords then share l/m/t path
      case 'T': // absolute smooth quad (T)
        x -= curx
        y -= cury
      // Fallthrough
      case 'l': // relative line (l)
      case 'm': // relative move (m)
      case 't': // relative smooth quad (t)
        if (toRel) {
          curx += x
          cury += y
          letter = letter.toLowerCase()
        } else {
          x += curx
          y += cury
          curx = x
          cury = y
          letter = letter.toUpperCase()
        }
        if (letter === 'm' || letter === 'M') { lastM = [curx, cury] }

        d += pathDSegment(letter, [[x, y]])
        break
      // @ts-expect-error: intentional fallthrough — C adjusts coords then shares c path
      case 'C': // absolute cubic (C)
        x -= curx; x1 -= curx; x2 -= curx
        y -= cury; y1 -= cury; y2 -= cury
      // Fallthrough
      case 'c': // relative cubic (c)
        if (toRel) {
          curx += x
          cury += y
          letter = 'c'
        } else {
          x += curx; x1 += curx; x2 += curx
          y += cury; y1 += cury; y2 += cury
          curx = x
          cury = y
          letter = 'C'
        }
        d += pathDSegment(letter, [[x1, y1], [x2, y2], [x, y]])
        break
      // @ts-expect-error: intentional fallthrough — Q adjusts coords then shares q path
      case 'Q': // absolute quad (Q)
        x -= curx; x1 -= curx
        y -= cury; y1 -= cury
      // Fallthrough
      case 'q': // relative quad (q)
        if (toRel) {
          curx += x
          cury += y
          letter = 'q'
        } else {
          x += curx; x1 += curx
          y += cury; y1 += cury
          curx = x
          cury = y
          letter = 'Q'
        }
        d += pathDSegment(letter, [[x1, y1], [x, y]])
        break
      // @ts-expect-error: intentional fallthrough — A adjusts coords then shares a path
      case 'A':
        x -= curx
        y -= cury
      // fallthrough
      case 'a': // relative elliptical arc (a)
        if (toRel) {
          curx += x
          cury += y
          letter = 'a'
        } else {
          x += curx
          y += cury
          curx = x
          cury = y
          letter = 'A'
        }
        d += pathDSegment(letter, [[seg.r1 ?? 0, seg.r2 ?? 0]], [
          seg.angle ?? 0,
          (seg.largeArcFlag ? 1 : 0),
          (seg.sweepFlag ? 1 : 0)
        ], [x, y])
        break
      // @ts-expect-error: intentional fallthrough — S adjusts coords then shares s path
      case 'S': // absolute smooth cubic (S)
        x -= curx; x2 -= curx
        y -= cury; y2 -= cury
      // Fallthrough
      case 's': // relative smooth cubic (s)
        if (toRel) {
          curx += x
          cury += y
          letter = 's'
        } else {
          x += curx; x2 += curx
          y += cury; y2 += cury
          curx = x
          cury = y
          letter = 'S'
        }
        d += pathDSegment(letter, [[x2, y2], [x, y]])
        break
    } // switch on path segment type
  } // for each segment
  return d
}

/**
 * TODO: refactor callers in `convertPath` to use `getPathDFromSegments` instead of this function.
 * Legacy code refactored from `svgcanvas.pathActions.convertPath`.
 * @param {string} letter - path segment command
 * @param {number[][]} points - x,y points
 * @param {number[]} [morePoints] - additional numeric params
 * @param {number[]} [lastPoint] - x,y point
 * @returns {string}
 */
const pathDSegment = (letter: string, points: number[][], morePoints?: number[], lastPoint?: number[]): string => {
  const parts: string[] = [
    letter + points.map(pnt => shortFloat(pnt as [number, number])).join(' '),
    morePoints ? morePoints.join(' ') : null,
    lastPoint ? shortFloat(lastPoint as [number, number]) : null
  ].filter((p): p is string => p !== null)
  return parts.join(' ')
}

/**
* Group: Path edit functions.
* Functions relating to editing path elements.
* @class PathActions
* @memberof module:path
*/
class PathActions {
  #subpath = false
  #newPoint: [number, number] | null = null
  #firstCtrl: [number, number] | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #currentPath: any = false
  #hasMoved = false

  /**
  * This function converts a polyline (created by the fh_path tool) into
  * a path element and coverts every three line segments into a single bezier
  * curve in an attempt to smooth out the free-hand.
  * @function smoothPolylineIntoPath
  * @param {unknown} element
  * @returns {unknown}
  * @private
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #smoothPolylineIntoPath = (element: any): any => {
    const { points } = element
    const N = points.numberOfItems
    if (N >= 4) {
      let curpos = points.getItem(0)
      let prevCtlPt: { x: number; y: number } | null = null
      const d: string[] = []
      d.push(`M${curpos.x},${curpos.y} C`)
      let i: number
      for (i = 1; i <= (N - 4); i += 3) {
        let ct1 = points.getItem(i)
        const ct2 = points.getItem(i + 1)
        const end = points.getItem(i + 2)

        if (prevCtlPt) {
          const newpts = svgCanvas.smoothControlPoints(prevCtlPt, ct1, curpos)
          if (newpts?.length === 2) {
            const prevArr = (d[d.length - 1] ?? '').split(',')
            prevArr[2] = newpts[0].x
            prevArr[3] = newpts[0].y
            d[d.length - 1] = prevArr.join(',')
            ct1 = newpts[1]
          }
        }

        d.push([ct1.x, ct1.y, ct2.x, ct2.y, end.x, end.y].join(','))

        curpos = end
        prevCtlPt = ct2
      }
      d.push('L')
      while (i < N) {
        const pt = points.getItem(i)
        d.push([pt.x, pt.y].join(','))
        i++
      }
      const dStr = d.join(' ')

      element = svgCanvas.addSVGElementsFromJson({
        element: 'path',
        curStyles: true,
        attr: {
          id: svgCanvas.getId(),
          d: dStr,
          fill: 'none'
        }
      })
    }
    return element
  }

  /**
  * @param {MouseEvent} evt
  * @param {Element} mouseTarget
  * @param {number} startX
  * @param {number} startY
  * @returns {boolean|undefined}
  */
   
  mouseDown (evt: MouseEvent, _mouseTarget: Element, startX: number, startY: number): boolean | undefined {
    let id: string
    if (svgCanvas.getCurrentMode() === 'path') {
      let mouseX = startX
      let mouseY = startY

      const zoom = svgCanvas.getZoom() as number
      let x = mouseX / zoom
      let y = mouseY / zoom
      let stretchy = getElement('path_stretch_line') as SVGPathElement | null
      this.#newPoint = [x, y]

      if (svgCanvas.getGridSnapping()) {
        x = snapToGrid(x)
        y = snapToGrid(y)
        mouseX = snapToGrid(mouseX)
        mouseY = snapToGrid(mouseY)
      }

      if (!stretchy) {
        stretchy = document.createElementNS(NS.SVG, 'path') as SVGPathElement
        assignAttributes(stretchy, {
          id: 'path_stretch_line',
          stroke: '#22C',
          'stroke-width': '0.5',
          fill: 'none'
        })
        getElement('selectorParentGroup')?.append(stretchy)
      }
      stretchy.setAttribute('display', 'inline')

      let keep: boolean | null = null
      let index: number
      const drawnPath = svgCanvas.getDrawnPath() as SVGPathElement | null
      if (!drawnPath) {
        const dAttr = `M${x},${y} `
        /* drawnPath = */ svgCanvas.setDrawnPath(svgCanvas.addSVGElementsFromJson({
          element: 'path',
          curStyles: true,
          attr: {
            d: dAttr,
            id: svgCanvas.getNextId(),
            opacity: svgCanvas.getOpacity() / 2
          }
        }))
        stretchy.setAttribute('d', `M${mouseX} ${mouseY} ${mouseX} ${mouseY}`)
        index = this.#subpath ? path.segs.length : 0
        svgCanvas.addPointGrip(index, mouseX, mouseY)
      } else {
        const seglist = drawnPath.pathSegList
        let i = seglist.numberOfItems
        const FUZZ = 6 / zoom
        let clickOnPoint = false
        while (i) {
          i--
          const item = seglist.getItem(i)
          if (!item) continue
          const px = item.x ?? 0; const py = item.y ?? 0
          if (x >= (px - FUZZ) && x <= (px + FUZZ) &&
              y >= (py - FUZZ) && y <= (py + FUZZ)
          ) {
            clickOnPoint = true
            break
          }
        }

        id = svgCanvas.getId() as string

        svgCanvas.removePath_(id)

        const newpath = getElement(id)
        let sSeg: PathSeg | null
        const len = seglist.numberOfItems
        if (clickOnPoint) {
          if (i <= 1 && len >= 2) {
            const absX = seglist.getItem(0)?.x ?? 0
            const absY = seglist.getItem(0)?.y ?? 0

            sSeg = stretchy.pathSegList.getItem(1)
            const newEntry = sSeg?.pathSegType === 4
              ? { type: 'L', values: [absX, absY] }
              : { type: 'C', values: [(sSeg?.x1 ?? 0) / zoom, (sSeg?.y1 ?? 0) / zoom, absX, absY, absX, absY] }

            const data = drawnPath.getPathData()
            // TODO(post-migration #10): SVGPathSegment type unification — internal {type, values}
            // shape doesn't match path-data-polyfill's SVGPathDataCommand union. See todo #10 backlog.
            data.push(newEntry as SVGPathSegment, { type: 'Z' as const, values: [] })
            drawnPath.setPathData(data)
          } else if (len < 3) {
            keep = false
            return keep
          }
          stretchy.remove()

          /* drawnPath = */ svgCanvas.setDrawnPath(null)
          svgCanvas.setStarted(false)

          if (this.#subpath) {
            if (newpath && path.matrix) {
              svgCanvas.remapElement(newpath, {}, path.matrix.inverse())
            }

            const newD = newpath?.getAttribute('d') ?? ''
            const origD = path.elem.getAttribute('d') ?? ''
            path.elem.setAttribute('d', origD + newD)
            newpath?.parentNode?.removeChild(newpath)
            if (path.matrix) {
              svgCanvas.recalcRotatedPath()
            }
            pathActionsMethod.toEditMode(path.elem)
            path.selectPt()
            return false
          }
        } else {
          if (!(svgCanvas.getContainer() !== svgCanvas.getMouseTarget(evt) && svgCanvas.getContainer().contains(
            svgCanvas.getMouseTarget(evt)
          ))) {
            return false
          }

          const num = drawnPath.pathSegList.numberOfItems
          const last = drawnPath.pathSegList.getItem(num - 1)
          const lastx = last?.x ?? 0; const lasty = last?.y ?? 0

          if (evt.shiftKey) {
            const xya = snapToAngle(lastx, lasty, x, y);
            ({ x, y } = xya)
          }

          sSeg = stretchy.pathSegList.getItem(1)
          const rx = svgCanvas.round(x) as number
          const ry = svgCanvas.round(y) as number
          const nextEntry = sSeg?.pathSegType === 4
            ? { type: 'L', values: [rx, ry] }
            : { type: 'C', values: [(sSeg?.x1 ?? 0) / zoom, (sSeg?.y1 ?? 0) / zoom, (sSeg?.x2 ?? 0) / zoom, (sSeg?.y2 ?? 0) / zoom, rx, ry] }
          const data = drawnPath.getPathData()
          // TODO(post-migration #10): SVGPathSegment type unification — internal {type, values}
          // shape doesn't match path-data-polyfill's SVGPathDataCommand union. See todo #10 backlog.
          data.push(nextEntry as SVGPathSegment)
          drawnPath.setPathData(data)

          x *= zoom
          y *= zoom

          stretchy.setAttribute('d', ['M', x, y, x, y].join(' '))
          index = num
          if (this.#subpath) { index += path.segs.length }
          svgCanvas.addPointGrip(index, x, y)
        }
      }

      return undefined
    }

    if (!path) { return undefined }

    path.storeD();

    ({ id } = evt.target as Element & { id: string })
    let curPt: number
    if (id.startsWith('pathpointgrip_')) {
      curPt = path.cur_pt = Number.parseInt(id.slice(14))
      path.dragging = [startX, startY]
      const seg = path.segs[curPt]

      if (!evt.shiftKey) {
        if (path.selected_pts.length <= 1 || !seg.selected) {
          path.clearSelection()
        }
        path.addPtsToSelection(curPt)
      } else if (seg.selected) {
        path.removePtFromSelection(curPt)
      } else {
        path.addPtsToSelection(curPt)
      }
    } else if (id.startsWith('ctrlpointgrip_')) {
      path.dragging = [startX, startY]

      const parts = (id.split('_')[1] ?? '').split('c')
      curPt = Number(parts[0] ?? '0')
      const ctrlNum = Number(parts[1] ?? '0')
      path.selectPt(curPt, ctrlNum)
    }

    if (!path.dragging) {
      let rubberBox = svgCanvas.getRubberBox()
      if (!rubberBox) {
        rubberBox = svgCanvas.setRubberBox(
          svgCanvas.selectorManager.getRubberBandBox()
        )
      }
      const zoom = svgCanvas.getZoom() as number
      assignAttributes(rubberBox, {
        x: startX * zoom,
        y: startY * zoom,
        width: 0,
        height: 0,
        display: 'inline'
      }, 100)
    }
    return undefined
  }

  /**
    * @param {number} mouseX
    * @param {number} mouseY
    * @returns {void}
    */
  mouseMove (mouseX: number, mouseY: number): void {
    const zoom = svgCanvas.getZoom() as number
    this.#hasMoved = true
    const drawnPath = svgCanvas.getDrawnPath() as SVGPathElement | null
    if (svgCanvas.getCurrentMode() === 'path') {
      if (!drawnPath) { return }
      const seglist = drawnPath.pathSegList
      const index = seglist.numberOfItems - 1

      if (this.#newPoint) {
        const pointGrip1 = svgCanvas.addCtrlGrip('1c1') as SVGCircleElement
        const pointGrip2 = svgCanvas.addCtrlGrip('0c2') as SVGCircleElement

        pointGrip1.setAttribute('cx', String(mouseX))
        pointGrip1.setAttribute('cy', String(mouseY))
        pointGrip1.setAttribute('display', 'inline')

        const ptX = this.#newPoint[0]
        const ptY = this.#newPoint[1]

        const curX = mouseX / zoom
        const curY = mouseY / zoom
        const altX = (ptX + (ptX - curX))
        const altY = (ptY + (ptY - curY))

        pointGrip2.setAttribute('cx', String(altX * zoom))
        pointGrip2.setAttribute('cy', String(altY * zoom))
        pointGrip2.setAttribute('display', 'inline')

        const ctrlLine = svgCanvas.getCtrlLine(1) as SVGLineElement
        assignAttributes(ctrlLine, {
          x1: mouseX,
          y1: mouseY,
          x2: altX * zoom,
          y2: altY * zoom,
          display: 'inline'
        })

        if (index === 0) {
          this.#firstCtrl = [mouseX, mouseY]
        } else {
          const last = seglist.getItem(index - 1)
          let lastX = last?.x ?? 0
          let lastY = last?.y ?? 0

          if (last?.pathSegType === 6) {
            lastX += (lastX - (last?.x2 ?? 0))
            lastY += (lastY - (last?.y2 ?? 0))
          } else if (this.#firstCtrl) {
            lastX = this.#firstCtrl[0] / zoom
            lastY = this.#firstCtrl[1] / zoom
          }
          svgCanvas.replacePathSeg(6, index, [ptX, ptY, lastX, lastY, altX, altY], drawnPath)
        }
      } else {
        const stretchy = getElement('path_stretch_line') as SVGPathElement | null
        if (stretchy) {
          const prev = seglist.getItem(index)
          if (prev?.pathSegType === 6) {
            const prevX = (prev.x ?? 0) + ((prev.x ?? 0) - (prev.x2 ?? 0))
            const prevY = (prev.y ?? 0) + ((prev.y ?? 0) - (prev.y2 ?? 0))
            svgCanvas.replacePathSeg(
              6,
              1,
              [mouseX, mouseY, prevX * zoom, prevY * zoom, mouseX, mouseY],
              stretchy
            )
          } else if (this.#firstCtrl) {
            svgCanvas.replacePathSeg(6, 1, [mouseX, mouseY, this.#firstCtrl[0], this.#firstCtrl[1], mouseX, mouseY], stretchy)
          } else {
            svgCanvas.replacePathSeg(4, 1, [mouseX, mouseY], stretchy)
          }
        }
      }
      return
    }
    if (path.dragging) {
      const pt = svgCanvas.getPointFromGrip({
        x: path.dragging[0],
        y: path.dragging[1]
      }, path)
      const mpt = svgCanvas.getPointFromGrip({
        x: mouseX,
        y: mouseY
      }, path)
      const diffX = mpt.x - pt.x
      const diffY = mpt.y - pt.y
      path.dragging = [mouseX, mouseY]

      if (path.dragctrl) {
        path.moveCtrl(diffX, diffY)
      } else {
        path.movePts(diffX, diffY)
      }
    } else {
      path.selected_pts = []
      path.eachSeg(function (this: Segment, _i: number) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const seg = this
        if (!seg.next && !seg.prev) return

        const rubberBox = svgCanvas.getRubberBox()
        const rbb = getBBox(rubberBox)
        if (!rbb) return

        const pt = svgCanvas.getGripPt(seg)
        const ptBb = {
          x: pt.x,
          y: pt.y,
          width: 0,
          height: 0
        }

        const sel = rectsIntersect(rbb, ptBb)

        seg.select(sel)
        if (sel) { path.selected_pts.push(seg.index) }
      })
    }
  }

  /**
    * @param {MouseEvent} evt
    * @param {Element} element
    * @param {number} _mouseX
    * @param {number} _mouseY
    * @returns {{ keep: boolean; element: Element } | undefined}
    */
  mouseUp (evt: MouseEvent, element: Element, _mouseX: number, _mouseY: number): { keep: boolean; element: Element } | undefined {
    const drawnPath = svgCanvas.getDrawnPath() as SVGPathElement | null
    if (svgCanvas.getCurrentMode() === 'path') {
      this.#newPoint = null
      if (!drawnPath) {
        element = getElement(svgCanvas.getId()) as Element
        svgCanvas.setStarted(false)
        this.#firstCtrl = null
      }

      return {
        keep: true,
        element
      }
    }

    const rubberBox = svgCanvas.getRubberBox()
    if (path.dragging) {
      const lastPt = path.cur_pt as number

      path.dragging = false
      path.dragctrl = false
      path.update()

      if (this.#hasMoved) {
        path.endChanges('Move path point(s)')
      }

      if (!evt.shiftKey && !this.#hasMoved) {
        path.selectPt(lastPt)
      }
    } else if (rubberBox?.getAttribute('display') !== 'none') {
      rubberBox.setAttribute('display', 'none')

      if (Number(rubberBox.getAttribute('width')) <= 2 && Number(rubberBox.getAttribute('height')) <= 2) {
        pathActionsMethod.toSelectMode(evt.target as Element)
      }
    } else {
      pathActionsMethod.toSelectMode(evt.target as Element)
    }
    this.#hasMoved = false
    return undefined
  }

  /**
    * @param {Element} element
    * @returns {void}
    */
  toEditMode (element: Element): void {
    path = svgCanvas.getPath_(element)
    svgCanvas.setCurrentMode('pathedit')
    svgCanvas.clearSelection()
    path.setPathContext()
    path.show(true).update()
    path.oldbbox = getBBox(path.elem)
    this.#subpath = false
  }

  /**
    * @param {Element} [elem]
    * @fires module:svgcanvas.SvgCanvas#event:selected
    * @returns {void}
    */
  toSelectMode (elem?: Element): void {
    const selPath = (elem === path.elem)
    svgCanvas.setCurrentMode('select')
    path.setPathContext()
    path.show(false)
    this.#currentPath = false
    svgCanvas.clearSelection()

    if (path.matrix) {
      svgCanvas.recalcRotatedPath()
    }

    if (selPath) {
      svgCanvas.call('selected', [elem])
      svgCanvas.addToSelection([elem], true)
    }
  }

  /**
    * @param {boolean} on
    * @returns {void}
    */
  addSubPath (on: boolean): void {
    if (on) {
      svgCanvas.setCurrentMode('path')
      this.#subpath = true
    } else {
      pathActionsMethod.clear(true)
      pathActionsMethod.toEditMode(path.elem)
    }
  }

  /**
    * @param {Element} target
    * @returns {void}
    */
  select (target: Element): void {
    if (this.#currentPath === target) {
      pathActionsMethod.toEditMode(target)
      svgCanvas.setCurrentMode('pathedit')
    } else {
      this.#currentPath = target
    }
  }

  /**
    * @fires module:svgcanvas.SvgCanvas#event:changed
    * @returns {void}
    */
  reorient (): void {
    const elem = svgCanvas.getSelectedElements()[0] as Element | null
    if (!elem) { return }
    if (elem.nodeName !== 'path') { return }
    const angl = getRotationAngle(elem as SVGElement)
    if (angl === 0) { return }

    const batchCmd = new BatchCommand('Reorient path')
    const changes = {
      d: (elem as Element).getAttribute('d'),
      transform: (elem as Element).getAttribute('transform')
    }
    batchCmd.addSubCommand(new ChangeElementCommand(elem, changes))
    svgCanvas.clearSelection()
    this.resetOrientation(elem as SVGPathElement)

    svgCanvas.addCommandToHistory(batchCmd)

    svgCanvas.getPath_(elem).show(false).matrix = null

    this.clear()

    svgCanvas.addToSelection([elem], true)
    svgCanvas.call('changed', svgCanvas.getSelectedElements())
  }

  /**
    * @param {boolean} [_remove] Not in use
    * @returns {void}
    */
  clear (_remove?: boolean): void {
    const drawnPath = svgCanvas.getDrawnPath() as SVGPathElement | null
    this.#currentPath = null
    if (drawnPath) {
      const elem = getElement(svgCanvas.getId())
      const psl = getElement('path_stretch_line')
      psl?.parentNode?.removeChild(psl)
      elem?.parentNode?.removeChild(elem)
      const pathpointgripContainer = getElement('pathpointgrip_container')
      if (pathpointgripContainer) {
        const elements = pathpointgripContainer.querySelectorAll('*')
        for (const el of elements) {
          el.setAttribute('display', 'none')
        }
      }
      this.#firstCtrl = null
      svgCanvas.setDrawnPath(null)
      svgCanvas.setStarted(false)
    } else if (svgCanvas.getCurrentMode() === 'pathedit') {
      this.toSelectMode()
    }
    if (path) { path.init().show(false) }
  }

  /**
    * @param {SVGPathElement | null | undefined} [pth]
    * @returns {false|undefined}
    */
  resetOrientation (pth?: SVGPathElement | null): false | undefined {
    if (pth?.nodeName !== 'path') { return false }
    const tlist = getTransformList(pth)
    if (!tlist) {
      pth.removeAttribute('transform')
      return undefined
    }
    const m = transformListToTransform(tlist).matrix
    tlist.clear()
    pth.removeAttribute('transform')
    const segList = pth.pathSegList
    const len = segList.numberOfItems
    for (let i = 0; i < len; ++i) {
      const seg = segList.getItem(i)
      if (!seg) continue
      const type = seg.pathSegType
      if (type === 1) { continue }
      const pts: number[] = []
      for (const n of ['', '1', '2'] as const) {
        const x = seg['x' + n] as number | undefined
        const y = seg['y' + n] as number | undefined
        if (x !== undefined && y !== undefined) {
          const pt = transformPoint(x, y, m)
          pts.push(pt.x, pt.y)
        }
      }
      svgCanvas.replacePathSeg(type, i, pts, pth)
    }

    svgCanvas.reorientGrads(pth, m)
    return undefined
  }

  /**
    * @returns {void}
    */
  zoomChange (): void {
    if (svgCanvas.getCurrentMode() === 'pathedit') {
      path.update()
    }
  }

  /**
    * @returns {{ x: number; y: number; type: number }}
    */
  getNodePoint (): { x: number; y: number; type: number } {
    const selPt = path.selected_pts.length ? path.selected_pts[0] : 1

    const seg = path.segs[selPt]
    return {
      x: seg.item.x ?? 0,
      y: seg.item.y ?? 0,
      type: seg.type
    }
  }

  /**
    * @param {boolean} linkPoints
    * @returns {void}
    */
  linkControlPoints (linkPoints: boolean): void {
    svgCanvas.setLinkControlPoints(linkPoints)
  }

  /**
    * @returns {void}
    */
  clonePathNode (): void {
    path.storeD()

    const selPts = path.selected_pts as number[]

    let i = selPts.length
    const nums: number[] = []

    while (i--) {
      const pt = selPts[i] ?? 0
      path.addSeg(pt)

      nums.push(pt + i)
      nums.push(pt + i + 1)
    }
    path.init().addPtsToSelection(nums)

    path.endChanges('Clone path node(s)')
  }

  /**
    * @returns {void}
    */
  opencloseSubPath (): void {
    const selPts = path.selected_pts as number[]
    if (selPts.length !== 1) { return }

    const { elem } = path
    const list = elem.pathSegList

    const index = selPts[0] ?? 0

    let openPt: number | false | null = null
    let startItem: PathSeg | null = null

    path.eachSeg(function (this: Segment, i: number) {
      if (this.type === 2 && i <= index) {
        startItem = this.item
      }
      if (i <= index) return true
      if (this.type === 2) {
        openPt = i
        return false
      }
      if (this.type === 1) {
        openPt = false
        return false
      }
      return true
    })

    // openPt === false means the path is closed; other values mean the close index
    const resolvedOpenPt: number | false = openPt === false
      ? false
      : (openPt === null || openPt === 0 ? path.segs.length - 1 : openPt)

    if (resolvedOpenPt !== false) {
      const openPtNum: number = resolvedOpenPt
      const data = elem.getPathData() as Array<{ type: string; values: number[] }>
      const si = startItem as PathSeg | null
      const lineEntry = { type: 'L', values: [si?.x ?? 0, si?.y ?? 0] }
      const closeEntry = { type: 'Z', values: [] }
      if (openPtNum === path.segs.length - 1) {
        data.push(lineEntry, closeEntry)
      } else {
        data.splice(openPtNum, 0, lineEntry, closeEntry)
      }
      elem.setPathData(data)

      path.init().selectPt(openPtNum + 1)
      return
    }

    const seg = path.segs[index]

    if (seg.mate) {
      list.removeItem(index)
      list.removeItem(index)
      path.init().selectPt(index - 1)
      return
    }

    let lastM: number | undefined; let zSeg: number | undefined

    for (let i = 0; i < list.numberOfItems; i++) {
      const item = list.getItem(i) as PathSeg | null
      if (!item) continue

      if (item.pathSegType === 2) {
        lastM = i
      } else if (i === index) {
        if (lastM !== undefined) list.removeItem(lastM)
      } else if (item.pathSegType === 1 && index < i) {
        zSeg = i - 1
        list.removeItem(i)
        break
      }
    }

    if (lastM === undefined) return

    let num = (index - lastM) - 1

    while (num--) {
      list.insertItemBefore(list.getItem(lastM), zSeg)
    }

    const pt = list.getItem(lastM) as PathSeg | null

    svgCanvas.replacePathSeg(2, lastM, [pt?.x ?? 0, pt?.y ?? 0])

    path.init().selectPt(0)
  }

  /**
    * @returns {void}
    */
  deletePathNode (): void {
    if (!pathActionsMethod.canDeleteNodes) { return }
    path.storeD()

    const selPts = path.selected_pts as number[]

    let i = selPts.length
    while (i--) {
      const pt = selPts[i] ?? 0
      path.deleteSeg(pt)
    }

    const cleanup = (): boolean => {
      const segList = path.elem.pathSegList
      let len = segList.numberOfItems as number

      const remItems = (pos: number, count: number): void => {
        while (count--) {
          segList.removeItem(pos)
        }
      }

      if (len <= 1) { return true }

      while (len--) {
        const item = segList.getItem(len) as PathSeg | null
        if (!item) continue
        if (item.pathSegType === 1) {
          const prev = segList.getItem(len - 1) as PathSeg | null
          const nprev = segList.getItem(len - 2) as PathSeg | null
          if (prev?.pathSegType === 2) {
            remItems(len - 1, 2)
            cleanup()
            break
          } else if (nprev?.pathSegType === 2) {
            remItems(len - 2, 3)
            cleanup()
            break
          }
        } else if (item.pathSegType === 2 && len > 0) {
          const prevType = (segList.getItem(len - 1) as PathSeg | null)?.pathSegType
          if (prevType === 2) {
            remItems(len - 1, 1)
            cleanup()
            break
          } else if (prevType === 1 && segList.numberOfItems - 1 === len) {
            remItems(len, 1)
            cleanup()
            break
          }
        }
      }
      return false
    }

    cleanup()

    if (path.elem.pathSegList.numberOfItems <= 1) {
      pathActionsMethod.toSelectMode(path.elem)
      svgCanvas.canvas.deleteSelectedElements()
      return
    }

    path.init()
    path.clearSelection()

    path.endChanges('Delete path node(s)')
  }

  /**
  * Smooth polyline into path.
  * @function module:path.pathActions.smoothPolylineIntoPath
  * @see module:path~smoothPolylineIntoPath
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  smoothPolylineIntoPath (element: any): any {
    return this.#smoothPolylineIntoPath(element)
  }


  /**
  * @param {number | null | undefined} [v] See {@link https://www.w3.org/TR/SVG/single-page.html#paths-InterfaceSVGPathSeg}
  * @returns {void}
  */
  setSegType (v?: number | null): void {
    path?.setSegType(v)
  }

  /**
  * @param {string} attr
  * @param {number} newValue
  * @returns {void}
  */
  moveNode (attr: string, newValue: number): void {
    const selPts = path.selected_pts as number[]
    if (!selPts.length) { return }

    path.storeD()

    const seg = path.segs[selPts[0] ?? 0]
    const diff: Record<string, number> = { x: 0, y: 0 }
    diff[attr] = newValue - ((seg.item[attr] as number) ?? 0)

    seg.move(diff.x ?? 0, diff.y ?? 0)
    path.endChanges('Move path point')
  }

  /**
  * @param {SVGPathElement} elem
  * @returns {void}
  */
  fixEnd (elem: SVGPathElement): void {
    const segList = elem.pathSegList
    const len = segList.numberOfItems
    let lastM: PathSeg | null = null
    for (let i = 0; i < len; ++i) {
      const item = segList.getItem(i)
      if (!item) continue
      if (item.pathSegType === 2) {
        lastM = item
      }

      if (item.pathSegType === 1) {
        const prev = segList.getItem(i - 1)
        if (prev && lastM && (prev.x !== lastM.x || prev.y !== lastM.y)) {
          const data = elem.getPathData()
          data.splice(i, 0, { type: 'L', values: [lastM.x ?? 0, lastM.y ?? 0] })
          elem.setPathData(data)
          pathActionsMethod.fixEnd(elem)
          break
        }
      }
    }
  }

  /**
  * Convert a path to one with only absolute or relative values.
  * @function module:path.pathActions.convertPath
  * @see module:path.convertPath
  */
  convertPath (pth: SVGPathElement, toRel: boolean): string {
    return convertPath(pth, toRel)
  }

  /**
   * Complete the in-progress path open (NOT closed). Requires the drawn
   * path to have at least 2 segments; no-op otherwise.
   * @returns {void}
   */
  finishPath (): void {
    const drawnPath = svgCanvas.getDrawnPath() as SVGPathElement | null
    if (!drawnPath) return
    if (drawnPath.pathSegList.numberOfItems < 2) return
    const stretchy = getElement('path_stretch_line')
    if (stretchy) stretchy.remove()
    svgCanvas.setDrawnPath(null)
    svgCanvas.setStarted(false)
    this.toEditMode(drawnPath)
  }

  /**
   * Discard the in-progress path drawing entirely.
   * @returns {void}
   */
  cancelPath (): void {
    if (!svgCanvas.getDrawnPath()) return
    this.clear()
  }

  /** Whether there are nodes selected that can be deleted. */
  get canDeleteNodes (): boolean {
    return path?.selected_pts?.length > 0
  }
}

// Export singleton instance for backward compatibility
export const pathActionsMethod: PathActions = new PathActions()
// end pathActions
