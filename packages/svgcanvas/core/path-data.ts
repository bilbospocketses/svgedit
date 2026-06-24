/**
 * SVG path data parsing and serialization.
 *
 * Forked from path-data-polyfill 1.3.4 (Jaroslaw Foksa, MIT).
 * Converted from ES5 IIFE + prototype-patching polyfill to a standalone
 * TypeScript module with explicit exports. Parsing/math logic is preserved
 * verbatim; only the surface (var -> const/let, types, module exports,
 * WeakMap cache instead of Symbol-keyed element properties) changed.
 *
 * @module path-data
 * @license MIT
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Represents a single SVG path command with its type letter and numeric value array. */
export interface SVGPathDataCommand {
  type: string
  values: number[]
}

/** Options for getPathData; pass `normalize: true` to reduce commands to M/L/C/Z only. */
export interface SVGPathDataSettings {
  normalize?: boolean | undefined
}

// ---------------------------------------------------------------------------
// Unchecked-index helper
// ---------------------------------------------------------------------------

// With noUncheckedIndexedAccess the compiler types arr[n] as T | undefined.
// The polyfill logic guarantees indices are in-bounds by construction (the
// parser only emits value arrays whose length matches the command type).
// This helper narrows the type at the call-site without a non-null assertion.
function v (arr: number[], i: number): number {
  return arr[i] as number
}

function va (arr: number[][], i: number): number[] {
  return arr[i] as number[]
}

// ---------------------------------------------------------------------------
// Command lookup
// ---------------------------------------------------------------------------

const commandsMap: Record<string, string> = {
  Z: 'Z', M: 'M', L: 'L', C: 'C', Q: 'Q', A: 'A', H: 'H', V: 'V', S: 'S', T: 'T',
  z: 'Z', m: 'm', l: 'l', c: 'c', q: 'q', a: 'a', h: 'h', v: 'v', s: 's', t: 't'
}

// ---------------------------------------------------------------------------
// Source -- path-string tokenizer (logic preserved from original)
// ---------------------------------------------------------------------------

class Source {
  private _string: string
  private _currentIndex: number
  private _endIndex: number
  private _prevCommand: string | null

  constructor (string: string) {
    this._string = string
    this._currentIndex = 0
    this._endIndex = this._string.length
    this._prevCommand = null
    this._skipOptionalSpaces()
  }

  /** Return the character at the given index, or empty string if out of bounds. */
  private _ch (index: number): string {
    return index < this._endIndex ? this._string.charAt(index) : ''
  }

  /** Character at _currentIndex (empty string when past end). */
  private _cur (): string {
    return this._ch(this._currentIndex)
  }

  parseSegment (): SVGPathDataCommand | null {
    const char = this._cur()
    let command: string | null = commandsMap[char] ?? null

    if (command === null) {
      // Possibly an implicit command. Not allowed if this is the first command.
      if (this._prevCommand === null) {
        return null
      }

      // Check for remaining coordinates in the current command.
      if (
        (char === '+' || char === '-' || char === '.' || (char >= '0' && char <= '9')) &&
        this._prevCommand !== 'Z'
      ) {
        if (this._prevCommand === 'M') {
          command = 'L'
        } else if (this._prevCommand === 'm') {
          command = 'l'
        } else {
          command = this._prevCommand
        }
      } else {
        command = null
      }

      if (command === null) {
        return null
      }
    } else {
      this._currentIndex += 1
    }

    this._prevCommand = command

    let values: (number | null)[] | null = null
    const cmd = command.toUpperCase()

    if (cmd === 'H' || cmd === 'V') {
      values = [this._parseNumber()]
    } else if (cmd === 'M' || cmd === 'L' || cmd === 'T') {
      values = [this._parseNumber(), this._parseNumber()]
    } else if (cmd === 'S' || cmd === 'Q') {
      values = [this._parseNumber(), this._parseNumber(), this._parseNumber(), this._parseNumber()]
    } else if (cmd === 'C') {
      values = [
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber()
      ]
    } else if (cmd === 'A') {
      values = [
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseArcFlag(),
        this._parseArcFlag(),
        this._parseNumber(),
        this._parseNumber()
      ]
    } else if (cmd === 'Z') {
      this._skipOptionalSpaces()
      values = []
    }

    if (values === null || values.indexOf(null) >= 0) {
      // Unknown command or known command with invalid values
      return null
    } else {
      return { type: command, values: values as number[] }
    }
  }

