import { describe, it, expect, vi, afterEach } from 'vitest'

// svgSourceDialog.render() reads getSvgEditor().configObj.curConfig.dynamicOutput;
// stub the editor singleton so the component can render under jsdom.
vi.mock('../../src/editor/svgEditorInstance.js', () => ({
  getSvgEditor: () => ({
    configObj: { curConfig: { dynamicOutput: false } }
  })
}))

import '../../src/editor/dialogs/svgSourceDialog.js'

describe('se-svg-source-editor-dialog i18n', () => {
  afterEach(() => {
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  it('localizes the toggle-dynamic label from the i18next key after init', async () => {
    const el = document.createElement('se-svg-source-editor-dialog') as any
    document.body.append(el)
    el.init({ t: (k: string) => `T:${k}` })
    await el.updateComplete
    const label = el.shadowRoot.querySelector('label[for="tool_source_dynamic"]')
    // RED: the label is the hardcoded "Toggle dynamic size" until wired to a key.
    expect(label.textContent).toContain('T:tools.source_toggle_dynamic')
  })
})
