import { describe, it, expect } from 'vitest'
import { isMirrorableClipboard, MAX_CLIPBOARD_CHARS } from '../../packages/svgcanvas/core/clipboard-payload.js'

describe('isMirrorableClipboard (#51 — cross-tab clipboard mirror guard)', () => {
  it('accepts a bounded JSON array (the clipboard payload shape)', () => {
    expect(isMirrorableClipboard('[{"element":"rect","attr":{"id":"a"}}]')).toBe(true)
    expect(isMirrorableClipboard('[]')).toBe(true)
  })

  it('rejects null and empty strings', () => {
    expect(isMirrorableClipboard(null)).toBe(false)
    expect(isMirrorableClipboard('')).toBe(false)
  })

  it('rejects JSON that is not an array', () => {
    expect(isMirrorableClipboard('{"element":"rect"}')).toBe(false)
    expect(isMirrorableClipboard('"a string"')).toBe(false)
    expect(isMirrorableClipboard('42')).toBe(false)
  })

  it('rejects malformed JSON', () => {
    expect(isMirrorableClipboard('[not valid json')).toBe(false)
  })

  it('rejects payloads larger than the cap', () => {
    const huge = '["' + 'x'.repeat(MAX_CLIPBOARD_CHARS) + '"]'
    expect(huge.length).toBeGreaterThan(MAX_CLIPBOARD_CHARS)
    expect(isMirrorableClipboard(huge)).toBe(false)
  })
})
