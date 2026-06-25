import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentIO } from '../../src/editor/DocumentIO.js'

/**
 * Characterizes DocumentIO (extracted from Editor in the #108 PR-1). Uses a
 * minimal host stub; `seAlert`/`seConfirm` are ambient globals, stubbed here.
 */
const makeHost = (overrides = {}) => ({
  svgCanvas: {
    setSvgString: vi.fn(() => '<svg/>'),
    undoMgr: { getUndoStackSize: vi.fn(() => 0) }
  },
  i18next: { t: (k) => k },
  updateCanvas: vi.fn(),
  ready: (cb) => Promise.resolve(cb()),
  ...overrides
})

describe('DocumentIO', () => {
  beforeEach(() => {
    globalThis.seAlert = vi.fn()
    globalThis.seConfirm = vi.fn(async () => 'Cancel')
  })

  it('loadSvgString sets the SVG and updates the canvas on success', () => {
    const host = makeHost()
    new DocumentIO(host).loadSvgString('<svg id="x"/>')
    expect(host.svgCanvas.setSvgString).toHaveBeenCalledWith('<svg id="x"/>')
    expect(host.updateCanvas).toHaveBeenCalledWith(false, undefined)
  })

  it('loadSvgString throws and alerts when setSvgString returns false', () => {
    const host = makeHost({ svgCanvas: { setSvgString: vi.fn(() => false), undoMgr: { getUndoStackSize: () => 0 } } })
    expect(() => new DocumentIO(host).loadSvgString('bad')).toThrow('Error loading SVG')
    expect(globalThis.seAlert).toHaveBeenCalled()
    expect(host.updateCanvas).not.toHaveBeenCalled()
  })

  it('loadSvgString with noAlert throws without alerting', () => {
    const host = makeHost({ svgCanvas: { setSvgString: () => false, undoMgr: { getUndoStackSize: () => 0 } } })
    expect(() => new DocumentIO(host).loadSvgString('bad', { noAlert: true })).toThrow('Error loading SVG')
    expect(globalThis.seAlert).not.toHaveBeenCalled()
  })

  it('openPrep returns true when the undo stack is empty (no confirm)', async () => {
    const host = makeHost()
    expect(await new DocumentIO(host).openPrep()).toBe(true)
    expect(globalThis.seConfirm).not.toHaveBeenCalled()
  })

  it('openPrep confirms when there is undo history', async () => {
    const host = makeHost({ svgCanvas: { setSvgString: vi.fn(), undoMgr: { getUndoStackSize: () => 3 } } })
    await new DocumentIO(host).openPrep()
    expect(globalThis.seConfirm).toHaveBeenCalledWith('notification.QwantToOpen')
  })

  it('loadFromString loads via ready()', async () => {
    const host = makeHost()
    await new DocumentIO(host).loadFromString('<svg/>')
    expect(host.svgCanvas.setSvgString).toHaveBeenCalledWith('<svg/>')
  })

  it('loadFromDataURI decodes percent-encoded SVG and loads it', async () => {
    const host = makeHost()
    await new DocumentIO(host).loadFromDataURI('data:image/svg+xml,' + encodeURIComponent('<svg id="d"/>'))
    expect(host.svgCanvas.setSvgString).toHaveBeenCalledWith('<svg id="d"/>')
  })

  it('loadFromURL rejects a cross-origin URL when noAlert is set', async () => {
    const host = makeHost()
    await expect(new DocumentIO(host).loadFromURL('https://evil.example/x.svg', { noAlert: true }))
      .rejects.toThrow('URLLoadFail')
    expect(host.svgCanvas.setSvgString).not.toHaveBeenCalled()
  })
})
