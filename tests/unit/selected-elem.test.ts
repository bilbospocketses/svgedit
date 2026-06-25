import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

describe('selected-elem', () => {
  let svgCanvas

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
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

  it('aligns selected elements to the left edge of the selection', () => {
    const r0 = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'align-r0', x: 0, y: 0, width: 10, height: 10 } })
    const r1 = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'align-r1', x: 20, y: 0, width: 10, height: 10 } })
    const r2 = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'align-r2', x: 100, y: 0, width: 10, height: 10 } })
    svgCanvas.selectOnly([r0, r1, r2], true)

    svgCanvas.alignSelectedElements('l', 'selected')

    // Left-align moves every element's left edge to the selection's minx (0).
    expect(r0.getAttribute('x')).toBe('0')
    expect(r1.getAttribute('x')).toBe('0')
    expect(r2.getAttribute('x')).toBe('0')
  })

  it('aligns to the left edge of the smallest (narrowest) element', () => {
    const small = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'sm-small', x: 50, y: 0, width: 10, height: 10 } })
    const big = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'sm-big', x: 0, y: 0, width: 40, height: 40 } })
    svgCanvas.selectOnly([small, big], true)

    svgCanvas.alignSelectedElements('l', 'smallest')

    // 'smallest' picks the narrowest bbox (small @ x=50) as the reference edge.
    expect(small.getAttribute('x')).toBe('50')
    expect(big.getAttribute('x')).toBe('50')
  })

  it('aligns to the left edge of the largest (widest) element', () => {
    const small = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'lg-small', x: 50, y: 0, width: 10, height: 10 } })
    const big = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'lg-big', x: 0, y: 0, width: 40, height: 40 } })
    svgCanvas.selectOnly([small, big], true)

    svgCanvas.alignSelectedElements('l', 'largest')

    // 'largest' picks the widest bbox (big @ x=0) as the reference edge.
    expect(small.getAttribute('x')).toBe('0')
    expect(big.getAttribute('x')).toBe('0')
  })

  it('distributes selected elements horizontally, mapping distances to the right elements', () => {
    // Selection order (A,B,C) deliberately differs from left-to-right order
    // (B,C,A) so the sorted-clone -> original-index mapping is exercised.
    const rA = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'dist-rA', x: 100, y: 0, width: 10, height: 10 } })
    const rB = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'dist-rB', x: 0, y: 0, width: 10, height: 10 } })
    const rC = svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'dist-rC', x: 20, y: 0, width: 10, height: 10 } })
    svgCanvas.selectOnly([rA, rB, rC], true)

    svgCanvas.alignSelectedElements('dh', 'selected')

    // minx=0, maxx=110, space=(110-30)/2=40: B stays at 0, C -> 50, A stays at 100.
    expect(rB.getAttribute('x')).toBe('0')
    expect(rC.getAttribute('x')).toBe('50')
    expect(rA.getAttribute('x')).toBe('100')
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

  it('#103 moves to bottom above defs/title regardless of their order', () => {
    const rect1 = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'order-1', x: 10, y: 10, width: 10, height: 10 }
    })
    const rect2 = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'order-2', x: 30, y: 10, width: 10, height: 10 }
    })
    const parent = svgCanvas.addSVGElementsFromJson({
      element: 'g', attr: { id: 'order-container' }
    })
    parent.append(rect1, rect2)
    // defs BEFORE title (reverse of the canonical order the old code assumed)
    const defs = document.createElementNS(NS.SVG, 'defs')
    parent.insertBefore(defs, rect1)
    const title = document.createElementNS(NS.SVG, 'title')
    title.textContent = 'Layer'
    parent.insertBefore(title, rect1)

    svgCanvas.selectOnly([rect2], true)
    svgCanvas.moveToBottomSelectedElement()

    const order = Array.from(parent.childNodes)
      .filter((n) => n.nodeType === 1)
      .map((n) => (n.tagName === 'title' || n.tagName === 'defs') ? n.tagName : n.id)
    // rect2 must land after BOTH defs and title, not wedged between them
    expect(order).toEqual(['defs', 'title', 'order-2', 'order-1'])
  })

  it('#103 does not throw when the selected element has no parent', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'orphan-rect', x: 0, y: 0, width: 10, height: 10 }
    })
    svgCanvas.selectOnly([rect], true)
    rect.remove() // detach: parentNode is now null
    expect(() => svgCanvas.moveToBottomSelectedElement()).not.toThrow()
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