  hasMoreData (): boolean {
    return this._currentIndex < this._endIndex
  }

  peekSegmentType (): string | null {
    return commandsMap[this._cur()] ?? null
  }

  initialCommandIsMoveTo (): boolean {
    // If the path is empty it is still valid, so return true.
    if (!this.hasMoreData()) {
      return true
    }

    const command = this.peekSegmentType()
    // Path must start with moveTo.
    return command === 'M' || command === 'm'
  }

  private _isCurrentSpace (): boolean {
    const char = this._cur()
    return char !== '' && char <= ' ' && (char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === '\f')
  }

  private _skipOptionalSpaces (): boolean {
    while (this._currentIndex < this._endIndex && this._isCurrentSpace()) {
      this._currentIndex += 1
    }

    return this._currentIndex < this._endIndex
  }

  private _skipOptionalSpacesOrDelimiter (): boolean {
    if (
      this._currentIndex < this._endIndex &&
      !this._isCurrentSpace() &&
      this._cur() !== ','
    ) {
      return false
    }

    if (this._skipOptionalSpaces()) {
      if (this._currentIndex < this._endIndex && this._cur() === ',') {
        this._currentIndex += 1
        this._skipOptionalSpaces()
      }
    }
    return this._currentIndex < this._endIndex
  }

  // Parse a number from an SVG path. This very closely follows genericParseNumber(...)
  // from Source/core/svg/SVGParserUtilities.cpp.
  // Spec: http://www.w3.org/TR/SVG11/single-page.html#paths-PathDataBNF
  private _parseNumber (): number | null {
    let exponent = 0
    let integer = 0
    let frac = 1
    let decimal = 0
    let sign = 1
    let expsign = 1
    const startIndex = this._currentIndex

    this._skipOptionalSpaces()

    // Read the sign.
    if (this._currentIndex < this._endIndex && this._cur() === '+') {
      this._currentIndex += 1
    } else if (this._currentIndex < this._endIndex && this._cur() === '-') {
      this._currentIndex += 1
      sign = -1
    }

    const curChar = this._cur()
    if (
      this._currentIndex === this._endIndex ||
      (
        (curChar < '0' || curChar > '9') &&
        curChar !== '.'
      )
    ) {
      // The first character of a number must be one of [0-9+-.].
      return null
    }

    // Read the integer part, build right-to-left.
    const startIntPartIndex = this._currentIndex

    while (
      this._currentIndex < this._endIndex &&
      this._cur() >= '0' &&
      this._cur() <= '9'
    ) {
      this._currentIndex += 1 // Advance to first non-digit.
    }

    if (this._currentIndex !== startIntPartIndex) {
      let scanIntPartIndex = this._currentIndex - 1
      let multiplier = 1

      while (scanIntPartIndex >= startIntPartIndex) {
        integer += multiplier * (Number(this._ch(scanIntPartIndex)) - 0)
        scanIntPartIndex -= 1
        multiplier *= 10
      }
    }

    // Read the decimals.
    if (this._currentIndex < this._endIndex && this._cur() === '.') {
      this._currentIndex += 1

      // There must be a least one digit following the .
      if (
        this._currentIndex >= this._endIndex ||
        this._cur() < '0' ||
        this._cur() > '9'
      ) {
        return null
      }

      while (
        this._currentIndex < this._endIndex &&
        this._cur() >= '0' &&
        this._cur() <= '9'
      ) {
        frac *= 10
        decimal += (Number(this._string.charAt(this._currentIndex)) - 0) / frac
        this._currentIndex += 1
      }
    }

    // Read the exponent part.
    if (
      this._currentIndex !== startIndex &&
      this._currentIndex + 1 < this._endIndex &&
      (this._cur() === 'e' || this._cur() === 'E') &&
      (this._ch(this._currentIndex + 1) !== 'x' && this._ch(this._currentIndex + 1) !== 'm')
    ) {
      this._currentIndex += 1

      // Read the sign of the exponent.
      if (this._cur() === '+') {
        this._currentIndex += 1
      } else if (this._cur() === '-') {
        this._currentIndex += 1
        expsign = -1
      }

      // There must be an exponent.
      if (
        this._currentIndex >= this._endIndex ||
        this._cur() < '0' ||
        this._cur() > '9'
      ) {
        return null
      }

      while (
        this._currentIndex < this._endIndex &&
        this._cur() >= '0' &&
        this._cur() <= '9'
      ) {
        exponent *= 10
        exponent += (Number(this._cur()) - 0)
        this._currentIndex += 1
      }
    }

    let number = integer + decimal
    number *= sign

    if (exponent) {
      number *= Math.pow(10, expsign * exponent)
    }

    if (startIndex === this._currentIndex) {
      return null
    }

    this._skipOptionalSpacesOrDelimiter()

    return number
  }

