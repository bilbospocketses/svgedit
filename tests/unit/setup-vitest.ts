import { AssertionError, strict as nodeAssert } from 'node:assert'

type ExtendedAssert = typeof nodeAssert & {
  closeTo: (actual: number, expected: number, delta: number, message?: string) => void
  close: (actual: number, expected: number, delta: number, message?: string) => void
  notOk: (val: unknown, message?: string) => void
  isBelow: (val: number, limit: number, message?: string) => void
}

declare global {
  // eslint-disable-next-line no-var
  var before: typeof beforeAll
  // eslint-disable-next-line no-var
  var after: typeof afterAll
}

// Provide a global assert (some legacy tests expect it). The module-local const
// shadows vitest's ambient `assert`; the cast sets it on globalThis (which
// lib.dom does not type) so the bare global resolves to our node assert + helpers.
const assert = nodeAssert as ExtendedAssert
;(globalThis as unknown as { assert: ExtendedAssert }).assert = assert

// Add a lightweight closeTo helper to mimic chai.assert.closeTo.
assert.closeTo = function (actual: number, expected: number, delta: number, message?: string): void {
  const ok = Math.abs(actual - expected) <= delta
  if (!ok) {
    throw new AssertionError({
      message: message || `expected ${actual} to be within ${delta} of ${expected}`,
      actual,
      expected
    })
  }
}

// Mocha-style aliases expected by legacy tests.
globalThis.before = beforeAll
globalThis.after = afterAll

// JSDOM lacks many SVG APIs; provide minimal stubs used in tests.
const win = (globalThis.window || globalThis) as unknown as Record<string, unknown>

// Simple SVG matrix/transform/point polyfills good enough for unit tests.
class SVGMatrixPolyfill {
  a: number; b: number; c: number; d: number; e: number; f: number
  constructor (a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f
  }

  multiply (m: SVGMatrixPolyfill): SVGMatrixPolyfill {
    return new SVGMatrixPolyfill(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f
    )
  }

  translate (x: number, y: number): SVGMatrixPolyfill { return this.multiply(new SVGMatrixPolyfill(1, 0, 0, 1, x, y)) }
  scale (s: number, _sy?: number): SVGMatrixPolyfill { return this.multiply(new SVGMatrixPolyfill(s, 0, 0, s, 0, 0)) }
  scaleNonUniform (sx: number, sy: number): SVGMatrixPolyfill { return this.multiply(new SVGMatrixPolyfill(sx, 0, 0, sy, 0, 0)) }
  rotate (deg: number): SVGMatrixPolyfill {
    const rad = deg * Math.PI / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    return this.multiply(new SVGMatrixPolyfill(cos, sin, -sin, cos, 0, 0))
  }

  flipX () { return this.scale(-1, 1) }
  flipY () { return this.scale(1, -1) }
  skewX (deg: number): SVGMatrixPolyfill {
    const rad = deg * Math.PI / 180
    return this.multiply(new SVGMatrixPolyfill(1, 0, Math.tan(rad), 1, 0, 0))
  }

  skewY (deg: number): SVGMatrixPolyfill {
    const rad = deg * Math.PI / 180
    return this.multiply(new SVGMatrixPolyfill(1, Math.tan(rad), 0, 1, 0, 0))
  }

  inverse () {
    const det = this.a * this.d - this.b * this.c
    if (!det) return new SVGMatrixPolyfill()
    return new SVGMatrixPolyfill(
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det
    )
  }
}

class SVGTransformPolyfill {
  static readonly SVG_TRANSFORM_UNKNOWN = 0
  static readonly SVG_TRANSFORM_MATRIX = 1
  static readonly SVG_TRANSFORM_TRANSLATE = 2
  static readonly SVG_TRANSFORM_SCALE = 3
  static readonly SVG_TRANSFORM_ROTATE = 4
  static readonly SVG_TRANSFORM_SKEWX = 5
  static readonly SVG_TRANSFORM_SKEWY = 6
  type: number
  matrix: SVGMatrixPolyfill
  angle?: number
  cx?: number
  cy?: number
  constructor (type = SVGTransformPolyfill.SVG_TRANSFORM_MATRIX, matrix = new SVGMatrixPolyfill()) {
    this.type = type
    this.matrix = matrix
  }

  setMatrix (matrix: SVGMatrixPolyfill): void {
    this.type = SVGTransformPolyfill.SVG_TRANSFORM_MATRIX
    this.matrix = matrix
  }

  setTranslate (x: number, y: number): void {
    this.type = SVGTransformPolyfill.SVG_TRANSFORM_TRANSLATE
    this.matrix = new SVGMatrixPolyfill(1, 0, 0, 1, x, y)
  }

  setScale (sx: number, sy = sx): void {
    this.type = SVGTransformPolyfill.SVG_TRANSFORM_SCALE
    this.matrix = new SVGMatrixPolyfill(sx, 0, 0, sy, 0, 0)
  }

