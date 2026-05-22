/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// jGraduate (legacy jQuery plugin) ships as 'any'; cleanup deferred to #3 (Lit migration)
import { jGraduate } from './jgraduate/jQuery.jGraduate.js'
/**
 *
 */
class PaintBox {
  rect: Element
  defs: Element
  grad: Element
  type: string
  paint: any
  _paintColor: string | null
  _paintOpacity: number
  static ctr: number

  /**
     * @param {string|Element|external:jQuery} container
     * @param {"fill"} type
     */
  constructor (container: Element, type: string) {
    // set up gradients to be used for the buttons
    const svgdocbox = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14">
          <rect
            fill="#000000" opacity="1" width="14" height="14"/>
          <defs><linearGradient id="gradbox_${PaintBox.ctr++}"/></defs>
        </svg>`,
      'text/xml'
    )

    let docElem: Element = svgdocbox.documentElement
    docElem = document.importNode(docElem, true)
    container.appendChild(docElem)

    this.rect = docElem.firstElementChild as Element
    this.defs = docElem.getElementsByTagName('defs')[0] as Element
    this.grad = this.defs.firstElementChild as Element
    this._paintColor = null
    this._paintOpacity = 1
    // this.paint = new $.jGraduate.Paint({solidColor: color});
    this.type = type
  }

  /**
     * @param {module:jGraduate~Paint} paint
     * @returns {void}
     */
  setPaint (paint: any): void {
    this.paint = paint

    const ptype: string = paint.type
    const opac: number = paint.alpha / 100

    let fillAttr = 'none'
    switch (ptype) {
      case 'solidColor':
        fillAttr = (paint[ptype] !== 'none') ? '#' + paint[ptype] : paint[ptype]
        break
      case 'linearGradient':
      case 'radialGradient': {
        this.grad.remove()
        this.grad = paint[ptype]
        this.defs.appendChild(this.grad)
        const id = (this.grad as Element & { id: string }).id = 'gradbox_' + this.type
        fillAttr = 'url(#' + id + ')'
        break
      }
    }

    this.rect.setAttribute('fill', fillAttr)
    this.rect.setAttribute('opacity', String(opac))
  }

  /**
   * @param {PlainObject} svgCanvas
  * @param {string} color
  * @param {Float} opac
  * @param {string} type
  * @returns {module:jGraduate~Paint}
  */
  static getPaint (svgCanvas: any, color: string, opac: number, type: string): any {
    // update the editor's fill paint
    const opts: Record<string, any> = { alpha: opac }
    if (color.startsWith('url(#')) {
      let refElem = svgCanvas.getRefElem(color)
      refElem = (refElem) ? refElem.cloneNode(true) : document.querySelectorAll('#' + type + '_color defs *')[0]
      if (!refElem) {
        console.error(`the color ${color} is referenced by an url that can't be identified - using 'none'`)
        opts.solidColor = 'none'
      } else {
        opts[refElem.tagName] = refElem
      }
    } else if (color.startsWith('#')) {
      opts.solidColor = color.substr(1)
    }
    return new (jGraduate as any).Paint(opts)
  }

  /**
     * @param {PlainObject} svgcanvas
     * @param {PlainObject} selectedElement
     * @returns {any}
     */
  update (svgcanvas: any, selectedElement: Element | null): any {
    if (!selectedElement) { return null }

    const { type } = this
    switch (selectedElement.tagName) {
      case 'use':
      case 'image':
      case 'foreignObject':
      // These elements don't have fill or stroke, so don't change
      // the current value
        return null
      case 'g':
      case 'a': {
        const childs = selectedElement.getElementsByTagName('*')

        let gPaint = null
        for (let i = 0, len = childs.length; i < len; i++) {
          const elem = childs[i] as Element
          const p = elem.getAttribute(type)
          if (i === 0) {
            gPaint = p
          } else if (gPaint !== p) {
            gPaint = null
            break
          }
        }

        if (gPaint === null) {
        // No common color, don't update anything
          this._paintColor = null
          return null
        }
        this._paintColor = gPaint
        this._paintOpacity = 1
        break
      } default: {
        this._paintOpacity = Number.parseFloat(selectedElement.getAttribute(type + '-opacity') ?? '')
        if (Number.isNaN(this._paintOpacity)) {
          this._paintOpacity = 1.0
        }

        const defColor = type === 'fill' ? 'black' : 'none'
        this._paintColor = selectedElement.getAttribute(type) || defColor
      }
    }

    this._paintOpacity *= 100

    const paint = PaintBox.getPaint(svgcanvas, this._paintColor, this._paintOpacity, type)
    // update the rect inside #fill_color/#stroke_color
    this.setPaint(paint)
    return (paint)
  }
}
PaintBox.ctr = 0

export default PaintBox
