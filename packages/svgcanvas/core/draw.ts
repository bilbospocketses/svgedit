/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
// svgCanvas is opaquely typed (typed in Task 10 C6); file-level disable matches utilities.ts pattern
/**
 * Tools for drawing.
 * @module draw
 * @license MIT
 * @copyright 2011 Jeff Schiller
 */

import Layer from './layer.js'
import HistoryRecordingService from './historyrecording.js'

import { NS } from './namespaces.js'
import { toXml, getElement } from './utilities.js'
import { copyElem as utilCopyElem } from './copy-elem.js'
import { getParentsUntil } from '../common/util.js'
import { warn } from '../common/logger.js'

const visElems: string[] =
  'a,circle,ellipse,foreignObject,g,image,line,path,polygon,polyline,rect,svg,text,tspan,use'.split(
    ','
  )

const RandomizeModes = {
  LET_DOCUMENT_DECIDE: 0,
  ALWAYS_RANDOMIZE: 1,
  NEVER_RANDOMIZE: 2
} as const
let randIds: number = RandomizeModes.LET_DOCUMENT_DECIDE
// Array with current disabled elements (for in-group editing)
let disabledElems: Element[] = []

/**
 * Get a HistoryRecordingService.
 * @param {HistoryRecordingService} [hrService] - if exists, return it instead of creating a new service.
 * @returns {HistoryRecordingService}
 */
const historyRecordingService = (hrService?: HistoryRecordingService): HistoryRecordingService => {
  return hrService || new HistoryRecordingService(svgCanvas.undoMgr)
}

/**
 * Find the layer name in a group element.
 * @param {Element} group The group element to search in.
 * @returns {string} The layer name or empty string.
 */
const findLayerNameInGroup = (group: Element): string => {
  const sel = group.querySelector('title')
  return sel ? (sel.textContent ?? '') : ''
}

/**
 * Checks if the given element's classList contains 'layer'.
 *
 * @param {Element} element - The given element
 * @returns {boolean} True if the classList contains 'layer', false otherwise
 */
const isLayerElement = (element: Element): boolean => {
  return element.classList.contains('layer')
}

/**
 * Given a set of names, return a new unique name.
 * @param {string[]} existingLayerNames - Existing layer names.
 * @returns {string} - The new name.
 */
const getNewLayerName = (existingLayerNames: string[]): string => {
  let i = 1
  while (existingLayerNames.includes(`Layer ${i}`)) {
    i++
  }
  return `Layer ${i}`
}

/**
 * This class encapsulates the concept of a SVG-edit drawing.
 */
export class Drawing {
  svgElem_: SVGSVGElement
  obj_num: number
  idPrefix: string
  releasedNums: number[]
  all_layers: Layer[]
  layer_map: Record<string, Layer>
  current_layer: Layer | null
  nonce_: string | number

  /**
   * @param {SVGSVGElement} svgElem - The SVG DOM Element that this JS object
   *     encapsulates.  If the svgElem has a se:nonce attribute on it, then
   *     IDs will use the nonce as they are generated.
   * @param {string} [optIdPrefix=svg_] - The ID prefix to use.
   * @throws {Error} If not initialized with an SVG element
   */
  constructor (svgElem: SVGSVGElement, optIdPrefix?: string) {
    if (
      !svgElem ||
      !svgElem.tagName ||
      !svgElem.namespaceURI ||
      svgElem.tagName !== 'svg' ||
      svgElem.namespaceURI !== NS.SVG
    ) {
      throw new Error(
        'Error: svgedit.draw.Drawing instance initialized without a <svg> element'
      )
    }

    /**
     * The SVG DOM Element that represents this drawing.
     */
    this.svgElem_ = svgElem

    /**
     * The latest object number used in this drawing.
     */
    this.obj_num = 0

    /**
     * The prefix to prepend to each element id in the drawing.
     */
    this.idPrefix = optIdPrefix || 'svg_'

    /**
     * An array of released element ids to immediately reuse.
     */
    this.releasedNums = []

    /**
     * The z-ordered array of Layer objects. Each layer has a name
     * and group element.
     * The first layer is the one at the bottom of the rendering.
     */
    this.all_layers = []

    /**
     * Map of all_layers by name.
     *
     * Note: Layers are ordered, but referenced externally by name; so, we need both container
     * types depending on which function is called (i.e. all_layers and layer_map).
     */
    this.layer_map = {}

    /**
     * The current layer being used.
     */
    this.current_layer = null

    /**
     * The nonce to use to uniquely identify elements across drawings.
     */
    this.nonce_ = ''
    const n = this.svgElem_.getAttributeNS(NS.SE, 'nonce')
    // If already set in the DOM, use the nonce throughout the document
    // else, if randomizeIds(true) has been called, create and set the nonce.
    if (n && randIds !== RandomizeModes.NEVER_RANDOMIZE) {
      this.nonce_ = n
    } else if (randIds === RandomizeModes.ALWAYS_RANDOMIZE) {
      this.setNonce(Math.floor(Math.random() * 100001))
    }
  }

