import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

/** Pointer-driven 1D/2D color-picker slider; dispatches `sl-change` with normalized x/y values */
@customElement('se-color-slider')
export class SeColorSlider extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      touch-action: none;
      user-select: none;
    }
    .arrow-xy {
      position: absolute;
      width: 11px;
      height: 11px;
      border: 1px solid #000; /* hex-guard-allow: contrast handle — must be absolute black to read over any hue/saturation */
      border-radius: 50%;
      background: transparent;
      box-shadow: 0 0 0 1px #fff inset; /* hex-guard-allow: contrast handle — inner white ring pairs with black border so cursor is visible on any color */
      pointer-events: none;
      transform: translate(-50%, -50%);
    }
    .arrow-y {
      position: absolute;
      left: 0;
      width: 100%;
      height: 0;
      pointer-events: none;
      transform: translateY(-50%);
    }
    .arrow-y::before, .arrow-y::after {
      content: '';
      position: absolute;
      top: -4px;
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
    }
    .arrow-y::before {
      left: -6px;
      border-right: 5px solid #000; /* hex-guard-allow: contrast handle — spectrum bar arrow must be absolute black to read over any hue */
    }
    .arrow-y::after {
      right: -6px;
      border-left: 5px solid #000; /* hex-guard-allow: contrast handle — spectrum bar arrow must be absolute black to read over any hue */
    }
  `

  @property({ type: String }) accessor mode: '2d' | '1d' = '2d'
  @property({ type: Number }) accessor width = 256
  @property({ type: Number }) accessor height = 256
  @property({ type: Number, attribute: 'range-min-x' }) accessor rangeMinX = 0
  @property({ type: Number, attribute: 'range-max-x' }) accessor rangeMaxX = 100
  @property({ type: Number, attribute: 'range-min-y' }) accessor rangeMinY = 0
  @property({ type: Number, attribute: 'range-max-y' }) accessor rangeMaxY = 100

  @state() accessor _x = 0
  @state() accessor _y = 0

  private _dragging = false
  private _rafId = 0
  private _latestEvent: PointerEvent | null = null

  get x() { return this._x }
  set x(v: number) { this._x = v }
  get y() { return this._y }
  set y(v: number) { this._y = v }

  render() {
    const px = this._valueToPxX(this._x)
    const py = this._valueToPxY(this._y)
    return html`
      <div
        style="width:${this.width}px;height:${this.height}px;cursor:${this.mode === '2d' ? 'crosshair' : 'n-resize'}"
        @pointerdown=${this._onPointerDown}
      >
        ${this.mode === '2d'
          ? html`<div class="arrow-xy" style="left:${px}px;top:${py}px"></div>`
          : html`<div class="arrow-y" style="top:${py}px"></div>`
        }
      </div>
    `
  }

  private _onPointerDown = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    this._dragging = true
    this._updateFromPointer(e)
    el.addEventListener('pointermove', this._onPointerMove)
    el.addEventListener('pointerup', this._onPointerUp)
    e.preventDefault()
  }

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._dragging) return
    this._latestEvent = e
    if (this._rafId) return
    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0
      if (this._latestEvent) this._updateFromPointer(this._latestEvent)
    })
  }

  private _onPointerUp = (e: PointerEvent) => {
    this._dragging = false
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = 0 }
    this._updateFromPointer(e) // commit the final (release) position
    this._latestEvent = null
    const el = e.currentTarget as HTMLElement
    el.releasePointerCapture(e.pointerId)
    el.removeEventListener('pointermove', this._onPointerMove)
    el.removeEventListener('pointerup', this._onPointerUp)
  }

  private _updateFromPointer(e: PointerEvent): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Lit guarantees shadowRoot
    const el = this.shadowRoot!.querySelector('div') as HTMLElement
    const rect = el.getBoundingClientRect()
    const px = Math.max(0, Math.min(this.width, e.clientX - rect.left))
    const py = Math.max(0, Math.min(this.height, e.clientY - rect.top))
    this._x = this._pxToValueX(px)
    this._y = this._pxToValueY(py)
    this.dispatchEvent(new CustomEvent('sl-change', {
      detail: { x: this._x, y: this._y },
      bubbles: true,
      composed: true
    }))
  }

  private _valueToPxX(v: number): number {
    return ((v - this.rangeMinX) / (this.rangeMaxX - this.rangeMinX)) * this.width
  }
  private _valueToPxY(v: number): number {
    return ((v - this.rangeMinY) / (this.rangeMaxY - this.rangeMinY)) * this.height
  }
  private _pxToValueX(px: number): number {
    return this.rangeMinX + (px / this.width) * (this.rangeMaxX - this.rangeMinX)
  }
  private _pxToValueY(py: number): number {
    return this.rangeMinY + (py / this.height) * (this.rangeMaxY - this.rangeMinY)
  }
}
