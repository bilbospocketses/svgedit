import { vi } from 'vitest'

// se-zoom's render() reads getSvgEditor().configObj.curConfig.imgPath; stub the
// editor singleton so the component can render under jsdom.
vi.mock('../../src/editor/svgEditorInstance.js', () => ({
  getSvgEditor: () => ({
    configObj: { curConfig: { imgPath: '' } },
    svgCanvas: { container: document.createElement('div') }
  })
}))

import '../../src/editor/components/seZoom.js'

describe('se-zoom option listeners', () => {
  afterEach(() => {
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  it('removes prior option click listeners before rebinding on slotchange (no accumulation)', async () => {
    const el = document.createElement('se-zoom') as any
    const opt = document.createElement('div')
    opt.setAttribute('value', '100')
    el.append(opt)
    document.body.append(el)
    await el.updateComplete
    el._handleOptionsChange() // ensure _options is populated before we start spying

    const addSpy = vi.spyOn(opt, 'addEventListener')
    const removeSpy = vi.spyOn(opt, 'removeEventListener')

    el._handleOptionsChange() // a re-slot must detach the old listener, then attach one

    const clickAdds = addSpy.mock.calls.filter((c) => c[0] === 'click').length
    const clickRemoves = removeSpy.mock.calls.filter((c) => c[0] === 'click').length
    assert.equal(clickAdds, 1)
    assert.equal(clickRemoves, 1) // RED before the fix: prior listener never removed (0)
  })
})

describe('se-zoom accessibility (#119)', () => {
  afterEach(() => {
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  const mount = async () => {
    const el = document.createElement('se-zoom') as any
    el.value = '100'
    document.body.append(el)
    await el.updateComplete
    return el
  }

  it('exposes the steppers and presets toggle as keyboard/SR-operable buttons with labels', async () => {
    const root = (await mount()).shadowRoot
    for (const id of ['arrow-up', 'arrow-down', 'down']) {
      const ctl = root.querySelector('#' + id)
      expect(ctl.getAttribute('role')).toBe('button')
      expect(ctl.getAttribute('tabindex')).toBe('0')
      expect(ctl.getAttribute('aria-label')).toBeTruthy()
    }
    expect(root.querySelector('input').getAttribute('aria-label')).toBeTruthy()
  })

  it('Enter on arrow-up increments and Space on arrow-down decrements the value', async () => {
    const el = await mount()
    const root = el.shadowRoot
    root.querySelector('#arrow-up').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(el.value).toBe('110')
    root.querySelector('#arrow-down').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(el.value).toBe('100')
  })

  it('Enter on the presets toggle opens the options', async () => {
    const el = await mount()
    el.shadowRoot.querySelector('#down').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(el.showOptions).toBe(true)
  })
})

describe('se-zoom #121 same-value input re-sync (characterization)', () => {
  afterEach(() => {
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  // The attributeChangedCallback re-syncs the input on oldValue === newValue, which the
  // audit flagged as an "inverted guard". It is intentional, not dead: Lit's
  // `.value=${this.value}` binding skips the re-render when the bound value is unchanged,
  // so a same-value re-set (the editor re-applying the current zoom) would leave a drifted
  // input untouched without it. This pins that behaviour.
  it('re-syncs a drifted input when the value attribute is re-set to the same value', async () => {
    const el = document.createElement('se-zoom') as any
    el.value = '100'
    document.body.append(el)
    await el.updateComplete
    const input = el.shadowRoot.querySelector('input')
    expect(input.value).toBe('100')

    // An uncommitted edit drifts the displayed input away from the bound value.
    input.value = '50'
    // Re-set value to the SAME value: Lit dedups the equal `.value=`, so the guard is the
    // only thing that re-syncs the input. Without it the input would stay at '50'.
    el.attributeChangedCallback('value', '100', '100')
    expect(input.value).toBe('100')
  })
})

describe('se-zoom #116 outside-close uses composedPath, not e.target', () => {
  afterEach(() => {
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  const open = async () => {
    const el = document.createElement('se-zoom') as any
    el.value = '100'
    document.body.append(el)
    await el.updateComplete
    el.showOptions = true
    return el
  }

  it('keeps the dropdown open for a click inside the component (incl. slotted options)', async () => {
    const el = await open()
    // A slotted option click: e.target is the option (not the host), but the host is in the
    // composedPath, so it is an INSIDE click and must not close the dropdown.
    const slotted = document.createElement('se-text')
    el._handleClose({ target: slotted, composedPath: () => [slotted, el, document.body, document] } as unknown as MouseEvent)
    expect(el.showOptions).toBe(true)
  })

  it('closes the dropdown for a click outside the component', async () => {
    const el = await open()
    el._handleClose({ target: document.body, composedPath: () => [document.body, document] } as unknown as MouseEvent)
    expect(el.showOptions).toBe(false)
  })
})