  private _parseArcFlag (): number | null {
    if (this._currentIndex >= this._endIndex) {
      return null
    }

    let flag: number | null = null
    const flagChar = this._cur()

    this._currentIndex += 1

    if (flagChar === '0') {
      flag = 0
    } else if (flagChar === '1') {
      flag = 1
    } else {
      return null
    }

    this._skipOptionalSpacesOrDelimiter()
    return flag
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (logic preserved verbatim from original)
// ---------------------------------------------------------------------------

function clonePathData (pathData: SVGPathDataCommand[]): SVGPathDataCommand[] {
  return pathData.map(function (seg) {
    return { type: seg.type, values: Array.prototype.slice.call(seg.values) as number[] }
  })
}

// @info
//   Takes any path data, returns path data that consists only from absolute commands.
function absolutizePathData (pathData: SVGPathDataCommand[]): SVGPathDataCommand[] {
  const absolutizedPathData: SVGPathDataCommand[] = []

  let currentX = 0
  let currentY = 0

  let subpathX = 0
  let subpathY = 0

  pathData.forEach(function (seg) {
    const type = seg.type

    if (type === 'M') {
      const x = v(seg.values, 0)
      const y = v(seg.values, 1)

      absolutizedPathData.push({ type: 'M', values: [x, y] })

      subpathX = x
      subpathY = y

      currentX = x
      currentY = y
    } else if (type === 'm') {
      const x = currentX + v(seg.values, 0)
      const y = currentY + v(seg.values, 1)

      absolutizedPathData.push({ type: 'M', values: [x, y] })

      subpathX = x
      subpathY = y

      currentX = x
      currentY = y
    } else if (type === 'L') {
      const x = v(seg.values, 0)
      const y = v(seg.values, 1)

      absolutizedPathData.push({ type: 'L', values: [x, y] })

      currentX = x
      currentY = y
    } else if (type === 'l') {
      const x = currentX + v(seg.values, 0)
      const y = currentY + v(seg.values, 1)

      absolutizedPathData.push({ type: 'L', values: [x, y] })

      currentX = x
      currentY = y
    } else if (type === 'C') {
      const x1 = v(seg.values, 0)
      const y1 = v(seg.values, 1)
      const x2 = v(seg.values, 2)
      const y2 = v(seg.values, 3)
      const x = v(seg.values, 4)
      const y = v(seg.values, 5)

      absolutizedPathData.push({ type: 'C', values: [x1, y1, x2, y2, x, y] })

      currentX = x
      currentY = y
    } else if (type === 'c') {
      const x1 = currentX + v(seg.values, 0)
      const y1 = currentY + v(seg.values, 1)
      const x2 = currentX + v(seg.values, 2)
      const y2 = currentY + v(seg.values, 3)
      const x = currentX + v(seg.values, 4)
      const y = currentY + v(seg.values, 5)

      absolutizedPathData.push({ type: 'C', values: [x1, y1, x2, y2, x, y] })

      currentX = x
      currentY = y
    } else if (type === 'Q') {
      const x1 = v(seg.values, 0)
      const y1 = v(seg.values, 1)
      const x = v(seg.values, 2)
      const y = v(seg.values, 3)

      absolutizedPathData.push({ type: 'Q', values: [x1, y1, x, y] })

      currentX = x
      currentY = y
    } else if (type === 'q') {
      const x1 = currentX + v(seg.values, 0)
      const y1 = currentY + v(seg.values, 1)
      const x = currentX + v(seg.values, 2)
      const y = currentY + v(seg.values, 3)

      absolutizedPathData.push({ type: 'Q', values: [x1, y1, x, y] })

      currentX = x
      currentY = y
    } else if (type === 'A') {
      const x = v(seg.values, 5)
      const y = v(seg.values, 6)

      absolutizedPathData.push({
        type: 'A',
        values: [v(seg.values, 0), v(seg.values, 1), v(seg.values, 2), v(seg.values, 3), v(seg.values, 4), x, y]
      })

      currentX = x
      currentY = y
    } else if (type === 'a') {
      const x = currentX + v(seg.values, 5)
      const y = currentY + v(seg.values, 6)

      absolutizedPathData.push({
        type: 'A',
        values: [v(seg.values, 0), v(seg.values, 1), v(seg.values, 2), v(seg.values, 3), v(seg.values, 4), x, y]
      })

      currentX = x
      currentY = y
    } else if (type === 'H') {
      const x = v(seg.values, 0)
      absolutizedPathData.push({ type: 'H', values: [x] })
      currentX = x
    } else if (type === 'h') {
      const x = currentX + v(seg.values, 0)
      absolutizedPathData.push({ type: 'H', values: [x] })
      currentX = x
    } else if (type === 'V') {
      const y = v(seg.values, 0)
      absolutizedPathData.push({ type: 'V', values: [y] })
      currentY = y
    } else if (type === 'v') {
      const y = currentY + v(seg.values, 0)
      absolutizedPathData.push({ type: 'V', values: [y] })
      currentY = y
    } else if (type === 'S') {
      const x2 = v(seg.values, 0)
      const y2 = v(seg.values, 1)
      const x = v(seg.values, 2)
      const y = v(seg.values, 3)

      absolutizedPathData.push({ type: 'S', values: [x2, y2, x, y] })

      currentX = x
      currentY = y
    } else if (type === 's') {
      const x2 = currentX + v(seg.values, 0)
      const y2 = currentY + v(seg.values, 1)
      const x = currentX + v(seg.values, 2)
      const y = currentY + v(seg.values, 3)

      absolutizedPathData.push({ type: 'S', values: [x2, y2, x, y] })

      currentX = x
      currentY = y
    } else if (type === 'T') {
      const x = v(seg.values, 0)
      const y = v(seg.values, 1)

      absolutizedPathData.push({ type: 'T', values: [x, y] })

      currentX = x
      currentY = y
    } else if (type === 't') {
      const x = currentX + v(seg.values, 0)
      const y = currentY + v(seg.values, 1)

      absolutizedPathData.push({ type: 'T', values: [x, y] })

      currentX = x
      currentY = y
    } else if (type === 'Z' || type === 'z') {
      absolutizedPathData.push({ type: 'Z', values: [] })

      currentX = subpathX
      currentY = subpathY
    }
  })

  return absolutizedPathData
}

// ---------------------------------------------------------------------------
// arcToCubicCurves (logic preserved verbatim from original)
// ---------------------------------------------------------------------------

// @info
//   Get an array of corresponding cubic bezier curve parameters for given arc curve parameters.
function arcToCubicCurves (
  x1: number, y1: number, x2: number, y2: number,
  r1: number, r2: number,
  angle: number, largeArcFlag: number, sweepFlag: number,
  _recursive?: [number, number, number, number]
): number[][] {
  const degToRad = function (degrees: number): number {
    return (Math.PI * degrees) / 180
  }

  const rotate = function (x: number, y: number, angleRad: number): { x: number, y: number } {
    const X = x * Math.cos(angleRad) - y * Math.sin(angleRad)
    const Y = x * Math.sin(angleRad) + y * Math.cos(angleRad)
    return { x: X, y: Y }
  }

  const angleRad = degToRad(angle)
  let params: number[][] = []
  let f1: number, f2: number, cx: number, cy: number

  if (_recursive) {
    f1 = _recursive[0]
    f2 = _recursive[1]
    cx = _recursive[2]
    cy = _recursive[3]
  } else {
    const p1 = rotate(x1, y1, -angleRad)
    x1 = p1.x
    y1 = p1.y

    const p2 = rotate(x2, y2, -angleRad)
    x2 = p2.x
    y2 = p2.y

    const x = (x1 - x2) / 2
    const y = (y1 - y2) / 2
    let h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2)

    if (h > 1) {
      h = Math.sqrt(h)
      r1 = h * r1
      r2 = h * r2
    }

    let sign: number

    if (largeArcFlag === sweepFlag) {
      sign = -1
    } else {
      sign = 1
    }

    const r1Pow = r1 * r1
    const r2Pow = r2 * r2

    const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x
    const right = r1Pow * y * y + r2Pow * x * x

    const k = sign * Math.sqrt(Math.abs(left / right))

    cx = k * r1 * y / r2 + (x1 + x2) / 2
    cy = k * -r2 * x / r1 + (y1 + y2) / 2

    f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)))
    f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)))

    if (x1 < cx) {
      f1 = Math.PI - f1
    }
    if (x2 < cx) {
      f2 = Math.PI - f2
    }

    if (f1 < 0) {
      f1 = Math.PI * 2 + f1
    }
    if (f2 < 0) {
      f2 = Math.PI * 2 + f2
    }

    if (sweepFlag && f1 > f2) {
      f1 = f1 - Math.PI * 2
    }
    if (!sweepFlag && f2 > f1) {
      f2 = f2 - Math.PI * 2
    }
  }

  let df = f2 - f1

  if (Math.abs(df) > (Math.PI * 120 / 180)) {
    const f2old = f2
    const x2old = x2
    const y2old = y2

    if (sweepFlag && f2 > f1) {
      f2 = f1 + (Math.PI * 120 / 180) * (1)
    } else {
      f2 = f1 + (Math.PI * 120 / 180) * (-1)
    }

    x2 = cx + r1 * Math.cos(f2)
    y2 = cy + r2 * Math.sin(f2)
    params = arcToCubicCurves(x2, y2, x2old, y2old, r1, r2, angle, 0, sweepFlag, [f2, f2old, cx, cy])
  }

  df = f2 - f1

  const c1 = Math.cos(f1)
  const s1 = Math.sin(f1)
  const c2 = Math.cos(f2)
  const s2 = Math.sin(f2)
  const t = Math.tan(df / 4)
  const hx = 4 / 3 * r1 * t
  const hy = 4 / 3 * r2 * t

  const m1 = [x1, y1]
  const m2 = [x1 + hx * s1, y1 - hy * c1]
  const m3 = [x2 + hx * s2, y2 - hy * c2]
  const m4 = [x2, y2]

  m2[0] = 2 * v(m1, 0) - v(m2, 0)
  m2[1] = 2 * v(m1, 1) - v(m2, 1)

  if (_recursive) {
    return [m2, m3, m4].concat(params)
  } else {
    params = [m2, m3, m4].concat(params)

    const curves: number[][] = []

    for (let i = 0; i < params.length; i += 3) {
      const p0 = va(params, i)
      const p1 = va(params, i + 1)
      const p2 = va(params, i + 2)
      const rr1 = rotate(v(p0, 0), v(p0, 1), angleRad)
      const rr2 = rotate(v(p1, 0), v(p1, 1), angleRad)
      const rr3 = rotate(v(p2, 0), v(p2, 1), angleRad)
      curves.push([rr1.x, rr1.y, rr2.x, rr2.y, rr3.x, rr3.y])
    }

    return curves
  }
}

