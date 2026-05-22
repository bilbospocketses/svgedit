/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// svgCanvas is opaquely typed (typed in Task 10 C6); file-level disable matches utilities.ts pattern
/**
 * Tools for clear.
 * @module clear
 * @license MIT
 * @copyright 2011 Jeff Schiller
 */
import { NS } from './namespaces.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any = null

/**
* @function module:clear.init
* @param canvas
*/
export const init = (canvas: unknown): void => {
  svgCanvas = canvas
}

export const clearSvgContentElementInit = (): void => {
  const curConfig = svgCanvas.getCurConfig()
  const { dimensions } = curConfig
  const el = svgCanvas.getSvgContent()
  // empty
  while (el.firstChild) { el.removeChild(el.firstChild) }

  // Reset any stale attributes from the previous document.
  const attrs: Attr[] = Array.from(el.attributes as NamedNodeMap)
  for (const attr of attrs) {
    if (attr.namespaceURI) {
      el.removeAttributeNS(attr.namespaceURI, attr.localName)
    } else {
      el.removeAttribute(attr.name)
    }
  }

  const pel = svgCanvas.getSvgRoot()
  el.setAttribute('id', 'svgcontent')
  el.setAttribute('width', dimensions[0])
  el.setAttribute('height', dimensions[1])
  el.setAttribute('x', dimensions[0])
  el.setAttribute('y', dimensions[1])
  el.setAttribute('overflow', curConfig.show_outside_canvas ? 'visible' : 'hidden')
  el.setAttribute('xmlns', NS.SVG)
  el.setAttribute('xmlns:se', NS.SE)
  el.setAttribute('xmlns:xlink', NS.XLINK)
  if (el.parentNode !== pel) {
    pel.appendChild(el)
  }

  // TODO: make this string optional and set by the client
  const comment = svgCanvas.getDOMDocument().createComment(' Created with svgedit - https://github.com/bilbospocketses/svgedit')
  el.append(comment)
}
