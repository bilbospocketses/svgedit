/**
 * DOM element selection box tools.
 * @module select
 * @license MIT
 *
 */


import { getRotationAngle, getBBox } from './utilities.js'
import { transformListToTransform, transformBox, transformPoint, matrixMultiply, getTransformList } from './math.js'
import { NS } from './namespaces'
import { warn } from '../common/logger.js'
import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas
// change radius if touch screen
const gripRadius = window.ontouchstart ? 10 : 4

/**
 * Private singleton manager for selector state
 */
class SelectModule {
  #selectorManager: SelectorManager | null = null

  /**
   * Initialize the select module with canvas
   */
  init (canvas: ISvgCanvas): void {
    svgCanvas = canvas
    this.#selectorManager = new SelectorManager()
  }

  /**
   * Get the singleton SelectorManager instance
   */
  getSelectorManager (): SelectorManager {
    return this.#selectorManager as SelectorManager
  }
}

/**
* Private class for DOM element selection boxes.
*/
export class Selector {
  id: number
  selectedElement: Element
  locked: boolean
  selectorGroup: SVGElement
  selectorRect: SVGElement
  hasGrips?: boolean
  gripCoords: Record<string, [number, number] | null>

  /**
  * @param id - Internally identify the selector
  * @param elem - DOM element associated with this selector
  * @param [bbox] - Optional bbox to use for initialization
  */
  constructor (id: number, elem: Element, bbox?: { x: number; y: number; width: number; height: number }) {
    this.id = id
    this.selectedElement = elem
    this.locked = true

    this.selectorGroup = svgCanvas.createSVGElement({
      element: 'g',
      attr: { id: `selectorGroup${this.id}` }
    }) as SVGElement

    this.selectorRect = svgCanvas.createSVGElement({
      element: 'path',
      attr: {
        id: `selectedBox${this.id}`,
        fill: 'none',
        stroke: '#22C',
        'stroke-width': '1',
        'stroke-dasharray': '5,5',
        style: 'pointer-events:none'
      }
    }) as SVGElement
    this.selectorGroup.append(this.selectorRect)

    this.gripCoords = {
      nw: null,
      n: null,
      ne: null,
      e: null,
      se: null,
      s: null,
      sw: null,
      w: null
    }

    this.reset(this.selectedElement, bbox)
  }

  /**
  * Used to reset the id and element that the selector is attached to.
  */
  reset (e: Element, bbox?: { x: number; y: number; width: number; height: number }): void {
    this.locked = true
    this.selectedElement = e
    this.resize(bbox)
    this.selectorGroup.setAttribute('display', 'inline')
  }

  /**
  * Show the resize grips of this selector.
  */
  showGrips (show: boolean): void {
    const bShow = show ? 'inline' : 'none'
    selectModule.getSelectorManager().selectorGripsGroup.setAttribute('display', bShow)
    const elem = this.selectedElement
    this.hasGrips = show
    if (elem && show) {
      this.selectorGroup.append(selectModule.getSelectorManager().selectorGripsGroup)
      Selector.updateGripCursors(getRotationAngle(elem))
    }
  }