// ---------------------------------------------------------------------------
// reducePathData (logic preserved verbatim from original)
// ---------------------------------------------------------------------------

// @info
//   Takes path data that consists only from absolute commands, returns path data
//   that consists only from "M", "L", "C" and "Z" commands.
function reducePathData (pathData: SVGPathDataCommand[]): SVGPathDataCommand[] {
  const reducedPathData: SVGPathDataCommand[] = []
  let lastType: string | null = null

  let lastControlX = 0
  let lastControlY = 0

  let currentX = 0
  let currentY = 0

  let subpathX = 0
  let subpathY = 0

  pathData.forEach(function (seg) {
    if (seg.type === 'M') {
      const x = v(seg.values, 0)
      const y = v(seg.values, 1)

      reducedPathData.push({ type: 'M', values: [x, y] })

      subpathX = x
      subpathY = y

      currentX = x
      currentY = y
    } else if (seg.type === 'C') {
      const x1 = v(seg.values, 0)
      const y1 = v(seg.values, 1)
      const x2 = v(seg.values, 2)
      const y2 = v(seg.values, 3)
      const x = v(seg.values, 4)
      const y = v(seg.values, 5)

      reducedPathData.push({ type: 'C', values: [x1, y1, x2, y2, x, y] })

      lastControlX = x2
      lastControlY = y2

      currentX = x
      currentY = y
    } else if (seg.type === 'L') {
      const x = v(seg.values, 0)
      const y = v(seg.values, 1)

      reducedPathData.push({ type: 'L', values: [x, y] })

      currentX = x
      currentY = y
    } else if (seg.type === 'H') {
      const x = v(seg.values, 0)

      reducedPathData.push({ type: 'L', values: [x, currentY] })

      currentX = x
    } else if (seg.type === 'V') {
      const y = v(seg.values, 0)

      reducedPathData.push({ type: 'L', values: [currentX, y] })

      currentY = y
    } else if (seg.type === 'S') {
      const x2 = v(seg.values, 0)
      const y2 = v(seg.values, 1)
      const x = v(seg.values, 2)
      const y = v(seg.values, 3)

      let cx1: number, cy1: number

      if (lastType === 'C' || lastType === 'S') {
        cx1 = currentX + (currentX - lastControlX)
        cy1 = currentY + (currentY - lastControlY)
      } else {
        cx1 = currentX
        cy1 = currentY
      }

      reducedPathData.push({ type: 'C', values: [cx1, cy1, x2, y2, x, y] })

      lastControlX = x2
      lastControlY = y2

      currentX = x
      currentY = y
    } else if (seg.type === 'T') {
      const x = v(seg.values, 0)
      const y = v(seg.values, 1)

      let x1: number, y1: number

      if (lastType === 'Q' || lastType === 'T') {
        x1 = currentX + (currentX - lastControlX)
        y1 = currentY + (currentY - lastControlY)
      } else {
        x1 = currentX
        y1 = currentY
      }

      const cx1 = currentX + 2 * (x1 - currentX) / 3
      const cy1 = currentY + 2 * (y1 - currentY) / 3
      const cx2 = x + 2 * (x1 - x) / 3
      const cy2 = y + 2 * (y1 - y) / 3

      reducedPathData.push({ type: 'C', values: [cx1, cy1, cx2, cy2, x, y] })

      lastControlX = x1
      lastControlY = y1

      currentX = x
      currentY = y
    } else if (seg.type === 'Q') {
      const x1 = v(seg.values, 0)
      const y1 = v(seg.values, 1)
      const x = v(seg.values, 2)
      const y = v(seg.values, 3)

      const cx1 = currentX + 2 * (x1 - currentX) / 3
      const cy1 = currentY + 2 * (y1 - currentY) / 3
      const cx2 = x + 2 * (x1 - x) / 3
      const cy2 = y + 2 * (y1 - y) / 3

      reducedPathData.push({ type: 'C', values: [cx1, cy1, cx2, cy2, x, y] })

      lastControlX = x1
      lastControlY = y1

      currentX = x
      currentY = y
    } else if (seg.type === 'A') {
      const ar1 = Math.abs(v(seg.values, 0))
      const ar2 = Math.abs(v(seg.values, 1))
      const arcAngle = v(seg.values, 2)
      const largeArcFlag = v(seg.values, 3)
      const sweepFlg = v(seg.values, 4)
      const x = v(seg.values, 5)
      const y = v(seg.values, 6)

      if (ar1 === 0 || ar2 === 0) {
        reducedPathData.push({ type: 'C', values: [currentX, currentY, x, y, x, y] })

        currentX = x
        currentY = y
      } else {
        if (currentX !== x || currentY !== y) {
          const curves = arcToCubicCurves(currentX, currentY, x, y, ar1, ar2, arcAngle, largeArcFlag, sweepFlg)

          curves.forEach(function (curve) {
            reducedPathData.push({ type: 'C', values: curve })
          })

          currentX = x
          currentY = y
        }
      }
    } else if (seg.type === 'Z') {
      reducedPathData.push(seg)

      currentX = subpathX
      currentY = subpathY
    }

    lastType = seg.type
  })

  return reducedPathData
}

