import { afterEach, describe, expect, it } from 'vitest'
import '../../src/editor/dialogs/cmenuDialog.js'

// se-cmenu_canvas-dialog uses contextMenuStyles (a CSSResult, no .html import) and
// only touches $id('workarea') in connectedCallback (null-safe), so it renders under
// jsdom. These pin the WAI-ARIA menu treatment added in audit #3.
describe('se-cmenu_canvas-dialog #3 ARIA menu', () => {
  afterEach(() => { document.body.textContent = '' })

  const mount = async () => {
    const el = document.createElement('se-cmenu_canvas-dialog') as unknown as {
      init: (i: { t: (k: string) => string }) => void
      shadowRoot: ShadowRoot
      updateComplete: Promise<unknown>
      menuOpen: boolean
      setAttribute: (k: string, v: string) => void
      addEventListener: (t: string, h: () => void) => void
    }
    el.init({ t: (k) => k })
    document.body.append(el as unknown as Node)
    await el.updateComplete
    return el
  }

  it('exposes role=menu and 11 role=menuitem items, enabled by default', async () => {
    const el = await mount()
    const root = el.shadowRoot
    expect(root.querySelector('ul')?.getAttribute('role')).toBe('menu')
    const items = [...root.querySelectorAll('a[role="menuitem"]')]
    expect(items.length).toBe(11)
    items.forEach((a) => expect(a.getAttribute('aria-disabled')).toBe('false'))
  })

  it('marks a disabled item aria-disabled and keeps it inert (no action dispatched)', async () => {
    const el = await mount()
    el.setAttribute('disablemenuitems', '#cut')
    await el.updateComplete
    let fired = false
    el.addEventListener('change', () => { fired = true })
    const cut = el.shadowRoot.querySelector('#se-cut') as HTMLAnchorElement
    expect(cut.getAttribute('aria-disabled')).toBe('true')
    cut.click()
    expect(fired).toBe(false)
  })

  it('Escape on the menu closes it', async () => {
    const el = await mount()
    el.menuOpen = true
    await el.updateComplete
    el.shadowRoot.querySelector('ul')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(el.menuOpen).toBe(false)
  })
})

// The canvas context menu binds contextmenu/mousedown listeners to #workarea on
// connect and removes them on disconnect. Audit #137 hoists that lifecycle into a
// shared base class; these pin the behavior so the extraction stays a pure refactor.
describe('se-cmenu_canvas-dialog #137 workarea listener lifecycle', () => {
  afterEach(() => { document.body.textContent = '' })

  const mountWithWorkarea = async () => {
    const workarea = document.createElement('div')
    workarea.id = 'workarea'
    document.body.append(workarea)
    const el = document.createElement('se-cmenu_canvas-dialog') as unknown as {
      menuOpen: boolean
      updateComplete: Promise<unknown>
      remove: () => void
    }
    document.body.append(el as unknown as Node)
    await el.updateComplete
    return { el, workarea }
  }

  it('opens the menu on a contextmenu event over the workarea', async () => {
    const { el, workarea } = await mountWithWorkarea()
    expect(el.menuOpen).toBe(false)
    workarea.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true }))
    expect(el.menuOpen).toBe(true)
  })

  it('closes the menu on a non-right mousedown over the workarea', async () => {
    const { el, workarea } = await mountWithWorkarea()
    el.menuOpen = true
    workarea.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
    expect(el.menuOpen).toBe(false)
  })

  it('detaches the workarea listeners once the dialog is removed', async () => {
    const { el, workarea } = await mountWithWorkarea()
    el.remove()
    workarea.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true }))
    expect(el.menuOpen).toBe(false)
  })
})
