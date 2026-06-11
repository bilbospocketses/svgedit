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

import type Editor from './Editor.js'

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
      ? `<div xmlns="http://www.w3.org/1999/xhtml" class="se-fo-root">${root.innerHTML}</div>`
      : ''
  }

  /** Author content for a freshly-drawn (empty) foreignObject. */
  const authorNew = async (fo: Element): Promise<void> => {
    const result = await seForeignHtml('')
    if (result === null || result.trim() === '') {
      fo.remove()
    } else {
      canvas.setForeignContent(fo, result)
      canvas.sanitizeSvg(fo)
      selectFo(fo)
    }
    canvas.setMode('select')
  }

  /** Author content for an existing foreignObject opened via double-click. */
  const authorEdit = async (fo: Element): Promise<void> => {
    const result = await seForeignHtml(currentContent(fo))
    if (result === null) {
      return
    }
    if (result.trim() === '') {
      fo.remove()
      return
    }
    canvas.setForeignContent(fo, result)
    canvas.sanitizeSvg(fo)
  }

  // `call` invokes handlers as (window, arg); the foreignObject element is arg.
  canvas.bind('foreignCreate', (_win: unknown, fo: Element) => { void authorNew(fo) })
  canvas.bind('foreignEdit', (_win: unknown, fo: Element) => { void authorEdit(fo) })
}
