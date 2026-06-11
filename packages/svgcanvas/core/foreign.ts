/**
 * @module foreign Canvas method for injecting sanitized HTML into a foreignObject with undo/redo history.
 * @license MIT
 */

import { NS } from './namespaces.js'
import type { ISvgCanvas } from './svgcanvas-types.js'
import type { BatchCommand } from './history.js'

/** Parse an XHTML string into a namespaced element for injection. */
const parseForeignRoot = (htmlString: string): Element => {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="${NS.SVG}"><foreignObject>${htmlString}</foreignObject></svg>`, 'image/svg+xml')
  const root = doc.querySelector('foreignObject')?.firstElementChild
  if (root) return document.importNode(root, true)
  const empty = document.createElementNS(NS.HTML, 'div')
  return empty
}

/**
 * Replace a foreignObject's HTML child with new content, sanitize it in place,
 * auto-fit the foreignObject's height to the rendered content, and record the
 * resulting sub-commands as one undoable unit.
 *
 * The injected root is sanitized via {@link ISvgCanvas.sanitizeSvg} *before* the
 * height measurement and history commands, so layout + undo always see clean,
 * allowlisted content (the caller no longer needs a separate backstop pass).
 *
 * History composition:
 * - **No `parentBatch`** (the edit path): the swap is self-committed as one
 *   `BatchCommand` via `addCommandToHistory`.
 * - **With `parentBatch`** (the create path): the sub-commands are appended to the
 *   caller's batch and nothing is committed here, so the controller can wrap the
 *   foreignObject insertion + its content in a single atomic undoable command.
 *
 * @function module:svgcanvas.SvgCanvas#setForeignContent
 */
export const setForeignContentMethod = (
  svgCanvas: ISvgCanvas, fo: Element, htmlString: string, parentBatch?: BatchCommand
): void => {
  const { BatchCommand, InsertElementCommand, RemoveElementCommand, ChangeElementCommand } = svgCanvas.history
  const batch: BatchCommand = parentBatch ?? new BatchCommand('Set HTML content')
  const oldRoot = fo.firstElementChild
  const sibling = oldRoot?.nextSibling ?? null
  if (oldRoot) {
    batch.addSubCommand(new RemoveElementCommand(oldRoot, sibling, fo))
    oldRoot.remove()
  }
  const newRoot = parseForeignRoot(htmlString)
  fo.appendChild(newRoot)
  // Sanitize the injected subtree in place BEFORE measuring/height/history so the
  // backstop is authoritative and the recorded command captures sanitized content.
  // The se-fo-root <div> wrapper is allowlisted, so newRoot itself always survives.
  svgCanvas.sanitizeSvg(newRoot)
  batch.addSubCommand(new InsertElementCommand(newRoot))

  // Height auto-fit: grow height to fit content (best-effort; requires layout).
  const measured = (newRoot as HTMLElement).scrollHeight
  if (measured && Number(fo.getAttribute('height')) < measured) {
    const oldH = fo.getAttribute('height')
    fo.setAttribute('height', String(measured))
    batch.addSubCommand(new ChangeElementCommand(fo, { height: oldH }))
  }
  // Only self-commit when we own the batch; otherwise the caller commits it.
  if (!parentBatch) svgCanvas.addCommandToHistory(batch)
}
