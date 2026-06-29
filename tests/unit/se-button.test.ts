// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/components/seButton.js'
import type { SeButton } from '../../src/editor/components/seButton'

const flush = async (el: SeButton) => {
  await customElements.whenDefined('se-button')
  if (el && typeof el.updateComplete?.then === 'function') await el.updateComplete
}

describe('se-button icon rendering', () => {
  let el: SeButton
  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-button') as SeButton
    document.body.appendChild(el)
  })
  afterEach(() => { document.body.textContent = '' })

  it('paints the icon via a masked element, not an <img>', async () => {
    el.setAttribute('src', 'data:image/svg+xml;utf8,<svg></svg>')
    await flush(el)
    const icon = el.shadowRoot!.querySelector('.se-icon')
    expect(icon, 'expected a .se-icon element').not.toBeNull()
    expect(el.shadowRoot!.querySelector('img'), 'no <img> should remain').toBeNull()
    expect(icon!.getAttribute('style') ?? '').toContain('mask-image')
  })
})
