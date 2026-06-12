// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../src/editor/dialogs/SeForeignHtmlDialog.ts'
import { parseToEditorFragment } from '../../src/editor/dialogs/foreign-html-serialize.ts'

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

  it('resolves empty string on OK when the editor is empty (delete path)', async () => {
    await flush(el) // no value seeded -> editor empty
    const closed = el.whenClosed()
    closeWith(el, 'ok')
    await expect(closed).resolves.toEqual({ html: '' })
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

  describe('source-mode XSS hardening (inert parse, no innerHTML sink)', () => {
    it('parseToEditorFragment strips an <img onerror=…> without throwing', () => {
      // The dangerous markup must be inert-parsed (no resource load / onerror) and pruned.
      let frag!: DocumentFragment
      expect(() => { frag = parseToEditorFragment('<img src=x onerror="window.__xss=1">hi') }).not.toThrow()
      const host = document.createElement('div')
      host.appendChild(frag)
      // <img> is not on the foreign allowlist → removed entirely; no onerror attribute survives.
      expect(host.querySelector('img')).toBeNull()
      expect(host.innerHTML).not.toContain('onerror')
      expect((window as any).__xss).toBeUndefined()
      expect(host.textContent).toContain('hi') // benign text is preserved
    })

    it('parseToEditorFragment drops <script> and event-handler attrs but keeps allowlisted markup', () => {
      const host = document.createElement('div')
      host.appendChild(parseToEditorFragment('<p onclick="evil()">a</p><script>steal()</' + 'script>'))
      expect(host.querySelector('script')).toBeNull()
      expect(host.innerHTML).not.toContain('onclick')
      expect(host.innerHTML).not.toContain('evil')
      expect(host.querySelector('p')?.textContent).toBe('a') // the safe <p> survives, unwrapped of its handler
    })

    it('source-mode OK serializes sanitised content — the onerror img never reaches the canvas string', async () => {
      await flush(el)
      el.source = true
      await el.updateComplete
      const srcEl: HTMLTextAreaElement = el.shadowRoot.querySelector('textarea')
      srcEl.value = '<p>safe</p><img src=x onerror="window.__xss2=1">'
      const closed = el.whenClosed()
      closeWith(el, 'ok')
      const { html } = await closed
      expect(html).toContain('safe')
      expect(html).not.toContain('<img')
      expect(html).not.toContain('onerror')
      expect((window as any).__xss2).toBeUndefined()
    })

    it('toggling source -> WYSIWYG loads sanitised DOM (no <img>/onerror) into the live editor', async () => {
      await flush(el)
      el.source = true
      await el.updateComplete
      const srcEl: HTMLTextAreaElement = el.shadowRoot.querySelector('textarea')
      srcEl.value = '<p>kept</p><img src=x onerror="window.__xss3=1">'
      // Toggle back to WYSIWYG: the editor must be populated via inert parse, not innerHTML.
      el.shadowRoot.querySelector('button[title="HTML source"]').click()
      await el.updateComplete
      const editor = el.shadowRoot.querySelector('[part="editor"]')
      expect(editor.querySelector('img')).toBeNull()
      expect(editor.innerHTML).not.toContain('onerror')
      expect(editor.textContent).toContain('kept')
      expect((window as any).__xss3).toBeUndefined()
    })
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
