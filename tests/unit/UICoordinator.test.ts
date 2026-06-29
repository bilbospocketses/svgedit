import { afterEach, describe, expect, it, vi } from 'vitest'
import { UICoordinator, type UICoordinatorHost } from '../../src/editor/UICoordinator.js'

/**
 * Characterizes UICoordinator (canvas lifecycle / layout / zoom / cursor /
 * context panel), extracted from Editor in the #108 PR-5. Uses a minimal host
 * stub plus a small jsdom fixture for the DOM these methods touch. The layout
 * math in `updateCanvas` is not unit-tested (jsdom returns empty
 * getComputedStyle -> NaN); the canvas-absent early-return and the
 * cursor/wireframe/context/zoom branches are.
 */
const makeSvgCanvas = (overrides = {}) => ({
  getMode: vi.fn(() => 'select'),
  getZoom: vi.fn(() => 1),
  contentW: 640,
  contentH: 480,
  updateCanvas: vi.fn(() => ({ x: 0, y: 0 })),
  setBBoxZoom: vi.fn(() => ({ zoom: 1, bbox: { x: 0, y: 0, width: 10, height: 10 } })),
  selectedElements: [],
  selectorManager: { requestSelector: vi.fn(() => ({ resize: vi.fn() })) },
  getCurrentDrawing: vi.fn(() => ({ getCurrentLayerName: () => 'Layer 1' })),
  runExtensions: vi.fn(),
  ...overrides
})

const makeHost = (overrides = {}) => {
  const workarea = document.createElement('div')
  document.body.appendChild(workarea)
  return {
    svgCanvas: makeSvgCanvas(),
    workarea,
    rulers: { updateRulers: vi.fn() },
    configObj: { curConfig: { canvas_expansion: 3, showRulers: false }, urldata: { storagePrompt: false } },
    leftPanel: { clickSelect: vi.fn() },
    bottomPanel: { changeZoom: vi.fn() },
    storagePromptState: 'ignore',
    curContext: null,
    ...overrides
  } as unknown as UICoordinatorHost
}

describe('UICoordinator', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  describe('setCursorStyle', () => {
    it('maps each mode group to the expected workarea cursor', () => {
      const host = makeHost()
      const ui = new UICoordinator(host)
      ui.setCursorStyle('text')
      expect(host.workarea.style.cursor).toBe('text')
      ui.setCursorStyle('ext-panning')
      expect(host.workarea.style.cursor).toBe('grab')
      ui.setCursorStyle('zoom')
      expect(host.workarea.style.cursor).toBe('crosshair')
      ui.setCursorStyle('rect')
      expect(host.workarea.style.cursor).toContain('rect_cursor.svg')
      ui.setCursorStyle('anything-else')
      expect(host.workarea.style.cursor).toBe('auto')
    })
  })

  describe('modeListener', () => {
    it('reads the canvas mode and sets the matching cursor', () => {
      const host = makeHost({ svgCanvas: makeSvgCanvas({ getMode: vi.fn(() => 'text') }) })
      new UICoordinator(host).modeListener(new Event('modeChange'))
      expect(host.svgCanvas.getMode).toHaveBeenCalled()
      expect(host.workarea.style.cursor).toBe('text')
    })
  })

  describe('updateWireFrame', () => {
    it('writes the zoom-scaled stroke rule only while the workarea is in wireframe mode', () => {
      const style = document.createElement('style')
      style.id = 'wireframe_rules'
      document.body.appendChild(style)
      const host = makeHost({ svgCanvas: makeSvgCanvas({ getZoom: vi.fn(() => 2) }) })

      new UICoordinator(host).updateWireFrame()
      expect(style.textContent).toBe('')

      host.workarea.classList.add('wireframe')
      new UICoordinator(host).updateWireFrame()
      expect(style.textContent).toContain('stroke-width: 0.5px')
    })
  })

  describe('contextChanged', () => {
    it('builds the ancestor breadcrumb and shows the panel for a context element', () => {
      const panel = document.createElement('div')
      panel.id = 'cur_context_panel'
      document.body.appendChild(panel)
      const svgcontent = document.createElement('div')
      svgcontent.id = 'svgcontent'
      const layer = document.createElement('div')
      layer.id = 'layer1'
      const rect = document.createElement('div')
      layer.appendChild(rect)
      svgcontent.appendChild(layer)
      document.body.appendChild(svgcontent)

      const host = makeHost()
      new UICoordinator(host).contextChanged(null, rect)

      expect(host.curContext).toBe(' > layer1')
      expect(panel.style.display).toBe('block')
      expect(panel.textContent).toContain('layer1')
    })

    it('clears the breadcrumb and hides the panel when context is null', () => {
      const panel = document.createElement('div')
      panel.id = 'cur_context_panel'
      document.body.appendChild(panel)
      const host = makeHost({ curContext: 'stale' })

      new UICoordinator(host).contextChanged(null, null)

      expect(host.curContext).toBeNull()
      expect(panel.style.display).toBe('none')
    })
  })

  describe('zoomDone', () => {
    it('resizes the selector for each selected element', () => {
      const resize = vi.fn()
      const el = document.createElement('div')
      const host = makeHost({
        svgCanvas: makeSvgCanvas({
          selectedElements: [el],
          selectorManager: { requestSelector: vi.fn(() => ({ resize })) }
        })
      })
      new UICoordinator(host).zoomDone()
      expect(host.svgCanvas.selectorManager.requestSelector).toHaveBeenCalledWith(el)
      expect(resize).toHaveBeenCalled()
    })
  })

  describe('zoomChanged', () => {
    it('clamps a near-zero zoom by routing it back through the bottom panel', () => {
      const host = makeHost({
        svgCanvas: makeSvgCanvas({ setBBoxZoom: vi.fn(() => ({ zoom: 0.0001, bbox: { x: 0, y: 0, width: 1, height: 1 } })) })
      })
      new UICoordinator(host).zoomChanged(window, {})
      expect(host.bottomPanel.changeZoom).toHaveBeenCalledWith('0.1')
      expect(host.svgCanvas.runExtensions).not.toHaveBeenCalled()
    })

    it('does nothing when setBBoxZoom returns no zoom info', () => {
      const host = makeHost({ svgCanvas: makeSvgCanvas({ setBBoxZoom: vi.fn(() => null) }) })
      new UICoordinator(host).zoomChanged(window, {})
      expect(host.bottomPanel.changeZoom).not.toHaveBeenCalled()
      expect(host.svgCanvas.runExtensions).not.toHaveBeenCalled()
    })

    it('applies a normal zoom: updates the zoom field, finishes the zoom, and notifies extensions', () => {
      const zoomInput = document.createElement('input')
      zoomInput.id = 'zoom'
      document.body.appendChild(zoomInput)
      const host = makeHost({
        svgCanvas: makeSvgCanvas({
          getZoom: vi.fn(() => 1.5),
          setBBoxZoom: vi.fn(() => ({ zoom: 1.5, bbox: { x: 0, y: 0, width: 4, height: 4 } }))
        })
      })
      new UICoordinator(host).zoomChanged(window, {}, true)
      expect(zoomInput.getAttribute('value')).toBe('150.0')
      expect(host.svgCanvas.runExtensions).toHaveBeenCalledWith(expect.objectContaining({ action: 'zoomChanged' }))
    })
  })

  describe('updateCanvas', () => {
    it('returns early without touching the canvas when #svgcanvas is absent', () => {
      const host = makeHost()
      expect(() => new UICoordinator(host).updateCanvas(true)).not.toThrow()
      expect(host.svgCanvas.updateCanvas).not.toHaveBeenCalled()
    })
  })
})
