/**
 * Renders the breadcrumb "context panel" (current layer name + ancestor ids).
 * @module contextPanel
 * @license Apache-2.0
 */

/**
 * Populate the context-panel element with the current layer name and the
 * ancestor-id breadcrumb. Built with the DOM API (textContent / setAttribute) so a
 * crafted element id or layer title cannot inject markup — element ids survive the
 * import sanitizer unvalidated, so they are untrusted at this sink (#47).
 */
export const renderContextPanel = (
  panel: Element,
  layerName: string,
  parents: Element[],
  context: Element
): void => {
  panel.replaceChildren()
  const root = document.createElement('a')
  root.setAttribute('href', '#')
  root.setAttribute('data-root', 'y')
  root.textContent = layerName
  panel.append(root)
  for (const parent of parents) {
    if (!parent.id) continue
    panel.append(document.createTextNode(' > '))
    if (parent !== context) {
      const a = document.createElement('a')
      a.setAttribute('href', '#')
      a.textContent = parent.id
      panel.append(a)
    } else {
      panel.append(document.createTextNode(parent.id))
    }
  }
}