  /**
   * @param {string} id Element ID to retrieve
   * @returns {Element | null} SVG element within the root SVGSVGElement
   */
  getElem_ (id: string): Element | null {
    if (this.svgElem_.querySelector) {
      // querySelector lookup
      return this.svgElem_.querySelector(`#${id}`)
    }
    // jQuery lookup: twice as slow as xpath in FF
    return this.svgElem_.querySelector(`[id=${id}]`)
  }

  /**
   * @returns {SVGSVGElement}
   */
  getSvgElem (): SVGSVGElement {
    return this.svgElem_
  }

  /**
   * @returns {string | number} The previously set nonce
   */
  getNonce (): string | number {
    return this.nonce_
  }

  /**
   * @param {string | number} n The nonce to set
   * @returns {void}
   */
  setNonce (n: string | number): void {
    this.svgElem_.setAttributeNS(NS.XMLNS, 'xmlns:se', NS.SE)
    this.svgElem_.setAttributeNS(NS.SE, 'se:nonce', String(n))
    this.nonce_ = n
  }

  /**
   * Clears any previously set nonce.
   * @returns {void}
   */
  clearNonce (): void {
    // We deliberately leave any se:nonce attributes alone,
    // we just don't use it to randomize ids.
    this.nonce_ = ''
  }

  /**
   * Returns the latest object id as a string.
   * @returns {string} The latest object Id.
   */
  getId (): string {
    return this.nonce_
      ? `${this.idPrefix}${this.nonce_}_${this.obj_num}`
      : this.idPrefix + this.obj_num
  }

  /**
   * Returns the next object Id as a string.
   * @returns {string} The next object Id to use.
   */
  getNextId (): string {
    const oldObjNum = this.obj_num
    let restoreOldObjNum = false

    // If there are any released numbers in the release stack,
    // use the last one instead of the next obj_num.
    // We need to temporarily use obj_num as that is what getId() depends on.
    if (this.releasedNums.length > 0) {
      const popped = this.releasedNums.pop()
      if (popped !== undefined) {
        this.obj_num = popped
      }
      restoreOldObjNum = true
    } else {
      // If we are not using a released id, then increment the obj_num.
      this.obj_num++
    }

    // Ensure the ID does not exist.
    let id = this.getId()
    while (this.getElem_(id)) {
      if (restoreOldObjNum) {
        this.obj_num = oldObjNum
        restoreOldObjNum = false
      }
      this.obj_num++
      id = this.getId()
    }
    // Restore the old object number if required.
    if (restoreOldObjNum) {
      this.obj_num = oldObjNum
    }
    return id
  }

  /**
   * Releases the object Id, letting it be used as the next id in getNextId().
   * This method DOES NOT remove any elements from the DOM, it is expected
   * that client code will do this.
   * @param {string} id - The id to release.
   * @returns {boolean} True if the id was valid to be released, false otherwise.
   */
  releaseId (id: string): boolean {
    // confirm if this is a valid id for this Document, else return false
    const front = `${this.idPrefix}${this.nonce_ ? `${this.nonce_}_` : ''}`
    if (typeof id !== 'string' || !id.startsWith(front)) {
      return false
    }
    // extract the obj_num of this id
    const suffix = id.slice(front.length)
    if (!/^[0-9]+$/.test(suffix)) {
      return false
    }
    const num = Number.parseInt(suffix)

    // if we didn't get a positive number or we already released this number
    // then return false.
    if (
      typeof num !== 'number' ||
      num <= 0 ||
      this.releasedNums.includes(num)
    ) {
      return false
    }

    // push the released number into the released queue
    this.releasedNums.push(num)

    return true
  }

  /**
   * Returns the number of layers in the current drawing.
   * @returns {number} The number of layers in the current drawing.
   */
  getNumLayers (): number {
    return this.all_layers.length
  }

