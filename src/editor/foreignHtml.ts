/**
 * foreignObject HTML authoring controller.
 *
 * Ties together the canvas foreign-mode events (`foreignCreate` / `foreignEdit`,
 * fired from svgcanvas `core/event.ts`), the `seForeignHtml` dialog helper, and
 * the `setForeignContent` canvas method. Registered once from `editorInit.ts`
 * alongside the other `svgCanvas.bind(...)` wiring.
 *
 * Flow:
 *  - `foreignCreate` — a new, just-drawn empty foreignObject (with a `se-fo-root`
 *    child). Open the dialog with empty content; on cancel/empty delete the box,
 *    otherwise inject the authored HTML and select the box. Always returns to
 *    select mode (the canvas leaves the editor in 'foreign' mode after a draw).
 *  - `foreignEdit` — an existing foreignObject, double-clicked. Open the dialog
 *    pre-filled with the current content; on cancel leave it unchanged, on empty
 *    delete it, otherwise replace the content. Already in select mode.
 *
 * @license MIT
 * @module foreignHtml
 */

import { NS } from '@svgedit/svgcanvas/core/namespaces.js'
import type Editor from './Editor.js'
import { FOREIGN_ROOT_CLASS } from './dialogs/foreign-html-serialize.js'

/** Wire the foreignObject create/edit authoring flow to the canvas events. */
export const registerForeignHtml = (editor: Editor): void => {
  const canvas = editor.svgCanvas

  /** Select a single foreignObject (clears any prior selection). */
  const selectFo = (fo: Element): void => {
    canvas.selectOnly([fo])
  }

  /** Reconstruct the dialog-facing content string from a foreignObject's child. */
  const currentContent = (fo: Element): string => {
    const root = fo.firstElementChild
    return root
      ? `<div xmlns="${NS.HTML}" class="${FOREIGN_ROOT_CLASS}">${root.innerHTML}</div>`
      : ''
  }

  /**
   * Author content for a freshly-drawn (empty) foreignObject.
   *
   * The box was drawn into the DOM by the canvas but deliberately NOT committed to
   * history (see the `foreign` mouseUp in `core/event.ts`). So on cancel/empty-OK we
   * just remove it — nothing was recorded, nothing can be redo-resurrected. On a real
   * OK we record the foreignObject insertion AND its content as one atomic
   * `BatchCommand`, so a single Ctrl+Z removes the whole box.
   */
  const authorNew = async (fo: Element): Promise<void> => {
    const result = await seForeignHtml('')
    if (result === null || result.trim() === '') {
      fo.remove()
    } else {
      const { BatchCommand, InsertElementCommand } = canvas.history
      const batch = new BatchCommand('Insert HTML')
      batch.addSubCommand(new InsertElementCommand(fo))
      // setForeignContent appends its (sanitize + content + height) sub-commands to
      // our batch instead of self-committing, keeping the insert a single undo unit.
      canvas.setForeignContent(fo, result, batch)
      canvas.addCommandToHistory(batch)
      selectFo(fo)
    }
    canvas.setMode('select')
  }

  /**
   * Author content for an existing foreignObject opened via double-click.
   * `setForeignContent` self-commits one change batch and sanitizes the injected
   * content internally, so no separate backstop pass is needed here.
   */
  const authorEdit = async (fo: Element): Promise<void> => {
    const result = await seForeignHtml(currentContent(fo))
    if (result === null) {
      return
    }
    if (result.trim() === '') {
      // Empty content on an existing (already-committed) box deletes it — undoably, so
      // Ctrl+Z restores the foreignObject (its child content rides along on re-insert).
      const parent = fo.parentNode
      if (!parent) return
      const { RemoveElementCommand } = canvas.history
      const sibling = fo.nextSibling
      canvas.clearSelection()
      fo.remove()
      canvas.addCommandToHistory(new RemoveElementCommand(fo, sibling, parent))
      return
    }
    canvas.setForeignContent(fo, result)
  }

  // `call` invokes handlers as (window, arg); the foreignObject element is arg.
  canvas.bind('foreignCreate', (_win: unknown, fo: Element) => { void authorNew(fo) })
  canvas.bind('foreignEdit', (_win: unknown, fo: Element) => { void authorEdit(fo) })
}
