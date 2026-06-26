/**
 * @file se-gradient-stop — A single draggable gradient stop marker.
 *
 * Renders a teardrop-shaped SVG marker that can be dragged along a gradient
 * track. Emits custom events for selection, movement, editing, and deletion.
 *
 * @module se-gradient-stop
 */
import { LitElement, svg, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { hexToRgba } from './ColorModel.js'

const PICKER_D =
  'M-6.2,0.9c3.6-4,6.7-4.3,6.7-12.4c-0.2,7.9,3.1,8.8,6.5,12.4c3.5,3.8,2.9,9.6,0,12.3c-3.1,2.8-10.4,2.7-13.2,0C-9.6,9.9-9.4,4.4-6.2,0.9z'

/** Draggable teardrop marker for a single gradient stop; emits stop-select, stop-move, stop-edit, stop-delete */
@customElement('se-gradient-stop')
export class SeGradientStop extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      top: 0;
      width: 0;
      height: 40px;
      cursor: pointer;
      touch-action: none;
    }
    svg {
      overflow: visible;
      pointer-events: all;
    }
  `

  @property({ type: Number }) accessor offset = 0
  @property({ type: String }) accessor color = '#000000'
  @property({ type: Number }) accessor opacity = 1
  @property({ type: Boolean, reflect: true }) accessor selected = false
  @property({ attribute: 'stop-id' }) accessor stopId = ''

  updated() {
    this.style.left = `${this.offset * 100}%`
  }

  render() {
    const strokeWidth = this.selected ? 2 : 1
    // Parse hex colour (shared helper) and apply this stop's opacity for fill
    const { r, g, b } = hexToRgba(this.color)
    const fill = `rgba(${r},${g},${b},${this.opacity})`

    return svg`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="40"
        viewBox="-9 -14 18 30"
        tabindex="0"
        @pointerdown=${this._onPointerDown}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
        @dblclick=${this._onDblClick}
        @keydown=${this._onKeyDown}
        style="display:block;outline:none"
      >
        <path
          d=${PICKER_D}
          fill=${fill}
          stroke="#000000"
          stroke-width=${strokeWidth}
        />
      </svg>
    `
  }

  private _onPointerDown = (e: PointerEvent) => {
    const svgEl = e.currentTarget as SVGSVGElement
    svgEl.setPointerCapture(e.pointerId)
    e.stopPropagation()
    this.dispatchEvent(new CustomEvent('stop-select', {
      detail: { id: this.stopId },
      bubbles: true,
      composed: true
    }))
  }

  private _onPointerMove = (e: PointerEvent) => {
    if (!e.buttons) return
    const parent = this.parentElement
    if (!parent) return
    const parentRect = parent.getBoundingClientRect()
    const trackWidth = parentRect.width
    if (trackWidth === 0) return
    const rawOffset = (e.clientX - parentRect.left) / trackWidth
    const newOffset = Math.max(0, Math.min(1, rawOffset))
    this.dispatchEvent(new CustomEvent('stop-move', {
      detail: { id: this.stopId, offset: newOffset },
      bubbles: true,
      composed: true
    }))
  }

  private _onPointerUp = (e: PointerEvent) => {
    const svgEl = e.currentTarget as SVGSVGElement
    svgEl.releasePointerCapture(e.pointerId)
  }

  private _onDblClick = (_e: MouseEvent) => {
    this.dispatchEvent(new CustomEvent('stop-edit', {
      detail: { id: this.stopId },
      bubbles: true,
      composed: true
    }))
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      this.dispatchEvent(new CustomEvent('stop-delete', {
        detail: { id: this.stopId },
        bubbles: true,
        composed: true
      }))
    }
  }
}
