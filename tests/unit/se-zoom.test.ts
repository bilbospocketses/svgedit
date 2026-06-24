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
