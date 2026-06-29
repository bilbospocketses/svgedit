import { vi } from 'vitest'
import SvgCanvas from '../../packages/svgcanvas/svgcanvas.js'

describe('SvgCanvas destroy()', () => {
  const makeCanvas = () => {
    document.body.textContent = ''
    const svgEditor = document.createElement('div')
    svgEditor.id = 'svg_editor'
    const svgcanvas = document.createElement('div')
    svgcanvas.id = 'svgcanvas'
    const workarea = document.createElement('div')
    workarea.id = 'workarea'
    workarea.append(svgcanvas)
    const toolsLeft = document.createElement('div')
    toolsLeft.id = 'tools_left'
    svgEditor.append(workarea, toolsLeft)
    document.body.append(svgEditor)
    return new SvgCanvas(svgcanvas, {
      canvas_expansion: 3,
      dimensions: [640, 480],
      initFill: { color: 'FF0000', opacity: 1 },
      initStroke: { width: 5, color: '000000', opacity: 1 },
      initOpacity: 1,
      imgPath: '../editor/images',
      langPath: 'locale/',
      extPath: 'extensions/',
      extensions: [],
      initTool: 'select',
      wireframe: false
    })
  }

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.textContent = ''
  })

  it('detaches the global storage listener and the container listeners on destroy()', () => {
    const canvas = makeCanvas()
    const container = document.getElementById('svgcanvas')!
    const containerRemove = vi.spyOn(container, 'removeEventListener')
    const windowRemove = vi.spyOn(window, 'removeEventListener')

    canvas.destroy()

    // The global 'storage' listener is the real leak: window outlives the instance
    // and its handler closes over `this`.
    assert.ok(windowRemove.mock.calls.some((c) => c[0] === 'storage'))

    // Every container listener wired by the constructor is detached too.
    const removed = (containerRemove.mock.calls as unknown as Array<Parameters<HTMLElement['removeEventListener']>>).map((c) => c[0])
    for (const type of ['mousedown', 'mousemove', 'click', 'touchend', 'dblclick', 'mouseup', 'mouseleave', 'mousewheel', 'DOMMouseScroll']) {
      assert.ok(removed.includes(type), `expected the ${type} listener to be removed`)
    }
  })

  it('is idempotent -- a second destroy() detaches nothing more', () => {
    const canvas = makeCanvas()
    canvas.destroy()

    const windowRemove = vi.spyOn(window, 'removeEventListener')
    canvas.destroy()

    assert.equal(windowRemove.mock.calls.length, 0)
  })
})
