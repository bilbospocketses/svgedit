/**
 * Provides tools for the layer concept.
 * @module layer
 * @license MIT
 *
 * @copyright 2011 Jeff Schiller, 2016 Flint O'Brien
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
  name_: string
  group_: SVGGElement

  /** @property {string} CLASS_NAME - class attribute assigned to all layer groups. */
  static CLASS_NAME: string = 'layer'

  /** @property {RegExp} CLASS_REGEX - Used to test presence of class Layer.CLASS_NAME */
  static CLASS_REGEX: RegExp = new RegExp(`(\\s|^)${Layer.CLASS_NAME}(\\s|$)`)

  /**
  * @param {string} name - Layer name
  * @param {SVGGElement | null} group - An existing SVG group element or null.
  *     If group and no svgElem, use group for this layer.
  *     If group and svgElem, create a new group element and insert it in the DOM after group.
  *     If no group and svgElem, create a new group element and insert it in the DOM as the last layer.
  * @param {SVGSVGElement} [svgElem] - The SVG DOM element. If defined, use this to add
  *     a new layer to the document.
  */
  constructor (name: string, group: SVGGElement | null, svgElem?: SVGSVGElement) {
    this.name_ = name
    this.group_ = svgElem ? null as unknown as SVGGElement : (group as SVGGElement)

    if (svgElem) {
      // Create a group element with title and add it to the DOM.
      const svgdoc = svgElem.ownerDocument
      this.group_ = svgdoc.createElementNS(NS.SVG, 'g')
      const layerTitle = svgdoc.createElementNS(NS.SVG, 'title')
      layerTitle.textContent = name
      this.group_.append(layerTitle)

      if (group) {
        group.insertAdjacentElement('afterend', this.group_)
      } else {
        svgElem.append(this.group_)
      }
    }

    addLayerClass(this.group_)
    walkTree(this.group_, function (e: Element) {
      (e as HTMLElement).style.pointerEvents = 'inherit'
    })

    this.group_.style.pointerEvents = svgElem ? 'all' : 'none'
  }

  /**
   * Get the layer's name.
   * @returns {string} The layer name
   */
  getName (): string {
    return this.name_
  }

  /**
   * Get the group element for this layer.
   * @returns {SVGGElement} The layer SVG group
   */
  getGroup (): SVGGElement {
    return this.group_
  }

  /**
   * Active this layer so it takes pointer events.
   * @returns {void}
   */
  activate (): void {
    this.group_.style.pointerEvents = 'all'
  }

  /**
   * Deactive this layer so it does NOT take pointer events.
   * @returns {void}
   */
  deactivate (): void {
    this.group_.style.pointerEvents = 'none'
  }

  /**
   * Set this layer visible or hidden based on 'visible' parameter.
   * @param {boolean} visible - If true, make visible; otherwise, hide it.
   * @returns {void}
   */
  setVisible (visible?: boolean): void {
    const expected = (visible === undefined || visible) ? 'inline' : 'none'
    const oldDisplay = this.group_.getAttribute('display')
    if (oldDisplay !== expected) {
      this.group_.setAttribute('display', expected)
    }
  }

  /**
   * Is this layer visible?
   * @returns {boolean} True if visible.
   */
  isVisible (): boolean {
    return this.group_.getAttribute('display') !== 'none'
  }

  /**
   * Get layer opacity.
   * @returns {number} Opacity value.
   */
  getOpacity (): number {
    const opacity = this.group_.getAttribute('opacity')
    return opacity ? Number.parseFloat(opacity) : 1
  }

  /**
   * Sets the opacity of this layer. If opacity is not a value between 0.0 and 1.0,
   * nothing happens.
   * @param {number} opacity - A float value in the range 0.0-1.0
   * @returns {void}
   */
  setOpacity (opacity: number): void {
    if (typeof opacity === 'number' && opacity >= 0.0 && opacity <= 1.0) {
      this.group_.setAttribute('opacity', String(opacity))
    }
  }

  /**
   * Append children to this layer.
   * @param {Element[]} children - The children to append to this layer.
   * @returns {void}
   */
  appendChildren (children: Element[]): void {
    for (const child of children) {
      this.group_.append(child)
    }
  }

  /**
  * @returns {SVGTitleElement | null}
  */
  getTitleElement (): SVGTitleElement | null {
    const len = this.group_.childNodes.length
    for (let i = 0; i < len; ++i) {
      const child = this.group_.childNodes.item(i)
      if ((child as Element)?.tagName === 'title') {
        return child as SVGTitleElement
      }
    }
    return null
  }

  /**
   * Set the name of this layer.
   * @param {string} name - The new name.
   * @param {HistoryRecordingService} [hrService] - History recording service
   * @returns {string | null} The new name if changed; otherwise, null.
   */
  setName (name: string, hrService?: HistoryRecordingService): string | null {
    const previousName = this.name_
    name = toXml(name)
    // now change the underlying title element contents
    const title = this.getTitleElement()
    if (title) {
      while (title.firstChild) { title.removeChild(title.firstChild) }
      title.textContent = name
      this.name_ = name
      if (hrService) {
        hrService.changeElement(title, { '#text': previousName })
      }
      return this.name_
    }
    return null
  }

  /**
   * Remove this layer's group from the DOM. No more functions on group can be called after this.
   * @returns {SVGGElement} The layer SVG group that was just removed.
   */
  removeGroup (): SVGGElement {
    const group = this.group_
    this.group_.remove()
    this.group_ = undefined as unknown as SVGGElement
    return group
  }

  /**
   * Test whether an element is a layer or not.
   * @param {SVGGElement | null | undefined} elem - The SVGGElement to test.
   * @returns {boolean} True if the element is a layer
   */
  static isLayer (elem: SVGGElement | null | undefined): boolean {
    return !!(elem && elem.tagName === 'g' && Layer.CLASS_REGEX.test(elem.getAttribute('class') ?? ''))
  }
}

/**
 * Add class `Layer.CLASS_NAME` to the element (usually `class='layer'`).
 *
 * @param {SVGGElement} elem - The SVG element to update
 * @returns {void}
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
