import { describe, expect, it } from 'vitest'
import { setDialogVisibility } from '../../src/editor/dialogs/setDialogVisibility.js'

// #139 — one typed helper for the `dialog` attribute that every dialog consumer
// reads as `=== 'open'` (shown) vs anything else (hidden).
describe('setDialogVisibility (#139)', () => {
  it('sets dialog="open" when open is true', () => {
    const el = document.createElement('div')
    setDialogVisibility(el, true)
    expect(el.getAttribute('dialog')).toBe('open')
  })

  it('sets dialog="close" when open is false', () => {
    const el = document.createElement('div')
    el.setAttribute('dialog', 'open')
    setDialogVisibility(el, false)
    expect(el.getAttribute('dialog')).toBe('close')
  })

  it('is a no-op for a null or undefined element', () => {
    expect(() => setDialogVisibility(null, true)).not.toThrow()
    expect(() => setDialogVisibility(undefined, false)).not.toThrow()
  })
})
