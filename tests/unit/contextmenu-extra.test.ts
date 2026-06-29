import { describe, expect, it, beforeEach } from 'vitest'

import {
  add,
  getCustomHandler,
  hasCustomHandler,
  injectExtendedContextMenuItemsIntoDom,
  resetCustomMenus
} from '../../src/editor/contextmenu.js'

describe('contextmenu helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = "<ul id='cmenu_canvas'></ul>"
    resetCustomMenus()
  })

  it('validates menu entries and prevents duplicates', () => {
    expect(() => add(null as unknown as Parameters<typeof add>[0])).toThrow(/must be defined/)
    add({ id: 'foo', label: 'Foo', action: () => 'ok' })
    expect(hasCustomHandler('foo')).toBe(true)
    expect(getCustomHandler('foo')()).toBe('ok')
    expect(() =>
      add({ id: 'foo', label: 'Again', action: () => {} })
    ).toThrow(/already exists/)
  })

  it('injects extensions into the context menu DOM', () => {
    const host = document.getElementById('cmenu_canvas')
    add({ id: 'alpha', label: 'Alpha', action: () => {}, shortcut: 'Ctrl+A' })
    add({ id: 'beta', label: 'Beta', action: () => {} })

    injectExtendedContextMenuItemsIntoDom()

    // Built via the DOM API (no insertAdjacentHTML) — assert the real nodes (#46).
    const links = host!.querySelectorAll('li.disabled > a')
    expect(links).toHaveLength(2)
    expect(links[0]!.getAttribute('href')).toBe('#alpha')
    expect(links[0]!.textContent).toContain('Alpha')
    expect(links[0]!.querySelector('.shortcut')!.textContent).toBe('Ctrl+A')
    expect(links[1]!.getAttribute('href')).toBe('#beta')
    expect(links[1]!.textContent).toContain('Beta')
  })
})
