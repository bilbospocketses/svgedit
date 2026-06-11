// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../src/editor/dialogs/SeForeignHtmlDialog.ts'

const flush = async (el: any) => {
  await customElements.whenDefined('se-foreign-html-dialog')
  await new Promise((r) => queueMicrotask(r))
  if (el?.updateComplete) await el.updateComplete
}
const closeWith = (el: any, returnValue: string) => {
  const dlg = el.shadowRoot.querySelector('dialog')
  dlg.returnValue = returnValue
  dlg.dispatchEvent(new Event('close'))
}

/** Dispatch a submit event on the form, with the given button as submitter. */
const submitForm = (el: any, buttonValue: string): SubmitEvent => {
  const form: HTMLFormElement = el.shadowRoot.querySelector('form')
  const button: HTMLButtonElement = form.querySelector(`button[value="${buttonValue}"]`) as HTMLButtonElement
  const event = new SubmitEvent('submit', { submitter: button, cancelable: true, bubbles: true })
  form.dispatchEvent(event)
  return event
}

describe('se-foreign-html-dialog', () => {
  let el: any
  beforeEach(() => { document.body.textContent = ''; el = document.createElement('se-foreign-html-dialog'); document.body.appendChild(el) })
  afterEach(() => { document.body.textContent = '' })

  it('resolves serialized html on OK', async () => {
    el.value = '<p>hi</p>'
    await flush(el)
    const closed = el.whenClosed()
    closeWith(el, 'ok')
    const { html } = await closed
    expect(html).toContain('hi')
  })

  it('resolves null on cancel', async () => {
    await flush(el)
    const closed = el.whenClosed()
    closeWith(el, 'cancel')
    await expect(closed).resolves.toEqual({ html: null })
  })

  it('seeds the editor with the value (edit mode)', async () => {
    el.value = '<p><strong>seed</strong></p>'
    await flush(el)
    expect(el.shadowRoot.querySelector('[part="editor"]').textContent).toContain('seed')
  })

  describe('source-mode empty-guard', () => {
    beforeEach(() => {
      // seAlert is an ambient global declared in globalDialogs.ts but not installed in
      // jsdom — mock it so the guard can call it without throwing.
      ;(window as any).seAlert = vi.fn()
    })
    afterEach(() => {
      delete (window as any).seAlert
    })

    it('prevents close and calls seAlert when source is non-empty but sanitizes to empty', async () => {
      await flush(el)
      // Put dialog into source mode and fill textarea with all-disallowed markup.
      el.source = true
      await el.updateComplete
      const srcEl: HTMLTextAreaElement = el.shadowRoot.querySelector('textarea')
      // script/iframe have no text children — prune removes them leaving nothing.
      srcEl.value = '<script></script><iframe></iframe>'
      const event = submitForm(el, 'ok')
      expect(event.defaultPrevented).toBe(true)
      expect((window as any).seAlert).toHaveBeenCalledOnce()
    })

    it('does NOT prevent close when source produces valid content', async () => {
      await flush(el)
      el.source = true
      await el.updateComplete
      const srcEl: HTMLTextAreaElement = el.shadowRoot.querySelector('textarea')
      srcEl.value = '<h2>Valid heading</h2>'
      const event = submitForm(el, 'ok')
      expect(event.defaultPrevented).toBe(false)
      expect((window as any).seAlert).not.toHaveBeenCalled()
    })

    it('does NOT prevent close when cancel is submitted (even with disallowed source)', async () => {
      await flush(el)
      el.source = true
      await el.updateComplete
      const srcEl: HTMLTextAreaElement = el.shadowRoot.querySelector('textarea')
      srcEl.value = '<script></script><iframe></iframe>'
      const event = submitForm(el, 'cancel')
      expect(event.defaultPrevented).toBe(false)
      expect((window as any).seAlert).not.toHaveBeenCalled()
    })

    it('does NOT prevent close when source textarea is empty (WYSIWYG-delete path)', async () => {
      await flush(el)
      el.source = true
      await el.updateComplete
      const srcEl: HTMLTextAreaElement = el.shadowRoot.querySelector('textarea')
      srcEl.value = ''
      const event = submitForm(el, 'ok')
      expect(event.defaultPrevented).toBe(false)
      expect((window as any).seAlert).not.toHaveBeenCalled()
    })
  })
})