  setRotate (angle: number, cx = 0, cy = 0): void {
    // Translate to center, rotate, then translate back.
    const ang = Number(angle) || 0
    const cxNum = Number(cx) || 0
    const cyNum = Number(cy) || 0
    const rotate = new SVGMatrixPolyfill().translate(cxNum, cyNum).rotate(ang).translate(-cxNum, -cyNum)
    this.type = SVGTransformPolyfill.SVG_TRANSFORM_ROTATE
    this.angle = ang
    this.cx = cxNum
    this.cy = cyNum
    this.matrix = rotate
  }
}

class SVGTransformListPolyfill {
  _items: SVGTransformPolyfill[]
  constructor () {
    this._items = []
  }

  get numberOfItems (): number { return this._items.length }
  getItem (i: number): SVGTransformPolyfill { return this._items[i]! }
  appendItem (item: SVGTransformPolyfill): SVGTransformPolyfill { this._items.push(item); return item }
  insertItemBefore (item: SVGTransformPolyfill, index: number): SVGTransformPolyfill {
    const idx = Math.max(0, Math.min(index, this._items.length))
    this._items.splice(idx, 0, item)
    return item
  }

  removeItem (index: number): SVGTransformPolyfill | undefined {
    if (index < 0 || index >= this._items.length) return undefined
    const [removed] = this._items.splice(index, 1)
    return removed
  }

  clear (): void { this._items = [] }
  initialize (item: SVGTransformPolyfill): SVGTransformPolyfill { this._items = [item]; return item }
  consolidate (): SVGTransformPolyfill | null {
    if (!this._items.length) return null
    const matrix = this._items.reduce(
      (acc: SVGMatrixPolyfill, t: SVGTransformPolyfill) => acc.multiply(t.matrix),
      new SVGMatrixPolyfill()
    )
    const consolidated = new SVGTransformPolyfill()
    consolidated.setMatrix(matrix)
    this._items = [consolidated]
    return consolidated
  }
}

const parseTransformAttr = (attr: string | null): SVGTransformListPolyfill => {
  const list = new SVGTransformListPolyfill()
  if (!attr) return list
  const matcher = /([a-zA-Z]+)\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = matcher.exec(attr))) {
    const [, type, raw = ''] = match
    const nums = raw.split(/[,\s]+/).filter(Boolean).map(Number)
    const t = new SVGTransformPolyfill()
    switch (type) {
      case 'matrix':
        t.setMatrix(new SVGMatrixPolyfill(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]))
        break
      case 'translate':
        t.setTranslate(nums[0] ?? 0, nums[1] ?? 0)
        break
      case 'scale':
        t.setScale(nums[0] ?? 1, nums[1] ?? nums[0] ?? 1)
        break
      case 'rotate':
        t.setRotate(nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0)
        break
      default:
        t.setMatrix(new SVGMatrixPolyfill())
        break
    }
    list.appendItem(t)
  }
  return list
}

const ensureTransformList = (elem: Element & { __transformList?: SVGTransformListPolyfill }): SVGTransformListPolyfill => {
  if (!elem.__transformList) {
    const parsed = parseTransformAttr(elem.getAttribute?.('transform') ?? null)
    elem.__transformList = parsed
  }
  return elem.__transformList!
}

if (!win.SVGElement) {
  win.SVGElement = win.Element
}
const svgElementProto = (win.SVGElement as { prototype?: Record<string, unknown> } | undefined)?.prototype

// Basic constructors for missing SVG types.
if (!win.SVGSVGElement) win.SVGSVGElement = win.SVGElement
if (!win.SVGGraphicsElement) win.SVGGraphicsElement = win.SVGElement
if (!win.SVGGeometryElement) win.SVGGeometryElement = win.SVGElement
// Ensure SVGPathElement exists so the pathseg polyfill can patch it.
win.SVGPathElement = win.SVGElement || function SVGPathElement () {}

// Matrix/transform helpers.
win.SVGMatrix = win.SVGMatrix || SVGMatrixPolyfill
win.DOMMatrix = win.DOMMatrix || SVGMatrixPolyfill
win.SVGTransform = win.SVGTransform || SVGTransformPolyfill
win.SVGTransformList = win.SVGTransformList || SVGTransformListPolyfill

