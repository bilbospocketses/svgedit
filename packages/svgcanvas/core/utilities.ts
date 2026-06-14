/**
 * Miscellaneous utilities.
 * @module utilities
 * @license MIT
 *
 */

import { NS } from './namespaces.js'
import { setUnitAttr, getTypeMap, shortFloat } from './units.js'
import {
  hasMatrixTransform,
  transformListToTransform,
  transformBox,
  getTransformList
} from './math.js'
import { mergeDeep } from '../common/util.js'
import { getPathData as getPathDataFn } from './path-data.js'

/** A plain bounding box object. */
export interface BBoxObject {
  x: number
  y: number
  width: number
  height: number
}

/** JSON representation of an SVG element for addSVGElementsFromJson / getJsonFromSvgElements. */
export interface SVGElementJSON {
  element: string
  attr: Record<string, string | number>
  curStyles?: boolean
  children?: SVGElementJSON[]
  namespace?: string
}

// Much faster than running getBBox() every time
const visElems =
  'a,circle,ellipse,foreignObject,g,image,line,path,polygon,polyline,rect,svg,text,tspan,use,clipPath'
const visElemsArr = visElems.split(',')

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas
let svgroot_: SVGSVGElement | null = null

/**
 * Initializes this module with the canvas context.
 */
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
  svgroot_ = canvas.getSvgRoot()
}

/**
 * Used to prevent the Billion laughs attack.
 * Removes entity declarations from the DOCTYPE internal subset.
 */
export const dropXMLInternalSubset = (str: string): string => {
  const doctypeIdx = str.indexOf('<!DOCTYPE')
  if (doctypeIdx === -1) return str
  const bracketIdx = str.indexOf('[', doctypeIdx)
  if (bracketIdx === -1) return str
  const closeIdx = str.indexOf('?]>', bracketIdx + 1)
  if (closeIdx === -1) return str
  return str.slice(0, bracketIdx + 1) + str.slice(closeIdx)
}

/**
 * Converts characters in a string to XML-friendly entities.
 * e.g. `&` becomes `&amp;`
 */
export const toXml = (str: string): string => {
  const xmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;' // Note: `&apos;` is XML only
  }

  return str.replace(/[&<>"']/g, (char) => xmlEntities[char] ?? char)
}

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

// schiller: Removed string concatenation in favour of Array.join() optimization,
//        also precalculate the size of the array needed.

/** Converts a string to base64. */
export const encode64 = (input: string): string => {
  const encoded = encodeUTF8(input)
  return window.btoa(encoded)
}

/** Converts a string from base64. */
export const decode64 = (input: string): string => decodeUTF8(window.atob(input))

/** Compute a hashcode from a given string. */
export const hashCode = (word: string): number => {
  if (word.length === 0) return 0

  let hash = 0
  for (let i = 0; i < word.length; i++) {
    const chr = word.charCodeAt(i)
    hash = ((hash << 5) - hash + chr) | 0 // Convert to 32bit integer
  }
  return hash
}

// Reused across calls. `ignoreBOM` keeps a leading U+FEFF (matching the previous
// escape/unescape behaviour); `fatal` throws on malformed input as decodeURIComponent did.
const utf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const utf8Encoder = new TextEncoder()

/** Decodes a binary string of UTF-8 bytes to a JS string. */
export const decodeUTF8 = (argString: string): string => {
  const bytes = new Uint8Array(argString.length)
  for (let i = 0; i < argString.length; i++) {
    bytes[i] = argString.charCodeAt(i)
  }
  return utf8Decoder.decode(bytes)
}

/** Encodes a JS string to UTF-8 as a binary string (one character per UTF-8 byte). */
export const encodeUTF8 = (argString: string): string => {
  let result = ''
  for (const byte of utf8Encoder.encode(argString)) {
    result += String.fromCharCode(byte)
  }
  return result
}

/** Convert dataURL to object URL. Returns empty string on failure. */
export const dataURLToObjectURL = (dataurl: string): string => {
  if (
    typeof Uint8Array === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    !URL.createObjectURL
  ) {
    return ''
  }

  const [prefix, suffix] = dataurl.split(',')
  if (!prefix || !suffix) {
    return ''
  }
  const colonIdx = prefix.indexOf(':')
  if (colonIdx < 0) return ''
  const semiIdx = prefix.indexOf(';', colonIdx + 1)
  if (semiIdx <= colonIdx + 1) return ''
  const mime = prefix.slice(colonIdx + 1, semiIdx)
  const bstr = atob(suffix)
  const u8arr = new Uint8Array(bstr.length)

  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }

  const blob = new Blob([u8arr], { type: mime })
  return URL.createObjectURL(blob)
}

/** Get object URL for a blob object. Returns empty string on failure. */
export const createObjectURL = (blob: Blob | null | undefined): string => {
  if (!blob || typeof URL === 'undefined' || !URL.createObjectURL) {
    return ''
  }
  return URL.createObjectURL(blob)
}

/**
 * @property {string} blankPageObjectURL
 */
export const blankPageObjectURL: string = (() => {
  if (typeof Blob === 'undefined') {
    return ''
  }
  const blob = new Blob(
    ['<html><head><title>SVG-edit</title></head><body>&nbsp;</body></html>'],
    { type: 'text/html' }
  )
  return createObjectURL(blob)
})()

/** Converts a string to use XML references (for non-ASCII). */
export const convertToXMLReferences = (input: string): string => {
  let output = ''
  ;[...input].forEach(ch => {
    const c = ch.charCodeAt(0)
    output += c <= 127 ? ch : `&#${c};`
  })
  return output
}

