/**
 * Tools for SVG Root Element.
 * @module svgcanvas
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria, 2010 Jeff Schiller
 */
import { NS } from './namespaces.js'

/**
* @function module:svgcanvas.svgRootElement Build the canvas SVG root element + canvas-shadow defs.
* @param svgdoc - the owner document the element will belong to
* @param dimensions - [width, height] of the root SVG
*/
export const svgRootElement = (svgdoc: Document, dimensions: [number, number]): SVGSVGElement => {
  const w = String(dimensions[0])
  const h = String(dimensions[1])

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- double-cast required: createElementNS returns Element; need SVGSVGElement for downstream typed access
  const root = svgdoc.createElementNS(NS.SVG, 'svg') as unknown as SVGSVGElement
  root.setAttribute('id', 'svgroot')
  root.setAttribute('xlinkns', NS.XLINK)
  root.setAttribute('width', w)
  root.setAttribute('height', h)
  root.setAttribute('x', w)
  root.setAttribute('y', h)
  root.setAttribute('overflow', 'visible')

  const defs = svgdoc.createElementNS(NS.SVG, 'defs')
  const filter = svgdoc.createElementNS(NS.SVG, 'filter')
  filter.setAttribute('id', 'canvashadow')
  filter.setAttribute('filterUnits', 'objectBoundingBox')

  const blur = svgdoc.createElementNS(NS.SVG, 'feGaussianBlur')
  blur.setAttribute('in', 'SourceAlpha')
  blur.setAttribute('stdDeviation', '4')
  blur.setAttribute('result', 'blur')
  filter.appendChild(blur)

  const offset = svgdoc.createElementNS(NS.SVG, 'feOffset')
  offset.setAttribute('in', 'blur')
  offset.setAttribute('dx', '5')
  offset.setAttribute('dy', '5')
  offset.setAttribute('result', 'offsetBlur')
  filter.appendChild(offset)

  const merge = svgdoc.createElementNS(NS.SVG, 'feMerge')
  const mn1 = svgdoc.createElementNS(NS.SVG, 'feMergeNode')
  mn1.setAttribute('in', 'offsetBlur')
  const mn2 = svgdoc.createElementNS(NS.SVG, 'feMergeNode')
  mn2.setAttribute('in', 'SourceGraphic')
  merge.appendChild(mn1)
  merge.appendChild(mn2)
  filter.appendChild(merge)

  defs.appendChild(filter)
  root.appendChild(defs)

  return root
}
