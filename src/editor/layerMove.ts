import type Editor from './Editor.js'

/**
 * Move the current selection to another layer, always asking the user to
 * confirm first.
 *
 * Audit #7: the previous inline handler gated the confirmation on a
 * `promptMoveLayerOnce` flag, so after the first confirmed move every
 * subsequent layer change relocated the selection with no confirmation.
 */
export const moveSelectedToLayerWithConfirm = async (editor: Editor, destLayer: string): Promise<void> => {
  if (!destLayer) return
  const confirmStr = editor.i18next.t('notification.QmoveElemsToLayer').replace('%s', destLayer)
  const ok = await seConfirm(confirmStr)
  if (ok === 'Cancel') return
  editor.svgCanvas.moveSelectedToLayer(destLayer)
  editor.svgCanvas.clearSelection()
  editor.layersPanel.populateLayers()
}