/** Cross-browser compatible method of converting a string to an XML tree. */
export const text2xml = (sXML: string): XMLDocument => {
  let xmlString = sXML

  if (xmlString.includes('<svg:svg')) {
    xmlString = xmlString
      .replace(/<(\/?)svg:/g, '<$1')
      .replace('xmlns:svg', 'xmlns')
  }

  let parser
  try {
    parser = new DOMParser()
    // Legacy DOMParser property, not in modern typings but needed for older engines
    ;(parser as DOMParser & { async: boolean }).async = false
  } catch {
    throw new Error('XML Parser could not be instantiated')
  }

  try {
    return parser.parseFromString(xmlString, 'text/xml')
  } catch (e) {
    throw new Error(`Error parsing XML string: ${(e as Error).message}`)
  }
}

/** Converts a SVGRect-like object into a plain BBoxObject. */
export const bboxToObj = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }): BBoxObject => {
  return { x, y, width, height }
}

/** Walks the tree in top-down fashion and calls cbFn on each element. */
export const walkTree = (elem: Node | null | undefined, cbFn: (elem: Element) => void): void => {
  if (elem != null && (elem as Element).nodeType === 1) {
    cbFn(elem as Element)
    let i = elem.childNodes.length
    while (i--) {
      walkTree(elem.childNodes.item(i), cbFn)
    }
  }
}

/** Walks the tree in depth-first fashion and calls cbFn on each element. */
export const walkTreePost = (elem: Node | null | undefined, cbFn: (elem: Element) => void): void => {
  if (elem != null && (elem as Element).nodeType === 1) {
    let i = elem.childNodes.length
    while (i--) {
      walkTree(elem.childNodes.item(i), cbFn)
    }
    cbFn(elem as Element)
  }
}

/**
 * Extracts the URL from the `url(...)` syntax of some attributes.
 */
export const getUrlFromAttr = (attrVal: string | null | undefined): string | null => {
  if (!attrVal?.startsWith('url(')) return null

  const patterns = [
    { start: 'url("', end: '"', offset: 5 },
    { start: "url('", end: "'", offset: 5 },
    { start: 'url(', end: ')', offset: 4 }
  ]

  for (const { start, end, offset } of patterns) {
    if (attrVal.startsWith(start)) {
      const endIndex = attrVal.indexOf(end, offset + 1)
      return endIndex > 0 ? attrVal.substring(offset, endIndex) : null
    }
  }

  return null
}

/** Returns the given element's `href` value. */
export let getHref = (elem: Element): string | null =>
  elem.getAttribute('href') ?? elem.getAttributeNS(NS.XLINK, 'href')

/** Sets the given element's `href` value. */
export let setHref = (elem: Element, val: string): void => {
  elem.setAttribute('href', val)
}

/** Returns the document's `<defs>` element, creating it first if necessary. */
export const findDefs = (): SVGDefsElement => {
  const svgElement = svgCanvas.getSvgContent()
  const existingDefs = svgElement.getElementsByTagNameNS(NS.SVG, 'defs')

  if (existingDefs.length > 0) {
    return existingDefs[0] as SVGDefsElement  // safe: length > 0 guard above
  }

  const defs = svgElement.ownerDocument.createElementNS(NS.SVG, 'defs')
  const insertTarget = svgElement.firstChild?.nextSibling

  if (insertTarget) {
    svgElement.insertBefore(defs, insertTarget)
  } else {
    svgElement.append(defs)
  }

  return defs
}

// TODO(codedread): Consider moving the next two functions to bbox.js

/**
 * Get correct BBox for a path in Webkit.
 * Uses the local path-data module for parsing.
 */
