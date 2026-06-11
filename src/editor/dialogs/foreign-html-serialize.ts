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

/** foreignObject child HTML → a fragment of editor DOM for edit mode. */
export const deserialize = (html: string): DocumentFragment => {
  const tpl = document.createElement('template')
  const tmp = document.createElement('div'); tmp.innerHTML = html
  const root = tmp.querySelector(`.${FOREIGN_ROOT_CLASS}`) ?? tmp
  tpl.innerHTML = root.innerHTML
  return tpl.content
}
