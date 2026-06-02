/**
 * Provides tools for the layer concept.
 * @module layer
 * @license MIT
 *
 */

import { NS } from './namespaces.js'
import { toXml, walkTree } from './utilities.js'
import type HistoryRecordingService from './historyrecording.js'

/**
 * This class encapsulates the concept of a layer in the drawing. It can be constructed with
 * an existing group element or, with three parameters, will create a new layer group element.
 *
 * @example
 * const l1 = new Layer('name', group); // Use the existing group for this layer.
 * const l2 = new Layer('name', group, svgElem); // Create a new group and add it to the DOM after group.
 * const l3 = new Layer('name', null, svgElem); // Create a new group and add it to the DOM as the last layer.
 * @memberof module:layer
 */
class Layer {
  #name: string
  #group: SVGGElement

  /** @property {string} CLASS_NAME - class attribute assigned to all layer groups. */
  static CLASS_NAME: string = 'layer'

  /** @property {RegExp} CLASS_REGEX - Used to test presence of class Layer.CLASS_NAME */
  static CLASS_REGEX: RegExp = new RegExp(`(\\s|^)${Layer.CLASS_NAME}(\\s|$)`)

  /**
  * @param group - An existing SVG group element or null.
  *     If group and no svgElem, use group for this layer.
  *     If group and svgElem, create a new group element and insert it in the DOM after group.
  *     If no group and svgElem, create a new group element and insert it in the DOM as the last layer.
  * @param [svgElem] - The SVG DOM element. If defined, use this to add
  *     a new layer to the document.
  */
  constructor (name: string, group: SVGGElement | null, svgElem?: SVGSVGElement) {
    this.#name = name
    this.#group = svgElem ? null as unknown as SVGGElement : (group as SVGGElement)

    if (svgElem) {
      // Create a group element with title and add it to the DOM.
      const svgdoc = svgElem.ownerDocument
      this.#group = svgdoc.createElementNS(NS.SVG, 'g')
      const layerTitle = svgdoc.createElementNS(NS.SVG, 'title')
      layerTitle.textContent = name
      this.#group.append(layerTitle)

      if (group) {
        group.insertAdjacentElement('afterend', this.#group)
      } else {
        svgElem.append(this.#group)
      }
    }

    addLayerClass(this.#group)
    walkTree(this.#group, function (e: Element) {
      (e as HTMLElement).style.pointerEvents = 'inherit'
    })

    this.#group.style.pointerEvents = svgElem ? 'all' : 'none'
  }

  /**
   * Get the layer's name.
   */
  getName (): string {
    return this.#name
  }

  /**
   * Get the group element for this layer.
   */
  getGroup (): SVGGElement {
    return this.#group
  }

  /**
   * Active this layer so it takes pointer events.
   */
  activate (): void {
    this.#group.style.pointerEvents = 'all'
  }

  /**
   * Deactive this layer so it does NOT take pointer events.
   */
  deactivate (): void {
    this.#group.style.pointerEvents = 'none'
  }

  /**
   * Set this layer visible or hidden based on 'visible' parameter.
   * @param visible - If true, make visible; otherwise, hide it.
   */
  setVisible (visible?: boolean): void {
    const expected = (visible === undefined || visible) ? 'inline' : 'none'
    const oldDisplay = this.#group.getAttribute('display')
    if (oldDisplay !== expected) {
      this.#group.setAttribute('display', expected)
    }
  }

  /**
   * Is this layer visible?
   */
  isVisible (): boolean {
    return this.#group.getAttribute('display') !== 'none'
  }

  /**
   * Get layer opacity.
   */
  getOpacity (): number {
    const opacity = this.#group.getAttribute('opacity')
    return opacity ? Number.parseFloat(opacity) : 1
  }

  /**
   * Sets the opacity of this layer. If opacity is not a value between 0.0 and 1.0,
   * nothing happens.
   * @param opacity - A float value in the range 0.0-1.0
   */
  setOpacity (opacity: number): void {
    if (typeof opacity === 'number' && opacity >= 0.0 && opacity <= 1.0) {
      this.#group.setAttribute('opacity', String(opacity))
    }
  }

  /**
   * Append children to this layer.
   */
  appendChildren (children: Element[]): void {
    for (const child of children) {
      this.#group.append(child)
    }
  }

  /** Return the first `<title>` child element of this layer group, or null if absent. */
  getTitleElement (): SVGTitleElement | null {
    const len = this.#group.childNodes.length
    for (let i = 0; i < len; ++i) {
      const child = this.#group.childNodes.item(i)
      if ((child as Element)?.tagName === 'title') {
        return child as SVGTitleElement
      }
    }
    return null
  }

  /**
   * Set the name of this layer.
   * @returns The new name if changed; otherwise, null.
   */
  setName (name: string, hrService?: HistoryRecordingService): string | null {
    const previousName = this.#name
    name = toXml(name)
    // now change the underlying title element contents
    const title = this.getTitleElement()
    if (title) {
      while (title.firstChild) { title.removeChild(title.firstChild) }
      title.textContent = name
      this.#name = name
      if (hrService) {
        hrService.changeElement(title, { '#text': previousName })
      }
      return this.#name
    }
    return null
  }

  /**
   * Remove this layer's group from the DOM. No more functions on group can be called after this.
   * @returns The layer SVG group that was just removed.
   */
  removeGroup (): SVGGElement {
    const group = this.#group
    this.#group.remove()
    this.#group = undefined as unknown as SVGGElement
    return group
  }

  /**
   * Test whether an element is a layer or not.
   */
  static isLayer (elem: SVGGElement | null | undefined): boolean {
    return !!(elem && elem.tagName === 'g' && Layer.CLASS_REGEX.test(elem.getAttribute('class') ?? ''))
  }
}

/**
 * Add class `Layer.CLASS_NAME` to the element (usually `class='layer'`).
 */
const addLayerClass = (elem: SVGGElement): void => {
  const classes = elem.getAttribute('class')
  if (!classes || !classes.length) {
    elem.setAttribute('class', Layer.CLASS_NAME)
  } else if (!Layer.CLASS_REGEX.test(classes)) {
    elem.setAttribute('class', `${classes} ${Layer.CLASS_NAME}`)
  }
}

export default Layer
