import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

describe('paste-elem', () => {
  let svgCanvas: ReturnType<typeof createSvgCanvasFixture>

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
    sessionStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
    sessionStorage.clear()
  })

  it('pastes copied elements and assigns new IDs', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: {
        id: 'rect-original',
        x: 10,
        y: 20,
        width: 30,
        height: 40
      }
    })

    svgCanvas.selectOnly([rect], true)
    svgCanvas.copySelectedElements()

    const undoSize = svgCanvas.undoMgr.getUndoStackSize()
    svgCanvas.pasteElements('in_place')

    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)
    const pasted = svgCanvas.getSelectedElements()[0]!
    expect(pasted).toBeTruthy()
    expect(pasted.tagName).toBe('rect')
    expect(pasted.id).not.toBe('rect-original')

    expect(svgCanvas.getSvgContent().querySelector('#rect-original')).toBeTruthy()
    expect(svgCanvas.getSvgContent().querySelector('#' + pasted.id)).toBe(pasted)
  })

  it('remaps internal url(#id) references when pasting', () => {
    const group = svgCanvas.addSVGElementsFromJson({
      element: 'g',
      attr: { id: 'group-original' }
    })

    const defs = document.createElementNS(NS.SVG, 'defs')
    const gradient = document.createElementNS(NS.SVG, 'linearGradient')
    gradient.id = 'grad-original'
    const stop = document.createElementNS(NS.SVG, 'stop')
    stop.setAttribute('offset', '0%')
    stop.setAttribute('stop-color', '#000')
    gradient.append(stop)
    defs.append(gradient)

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.id = 'rect-with-fill'
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '10')
    rect.setAttribute('height', '10')
    rect.setAttribute('fill', 'url(#grad-original)')
    group.append(defs, rect)

    svgCanvas.selectOnly([group], true)
    svgCanvas.copySelectedElements()
    svgCanvas.pasteElements('in_place')

    const pastedGroup = svgCanvas.getSelectedElements()[0]!
    const pastedGradient = pastedGroup.querySelector('linearGradient')!
    const pastedRect = pastedGroup.querySelector('rect')!

    expect(pastedGradient).toBeTruthy()
    expect(pastedRect).toBeTruthy()
    expect(pastedGradient.id).not.toBe('grad-original')
    expect(pastedRect.getAttribute('fill')).toBe('url(#' + pastedGradient.id + ')')
  })

  it('does not throw on invalid clipboard JSON', () => {
    sessionStorage.setItem(svgCanvas.getClipboardID(), 'not-json')
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    expect(() => svgCanvas.pasteElements('in_place')).not.toThrow()
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize)
  })

  it('does not throw on empty clipboard', () => {
    sessionStorage.setItem(svgCanvas.getClipboardID(), '[]')
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    expect(() => svgCanvas.pasteElements('in_place')).not.toThrow()
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize)
  })
})
