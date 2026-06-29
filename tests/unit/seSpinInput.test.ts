// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/components/seSpinInput.ts'
import type { SESpinInput } from '../../src/editor/components/seSpinInput'

const flush = async (el: SESpinInput) => {
  await customElements.whenDefined('se-spin-input')
  await new Promise(resolve => queueMicrotask(resolve))
  if (el && typeof el.updateComplete?.then === 'function') {
    await el.updateComplete
  }
}

// #4: number spin-input emits `input` (live preview, no undo) on a valid numeric
// keystroke and `change` (commit) on blur/Enter, with the NaN guard suppressing
// transient invalid input.
describe('se-spin-input #4 live-preview / commit', () => {
  let el: SESpinInput

  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-spin-input') as SESpinInput
    document.body.appendChild(el)
  })

  afterEach(() => { document.body.textContent = '' })

  it('emits a host input event on a valid numeric keystroke, not change', async () => {
    await flush(el)
    const input = el.shadowRoot!.querySelector('input')!
    let inputs = 0; let changes = 0
    el.addEventListener('input', () => inputs++)
    el.addEventListener('change', () => changes++)
    input.value = '42'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(inputs).toBe(1)
    expect(changes).toBe(0)
  })

  it('suppresses the preview for transient invalid input (empty value)', async () => {
    await flush(el)
    const input = el.shadowRoot!.querySelector('input')!
    let inputs = 0
    el.addEventListener('input', () => inputs++)
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(inputs).toBe(0)
    expect(el.value).toBe('') // value still synced even when the preview is skipped
  })

  it('commits on native change (blur)', async () => {
    await flush(el)
    const input = el.shadowRoot!.querySelector('input')!
    let changes = 0
    el.addEventListener('change', () => changes++)
    input.value = '7'
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(changes).toBe(1)
  })
})
