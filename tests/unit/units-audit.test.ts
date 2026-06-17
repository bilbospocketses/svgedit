import { describe, it, expect, beforeEach } from 'vitest'
import * as units from '../../packages/svgcanvas/core/units.js'

describe('units audit fixes (#13, #14)', () => {
  beforeEach(() => {
    document.body.textContent = ''
    units.init({
      getBaseUnit () { return 'px' },
      getHeight () { return 600 },
      getWidth () { return 800 },
      getRoundDigits () { return 4 },
      getElement (id: string) { return document.getElementById(id) }
    })
  })

  it('#13 convertToNum() does not zero a value with a 1-char/unknown unit', () => {
    // old: '5z'.slice(-2) === '5z', Number('5z'.slice(0, -2)) === Number('') === 0
    expect(units.convertToNum('width', '5z')).toBe(5)
    expect(units.convertToNum('width', '5px')).toBe(5)   // regression: real 2-char unit
    expect(units.convertToNum('width', '42')).toBe(42)   // plain number
    expect(Number.isNaN(units.convertToNum('width', 'abc'))).toBe(true) // unparseable -> NaN
  })

  it('#14 shortFloat() handles tuples and unitful strings (characterization)', () => {
    expect(units.shortFloat([1.23456, 2.34567])).toBe('1.2346,2.3457')
    expect(units.shortFloat(5)).toBe(5)
    expect(units.shortFloat('3.14159px')).toBe(3.1416)
  })
})