  /**
  * Updates the selector to match the element's size.
  */
  resize (bbox?: { x: number; y: number; width: number; height: number }): void {
    const dataStorage = svgCanvas.getDataStorage()
    const selectedBox = this.selectorRect
    const mgr = selectModule.getSelectorManager()
    const selectedGrips = mgr.selectorGrips
    const selected = this.selectedElement
    const zoom: number = svgCanvas.getZoom()
    let offset = 1 / zoom
    const sw = selected.getAttribute('stroke-width')
    if (selected.getAttribute('stroke') !== 'none' && !isNaN(Number(sw))) {
      offset += (Number(sw) / 2)
    }

    const { tagName } = selected
    if (tagName === 'text') {
      offset += 2 / zoom
    }

    // find the transformations applied to the parent of the selected element
    const svg = document.createElementNS(NS.SVG, 'svg')
    let parentTransformationMatrix = svg.createSVGMatrix()
    let currentElt: Element | ParentNode | null = selected
    while (currentElt && (currentElt as Element).parentNode) {
      const parent = (currentElt as Element).parentNode as Element | null
      if (parent && parent.tagName === 'g' && (parent as SVGGElement).transform) {
        if ((parent as SVGGElement).transform.baseVal.numberOfItems) {
          parentTransformationMatrix = matrixMultiply(transformListToTransform(getTransformList(parent)).matrix, parentTransformationMatrix)
        }
      }
      currentElt = parent
    }

    // loop and transform our bounding box until we reach our first rotation
    const tlist = getTransformList(selected)

    // combines the parent transformation with that of the selected element if necessary
    const m = parentTransformationMatrix ? matrixMultiply(parentTransformationMatrix, transformListToTransform(tlist).matrix) : transformListToTransform(tlist).matrix

    // This should probably be handled somewhere else, but for now
    // it keeps the selection box correctly positioned when zoomed
    m.e *= zoom
    m.f *= zoom

    if (!bbox) {
      bbox = getBBox(selected) as { x: number; y: number; width: number; height: number }
    }
    // TODO: getBBox already handles tagName === 'g' — getStrokedBBox call removed (required 3 args, was always 1-arg legacy call)
    if (tagName === 'g' && !dataStorage.has(selected, 'gsvg')) {
      // bbox from getBBox above is already appropriate; getStrokedBBox needs extra args so omitted here
    }

    if (bbox) {
      const l = bbox.x; const t = bbox.y; const w = bbox.width; const h = bbox.height

      offset *= zoom

      const nbox = transformBox(l * zoom, t * zoom, w * zoom, h * zoom, m)
      const { aabox } = nbox
      let nbax = aabox.x - offset
      let nbay = aabox.y - offset
      let nbaw = aabox.width + (offset * 2)
      let nbah = aabox.height + (offset * 2)

      const cx = nbax + nbaw / 2
      const cy = nbay + nbah / 2

      const angle = getRotationAngle(selected)
      if (angle) {
        const rot = svgCanvas.getSvgRoot().createSVGTransform()
        rot.setRotate(-angle, cx, cy)
        const rotm = rot.matrix
        nbox.tl = transformPoint(nbox.tl.x, nbox.tl.y, rotm)
        nbox.tr = transformPoint(nbox.tr.x, nbox.tr.y, rotm)
        nbox.bl = transformPoint(nbox.bl.x, nbox.bl.y, rotm)
        nbox.br = transformPoint(nbox.br.x, nbox.br.y, rotm)

        const { tl } = nbox
        let minx = tl.x
        let miny = tl.y
        let maxx = tl.x
        let maxy = tl.y

        const { min, max } = Math

        minx = min(minx, min(nbox.tr.x, min(nbox.bl.x, nbox.br.x))) - offset
        miny = min(miny, min(nbox.tr.y, min(nbox.bl.y, nbox.br.y))) - offset
        maxx = max(maxx, max(nbox.tr.x, max(nbox.bl.x, nbox.br.x))) + offset
        maxy = max(maxy, max(nbox.tr.y, max(nbox.bl.y, nbox.br.y))) + offset

        nbax = minx
        nbay = miny
        nbaw = (maxx - minx)
        nbah = (maxy - miny)
      }

      const dstr = `M${nbax},${nbay} L${nbax + nbaw},${nbay} ${nbax + nbaw},${nbay + nbah} ${nbax},${nbay + nbah}z`

      const xform = angle ? 'rotate(' + [angle, cx, cy].join(',') + ')' : ''

      this.gripCoords = {
        nw: [nbax, nbay],
        ne: [nbax + nbaw, nbay],
        sw: [nbax, nbay + nbah],
        se: [nbax + nbaw, nbay + nbah],
        n: [nbax + (nbaw) / 2, nbay],
        w: [nbax, nbay + (nbah) / 2],
        e: [nbax + nbaw, nbay + (nbah) / 2],
        s: [nbax + (nbaw) / 2, nbay + nbah]
      }
      selectedBox.setAttribute('d', dstr)
      this.selectorGroup.setAttribute('transform', xform)
      for (const [dir, coords] of Object.entries(this.gripCoords)) {
        if (!coords) { continue }
        const grip = selectedGrips[dir]
        if (grip) {
          grip.setAttribute('cx', String(coords[0]))
          grip.setAttribute('cy', String(coords[1]))
        }
      }

      mgr.rotateGripConnector.setAttribute('x1', String(nbax + (nbaw) / 2))
      mgr.rotateGripConnector.setAttribute('y1', String(nbay))
      mgr.rotateGripConnector.setAttribute('x2', String(nbax + (nbaw) / 2))
      mgr.rotateGripConnector.setAttribute('y2', String(nbay - (gripRadius * 5)))

      mgr.rotateGrip.setAttribute('cx', String(nbax + (nbaw) / 2))
      mgr.rotateGrip.setAttribute('cy', String(nbay - (gripRadius * 5)))
    }
  }

