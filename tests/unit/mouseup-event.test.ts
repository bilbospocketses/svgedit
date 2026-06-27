import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { init as initEvent } from '../../packages/svgcanvas/core/event.js'
import { init as initUtilities } from '../../packages/svgcanvas/core/utilities.js'

// Characterization harness for `mouseUpEvent` (audit #29 finding M12 / item #89).
// These lock the observable behaviour of every mouse-up code path BEFORE the
// 440-line handler is broken into sub-functions, so the behaviour-preserving
// extraction can be proven green. Drag-finalize batch-command internals depend on
// jsdom SVG transform-list parsing (unreliable), so the select-drag tests assert
// the robust observables (the per-element selector resize loop on move; path-select
// / shift-deselect on no-move) rather than the BatchCommand contents — those are
// covered by recalculate.test.ts + e2e.

const svgEl = (name: string): Element => document.createElementNS(NS.SVG, name)

describe('mouseUpEvent (characterization for #89 extraction)', () => {
  /** @type {HTMLDivElement} */
  let root: HTMLDivElement
  /** @type {SVGSVGElement} */
  let svgcontent: SVGSVGElement
  /** @type {SVGGElement} */
  let contentGroup: SVGGElement
  /** @type {any} */
  let canvas: any

  /** Build a fully-stubbed canvas covering every svgCanvas.* member mouseUpEvent touches. */
  const makeCanvas = (): any => {
    const rubberBox = svgEl('rect')
    const grips = { showGrips: vi.fn(), resize: vi.fn() }
    const c: any = {
      _started: true,
      _mode: 'select',
      _selected: [] as (Element | null)[],
      _justSelected: null as Element | null,
      _rStartX: 0,
      _rStartY: 0,
      _id: 'svg_1',
      _rubberBox: rubberBox,
      _drawnPath: null as Element | null,
      addedNew: false,
      hasDragStartTransform: false,
      dragStartTransforms: undefined as undefined | Map<Element, string>,
      dragStartBBoxes: undefined as undefined | Map<Element, unknown>,
      _grips: grips,

      getStarted () { return this._started },
      setStarted (v: boolean) { this._started = v },
      getCurrentMode () { return this._mode },
      setCurrentMode (m: string) { this._mode = m },
      setMode: vi.fn(function (this: any, m: string) { this._mode = m }),
      getSelectedElements () { return this._selected },
      getZoom () { return 1 },
      getJustSelected () { return this._justSelected },
      setJustSelected (v: Element | null) { this._justSelected = v },
      getRootSctm () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } },
      getId () { return this._id },
      getRubberBox () { return this._rubberBox },
      setCurBBoxes: vi.fn(),
      getRStartX () { return this._rStartX },
      getRStartY () { return this._rStartY },
      getDrawnPath () { return this._drawnPath },
      getSvgRoot () { return svgcontent },

      textActions: { init: vi.fn(), start: vi.fn(), mouseUp: vi.fn() },
      pathActions: {
        select: vi.fn(),
        mouseUp: vi.fn(),
        smoothPolylineIntoPath: vi.fn((el: Element) => el)
      },
      selectorManager: {
        selectorParentGroup: svgEl('g'),
        requestSelector: vi.fn(() => grips)
      },

      recalculateDimensions: vi.fn(() => null),
      recalculateAllSelectedDimensions: vi.fn(),
      addCommandToHistory: vi.fn(),
      removeFromSelection: vi.fn(),
      selectOnly: vi.fn(),
      call: vi.fn(),

      setSumDistance: vi.fn(),
      setControlPoint2: vi.fn(),
      setControlPoint1: vi.fn(),
      setStart: vi.fn(),
      setEnd: vi.fn(),
      getFreehand: vi.fn(() => 0),
      addSVGElementsFromJson: vi.fn(),

      setCurText: vi.fn(),
      setCurProperties: vi.fn(),

      undoMgr: { finishUndoableChange: vi.fn(() => ({ isEmpty: () => false })) },
      getCurrentDrawing: vi.fn(() => ({ releaseId: vi.fn() })),

      getStyle: () => ({ opacity: 1 }),
      getOpacAni: () => ({}),
      getCurConfig: () => ({ selectNew: true }),

      setStartTransform: vi.fn(),
      runExtensions: vi.fn(() => [])
    }
    return c
  }

  /** Append an element with the canvas id so `getElement(getId())` resolves to it. */
  const placeCurrentElement = (tag: string, attrs: Record<string, string> = {}): Element => {
    const el = svgEl(tag)
    el.id = canvas._id
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    contentGroup.appendChild(el)
    return el
  }

  const fireMouseUp = (over: Partial<MouseEvent> = {}): void => {
    canvas.mouseUpEvent({
      button: 0,
      clientX: 50,
      clientY: 50,
      shiftKey: false,
      altKey: false,
      preventDefault () {},
      target: contentGroup,
      ...over
    } as unknown as MouseEvent)
  }

  beforeEach(() => {
    root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)

    svgcontent = svgEl('svg') as SVGSVGElement
    svgcontent.id = 'svgcontent'
    root.append(svgcontent)

    contentGroup = svgEl('g') as SVGGElement
    svgcontent.append(contentGroup)

    canvas = makeCanvas()
    initUtilities(canvas)
    initEvent(canvas)
  })

  afterEach(() => {
    root.remove()
    vi.useRealTimers()
  })

  // ---- guards -------------------------------------------------------------

  it('returns immediately on right-click (button 2) without touching textActions', () => {
    fireMouseUp({ button: 2 })
    expect(canvas.textActions.init).not.toHaveBeenCalled()
  })

  it('returns immediately when the canvas was not started', () => {
    canvas._started = false
    fireMouseUp()
    expect(canvas.textActions.init).not.toHaveBeenCalled()
  })

  it('initializes textActions and clears justSelected once past the guards', () => {
    canvas._selected = []
    fireMouseUp()
    expect(canvas.textActions.init).toHaveBeenCalledTimes(1)
    expect(canvas._justSelected).toBeNull()
    expect(canvas._started).toBe(false)
  })

  // ---- resize / multiselect normalize to select ---------------------------

  it('resize mode hides the rubber band, clears bbox cache, and switches to select', () => {
    canvas._mode = 'resize'
    fireMouseUp()
    expect(canvas._rubberBox.getAttribute('display')).toBe('none')
    expect(canvas.setCurBBoxes).toHaveBeenCalledWith([])
    expect(canvas._mode).toBe('select')
  })

  // ---- select case --------------------------------------------------------

  it('select with one element (no move) applies its props and shows grips', () => {
    const el = svgEl('rect')
    el.setAttribute('fill', '#abc')
    contentGroup.appendChild(el)
    canvas._selected = [el]
    canvas._rStartX = 50
    canvas._rStartY = 50 // realX/Y === RStart => no move

    fireMouseUp()

    expect(canvas.setCurProperties).toHaveBeenCalledWith('fill', '#abc')
    expect(canvas._grips.showGrips).toHaveBeenCalledWith(true)
    expect(canvas._grips.resize).not.toHaveBeenCalled() // no-move => no resize loop
  })

  it('select with movement runs the per-element selector resize loop and clears drag transforms', () => {
    const el = svgEl('rect')
    contentGroup.appendChild(el)
    canvas._selected = [el]
    canvas._rStartX = 0
    canvas._rStartY = 0 // realX/Y (50,50) !== RStart => moved
    canvas.dragStartTransforms = new Map([[el, '']])

    fireMouseUp()

    expect(canvas._grips.resize).toHaveBeenCalled()
    expect(canvas.dragStartTransforms).toBeUndefined()
    expect(canvas.hasDragStartTransform).toBe(false)
  })

  it('select on an unmoved single path enters path-edit selection', () => {
    const path = svgEl('path')
    contentGroup.appendChild(path)
    canvas._selected = [path]
    canvas._rStartX = 50
    canvas._rStartY = 50

    fireMouseUp({ target: path })

    expect(canvas.pathActions.select).toHaveBeenCalledWith(path)
  })

  it('select with shift on an unmoved already-selected element removes it from the selection', () => {
    const el = svgEl('rect')
    contentGroup.appendChild(el)
    canvas._selected = [el]
    canvas._rStartX = 50
    canvas._rStartY = 50
    canvas._justSelected = null // tempJustSelected !== target

    fireMouseUp({ shiftKey: true, target: el })

    expect(canvas.removeFromSelection).toHaveBeenCalledWith([el])
  })

  // ---- zoom case ----------------------------------------------------------

  it('zoom fires the zoomed event with factor 2 (no shift) and hides the rubber band', () => {
    canvas._mode = 'zoom'
    canvas._rStartX = 10
    canvas._rStartY = 10

    fireMouseUp()

    expect(canvas._rubberBox.getAttribute('display')).toBe('none')
    expect(canvas.call).toHaveBeenCalledWith('zoomed', expect.objectContaining({ factor: 2 }))
  })

  it('zoom with shift uses factor 0.5', () => {
    canvas._mode = 'zoom'
    fireMouseUp({ shiftKey: true })
    expect(canvas.call).toHaveBeenCalledWith('zoomed', expect.objectContaining({ factor: 0.5 }))
  })

  // ---- shape finalize cases (feed the keep/discard branches) --------------

  it('rect with a real size is kept and finalized as a new element (addedNew + InsertElementCommand)', () => {
    vi.useFakeTimers()
    placeCurrentElement('rect', { width: '40', height: '30' })
    canvas._mode = 'rect'

    fireMouseUp()
    expect(canvas.addedNew).toBe(true)

    vi.runAllTimers()
    expect(canvas.addCommandToHistory).toHaveBeenCalledTimes(1)
    expect(canvas.call).toHaveBeenCalledWith('changed', expect.any(Array))
    expect(canvas.setMode).toHaveBeenCalledWith('select') // selectNew + rect in mode list
  })

  it('a degenerate rect (sub-pixel) is discarded: id released, element removed, select target chosen', () => {
    const releaseId = vi.fn()
    canvas.getCurrentDrawing = vi.fn(() => ({ releaseId }))
    const el = placeCurrentElement('rect', { width: '0', height: '0' })
    const clickTarget = svgEl('rect')
    contentGroup.appendChild(clickTarget)
    canvas._mode = 'rect'

    fireMouseUp({ target: clickTarget })

    expect(releaseId).toHaveBeenCalledWith('svg_1')
    expect(el.parentNode).toBeNull() // removed from the DOM
    expect(canvas.setMode).toHaveBeenCalledWith('select')
    expect(canvas.selectOnly).toHaveBeenCalledWith([clickTarget], true)
  })

  it('circle keeps only when the radius is non-zero', () => {
    vi.useFakeTimers()
    placeCurrentElement('circle', { r: '5' })
    canvas._mode = 'circle'
    fireMouseUp()
    expect(canvas.addedNew).toBe(true)
    vi.runAllTimers()
  })

  it('fhrect builds a rect from the freehand bbox and fires changed', () => {
    vi.useFakeTimers()
    const built = svgEl('rect')
    built.id = 'svg_1'
    contentGroup.appendChild(built)
    canvas.addSVGElementsFromJson = vi.fn(() => built)
    canvas.getFreehand = vi.fn((k: string) => (k === 'maxx' || k === 'maxy') ? 10 : 0)
    canvas._mode = 'fhrect'

    fireMouseUp()

    expect(canvas.addSVGElementsFromJson).toHaveBeenCalled()
    expect(canvas.call).toHaveBeenCalledWith('changed', [built])
    expect(canvas.addedNew).toBe(true)
    vi.runAllTimers()
  })

  it('text mode selects the new text element and starts the text editor', () => {
    const txt = placeCurrentElement('text')
    canvas._mode = 'text'
    fireMouseUp()
    expect(canvas.selectOnly).toHaveBeenCalledWith([txt])
    expect(canvas.textActions.start).toHaveBeenCalledWith(txt)
  })

  // ---- delegated path / text cases ---------------------------------------

  it('path mode delegates to pathActions.mouseUp and keeps drawing started', () => {
    canvas._mode = 'path'
    canvas.pathActions.mouseUp = vi.fn(() => null)
    fireMouseUp()
    expect(canvas.pathActions.mouseUp).toHaveBeenCalled()
    expect(canvas._started).toBe(true) // path re-arms started
  })

  it('pathedit mode delegates to pathActions.mouseUp and nulls the element (no finalize)', () => {
    canvas._mode = 'pathedit'
    fireMouseUp()
    expect(canvas.pathActions.mouseUp).toHaveBeenCalled()
    expect(canvas.addedNew).toBe(false) // element nulled => no addedNew finalize
  })

  it('textedit mode delegates to textActions.mouseUp', () => {
    canvas._mode = 'textedit'
    fireMouseUp()
    expect(canvas.textActions.mouseUp).toHaveBeenCalled()
  })

  it('rotate mode commits the undoable change, recalculates, and fires changed', () => {
    canvas._mode = 'rotate'
    fireMouseUp()
    expect(canvas._mode).toBe('select')
    expect(canvas.undoMgr.finishUndoableChange).toHaveBeenCalled()
    expect(canvas.addCommandToHistory).toHaveBeenCalled() // batch not empty
    expect(canvas.recalculateAllSelectedDimensions).toHaveBeenCalled()
    expect(canvas.call).toHaveBeenCalledWith('changed', canvas._selected)
  })

  // ---- runExtensions feedback --------------------------------------------

  it('an extension returning keep:true preserves an element that would otherwise be discarded', () => {
    vi.useFakeTimers()
    const el = placeCurrentElement('rect', { width: '0', height: '0' }) // keep would be false
    canvas._mode = 'rect'
    canvas.runExtensions = vi.fn(() => [{ keep: true, element: el, started: false }])

    fireMouseUp()
    expect(canvas.addedNew).toBe(true) // routed to the finalize branch, not discarded
    expect(el.parentNode).not.toBeNull()
    vi.runAllTimers()
  })

  // ---- early-return vs break-path tail ------------------------------------

  it('select and zoom modes return early, before the runExtensions tail', () => {
    canvas._selected = []
    fireMouseUp() // select with empty selection still returns at the case
    expect(canvas.runExtensions).not.toHaveBeenCalled()
    expect(canvas.setStartTransform).not.toHaveBeenCalled()
  })

  it('a break-path (default/unknown mode) runs the post-switch cleanup tail', () => {
    canvas._mode = 'ext-custom' // unrecognized => default case => break => tail
    canvas.dragStartTransforms = new Map()
    canvas.dragStartBBoxes = new Map()
    fireMouseUp()
    expect(canvas.runExtensions).toHaveBeenCalledTimes(1)
    expect(canvas.hasDragStartTransform).toBe(false)
    expect(canvas.dragStartTransforms).toBeUndefined()
    expect(canvas.dragStartBBoxes).toBeUndefined()
    expect(canvas.setStartTransform).toHaveBeenCalledWith(null)
  })
})
