import { describe, it, expect, afterEach } from 'vitest'
import { setPalette, hasUnsafeCssFunctionValue, _resetPaletteForTest } from '../../src/editor/components/palette-store.js'

describe('palette colour validation (#53 — url()/var() into the background sink)', () => {
  afterEach(() => { _resetPaletteForTest() })

  describe('hasUnsafeCssFunctionValue', () => {
    it('flags url() and var() values (any case)', () => {
      expect(hasUnsafeCssFunctionValue('url(http://evil/x.png)')).toBe(true)
      expect(hasUnsafeCssFunctionValue('var(--injected)')).toBe(true)
      expect(hasUnsafeCssFunctionValue('URL(x)')).toBe(true)
      expect(hasUnsafeCssFunctionValue('VAR(--x)')).toBe(true)
    })

    it('allows ordinary colours and colour functions', () => {
      expect(hasUnsafeCssFunctionValue('#ff0000')).toBe(false)
      expect(hasUnsafeCssFunctionValue('red')).toBe(false)
      expect(hasUnsafeCssFunctionValue('rgb(1, 2, 3)')).toBe(false)
      expect(hasUnsafeCssFunctionValue('hsl(1, 2%, 3%)')).toBe(false)
    })
  })

  it('setPalette drops url()/var() values while keeping real colours', () => {
    const { applied, dropped } = setPalette(['#ff0000', 'var(--x)', 'url(http://evil/x.png)'])
    expect(applied).toContain('#ff0000')
    expect(applied).not.toContain('var(--x)')
    expect(applied).not.toContain('url(http://evil/x.png)')
    expect(dropped).toEqual(expect.arrayContaining(['var(--x)', 'url(http://evil/x.png)']))
  })
})
