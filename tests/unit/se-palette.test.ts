import { vi } from 'vitest'

// se-palette's firstUpdated()/disconnectedCallback() touch
// getSvgEditor().svgCanvas.container; stub the editor singleton for jsdom.
vi.mock('../../src/editor/svgEditorInstance.js', () => ({
  getSvgEditor: () => ({
    svgCanvas: { container: document.createElement('div') },
    configObj: { curConfig: { imgPath: '' } }
  })
}))

import '../../src/editor/components/sePalette.js'

describe('se-palette swatch clicks', () => {
  afterEach(() => {
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  it('dispatches a non-bubbling fill change carrying the clicked swatch colour', async () => {
    const el = document.createElement('se-palette') as any
    document.body.append(el)
    await el.updateComplete

    const square = el.shadowRoot.querySelector('.square[data-rgb]:not([data-rgb="none"])') as HTMLElement
    assert.ok(square, 'expected at least one colour swatch')

    let detail: any = null
    el.addEventListener('change', (e: any) => { detail = e.detail })
    let bubbledToDoc = false
    const onDoc = () => { bubbledToDoc = true }
    document.addEventListener('change', onDoc)

    square.click()
    document.removeEventListener('change', onDoc)

    assert.ok(detail)
    assert.equal(detail.picker, 'fill')
    assert.equal(detail.color, square.dataset.rgb)
    assert.equal(bubbledToDoc, false) // the change event must not bubble (API contract)
  })

  it('ignores clicks on the palette container background (not a swatch)', async () => {
    const el = document.createElement('se-palette') as any
    document.body.append(el)
    await el.updateComplete

    const container = el.shadowRoot.querySelector('#js-se-palette') as HTMLElement
    let fired = false
    el.addEventListener('change', () => { fired = true })
    container.click()
    assert.equal(fired, false)
  })

  it('#29 makes swatches keyboard-operable: Enter selects fill, Shift+Enter selects stroke', async () => {
    const el = document.createElement('se-palette') as any
    document.body.append(el)
    await el.updateComplete

    const square = el.shadowRoot.querySelector('.square[data-rgb]:not([data-rgb="none"])') as HTMLElement
    assert.equal(square.getAttribute('role'), 'button')
    assert.equal(square.getAttribute('tabindex'), '0')
    assert.ok(square.getAttribute('aria-label'), 'swatch must carry an aria-label')

    const events: any[] = []
    el.addEventListener('change', (e: any) => { events.push(e.detail) })

    square.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    square.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }))

    assert.equal(events.length, 2)
    assert.equal(events[0].picker, 'fill')
    assert.equal(events[0].color, square.dataset.rgb)
    assert.equal(events[1].picker, 'stroke')
  })
})