if (svgElementProto) {
  if (!svgElementProto.createSVGMatrix) {
    svgElementProto.createSVGMatrix = () => new SVGMatrixPolyfill()
  }
  if (!svgElementProto.createSVGTransform) {
    svgElementProto.createSVGTransform = () => new SVGTransformPolyfill()
  }
  if (!svgElementProto.createSVGTransformFromMatrix) {
    svgElementProto.createSVGTransformFromMatrix = (matrix: SVGMatrixPolyfill) => {
      const t = new SVGTransformPolyfill()
      t.setMatrix(matrix)
      return t
    }
  }
  if (!svgElementProto.createSVGPoint) {
    svgElementProto.createSVGPoint = () => ({
      x: 0,
      y: 0,
      matrixTransform (m: SVGMatrixPolyfill) {
        return {
          x: m.a * this.x + m.c * this.y + m.e,
          y: m.b * this.x + m.d * this.y + m.f
        }
      }
    })
  }
  svgElementProto.getBBox = function (this: Element) {
    const tag = (this.tagName || '').toLowerCase()
    const parseLength = (attr: string, fallback = 0): number => {
      const raw = this.getAttribute?.(attr)
      if (raw == null) return fallback
      const str = String(raw)
      const n = Number.parseFloat(str)
      if (Number.isNaN(n)) return fallback
      if (str.endsWith('in')) return n * 96
      if (str.endsWith('cm')) return n * 96 / 2.54
      if (str.endsWith('mm')) return n * 96 / 25.4
      if (str.endsWith('pt')) return n * 96 / 72
      if (str.endsWith('pc')) return n * 16
      if (str.endsWith('em')) return n * 16
      if (str.endsWith('ex')) return n * 8
      return n
    }
    const parsePoints = () => (this.getAttribute?.('points') || '')
      .trim()
      .split(/\\s+/)
      .map(pair => pair.split(',').map(Number))
      .filter(([x, y]) => !Number.isNaN(x) && !Number.isNaN(y))

    if (tag === 'path') {
      const d = this.getAttribute?.('d') || ''
      const nums = (d.match(/-?\\d*\\.?\\d+/g) || [])
        .map(Number)
        .filter(n => !Number.isNaN(n))
      if (nums.length >= 2) {
        let minx = Infinity; let miny = Infinity
        let maxx = -Infinity; let maxy = -Infinity
        for (let i = 0; i < nums.length; i += 2) {
          const x = nums[i]!; const y = nums[i + 1]!
          if (x < minx) minx = x
          if (x > maxx) maxx = x
          if (y < miny) miny = y
          if (y > maxy) maxy = y
        }
        return {
          x: minx === Infinity ? 0 : minx,
          y: miny === Infinity ? 0 : miny,
          width: maxx === -Infinity ? 0 : maxx - minx,
          height: maxy === -Infinity ? 0 : maxy - miny
        }
      }
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    if (tag === 'rect') {
      const x = parseLength('x')
      const y = parseLength('y')
      const width = parseLength('width')
      const height = parseLength('height')
      return { x, y, width, height }
    }

    if (tag === 'line') {
      const x1 = parseLength('x1'); const y1 = parseLength('y1')
      const x2 = parseLength('x2'); const y2 = parseLength('y2')
      const minx = Math.min(x1, x2); const miny = Math.min(y1, y2)
      return { x: minx, y: miny, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
    }

    if (tag === 'circle') {
      const cx = parseLength('cx'); const cy = parseLength('cy'); const r = parseLength('r') || parseLength('rx') || parseLength('ry')
      return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
    }

    if (tag === 'ellipse') {
      const cx = parseLength('cx'); const cy = parseLength('cy'); const rx = parseLength('rx'); const ry = parseLength('ry')
      return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
    }

    if (tag === 'polyline' || tag === 'polygon') {
      const pts = parsePoints()
      if (!pts.length) return { x: 0, y: 0, width: 0, height: 0 }
      const xs = pts.map(([x]) => x!)
      const ys = pts.map(([, y]) => y!)
      const minx = Math.min(...xs); const maxx = Math.max(...xs)
      const miny = Math.min(...ys); const maxy = Math.max(...ys)
      return { x: minx, y: miny, width: maxx - minx, height: maxy - miny }
    }

    return { x: 0, y: 0, width: 0, height: 0 }
  }
  if (!Object.getOwnPropertyDescriptor(svgElementProto, 'transform')) {
    Object.defineProperty(svgElementProto, 'transform', {
      get (this: Element & { __transformList?: SVGTransformListPolyfill }) {
        const baseVal = ensureTransformList(this)
        return { baseVal }
      }
    })
  }
}

// Ensure SVG shape element constructors exist in jsdom.
if (!win.SVGRectElement) win.SVGRectElement = win.SVGElement
if (!win.SVGCircleElement) win.SVGCircleElement = win.SVGElement
if (!win.SVGEllipseElement) win.SVGEllipseElement = win.SVGElement
if (!win.SVGLineElement) win.SVGLineElement = win.SVGElement
if (!win.SVGPolylineElement) win.SVGPolylineElement = win.SVGElement
if (!win.SVGPolygonElement) win.SVGPolygonElement = win.SVGElement

// Add minimal chai-like helpers some legacy tests expect.
assert.close = (actual, expected, delta, message) =>
  assert.closeTo(actual, expected, delta, message)
assert.notOk = (val, message) => {
  if (val) {
    throw new AssertionError({ message: message || `expected ${val} to be falsy`, actual: val, expected: false })
  }
}
assert.isBelow = (val, limit, message) => {
  if (!(val < limit)) {
    throw new AssertionError({ message: message || `expected ${val} to be below ${limit}`, actual: val, expected: `< ${limit}` })
  }
}