  // STATIC methods
  /**
  * Updates cursors for corner grips on rotation so arrows point the right way.
  */
  static updateGripCursors (angle: number): void {
    const dirArr = Object.keys(selectModule.getSelectorManager().selectorGrips)
    let steps = Math.round(angle / 45)
    if (steps < 0) { steps += 8 }
    while (steps > 0) {
      dirArr.push(dirArr.shift() as string)
      steps--
    }
    const grips = Object.values(selectModule.getSelectorManager().selectorGrips)
    grips.forEach((gripElement, i) => {
      const dir = dirArr[i]
      if (gripElement && dir) {
        (gripElement as Element).setAttribute('style', `cursor:${dir}-resize`)
      }
    })
  }
}

/**
* Manage all selector objects (selection boxes).
*/
export class SelectorManager {
  selectorParentGroup: SVGElement | null
  rubberBandBox: SVGRectElement | null
  selectors: Selector[]
  selectorMap: Record<string, Selector>
  selectorGrips: Record<string, SVGCircleElement | null>
  selectorGripsGroup: SVGElement
  rotateGripConnector: SVGElement
  rotateGrip: SVGCircleElement

  /**
   * Sets up properties and calls `initGroup`.
   */
  constructor () {
    this.selectorParentGroup = null
    this.rubberBandBox = null
    this.selectors = []
    this.selectorMap = {}
    this.selectorGrips = {
      nw: null,
      n: null,
      ne: null,
      e: null,
      se: null,
      s: null,
      sw: null,
      w: null
    }

    this.selectorGripsGroup = null as unknown as SVGElement
    this.rotateGripConnector = null as unknown as SVGElement
    this.rotateGrip = null as unknown as SVGCircleElement

    this.initGroup()
  }

  /**
  * Resets the parent selector group element.
  */
  initGroup (): void {
    const dataStorage = svgCanvas.getDataStorage()
    if (this.selectorParentGroup?.parentNode) {
      this.selectorParentGroup.remove()
    }

    this.selectorParentGroup = svgCanvas.createSVGElement({
      element: 'g',
      attr: { id: 'selectorParentGroup' }
    }) as SVGElement
    this.selectorGripsGroup = svgCanvas.createSVGElement({
      element: 'g',
      attr: { display: 'none' }
    }) as SVGElement
    this.selectorParentGroup?.append(this.selectorGripsGroup)
    svgCanvas.getSvgRoot().append(this.selectorParentGroup)

    this.selectorMap = {}
    this.selectors = []
    this.rubberBandBox = null

    Object.keys(this.selectorGrips).forEach((dir) => {
      const grip = svgCanvas.createSVGElement({
        element: 'circle',
        attr: {
          id: `selectorGrip_resize_${dir}`,
          fill: '#22C',
          r: gripRadius,
          style: `cursor:${dir}-resize`,
          'stroke-width': 2,
          'pointer-events': 'all'
        }
      }) as SVGCircleElement

      dataStorage.put(grip, 'dir', dir)
      dataStorage.put(grip, 'type', 'resize')
      this.selectorGrips[dir] = grip
      this.selectorGripsGroup.append(grip)
    })

    this.rotateGripConnector = svgCanvas.createSVGElement({
        element: 'line',
        attr: {
          id: ('selectorGrip_rotateconnector'),
          stroke: '#22C',
          'stroke-width': '1'
        }
      }) as SVGElement
    this.selectorGripsGroup.append(this.rotateGripConnector)

    this.rotateGrip = svgCanvas.createSVGElement({
        element: 'circle',
        attr: {
          id: 'selectorGrip_rotate',
          fill: 'lime',
          r: gripRadius,
          stroke: '#22C',
          'stroke-width': 2,
          style: `cursor:url(${svgCanvas.curConfig.imgPath}/rotate.svg) 12 12, auto;`
        }
      }) as SVGCircleElement
    this.selectorGripsGroup.append(this.rotateGrip)
    dataStorage.put(this.rotateGrip, 'type', 'rotate')

    if (document.getElementById('canvasBackground')) { return }

    const [width, height] = svgCanvas.curConfig.dimensions as [number, number]
    const canvasbg = svgCanvas.createSVGElement({
      element: 'svg',
      attr: {
        id: 'canvasBackground',
        width,
        height,
        x: 0,
        y: 0,
        overflow: 'visible',
        style: 'pointer-events:none'
      }
    })

    const rect = svgCanvas.createSVGElement({
      element: 'rect',
      attr: {
        width: '100%',
        height: '100%',
        x: 0,
        y: 0,
        'stroke-width': 1,
        stroke: '#000',
        fill: '#FFF',
        style: 'pointer-events:none'
      }
    })
    canvasbg.append(rect)
    svgCanvas.getSvgRoot().insertBefore(canvasbg, svgCanvas.getSvgContent())
  }

