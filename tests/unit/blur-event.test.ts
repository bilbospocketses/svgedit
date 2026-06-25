import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

describe('blur-event', () => {
  let svgCanvas

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('does not create a filter or history when setting blur to 0 on a new element', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: {
        id: 'rect-blur-zero',
        x: 10,
        y: 20,
        width: 30,
        height: 40
      }
    })

    svgCanvas.selectOnly([rect], true)
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    svgCanvas.setBlur(0, true)

    expect(rect.hasAttribute('filter')).toBe(false)
    expect(svgCanvas.getSvgContent().querySelector('#rect-blur-zero_blur')).toBeNull()
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize)
  })

  it('creates a blur filter and records a single history entry', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: {
        id: 'rect-blur-create',
        x: 10,
        y: 20,
        width: 30,
        height: 40
      }
    })

    svgCanvas.selectOnly([rect], true)
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    svgCanvas.setBlur(1.2, true)

    expect(rect.getAttribute('filter')).toBe('url(#rect-blur-create_blur)')
    const filter = svgCanvas.getSvgContent().querySelector('#rect-blur-create_blur')
    expect(filter).toBeTruthy()
    expect(filter.querySelector('feGaussianBlur').getAttribute('stdDeviation')).toBe('1.2')
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)
  })

  it('removes blur and supports undo/redo', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: {
        id: 'rect-blur-undo',
        x: 10,
        y: 20,
        width: 30,
        height: 40
      }
    })

    svgCanvas.selectOnly([rect], true)
    svgCanvas.setBlur(2, true)

    const undoSize = svgCanvas.undoMgr.getUndoStackSize()
    svgCanvas.setBlur(0, true)

    expect(rect.hasAttribute('filter')).toBe(false)
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)

    svgCanvas.undoMgr.undo()
    expect(rect.getAttribute('filter')).toBe('url(#rect-blur-undo_blur)')

    svgCanvas.undoMgr.redo()
    expect(rect.hasAttribute('filter')).toBe(false)
  })

  it('#102 setBlur with complete=false does not leak an open undoable change', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: { id: 'rect-blur-leak', x: 10, y: 20, width: 30, height: 40 }
    })
    svgCanvas.selectOnly([rect], true)

    const before = svgCanvas.undoMgr.undoChangeStackPointer
    svgCanvas.setBlur(2, false)
    // A non-final (complete=false) call must not leave a beginUndoableChange open:
    // the undo-change stack pointer must return to where it started.
    expect(svgCanvas.undoMgr.undoChangeStackPointer).toBe(before)
  })
})
