/**
 * Mathematical utilities.
 * @module math
 * @license MIT
 *
 * (c)2010 Alexis Deveria, (c)2010 Jeff Schiller
 */

import { NS } from './namespaces.js'
import { warn } from '../common/logger.js'

/** A coordinate with x and y values. */
export interface XYObject {
  x: number
  y: number
}

/** Result of snapToAngle: snapped x/y coords + the snap angle (radians). */
export interface AngleCoord45 {
  x: number
  y: number
  a: number
}

/** A transformed box with all four corners and the axis-aligned bounding box. */
export interface TransformedBox {
  tl: XYObject
  tr: XYObject
  bl: XYObject
  br: XYObject
  aabox: {
    x: number
    y: number
    width: number
    height: number
  }
}

// Constants
const NEAR_ZERO = 1e-10

// Create a throwaway SVG element for matrix operations
const svg = document.createElementNS(NS.SVG, 'svg')

const createTransformFromMatrix = (m: SVGMatrix): SVGTransform => {
  const createFallback = (matrix: SVGMatrix): SVGMatrix => {
    const fallback = svg.createSVGMatrix()
    Object.assign(fallback, {
      a: matrix.a,
      b: matrix.b,
      c: matrix.c,
      d: matrix.d,
      e: matrix.e,
      f: matrix.f
    })
    return fallback
  }

  try {
    return svg.createSVGTransformFromMatrix(m)
  } catch {
    const t = svg.createSVGTransform()
    try {
      t.setMatrix(m)
      return t
    } catch {
      try {
        return svg.createSVGTransformFromMatrix(createFallback(m))
      } catch {
        t.setMatrix(createFallback(m))
        return t
      }
    }
  }
}

/**
 * Transforms a point by a given matrix without DOM calls.
 */
export const transformPoint = (x: number, y: number, m: SVGMatrix): XYObject => ({
  x: m.a * x + m.c * y + m.e,
  y: m.b * x + m.d * y + m.f
})

/**
 * Gets the transform list (baseVal) from an element if it exists.
 */
export const getTransformList = (elem: Element): SVGTransformList | undefined => {
  const withTransform = elem as Element & {
    transform?: { baseVal: SVGTransformList }
    gradientTransform?: { baseVal: SVGTransformList }
    patternTransform?: { baseVal: SVGTransformList }
  }
  if (withTransform.transform?.baseVal) {
    return withTransform.transform.baseVal
  }
  if (withTransform.gradientTransform?.baseVal) {
    return withTransform.gradientTransform.baseVal
  }
  if (withTransform.patternTransform?.baseVal) {
    return withTransform.patternTransform.baseVal
  }
  warn('No transform list found. Check browser compatibility.', elem, 'math')
  return undefined
}

/**
 * Checks if a matrix is the identity matrix.
 */
export const isIdentity = (m: SVGMatrix): boolean =>
  Math.abs(m.a - 1) < NEAR_ZERO &&
  Math.abs(m.b) < NEAR_ZERO &&
  Math.abs(m.c) < NEAR_ZERO &&
  Math.abs(m.d - 1) < NEAR_ZERO &&
  Math.abs(m.e) < NEAR_ZERO &&
  Math.abs(m.f) < NEAR_ZERO

/**
 * Multiplies multiple matrices together (m1 * m2 * ...).
 * Near-zero values are rounded to zero.
 */
export const matrixMultiply = (...args: SVGMatrix[]): SVGMatrix => {
  if (args.length === 0) {
    return svg.createSVGMatrix()
  }

  const normalizeNearZero = (matrix: SVGMatrix): SVGMatrix => {
    const props = ['a', 'b', 'c', 'd', 'e', 'f'] as const
    for (const prop of props) {
      if (Math.abs(matrix[prop]) < NEAR_ZERO) {
        // SVGMatrix properties are read-only on the interface but writable at runtime
        ;(matrix as unknown as Record<string, number>)[prop] = 0
      }
    }
    return matrix
  }

  if (typeof DOMMatrix === 'function' && typeof DOMMatrix.fromMatrix === 'function') {
    const result = args.reduce(
      // Pass each SVGMatrix straight to multiply() — it reads the a–f members as a
      // DOMMatrixInit — instead of allocating a throwaway DOMMatrix per arg via
      // fromMatrix() on every transform multiply (#67).
      (acc, curr) => acc.multiply(curr),
      new DOMMatrix()
    )

    const out = svg.createSVGMatrix()
    Object.assign(out, {
      a: result.a,
      b: result.b,
      c: result.c,
      d: result.d,
      e: result.e,
      f: result.f
    })

    return normalizeNearZero(out)
  }

  let m = svg.createSVGMatrix()
  for (const curr of args) {
    const next = svg.createSVGMatrix()
    Object.assign(next, {
      a: m.a * curr.a + m.c * curr.b,
      b: m.b * curr.a + m.d * curr.b,
      c: m.a * curr.c + m.c * curr.d,
      d: m.b * curr.c + m.d * curr.d,
      e: m.a * curr.e + m.c * curr.f + m.e,
      f: m.b * curr.e + m.d * curr.f + m.f
    })
    m = next
  }

  return normalizeNearZero(m)
}

