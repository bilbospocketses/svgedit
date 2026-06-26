import { vi } from 'vitest'

// seList / seListItem render() read getSvgEditor().configObj.curConfig.imgPath;
// stub the editor singleton so they can render under jsdom.
vi.mock('../../src/editor/svgEditorInstance.js', () => ({
  getSvgEditor: () => ({
    configObj: { curConfig: { imgPath: '' } },
    svgCanvas: { container: document.createElement('div') }
  })
}))

import '../../src/editor/components/seList.js'
import '../../src/editor/components/seListItem.js'

/**
 * Characterizes the seList combobox a11y added in components wave C2b (#120):
 * combobox/listbox/option roles, aria-expanded/selected, and keyboard nav
 * (Arrow/Enter/Escape/Home/End) with roving tabindex. Focus/SR behaviour is
 * e2e/manual (jsdom has no real focus model) — these assert observable state.
 */
const mount = async () => {
  const el = document.createElement('se-list') as any
  el.label = 'Pick'
  el.value = 'b'
  for (const v of ['a', 'b', 'c']) {
    const item = document.createElement('se-list-item')
    item.setAttribute('value', v)
    item.setAttribute('option', v.toUpperCase())
    el.append(item)
  }
  document.body.append(el)
  await el.updateComplete
  await Promise.all(Array.from(el.querySelectorAll('se-list-item')).map((i: any) => i.updateComplete))
  return el
}

const key = (el: Element, k: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }))

describe('se-list combobox accessibility (#120)', () => {
  afterEach(() => {
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  it('exposes combobox + listbox + option roles and reflects selection/expanded state', async () => {
    const el = await mount()
    const root = el.shadowRoot
    const combo = root.querySelector('#selected-value')
    expect(combo.getAttribute('role')).toBe('combobox')
    expect(combo.getAttribute('aria-expanded')).toBe('false')
    expect(combo.getAttribute('aria-controls')).toBe('options-container')
    expect(root.querySelector('#options-container').getAttribute('role')).toBe('listbox')
    const items = el.querySelectorAll('se-list-item')
    items.forEach((it: Element) => expect(it.getAttribute('role')).toBe('option'))
    expect(items[1].getAttribute('aria-selected')).toBe('true')
    expect(items[0].getAttribute('aria-selected')).toBe('false')
  })

  it('opens on ArrowDown and makes the selected option active (roving tabindex)', async () => {
    const el = await mount()
    key(el, 'ArrowDown')
    expect(el.isDropdownOpen).toBe(true)
    await el.updateComplete
    expect(el.shadowRoot.querySelector('#selected-value').getAttribute('aria-expanded')).toBe('true')
    const items = el.querySelectorAll('se-list-item')
    expect(items[1].getAttribute('tabindex')).toBe('0')
    expect(items[0].getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowDown advances the active option and Enter selects it (value + change + close)', async () => {
    const el = await mount()
    key(el, 'ArrowDown')
    await el.updateComplete
    let changed: string | null = null
    el.addEventListener('change', (e: any) => { changed = e.detail.value })
    key(el, 'ArrowDown') // active b -> c
    key(el, 'Enter')
    expect(el.value).toBe('c')
    expect(changed).toBe('c')
    expect(el.isDropdownOpen).toBe(false)
  })

  it('Escape closes the open list', async () => {
    const el = await mount()
    key(el, 'ArrowDown')
    expect(el.isDropdownOpen).toBe(true)
    key(el, 'Escape')
    expect(el.isDropdownOpen).toBe(false)
  })
})
