import { describe, expect, it } from 'vitest'
import {
  hsvToRgb,
  rgbToHsv,
  hexToRgba,
  rgbaToHex,
  intToHex,
  validateHex,
  invertHex,
  ColorModel
} from '../../src/editor/components/jgraduate/ColorModel.ts'

describe('intToHex (#126 — now shared by se-gradient-editor)', () => {
  it('zero-pads a byte to 2 lowercase hex chars', () => {
    expect(intToHex(0)).toBe('00')
    expect(intToHex(15)).toBe('0f')
    expect(intToHex(128)).toBe('80')
    expect(intToHex(255)).toBe('ff')
  })
})

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

  it('converts mid-gray (0,0,50) → [128,128,128]', () => {
    // v=50 → round(50*255/100) = round(127.5) = 128
    expect(hsvToRgb(0, 0, 50)).toEqual([128, 128, 128])
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

  it('rounds channel output rather than truncating', () => {
    // (0,50,100): g=b=0.5*255=127.5 -> rounds to 128, not 127
    expect(hsvToRgb(0, 50, 100)).toEqual([255, 128, 128])
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
    // Allow ±2 for integer rounding in hsvToRgb
    expect(Math.abs(rh - 200)).toBeLessThanOrEqual(2)
    expect(Math.abs(rs - 60)).toBeLessThanOrEqual(2)
    expect(Math.abs(rv - 80)).toBeLessThanOrEqual(2)
  })

  it('rounds S/V rather than truncating', () => {
    // 201/255 = 0.7882 -> V = 78.82 -> rounds to 79, not 78
    expect(rgbToHsv(201, 0, 0)).toEqual([0, 100, 79])
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

// ---------------------------------------------------------------------------
// invertHex
// ---------------------------------------------------------------------------

describe('invertHex', () => {
  it('inverts a 6-char hex', () => {
    expect(invertHex('#ffffff')).toBe('#000000')
    expect(invertHex('#000000')).toBe('#ffffff')
  })

  it('inverts a 6-char hex without a leading #', () => {
    expect(invertHex('ff0000')).toBe('#00ffff')
  })

  it('expands and inverts 3-digit shorthand hex', () => {
    // #f00 -> #ff0000 -> invert -> #00ffff
    expect(invertHex('#f00')).toBe('#00ffff')
  })

  it('never emits NaN for an unparseable/named color', () => {
    expect(invertHex('red')).toMatch(/^#[0-9a-f]{6}$/)
  })
})

// ---------------------------------------------------------------------------
// ColorModel class
// ---------------------------------------------------------------------------

describe('ColorModel class', () => {
  it('initializes from ahex string', () => {
    const m = new ColorModel('ff0000ff')
    expect(m.r).toBe(255)
    expect(m.g).toBe(0)
    expect(m.b).toBe(0)
    expect(m.a).toBe(255)
    expect(m.h).toBe(0)
    expect(m.s).toBe(100)
    expect(m.v).toBe(100)
  })
  it('setRgb updates HSV', () => {
    const m = new ColorModel('000000ff')
    m.setRgb(0, 255, 0)
    expect(m.h).toBe(120)
    expect(m.s).toBe(100)
    expect(m.v).toBe(100)
  })
  it('setHsv updates RGB', () => {
    const m = new ColorModel('000000ff')
    m.setHsv(240, 100, 100)
    expect(m.r).toBe(0)
    expect(m.g).toBe(0)
    expect(m.b).toBe(255)
  })
  it('setHex updates all channels', () => {
    const m = new ColorModel('000000ff')
    m.setHex('00ff00')
    expect(m.r).toBe(0)
    expect(m.g).toBe(255)
    expect(m.b).toBe(0)
    expect(m.hex).toBe('00ff00')
  })
  it('fires change event on set', () => {
    const m = new ColorModel('ff0000ff')
    let fired = false
    m.addEventListener('change', () => { fired = true })
    m.set('r', 128)
    expect(fired).toBe(true)
  })
  it('does not fire change when value unchanged', () => {
    const m = new ColorModel('ff0000ff')
    let count = 0
    m.addEventListener('change', () => { count++ })
    m.set('r', 255)
    expect(count).toBe(0)
  })
  it('change event includes source token', () => {
    const m = new ColorModel('ff0000ff')
    let source = null
    m.addEventListener('change', (e) => { source = e.detail.source })
    m.set('r', 128, 'slider')
    expect(source).toBe('slider')
  })
  it('batch setRgb fires single event', () => {
    const m = new ColorModel('000000ff')
    let count = 0
    m.addEventListener('change', () => { count++ })
    m.setRgb(100, 150, 200)
    expect(count).toBe(1)
  })
  it('hex getter returns 6-char lowercase', () => {
    const m = new ColorModel('ff8800ff')
    expect(m.hex).toBe('ff8800')
  })
  it('ahex getter returns 8-char lowercase', () => {
    const m = new ColorModel('ff880080')
    expect(m.ahex).toBe('ff880080')
  })
})