  /**
   * Check if layer with given name already exists.
   * @param {string} name - The layer name to check
   * @returns {boolean}
   */
  hasLayer (name: string): boolean {
    return this.layer_map[name] !== undefined
  }

  /**
   * Returns the name of the ith layer. If the index is out of range, an empty string is returned.
   * @param {number} i - The zero-based index of the layer you are querying.
   * @returns {string} The name of the ith layer (or the empty string if none found)
   */
  getLayerName (i: number): string {
    return i >= 0 && i < this.getNumLayers() ? (this.all_layers[i]?.getName() ?? '') : ''
  }

  /**
   * @returns {SVGGElement | null} The SVGGElement representing the current layer.
   */
  getCurrentLayer (): SVGGElement | null {
    return this.current_layer ? this.current_layer.getGroup() : null
  }

  /**
   * Get a layer by name.
   * @param {string} name
   * @returns {SVGGElement | null} The SVGGElement representing the named layer or null.
   */
  getLayerByName (name: string): SVGGElement | null {
    const layer = this.layer_map[name]
    return layer ? layer.getGroup() : null
  }

  /**
   * Returns the name of the currently selected layer. If an error occurs, an empty string
   * is returned.
   * @returns {string} The name of the currently active layer (or the empty string if none found).
   */
  getCurrentLayerName (): string {
    return this.current_layer ? this.current_layer.getName() : ''
  }

  /**
   * Set the current layer's name.
   * @param {string} name - The new name.
   * @param {HistoryRecordingService} hrService - History recording service
   * @returns {string | null} The new name if changed; otherwise, null.
   */
  setCurrentLayerName (name: string, hrService: HistoryRecordingService): string | null {
    let finalName: string | null = null
    if (this.current_layer) {
      const oldName = this.current_layer.getName()
      finalName = this.current_layer.setName(name, hrService)
      if (finalName) {
        delete this.layer_map[oldName]
        this.layer_map[finalName] = this.current_layer
      }
    }
    return finalName
  }

  /**
   * Set the current layer's position.
   * @param {number} newpos - The zero-based index of the new position of the layer. Range should be 0 to layers-1
   * @returns {{currentGroup: SVGGElement, oldNextSibling: Node | null} | null} If the name was changed, returns details; otherwise null.
   */
  setCurrentLayerPosition (newpos: number): { currentGroup: SVGGElement; oldNextSibling: Node | null } | null {
    const layerCount = this.getNumLayers()
    if (!this.current_layer || newpos < 0 || newpos >= layerCount) {
      return null
    }

    const oldpos = this.indexCurrentLayer()
    if (oldpos === -1 || oldpos === newpos) {
      return null
    }

    // if our new position is below us, we need to insert before the node after newpos
    const currentGroup = this.current_layer.getGroup()
    const oldNextSibling = currentGroup.nextSibling

    let refGroup: SVGGElement | null = null
    if (newpos > oldpos) {
      if (newpos < layerCount - 1) {
        refGroup = this.all_layers[newpos + 1]?.getGroup() ?? null
      }
      // if our new position is above us, we need to insert before the node at newpos
    } else {
      refGroup = this.all_layers[newpos]?.getGroup() ?? null
    }
    this.svgElem_.insertBefore(currentGroup, refGroup) // Ok to replace with `refGroup.before(currentGroup);`?

    this.identifyLayers()
    this.setCurrentLayer(this.getLayerName(newpos))

    return {
      currentGroup,
      oldNextSibling
    }
  }

  /**
   * @param {HistoryRecordingService} hrService
   * @returns {void}
   */
  mergeLayer (hrService: HistoryRecordingService): void {
    if (!this.current_layer) return
    const currentGroup = this.current_layer.getGroup()
    const prevGroup = currentGroup.previousElementSibling
    if (!prevGroup) {
      return
    }

    hrService.startBatchCommand('Merge Layer')

    const layerNextSibling = currentGroup.nextSibling
    hrService.removeElement(currentGroup, layerNextSibling, this.svgElem_)

    while (currentGroup.firstChild) {
      const child = currentGroup.firstChild
      if ((child as Element).localName === 'title') {
        hrService.removeElement(child as Element, child.nextSibling, currentGroup)
        ;(child as Element).remove()
        continue
      }
      const oldNextSibling = child.nextSibling
      prevGroup.append(child)
      hrService.moveElement(child as Element, oldNextSibling, currentGroup)
    }

    // Remove current layer's group
    this.current_layer.removeGroup()
    // Remove the current layer and set the previous layer as the new current layer
    const index = this.indexCurrentLayer()
    if (index > 0) {
      const name = this.current_layer.getName()
      this.current_layer = this.all_layers[index - 1] ?? null
      this.all_layers.splice(index, 1)
      delete this.layer_map[name]
    }

    hrService.endBatchCommand()
  }