  /**
  * Returns the selector for the given element.
  */
  requestSelector (elem: Element | null, bbox?: { x: number; y: number; width: number; height: number }): Selector | null {
    if (!elem) { return null }

    const N = this.selectors.length
    const existing = this.selectorMap[elem.id]
    if (typeof existing === 'object') {
      existing.locked = true
      return existing
    }
    for (let i = 0; i < N; ++i) {
      const sel = this.selectors[i]
      if (sel && !sel.locked) {
        sel.locked = true
        sel.reset(elem, bbox)
        this.selectorMap[elem.id] = sel
        return sel
      }
    }
    const newSel = new Selector(N, elem, bbox)
    this.selectors[N] = newSel
    this.selectorParentGroup?.append(newSel.selectorGroup)
    this.selectorMap[elem.id] = newSel
    return newSel
  }

  /**
  * Removes the selector of the given element (hides selection box).
  */
  releaseSelector (elem: Element | null): void {
    if (!elem) { return }
    const N = this.selectors.length
    const sel: Selector | undefined = this.selectorMap[elem.id]
    if (!sel?.locked) {
      warn('WARNING! selector was released but was already unlocked', null, 'select')
    }
    for (let i = 0; i < N; ++i) {
      if (this.selectors[i] && this.selectors[i] === sel && sel) {
        delete this.selectorMap[elem.id]
        sel.locked = false
        sel.selectedElement = null as unknown as Element
        sel.showGrips(false)

        try {
          sel.selectorGroup.setAttribute('display', 'none')
        } catch {}

        break
      }
    }
  }

  /**
  * @returns The rubberBandBox DOM element.
  */
  getRubberBandBox (): SVGRectElement | null {
    if (!this.rubberBandBox) {
      this.rubberBandBox = svgCanvas.createSVGElement({
          element: 'rect',
          attr: {
            id: 'selectorRubberBand',
            fill: '#22C',
            'fill-opacity': 0.15,
            stroke: '#22C',
            'stroke-width': 0.5,
            display: 'none',
            style: 'pointer-events:none'
          }
        }) as SVGRectElement
      if (this.rubberBandBox) {
        this.selectorParentGroup?.append(this.rubberBandBox)
      }
    }
    return this.rubberBandBox
  }
}

// Export singleton instance for backward compatibility
const selectModule = new SelectModule()

/**
 * Initializes this module.
 * @function module:select.init
 */
export const init = (canvas: ISvgCanvas): void => {
  selectModule.init(canvas)
}

/**
 * @function module:select.getSelectorManager
 * @returns The SelectorManager instance.
 */
export const getSelectorManager = (): SelectorManager => selectModule.getSelectorManager()