// ---------------------------------------------------------------------------
// WeakMap caches (replaces Symbol-keyed element properties)
// ---------------------------------------------------------------------------

const cachedPathData = new WeakMap<SVGPathElement, SVGPathDataCommand[]>()
const cachedNormalizedPathData = new WeakMap<SVGPathElement, SVGPathDataCommand[]>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an SVG path `d` string into structured path data commands.
 * Pure function -- no DOM access.
 */
export function parsePathData (d: string): SVGPathDataCommand[] {
  if (!d || d.length === 0) return []

  const source = new Source(d)
  const pathData: SVGPathDataCommand[] = []

  if (source.initialCommandIsMoveTo()) {
    while (source.hasMoreData()) {
      const pathSeg = source.parseSegment()

      if (pathSeg === null) {
        break
      } else {
        pathData.push(pathSeg)
      }
    }
  }

  return pathData
}

/**
 * Serialize structured path data commands back to a `d` attribute string.
 * Pure function -- no DOM access.
 */
export function serializePathData (data: SVGPathDataCommand[]): string {
  if (data.length === 0) {
    return ''
  }

  let d = ''

  for (let i = 0, l = data.length; i < l; i += 1) {
    const seg = data[i] as SVGPathDataCommand

    if (i > 0) {
      d += ' '
    }

    d += seg.type

    if (seg.values && seg.values.length > 0) {
      d += ' ' + seg.values.join(' ')
    }
  }

  return d
}