/**
 * Checks if a transform list includes a non-identity matrix transform.
 */
export const hasMatrixTransform = (tlist: SVGTransformList | undefined | null): boolean => {
  if (!tlist) return false
  for (let i = 0; i < tlist.numberOfItems; i++) {
    const xform = tlist.getItem(i)
    if (
      xform.type === SVGTransform.SVG_TRANSFORM_MATRIX &&
      !isIdentity(xform.matrix)
    ) {
      return true
    }
  }
  return false
}

/**
 * Transforms a rectangular box using a given matrix.
 */
export const transformBox = (l: number, t: number, w: number, h: number, m: SVGMatrix): TransformedBox => {
  const tl = transformPoint(l, t, m)
  const tr = transformPoint(l + w, t, m)
  const bl = transformPoint(l, t + h, m)
  const br = transformPoint(l + w, t + h, m)

  const minx = Math.min(tl.x, tr.x, bl.x, br.x)
  const maxx = Math.max(tl.x, tr.x, bl.x, br.x)
  const miny = Math.min(tl.y, tr.y, bl.y, br.y)
  const maxy = Math.max(tl.y, tr.y, bl.y, br.y)

  return {
    tl,
    tr,
    bl,
    br,
    aabox: {
      x: minx,
      y: miny,
      width: maxx - minx,
      height: maxy - miny
    }
  }
}

/**
 * Consolidates a transform list into a single matrix transform without modifying the original list.
 */
export const transformListToTransform = (
  tlist: SVGTransformList | undefined | null,
  min = 0,
  max: number | null = null
): SVGTransform => {
  if (!tlist) {
    return createTransformFromMatrix(svg.createSVGMatrix())
  }

  const start = Number.parseInt(String(min), 10)
  const end = Number.parseInt(String(max ?? tlist.numberOfItems - 1), 10)
  const [low, high] = [Math.min(start, end), Math.max(start, end)]

  const matrices: SVGMatrix[] = []
  for (let i = low; i <= high; i++) {
    const matrix = (i >= 0 && i < tlist.numberOfItems)
      ? tlist.getItem(i).matrix
      : svg.createSVGMatrix()
    matrices.push(matrix)
  }

  const combinedMatrix = matrixMultiply(...matrices)

  const out = svg.createSVGMatrix()
  Object.assign(out, {
    a: combinedMatrix.a,
    b: combinedMatrix.b,
    c: combinedMatrix.c,
    d: combinedMatrix.d,
    e: combinedMatrix.e,
    f: combinedMatrix.f
  })

  return createTransformFromMatrix(out)
}

/**
 * Gets the matrix of a given element's transform list.
 */
export const getMatrix = (elem: Element): SVGMatrix => {
  const tlist = getTransformList(elem)
  return transformListToTransform(tlist).matrix
}

/**
 * Returns a coordinate snapped to the nearest 45-degree angle.
 */
export const snapToAngle = (x1: number, y1: number, x2: number, y2: number): AngleCoord45 => {
  const snap = Math.PI / 4 // 45 degrees
  const dx = x2 - x1
  const dy = y2 - y1
  const angle = Math.atan2(dy, dx)
  const dist = Math.hypot(dx, dy)
  const snapAngle = Math.round(angle / snap) * snap

  return {
    x: x1 + dist * Math.cos(snapAngle),
    y: y1 + dist * Math.sin(snapAngle),
    a: snapAngle
  }
}

/** A rectangle with x, y, width, height. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Checks if two rectangles intersect.
 */
export const rectsIntersect = (r1: Rect, r2: Rect): boolean =>
  r2.x < r1.x + r1.width &&
  r2.x + r2.width > r1.x &&
  r2.y < r1.y + r1.height &&
  r2.y + r2.height > r1.y
