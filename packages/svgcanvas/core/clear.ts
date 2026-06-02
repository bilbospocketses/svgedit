/**
 * Tools for clear.
 * @module clear
 * @license MIT
 */
import { NS } from './namespaces.js'

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/**
* @function module:clear.init
*/
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
}

/** Reset the SVG content element to initial state, clearing all children and resetting attributes */
export const clearSvgContentElementInit = (): void => {
  const curConfig = svgCanvas.getCurConfig()
  const dimensions = curConfig.dimensions as [string, string]
  const el = svgCanvas.getSvgContent()
  // empty
  while (el.firstChild) { el.removeChild(el.firstChild) }

  // Reset any stale attributes from the previous document.
  const attrs: Attr[] = Array.from(el.attributes)
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
