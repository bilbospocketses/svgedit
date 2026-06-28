import { describe, it, expect, afterEach } from 'vitest'
import '../../src/editor/dialogs/seStatusDialog.js'

describe('se-status-dialog i18n', () => {
  afterEach(() => {
    document.body.textContent = ''
  })

  it('localizes the Cancel button from the i18next key after init', async () => {
    const el = document.createElement('se-status-dialog') as any
    document.body.append(el)
    await el.updateComplete
    // init pushes the localized labels; common.cancel drives the Cancel button.
    el.init({ t: (k: string) => (k === 'common.cancel' ? 'LOCALIZED_CANCEL' : k) })
    await el.updateComplete
    const btn = el.shadowRoot.querySelector('button')
    expect(btn.textContent.trim()).toBe('LOCALIZED_CANCEL')
  })
})
