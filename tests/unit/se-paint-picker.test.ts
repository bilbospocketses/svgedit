// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/editor/svgEditorInstance.js', () => ({
  getSvgEditor: () => ({
    configObj: { curConfig: { imgPath: '' } },
    svgCanvas: { container: document.createElement('div') }
  })
}))

import '../../src/editor/components/se-paint-picker.js'

// #129 (audit, verified over-claim): the decorative #block paint swatch is a child
// of the #picker trigger, so a click on it bubbles to the trigger and opens the
// editor — it does NOT swallow the open click. Browser-confirmed with both a
// dispatched and a real pointer click; this pins it so a future PaintBox/markup
// change (e.g. a stray stopPropagation) can't silently regress it.
describe('se-colorpicker (#129) swatch does not swallow the open click', () => {
  afterEach(() => { document.body.textContent = '' })

  const mount = async () => {
    const el = document.createElement('se-colorpicker') as unknown as {
      shadowRoot: ShadowRoot
      updateComplete: Promise<unknown>
      _open: boolean
      setAttribute: (k: string, v: string) => void
    }
    el.setAttribute('type', 'fill')
    document.body.append(el as unknown as Node)
    await el.updateComplete
    return el
  }

  it('opens the editor when the #block swatch is clicked', async () => {
    const el = await mount()
    // PaintBox renders an <svg><rect> swatch into #block during firstUpdated.
    const block = el.shadowRoot.querySelector('#block')
    expect(block).not.toBeNull()
    const swatch = block?.querySelector('rect') ?? block?.querySelector('svg') ?? block!
    expect(el._open).toBe(false)
    swatch.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(el._open).toBe(true)
  })

  it('opens the editor when the #picker chrome (not the swatch) is clicked', async () => {
    const el = await mount()
    const picker = el.shadowRoot.querySelector('#picker') as HTMLElement
    expect(el._open).toBe(false)
    picker.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(el._open).toBe(true)
  })
})