  /**
   * @param {HistoryRecordingService} hrService
   * @returns {void}
   */
  mergeAllLayers (hrService: HistoryRecordingService): void {
    // Set the current layer to the last layer.
    this.current_layer = this.all_layers[this.all_layers.length - 1] ?? null

    hrService.startBatchCommand('Merge all Layers')
    while (this.all_layers.length > 1) {
      this.mergeLayer(hrService)
    }
    hrService.endBatchCommand()
  }

  /**
   * Sets the current layer. If the name is not a valid layer name, then this
   * function returns `false`. Otherwise it returns `true`. This is not an
   * undo-able action.
   * @param {string} name - The name of the layer you want to switch to.
   * @returns {boolean} `true` if the current layer was switched, otherwise `false`
   */
  setCurrentLayer (name: string): boolean {
    const layer = this.layer_map[name]
    if (layer) {
      if (this.current_layer) {
        this.current_layer.deactivate()
      }
      this.current_layer = layer
      this.current_layer.activate()
      return true
    }
    return false
  }

  /**
   * Returns the index of the current layer in the all_layers array.
   * @returns {number}
   */
  indexCurrentLayer (): number {
    if (!this.current_layer) return -1
    return this.all_layers.indexOf(this.current_layer)
  }

  /**
   * Deletes the current layer from the drawing and then clears the selection.
   * This function then calls the 'changed' handler.  This is an undoable action.
   * @todo Does this actually call the 'changed' handler?
   * @returns {SVGGElement | null} The SVGGElement of the layer removed or null.
   */
  deleteCurrentLayer (): SVGGElement | null {
    if (this.current_layer && this.getNumLayers() > 1) {
      const oldLayerGroup = this.current_layer.removeGroup()
      this.identifyLayers()
      return oldLayerGroup
    }
    return null
  }

  /**
   * Updates layer system and sets the current layer to the
   * top-most layer (last `<g>` child of this drawing).
   * @returns {void}
   */
  identifyLayers (): void {
    this.all_layers = []
    this.layer_map = {}
    const numchildren = this.svgElem_.childNodes.length
    // loop through all children of SVG element
    const orphans: Element[] = []
    const layernames: string[] = []
    let layer: Layer | null = null
    let childgroups = false
    for (let i = 0; i < numchildren; ++i) {
      const child = this.svgElem_.childNodes.item(i)
      // for each g, find its layer name
      if (child?.nodeType === 1) {
        const childEl = child as Element
        if (childEl.tagName === 'g') {
          childgroups = true
          if (isLayerElement(childEl)) {
            const name = findLayerNameInGroup(childEl)
            layernames.push(name)
            layer = new Layer(name, childEl as SVGGElement)
            this.all_layers.push(layer)
            this.layer_map[name] = layer
          } else {
            // if group did not have a name, it is an orphan
            orphans.push(childEl)
          }
        } else if (visElems.includes(childEl.nodeName)) {
          // Child is "visible" (i.e. not a <title> or <defs> element), so it is an orphan
          orphans.push(childEl)
        }
      }
    }

    // If orphans or no layers found, create a new layer and add all the orphans to it
    if (orphans.length > 0 || !childgroups) {
      const name = getNewLayerName(layernames)
      layer = new Layer(name, null, this.svgElem_)
      layer.appendChildren(orphans)
      this.all_layers.push(layer)
      this.layer_map[name] = layer
    } else if (layer) {
      layer.activate()
    }
    this.current_layer = layer
  }

