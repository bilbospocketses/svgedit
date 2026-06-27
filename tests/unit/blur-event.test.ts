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

  // Audit #29 item #4 (tier 3): live-preview blur. beginBlurPreview() snapshots the
  // original filter state, setBlurNoUndo(val) previews each keystroke live, and
  // finishBlurPreview() records ONE undo entry spanning original -> final, handling
  // the new-filter / adjust-existing / remove cases.
  it('live-preview creates a new blur as one undo entry (#4)', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'rect-blur-prev-new', x: 10, y: 20, width: 30, height: 40 }
    })
    svgCanvas.selectOnly([rect], true)
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    svgCanvas.beginBlurPreview()
    svgCanvas.setBlurNoUndo(1)
    svgCanvas.setBlurNoUndo(2.5) // live keystrokes, no per-keystroke history
    svgCanvas.finishBlurPreview()

    expect(rect.getAttribute('filter')).toBe('url(#rect-blur-prev-new_blur)')
    expect(svgCanvas.getSvgContent().querySelector('#rect-blur-prev-new_blur feGaussianBlur').getAttribute('stdDeviation')).toBe('2.5')
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)

    svgCanvas.undoMgr.undo()
    expect(rect.hasAttribute('filter')).toBe(false)
    svgCanvas.undoMgr.redo()
    expect(rect.getAttribute('filter')).toBe('url(#rect-blur-prev-new_blur)')
    expect(svgCanvas.getSvgContent().querySelector('#rect-blur-prev-new_blur feGaussianBlur').getAttribute('stdDeviation')).toBe('2.5')
  })

  it('live-preview adjusts an existing blur as one undo entry (#4)', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'rect-blur-prev-adj', x: 10, y: 20, width: 30, height: 40 }
    })
    svgCanvas.selectOnly([rect], true)
    svgCanvas.setBlur(2, true) // pre-existing blur, stdDeviation 2
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()
    const blurSel = '#rect-blur-prev-adj_blur feGaussianBlur'

    svgCanvas.beginBlurPreview()
    svgCanvas.setBlurNoUndo(6)
    svgCanvas.finishBlurPreview()

    expect(svgCanvas.getSvgContent().querySelector(blurSel).getAttribute('stdDeviation')).toBe('6')
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)

    svgCanvas.undoMgr.undo()
    expect(svgCanvas.getSvgContent().querySelector(blurSel).getAttribute('stdDeviation')).toBe('2')
    svgCanvas.undoMgr.redo()
    expect(svgCanvas.getSvgContent().querySelector(blurSel).getAttribute('stdDeviation')).toBe('6')
  })

  it('live-preview removing a blur (to 0) is one undo entry (#4)', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'rect-blur-prev-rm', x: 10, y: 20, width: 30, height: 40 }
    })
    svgCanvas.selectOnly([rect], true)
    svgCanvas.setBlur(2, true)
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    svgCanvas.beginBlurPreview()
    svgCanvas.setBlurNoUndo(0)
    svgCanvas.finishBlurPreview()

    expect(rect.getAttribute('filter') || '').toBe('') // no blur
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)

    svgCanvas.undoMgr.undo()
    expect(rect.getAttribute('filter')).toBe('url(#rect-blur-prev-rm_blur)')
    svgCanvas.undoMgr.redo()
    expect(rect.getAttribute('filter') || '').toBe('')
  })

  it('live-preview with no net change records nothing (#4)', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'rect-blur-prev-noop', x: 10, y: 20, width: 30, height: 40 }
    })
    svgCanvas.selectOnly([rect], true)
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    svgCanvas.beginBlurPreview()
    svgCanvas.finishBlurPreview() // no setBlurNoUndo in between

    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize)
  })

  it('live-preview does not leak the undo-change stack (#102 invariant) (#4)', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect', attr: { id: 'rect-blur-prev-leak', x: 10, y: 20, width: 30, height: 40 }
    })
    svgCanvas.selectOnly([rect], true)
    const before = svgCanvas.undoMgr.undoChangeStackPointer

    svgCanvas.beginBlurPreview()
    svgCanvas.setBlurNoUndo(3)
    svgCanvas.finishBlurPreview()

    expect(svgCanvas.undoMgr.undoChangeStackPointer).toBe(before)
  })
})