/**
 * Read structured path data from an SVGPathElement.
 * Results are cached per-element; pass `{ normalize: true }` to get an
 * M/L/C/Z-only representation (also cached separately).
 */
export function getPathData (el: SVGPathElement, settings?: SVGPathDataSettings): SVGPathDataCommand[] {
  if (settings && settings.normalize) {
    const cached = cachedNormalizedPathData.get(el)
    if (cached) {
      return clonePathData(cached)
    } else {
      let pathData: SVGPathDataCommand[]

      const cachedRaw = cachedPathData.get(el)
      if (cachedRaw) {
        pathData = clonePathData(cachedRaw)
      } else {
        pathData = parsePathData(el.getAttribute('d') || '')
        cachedPathData.set(el, clonePathData(pathData))
      }

      const normalizedPathData = reducePathData(absolutizePathData(pathData))
      cachedNormalizedPathData.set(el, clonePathData(normalizedPathData))
      return normalizedPathData
    }
  } else {
    const cached = cachedPathData.get(el)
    if (cached) {
      return clonePathData(cached)
    } else {
      const pathData = parsePathData(el.getAttribute('d') || '')
      cachedPathData.set(el, clonePathData(pathData))
      return pathData
    }
  }
}

/**
 * Read-only variant of {@link getPathData} that returns the per-element cache
 * entry directly, WITHOUT the defensive deep-clone `getPathData` performs on
 * every call. The returned array and its segments MUST NOT be mutated -- it is
 * the live cache. Callers that only read path data should use this on hot paths;
 * any caller that mutates the result (and then calls `setPathData`) MUST use
 * `getPathData` instead. The `readonly` return type enforces this at compile time.
 */
export function getPathDataReadonly (el: SVGPathElement): readonly SVGPathDataCommand[] {
  let cached = cachedPathData.get(el)
  if (!cached) {
    cached = parsePathData(el.getAttribute('d') || '')
    cachedPathData.set(el, cached)
  }
  return cached
}

/**
 * Write structured path data to an SVGPathElement's `d` attribute.
 */
export function setPathData (el: SVGPathElement, data: SVGPathDataCommand[]): void {
  // Invalidate caches so the next getPathData() re-parses from the attribute.
  cachedPathData.delete(el)
  cachedNormalizedPathData.delete(el)

  if (data.length === 0) {
    el.removeAttribute('d')
  } else {
    el.setAttribute('d', serializePathData(data))
  }
}
