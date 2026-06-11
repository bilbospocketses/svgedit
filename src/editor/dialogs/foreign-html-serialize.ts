import { NS } from '@svgedit/svgcanvas/core/namespaces.js'
import { FOREIGN_HTML_TAGS, FOREIGN_HTML_ATTRS, FOREIGN_STYLE_PROPS, hardenForeignAnchor } from '@svgedit/svgcanvas/core/sanitize.js'

export const FOREIGN_ROOT_CLASS: string = 'se-fo-root'

const filterStyle = (value: string): string =>
  value.split(';').map((d) => {
    const i = d.indexOf(':'); if (i < 0) return ''
    const prop = d.slice(0, i).trim().toLowerCase(); const val = d.slice(i + 1).trim()
    if (!FOREIGN_STYLE_PROPS.has(prop) || /url\(|expression\(/i.test(val)) return ''
    return `${prop}: ${val}`
  }).filter(Boolean).join('; ')

/** Strip an editor DOM subtree to allowlisted tags/attrs (pre-injection pass). */
const prune = (node: Element): void => {
  for (const child of [...node.children]) {
    const tag = child.localName.toLowerCase()
    if (!FOREIGN_HTML_TAGS.has(tag)) {
      while (child.firstChild) node.insertBefore(child.firstChild, child)
      child.remove(); continue
    }
    const allowed = FOREIGN_HTML_ATTRS[tag] ?? FOREIGN_HTML_ATTRS['*'] ?? []
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase()
      if (!allowed.includes(name)) { child.removeAttribute(attr.name); continue }
      if (name === 'style') {
        const f = filterStyle(attr.value)
        if (f) child.setAttribute('style', f); else child.removeAttribute('style')
      }
    }
    // Mirror the canvas sanitizer's link policy: drop javascript:/data: hrefs and
    // force target/rel on survivors — same shared helper, no duplicated logic.
    if (tag === 'a') hardenForeignAnchor(child)
    prune(child)
  }
}

/** Editor DOM → XHTML-namespaced string for injection into a foreignObject. */
export const serialize = (editorRoot: Element): string => {
  const clone = editorRoot.cloneNode(true) as Element
  prune(clone)
  const inner = clone.innerHTML
  return `<div xmlns="${NS.HTML}" class="${FOREIGN_ROOT_CLASS}">${inner}</div>`
}

/**
 * Move the (already-pruned) children of `source` into a fresh DocumentFragment,
 * importing each node into the main document. Shared tail of the inert-parse helpers.
 */
const fragmentFromChildren = (source: Element): DocumentFragment => {
  const frag = document.createDocumentFragment()
  for (const node of Array.from(source.childNodes)) {
    frag.appendChild(document.importNode(node, true))
  }
  return frag
}

/**
 * Parse a raw HTML string INERTLY (no script execution, no resource/`onerror` loads)
 * and prune it to the allowlist, returning a DocumentFragment of clean editor DOM.
 *
 * `DOMParser().parseFromString(html, 'text/html')` builds an inert document: `<img>`
 * never requests its `src`, so `onerror` never fires, and `<script>` never runs. This
 * is deliberately NOT an `innerHTML` assignment — feeding an untrusted source-mode
 * string here cannot trigger script or resource-based XSS the way `el.innerHTML = …`
 * would. `prune` then strips everything outside the allowlist before the nodes are
 * imported into the live document.
 */
export const parseToEditorFragment = (html: string): DocumentFragment => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  prune(doc.body)
  return fragmentFromChildren(doc.body)
}

/**
 * foreignObject child HTML → a fragment of editor DOM for edit mode.
 *
 * Input is normally our own `serialize` output, but parse it inertly (via DOMParser,
 * not `innerHTML`) and prune anyway — uniform defense-in-depth with the source-mode
 * path. Unwraps the `FOREIGN_ROOT_CLASS` wrapper when present so only its children
 * land in the editor.
 */
export const deserialize = (html: string): DocumentFragment => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.body.querySelector(`.${FOREIGN_ROOT_CLASS}`) ?? doc.body
  prune(root)
  return fragmentFromChildren(root)
}
