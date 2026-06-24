/**
 * @file ColorModel — pure color conversion functions extracted from jPicker.
 *
 * All functions are stateless and importable independently.
 * @module ColorModel
 */

/** Union of all color channel identifiers used by the picker. */
export type ColorChannel = 'r' | 'g' | 'b' | 'h' | 's' | 'v' | 'a'

// ---------------------------------------------------------------------------
// HSV <-> RGB
// ---------------------------------------------------------------------------

/**
 * Convert HSV to RGB.
 *
 * @param h - Hue, 0–360
 * @param s - Saturation, 0–100
 * @param v - Value, 0–100
 * @returns Tuple [r, g, b] each in 0–255 (integer, rounded)
 */
export function hsvToRgb (h: number, s: number, v: number): [number, number, number] {
  if (s === 0) {
    if (v === 0) return [0, 0, 0]
    const gray = Math.round(v * 255 / 100)
    return [gray, gray, gray]
  }

  if (h === 360) h = 0
  h /= 60
  s /= 100
  v /= 100

  const i = h | 0
  const f = h - i
  const p = v * (1 - s)
  const q = v * (1 - s * f)
  const t = v * (1 - s * (1 - f))

  let r: number, g: number, b: number
  switch (i) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
    default: r = 0; g = 0; b = 0
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/**
 * Convert RGB to HSV.
 *
 * @param r - Red,   0–255
 * @param g - Green, 0–255
 * @param b - Blue,  0–255
 * @returns Tuple [h, s, v] where h: 0–360, s: 0–100, v: 0–100 (integers)
 */
export function rgbToHsv (r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  let max: number, min: number
  if (rn >= gn && rn >= bn) {
    max = rn
    min = gn > bn ? bn : gn
  } else if (gn >= bn && gn >= rn) {
    max = gn
    min = rn > bn ? bn : rn
  } else {
    max = bn
    min = gn > rn ? rn : gn
  }

  const vOut = max
  const sOut = max ? (max - min) / max : 0

  let hOut = 0
  if (sOut !== 0) {
    const delta = max - min
    if (rn === max) hOut = (gn - bn) / delta
    else if (gn === max) hOut = 2 + (bn - rn) / delta
    else hOut = 4 + (rn - gn) / delta
    hOut = Math.round(hOut * 60)
    if (hOut < 0) hOut += 360
  }

  return [hOut, Math.round(sOut * 100), Math.round(vOut * 100)]
}

// ---------------------------------------------------------------------------
// Hex <-> RGBA
// ---------------------------------------------------------------------------

/**
 * Parse a hex string into RGBA integer components.
 *
 * Accepts 6-char (RRGGBB) or 8-char (RRGGBBAA) lowercase/uppercase hex,
 * with or without a leading `#`.
 *
 * @param hex - Hex string, `''`, or `'none'`
 * @returns Object with r, g, b, a in 0–255, or all-null for empty/none inputs.
 */
export function hexToRgba (hex: string): { r: number | null, g: number | null, b: number | null, a: number | null } {
  if (hex === '' || hex === 'none') return { r: null, g: null, b: null, a: null }

  hex = validateHex(hex)

  // Normalise to 8-char form
  if (hex.length === 6) hex += 'ff'

  if (hex.length >= 8) {
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: parseInt(hex.substring(6, 8), 16)
    }
  }

  return { r: null, g: null, b: null, a: null }
}

/**
 * Convert RGBA integer components to an 8-character lowercase hex string.
 *
 * @param r - Red,   0–255
 * @param g - Green, 0–255
 * @param b - Blue,  0–255
 * @param a - Alpha, 0–255
 * @returns 8-char lowercase hex string (e.g. `"ff0000ff"`)
 */
