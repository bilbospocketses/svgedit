import { vi } from 'vitest'

// seExplorerButton.render() reads getSvgEditor().configObj.curConfig.imgPath;
// stub the editor singleton so the component renders under jsdom.
vi.mock('../../src/editor/svgEditorInstance.js', () => ({
  getSvgEditor: () => ({
    configObj: { curConfig: { imgPath: '' } },
    svgCanvas: { container: document.createElement('div') }
  })
}))

import '../../src/editor/components/seExplorerButton.js'

describe('se-explorerbutton #117 shape-library XSS', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    document.body.textContent = ''
    globalThis.fetch = realFetch
    vi.restoreAllMocks()
    delete (window as unknown as Record<string, unknown>).__xss
  })

  it('does not inject markup from a hostile shape key or menu name', async () => {
    // Both the menu name (index.json `lib`) and the shape key (<menu>.json `data`)
    // come from fetched library JSON. A hostile value must be escaped, not parsed
    // into live DOM (the unsafeHTML string-build broke out of the attribute).
    const hostileMenu = '"><img src=x onerror="window.__xss=1">'
    const hostileKey = '"><img src=y onerror="window.__xss=1">'
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ lib: [hostileMenu] }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { [hostileKey]: 'M0,0 L10,10' } }) }) as unknown as typeof fetch

    const el = document.createElement('se-explorerbutton') as unknown as { lib: string; updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }
    el.lib = 'shapelib/'
    document.body.append(el as unknown as Node)
    await el.updateComplete
    // Let the async _loadLib -> _updateLib fetch chain resolve, then flush re-renders.
    for (let i = 0; i < 8; i++) { await Promise.resolve(); await el.updateComplete }

    assert.equal(el.shadowRoot.querySelector('img'), null, 'hostile key/menu must not create an <img> element')
    assert.equal((window as unknown as Record<string, unknown>).__xss, undefined, 'no XSS side effect')
  })

  const flush = async (el: { updateComplete: Promise<unknown> }) => {
    for (let i = 0; i < 8; i++) { await Promise.resolve(); await el.updateComplete }
  }

  it('clicking a menu category switches the library and marks it pressed', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ lib: ['cat', 'dog'] }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { c1: 'M0,0' } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { d1: 'M1,1', d2: 'M2,2' } }) }) as unknown as typeof fetch
    const el = document.createElement('se-explorerbutton') as any
    el.lib = 'shapelib/'
    document.body.append(el)
    await el.updateComplete
    await flush(el)

    const root = el.shadowRoot
    const pressedMenus = () => [...root.querySelectorAll('.menu-item.pressed')].map((m: any) => m.dataset.menu)
    assert.equal(root.querySelectorAll('.menu-item').length, 2)
    assert.deepEqual(pressedMenus(), ['cat'])
    assert.equal(root.querySelectorAll('se-button').length, 1)

    const dog = [...root.querySelectorAll('.menu-item')].find((m: any) => m.dataset.menu === 'dog') as HTMLElement
    dog.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    await flush(el)

    assert.deepEqual(pressedMenus(), ['dog'])
    assert.equal(root.querySelectorAll('se-button').length, 2)
  })

  it('renders one se-button per shape and marks the active shape pressed (reactive)', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ lib: ['cat'] }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { c1: 'M0,0', c2: 'M1,1' } }) }) as unknown as typeof fetch
    const el = document.createElement('se-explorerbutton') as any
    el.lib = 'shapelib/'
    document.body.append(el)
    await el.updateComplete
    await flush(el)

    const buttons = () => [...el.shadowRoot.querySelectorAll('se-button')] as any[]
    assert.equal(buttons().length, 2)
    assert.deepEqual(buttons().map((b) => b.dataset.shape), ['c1', 'c2'])

    // Shape selection is reactive: _activeShape drives each se-button's `pressed`.
    el._activeShape = 'c2'
    await el.updateComplete
    assert.deepEqual(buttons().filter((b) => b.pressed).map((b) => b.dataset.shape), ['c2'])
  })
})
