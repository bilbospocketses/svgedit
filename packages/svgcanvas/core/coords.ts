/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
/**
 * Manipulating coordinates.
 * @module coords
 * @license MIT
 */

import { warn } from '../common/logger.js'

import {
  snapToGrid,
  assignAttributes,
  getBBox,
  getRefElem,
  findDefs
} from './utilities.js'
import {
  transformPoint,
  transformListToTransform,
  matrixMultiply,
  transformBox,
  getTransformList
} from './math.js'
import { convertToNum } from './units.js'

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas: ISvgCanvas | null = null

/** A path segment entry with type + optional coordinate fields. */
interface PathSegEntry {
  type: number
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  r1?: number
  r2?: number
  angle?: number
  largeArcFlag?: number | boolean
  sweepFlag?: number | boolean
}

/** The changes dict used in remapElement. */
interface RemapChanges {
  x?: number
  y?: number
  width?: number
  height?: number
  cx?: number
  cy?: number
  rx?: number
  ry?: number
  r?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  points?: Array<{ x: number; y: number }>
  d?: PathSegEntry[]
  'font-size'?: number
  [key: string]: unknown
}

const flipBoxCoordinate = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (!str) return null

  if (str.endsWith('%')) {
    const num = Number.parseFloat(str.slice(0, -1))
    return Number.isNaN(num) ? str : `${100 - num}%`
  }

  const num = Number.parseFloat(str)
  return Number.isNaN(num) ? str : String(1 - num)
}

const flipAttributeInBoxUnits = (elem: Element, attr: string): void => {
  const value = elem.getAttribute(attr)
  if (value === null || value === undefined) return

  const flipped = flipBoxCoordinate(value)
  if (flipped !== null && flipped !== undefined) {
    elem.setAttribute(attr, flipped)
  }
}

/**
 * Initialize the coords module with the SVG canvas.
 */
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
}

// Map path segment types to their corresponding commands
const pathMap: Array<number | string> = [
  0, 'z', 'M', 'm', 'L', 'l', 'C', 'c', 'Q', 'q', 'A', 'a', 'H', 'h', 'V', 'v', 'S', 's', 'T', 't'
]

/**
 * Applies coordinate changes to an element based on the given matrix.
 */
