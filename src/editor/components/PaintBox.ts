import SvgCanvas from '@svgedit/svgcanvas'
import type { ISvgCanvas } from '@svgedit/svgcanvas'
import type Paint from '@svgedit/svgcanvas/core/paint.js'
/** Manages an SVG paint swatch element, syncing fill/stroke color and opacity to a canvas Paint object. */
class PaintBox {
  rect: Element
  defs: Element
  grad: Element
  type: string
  paint: Paint | null
  _paintColor: string | null
  _paintOpacity: number
  static ctr: number

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
    this.paint = null
    this._paintColor = null
    this._paintOpacity = 1
    this.type = type
  }

  setPaint (paint: Paint): void {
    this.paint = paint

    const ptype = paint.type
    const opac: number = paint.alpha / 100

    let fillAttr = 'none'
    switch (ptype) {
      case 'solidColor':
        fillAttr = (paint.solidColor !== 'none' && paint.solidColor !== null)
          ? '#' + paint.solidColor
          : (paint.solidColor ?? 'none')
        break
      case 'linearGradient':
      case 'radialGradient': {
        const gradEl = paint[ptype]
        if (gradEl) {
          this.grad.remove()
          this.grad = gradEl
          this.defs.appendChild(this.grad)
        }
        const id = (this.grad as Element & { id: string }).id = 'gradbox_' + this.type
        fillAttr = 'url(#' + id + ')'
        break
      }
    }

    this.rect.setAttribute('fill', fillAttr)
    this.rect.setAttribute('opacity', String(opac))
  }

  static getPaint (svgCanvas: ISvgCanvas, color: string, opac: number, type: string): Paint {
    // update the editor's fill paint
    if (color.startsWith('url(#')) {
      let refElem: Element | null = svgCanvas.getRefElem(color)
      refElem = refElem ? refElem.cloneNode(true) as Element : (document.querySelectorAll('#' + type + '_color defs *')[0] ?? null)
      if (!refElem) {
        console.error(`the color ${color} is referenced by an url that can't be identified - using 'none'`)
        return new SvgCanvas.Paint({ alpha: opac, solidColor: 'none' })
      }
      const tagName = refElem.tagName
      if (tagName === 'linearGradient') {
        return new SvgCanvas.Paint({ alpha: opac, linearGradient: refElem as SVGLinearGradientElement })
      }
      if (tagName === 'radialGradient') {
        return new SvgCanvas.Paint({ alpha: opac, radialGradient: refElem as SVGRadialGradientElement })
      }
      // Unknown gradient type — fall through to empty paint
      return new SvgCanvas.Paint({ alpha: opac })
    }
    if (color.startsWith('#')) {
      return new SvgCanvas.Paint({ alpha: opac, solidColor: color.slice(1) })
    }
    return new SvgCanvas.Paint({ alpha: opac })
  }

  update (svgcanvas: ISvgCanvas, selectedElement: Element | null): Paint | null {
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
