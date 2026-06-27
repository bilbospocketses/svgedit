// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/components/seInput.ts'

const flushUpgradeAndRender = async (el) => {
  // Works for both the current HTMLElement-based seInput and the LitElement
  // version: Lit components expose `updateComplete`; HTMLElement-based don't.
  // We wait for both customElements upgrade AND any microtask-queued render.
  await customElements.whenDefined('se-input')
  await new Promise(resolve => queueMicrotask(resolve))
  if (el && typeof el.updateComplete?.then === 'function') {
    await el.updateComplete
  }
}

describe('se-input form-control contract (PR-1 reference component B)', () => {
  let el

  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-input')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('exposes value property after setting value attribute', async () => {
    el.setAttribute('value', 'hello')
    await flushUpgradeAndRender(el)
    expect(el.value).toBe('hello')
  })

  it('renders label text inside shadow DOM #label element', async () => {
    el.setAttribute('label', 'TestLabel')
    await flushUpgradeAndRender(el)
    const label = el.shadowRoot.querySelector('#label')
    expect(label).not.toBeNull()
    // t() returns the key unchanged when no dict entry — 'TestLabel' is not a locale key
    expect(label.textContent.trim()).toBe('TestLabel')
  })

  it('value property setter updates el.value', async () => {
    await flushUpgradeAndRender(el)
    el.value = 'programmatic'
    expect(el.value).toBe('programmatic')
  })

  // #4: typing emits a host `input` (live preview, no undo); commit emits `change`.
  it('#4 emits a host input event on typing, not change', async () => {
    await flushUpgradeAndRender(el)
    const input = el.shadowRoot.querySelector('input')
    let inputs = 0; let changes = 0
    el.addEventListener('input', () => inputs++)
    el.addEventListener('change', () => changes++)
    input.value = 'ab'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(inputs).toBe(1)
    expect(changes).toBe(0)
    expect(el.value).toBe('ab')
  })

  it('#4 emits a host change event on native change (commit on blur)', async () => {
    await flushUpgradeAndRender(el)
    const input = el.shadowRoot.querySelector('input')
    let changes = 0
    el.addEventListener('change', () => changes++)
    input.value = 'done'
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(changes).toBe(1)
    expect(el.value).toBe('done')
  })

  it('#4 commits on Enter, but a non-Enter keyup does not', async () => {
    await flushUpgradeAndRender(el)
    const input = el.shadowRoot.querySelector('input')
    let changes = 0
    el.addEventListener('change', () => changes++)
    input.value = '5'
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }))
    expect(changes).toBe(0)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    expect(changes).toBe(1)
  })
})
