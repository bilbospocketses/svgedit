import { afterEach, describe, expect, it } from 'vitest'
import '../../src/editor/dialogs/cmenuLayersDialog.js'

// se-cmenu-layers binds contextmenu/mousedown (and an optional left click) to the
// workarea named by its `value`, plus a mousedown on #sidepanels. Audit #137 hoists
// that lifecycle into a shared base class; these pin the behavior across the refactor.
describe('se-cmenu-layers #137 workarea listener lifecycle', () => {
  afterEach(() => { document.body.textContent = '' })

  const mountForLayer = async (opts: { leftclick?: boolean } = {}) => {
    const layer = document.createElement('div')
    layer.id = 'layerpanel'
    document.body.append(layer)
    const sidepanels = document.createElement('div')
    sidepanels.id = 'sidepanels'
    document.body.append(sidepanels)
    const el = document.createElement('se-cmenu-layers') as unknown as {
      value: string
      menuOpen: boolean
      updateComplete: Promise<unknown>
      setAttribute: (k: string, v: string) => void
      remove: () => void
    }
    if (opts.leftclick) el.setAttribute('leftclick', 'true')
    el.setAttribute('value', 'layerpanel')
    document.body.append(el as unknown as Node)
    await el.updateComplete
    return { el, layer, sidepanels }
  }

  it('opens the menu on a contextmenu event over the named workarea', async () => {
    const { el, layer } = await mountForLayer()
    expect(el.menuOpen).toBe(false)
    layer.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true }))
    expect(el.menuOpen).toBe(true)
  })

  it('also opens on a left click when leftclick is enabled', async () => {
    const { el, layer } = await mountForLayer({ leftclick: true })
    layer.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true }))
    expect(el.menuOpen).toBe(true)
  })

  it('closes the menu on a sidepanels mousedown', async () => {
    const { el, sidepanels } = await mountForLayer()
    el.menuOpen = true
    sidepanels.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
    expect(el.menuOpen).toBe(false)
  })

  it('detaches listeners once the dialog is removed', async () => {
    const { el, layer } = await mountForLayer()
    el.remove()
    layer.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true }))
    expect(el.menuOpen).toBe(false)
  })
})