export const getPathBBox = (path: SVGPathElement): BBoxObject => {
  const pathDataForBBox = getPathDataFn(path)
  const totalSegments = pathDataForBBox.length

  interface LegacyPathSeg {
    x?: number
    y?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
  }

  const cmdToLegacy = (cmd: { type: string; values: number[] }): LegacyPathSeg => {
    const { type, values } = cmd
    const U = type.toUpperCase()
    const seg: LegacyPathSeg = {}
    switch (U) {
      case 'M': case 'L': case 'T':
        seg.x = values[0] ?? 0; seg.y = values[1] ?? 0; break
      case 'H':
        seg.x = values[0] ?? 0; break
      case 'V':
        seg.y = values[0] ?? 0; break
      case 'C':
        seg.x1 = values[0] ?? 0; seg.y1 = values[1] ?? 0
        seg.x2 = values[2] ?? 0; seg.y2 = values[3] ?? 0
        seg.x = values[4] ?? 0; seg.y = values[5] ?? 0; break
      case 'S':
        seg.x2 = values[0] ?? 0; seg.y2 = values[1] ?? 0
        seg.x = values[2] ?? 0; seg.y = values[3] ?? 0; break
      case 'Q':
        seg.x1 = values[0] ?? 0; seg.y1 = values[1] ?? 0
        seg.x = values[2] ?? 0; seg.y = values[3] ?? 0; break
      case 'A':
        seg.x = values[5] ?? 0; seg.y = values[6] ?? 0; break
      default: break
    }
    return seg
  }

  const bounds: [number[], number[]] = [[], []]
  const startCmd = pathDataForBBox[0]
  const start = startCmd ? cmdToLegacy(startCmd) : { x: 0, y: 0 }
  let P0 = [start?.x ?? 0, start?.y ?? 0]

  const getCalc = (j: number, P1: number[], P2: number[], P3: number[]) => (t: number): number => {
    const oneMinusT = 1 - t
    return (
      oneMinusT ** 3 * (P0[j] ?? 0) +
      3 * oneMinusT ** 2 * t * (P1[j] ?? 0) +
      3 * oneMinusT * t ** 2 * (P2[j] ?? 0) +
      t ** 3 * (P3[j] ?? 0)
    )
  }

  for (let i = 0; i < totalSegments; i++) {
    const rawCmd = pathDataForBBox[i]
    if (!rawCmd) continue
    const seg = cmdToLegacy(rawCmd)

    if (seg.x === undefined) continue

    // Add actual points to limits
    bounds[0].push(P0[0] ?? 0)
    bounds[1].push(P0[1] ?? 0)

    if (seg.x1 !== undefined) {
      const P1 = [seg.x1, seg.y1 ?? 0]
      const P2 = [seg.x2 ?? 0, seg.y2 ?? 0]
      const P3 = [seg.x, seg.y ?? 0]

      for (let j = 0; j < 2; j++) {
        const calc = getCalc(j, P1, P2, P3)

        const b = 6 * (P0[j] ?? 0) - 12 * (P1[j] ?? 0) + 6 * (P2[j] ?? 0)
        const a = -3 * (P0[j] ?? 0) + 9 * (P1[j] ?? 0) - 9 * (P2[j] ?? 0) + 3 * (P3[j] ?? 0)
        const c = 3 * (P1[j] ?? 0) - 3 * (P0[j] ?? 0)

        if (a === 0) {
          if (b === 0) {
            continue
          }
          const t = -c / b
          if (t > 0 && t < 1) {
            bounds[j]?.push(calc(t))  // safe: j is 0 or 1, bounds always has 2 elements
          }
          continue
        }
        const b2ac = b ** 2 - 4 * c * a
        if (b2ac < 0) {
          continue
        }
        const t1 = (-b + Math.sqrt(b2ac)) / (2 * a)
        if (t1 > 0 && t1 < 1) {
          bounds[j]?.push(calc(t1))  // safe: j is 0 or 1, bounds always has 2 elements
        }
        const t2 = (-b - Math.sqrt(b2ac)) / (2 * a)
        if (t2 > 0 && t2 < 1) {
          bounds[j]?.push(calc(t2))  // safe: j is 0 or 1, bounds always has 2 elements
        }
      }
      P0 = P3
    } else {
      bounds[0].push(seg.x ?? 0)
      bounds[1].push(seg.y ?? 0)
    }
  }

  const x = Math.min(...bounds[0])
  const y = Math.min(...bounds[1])

  return {
    x,
    y,
    width: Math.max(...bounds[0]) - x,
    height: Math.max(...bounds[1]) - y
  }
}

/**
 * Get the given/selected element's bounding box object.
 */
export const getBBox = (elem: Element): BBoxObject | null => {
  const selected: Element = elem
  if (elem.nodeType !== 1) return null

  const elname = selected.nodeName

  const svgElem = selected as SVGGraphicsElement
  let ret: BBoxObject | null = null
  switch (elname) {
    case 'text':
      if (selected.textContent === '') {
        selected.textContent = 'a' // Some character needed for the selector to use.
        ret = svgElem.getBBox()
        selected.textContent = ''
      } else if (typeof svgElem.getBBox === 'function') {
        ret = svgElem.getBBox()
      }
      break
    case 'path':
    case 'g':
    case 'a':
      if (typeof svgElem.getBBox === 'function') {
        ret = svgElem.getBBox()
      }
      break
    default:
      if (elname === 'use') {
        ret = svgElem.getBBox()
      } else if (visElemsArr.includes(elname)) {
        try {
          ret = svgElem.getBBox()
        } catch {
          // tspan (and textPath apparently) have no `getBBox` in Firefox
          const textElem = selected as SVGTextContentElement
          const extent = textElem.getExtentOfChar(0)
          const width = textElem.getComputedTextLength()
          ret = {
            x: extent.x,
            y: extent.y,
            width,
            height: extent.height
          }
        }
      }
  }
  if (ret) {
    // JSDOM lacks SVG geometry; fall back to simple attribute-based bbox when native values are empty.
    if (ret.width === 0 && ret.height === 0) {
      const tag = elname.toLowerCase()
      const num = (name: string, fallback = 0): number =>
        Number.parseFloat(selected.getAttribute(name) ?? String(fallback))
      const fromAttrs = (() => {
        switch (tag) {
          case 'path': {
            const d = selected.getAttribute('d') || ''
            const nums = (d.match(/-?\d*\.?\d+/g) || []).map(Number).filter(n => !Number.isNaN(n))
            if (nums.length >= 2) {
              const xs = nums.filter((_, i) => i % 2 === 0)
              const ys = nums.filter((_, i) => i % 2 === 1)
              return {
                x: Math.min(...xs),
                y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
              }
            }
            break
          }
          case 'rect':
            return { x: num('x'), y: num('y'), width: num('width'), height: num('height') }
          case 'line': {
            const x1 = num('x1'); const x2 = num('x2'); const y1 = num('y1'); const y2 = num('y2')
            return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
          }
          case 'g': {
            const boxes = Array.from(selected.children || [])
              .map(child => getBBox(child))
              .filter((b): b is BBoxObject => b !== null)
            if (boxes.length) {
              const minX = Math.min(...boxes.map(b => b.x))
              const minY = Math.min(...boxes.map(b => b.y))
              const maxX = Math.max(...boxes.map(b => b.x + b.width))
              const maxY = Math.max(...boxes.map(b => b.y + b.height))
              return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
            }
            break
          }
          default:
            break
        }
      })()
      if (fromAttrs) {
        ret = fromAttrs
      }
    }
    ret = bboxToObj(ret)
  }

  // get the bounding box from the DOM (which is in that element's coordinate system)
  return ret
}

