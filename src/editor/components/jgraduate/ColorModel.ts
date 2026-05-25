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
 * @returns Tuple [r, g, b] each in 0–255 (integer, truncated with `| 0`)
 */
export function hsvToRgb (h: number, s: number, v: number): [number, number, number] {
  if (s === 0) {
    if (v === 0) return [0, 0, 0]
    const gray = (v * 255 / 100) | 0
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

  return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0]
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

  return [hOut, (sOut * 100) | 0, (vOut * 100) | 0]
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
