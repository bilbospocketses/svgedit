/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- path module uses nullable path data/segs; ISvgCanvas any-typed API */
/**
 * Path functionality.
 * @module path
 * @license MIT
 *
 */

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
import { Path, toPathSeg, SEG_TYPE } from './path-method.js'
import { getPathData, getPathDataReadonly, setPathData } from './path-data.js'
import type { SVGPathDataCommand } from './path-data.js'

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas
let path = null as unknown as Path

/**
* Initialize path-actions module with the canvas context and register keyboard shortcuts.
* @function module:path-actions.init
*/
export const init = (canvas: ISvgCanvas): void => {
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
 * @param pth - the path to convert
 * @param toRel - true of convert to relative
 */
export const convertPath = (pth: SVGPathElement, toRel: boolean): string => {
  const pathData = getPathDataReadonly(pth)
  const len = pathData.length
  let curx = 0; let cury = 0
  let d = ''
  let lastM: [number, number] | null = null

  for (let i = 0; i < len; ++i) {
    const cmd = pathData[i]
    if (!cmd) continue
    const seg = toPathSeg(cmd)
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
      case 'H': // absolute horizontal line (H)
        x -= curx
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
        d += pathDSegment(letter, [[x, y]])
        break
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
        d += pathDSegment(letter, [[x, y]])
        break
      case 'V': // absolute vertical line (V)
        y -= cury
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
        d += pathDSegment(letter, [[x, y]])
        break
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
        d += pathDSegment(letter, [[x, y]])
        break
      case 'M': // absolute move (M)
      case 'L': // absolute line (L)
      case 'T': // absolute smooth quad (T)
        x -= curx
        y -= cury
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
      case 'C': // absolute cubic (C)
        x -= curx; x1 -= curx; x2 -= curx
        y -= cury; y1 -= cury; y2 -= cury
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
      case 'Q': // absolute quad (Q)
        x -= curx; x1 -= curx
        y -= cury; y1 -= cury
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
      case 'A': // absolute elliptical arc (A)
        x -= curx
        y -= cury
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
      case 'S': // absolute smooth cubic (S)
        x -= curx; x2 -= curx
        y -= cury; y2 -= cury
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
  #currentPath: Element | false | null = false
  #hasMoved = false

  /**
  * This function converts a polyline (created by the fh_path tool) into
  * a path element and coverts every three line segments into a single bezier
  * curve in an attempt to smooth out the free-hand.
  * @function smoothPolylineIntoPath
  * @param element
  * @private
  */
  #smoothPolylineIntoPath = (element: SVGPolylineElement | Element): Element => {
    let el = element
    const { points } = el as SVGPolylineElement
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
            prevArr[2] = String(newpts[0]!.x)
            prevArr[3] = String(newpts[0]!.y)
            d[d.length - 1] = prevArr.join(',')
            ct1 = newpts[1]!
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

      el = svgCanvas.addSVGElementsFromJson({
        element: 'path',
        curStyles: true,
        attr: {
          id: svgCanvas.getId(),
          d: dStr,
          fill: 'none'
        }
      })
    }
    return el
  }

  mouseDown (evt: MouseEvent, _mouseTarget: Element, startX: number, startY: number): boolean | undefined {
    let id: string
    if (svgCanvas.getCurrentMode() === 'path') {
      let mouseX = startX
      let mouseY = startY

      const zoom = svgCanvas.getZoom()
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
        stretchy = document.createElementNS(NS.SVG, 'path')
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
      const drawnPath = svgCanvas.getDrawnPath()
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
        }) as SVGPathElement)
        stretchy.setAttribute('d', `M${mouseX} ${mouseY} ${mouseX} ${mouseY}`)
        index = this.#subpath ? path.segs.length : 0
        svgCanvas.addPointGrip(index, mouseX, mouseY)
      } else {
        const drawnData = getPathDataReadonly(drawnPath)
        let i = drawnData.length
        const FUZZ = 6 / zoom
        let clickOnPoint = false
        while (i) {
          i--
          const item = drawnData[i] ? toPathSeg(drawnData[i]!) : null
          if (!item) continue
          const px = item.x ?? 0; const py = item.y ?? 0
          if (x >= (px - FUZZ) && x <= (px + FUZZ) &&
              y >= (py - FUZZ) && y <= (py + FUZZ)
          ) {
            clickOnPoint = true
            break
          }
        }

        id = svgCanvas.getId()

        svgCanvas.removePath_(id)

        const newpath = getElement(id)
        let sSeg: PathSeg | null
        const len = drawnData.length
        if (clickOnPoint) {
          if (i <= 1 && len >= 2) {
            const firstCmd = drawnData[0] ? toPathSeg(drawnData[0]) : null
            const absX = firstCmd?.x ?? 0
            const absY = firstCmd?.y ?? 0

            const stretchyData = getPathDataReadonly(stretchy)
            sSeg = stretchyData[1] ? toPathSeg(stretchyData[1]) : null
            const newEntry: SVGPathDataCommand = sSeg?.pathSegType === SEG_TYPE.LINETO
              ? { type: 'L', values: [absX, absY] }
              : { type: 'C', values: [(sSeg?.x1 ?? 0) / zoom, (sSeg?.y1 ?? 0) / zoom, absX, absY, absX, absY] }

            const data = getPathData(drawnPath)
            data.push(newEntry, { type: 'Z', values: [] })
            setPathData(drawnPath, data)
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

          const drawnData2 = getPathDataReadonly(drawnPath)
          const num = drawnData2.length
          const lastCmd = drawnData2[num - 1] ? toPathSeg(drawnData2[num - 1]!) : null
          const lastx = lastCmd?.x ?? 0; const lasty = lastCmd?.y ?? 0

          if (evt.shiftKey) {
            const xya = snapToAngle(lastx, lasty, x, y);
            ({ x, y } = xya)
          }

          const stretchyData2 = getPathDataReadonly(stretchy)
          sSeg = stretchyData2[1] ? toPathSeg(stretchyData2[1]) : null
          const rx = svgCanvas.round(x)
          const ry = svgCanvas.round(y)
          const nextEntry: SVGPathDataCommand = sSeg?.pathSegType === SEG_TYPE.LINETO
            ? { type: 'L', values: [rx, ry] }
            : { type: 'C', values: [(sSeg?.x1 ?? 0) / zoom, (sSeg?.y1 ?? 0) / zoom, (sSeg?.x2 ?? 0) / zoom, (sSeg?.y2 ?? 0) / zoom, rx, ry] }
          const data = getPathData(drawnPath)
          data.push(nextEntry)
          setPathData(drawnPath, data)

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
    const PATHPOINTGRIP_PREFIX = 'pathpointgrip_'
    if (id.startsWith(PATHPOINTGRIP_PREFIX)) {
      curPt = path.cur_pt = Number.parseInt(id.slice(PATHPOINTGRIP_PREFIX.length))
      path.dragging = [startX, startY]
      const seg = path.segs[curPt]!

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
      const zoom = svgCanvas.getZoom()
      assignAttributes(rubberBox!, {
        x: startX * zoom,
        y: startY * zoom,
        width: 0,
        height: 0,
        display: 'inline'
      }, 100)
    }
    return undefined
  }

  mouseMove (mouseX: number, mouseY: number): void {
    const zoom = svgCanvas.getZoom()
    this.#hasMoved = true
    const drawnPath = svgCanvas.getDrawnPath()
    if (svgCanvas.getCurrentMode() === 'path') {
      if (!drawnPath) { return }
      const drawnMoveData = getPathDataReadonly(drawnPath)
      const index = drawnMoveData.length - 1

      if (this.#newPoint) {
        const pointGrip1 = svgCanvas.addCtrlGrip('1c1')
        const pointGrip2 = svgCanvas.addCtrlGrip('0c2')

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

        const ctrlLine = svgCanvas.getCtrlLine('1')
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
          const last = drawnMoveData[index - 1] ? toPathSeg(drawnMoveData[index - 1]!) : null
          let lastX = last?.x ?? 0
          let lastY = last?.y ?? 0

          if (last?.pathSegType === SEG_TYPE.CUBICBEZIER) {
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
          const prevCmd = drawnMoveData[index] ? toPathSeg(drawnMoveData[index]) : null
          if (prevCmd?.pathSegType === SEG_TYPE.CUBICBEZIER) {
            const prevX = (prevCmd.x ?? 0) + ((prevCmd.x ?? 0) - (prevCmd.x2 ?? 0))
            const prevY = (prevCmd.y ?? 0) + ((prevCmd.y ?? 0) - (prevCmd.y2 ?? 0))
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
      // The rubber-band box is invariant across segments, so fetch + measure it
      // once per move rather than re-fetching/re-measuring it inside the loop
      // (a redundant reflow per segment — audit #29 perf #58).
      const rubberBox = svgCanvas.getRubberBox()
      const rbb = rubberBox ? getBBox(rubberBox) : null
      if (rbb) {
        path.eachSeg(function (this: Segment, _i: number) {
          const seg = this // eslint-disable-line @typescript-eslint/no-this-alias -- eachSeg callback binds `this` to the segment
          if (!seg.next && !seg.prev) return

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
  }

  mouseUp (evt: MouseEvent, element: Element, _mouseX: number, _mouseY: number): { keep: boolean; element: Element } | undefined {
    const drawnPath = svgCanvas.getDrawnPath()
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
      rubberBox!.setAttribute('display', 'none')

      if (Number(rubberBox!.getAttribute('width')) <= 2 && Number(rubberBox!.getAttribute('height')) <= 2) {
        pathActionsMethod.toSelectMode(evt.target as Element)
      }
    } else {
      pathActionsMethod.toSelectMode(evt.target as Element)
    }
    this.#hasMoved = false
    return undefined
  }

  toEditMode (element: Element): void {
    path = svgCanvas.getPath_(element as SVGPathElement)
    svgCanvas.setCurrentMode('pathedit')
    svgCanvas.clearSelection()
    path.setPathContext()
    path.show(true).update()
    const bbox = getBBox(path.elem)
    if (bbox) { path.oldbbox = bbox }
    this.#subpath = false
  }

  /**
    * @param [elem]
    * @fires module:svgcanvas.SvgCanvas#event:selected
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

  addSubPath (on: boolean): void {
    if (on) {
      svgCanvas.setCurrentMode('path')
      this.#subpath = true
    } else {
      pathActionsMethod.clear(true)
      pathActionsMethod.toEditMode(path.elem)
    }
  }

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
    */
  reorient (): void {
    const elem = svgCanvas.getSelectedElements()[0] as Element | null
    if (!elem) { return }
    if (elem.nodeName !== 'path') { return }
    const angl = getRotationAngle(elem)
    if (angl === 0) { return }

    const batchCmd = new BatchCommand('Reorient path')
    const changes = {
      d: (elem).getAttribute('d'),
      transform: (elem).getAttribute('transform')
    }
    batchCmd.addSubCommand(new ChangeElementCommand(elem, changes))
    svgCanvas.clearSelection()
    this.resetOrientation(elem as SVGPathElement)

    svgCanvas.addCommandToHistory(batchCmd)

    svgCanvas.getPath_(elem as SVGPathElement).show(false).matrix = null

    this.clear()

    svgCanvas.addToSelection([elem], true)
    svgCanvas.call('changed', svgCanvas.getSelectedElements())
  }

  /**
    * @param [_remove] Not in use
    */
  clear (_remove?: boolean): void {
    const drawnPath = svgCanvas.getDrawnPath()
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
    const resetData = getPathDataReadonly(pth)
    const len = resetData.length
    for (let i = 0; i < len; ++i) {
      const cmd = resetData[i]
      if (!cmd) continue
      const seg = toPathSeg(cmd)
      const type = seg.pathSegType
      if (type === SEG_TYPE.CLOSEPATH) { continue }
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

  zoomChange (): void {
    if (svgCanvas.getCurrentMode() === 'pathedit') {
      path.update()
    }
  }

  getNodePoint (): { x: number; y: number; type: number } {
    const selPt = path.selected_pts.length ? (path.selected_pts[0] ?? 1) : 1

    const seg = path.segs[selPt]!
    return {
      x: seg.item.x ?? 0,
      y: seg.item.y ?? 0,
      type: seg.type
    }
  }

  /**
    * @param linkPoints
    */
  linkControlPoints (linkPoints: boolean): void {
    svgCanvas.setLinkControlPoints(linkPoints)
  }

  clonePathNode (): void {
    path.storeD()

    const selPts = path.selected_pts

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

  opencloseSubPath (): void {
    const selPts = path.selected_pts
    if (selPts.length !== 1) { return }

    const { elem } = path

    const index = selPts[0] ?? 0

    let openPt: number | false | null = null
    let startItem: PathSeg | null = null

    path.eachSeg(function (this: Segment, i: number) {
      if (this.type === SEG_TYPE.MOVETO && i <= index) {
        startItem = this.item
      }
      if (i <= index) return true
      if (this.type === SEG_TYPE.MOVETO) {
        openPt = i
        return false
      }
      if (this.type === SEG_TYPE.CLOSEPATH) {
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
      const data = getPathData(elem)
      const si = startItem as PathSeg | null
      const lineEntry: SVGPathDataCommand = { type: 'L', values: [si?.x ?? 0, si?.y ?? 0] }
      const closeEntry: SVGPathDataCommand = { type: 'Z', values: [] }
      if (openPtNum === path.segs.length - 1) {
        data.push(lineEntry, closeEntry)
      } else {
        data.splice(openPtNum, 0, lineEntry, closeEntry)
      }
      setPathData(elem, data)

      path.init().selectPt(openPtNum + 1)
      return
    }

    const seg = path.segs[index]!

    if (seg.mate) {
      const mateData = getPathData(elem)
      mateData.splice(index, 2)
      setPathData(elem, mateData)
      path.init().selectPt(index - 1)
      return
    }

    let lastM: number | undefined; let zSeg: number | undefined

    let ocData = getPathData(elem)
    for (let i = 0; i < ocData.length; i++) {
      const cmd = ocData[i]
      if (!cmd) continue
      const item = toPathSeg(cmd)

      if (item.pathSegType === SEG_TYPE.MOVETO) {
        lastM = i
      } else if (i === index) {
        if (lastM !== undefined) {
          ocData.splice(lastM, 1)
          setPathData(elem, ocData)
          ocData = getPathData(elem)
          // Adjust indices after removal
          i--
        }
      } else if (item.pathSegType === SEG_TYPE.CLOSEPATH && index < i) {
        zSeg = i - 1
        ocData.splice(i, 1)
        setPathData(elem, ocData)
        break
      }
    }

    if (lastM === undefined) return

    let num = (index - lastM) - 1

    ocData = getPathData(elem)
    while (num--) {
      const moveCmd = ocData[lastM]
      if (moveCmd) {
        ocData.splice(zSeg!, 0, { ...moveCmd })
      }
    }
    setPathData(elem, ocData)

    ocData = getPathData(elem)
    const ptCmd = ocData[lastM] ? toPathSeg(ocData[lastM]!) : null

    svgCanvas.replacePathSeg(2, lastM, [ptCmd?.x ?? 0, ptCmd?.y ?? 0])

    path.init().selectPt(0)
  }

  deletePathNode (): void {
    if (!pathActionsMethod.canDeleteNodes) { return }
    path.storeD()

    const selPts = path.selected_pts

    let i = selPts.length
    while (i--) {
      const pt = selPts[i] ?? 0
      path.deleteSeg(pt)
    }

    const cleanup = (): boolean => {
      // Read the path data once per cleanup pass. The loop only mutates cleanData
      // via remItems, which is always immediately followed by a recursive cleanup()
      // + break, so re-reading the full path data on every iteration was redundant
      // (O(n) clones per pass — audit #29 perf #60).
      const cleanData = getPathData(path.elem)
      let len = cleanData.length

      const remItems = (pos: number, count: number): void => {
        cleanData.splice(pos, count)
        setPathData(path.elem, cleanData)
      }

      if (len <= 1) { return true }

      while (len--) {
        const cmd = cleanData[len]
        if (!cmd) continue
        const item = toPathSeg(cmd)
        if (item.pathSegType === SEG_TYPE.CLOSEPATH) {
          const prevCmd = cleanData[len - 1]
          const nprevCmd = cleanData[len - 2]
          const prev = prevCmd ? toPathSeg(prevCmd) : null
          const nprev = nprevCmd ? toPathSeg(nprevCmd) : null
          if (prev?.pathSegType === SEG_TYPE.MOVETO) {
            remItems(len - 1, 2)
            cleanup()
            break
          } else if (nprev?.pathSegType === SEG_TYPE.MOVETO) {
            remItems(len - 2, 3)
            cleanup()
            break
          }
        } else if (item.pathSegType === SEG_TYPE.MOVETO && len > 0) {
          const prevCmd2 = cleanData[len - 1]
          const prevType = prevCmd2 ? toPathSeg(prevCmd2).pathSegType : undefined
          if (prevType === SEG_TYPE.MOVETO) {
            remItems(len - 1, 1)
            cleanup()
            break
          } else if (prevType === SEG_TYPE.CLOSEPATH && cleanData.length - 1 === len) {
            remItems(len, 1)
            cleanup()
            break
          }
        }
      }
      return false
    }

    cleanup()

    if (getPathDataReadonly(path.elem).length <= 1) {
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
  smoothPolylineIntoPath (element: SVGPolylineElement | Element): Element {
    return this.#smoothPolylineIntoPath(element)
  }


  /**
  * @param [v] See {@link https://www.w3.org/TR/SVG/single-page.html#paths-InterfaceSVGPathSeg}
  */
  setSegType (v?: number | null): void {
    path?.setSegType(v)
  }

  moveNode (attr: string, newValue: number): void {
    const selPts = path.selected_pts
    if (!selPts.length) { return }

    path.storeD()

    const seg = path.segs[selPts[0] ?? 0]!
    const diff: Record<string, number> = { x: 0, y: 0 }
    diff[attr] = newValue - ((seg.item[attr] as number) ?? 0)

    seg.move(diff.x ?? 0, diff.y ?? 0)
    path.endChanges('Move path point')
  }

  fixEnd (elem: SVGPathElement): void {
    const fixData = getPathData(elem)
    const len = fixData.length
    let lastM: PathSeg | null = null
    for (let i = 0; i < len; ++i) {
      const cmd = fixData[i]
      if (!cmd) continue
      const item = toPathSeg(cmd)
      if (item.pathSegType === SEG_TYPE.MOVETO) {
        lastM = item
      }

      if (item.pathSegType === SEG_TYPE.CLOSEPATH) {
        const prevCmd = fixData[i - 1]
        const prev = prevCmd ? toPathSeg(prevCmd) : null
        if (prev && lastM && (prev.x !== lastM.x || prev.y !== lastM.y)) {
          fixData.splice(i, 0, { type: 'L', values: [lastM.x ?? 0, lastM.y ?? 0] })
          setPathData(elem, fixData)
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
   */
  finishPath (): void {
    const drawnPath = svgCanvas.getDrawnPath()
    if (!drawnPath) return
    if (getPathDataReadonly(drawnPath).length < 2) return
    const stretchy = getElement('path_stretch_line')
    if (stretchy) stretchy.remove()
    svgCanvas.setDrawnPath(null)
    svgCanvas.setStarted(false)
    this.toEditMode(drawnPath)
  }

  /**
   * Discard the in-progress path drawing entirely.
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

/** Singleton PathActions instance exported for backward compatibility. */
export const pathActionsMethod: PathActions = new PathActions()
// end pathActions
