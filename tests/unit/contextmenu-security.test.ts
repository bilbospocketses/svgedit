// @vitest-environment jsdom
// #46 — extension context-menu items must not inject HTML.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as contextmenu from '../../src/editor/contextmenu.js'

describe('contextmenu — HTML injection (#46)', () => {
  beforeEach(() => {
    document.body.textContent = ''
    const host = document.createElement('ul')
    host.id = 'cmenu_canvas'
    document.body.append(host)
  })
  afterEach(() => {
    contextmenu.resetCustomMenus()
    document.body.textContent = ''
  })

  it('does not inject HTML from a menu item label', () => {
    contextmenu.add({ id: 'x1', label: '<img src=x onerror="window.__pwned=1">', action () { /* noop */ } })
    contextmenu.injectExtendedContextMenuItemsIntoDom()
    const host = document.getElementById('cmenu_canvas')!
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toContain('<img src=x onerror=') // kept as text, not parsed
  })

  it('does not inject HTML from a menu item id (href attribute break-out)', () => {
    contextmenu.add({ id: 'x2"><img src=x onerror=alert(1)>', label: 'ok', action () { /* noop */ } })
    contextmenu.injectExtendedContextMenuItemsIntoDom()
    const host = document.getElementById('cmenu_canvas')!
    expect(host.querySelector('img')).toBeNull()
  })

  it('does not inject HTML from a menu item shortcut', () => {
    contextmenu.add({ id: 'x3', label: 'ok', shortcut: '<img src=x onerror=alert(1)>', action () { /* noop */ } })
    contextmenu.injectExtendedContextMenuItemsIntoDom()
    const host = document.getElementById('cmenu_canvas')!
    expect(host.querySelector('img')).toBeNull()
  })

  it('still renders a normal menu item as a link with shortcut', () => {
    contextmenu.add({ id: 'normal', label: 'My Item', shortcut: 'Ctrl+M', action () { /* noop */ } })
    contextmenu.injectExtendedContextMenuItemsIntoDom()
    const host = document.getElementById('cmenu_canvas')!
    const a = host.querySelector('a')!
    expect(a.getAttribute('href')).toBe('#normal')
    expect(a.textContent).toContain('My Item')
    expect(host.querySelector('.shortcut')?.textContent).toBe('Ctrl+M')
  })
})
