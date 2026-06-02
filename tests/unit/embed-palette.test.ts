// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PALETTE } from '../../src/embed/palette-defaults.ts'
import {
  getPalette, setPalette, setPaletteWithErrors, subscribePalette, _resetPaletteForTest
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

describe('setPaletteWithErrors', () => {
  it('calls onDropped with a formatted message when colours are dropped', () => {
    const msgs: string[] = []
    setPaletteWithErrors(['#ff0000', 'notacolor'], (m) => msgs.push(m))
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toContain('1 invalid')
    expect(msgs[0]).toContain('notacolor')
    expect(getPalette()).toEqual(['none', '#ff0000'])
  })

  it('does not call onDropped when all colours are valid', () => {
    const msgs: string[] = []
    setPaletteWithErrors(['#ff0000', '#00ff00'], (m) => msgs.push(m))
    expect(msgs).toEqual([])
  })

  it('bounds the dropped preview to 5 entries with an "and N more" suffix', () => {
    const msgs: string[] = []
    setPaletteWithErrors(['#ff0000', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], (m) => msgs.push(m))
    expect(msgs[0]).toContain('7 invalid')
    expect(msgs[0]).toContain('and 2 more')
    expect(msgs[0]).not.toContain('b6')
  })

  it('treats non-array input as empty and does not call onDropped', () => {
    const msgs: string[] = []
    expect(() => setPaletteWithErrors('notanarray' as unknown as readonly unknown[], (m) => msgs.push(m))).not.toThrow()
    expect(msgs).toEqual([])
  })

  it('does not throw when onDropped is omitted', () => {
    expect(() => setPaletteWithErrors(['#ff0000', 'bad'])).not.toThrow()
  })
})