/** A path segment: [command, [x,y, x,y, ...]]. */
export type PathSegment = [string, number[]]

/** Create a path 'd' attribute from path segments. */
export const getPathDFromSegments = (pathSegments: PathSegment[]): string => {
  return pathSegments.map(([command, points]) => {
    const coords: string[] = []
    for (let i = 0; i < points.length; i += 2) {
      coords.push(`${points[i] ?? 0},${points[i + 1] ?? 0}`)
    }
    return command + coords.join(' ')
  }).join(' ')
}

/** Make a path 'd' attribute from a simple SVG element shape. Returns undefined for unknown types. */
export const getPathDFromElement = (elem: Element): string | undefined => {
  // Possibly the cubed root of 6, but 1.81 works best
  let num = 1.81
  let d
  let rx
  let ry
  switch (elem.tagName) {
    case 'ellipse':
    case 'circle': {
      rx = Number(elem.getAttribute('rx'))
      ry = Number(elem.getAttribute('ry'))
      const cx = Number(elem.getAttribute('cx'))
      const cy = Number(elem.getAttribute('cy'))
      if (elem.tagName === 'circle' && elem.hasAttribute('r')) {
        ry = Number(elem.getAttribute('r'))
        rx = ry
      }
      d = getPathDFromSegments([
        ['M', [cx - rx, cy]],
        ['C', [cx - rx, cy - ry / num, cx - rx / num, cy - ry, cx, cy - ry]],
        ['C', [cx + rx / num, cy - ry, cx + rx, cy - ry / num, cx + rx, cy]],
        ['C', [cx + rx, cy + ry / num, cx + rx / num, cy + ry, cx, cy + ry]],
        ['C', [cx - rx / num, cy + ry, cx - rx, cy + ry / num, cx - rx, cy]],
        ['Z', []]
      ])
      break
    }
    case 'path':
      d = elem.getAttribute('d') ?? undefined
      break
    case 'line': {
      const x1 = elem.getAttribute('x1')
      const y1 = elem.getAttribute('y1')
      const x2 = elem.getAttribute('x2')
      const y2 = elem.getAttribute('y2')
      d = `M${x1},${y1}L${x2},${y2}`
      break
    }
    case 'polyline':
      d = `M${elem.getAttribute('points')}`
      break
    case 'polygon':
      d = `M${elem.getAttribute('points')} Z`
      break
    case 'rect': {
      rx = Number(elem.getAttribute('rx'))
      ry = Number(elem.getAttribute('ry'))
      const b = (elem as SVGRectElement).getBBox()
      const { x, y } = b
      const w = b.width
      const h = b.height
      num = 4 - num // Why? Because!

      d =
        !rx && !ry // Regular rect
          ? getPathDFromSegments([
            ['M', [x, y]],
            ['L', [x + w, y]],
            ['L', [x + w, y + h]],
            ['L', [x, y + h]],
            ['L', [x, y]],
            ['Z', []]
          ])
          : getPathDFromSegments([
            ['M', [x, y + ry]],
            ['C', [x, y + ry / num, x + rx / num, y, x + rx, y]],
            ['L', [x + w - rx, y]],
            ['C', [x + w - rx / num, y, x + w, y + ry / num, x + w, y + ry]],
            ['L', [x + w, y + h - ry]],
            [
              'C',
              [
                x + w,
                y + h - ry / num,
                x + w - rx / num,
                y + h,
                x + w - rx,
                y + h
              ]
            ],
            ['L', [x + rx, y + h]],
            ['C', [x + rx / num, y + h, x, y + h - ry / num, x, y + h - ry]],
            ['L', [x, y + ry]],
            ['Z', []]
          ])
      break
    }
    default:
      break
  }

  return d
}

/**
 * Get a set of extra attributes from an element useful for convertToPath.
 * Get a set of extra attributes from an element useful for convertToPath.
 */
export const getExtraAttributesForConvertToPath = (elem: Element): Record<string, string> => {
  const attributeNames = [
    'marker-start', 'marker-end', 'marker-mid', 'filter', 'clip-path',
    'transform', 'fill-rule', 'clip-rule'
  ]

  return attributeNames.reduce<Record<string, string>>((attrs, name) => {
    const value = elem.getAttribute(name)
    if (value) attrs[name] = value
    return attrs
  }, {})
}

/**
 * Get the BBox of an element-as-path.
 * @function module:utilities.getBBoxOfElementAsPath
 * @param elem - The DOM element to be probed
 * @param addSVGElementsFromJson - Function to add the path element to the current layer. See canvas.addSVGElementsFromJson
 * @param pathActions - If a transform exists, `pathActions.resetOrientation()` is used. See: canvas.pathActions.
 */
/** Shape of pathActions object needed by getBBoxOfElementAsPath / convertToPath. */
interface PathActions {
  resetOrientation(path: SVGPathElement): void
}

/** Shape of addSVGElementsFromJson function. */
type AddSVGElementsFromJsonFn = (data: SVGElementJSON) => Element

/**
 * Get the BBox of an element converted to a temporary path.
 */
