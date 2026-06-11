// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
})