  /**
   * Creates a new top-level layer in the drawing with the given name and
   * makes it the current layer.
   * @param {string} name - The given name. If the layer name exists, a new name will be generated.
   * @param {HistoryRecordingService} [hrService] - History recording service
   * @returns {SVGGElement} The SVGGElement of the new layer, which is
   *     also the current layer of this drawing.
   */
  createLayer (name: string | undefined | null, hrService?: HistoryRecordingService): SVGGElement {
    if (this.current_layer) {
      this.current_layer.deactivate()
    }
    // Check for duplicate name.
    if (
      name === undefined ||
      name === null ||
      name === '' ||
      this.layer_map[name]
    ) {
      name = getNewLayerName(Object.keys(this.layer_map))
    }

    // Crate new layer and add to DOM as last layer
    const layer = new Layer(name, null, this.svgElem_)
    // Like to assume hrService exists, but this is backwards compatible with old version of createLayer.
    if (hrService) {
      hrService.startBatchCommand('Create Layer')
      hrService.insertElement(layer.getGroup())
      hrService.endBatchCommand()
    }

    this.all_layers.push(layer)
    this.layer_map[name] = layer
    this.current_layer = layer
    return layer.getGroup()
  }

  /**
   * Creates a copy of the current layer with the given name and makes it the current layer.
   * @param {string} name - The given name. If the layer name exists, a new name will be generated.
   * @param {HistoryRecordingService} [hrService] - History recording service
   * @returns {SVGGElement | null} The SVGGElement of the new layer, which is
   *     also the current layer of this drawing.
   */
  cloneLayer (name: string | undefined | null, hrService?: HistoryRecordingService): SVGGElement | null {
    if (!this.current_layer) {
      return null
    }
    this.current_layer.deactivate()
    // Check for duplicate name.
    if (
      name === undefined ||
      name === null ||
      name === '' ||
      this.layer_map[name]
    ) {
      name = getNewLayerName(Object.keys(this.layer_map))
    }

    // Create new group and add to DOM just after current_layer
    const currentGroup = this.current_layer.getGroup()
    const layer = new Layer(name, currentGroup, this.svgElem_)
    const group = layer.getGroup()

    // Clone children
    const children = [...currentGroup.childNodes]
    children.forEach(child => {
      if (child.nodeType !== 1) {
        group.append(child.cloneNode(true))
        return
      }
      if ((child as Element).localName === 'title') {
        return
      }
      group.append(this.copyElem(child as Element))
    })

    if (hrService) {
      hrService.startBatchCommand('Duplicate Layer')
      hrService.insertElement(group)
      hrService.endBatchCommand()
    }

    // Update layer containers and current_layer.
    const index = this.indexCurrentLayer()
    if (index >= 0) {
      this.all_layers.splice(index + 1, 0, layer)
    } else {
      this.all_layers.push(layer)
    }
    this.layer_map[name] = layer
    this.current_layer = layer
    return group
  }

  /**
   * Returns whether the layer is visible.  If the layer name is not valid,
   * then this function returns `false`.
   * @param {string} layerName - The name of the layer which you want to query.
   * @returns {boolean} The visibility state of the layer, or `false` if the layer name was invalid.
   */
  getLayerVisibility (layerName: string): boolean {
    const layer = this.layer_map[layerName]
    return layer ? layer.isVisible() : false
  }

  /**
   * Sets the visibility of the layer. If the layer name is not valid, this
   * function returns `null`, otherwise it returns the `SVGElement` representing
   * the layer. This is an undo-able action.
   * @param {string} layerName - The name of the layer to change the visibility
   * @param {boolean} bVisible - Whether the layer should be visible
   * @returns {SVGGElement | null} The SVGGElement representing the layer if the
   *   `layerName` was valid, otherwise `null`.
   */
  setLayerVisibility (layerName: string, bVisible: boolean): SVGGElement | null {
    if (typeof bVisible !== 'boolean') {
      return null
    }
    const layer = this.layer_map[layerName]
    if (!layer) {
      return null
    }
    layer.setVisible(bVisible)
    return layer.getGroup()
  }

  /**
   * Returns the opacity of the given layer.  If the input name is not a layer, `null` is returned.
   * @param {string} layerName - name of the layer on which to get the opacity
   * @returns {number | null} The opacity value of the given layer.
   */
  getLayerOpacity (layerName: string): number | null {
    const layer = this.layer_map[layerName]
    if (!layer) {
      return null
    }
    return layer.getOpacity()
  }

  /**
   * Sets the opacity of the given layer.  If the input name is not a layer,
   * nothing happens. If opacity is not a value between 0.0 and 1.0, then
   * nothing happens.
   * @param {string} layerName - Name of the layer on which to set the opacity
   * @param {number} opacity - A float value in the range 0.0-1.0
   * @returns {void}
   */
  setLayerOpacity (layerName: string, opacity: number): void {
    if (typeof opacity !== 'number' || opacity < 0.0 || opacity > 1.0) {
      return
    }
    const layer = this.layer_map[layerName]
    if (layer) {
      layer.setOpacity(opacity)
    }
  }