export const getBBoxOfElementAsPath = (
  elem: Element,
  addSVGElementsFromJson: AddSVGElementsFromJsonFn,
  pathActions: PathActions
): BBoxObject | false => {
  const path = addSVGElementsFromJson({
    element: 'path',
    attr: getExtraAttributesForConvertToPath(elem)
  }) as SVGPathElement

  const eltrans = elem.getAttribute('transform')
  if (eltrans) {
    path.setAttribute('transform', eltrans)
  }

  const { parentNode } = elem
  if (elem.nextSibling) {
    elem.before(path)
  } else {
    parentNode?.append(path)
  }

  const d = getPathDFromElement(elem)
  if (d) {
    path.setAttribute('d', d)
  } else {
    path.remove()
  }

  // Get the correct BBox of the new path, then discard it
  pathActions.resetOrientation(path)
  let bb: BBoxObject | false = false
  try {
    bb = path.getBBox()
  } catch {
    // Firefox fails
  }
  if (bb && bb.width === 0 && bb.height === 0) {
    const dAttr = path.getAttribute('d') || ''
    const nums = (dAttr.match(/-?\d*\.?\d+/g) || []).map(Number).filter(n => !Number.isNaN(n))
    if (nums.length >= 2) {
      const xs = nums.filter((_n, i) => i % 2 === 0)
      const ys = nums.filter((_n, i) => i % 2 === 1)
      bb = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      }
    }
  }
  path.remove()
  return bb
}

/**
 * Convert selected element to a path.
 * @function module:utilities.convertToPath
 * @param attrs - Apply attributes to new path. see canvas.convertToPath
 * @param addSVGElementsFromJson - Function to add the path element to the current layer. See canvas.addSVGElementsFromJson
 * @param pathActions - If a transform exists, pathActions.resetOrientation() is used. See: canvas.pathActions.
 * @param clearSelection - see [canvas.clearSelection]{@link module:svgcanvas.SvgCanvas#clearSelection}
 * @param addToSelection - see [canvas.addToSelection]{@link module:svgcanvas.SvgCanvas#addToSelection}
 * @param hstry - see history module
 * @param addCommandToHistory - see [canvas.addCommandToHistory]{@link module:svgcanvas~addCommandToHistory}
 * @returns The converted path element or null if the DOM element was not recognized.
 */
export const convertToPath = (elem: Element, attrs: Record<string, unknown>, svgCanvas: ISvgCanvas): SVGPathElement | null => {
  const batchCmd = new svgCanvas.history.BatchCommand('Convert element to Path')

  // Any attribute on the element not covered by the passed-in attributes
  attrs = mergeDeep(attrs, getExtraAttributesForConvertToPath(elem))

  const path = svgCanvas.addSVGElementsFromJson({
    element: 'path',
    attr: attrs as Record<string, string | number>
  }) as SVGPathElement

  const eltrans = elem.getAttribute('transform')
  if (eltrans) {
    path.setAttribute('transform', eltrans)
  }

  const { id } = elem
  const { parentNode } = elem
  if (elem.nextSibling) {
    elem.before(path)
  } else {
    parentNode?.append(path)
  }

  const d = getPathDFromElement(elem)
  if (d) {
    path.setAttribute('d', d)

    // Replace the current element with the converted one

    // Reorient if it has a matrix
    if (eltrans) {
      const tlist = getTransformList(path)
      if (hasMatrixTransform(tlist)) {
        svgCanvas.pathActions.resetOrientation(path)
      }
    }

    const { nextSibling } = elem
    batchCmd.addSubCommand(
      new svgCanvas.history.RemoveElementCommand(
        elem,
        nextSibling,
        elem.parentNode as Node
      )
    )
    svgCanvas.clearSelection()
    elem.remove() // We need to remove this element otherwise the nextSibling of 'path' won't be null and an exception will be thrown after subsequent undo and redos.

    batchCmd.addSubCommand(new svgCanvas.history.InsertElementCommand(path))
    path.setAttribute('id', id)
    path.removeAttribute('visibility')
    svgCanvas.addToSelection([path], true)

    svgCanvas.addCommandToHistory(batchCmd)

    return path
  }
  // the elem.tagName was not recognized, so no "d" attribute. Remove it, so we've haven't changed anything.
  path.remove()
  return null
}

/**
 * Can the bbox be optimized over the native getBBox? The optimized bbox is the same as the native getBBox when
 * the rotation angle is a multiple of 90 degrees and there are no complex transforms.
 * Getting an optimized bbox can be dramatically slower, so we want to make sure it's worth it.
 *
 * The best example for this is a circle rotate 45 degrees. The circle doesn't get wider or taller when rotated
 * about it's center.
 *
 * The standard, unoptimized technique gets the native bbox of the circle, rotates the box 45 degrees, uses
 * that width and height, and applies any transforms to get the final bbox. This means the calculated bbox
 * is much wider than the original circle. If the angle had been 0, 90, 180, etc. both techniques render the
 * same bbox.
 *
 * The optimization is not needed if the rotation is a multiple 90 degrees. The default technique is to call
 * getBBox then apply the angle and any transforms.
 *
 * @param angle - The rotation angle in degrees
 */
const bBoxCanBeOptimizedOverNativeGetBBox = (angle: number, hasAMatrixTransform: boolean): boolean => {
  const angleModulo90 = angle % 90
  const closeTo90 = angleModulo90 < -89.99 || angleModulo90 > 89.99
  const closeTo0 = angleModulo90 > -0.001 && angleModulo90 < 0.001
  return hasAMatrixTransform || !(closeTo0 || closeTo90)
}

