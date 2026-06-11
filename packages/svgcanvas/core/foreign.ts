/**
 * @module foreign Canvas method for injecting sanitized HTML into a foreignObject with undo/redo history.
 * @license MIT
 */

import { NS } from './namespaces.js'
import type { ISvgCanvas } from './svgcanvas-types.js'

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
 * Replace a foreignObject's HTML child with new (already-sanitized) content,
 * auto-fit its height to the rendered content, and record one undoable batch.
 * The caller is responsible for sanitizing `htmlString` before passing it in.
 * @function module:svgcanvas.SvgCanvas#setForeignContent
 */
export const setForeignContentMethod = (svgCanvas: ISvgCanvas, fo: Element, htmlString: string): void => {
  const { BatchCommand, InsertElementCommand, RemoveElementCommand, ChangeElementCommand } = svgCanvas.history
  const batch = new BatchCommand('Set HTML content')
  const oldRoot = fo.firstElementChild
  const sibling = oldRoot?.nextSibling ?? null
  if (oldRoot) {
    batch.addSubCommand(new RemoveElementCommand(oldRoot, sibling, fo))
    oldRoot.remove()
  }
  const newRoot = parseForeignRoot(htmlString)
  fo.appendChild(newRoot)
  batch.addSubCommand(new InsertElementCommand(newRoot))

  // Height auto-fit: grow height to fit content (best-effort; requires layout).
  const measured = (newRoot as HTMLElement).scrollHeight
  if (measured && Number(fo.getAttribute('height')) < measured) {
    const oldH = fo.getAttribute('height')
    fo.setAttribute('height', String(measured))
    batch.addSubCommand(new ChangeElementCommand(fo, { height: oldH }))
  }
  svgCanvas.addCommandToHistory(batch)
}
