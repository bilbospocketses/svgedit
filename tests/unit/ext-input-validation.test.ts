import { describe, it, expect } from 'vitest'
import { isSafeDomId, isSafePathData, isSafeExtPath } from '../../packages/svgcanvas/core/validators.js'
import { stringToHTML } from '../../packages/svgcanvas/core/utilities.js'

describe('input validators (#8, #9, #10)', () => {
  it('isSafeDomId rejects ids that would escape url(#…)/selectors (#8)', () => {
    expect(isSafeDomId('rect_1')).toBe(true)
    expect(isSafeDomId('marker-end')).toBe(true)
    expect(isSafeDomId('evil)id')).toBe(false)   // would close url(#…)
    expect(isSafeDomId('a"]')).toBe(false)        // selector breakout
    expect(isSafeDomId('1leading')).toBe(false)   // id cannot start with a digit
    expect(isSafeDomId('')).toBe(false)
  })

  it('isSafePathData accepts path data, rejects markup/junk (#10)', () => {
    expect(isSafePathData('M0,0 L10,10 Z')).toBe(true)
    expect(isSafePathData('m1.5,2 c0.1.2.3.4.5.6')).toBe(true)
    expect(isSafePathData('"><script>alert(1)</script>')).toBe(false)
    expect(isSafePathData('url(#x)')).toBe(false)
  })

  it('isSafeExtPath accepts paths/URLs, rejects markup breakout (#9)', () => {
    expect(isSafeExtPath('./extensions')).toBe(true)
    expect(isSafeExtPath('https://cdn.example.com/ext')).toBe(true)
    expect(isSafeExtPath('"></se-explorerbutton><img src=x onerror=alert(1)>')).toBe(false)
  })
})

describe('ext-shapes extPath sink (#9, behavioral)', () => {
  it('documents the attribute-injection vector and proves the isSafeExtPath gate closes it', () => {
    const hostile = '" onmouseover="alert(1)'
    // WITHOUT the gate: a raw extPath injects a firing event-handler attribute on the button
    const unsafe = stringToHTML(
      `<se-explorerbutton lib="${hostile}/ext-shapes/shapelib/" src="shapelib.svg"></se-explorerbutton>`
    ) as Element | null
    expect(unsafe?.getAttribute('onmouseover')).toBeTruthy()   // real XSS vector

    // WITH the gate (what ext-shapes now does): an unsafe extPath collapses to ''
    const safeExtPath = isSafeExtPath(hostile) ? hostile : ''
    const safe = stringToHTML(
      `<se-explorerbutton lib="${safeExtPath}/ext-shapes/shapelib/" src="shapelib.svg"></se-explorerbutton>`
    ) as Element | null
    expect(safe?.getAttribute('onmouseover')).toBeNull()
  })
})