/**
 * Get bounding box that includes any transforms.
 * @function module:utilities.getBBoxWithTransform
 * @param addSVGElementsFromJson - Function to add the path element to the current layer. See canvas.addSVGElementsFromJson
 * @param pathActions - If a transform exists, pathActions.resetOrientation() is used. See: canvas.pathActions.
 */
/** Get bounding box that includes any transforms. */
export const getBBoxWithTransform = (
  elem: Element,
  addSVGElementsFromJson: AddSVGElementsFromJsonFn,
  pathActions: PathActions
): BBoxObject | null => {
  let bb = getBBox(elem)
  if (!bb) return null

  const transformAttr = (elem as Element & { getAttribute?: (n: string) => string | null }).getAttribute?.('transform') ?? ''
  const hasMatrixAttr = transformAttr.includes('matrix(')
  if (transformAttr.includes('rotate(') && !hasMatrixAttr) {
    const nums = transformAttr.match(/-?\d*\.?\d+/g)?.map(Number) || []
    const [angle = 0, cx = 0, cy = 0] = nums
    const rad = angle * Math.PI / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const tag = elem.tagName?.toLowerCase()
    let points: Array<{ x: number; y: number }> = []
    if (tag === 'path') {
      const d = elem.getAttribute('d') || ''
      const coords = (d.match(/-?\d*\.?\d+/g) || []).map(Number).filter(n => !Number.isNaN(n))
      for (let i = 0; i < coords.length; i += 2) {
        points.push({ x: coords[i] ?? 0, y: coords[i + 1] ?? 0 })
      }
    } else if (tag === 'rect') {
      const x = Number(elem.getAttribute('x') ?? 0)
      const y = Number(elem.getAttribute('y') ?? 0)
      const w = Number(elem.getAttribute('width') ?? 0)
      const h = Number(elem.getAttribute('height') ?? 0)
      points = [
        { x, y },
        { x: x + w, y },
        { x, y: y + h },
        { x: x + w, y: y + h }
      ]
    }
    if (points.length) {
      const rotatedPts = points.map(pt => {
        const dx = pt.x - cx
        const dy = pt.y - cy
        return {
          x: cx + (dx * cos - dy * sin),
          y: cy + (dx * sin + dy * cos)
        }
      })
      const xs = rotatedPts.map(p => p.x)
      const ys = rotatedPts.map(p => p.y)
      let rotatedBBox = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      }
      const matrixMatch = transformAttr.match(/matrix\(([^)]+)\)/)
      if (matrixMatch?.[1]) {
        const vals = matrixMatch[1].split(/[,\s]+/).filter(Boolean).map(Number)
        const e = vals[4] ?? 0
        const f = vals[5] ?? 0
        rotatedBBox = { ...rotatedBBox, x: rotatedBBox.x + e, y: rotatedBBox.y + f }
      }
      const isRightAngle = Math.abs(angle % 90) < 0.001
      if (tag !== 'path' && isRightAngle && typeof addSVGElementsFromJson === 'function') {
        addSVGElementsFromJson({ element: 'path', attr: {} })
      }
      return rotatedBBox
    }
  }

  const tlist = getTransformList(elem)
  const angle = getRotationAngleFromTransformList(tlist)
  const hasMatrixXForm = hasMatrixTransform(tlist)

  if (angle || hasMatrixXForm) {
    let goodBb: BBoxObject | false = false
    if (bBoxCanBeOptimizedOverNativeGetBBox(angle, hasMatrixXForm)) {
      const elemNames = ['circle', 'ellipse', 'path', 'line', 'polyline', 'polygon']
      if (elemNames.includes(elem.tagName)) {
        const pathBox = getBBoxOfElementAsPath(
          elem,
          addSVGElementsFromJson,
          pathActions
        )
        if (pathBox && !(pathBox.width === 0 && pathBox.height === 0)) {
          goodBb = pathBox
          bb = pathBox
        }
      } else if (elem.tagName === 'rect') {
        // Look for radius
        const rx = Number(elem.getAttribute('rx'))
        const ry = Number(elem.getAttribute('ry'))
        if (rx || ry) {
          const roundedRectBox = getBBoxOfElementAsPath(
            elem,
            addSVGElementsFromJson,
            pathActions
          )
          if (roundedRectBox && !(roundedRectBox.width === 0 && roundedRectBox.height === 0)) {
            goodBb = roundedRectBox
            bb = roundedRectBox
          }
        }
      }
    }

    if (!goodBb) {
      const { matrix } = transformListToTransform(tlist)
      bb = transformBox(bb.x, bb.y, bb.width, bb.height, matrix).aabox
    }
  }
  return bb
}

const getStrokeOffsetForBBox = (elem: Element): number => {
  const sw = parseFloat(elem.getAttribute('stroke-width') ?? '')
  return !isNaN(sw) && elem.getAttribute('stroke') !== 'none' ? sw / 2 : 0
}

/**
 * Get the bounding box for one or more stroked and/or transformed elements.
 * @function module:utilities.getStrokedBBox
 * @param addSVGElementsFromJson - Function to add the path element to the current layer. See canvas.addSVGElementsFromJson
 * @param pathActions - If a transform exists, pathActions.resetOrientation() is used. See: canvas.pathActions.
 */
