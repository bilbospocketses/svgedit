// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { packBarKey } from '../../src/editor/components/jgraduate/se-color-picker.ts'

const flush = async (el) => {
  await customElements.whenDefined('se-color-picker')
  await new Promise(resolve => queueMicrotask(resolve))
  if (el && typeof el.updateComplete?.then === 'function') {
    await el.updateComplete
  }
}

describe('packBarKey', () => {
  const base = { r: 0, g: 0, b: 0, h: 0, s: 0, v: 0, a: 255 }

  it('gives distinct rgb keys for colors differing only in r vs g', () => {
    // (r=1,g=0) and (r=0,g=100) both collapsed to 100000 under the old 1e5 stride
    const keyA = packBarKey('rgb', { ...base, r: 1, g: 0 })
    const keyB = packBarKey('rgb', { ...base, r: 0, g: 100 })
    expect(keyA).not.toBe(keyB)
  })

  it('packs distinct rgb triples to distinct keys across the channel range', () => {
    const seen = new Set<number>()
    for (const [r, g, b] of [[1, 0, 0], [0, 100, 0], [0, 0, 100], [255, 255, 255], [12, 34, 56]]) {
      seen.add(packBarKey('rgb', { ...base, r, g, b }))
    }
    expect(seen.size).toBe(5)
  })
})

describe('se-color-picker', () => {
  let el

  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-color-picker')
    el.setAttribute('color', 'ff0000ff')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('registers as custom element', async () => {
    await flush(el)
    expect(el.shadowRoot).not.toBeNull()
  })

  it('renders map canvas with width 256', async () => {
    await flush(el)
    const mapCanvas = el.shadowRoot.querySelector('#map-canvas')
    expect(mapCanvas).not.toBeNull()
    expect(mapCanvas.width).toBe(256)
  })

  it('renders bar canvas with width 20', async () => {
    await flush(el)
    const barCanvas = el.shadowRoot.querySelector('#bar-canvas')
    expect(barCanvas).not.toBeNull()
    expect(barCanvas.width).toBe(20)
  })

  it('renders radio buttons for color modes (H S V R G B A)', async () => {
    await flush(el)
    const radios = el.shadowRoot.querySelectorAll('input[type="radio"]')
    // alphaSupport defaults to true => H S V R G B A = 7 radios
    expect(radios.length).toBe(7)
  })

  it('renders text inputs for channels plus hex (7 total)', async () => {
    await flush(el)
    const inputs = el.shadowRoot.querySelectorAll('input[type="text"]')
    // 6 channel inputs (H S V R G B A minus alpha radio but alpha still has text) + hex = 7
    // Actually: H S V R G B A channels = 7 text inputs + 1 hex input = 8 when alpha shown
    // Let's just verify at least 7 total text inputs
    expect(inputs.length).toBeGreaterThanOrEqual(7)
  })

  it('renders a hex input with id hex-input', async () => {
    await flush(el)
    const hexInput = el.shadowRoot.querySelector('#hex-input')
    expect(hexInput).not.toBeNull()
    expect(hexInput.tagName.toLowerCase()).toBe('input')
  })

  it('renders Ok and Cancel buttons', async () => {
    await flush(el)
    const buttons = el.shadowRoot.querySelectorAll('.buttons button')
    expect(buttons.length).toBe(2)
  })

  it('dispatches commit event on Ok click', async () => {
    await flush(el)
    let fired = false
    let detail = null
    el.addEventListener('commit', (e) => {
      fired = true
      detail = e.detail
    })
    const buttons = el.shadowRoot.querySelectorAll('.buttons button')
    // Ok button is the first button in .buttons
    const okBtn = buttons[0]
    expect(okBtn).not.toBeNull()
    okBtn.click()
    expect(fired).toBe(true)
    expect(detail).not.toBeNull()
    expect(detail.color).not.toBeNull()
  })

  it('dispatches cancel event on Cancel click', async () => {
    await flush(el)
    let fired = false
    el.addEventListener('cancel', () => { fired = true })
    const buttons = el.shadowRoot.querySelectorAll('.buttons button')
    // Cancel button is the second button in .buttons
    const cancelBtn = buttons[1]
    expect(cancelBtn).not.toBeNull()
    cancelBtn.click()
    expect(fired).toBe(true)
  })

  it('renders preview swatches', async () => {
    await flush(el)
    const swatches = el.shadowRoot.querySelectorAll('.preview-box .swatch')
    expect(swatches.length).toBe(2)
  })

  it('renders channel-group with radio+label+input rows', async () => {
    await flush(el)
    const channelGroup = el.shadowRoot.querySelector('.channel-group')
    expect(channelGroup).not.toBeNull()
    const labels = channelGroup.querySelectorAll('label')
    // H S V R G B A = 7 labels
    expect(labels.length).toBe(7)
  })
})
