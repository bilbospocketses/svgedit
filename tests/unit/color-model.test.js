import { describe, expect, it } from 'vitest'
import {
  hsvToRgb,
  rgbToHsv,
  hexToRgba,
  rgbaToHex,
  validateHex
} from '../../src/editor/components/jgraduate/ColorModel.ts'

// ---------------------------------------------------------------------------
// hsvToRgb
// ---------------------------------------------------------------------------

describe('hsvToRgb', () => {
  it('converts pure red (0,100,100) → [255,0,0]', () => {
    expect(hsvToRgb(0, 100, 100)).toEqual([255, 0, 0])
  })

  it('converts pure green (120,100,100) → [0,255,0]', () => {
    expect(hsvToRgb(120, 100, 100)).toEqual([0, 255, 0])
  })

  it('converts pure blue (240,100,100) → [0,0,255]', () => {
    expect(hsvToRgb(240, 100, 100)).toEqual([0, 0, 255])
  })

  it('converts black (0,0,0) → [0,0,0]', () => {
    expect(hsvToRgb(0, 0, 0)).toEqual([0, 0, 0])
  })

  it('converts white (0,0,100) → [255,255,255]', () => {
    expect(hsvToRgb(0, 0, 100)).toEqual([255, 255, 255])
  })

  it('converts mid-gray (0,0,50) → [127,127,127]', () => {
    // v=50 → (50*255/100)|0 = 127
    expect(hsvToRgb(0, 0, 50)).toEqual([127, 127, 127])
  })

  it('treats h=360 identically to h=0', () => {
    expect(hsvToRgb(360, 100, 100)).toEqual(hsvToRgb(0, 100, 100))
  })

  it('converts yellow (60,100,100) → [255,255,0]', () => {
    expect(hsvToRgb(60, 100, 100)).toEqual([255, 255, 0])
  })

  it('converts cyan (180,100,100) → [0,255,255]', () => {
    expect(hsvToRgb(180, 100, 100)).toEqual([0, 255, 255])
  })

  it('converts magenta (300,100,100) → [255,0,255]', () => {
    expect(hsvToRgb(300, 100, 100)).toEqual([255, 0, 255])
  })
})

// ---------------------------------------------------------------------------
// rgbToHsv
// ---------------------------------------------------------------------------

describe('rgbToHsv', () => {
  it('converts pure red [255,0,0] → [0,100,100]', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual([0, 100, 100])
  })

  it('converts pure green [0,255,0] → [120,100,100]', () => {
    expect(rgbToHsv(0, 255, 0)).toEqual([120, 100, 100])
  })

  it('converts pure blue [0,0,255] → [240,100,100]', () => {
    expect(rgbToHsv(0, 0, 255)).toEqual([240, 100, 100])
  })

  it('converts black [0,0,0] → [0,0,0]', () => {
    expect(rgbToHsv(0, 0, 0)).toEqual([0, 0, 0])
  })

  it('converts white [255,255,255] → [0,0,100]', () => {
    expect(rgbToHsv(255, 255, 255)).toEqual([0, 0, 100])
  })

  it('round-trips through hsvToRgb for primary colors', () => {
    for (const [h, s, v] of [[0, 100, 100], [120, 100, 100], [240, 100, 100]]) {
      const [r, g, b] = hsvToRgb(h, s, v)
      const [rh, rs, rv] = rgbToHsv(r, g, b)
      expect(rh).toBe(h)
      expect(rs).toBe(s)
      expect(rv).toBe(v)
    }
  })

  it('round-trips for an arbitrary mid-tone', () => {
    const [r, g, b] = hsvToRgb(200, 60, 80)
    const [rh, rs, rv] = rgbToHsv(r, g, b)
    // Allow ±1 for integer truncation in hsvToRgb
    expect(Math.abs(rh - 200)).toBeLessThanOrEqual(2)
    expect(Math.abs(rs - 60)).toBeLessThanOrEqual(2)
    expect(Math.abs(rv - 80)).toBeLessThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// hexToRgba
// ---------------------------------------------------------------------------

describe('hexToRgba', () => {
  it('parses a 6-char hex string', () => {
    expect(hexToRgba('ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 255 })
  })

  it('parses a 6-char hex with leading #', () => {
    expect(hexToRgba('#00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 255 })
  })

  it('parses an 8-char hex string with alpha', () => {
    expect(hexToRgba('0000ff80')).toEqual({ r: 0, g: 0, b: 255, a: 128 })
  })

  it('parses uppercase hex', () => {
    expect(hexToRgba('FF8800FF')).toEqual({ r: 255, g: 136, b: 0, a: 255 })
  })

  it('returns all-null for empty string', () => {
    expect(hexToRgba('')).toEqual({ r: null, g: null, b: null, a: null })
  })

  it('returns all-null for "none"', () => {
    expect(hexToRgba('none')).toEqual({ r: null, g: null, b: null, a: null })
  })
})

// ---------------------------------------------------------------------------
// rgbaToHex
// ---------------------------------------------------------------------------

describe('rgbaToHex', () => {
  it('converts red to "ff0000ff"', () => {
    expect(rgbaToHex(255, 0, 0, 255)).toBe('ff0000ff')
  })

  it('zero-pads single-nibble components', () => {
    expect(rgbaToHex(0, 0, 0, 0)).toBe('00000000')
  })

  it('converts semi-transparent blue to "0000ff80"', () => {
    expect(rgbaToHex(0, 0, 255, 128)).toBe('0000ff80')
  })

  it('always returns lowercase hex', () => {
    expect(rgbaToHex(255, 170, 0, 255)).toBe('ffaa00ff')
  })

  it('round-trips with hexToRgba', () => {
    const hex = 'deadbeef'
    const { r, g, b, a } = hexToRgba(hex)
    expect(rgbaToHex(r, g, b, a)).toBe(hex)
  })
})

// ---------------------------------------------------------------------------
// validateHex
// ---------------------------------------------------------------------------

describe('validateHex', () => {
  it('strips leading #', () => {
    expect(validateHex('#ff0000')).toBe('ff0000')
  })

  it('lowercases the string', () => {
    expect(validateHex('FF0000')).toBe('ff0000')
  })

  it('strips non-hex characters', () => {
    expect(validateHex('ZZ-ff00gg')).toBe('ff00')
  })

  it('truncates to 8 characters', () => {
    expect(validateHex('aabbccdd112233').length).toBe(8)
    expect(validateHex('aabbccdd112233')).toBe('aabbccdd')
  })

  it('returns empty string for all-invalid input', () => {
    expect(validateHex('xyz')).toBe('')
  })

  it('leaves a valid 6-char hex unchanged', () => {
    expect(validateHex('abc123')).toBe('abc123')
  })
})