// audit-flagged at :1126-1129: min/max asymmetry in getStrokedBBox — preserved as-is (todo #10)
export const getStrokedBBox = (
  elems: Element[],
  addSVGElementsFromJson: AddSVGElementsFromJsonFn,
  pathActions: PathActions
): BBoxObject | false | null => {
  if (!elems || !elems.length) {
    return false
  }

  let fullBb: BBoxObject | null = null
  elems.forEach(elem => {
    if (fullBb) {
      return
    }
    if (!elem.parentNode) {
      return
    }
    fullBb = getBBoxWithTransform(elem, addSVGElementsFromJson, pathActions)
  })

  // This shouldn't ever happen...
  if (!fullBb) {
    return null
  }
  // After null check, help TS see fullBb is definitely BBoxObject
  const definedBb: BBoxObject = fullBb

  // fullBb doesn't include the stoke, so this does no good!
  // if (elems.length == 1) return fullBb;

  let maxX = definedBb.x + definedBb.width
  let maxY = definedBb.y + definedBb.height
  let minX = definedBb.x
  let minY = definedBb.y

  // If only one elem, don't call the potentially slow getBBoxWithTransform method again.
  if (elems.length === 1) {
    const offset = getStrokeOffsetForBBox(elems[0] as Element) // safe: length===1 guard above
    minX -= offset
    minY -= offset
    maxX += offset
    maxY += offset
  } else {
    elems.forEach(elem => {
      const curBb = getBBoxWithTransform(
        elem,
        addSVGElementsFromJson,
        pathActions
      )
      if (curBb && elem.nodeType === 1) {
        const offset = getStrokeOffsetForBBox(elem)
        minX = Math.min(minX, curBb.x - offset)
        minY = Math.min(minY, curBb.y - offset)
        maxX = Math.max(maxX, curBb.x + curBb.width + offset)
        maxY = Math.max(maxY, curBb.y + curBb.height + offset)
      }
    })
  }

  definedBb.x = shortFloat(minX) as number
  definedBb.y = shortFloat(minY) as number
  definedBb.width = shortFloat(maxX - minX) as number
  definedBb.height = shortFloat(maxY - minY) as number
  return definedBb
}

/**
 * Get all elements that have a BBox (excludes `<defs>`, `<title>`, etc).
 * Note that 0-opacity, off-screen etc elements are still considered "visible"
 * for this function.
 * @function module:utilities.getVisibleElements
 */
export const getVisibleElements = (parentElement?: Element | null): Element[] => {
  if (!parentElement) {
    const svgContent: SVGSVGElement = svgCanvas.getSvgContent()
    for (let i = 0; i < svgContent.children.length; i++) {
      const child = svgContent.children[i] as SVGGraphicsElement & { getBBox?: () => SVGRect }
      if (child?.getBBox) {
        const bbox = child.getBBox()
        if (
          bbox.width !== 0 &&
          bbox.height !== 0 &&
          bbox.width !== 0 &&
          bbox.height !== 0
        ) {
          parentElement = svgContent.children[i]  // safe: loop i within length bounds
          break
        }
      }
    }
  }

  const contentElems: Element[] = []
  if (parentElement) {
    const children = parentElement.children
    Array.from(children, elem => {
      if ((elem as SVGGraphicsElement & { getBBox?: () => SVGRect }).getBBox) {
        contentElems.push(elem)
      }
    })
  }
  return contentElems.reverse()
}

/**
 * Get the bounding box for one or more stroked and/or transformed elements.
 * @function module:utilities.getStrokedBBoxDefaultVisible
 */
export const getStrokedBBoxDefaultVisible = (elems?: Element[] | null): BBoxObject | false | null => {
  const resolvedElems = elems ?? getVisibleElements()
  return getStrokedBBox(
    resolvedElems,
    svgCanvas.addSVGElementsFromJson,
    svgCanvas.pathActions
  )
}

/**
 * Get the rotation angle of the given transform list.
 * @function module:utilities.getRotationAngleFromTransformList
 * @param toRad - When true returns the value in radians rather than degrees
 * @returns The angle in degrees or radians
 */
/** Get the rotation angle from a transform list. Returns degrees unless toRad=true. */
export const getRotationAngleFromTransformList = (tlist: SVGTransformList | undefined | null, toRad?: boolean): number => {
  if (!tlist) {
    return 0
  } // <svg> element have no tlist
  for (let i = 0; i < tlist.numberOfItems; ++i) {
    const xform = tlist.getItem(i)
    if (xform.type === 4) {
      return toRad ? (xform.angle * Math.PI) / 180.0 : xform.angle
    }
  }
  return 0.0
}

/** Get the rotation angle of the given/selected DOM element. */
export let getRotationAngle = (elem?: Element | null, toRad?: boolean): number => {
  const selected = elem ?? (svgCanvas.getSelectedElements() as Element[])[0]
  if (!selected) return 0
  const tlist = getTransformList(selected)
  return getRotationAngleFromTransformList(tlist, toRad)
}

/** Get the reference element associated with the given attribute value. */
export const getRefElem = (attrVal: string | null | undefined): Element | null => {
  if (!attrVal) return null
  const url = getUrlFromAttr(attrVal)
  if (!url) return null
  const id = url[0] === '#' ? url.slice(1) : url
  return getElement(id)
}

/** Get a feGaussianBlur child of an element, if present. */
export const getFeGaussianBlur = (ele: Element | null | undefined): Element | null => {
  if (ele && (ele.firstChild as Element | null)?.tagName === 'feGaussianBlur') {
    return ele.firstChild as Element
  } else if (ele) {
    const childrens = ele.children
    for (const [, value] of Object.entries(childrens)) {
      if (value.tagName === 'feGaussianBlur') {
        return value
      }
    }
  }
  return null
}

