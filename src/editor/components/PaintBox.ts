// @ts-expect-error: JS file; will be converted to TS in this task (jQuery.jGraduate)
import { jGraduate } from './jgraduate/jQuery.jGraduate.js'
/**
 *
 */
class PaintBox {
  rect: Element
  defs: Element
  grad: Element
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPaint (paint: any): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.paint = paint

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const ptype: string = paint.type
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const opac: number = paint.alpha / 100

    let fillAttr = 'none'
    switch (ptype) {
      case 'solidColor':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        fillAttr = (paint[ptype] !== 'none') ? '#' + paint[ptype] : paint[ptype]
        break
      case 'linearGradient':
      case 'radialGradient': {
        this.grad.remove()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getPaint (svgCanvas: any, color: string, opac: number, type: string): any {
    // update the editor's fill paint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: Record<string, any> = { alpha: opac }
    if (color.startsWith('url(#')) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      let refElem = svgCanvas.getRefElem(color)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      refElem = (refElem) ? refElem.cloneNode(true) : document.querySelectorAll('#' + type + '_color defs *')[0]
      if (!refElem) {
        console.error(`the color ${color} is referenced by an url that can't be identified - using 'none'`)
        opts.solidColor = 'none'
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        opts[refElem.tagName] = refElem
      }
    } else if (color.startsWith('#')) {
      opts.solidColor = color.substr(1)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return new (jGraduate as any).Paint(opts)
  }

  /**
     * @param {PlainObject} svgcanvas
     * @param {PlainObject} selectedElement
     * @returns {any}
     */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
