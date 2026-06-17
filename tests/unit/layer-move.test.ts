import { describe, it, expect, vi, afterEach } from 'vitest'
import { moveSelectedToLayerWithConfirm } from '../../src/editor/layerMove.js'

const mkEditor = (): any => ({
  i18next: { t: (k: string) => k },
  svgCanvas: { moveSelectedToLayer: vi.fn(), clearSelection: vi.fn() },
  layersPanel: { populateLayers: vi.fn() }
})

describe('moveSelectedToLayerWithConfirm (#7)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('confirms before EVERY move, not just the first (the #7 bug)', async () => {
    const seConfirm = vi.fn().mockResolvedValue('Ok')
    vi.stubGlobal('seConfirm', seConfirm)
    const editor = mkEditor()
    await moveSelectedToLayerWithConfirm(editor, 'Layer 2')
    await moveSelectedToLayerWithConfirm(editor, 'Layer 1')
    expect(seConfirm).toHaveBeenCalledTimes(2)
    expect(editor.svgCanvas.moveSelectedToLayer).toHaveBeenCalledTimes(2)
  })

  it('aborts the move when the user cancels', async () => {
    const seConfirm = vi.fn().mockResolvedValue('Cancel')
    vi.stubGlobal('seConfirm', seConfirm)
    const editor = mkEditor()
    await moveSelectedToLayerWithConfirm(editor, 'Layer 2')
    expect(seConfirm).toHaveBeenCalledTimes(1)
    expect(editor.svgCanvas.moveSelectedToLayer).not.toHaveBeenCalled()
  })

  it('ignores an empty destination layer', async () => {
    const seConfirm = vi.fn().mockResolvedValue('Ok')
    vi.stubGlobal('seConfirm', seConfirm)
    const editor = mkEditor()
    await moveSelectedToLayerWithConfirm(editor, '')
    expect(seConfirm).not.toHaveBeenCalled()
  })
})
