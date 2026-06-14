/**
 * Tools for SVG sanitization.
 * @module sanitize
 * @license MIT
 *
 */

import { getReverseNS, NS } from './namespaces.js'
import { getHref, getRefElem, setHref, getUrlFromAttr } from './utilities.js'
import { warn } from '../common/logger.js'

const REVERSE_NS = getReverseNS()
const FONT_ATTRIBUTES = ['font-family', 'font-size', 'font-stretch', 'font-style', 'font-weight']

// --- Untrusted-input hardening (regressions live in sanitize-security.test.ts) ---
// Upper bound on a passed-through se:/data- attribute value (smuggling/DoS guard, #41).
const MAX_DATA_ATTR_LEN = 4096
// se:<name> / data-<name> restricted to a markup-safe name shape (#41).
const SAFE_DATA_NAME = /^(?:se:[A-Za-z][\w-]*|data-[a-z][\w.:-]*)$/
// CSS value constructs that fetch or script — never promote/keep these (#3, #42).
const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|image-set\s*\(|javascript:/i

// Todo: Split out into core attributes, presentation attributes, etc. so consistent
/**
 * This defines which elements and attributes that we support (or at least
 * don't remove).
 */
 
const svgGenericWhiteList: string[] = ['class', 'id', 'display', 'transform', 'style']
const svgWhiteList_: Record<string, string[]> = {
  // SVG Elements
  a: ['clip-path', 'clip-rule', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'href', 'mask', 'opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'xlink:href', 'xlink:title'],
  circle: ['clip-path', 'clip-rule', 'cx', 'cy', 'enable-background', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'mask', 'opacity', 'r', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage'],
  clipPath: ['clipPathUnits'],
  defs: [],
  desc: [],
  ellipse: ['clip-path', 'clip-rule', 'cx', 'cy', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'mask', 'opacity', 'requiredFeatures', 'rx', 'ry', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage'],
  feBlend: ['in', 'in2'],
  feColorMatrix: ['in', 'type', 'value', 'result', 'values'],
  feComposite: ['in', 'operator', 'result', 'in2'],
  feFlood: ['flood-color', 'in', 'result', 'flood-opacity'],
  feGaussianBlur: ['color-interpolation-filters', 'in', 'requiredFeatures', 'stdDeviation', 'result'],
  feMerge: [],
  feMergeNode: ['in'],
  feMorphology: ['in', 'operator', 'radius'],
  feOffset: ['dx', 'in', 'dy', 'result'],
  filter: ['color-interpolation-filters', 'filterRes', 'filterUnits', 'height', 'href', 'primitiveUnits', 'requiredFeatures', 'width', 'x', 'xlink:href', 'y'],
  foreignObject: ['font-size', 'height', 'opacity', 'requiredFeatures', 'width', 'x', 'y'],
  g: [...FONT_ATTRIBUTES, 'clip-path', 'clip-rule', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'mask', 'opacity', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'text-anchor'],
  image: [
    'clip-path', 'clip-rule', 'filter', 'height', 'mask', 'opacity',
    'preserveAspectRatio', 'requiredFeatures', 'systemLanguage', 'viewBox',
    'width', 'x', 'href', 'xlink:href', 'xlink:title', 'y'
  ],
  line: ['clip-path', 'clip-rule', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'marker-end', 'marker-mid', 'marker-start', 'mask', 'opacity', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'x1', 'x2', 'y1', 'y2'],
  linearGradient: ['gradientTransform', 'gradientUnits', 'requiredFeatures', 'spreadMethod', 'systemLanguage', 'x1', 'x2', 'href', 'xlink:href', 'y1', 'y2'],
  marker: ['markerHeight', 'markerUnits', 'markerWidth', 'orient', 'preserveAspectRatio', 'refX', 'refY', 'se_type', 'systemLanguage', 'viewBox'],
  mask: ['height', 'maskContentUnits', 'maskUnits', 'width', 'x', 'y'],
  metadata: [],
  path: ['clip-path', 'clip-rule', 'd', 'enable-background', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'marker-end', 'marker-mid', 'marker-start', 'mask', 'opacity', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage'],
  pattern: ['height', 'patternContentUnits', 'patternTransform', 'patternUnits', 'requiredFeatures', 'systemLanguage', 'viewBox', 'width', 'x', 'href', 'xlink:href', 'y'],
  polygon: ['clip-path', 'clip-rule', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'marker-end', 'marker-mid', 'marker-start', 'mask', 'opacity', 'points', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'sides', 'shape', 'edge', 'point', 'starRadiusMultiplier', 'r', 'radialshift', 'r2', 'orient', 'cx', 'cy'],
  polyline: ['clip-path', 'clip-rule', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'marker-end', 'marker-mid', 'marker-start', 'mask', 'opacity', 'points', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'se:connector'],
  radialGradient: ['cx', 'cy', 'fx', 'fy', 'gradientTransform', 'gradientUnits', 'r', 'requiredFeatures', 'spreadMethod', 'systemLanguage', 'href', 'xlink:href'],
  rect: ['clip-path', 'clip-rule', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'height', 'mask', 'opacity', 'requiredFeatures', 'rx', 'ry', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'width', 'x', 'y'],
  stop: ['offset', 'requiredFeatures', 'stop-opacity', 'systemLanguage', 'stop-color', 'gradientUnits', 'gradientTransform'],
  style: ['type'],
  svg: ['clip-path', 'clip-rule', 'enable-background', 'filter', 'height', 'mask', 'preserveAspectRatio', 'requiredFeatures', 'systemLanguage', 'version', 'viewBox', 'width', 'x', 'xmlns', 'xmlns:se', 'xmlns:xlink', 'y', 'stroke-linejoin', 'fill-rule', 'aria-label', 'stroke-width', 'fill-rule', 'xml:space'],
  switch: ['requiredFeatures', 'systemLanguage'],
  symbol: [...FONT_ATTRIBUTES, 'fill', 'fill-opacity', 'fill-rule', 'filter', 'opacity', 'overflow', 'preserveAspectRatio', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'viewBox', 'width', 'height'],
  text: [...FONT_ATTRIBUTES, 'clip-path', 'clip-rule', 'dominant-baseline', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'mask', 'opacity', 'requiredFeatures', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'text-anchor', 'letter-spacing', 'word-spacing', 'text-decoration', 'textLength', 'lengthAdjust', 'x', 'xml:space', 'y'],
  textPath: ['dominant-baseline', 'href', 'method', 'requiredFeatures', 'spacing', 'startOffset', 'systemLanguage', 'xlink:href'],
  title: [],
  tspan: [...FONT_ATTRIBUTES, 'clip-path', 'clip-rule', 'dx', 'dy', 'dominant-baseline', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'mask', 'opacity', 'requiredFeatures', 'rotate', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'systemLanguage', 'text-anchor', 'textLength', 'x', 'xml:space', 'y'],
  use: ['clip-path', 'clip-rule', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'height', 'href', 'mask', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'width', 'x', 'xlink:href', 'y', 'overflow'],
  // Filter Primitives
  feComponentTransfer: ['in', 'result'],
  feFuncR: ['type', 'tableValues', 'slope', 'intercept', 'amplitude', 'exponent', 'offset'],
  feFuncG: ['type', 'tableValues', 'slope', 'intercept', 'amplitude', 'exponent', 'offset'],
  feFuncB: ['type', 'tableValues', 'slope', 'intercept', 'amplitude', 'exponent', 'offset'],
  feFuncA: ['type', 'tableValues', 'slope', 'intercept', 'amplitude', 'exponent', 'offset'],
  feConvolveMatrix: ['in', 'order', 'kernelMatrix', 'divisor', 'bias', 'targetX', 'targetY', 'edgeMode', 'kernelUnitLength', 'preserveAlpha'],
  feDiffuseLighting: ['in', 'surfaceScale', 'diffuseConstant', 'kernelUnitLength', 'lighting-color'],
  feSpecularLighting: ['in', 'surfaceScale', 'specularConstant', 'specularExponent', 'kernelUnitLength', 'lighting-color'],
  feDisplacementMap: ['in', 'in2', 'scale', 'xChannelSelector', 'yChannelSelector'],
  feTurbulence: ['baseFrequency', 'numOctaves', 'result', 'seed', 'stitchTiles', 'type'],
  feTile: ['in'],

  // HTML Elements for use in a foreignObject
  div: [],
  p: [],
  li: [],
  pre: [],
  ol: [],
  ul: [],
  span: [],
  hr: [],
  br: [],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: []
}

// === foreignObject HTML content allowlist (co-designed with the editor) ===
// Exported so the editor's serialize layer emits exactly what is permitted here.
export const FOREIGN_HTML_TAGS: Set<string> = new Set<string>([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'pre', 'hr', 'br',
  'strong', 'em', 'u', 's', 'b', 'i', 'sub', 'sup', 'a', 'blockquote'
])

// Per-tag attribute allowlist; '*' = applies to every allowed tag.
export const FOREIGN_HTML_ATTRS: Record<string, string[]> = {
  '*': ['class', 'id', 'style'],
  a: ['class', 'id', 'style', 'href', 'target', 'rel']
}

export const FOREIGN_STYLE_PROPS: Set<string> = new Set<string>([
  'color', 'text-align', 'font-size', 'font-weight',
  'font-style', 'text-decoration', 'list-style-type'
])

// Allowed href schemes for <a>. Relative / fragment hrefs (no scheme) are also allowed.
export const FOREIGN_HREF_SCHEMES: Set<string> = new Set<string>(['http:', 'https:'])

// add generic attributes to all elements of the whitelist
for (const [element, attrs] of Object.entries(svgWhiteList_)) {
  svgWhiteList_[element] = [...attrs, ...svgGenericWhiteList]
}

// Produce a Namespace-aware version of svgWhitelist
const svgWhiteListNS_: Record<string, Record<string, string | null>> = {}
for (const [elt, atts] of Object.entries(svgWhiteList_)) {
  const attNS: Record<string, string | null> = {}
  for (const att of atts) {
    if (att.includes(':')) {
      const colonIdx = att.indexOf(':')
      const prefix = att.slice(0, colonIdx).toUpperCase() as keyof typeof NS
      const localName = att.slice(colonIdx + 1)
      attNS[localName] = NS[prefix] ?? null
    } else {
      attNS[att] = att === 'xmlns' ? NS.XMLNS : null
    }
  }
  svgWhiteListNS_[elt] = attNS
}

/**
* Sanitizes the input node and its children.
* It only keeps what is allowed from our whitelist defined above.
* @function module:sanitize.sanitizeSvg
* @param node - The DOM element to be checked (we'll also check its children) or text node to be cleaned up
*/
export const sanitizeSvg = (node: Node): void => {
  // Cleanup text nodes
  if (node.nodeType === 3) { // 3 === TEXT_NODE
    const textNode = node as Text
    // Trim whitespace
    textNode.nodeValue = (textNode.nodeValue ?? '').trim()
    // Remove if empty
    if (!textNode.nodeValue.length) {
      textNode.remove()
    }
  }

  // We only care about element nodes.
  // Automatically return for all non-element nodes, such as comments, etc.
  if (node.nodeType !== 1) { // 1 == ELEMENT_NODE
    return
  }

  const elem = node as Element
  const doc = elem.ownerDocument
  const parent = elem.parentNode
  // can parent ever be null here?  I think the root node's parent is the document...
  if (!doc || !parent) {
    return
  }

  // HTML content inside a foreignObject takes a separate ruleset (the SVG path below
  // is left untouched). Detected by the XHTML namespace — also resolves the a/title/style
  // shared-tag-name ambiguity between SVG and HTML.
  if (elem.namespaceURI === NS.HTML) {
    sanitizeForeignHtml(elem)
    return
  }

  const allowedAttrs = svgWhiteList_[elem.nodeName]
  const allowedAttrsNS = svgWhiteListNS_[elem.nodeName]
  // if this element is supported, sanitize it
  if (typeof allowedAttrs !== 'undefined') {
    const seAttrs: [string, string, string | null][] = []
    let i = elem.attributes.length
    while (i--) {
      // if the attribute is not in our whitelist, then remove it
      const attr = elem.attributes.item(i)
      if (!attr) continue
      const attrName = attr.nodeName
      const attrLocalName = attr.localName
      const attrNsURI = attr.namespaceURI
      // Check that an attribute with the correct localName in the correct namespace is on
      // our whitelist or is a namespace declaration for one of our allowed namespaces.
      // Note: when attrLocalName is NOT a key, allowedAttrsNS[attrLocalName] is undefined
      // (NOT null) — this is load-bearing because the JS original relied on
      // undefined !== null to trigger removal for unknown attrs on no-namespace nodes.
      const expectedNs: string | null | undefined = allowedAttrsNS ? allowedAttrsNS[attrLocalName] : undefined
      if (attrNsURI !== expectedNs && attrNsURI !== NS.XMLNS &&
       !(attrNsURI === NS.XMLNS && REVERSE_NS[attr.value])) {
        // Special case: allow href attribute even without namespace if it's in the whitelist
        const isHrefAttribute = (attrLocalName === 'href' && allowedAttrs.includes('href'))
        if (!isHrefAttribute) {
          // Bypassing the whitelist to allow se: prefix and data- attributes
          // We can add specific namespaces on demand for now.
          // Is there a more appropriate way to do this?
          if ((attrName.startsWith('se:') || attrName.startsWith('data-')) &&
            SAFE_DATA_NAME.test(attrName) && attr.value.length <= MAX_DATA_ATTR_LEN) {
            // We should bypass the namespace as well
            const seAttrNS: string | null = attrName.startsWith('se:') ? NS.SE : null
            seAttrs.push([attrName, attr.value, seAttrNS])
          } else {
            warn(`attribute ${attrName} in element ${elem.nodeName} not in whitelist is removed: ${elem.outerHTML}`, null, 'sanitize')
            elem.removeAttributeNS(attrNsURI, attrLocalName)
          }
        }
      }

      // For the style attribute, rewrite it in terms of XML presentational attributes
      if (attrName === 'style') {
        const props = attr.value.split(';')
        let p = props.length
        while (p--) {
          const prop = props[p]
          if (!prop) continue
          const colonIdx = prop.indexOf(':')
          const name = colonIdx >= 0 ? prop.slice(0, colonIdx) : prop
          const val = colonIdx >= 0 ? prop.slice(colonIdx + 1) : ''
          const styleAttrName = (name || '').trim()
          const styleAttrVal = (val || '').trim()
          // Now check that this attribute is supported. Never promote a value
          // carrying a CSS fetch/script construct — the downstream non-local
          // reference scrub only covers a fixed set of paint properties (#42).
          if (allowedAttrs.includes(styleAttrName)) {
            if (UNSAFE_STYLE_VALUE.test(styleAttrVal)) {
              warn(`unsafe style value for ${styleAttrName} in element ${elem.nodeName} is dropped: ${styleAttrVal}`, null, 'sanitize')
            } else {
              elem.setAttribute(styleAttrName, styleAttrVal)
            }
          }
        }
        elem.removeAttribute('style')
      }
    }

    // If legacy xlink:href is present but href is missing, mirror it to href for modern browsers
    const xlinkHref = elem.getAttributeNS(NS.XLINK, 'href')
    if (xlinkHref) {
      elem.setAttribute('href', xlinkHref)
      elem.removeAttributeNS(NS.XLINK, 'href')
    }

    Object.values(seAttrs).forEach(([att, val, ns]) => {
      elem.setAttributeNS(ns, att, val)
    })

    // Scheme-harden hrefs on elements where the sanitizer otherwise permits a
    // non-local reference. SVG <a> must reject javascript:/data:/vbscript: (the
    // foreignObject anchor path is hardened separately); <image> may only load a
    // local (#), http(s), or data:image/* source (#1, #2, #39).
    if (elem.nodeName === 'a' || elem.nodeName === 'image') {
      const linkHref = getHref(elem)
      if (linkHref !== null && linkHref !== '') {
        const safe = elem.nodeName === 'a' ? isSafeForeignHref(linkHref) : isSafeImageHref(linkHref)
        if (!safe) {
          warn(`unsafe href scheme on <${elem.nodeName}> (${linkHref}) is removed: ${elem.outerHTML}`, null, 'sanitize')
          setHref(elem, '')
          elem.removeAttributeNS(NS.XLINK, 'href')
          elem.removeAttribute('href')
        }
      }
    }

    // for some elements that have a xlink:href or href, ensure the URI refers to a local element
    // (but not for links and other elements where external hrefs are allowed)
    const href = getHref(elem)
    if (href &&
      ['filter', 'linearGradient', 'pattern',
        'radialGradient', 'textPath', 'use'].includes(elem.nodeName) && href[0] !== '#') {
      // remove the attribute (but keep the element)
      setHref(elem, '')
      warn(`attribute href in element ${elem.nodeName} pointing to a non-local reference (${href}) is removed: ${elem.outerHTML}`, null, 'sanitize')
      elem.removeAttributeNS(NS.XLINK, 'href')
      elem.removeAttribute('href')
    }

    // Safari crashes on a <use> without a xlink:href, so we just remove the node here
    if (elem.nodeName === 'use' && !getHref(elem)) {
      warn(`element ${elem.nodeName} without a xlink:href or href is removed: ${elem.outerHTML}`, null, 'sanitize')
      elem.remove()
      return
    }
    // For <use> elements with missing width/height, derive defaults from referenced viewBox/size for proper sizing/selection
    if (elem.nodeName === 'use') {
      const ref = getRefElem(getHref(elem))
      if (ref) {
        const refViewBox = ref.getAttribute('viewBox')
        const viewBoxParts = refViewBox ? refViewBox.split(/[\s,]+/).map(Number) : null
        const refWidth = Number(ref.getAttribute('width'))
        const refHeight = Number(ref.getAttribute('height'))
        if (!elem.hasAttribute('width')) {
          const width = viewBoxParts?.[2] ?? refWidth
          if (width) elem.setAttribute('width', String(width))
        }
        if (!elem.hasAttribute('height')) {
          const height = viewBoxParts?.[3] ?? refHeight
          if (height) elem.setAttribute('height', String(height))
        }
      }
    }
    // if the element has attributes pointing to a non-local reference,
    // need to remove the attribute
    ;['clip-path', 'fill', 'filter', 'marker-end', 'marker-mid', 'marker-start', 'mask', 'stroke'].forEach((attr) => {
      let val = elem.getAttribute(attr)
      if (val) {
        val = getUrlFromAttr(val)
        // simply check for first character being a '#'
        if (val && val[0] !== '#') {
          elem.setAttribute(attr, '')
          warn(`attribute ${attr} in element ${elem.nodeName} pointing to a non-local reference (${val}) is removed: ${elem.outerHTML}`, null, 'sanitize')
          elem.removeAttribute(attr)
        }
      }
    })

    // <style> CSS text is otherwise never inspected; neutralize a body that can
    // exfiltrate or execute (@import / url() / expression() / javascript:),
    // preserving benign rules (#3).
    if (elem.nodeName === 'style') {
      const css = elem.textContent ?? ''
      if (UNSAFE_STYLE_VALUE.test(css) || /@import/i.test(css)) {
        warn(`unsafe CSS in <style> is removed: ${css}`, null, 'sanitize')
        elem.textContent = ''
      }
    }

    // recurse to children
    i = elem.childNodes.length
    while (i--) {
      const childNode = elem.childNodes.item(i)
      if (childNode) sanitizeSvg(childNode)
    }
  // else (element not supported), remove it
  } else {
    // remove all children from this node and insert them before this node
    // TODO: in the case of animation elements this will hardly ever be correct
    warn(`element ${elem.nodeName} not supported is removed: ${elem.outerHTML}`, null, 'sanitize')
    const children: Node[] = []
    while (elem.hasChildNodes()) {
      const firstChild = elem.firstChild
      if (firstChild) {
        children.push(parent.insertBefore(firstChild, elem))
      }
    }

    // remove this node from the document altogether
    elem.remove()

    // call sanitizeSvg on each of those children
    let i = children.length
    while (i--) {
      const child = children[i]
      if (child) sanitizeSvg(child)
    }
  }
}

/** Sanitize one HTML element living inside a foreignObject (XHTML namespace). */
const sanitizeForeignHtml = (elem: Element): void => {
  const parent = elem.parentNode
  const tag = elem.localName
  if (!parent) return

  // Unknown tag -> unwrap: promote children before this node, then remove it.
  if (!FOREIGN_HTML_TAGS.has(tag)) {
    const children: Node[] = []
    while (elem.firstChild) children.push(parent.insertBefore(elem.firstChild, elem))
    elem.remove()
    for (let i = children.length; i--;) {
      const c = children[i]
      if (c) sanitizeSvg(c)
    }
    return
  }

  sanitizeForeignAttrs(elem, tag)

  // recurse to children (snapshot first; sanitize may unwrap and mutate the live list)
  const kids = [...elem.childNodes]
  for (let i = kids.length; i--;) {
    const c = kids[i]
    if (c) sanitizeSvg(c)
  }
}

/**
 * Whether an `<a>` href is safe to keep on foreignObject HTML content.
 * Fragment / absolute-path / relative hrefs and scheme-less values pass; otherwise
 * only the {@link FOREIGN_HREF_SCHEMES} (http/https) are allowed — `javascript:`,
 * `data:`, etc. are rejected. Exported so the editor's pre-injection `serialize`
 * pass can mirror the sanitizer rather than duplicate the rule.
 */
export const isSafeForeignHref = (href: string): boolean => {
  const v = href.trim()
  if (v.startsWith('#') || v.startsWith('/') || v.startsWith('./') || v.startsWith('../')) return true
  const m = /^([a-z][a-z0-9+.-]*:)/i.exec(v)
  if (!m) return true // scheme-less relative
  return FOREIGN_HREF_SCHEMES.has((m[1] ?? '').toLowerCase())
}

/**
 * Whether an `<image>` href is safe to load. Allows a local fragment, an
 * http(s) URL, an inline `data:image/*` URI, or a scheme-less (same-origin)
 * relative path. Blocks `data:text/html`, `javascript:`, `file:` and other
 * non-http schemes that turn an opened/pasted SVG into an SSRF/exfil vector (#2).
 */
export const isSafeImageHref = (href: string): boolean => {
  const v = href.trim()
  if (v.startsWith('#')) return true
  if (/^https?:\/\//i.test(v)) return true
  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|bmp|avif|x-icon|vnd\.microsoft\.icon);/i.test(v)) return true
  // A scheme-less value (no "scheme:") is a same-origin relative reference — allow.
  return !/^[a-z][a-z0-9+.-]*:/i.test(v)
}

/**
 * Harden a foreignObject `<a>`: strip an unsafe href (per {@link isSafeForeignHref}),
 * and on any surviving href force `target="_blank" rel="noopener noreferrer"`
 * (else clear stray target/rel). Shared by the canvas sanitizer and the editor's
 * `serialize` pre-injection pass so both sides apply identical link policy.
 */
export const hardenForeignAnchor = (a: Element): void => {
  const href = a.getAttribute('href')
  if (href !== null && !isSafeForeignHref(href)) a.removeAttribute('href')
  if (a.hasAttribute('href')) {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  } else {
    a.removeAttribute('target')
    a.removeAttribute('rel')
  }
}

const filterForeignStyle = (value: string): string => {
  const kept: string[] = []
  for (const decl of value.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (!FOREIGN_STYLE_PROPS.has(prop)) continue
    if (/url\(|expression\(/i.test(val)) continue
    kept.push(`${prop}: ${val}`)
  }
  return kept.join('; ')
}

const sanitizeForeignAttrs = (elem: Element, tag: string): void => {
  const allowed: string[] = FOREIGN_HTML_ATTRS[tag] ?? FOREIGN_HTML_ATTRS['*'] ?? []
  for (let i = elem.attributes.length; i--;) {
    const attr = elem.attributes.item(i)
    if (!attr) continue
    const name = attr.name.toLowerCase()
    if (!allowed.includes(name)) { elem.removeAttribute(attr.name); continue }
    if (name === 'style') {
      const filtered = filterForeignStyle(attr.value)
      if (filtered) elem.setAttribute('style', filtered)
      else elem.removeAttribute('style')
    }
  }

  if (tag === 'a') hardenForeignAnchor(elem)
}