/** Escape a string for safe embedding inside a double-quoted CSS attribute-selector value. */
export const cssAttrValue = (value: string): string => value.replace(/["\\]/g, '\\$&')

/** Get a DOM element by ID within the SVG root element. */
export const getElement = (id: string): Element | null => {
  if (!svgroot_) return null
  // getElementById is exact-match and immune to CSS-selector injection from ids
  // carried in url(#…)/xlink:href references; `querySelector('#'+id)` throws on
  // selector metacharacters (`]`, `:`, quotes, …) and aborts the caller (#35).
  const root = svgroot_ as unknown as { getElementById?: (elementId: string) => Element | null }
  if (typeof root.getElementById === 'function') {
    return root.getElementById(id)
  }
  try {
    return svgroot_.querySelector(`#${CSS.escape(id)}`) ?? null
  } catch {
    return null
  }
}

/**
 * Assigns multiple attributes to an element.
 * @function module:utilities.assignAttributes
 * @param [suspendLength] - Milliseconds to suspend redraw
 * @param [unitCheck=false] - Boolean to indicate the need to use units.setUnitAttr
 */
export const assignAttributes = (
  elem: Element,
  attrs: Record<string, string | number | undefined>,
  suspendLength?: number,
  unitCheck?: boolean
): void => {
  void suspendLength // parameter kept for API compatibility
  for (const [key, value] of Object.entries(attrs)) {
    const ns =
      key.startsWith('xml:')
        ? NS.XML
        : key.startsWith('xlink:')
          ? NS.XLINK
          : null
    if (value === undefined) {
      if (ns) {
        elem.removeAttributeNS(ns, key)
      } else {
        elem.removeAttribute(key)
      }
      continue
    }
    const strValue = String(value)
    if (ns) {
      elem.setAttributeNS(ns, key, strValue)
    } else if (!unitCheck) {
      elem.setAttribute(key, strValue)
    } else {
      setUnitAttr(elem, key, strValue)
    }
  }
}

/**
 * Remove unneeded (default) attributes, making resulting SVG smaller.
 * @function module:utilities.cleanupElement
 */
export const cleanupElement = (element: Element): void => {
  const defaults: Record<string, string | number | undefined> = {
    'fill-opacity': 1,
    'stop-opacity': 1,
    opacity: 1,
    stroke: 'none',
    'stroke-dasharray': 'none',
    'stroke-linejoin': 'miter',
    'stroke-linecap': 'butt',
    'stroke-opacity': 1,
    'stroke-width': 1,
    rx: 0,
    ry: 0
  }

  if (element.nodeName === 'ellipse') {
    // Ellipse elements require rx and ry attributes
    delete defaults.rx
    delete defaults.ry
  }

  Object.entries(defaults).forEach(([attr, val]) => {
    if (element.getAttribute(attr) === String(val)) {
      element.removeAttribute(attr)
    }
  })
}

/**
 * Round value to for snapping.
 * @function module:utilities.snapToGrid
 */
export const snapToGrid = (value: number): number => {
  const unit: string = svgCanvas.getBaseUnit()
  let stepSize: number = Number(svgCanvas.getSnappingStep())
  if (unit !== 'px') {
    stepSize *= getTypeMap()[unit] ?? 1
  }
  return Math.round(value / stepSize) * stepSize
}

/** Prevents default browser click behaviour on the given element. */
export const preventClickDefault = (img: Element): void => {
  $click(img, (e: Event) => {
    e.preventDefault()
  })
}

/**
 * @callback module:utilities.GetNextID
 */

/**
 * Whether a value is `null` or `undefined`.
 */
/** Whether a value is `null` or `undefined`. */
export const isNullish = (val: unknown): val is null | undefined => {
  return val === null || val === undefined
}

/** Overwrite methods for unit testing. */
export const mock = ({
  getHref: getHrefUser,
  setHref: setHrefUser,
  getRotationAngle: getRotationAngleUser
}: {
  getHref: typeof getHref
  setHref: typeof setHref
  getRotationAngle: typeof getRotationAngle
}): void => {
  getHref = getHrefUser
  setHref = setHrefUser
  getRotationAngle = getRotationAngleUser
}

/** Parses an HTML string and returns the first child element/node. */
export const stringToHTML = (str: string): ChildNode | null => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(str, 'text/html')
  return doc.body.firstChild
}

/** Inserts a parsed HTML string as a child of parent at a given index. */
export const insertChildAtIndex = (parent: Element, child: string, index = 0): void => {
  const doc = stringToHTML(child)
  if (!doc) return
  if (index >= parent.children.length) {
    parent.appendChild(doc)
  } else {
    parent.insertBefore(doc, parent.children[index] ?? null)
  }
}

// shortcuts to common DOM functions
/** Get a DOM element by ID. */
export const $id = (id: string): HTMLElement | null => document.getElementById(id)
/** Get the first element matching a CSS selector. */
export const $qq = (sel: string): Element | null => document.querySelector(sel)
/** Get all elements matching a CSS selector as an array. */
export const $qa = (sel: string): Element[] => [...document.querySelectorAll(sel)]
/** Attach a click handler to both click and touchend events for cross-device support. */
export const $click = (element: EventTarget, handler: EventListenerOrEventListenerObject): void => {
  element.addEventListener('click', handler)
  element.addEventListener('touchend', handler)
}