  /**
   * Create a clone of an element, updating its ID and its children's IDs when needed.
   * @param {Element} el - DOM element to clone
   * @returns {Element}
   */
  copyElem (el: Element): Element {
    const getNextIdClosure = (): string => this.getNextId()
    return utilCopyElem(el, getNextIdClosure)
  }
}

/**
 * Called to ensure that drawings will or will not have randomized ids.
 * The currentDrawing will have its nonce set if it doesn't already.
 * @function module:draw.randomizeIds
 * @param {boolean} enableRandomization - flag indicating if documents should have randomized ids
 * @param {Drawing} currentDrawing
 * @returns {void}
 */
export const randomizeIds = (enableRandomization: boolean, currentDrawing: Drawing): void => {
  randIds =
    enableRandomization === false
      ? RandomizeModes.NEVER_RANDOMIZE
      : RandomizeModes.ALWAYS_RANDOMIZE

  if (
    randIds === RandomizeModes.ALWAYS_RANDOMIZE &&
    !currentDrawing.getNonce()
  ) {
    currentDrawing.setNonce(Math.floor(Math.random() * 100001))
  } else if (
    randIds === RandomizeModes.NEVER_RANDOMIZE &&
    currentDrawing.getNonce()
  ) {
    currentDrawing.clearNonce()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any
/**
 * @function module:draw.init
 * @param {unknown} canvas
 * @returns {void}
 */
export const init = (canvas: unknown): void => {
  svgCanvas = canvas
}

/**
 * Updates layer system.
 * @function module:draw.identifyLayers
 * @returns {void}
 */
export const identifyLayers = (): void => {
  leaveContext()
  svgCanvas.getCurrentDrawing().identifyLayers()
}

/**
 * get current index
 * @function module:draw.indexCurrentLayer
 * @returns {number}
 */
export const indexCurrentLayer = (): number => {
  return svgCanvas.getCurrentDrawing().indexCurrentLayer()
}

/**
 * Creates a new top-level layer in the drawing with the given name, sets the current layer
 * to it, and then clears the selection. This function then calls the 'changed' handler.
 * This is an undoable action.
 * @function module:draw.createLayer
 * @param {string} name - The given name
 * @param {HistoryRecordingService} [hrService]
 * @returns {void}
 */
export const createLayer = (name: string, hrService?: HistoryRecordingService): void => {
  const newLayer = svgCanvas
    .getCurrentDrawing()
    .createLayer(name, historyRecordingService(hrService))
  svgCanvas.clearSelection()
  svgCanvas.call('changed', [newLayer])
}

/**
 * Creates a new top-level layer in the drawing with the given name, copies all the current layer's contents
 * to it, and then clears the selection.
 * @function module:draw.cloneLayer
 * @param {string} name - The given name. If the layer name exists, a new name will be generated.
 * @param {HistoryRecordingService} [hrService] - History recording service
 * @returns {void}
 */
export const cloneLayer = (name: string, hrService?: HistoryRecordingService): void => {
  // Clone the current layer and make the cloned layer the new current layer
  const newLayer = svgCanvas
    .getCurrentDrawing()
    .cloneLayer(name, historyRecordingService(hrService))
  if (!newLayer) {
    warn('cloneLayer: no layer returned', null, 'draw')
    return
  }

  svgCanvas.clearSelection()
  leaveContext()
  svgCanvas.call('changed', [newLayer])
}

/**
 * Deletes the current layer from the drawing and then clears the selection.
 * @function module:draw.deleteCurrentLayer
 * @returns {boolean} `true` if an old layer group was found to delete
 */
export const deleteCurrentLayer = (): boolean => {
  const { BatchCommand, RemoveElementCommand } = svgCanvas.history
  const currentLayer = svgCanvas.getCurrentDrawing().getCurrentLayer()
  if (!currentLayer) {
    warn('deleteCurrentLayer: no current layer', null, 'draw')
    return false
  }
  const { nextSibling } = currentLayer
  const parent = currentLayer.parentNode
  const removedLayer = svgCanvas.getCurrentDrawing().deleteCurrentLayer()
  if (removedLayer && parent) {
    const batchCmd = new BatchCommand('Delete Layer')
    // store in our Undo History
    batchCmd.addSubCommand(
      new RemoveElementCommand(removedLayer, nextSibling, parent)
    )
    svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.clearSelection()
    svgCanvas.call('changed', [parent])
    return true
  }
  return false
}

/**
 * Sets the current layer. If the name is not a valid layer name, then this function returns
 * false. Otherwise it returns true. This is not an undo-able action.
 * @function module:draw.setCurrentLayer
 * @param {string} name - The name of the layer you want to switch to.
 * @returns {boolean} true if the current layer was switched, otherwise false
 */
export const setCurrentLayer = (name: string): boolean => {
  const result = svgCanvas.getCurrentDrawing().setCurrentLayer(toXml(name))
  if (result) {
    svgCanvas.clearSelection()
  }
  return result
}

/**
 * Renames the current layer. If the layer name is not valid (i.e. unique), then this function
 * does nothing and returns `false`, otherwise it returns `true`. This is an undo-able action.
 * @function module:draw.renameCurrentLayer
 * @param {string} newName - the new name you want to give the current layer. This name must
 * be unique among all layer names.
 * @returns {boolean} Whether the rename succeeded
 */
export const renameCurrentLayer = (newName: string): boolean => {
  const drawing = svgCanvas.getCurrentDrawing()
  const layer = drawing.getCurrentLayer()
  if (layer) {
    const result = drawing.setCurrentLayerName(
      newName,
      historyRecordingService()
    )
    if (result) {
      svgCanvas.call('changed', [layer])
      return true
    }
  }
  return false
}

/**
 * Changes the position of the current layer to the new value.
 * @function module:draw.setCurrentLayerPosition
 * @param {number} newPos - The zero-based index of the new position of the layer.
 * @returns {boolean} `true` if the current layer position was changed, `false` otherwise.
 */
export const setCurrentLayerPosition = (newPos: number): boolean => {
  const { MoveElementCommand } = svgCanvas.history
  const drawing = svgCanvas.getCurrentDrawing()
  const result = drawing.setCurrentLayerPosition(newPos)
  if (result) {
    svgCanvas.addCommandToHistory(
      new MoveElementCommand(
        result.currentGroup,
        result.oldNextSibling,
        svgCanvas.getSvgContent()
      )
    )
    return true
  }
  return false
}

/**
 * Sets the visibility of the layer.
 * @function module:draw.setLayerVisibility
 * @param {string} layerName - The name of the layer to change the visibility
 * @param {boolean} bVisible - Whether the layer should be visible
 * @returns {boolean} true if the layer's visibility was set, false otherwise
 */
export const setLayerVisibility = (layerName: string, bVisible: boolean): boolean => {
  const { ChangeElementCommand } = svgCanvas.history
  const drawing = svgCanvas.getCurrentDrawing()
  const layerGroup = drawing.getLayerByName(layerName)
  if (!layerGroup) {
    warn('setLayerVisibility: layer not found', layerName, 'draw')
    return false
  }
  const oldDisplay = layerGroup.getAttribute('display')
  const layer = drawing.setLayerVisibility(layerName, bVisible)
  if (!layer) {
    return false
  }
  svgCanvas.addCommandToHistory(
    new ChangeElementCommand(layer, { display: oldDisplay }, 'Layer Visibility')
  )

  if (layer === drawing.getCurrentLayer()) {
    svgCanvas.clearSelection()
    svgCanvas.pathActions.clear()
  }
  // call('changed', [selected]);
  return true
}

/**
 * Moves the selected elements to layerName.
 * @function module:draw.moveSelectedToLayer
 * @param {string} layerName - The name of the layer
 * @returns {boolean} Whether the selected elements were moved to the layer.
 */
export const moveSelectedToLayer = (layerName: string): boolean => {
  const { BatchCommand, MoveElementCommand } = svgCanvas.history
  // find the layer
  const drawing = svgCanvas.getCurrentDrawing()
  const layer = drawing.getLayerByName(layerName)
  if (!layer) {
    return false
  }

  const batchCmd = new BatchCommand('Move Elements to Layer')

  // loop for each selected element and move it
  const selElems: (Element | null)[] = svgCanvas.getSelectedElements()
  let i = selElems.length
  while (i--) {
    const elem = selElems[i]
    const oldLayer = elem?.parentNode
    if (!elem || !oldLayer || oldLayer === layer) {
      continue
    }
    const oldNextSibling = elem.nextSibling
    layer.append(elem)
    batchCmd.addSubCommand(
      new MoveElementCommand(elem, oldNextSibling, oldLayer)
    )
  }

  if (batchCmd.isEmpty()) {
    warn('moveSelectedToLayer: no elements moved', null, 'draw')
    return false
  }
  svgCanvas.addCommandToHistory(batchCmd)

  return true
}

/**
 * @function module:draw.mergeLayer
 * @param {HistoryRecordingService} [hrService]
 * @returns {void}
 */
export const mergeLayer = (hrService?: HistoryRecordingService): void => {
  svgCanvas.getCurrentDrawing().mergeLayer(historyRecordingService(hrService))
  svgCanvas.clearSelection()
  leaveContext()
  svgCanvas.changeSvgContent()
}

/**
 * @function module:draw.mergeAllLayers
 * @param {HistoryRecordingService} [hrService]
 * @returns {void}
 */
export const mergeAllLayers = (hrService?: HistoryRecordingService): void => {
  svgCanvas
    .getCurrentDrawing()
    .mergeAllLayers(historyRecordingService(hrService))
  svgCanvas.clearSelection()
  leaveContext()
  svgCanvas.changeSvgContent()
}

/**
 * Return from a group context to the regular kind, make any previously
 * disabled elements enabled again.
 * @function module:draw.leaveContext
 * @returns {void}
 */
export const leaveContext = (): void => {
  const len = disabledElems.length
  const dataStorage = svgCanvas.getDataStorage()
  if (len) {
    for (let i = 0; i < len; i++) {
      const elem = disabledElems[i]
      if (!elem) continue
      const orig = dataStorage.get(elem, 'orig_opac')
      if (orig === null || orig === undefined) {
        elem.removeAttribute('opacity')
      } else {
        elem.setAttribute('opacity', String(orig))
      }
      elem.setAttribute('style', 'pointer-events: inherit')
      dataStorage.remove(elem, 'orig_opac')
    }
    disabledElems = []
    svgCanvas.clearSelection(true)
    svgCanvas.call('contextset', null)
  }
  svgCanvas.setCurrentGroup(null)
}

/**
 * Set the current context (for in-group editing).
 * @function module:draw.setContext
 * @param {Element | string} elem
 * @returns {void}
 */
export const setContext = (elem: Element | string | null): void => {
  const dataStorage = svgCanvas.getDataStorage()
  leaveContext()
  if (typeof elem === 'string') {
    const id = elem
    try {
      elem = getElement(id)
    } catch {
      elem = null
    }
    if (!elem && typeof document !== 'undefined') {
      const candidate = document.getElementById(id)
      const svgContent = svgCanvas.getSvgContent?.()
      elem = candidate && (svgContent ? svgContent.contains(candidate) : true)
        ? candidate
        : null
    }
  }
  if (!elem) {
    return
  }

  // Edit inside this group
  svgCanvas.setCurrentGroup(elem)

  // Disable other elements
  const parentsUntil = getParentsUntil(elem, '#svgcontent')
  if (!parentsUntil) {
    return
  }
  const siblings: Element[] = []
  parentsUntil.forEach(function (parent: Node) {
    const parentEl = parent as Element
    if (!parentEl?.parentNode) {
      return
    }
    const elements = Array.prototype.filter.call(
      parentEl.parentNode.children,
      function (child: Element) {
        return child !== parentEl
      }
    ) as Element[]
    elements.forEach(function (element: Element) {
      siblings.push(element)
    })
  })

  siblings.forEach(function (curthis: Element) {
    // Store the original's opacity
    const origOpacity = curthis.getAttribute('opacity')
    dataStorage.put(curthis, 'orig_opac', origOpacity)
    const parsedOpacity = Number.parseFloat(origOpacity ?? '')
    const opac = Number.isFinite(parsedOpacity) ? parsedOpacity : 1
    curthis.setAttribute('opacity', String(opac * 0.33))
    curthis.setAttribute('style', 'pointer-events: none')
    disabledElems.push(curthis)
  })
  svgCanvas.clearSelection()
  svgCanvas.call('contextset', svgCanvas.getCurrentGroup())
}

/**
 * @memberof module:draw
 * @class Layer
 * @see {@link module:layer.Layer}
 */
export { Layer }
