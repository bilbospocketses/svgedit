import DOMPurify from 'dompurify'
import { NS } from '@svgedit/svgcanvas/core/namespaces.js'
import { FOREIGN_HTML_TAGS, FOREIGN_HTML_ATTRS, FOREIGN_STYLE_PROPS, hardenForeignAnchor } from '@svgedit/svgcanvas/core/sanitize.js'

export const FOREIGN_ROOT_CLASS: string = 'se-fo-root'

// DOMPurify allow-lists, derived from the shared canvas-side constants so the
// sanitizer and the editor agree on exactly one tag/attribute allowlist (the
// co-design). FOREIGN_HTML_TAGS / FOREIGN_HTML_ATTRS are the single source of truth.
const ALLOWED_TAGS: string[] = [...FOREIGN_HTML_TAGS]
const ALLOWED_ATTR: string[] = [...new Set(Object.values(FOREIGN_HTML_ATTRS).flat())] // class,id,style,href,target,rel

/**
 * Sanitize a raw HTML string through DOMPurify and return the resulting `<body>`.
 * DOMPurify is a vetted sanitizer (and one CodeQL recognises as a taint barrier for
 * `js/xss-through-dom`): it drops `<script>`, event handlers (`onerror` etc.) and any
 * tag/attribute outside our shared allowlist, parsing inertly so no `src`/`onerror`
 * ever fires. `RETURN_DOM: true` yields a sanitized `<body>` HTMLElement in the
 * current document for our `prune` pass to finish.
 */
const sanitizeToBody = (html: string): HTMLElement =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, RETURN_DOM: true }) as HTMLElement

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
 * True when an editor subtree has no displayable content: blank text and no `<hr>`.
 * `<hr>` is the only no-text element on the foreign allowlist (`<img>` is stripped),
 * so blank text + no `<hr>` means nothing would render. The dialog uses this to report
 * an emptied box as `''` so the controller deletes it instead of writing an empty wrapper.
 */
export const isForeignContentEmpty = (editorRoot: Element): boolean =>
  (editorRoot.textContent ?? '').trim() === '' && editorRoot.querySelector('hr') === null

/**
 * Move the (already-pruned) children of `source` into a fresh DocumentFragment,
 * importing each node into the main document. Shared tail of the sanitize helpers.
 */
const fragmentFromChildren = (source: Element): DocumentFragment => {
  const frag = document.createDocumentFragment()
  for (const node of Array.from(source.childNodes)) {
    frag.appendChild(document.importNode(node, true))
  }
  return frag
}

/**
 * Parse a raw HTML string through DOMPurify and prune it to the allowlist, returning
 * a DocumentFragment of clean editor DOM.
 *
 * DOMPurify removes `<script>`, inline event handlers and disallowed tags/attributes
 * (CodeQL recognises it as a sanitizer, so feeding an untrusted source-mode string
 * here breaks the `js/xss-through-dom` taint flow). `prune` then re-applies our finer
 * rules — the {@link FOREIGN_STYLE_PROPS} style-property allowlist and `<a>` href
 * scheme / target-rel hardening — keeping the canvas-side sanitizer co-design and
 * giving defense-in-depth before the nodes are imported into the live document.
 */
export const parseToEditorFragment = (html: string): DocumentFragment => {
  const body = sanitizeToBody(html)
  prune(body)
  return fragmentFromChildren(body)
}

/**
 * foreignObject child HTML → a fragment of editor DOM for edit mode.
 *
 * Input is normally our own `serialize` output, but sanitize it via DOMPurify and
 * prune anyway — uniform defense-in-depth with the source-mode path. Unwraps the
 * `FOREIGN_ROOT_CLASS` wrapper when present so only its children land in the editor.
 */
export const deserialize = (html: string): DocumentFragment => {
  const body = sanitizeToBody(html)
  const root = body.querySelector(`.${FOREIGN_ROOT_CLASS}`) ?? body
  prune(root)
  return fragmentFromChildren(root)
}
