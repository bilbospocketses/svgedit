// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/dialogs/SePromptDialog.ts'

const flushRender = async (el) => {
  await customElements.whenDefined('se-prompt-dialog')
  await new Promise((resolve) => queueMicrotask(resolve))
  if (el && typeof el.updateComplete?.then === 'function') {
    await el.updateComplete
  }
}

// Simulate the native <dialog> close without showModal (unavailable in jsdom).
const closeWith = (el, returnValue, inputValue) => {
  const dlg = el.shadowRoot.querySelector('dialog')
  const input = el.shadowRoot.querySelector('input')
  if (inputValue !== undefined) input.value = inputValue
  dlg.returnValue = returnValue
  dlg.dispatchEvent(new Event('close'))
}

describe('se-prompt-dialog close → resolve mapping', () => {
  let el

  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-prompt-dialog')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('resolves the live input value when accepted (returnValue "ok")', async () => {
    el.message = 'Enter name'
    el.value = 'seed'
    await flushRender(el)
    const closed = el.whenClosed()
    closeWith(el, 'ok', 'typed-name')
    await expect(closed).resolves.toEqual({ value: 'typed-name' })
  })

  it('resolves null when cancelled (returnValue "cancel")', async () => {
    await flushRender(el)
    const closed = el.whenClosed()
    closeWith(el, 'cancel', 'ignored')
    await expect(closed).resolves.toEqual({ value: null })
  })

  it('resolves null on Esc (empty returnValue)', async () => {
    await flushRender(el)
    const closed = el.whenClosed()
    closeWith(el, '', 'ignored')
    await expect(closed).resolves.toEqual({ value: null })
  })

  it('seeds the input with the default value', async () => {
    el.value = 'default-text'
    await flushRender(el)
    expect(el.shadowRoot.querySelector('input').value).toBe('default-text')
  })
})
