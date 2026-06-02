// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PALETTE } from '../../src/embed/palette-defaults.ts'
import {
  getPalette, setPalette, subscribePalette, _resetPaletteForTest
} from '../../src/editor/components/palette-store.ts'

afterEach(() => { _resetPaletteForTest() })

describe('palette-store', () => {
  it('defaults to DEFAULT_PALETTE (none first, 42 entries)', () => {
    expect(getPalette()).toEqual(DEFAULT_PALETTE)
    expect(DEFAULT_PALETTE[0]).toBe('none')
    expect(DEFAULT_PALETTE).toHaveLength(42)
  })

  it('replaces with valid colors and prepends none', () => {
    const res = setPalette(['#ff0000', '#00ff00'])
    expect(getPalette()).toEqual(['none', '#ff0000', '#00ff00'])
    expect(res.dropped).toEqual([])
  })

  it('does not duplicate a host-supplied none', () => {
    setPalette(['none', '#ff0000'])
    expect(getPalette()).toEqual(['none', '#ff0000'])
  })

  it('drops invalid colors and reports them', () => {
    const res = setPalette(['#ff0000', 'notacolor', ''])
    expect(getPalette()).toEqual(['none', '#ff0000'])
    expect(res.dropped).toEqual(['notacolor', ''])
  })

  it('falls back to DEFAULT_PALETTE when no real color survives', () => {
    const res = setPalette(['notacolor'])
    expect(getPalette()).toEqual(DEFAULT_PALETTE)
    expect(res.dropped).toEqual(['notacolor'])
  })

  it('falls back to DEFAULT_PALETTE for an empty array', () => {
    setPalette([])
    expect(getPalette()).toEqual(DEFAULT_PALETTE)
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    const fn = vi.fn()
    const unsub = subscribePalette(fn)
    setPalette(['#ff0000'])
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    setPalette(['#00ff00'])
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
