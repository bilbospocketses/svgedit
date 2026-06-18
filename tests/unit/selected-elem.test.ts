import SvgCanvas from '../../packages/svgcanvas/svgcanvas.js'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'

describe('selected-elem', () => {
  let svgCanvas

  const createSvgCanvas = () => {
    document.body.textContent = ''
    const svgEditor = document.createElement('div')
    svgEditor.id = 'svg_editor'
    const svgcanvas = document.createElement('div')
    svgcanvas.style.visibility = 'hidden'
    svgcanvas.id = 'svgcanvas'
    const workarea = document.createElement('div')
    workarea.id = 'workarea'
    workarea.append(svgcanvas)
    const toolsLeft = document.createElement('div')
    toolsLeft.id = 'tools_left'
    svgEditor.append(workarea, toolsLeft)
    document.body.append(svgEditor)

    svgCanvas = new SvgCanvas(document.getElementById('svgcanvas'), {
      canvas_expansion: 3,
      dimensions: [640, 480],
      initFill: {
        color: 'FF0000',
        opacity: 1
      },
      initStroke: {
        width: 5,
        color: '000000',
        opacity: 1
      },
      initOpacity: 1,
      imgPath: '../editor/images',
      langPath: 'locale/',
      extPath: 'extensions/',
      extensions: [],
      initTool: 'select',
      wireframe: false
    })
  }

  beforeEach(() => {
    createSvgCanvas()
    sessionStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
    sessionStorage.clear()
  })

  it('copies selection without requiring context menu DOM', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: {
        id: 'rect-copy',
        x: 10,
        y: 20,
        width: 30,
        height: 40
      }
    })

    svgCanvas.selectOnly([rect], true)

    expect(() => svgCanvas.copySelectedElements()).not.toThrow()

    const raw = sessionStorage.getItem(svgCanvas.getClipboardID())
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].element).toBe('rect')
    expect(parsed[0].attr.id).toBe('rect-copy')
  })

  it('moves element to bottom even with whitespace/title/defs nodes', () => {
    const rect1 = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: {
        id: 'rect-bottom-1',
        x: 10,
        y: 10,
        width: 10,
        height: 10
      }
    })
    const rect2 = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: {
        id: 'rect-bottom-2',
        x: 30,
        y: 10,
        width: 10,
        height: 10
      }
    })

    const parent = svgCanvas.addSVGElementsFromJson({
      element: 'g',
      attr: { id: 'move-bottom-container' }
    })
    parent.append(rect1, rect2)
    parent.insertBefore(document.createTextNode('\n'), parent.firstChild)
    const title = document.createElementNS(NS.SVG, 'title')
    title.textContent = 'Layer'
    parent.insertBefore(title, rect1)
    const defs = document.createElementNS(NS.SVG, 'defs')
    parent.insertBefore(defs, rect1)

    svgCanvas.selectOnly([rect2], true)
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    expect(() => svgCanvas.moveToBottomSelectedElement()).not.toThrow()
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)

    const order = Array.from(parent.childNodes)
      .filter((n) => n.nodeType === 1)
      .map((n) => (n.tagName === 'title' || n.tagName === 'defs') ? n.tagName : n.id)

    expect(order).toEqual(['title', 'defs', 'rect-bottom-2', 'rect-bottom-1'])
  })

  it('ungroups a <use> when it is the first element child', () => {
    const defs = svgCanvas.getSvgContent().querySelector('defs') ||
      svgCanvas.getSvgContent().appendChild(document.createElementNS(NS.SVG, 'defs'))

    const symbol = document.createElementNS(NS.SVG, 'symbol')
    symbol.id = 'symbol-test'
    const symRect = document.createElementNS(NS.SVG, 'rect')
    symRect.setAttribute('x', '10')
    symRect.setAttribute('y', '20')
    symRect.setAttribute('width', '30')
    symRect.setAttribute('height', '40')
    symbol.append(symRect)
    defs.append(symbol)

    const container = svgCanvas.addSVGElementsFromJson({
      element: 'g',
      attr: { id: 'use-container' }
    })
    const use = svgCanvas.addSVGElementsFromJson({
      element: 'use',
      attr: { id: 'use-test', href: '#symbol-test' }
    })
    container.append(use)
    svgCanvas.setUseData(use)
    svgCanvas.selectOnly([use], true)

    expect(() => svgCanvas.ungroupSelectedElement()).not.toThrow()

    expect(container.querySelector('use')).toBeNull()
    const group = container.firstElementChild
    expect(group).toBeTruthy()
    expect(group.tagName).toBe('g')
    expect(group.querySelector('rect')).toBeTruthy()
  })

  it('does not crash ungrouping a <use> without href', () => {
    const use = svgCanvas.addSVGElementsFromJson({
      element: 'use',
      attr: { id: 'use-no-href' }
    })
    svgCanvas.selectOnly([use], true)

    const originalWarn = console.warn
    console.warn = () => {}
    try {
      expect(() => svgCanvas.ungroupSelectedElement()).not.toThrow()
    } finally {
      console.warn = originalWarn
    }
    expect(svgCanvas.getSvgContent().querySelector('#use-no-href')).toBeTruthy()
  })

  // v1.2 (PR-B audit #1): group/move bus events. Direct unit-level proof that the new
  // svgCanvas event-bus events fire in the right order around groupSelectedElements +
  // moveSelectedElements. The embed e2e suite covers the embed-channel mirror; these tests
  // cover the internal bus contract that ext-connector subscribes to.

  it('groupSelectedElements fires before-group then after-group on the bus', () => {
    const fired = []
    svgCanvas.bind('before-group', () => { fired.push('before-group') })
    svgCanvas.bind('after-group', () => { fired.push('after-group') })

    const rect1 = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: { id: 'group-bus-r1', x: 0, y: 0, width: 10, height: 10 }
    })
    const rect2 = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: { id: 'group-bus-r2', x: 20, y: 0, width: 10, height: 10 }
    })
    svgCanvas.selectOnly([rect1, rect2], true)

    svgCanvas.groupSelectedElements()
    expect(fired).toEqual(['before-group', 'after-group'])
  })

  it('moveSelectedElements fires before-move then after-move on the bus (with selection)', () => {
    const fired = []
    svgCanvas.bind('before-move', () => { fired.push('before-move') })
    svgCanvas.bind('after-move', () => { fired.push('after-move') })

    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: { id: 'move-bus-rect', x: 0, y: 0, width: 10, height: 10 }
    })
    svgCanvas.selectOnly([rect], true)

    svgCanvas.moveSelectedElements(5, 5, false)
    expect(fired).toEqual(['before-move', 'after-move'])
  })

  it('moveSelectedElements fires after-move even with empty selection', () => {
    const fired = []
    svgCanvas.bind('before-move', () => { fired.push('before-move') })
    svgCanvas.bind('after-move', () => { fired.push('after-move') })

    svgCanvas.clearSelection()
    svgCanvas.moveSelectedElements(1, 1, false)

    expect(fired).toEqual(['before-move', 'after-move'])
  })

  it('#15 cloneSelectedElements clones every selected element (confirm not-a-bug)', () => {
    const r1 = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'clone-1', x: 0, y: 0, width: 10, height: 10 } })
    const r2 = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'clone-2', x: 20, y: 0, width: 10, height: 10 } })
    const r3 = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'clone-3', x: 40, y: 0, width: 10, height: 10 } })
    svgCanvas.selectOnly([r1, r2, r3], true)
    const before = svgCanvas.getSvgContent().querySelectorAll('rect').length
    svgCanvas.cloneSelectedElements(5, 5)
    const after = svgCanvas.getSvgContent().querySelectorAll('rect').length
    expect(after).toBe(before + 3)
  })

  it('#16 cycleElement does not selectOnly([false]) when the current element is gone', () => {
    const a = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'cyc-a', x: 0, y: 0, width: 10, height: 10 } })
    svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'cyc-b', x: 20, y: 0, width: 10, height: 10 } })
    svgCanvas.selectOnly([a], true)
    a.remove() // selected element is no longer in the layer but remains the current element
    const spy = vi.spyOn(svgCanvas, 'selectOnly')
    svgCanvas.cycleElement(true)
    expect(spy).not.toHaveBeenCalledWith([false], true)
  })

  it('#50 ungroups a <use> whose symbol id has selector metacharacters without throwing', () => {
    const content = svgCanvas.getSvgContent()
    const defs = content.querySelector('defs') ||
      content.appendChild(document.createElementNS(NS.SVG, 'defs'))
    const symbol = document.createElementNS(NS.SVG, 'symbol')
    symbol.id = 'a"]b' // breaks the interpolated `use[href="#…"]` selector in convertToGroup
    const symRect = document.createElementNS(NS.SVG, 'rect')
    symRect.setAttribute('width', '10')
    symRect.setAttribute('height', '10')
    symbol.append(symRect)
    defs.append(symbol)

    const container = svgCanvas.addSVGElementsFromJson({
      element: 'g',
      attr: { id: 'use50-container' }
    })
    const use = svgCanvas.addSVGElementsFromJson({
      element: 'use',
      attr: { id: 'use50', href: '#a"]b' }
    })
    container.append(use)
    svgCanvas.setUseData(use)
    svgCanvas.selectOnly([use], true)

    expect(() => svgCanvas.ungroupSelectedElement()).not.toThrow()

    expect(container.querySelector('use')).toBeNull()
    const group = container.firstElementChild
    expect(group).toBeTruthy()
    expect(group.tagName).toBe('g')
    expect(group.querySelector('rect')).toBeTruthy()
  })
})