export function rgbaToHex (r: number, g: number, b: number, a: number): string {
  return intToHex(r) + intToHex(g) + intToHex(b) + intToHex(a)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitise a hex string: strip leading `#` and any non-hex characters,
 * lowercase, truncate to 8 characters.
 *
 * @param hex - Raw input string
 * @returns Cleaned hex string (0–8 chars, lowercase, no `#`)
 */
export function validateHex (hex: string): string {
  hex = hex.toLowerCase().replace(/[^a-f\d]/g, '')
  if (hex.length > 8) hex = hex.substring(0, 8)
  return hex
}

/** Convert an integer 0–255 to a zero-padded 2-char lowercase hex string. */
function intToHex (dec: number): string {
  let result = (dec | 0).toString(16)
  if (result.length === 1) result = '0' + result
  return result.toLowerCase()
}

/**
 * Invert a hex color (per-channel `255 − value`).
 *
 * Accepts 6-digit (`#rrggbb`) or 3-digit shorthand (`#rgb`, expanded), with or
 * without a leading `#`; a trailing alpha pair is ignored. Any input that is not
 * valid 6-digit hex (e.g. a named color like `red`) yields a neutral mid-gray
 * inverse rather than corrupt `#NaN…` output.
 *
 * @param hex - Hex color string.
 * @returns 6-char `#rrggbb` inverse, or `#808080` for unparseable input.
 */
export function invertHex (hex: string): string {
  let raw = hex.startsWith('#') ? hex.slice(1) : hex
  // Expand 3-digit shorthand (#rgb -> rrggbb).
  if (raw.length === 3) raw = raw.replace(/(.)(.)(.)/, '$1$1$2$2$3$3')
  raw = raw.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return '#808080'
  let inverted = ''
  for (let i = 0; i < 6; i += 2) {
    let inv = (255 - parseInt(raw.substring(i, i + 2), 16)).toString(16)
    if (inv.length < 2) inv = '0' + inv
    inverted += inv
  }
  return '#' + inverted
}

// ---------------------------------------------------------------------------
// ColorModel class
// ---------------------------------------------------------------------------

/** Detail payload carried by the ColorModel 'change' CustomEvent. */
export interface ColorChangeDetail {
  channel: ColorChannel | 'rgb' | 'hsv' | 'hex' | 'ahex'
  source?: string | undefined
}

/** Clamp a number to [min, max]. */
function clamp (v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/**
 * Stateful color model that stores an RGBA color and fires a `change`
 * CustomEvent whenever any channel is mutated.
 *
 * Extends `EventTarget` so callers can use `addEventListener` /
 * `removeEventListener` directly.
 *
 * @example
 * ```ts
 * const m = new ColorModel('ff0000ff')
 * m.addEventListener('change', (e) => console.log(e.detail))
 * m.set('r', 128)
 * ```
 */
export class ColorModel extends EventTarget {
  private _r: number = 0
  private _g: number = 0
  private _b: number = 0
  private _h: number = 0
  private _s: number = 0
  private _v: number = 0
  private _a: number = 255

  /** Construct a ColorModel, optionally initialised from an 8-char ahex string. */
  constructor (ahex?: string) {
    super()
    if (ahex) {
      this._initFromAhex(ahex)
    }
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  get r (): number { return this._r }
  get g (): number { return this._g }
  get b (): number { return this._b }
  get h (): number { return this._h }
  get s (): number { return this._s }
  get v (): number { return this._v }
  get a (): number { return this._a }

  /** 6-char lowercase hex string (RRGGBB, no alpha). */
  get hex (): string {
    return intToHex(this._r) + intToHex(this._g) + intToHex(this._b)
  }

  /** 8-char lowercase hex string (RRGGBBAA). */
  get ahex (): string {
    return this.hex + intToHex(this._a)
  }

  /** CSS `rgba(r, g, b, a)` string where a is normalised to 0–1. */
  get cssColor (): string {
    return `rgba(${this._r}, ${this._g}, ${this._b}, ${(this._a / 255).toFixed(3)})`
  }

  // -------------------------------------------------------------------------
  // Single-channel setter
  // -------------------------------------------------------------------------

  /**
   * Set a single color channel.  Automatically syncs the complementary color
   * space (RGB ↔ HSV) and fires a `change` event unless the value is already
   * equal to the current value.
   *
   * @param value   - New value (clamped to the channel's valid range).
   * @param source  - Optional caller token for feedback-loop prevention.
   */
  set (channel: ColorChannel, value: number, source?: string): void {
    let clamped: number
    switch (channel) {
      case 'r': case 'g': case 'b': case 'a':
        clamped = clamp(value | 0, 0, 255)
        break
      case 'h':
        clamped = clamp(value | 0, 0, 360)
        break
      case 's': case 'v':
        clamped = clamp(value | 0, 0, 100)
        break
    }

    // No-op if unchanged
    if ((this as unknown as Record<string, number>)[`_${channel}`] === clamped) return

    // Apply the new value
    ;(this as unknown as Record<string, number>)[`_${channel}`] = clamped

    // Sync complementary space
    if (channel === 'r' || channel === 'g' || channel === 'b') {
      this._syncHsvFromRgb()
    } else if (channel === 'h' || channel === 's' || channel === 'v') {
      this._syncRgbFromHsv()
    }

    this._fire(channel, source)
  }

  // -------------------------------------------------------------------------
  // Batch setters
  // -------------------------------------------------------------------------

  /**
   * Set all three RGB channels atomically.  Fires a single `change` event
   * with `channel: 'rgb'`.
   */
  setRgb (r: number, g: number, b: number, source?: string): void {
    this._r = clamp(r | 0, 0, 255)
    this._g = clamp(g | 0, 0, 255)
    this._b = clamp(b | 0, 0, 255)
    this._syncHsvFromRgb()
    this._fire('rgb', source)
  }

  /**
   * Set all three HSV channels atomically.  Fires a single `change` event
   * with `channel: 'hsv'`.
   */
  setHsv (h: number, s: number, v: number, source?: string): void {
    this._h = clamp(h | 0, 0, 360)
    this._s = clamp(s | 0, 0, 100)
    this._v = clamp(v | 0, 0, 100)
    this._syncRgbFromHsv()
    this._fire('hsv', source)
  }

  /**
   * Set color from a 6-char hex string (RRGGBB).  Alpha is preserved.
   * Fires a single `change` event with `channel: 'hex'`.
   */
  setHex (hex: string, source?: string): void {
    const clean = validateHex(hex).substring(0, 6)
    if (clean.length < 6) return
    this._r = parseInt(clean.substring(0, 2), 16)
    this._g = parseInt(clean.substring(2, 4), 16)
    this._b = parseInt(clean.substring(4, 6), 16)
    this._syncHsvFromRgb()
    this._fire('hex', source)
  }

  /**
   * Set color (including alpha) from an 8-char hex string (RRGGBBAA).
   * Fires a single `change` event with `channel: 'ahex'`.
   */
  setAhex (ahex: string, source?: string): void {
    this._initFromAhex(ahex)
    this._fire('ahex', source)
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _initFromAhex (ahex: string): void {
    const clean = validateHex(ahex)
    if (clean.length < 8) return
    this._r = parseInt(clean.substring(0, 2), 16)
    this._g = parseInt(clean.substring(2, 4), 16)
    this._b = parseInt(clean.substring(4, 6), 16)
    this._a = parseInt(clean.substring(6, 8), 16)
    this._syncHsvFromRgb()
  }

  private _syncHsvFromRgb (): void {
    const [h, s, v] = rgbToHsv(this._r, this._g, this._b)
    this._h = h
    this._s = s
    this._v = v
  }

  private _syncRgbFromHsv (): void {
    const [r, g, b] = hsvToRgb(this._h, this._s, this._v)
    this._r = r
    this._g = g
    this._b = b
  }

  private _fire (channel: ColorChangeDetail['channel'], source?: string): void {
    const detail: ColorChangeDetail = { channel, source }
    this.dispatchEvent(new CustomEvent<ColorChangeDetail>('change', { detail }))
  }
}