export const remapElement = (selected: Element, changes: RemapChanges, m: SVGMatrix): void => {
  const remap = (x: number, y: number) => transformPoint(x, y, m)
  const scalew = (w: number): number => m.a * w
  const scaleh = (h: number): number => m.d * h
  const doSnapping: boolean =
    Boolean(svgCanvas.getGridSnapping?.()) &&
    (selected?.parentNode as Element | null)?.parentNode instanceof Element &&
    (selected?.parentNode?.parentNode as Element | null)?.localName === 'svg'

  const finishUp = (): void => {
    if (doSnapping) {
      for (const [attr, value] of Object.entries(changes)) {
        if (typeof value === 'number') {
          changes[attr] = snapToGrid(value)
        }
      }
    }
    assignAttributes(selected, changes as Record<string, string | number>, 1000, true)
  }

  const box = getBBox(selected)

  // Handle gradients and patterns
  ;['fill', 'stroke'].forEach(type => {
    const attrVal = selected.getAttribute(type)
    if (attrVal?.startsWith('url(') && (m.a < 0 || m.d < 0)) {
      const grad = getRefElem(attrVal)
      if (!grad) return

      const tagName = (grad.tagName || '').toLowerCase()
      if (!['lineargradient', 'radialgradient'].includes(tagName)) return

      // userSpaceOnUse gradients do not need object-bounding-box correction.
      if (grad.getAttribute('gradientUnits') === 'userSpaceOnUse') return

      const newgrad = grad.cloneNode(true) as Element
      if (m.a < 0) {
        // Flip x
        if (tagName === 'lineargradient') {
          flipAttributeInBoxUnits(newgrad, 'x1')
          flipAttributeInBoxUnits(newgrad, 'x2')
        } else {
          flipAttributeInBoxUnits(newgrad, 'cx')
          flipAttributeInBoxUnits(newgrad, 'fx')
        }
      }

      if (m.d < 0) {
        // Flip y
        if (tagName === 'lineargradient') {
          flipAttributeInBoxUnits(newgrad, 'y1')
          flipAttributeInBoxUnits(newgrad, 'y2')
        } else {
          flipAttributeInBoxUnits(newgrad, 'cy')
          flipAttributeInBoxUnits(newgrad, 'fy')
        }
      }

      const drawing = svgCanvas.getCurrentDrawing?.() || svgCanvas.getDrawing?.()
      const generatedId = drawing?.getNextId?.() ??
        (grad.id ? `${grad.id}-mirrored` : `mirrored-grad-${Date.now()}`)
      if (!generatedId) {
        warn('Unable to mirror gradient: no drawing context available', null, 'coords')
        return
      }
      newgrad.id = generatedId
      findDefs().append(newgrad)
      selected.setAttribute(type, `url(#${newgrad.id})`)
    }
  })

  const elName = selected.tagName

  // Skip remapping for '<use>' elements
  if (elName === 'use') {
    // Do not remap '<use>' elements; transformations are handled via 'transform' attribute
    return
  }

  // Now we have a set of changes and an applied reduced transform list
  // We apply the changes directly to the DOM
  switch (elName) {
    case 'foreignObject':
    case 'rect':
    case 'image': {
      // Allow images to be inverted (give them matrix when flipped)
      if (elName === 'image' && (m.a < 0 || m.d < 0)) {
        // Convert to matrix if flipped
        const chlist = getTransformList(selected)
        if (chlist) {
          const mt = svgCanvas.getSvgRoot().createSVGTransform()
          mt.setMatrix(matrixMultiply(transformListToTransform(chlist).matrix, m))
          chlist.clear()
          chlist.appendItem(mt)
        }
      } else {
        const pt1 = remap(changes.x ?? 0, changes.y ?? 0)
        changes.width = scalew(changes.width ?? 0)
        changes.height = scaleh(changes.height ?? 0)
        changes.x = pt1.x + Math.min(0, changes.width)
        changes.y = pt1.y + Math.min(0, changes.height)
        changes.width = Math.abs(changes.width)
        changes.height = Math.abs(changes.height)
      }
      finishUp()
      break
    }
    case 'ellipse': {
      const c = remap(changes.cx ?? 0, changes.cy ?? 0)
      changes.cx = c.x
      changes.cy = c.y
      changes.rx = Math.abs(scalew(changes.rx ?? 0))
      changes.ry = Math.abs(scaleh(changes.ry ?? 0))
      finishUp()
      break
    }
    case 'circle': {
      const c = remap(changes.cx ?? 0, changes.cy ?? 0)
      changes.cx = c.x
      changes.cy = c.y
      // Take the minimum of the new dimensions for the new circle radius
      const tbox = transformBox(box?.x ?? 0, box?.y ?? 0, box?.width ?? 0, box?.height ?? 0, m)
      const w = tbox.tr.x - tbox.tl.x
      const h = tbox.bl.y - tbox.tl.y
      changes.r = Math.min(Math.abs(w / 2), Math.abs(h / 2))
      finishUp()
      break
    }
    case 'line': {
      const pt1 = remap(changes.x1 ?? 0, changes.y1 ?? 0)
      const pt2 = remap(changes.x2 ?? 0, changes.y2 ?? 0)
      changes.x1 = pt1.x
      changes.y1 = pt1.y
      changes.x2 = pt2.x
      changes.y2 = pt2.y
      finishUp()
      break
    }
    case 'text': {
      const pt = remap(changes.x ?? 0, changes.y ?? 0)
      changes.x = pt.x
      changes.y = pt.y

      // Scale font-size
      let fontSize = selected.getAttribute('font-size')
      if (!fontSize) {
        // If not directly set, try computed style
        fontSize = window.getComputedStyle(selected).fontSize
      }
      const fontSizeNum = parseFloat(fontSize)
      if (!isNaN(fontSizeNum)) {
        // Assume uniform scaling and use m.a
        changes['font-size'] = fontSizeNum * Math.abs(m.a)
      }

      finishUp()

      // Handle child 'tspan' elements
      const childNodes = selected.childNodes
      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i] as Element
        if (child.nodeType === 1 && child.tagName === 'tspan') {
          const childChanges: RemapChanges = {}
          const hasX = child.hasAttribute('x')
          const hasY = child.hasAttribute('y')
          if (hasX) {
            const childX = convertToNum('x', child.getAttribute('x') ?? '0')
            const childPtX = remap(childX, changes.y ?? 0).x
            childChanges.x = childPtX
          }
          if (hasY) {
            const childY = convertToNum('y', child.getAttribute('y') ?? '0')
            const childPtY = remap(changes.x ?? 0, childY).y
            childChanges.y = childPtY
          }

          let tspanFS = child.getAttribute('font-size')
          if (!tspanFS) {
            tspanFS = window.getComputedStyle(child).fontSize
          }
          const tspanFSNum = parseFloat(tspanFS)
          if (!isNaN(tspanFSNum)) {
            childChanges['font-size'] = tspanFSNum * Math.abs(m.a)
          }

          if (hasX || hasY || childChanges['font-size'] !== undefined) {
            assignAttributes(child, childChanges as Record<string, string | number>, 1000, true)
          }
        }
      }
      break
    }
    case 'tspan': {
      const pt = remap(changes.x ?? 0, changes.y ?? 0)
      changes.x = pt.x
      changes.y = pt.y

      // Handle tspan font-size scaling
      let tspanFS = selected.getAttribute('font-size')
      if (!tspanFS) {
        tspanFS = window.getComputedStyle(selected).fontSize
      }
      const tspanFSNum = parseFloat(tspanFS)
      if (!isNaN(tspanFSNum)) {
        changes['font-size'] = tspanFSNum * Math.abs(m.a)
      }

      finishUp()
      break
    }
    case 'g': {
      const dataStorage = svgCanvas.getDataStorage()
      const gsvg = dataStorage.get(selected, 'gsvg')
      if (gsvg) {
        assignAttributes(gsvg as Element, changes as Record<string, string | number>, 1000, true)
      }
      break
    }
    case 'polyline':
    case 'polygon': {
      changes.points?.forEach(pt => {
        const { x, y } = remap(pt.x, pt.y)
        pt.x = x
        pt.y = y
      })
      const pstr = (changes.points ?? []).map(pt => `${pt.x},${pt.y}`).join(' ')
      selected.setAttribute('points', pstr)
      break
    }
    case 'path': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectedPath = selected as any
      const supportsPathData: boolean =
        typeof selectedPath.getPathData === 'function' &&
        typeof selectedPath.setPathData === 'function'

      // Handle path segments
      const segList = supportsPathData ? null : selectedPath.pathSegList
      const len: number = supportsPathData ? selectedPath.getPathData().length : segList.numberOfItems
      const det = m.a * m.d - m.b * m.c
      const shouldToggleArcSweep = det < 0
      changes.d = []
      if (supportsPathData) {
        const pathDataSegments = selectedPath.getPathData()
        for (let i = 0; i < len; ++i) {
          const seg = pathDataSegments[i]
          // Normalize 'Z' -> 'z': pathMap only contains lowercase 'z' (SVG spec
          // treats Z and z as equivalent for closepath -- no operands, no
          // absolute/relative distinction), but Firefox's native getPathData()
          // returns the literal letter as written in the source path.
          const t = seg.type === 'Z' ? 'z' : seg.type
          const type = pathMap.indexOf(t)
          if (type === -1) continue
          const values: number[] = seg.values || []
          const entry: PathSegEntry = { type }
          // Use ?? 0 fallbacks for noUncheckedIndexedAccess (values[] is a well-typed number array
          // populated from seg.values which is always the correct length per SVG path spec)
          switch (t.toUpperCase()) {
            case 'M':
            case 'L':
            case 'T':
              entry.x = values[0] ?? 0; entry.y = values[1] ?? 0
              break
            case 'H':
              entry.x = values[0] ?? 0
              break
            case 'V':
              entry.y = values[0] ?? 0
              break
            case 'C':
              entry.x1 = values[0] ?? 0; entry.y1 = values[1] ?? 0; entry.x2 = values[2] ?? 0; entry.y2 = values[3] ?? 0; entry.x = values[4] ?? 0; entry.y = values[5] ?? 0
              break
            case 'S':
              entry.x2 = values[0] ?? 0; entry.y2 = values[1] ?? 0; entry.x = values[2] ?? 0; entry.y = values[3] ?? 0
              break
            case 'Q':
              entry.x1 = values[0] ?? 0; entry.y1 = values[1] ?? 0; entry.x = values[2] ?? 0; entry.y = values[3] ?? 0
              break
            case 'A':
              entry.r1 = values[0] ?? 0; entry.r2 = values[1] ?? 0; entry.angle = values[2] ?? 0
              entry.largeArcFlag = values[3] ?? 0; entry.sweepFlag = values[4] ?? 0; entry.x = values[5] ?? 0; entry.y = values[6] ?? 0
              break
            default:
              break
          }
          changes.d[i] = entry
        }
      } else {
        for (let i = 0; i < len; ++i) {
          const seg = segList.getItem(i)
          changes.d[i] = {
            type: seg.pathSegType,
            x: seg.x,
            y: seg.y,
            x1: seg.x1,
            y1: seg.y1,
            x2: seg.x2,
            y2: seg.y2,
            r1: seg.r1,
            r2: seg.r2,
            angle: seg.angle,
            largeArcFlag: seg.largeArcFlag,
            sweepFlag: seg.sweepFlag
          }
        }
      }

      const firstseg = changes.d[0]
      let currentpt: { x: number; y: number } | undefined
      if (len > 0 && firstseg) {
        currentpt = remap(firstseg.x ?? 0, firstseg.y ?? 0)
        firstseg.x = currentpt.x
        firstseg.y = currentpt.y
      }
      for (let i = 1; i < len; ++i) {
        const seg = changes.d[i]
        if (!seg) continue
        const { type } = seg
        // If absolute or first segment, remap x, y, x1, y1, x2, y2
        if (type % 2 === 0) {
          const thisx = seg.x !== undefined ? seg.x : (currentpt?.x ?? 0) // For V commands
          const thisy = seg.y !== undefined ? seg.y : (currentpt?.y ?? 0) // For H commands
          const pt = remap(thisx, thisy)
          seg.x = pt.x
          seg.y = pt.y
          if (seg.x1 !== undefined && seg.y1 !== undefined) {
            const pt1 = remap(seg.x1, seg.y1)
            seg.x1 = pt1.x
            seg.y1 = pt1.y
          }
          if (seg.x2 !== undefined && seg.y2 !== undefined) {
            const pt2 = remap(seg.x2, seg.y2)
            seg.x2 = pt2.x
            seg.y2 = pt2.y
          }
          if (type === 10) {
            seg.r1 = Math.abs(scalew(seg.r1 ?? 0))
            seg.r2 = Math.abs(scaleh(seg.r2 ?? 0))
            if (shouldToggleArcSweep) {
              seg.sweepFlag = Number(seg.sweepFlag) ? 0 : 1
              if (typeof seg.angle === 'number') {
                seg.angle = -seg.angle
              }
            }
          }
        } else {
          // For relative segments, scale x, y, x1, y1, x2, y2
          if (seg.x !== undefined) seg.x = scalew(seg.x)
          if (seg.y !== undefined) seg.y = scaleh(seg.y)
          if (seg.x1 !== undefined) seg.x1 = scalew(seg.x1)
          if (seg.y1 !== undefined) seg.y1 = scaleh(seg.y1)
          if (seg.x2 !== undefined) seg.x2 = scalew(seg.x2)
          if (seg.y2 !== undefined) seg.y2 = scaleh(seg.y2)
          if (type === 11) {
            seg.r1 = Math.abs(scalew(seg.r1 ?? 0))
            seg.r2 = Math.abs(scaleh(seg.r2 ?? 0))
            if (shouldToggleArcSweep) {
              seg.sweepFlag = Number(seg.sweepFlag) ? 0 : 1
              if (typeof seg.angle === 'number') {
                seg.angle = -seg.angle
              }
            }
          }
        }
      }

      let dstr = ''
      ;(changes.d ?? []).forEach((seg: PathSegEntry) => {
        const { type } = seg
        const letter = pathMap[type] ?? ''
        dstr += letter
        switch (type) {
          case 1: // closepath (z) -- no operands
            break
          case 13: // relative horizontal line (h)
          case 12: // absolute horizontal line (H)
            dstr += `${seg.x} `
            break
          case 15: // relative vertical line (v)
          case 14: // absolute vertical line (V)
            dstr += `${seg.y} `
            break
          case 3: // relative move (m)
          case 5: // relative line (l)
          case 19: // relative smooth quad (t)
          case 2: // absolute move (M)
          case 4: // absolute line (L)
          case 18: // absolute smooth quad (T)
            dstr += `${seg.x},${seg.y} `
            break
          case 7: // relative cubic (c)
          case 6: // absolute cubic (C)
            dstr += `${seg.x1},${seg.y1} ${seg.x2},${seg.y2} ${seg.x},${seg.y} `
            break
          case 9: // relative quad (q)
          case 8: // absolute quad (Q)
            dstr += `${seg.x1},${seg.y1} ${seg.x},${seg.y} `
            break
          case 11: // relative elliptical arc (a)
          case 10: // absolute elliptical arc (A)
            dstr +=
              seg.r1 +
              ',' +
              seg.r2 +
              ' ' +
              seg.angle +
              ' ' +
              Number(seg.largeArcFlag) +
              ' ' +
              Number(seg.sweepFlag) +
              ' ' +
              seg.x +
              ',' +
              seg.y +
              ' '
            break
          case 17: // relative smooth cubic (s)
          case 16: // absolute smooth cubic (S)
            dstr += `${seg.x2},${seg.y2} ${seg.x},${seg.y} `
            break
          default:
            break
        }
      })

      const d = dstr.trim()
      // setAttribute('d', ...) is the authoritative write; path-data-polyfill hooks
      // it to keep its internal cache in sync.  A subsequent setPathData() call would
      // re-serialise in the polyfill's own whitespace-only format and overwrite the
      // carefully comma-formatted dstr, so we do not call it here.
      selected.setAttribute('d', d)
      break
    }
    default:
      break
  }
}
