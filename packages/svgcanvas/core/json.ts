/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
/**
 * Tools for SVG handle on JSON format.
 * @module svgcanvas
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria, 2010 Jeff Schiller
 */
import { getElement, assignAttributes, cleanupElement, type SVGElementJSON } from './utilities.js'
import { NS } from './namespaces.js'

/** Minimal canvas context shape for json.ts init(). */
interface JsonCanvasContext {
  getDOMDocument?(): Document
  getSvgRoot?(): SVGSVGElement
  getDrawing?(): { getCurrentLayer?(): Element | null } | null
  getCurrentGroup?(): Element | null
  getCurShape?(): Record<string, unknown>
  addSVGElementsFromJson?(data: SVGElementJSON): Element
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any = null
let svgdoc_: Document | null = null

/** Initializes this module with the canvas context. */
export const init = (canvas: JsonCanvasContext): void => {
  svgCanvas = canvas
  svgdoc_ = canvas.getDOMDocument?.() ?? (typeof document !== 'undefined' ? document : null)
}

/** Result type from getJsonFromSvgElements: a node representation or string nodeValue or null. */
export interface JsonElementResult {
  element: string
  attr: Record<string, string>
  children: Array<JsonElementResult | string | null>
}

/** Iterate element and return json format. */
export const getJsonFromSvgElements = (data: Node | null | undefined): JsonElementResult | string | null => {
  if (!data) return null

  // Text node
  if (data.nodeType === 3 || data.nodeType === 4) return (data as Text | CDATASection).nodeValue
  // Ignore non-element nodes (e.g., comments)
  if (data.nodeType !== 1) return null

  const elem = data as Element
  const retval: JsonElementResult = {
    element: elem.tagName,
    attr: {},
    children: []
  }

  // Iterate attributes
  const attributes = elem.attributes
  if (attributes) {
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i]
      if (!attr) continue
      retval.attr[attr.name] = attr.value
    }
  }

  // Iterate children
  const childNodes = elem.childNodes
  if (childNodes) {
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i]
      const child = getJsonFromSvgElements(node)
      if (child !== null && child !== undefined) {
        retval.children.push(child)
      }
    }
  }

  return retval
}

/** Create/update DOM elements from a JSON representation. */
export const addSVGElementsFromJson = (data: SVGElementJSON | string | null | undefined): Element | Text | null => {
  if (!svgdoc_) { return null }
  if (data === null || data === undefined) return svgdoc_.createTextNode('')
  if (typeof data === 'string') return svgdoc_.createTextNode(data)

  const attrs = data.attr || {}
  const id = attrs.id
  let shape: Element | null = null
  if (typeof id === 'string' && id) {
    try {
      shape = getElement(id)
    } catch {
      // Ignore (CSS selector may be invalid); fallback to getElementById below
    }
    if (!shape) {
      const byId = (svgdoc_ as Document & { getElementById?(id: string): Element | null }).getElementById?.(id)
      const svgRoot = svgCanvas?.getSvgRoot?.()
      if (byId && (!svgRoot || svgRoot.contains(byId))) {
        shape = byId
      }
    }
  }
  // if shape is a path but we need to create a rect/ellipse, then remove the path
  const currentLayer = svgCanvas?.getDrawing?.()?.getCurrentLayer?.()
  if (shape && data.element !== shape.tagName) {
    shape.remove()
    shape = null
  }
  if (!shape) {
    const ns = data.namespace || NS.SVG
    shape = svgdoc_.createElementNS(ns, data.element)
    if (currentLayer) {
      (svgCanvas.getCurrentGroup?.() || currentLayer).append(shape)
    }
  }
  const curShape: Record<string, unknown> = svgCanvas.getCurShape?.() || {}
  // shape is guaranteed non-null here: either found by ID or created above
  if (!shape) return null
  const definedShape: Element = shape
  if (data.curStyles) {
    const curOpacity = Number(curShape['opacity'])
    const opacity = Number.isFinite(curOpacity) ? (curOpacity / 2) : 0.5
    assignAttributes(definedShape, {
      fill: curShape['fill'] as string,
      stroke: curShape['stroke'] as string,
      'stroke-width': curShape['stroke_width'] as string,
      'stroke-dasharray': curShape['stroke_dasharray'] as string,
      'stroke-linejoin': curShape['stroke_linejoin'] as string,
      'stroke-linecap': curShape['stroke_linecap'] as string,
      'stroke-opacity': curShape['stroke_opacity'] as string,
      'fill-opacity': curShape['fill_opacity'] as string,
      opacity,
      style: 'pointer-events:inherit'
    }, 100)
  }
  assignAttributes(definedShape, attrs, 100)
  cleanupElement(definedShape)

  // Children
  if (data.children) {
    while (definedShape.firstChild) {
      definedShape.firstChild.remove()
    }
    data.children.forEach((child) => {
      const childNode = addSVGElementsFromJson(child)
      if (childNode) {
        definedShape.append(childNode)
      }
    })
  }

  return shape
}
