/**
 * @file se-color-picker — Photoshop-style color picker built on Lit + Canvas 2D.
 *
 * Replaces jQuery.jPicker with a framework-free, dependency-light implementation.
 * Renders a 256x256 gradient map + 20x256 spectrum bar via ImageData writes,
 * coordinated by an owned ColorModel instance.
 *
 * @module se-color-picker
 */
import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ColorModel, hsvToRgb, type ColorChannel, type ColorChangeDetail } from './ColorModel.js'
import type { SeColorSlider } from './se-color-slider.js'
import { t } from '../../locale.js'

type PickerMode = 'h' | 's' | 'v' | 'r' | 'g' | 'b' | 'a'

/**
 * Pack the BAR's fixed channel(s) into a single change-detection key:
 * a number that changes iff the relevant channel value(s) change.
 *
 * @param ch - Fixed-channel id from `_getBarFixedChannel`.
 * @param m  - Current color values.
 */
export function packBarKey (ch: string, m: { r: number, g: number, b: number, h: number, s: number, v: number, a: number }): number {
  switch (ch) {
    case 'h': return m.h
    case 's': return m.s
    case 'v': return m.v
    case 'r': return m.r
    case 'g': return m.g
    case 'b': return m.b
    case 'a': return m.a
    case 'h+v': return m.h * 1000 + m.v
    case 'h+s': return m.h * 1000 + m.s
    case 'g+b': return m.g * 1000 + m.b
    case 'r+b': return m.r * 1000 + m.b
    case 'r+g': return m.r * 1000 + m.g
    // 1e6 stride on r: g's band reaches 255*1000 = 255000, so a 1e5 stride collides
    case 'rgb': return m.r * 1000000 + m.g * 1000 + m.b
    case '_static': return 0
    default: return 0
  }
}

/** Photoshop-style HSV/RGB/alpha color picker rendered with Canvas 2D; dispatches `commit`, `cancel`, and `live` events */
@customElement('se-color-picker')
export class SeColorPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--se-font-sans);
      font-size: var(--se-text-sm);
      background: var(--se-surface);
      border: 1px solid var(--se-border-strong);
      padding: 5px;
    }
    .layout {
      display: flex;
      flex-direction: row;
      gap: 8px;
    }
    .map-wrap {
      position: relative;
      width: 260px;
      height: 260px;
      border: 1px solid var(--se-border);
      flex-shrink: 0;
    }
    .map-wrap canvas {
      position: absolute;
      top: 2px;
      left: 2px;
    }
    .map-wrap se-color-slider {
      position: absolute;
      top: 2px;
      left: 2px;
    }
    .bar-wrap {
      position: relative;
      width: 24px;
      height: 260px;
      border: 1px solid var(--se-border);
      flex-shrink: 0;
    }
    .bar-wrap canvas {
      position: absolute;
      top: 2px;
      left: 2px;
    }
    .bar-wrap se-color-slider {
      position: absolute;
      top: 2px;
      left: 2px;
    }
    .right-panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .preview-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .preview-box {
      width: 60px;
      height: 30px;
      border: 1px solid var(--se-border-strong);
      position: relative;
      background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px; /* hex-guard-allow: alpha checkerboard — neutral grey/white tiles must not use tokens so any semitransparent color shows through correctly */
    }
    .preview-box .swatch {
      position: absolute;
      inset: 0;
    }
    .preview-label {
      font-size: 10px;
      color: var(--se-text-muted);
      text-align: center;
    }
    .channel-group {
      display: grid;
      grid-template-columns: auto auto 40px;
      gap: 2px 4px;
      align-items: center;
    }
    .channel-group input[type="radio"] {
      width: 12px;
      height: 12px;
      margin: 0;
    }
    .channel-group label {
      font-size: var(--se-text-xs);
      cursor: pointer;
    }
    .channel-group input[type="text"] {
      width: 36px;
      height: 18px;
      font-size: var(--se-text-xs);
      text-align: right;
      padding: 0 2px;
      border: 1px solid var(--se-border);
    }
    .hex-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }
    .hex-row label {
      font-size: var(--se-text-xs);
    }
    .hex-row input {
      width: 60px;
      height: 18px;
      font-size: var(--se-text-xs);
      padding: 0 2px;
      border: 1px solid var(--se-border);
    }
    .buttons {
      display: flex;
      gap: 4px;
      margin-top: auto;
    }
    .buttons button {
      flex: 1;
      height: 24px;
      font-size: var(--se-text-xs);
      cursor: pointer;
    }
  `

  @property({ type: String }) accessor color = 'ff0000ff'
  @property({ type: Boolean, attribute: 'alpha-support' }) accessor alphaSupport = true
  @property({ type: String }) accessor mode: PickerMode = 'h'

  @state() accessor _mode: PickerMode = 'h'
  @state() accessor _renderTick = 0

  private _active = new ColorModel('ff0000ff')
  private _original = new ColorModel('ff0000ff')
  private _mapCanvas: HTMLCanvasElement | null = null
  private _barCanvas: HTMLCanvasElement | null = null
  private _mapCtx: CanvasRenderingContext2D | null = null
  private _barCtx: CanvasRenderingContext2D | null = null
  private _mapRafPending = false
  private _barRafPending = false
  private _lastBarChannel: string = ''
  private _lastBarValue: number = -1
  private _lastMapChannel: string = ''
  private _lastMapValue: number = -1

  connectedCallback (): void {
    super.connectedCallback()
    this._active = new ColorModel(this.color)
    this._original = new ColorModel(this.color)
    this._mode = this.mode
    this._active.addEventListener('change', this._onModelChange)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this._active.removeEventListener('change', this._onModelChange)
  }

  protected firstUpdated (): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Lit guarantees shadowRoot after firstUpdated
    const root = this.shadowRoot!
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- querySelector returns Element, we need HTMLCanvasElement
    this._mapCanvas = root.querySelector('#map-canvas') as HTMLCanvasElement
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- querySelector returns Element, we need HTMLCanvasElement
    this._barCanvas = root.querySelector('#bar-canvas') as HTMLCanvasElement
    const mapCtx = this._mapCanvas.getContext('2d')
    const barCtx = this._barCanvas.getContext('2d')
    if (mapCtx) this._mapCtx = mapCtx
    if (barCtx) this._barCtx = barCtx
    this._scheduleMapRender()
    this._scheduleBarRender()
    this._syncSliderPositions()
  }

  protected updated (changed: Map<string, unknown>): void {
    if (changed.has('color')) {
      this._active.setAhex(this.color)
      this._original.setAhex(this.color)
    }
    if (changed.has('mode')) {
      this._mode = this.mode
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render () {
    const m = this._active
    // force re-render reactivity
    void this._renderTick

    return html`
      <div class="layout">
        <div class="map-wrap">
          <canvas id="map-canvas" width="256" height="256"></canvas>
          <se-color-slider
            id="map-slider"
            mode="2d"
            width=${256}
            height=${256}
            range-min-x=${0}
            range-max-x=${100}
            range-min-y=${0}
            range-max-y=${100}
            @sl-change=${this._onMapSliderChange}
          ></se-color-slider>
        </div>
        <div class="bar-wrap">
          <canvas id="bar-canvas" width="20" height="256"></canvas>
          <se-color-slider
            id="bar-slider"
            mode="1d"
            width=${20}
            height=${256}
            range-min-x=${0}
            range-max-x=${100}
            range-min-y=${0}
            range-max-y=${100}
            @sl-change=${this._onBarSliderChange}
          ></se-color-slider>
        </div>
        <div class="right-panel">
          <div class="preview-section">
            <span class="preview-label">${t('config.jpicker_new_color')}</span>
            <div class="preview-box">
              <div class="swatch" style="background:${m.cssColor}"></div>
            </div>
            <div class="preview-box">
              <div class="swatch" style="background:${this._original.cssColor}"></div>
            </div>
            <span class="preview-label">${t('config.jpicker_current_color')}</span>
          </div>

          <div class="channel-group">
            ${this._renderRadio('h', 'H:', m.h, 0, 360)}
            ${this._renderRadio('s', 'S:', m.s, 0, 100)}
            ${this._renderRadio('v', 'V:', m.v, 0, 100)}
            ${this._renderRadio('r', 'R:', m.r, 0, 255)}
            ${this._renderRadio('g', 'G:', m.g, 0, 255)}
            ${this._renderRadio('b', 'B:', m.b, 0, 255)}
            ${this.alphaSupport ? this._renderRadio('a', 'A:', m.a, 0, 255) : nothing}
          </div>

          <div class="hex-row">
            <label>Hex:</label>
            <input
              type="text"
              id="hex-input"
              .value=${m.hex}
              @keydown=${this._onHexKeydown}
              @blur=${this._onHexBlur}
            >
          </div>

          <div class="buttons">
            <button @click=${this._onOk}>${t('common.ok')}</button>
            <button @click=${this._onCancel}>${t('common.cancel')}</button>
          </div>
        </div>
      </div>
    `
  }

  private _renderRadio (ch: PickerMode, label: string, value: number, _min: number, _max: number) {
    return html`
      <input
        type="radio"
        name="mode"
        .checked=${this._mode === ch}
        @change=${() => this._setMode(ch)}
      >
      <label @click=${() => this._setMode(ch)}>${label}</label>
      <input
        type="text"
        .value=${String(value)}
        data-channel=${ch}
        @keydown=${this._onChannelKeydown}
        @blur=${this._onChannelBlur}
      >
    `
  }

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------

  private _setMode (m: PickerMode): void {
    if (this._mode === m) return
    this._mode = m
    this._forceMapRender()
    this._forceBarRender()
    this._syncSliderPositions()
  }

  // ---------------------------------------------------------------------------
  // Model change handler
  // ---------------------------------------------------------------------------

  private _onModelChange = (e: Event): void => {
    const detail = (e as CustomEvent<ColorChangeDetail>).detail
    this._renderTick++

    // Smart re-render: only re-draw canvases if the fixed channel for the current mode changed
    const fixedChannel = this._getFixedChannelForMode()
    const fixedValue = this._getChannelValue(fixedChannel)

    if (detail.source !== 'map') {
      if (this._lastMapChannel !== fixedChannel || this._lastMapValue !== fixedValue) {
        this._scheduleMapRender()
      }
    }

    if (detail.source !== 'bar') {
      const barFixedChannel = this._getBarFixedChannel()
      const barFixedValue = this._getChannelValue(barFixedChannel)
      if (this._lastBarChannel !== barFixedChannel || this._lastBarValue !== barFixedValue) {
        this._scheduleBarRender()
      }
    }

    if (detail.source !== 'slider') {
      this._syncSliderPositions()
    }

    // Emit live event
    this.dispatchEvent(new CustomEvent('live', {
      detail: { color: this._active },
      bubbles: true,
      composed: true
    }))
  }

  // ---------------------------------------------------------------------------
  // Slider events
  // ---------------------------------------------------------------------------

  private _onMapSliderChange = (e: CustomEvent<{ x: number, y: number }>): void => {
    const { x, y } = e.detail
    const nx = x / 100
    const ny = y / 100
    const m = this._active

    switch (this._mode) {
      case 'h': m.setHsv(m.h, nx * 100, (1 - ny) * 100, 'slider'); break
      case 's': m.setHsv(nx * 360, m.s, (1 - ny) * 100, 'slider'); break
      case 'v': m.setHsv(nx * 360, (1 - ny) * 100, m.v, 'slider'); break
      case 'r': m.setRgb(m.r, Math.round((1 - ny) * 255), Math.round(nx * 255), 'slider'); break
      case 'g': m.setRgb(Math.round((1 - ny) * 255), m.g, Math.round(nx * 255), 'slider'); break
      case 'b': m.setRgb(Math.round(nx * 255), Math.round((1 - ny) * 255), m.b, 'slider'); break
      case 'a': m.setHsv(m.h, nx * 100, (1 - ny) * 100, 'slider'); break
    }
  }

  private _onBarSliderChange = (e: CustomEvent<{ x: number, y: number }>): void => {
    const ny = e.detail.y / 100
    const m = this._active

    switch (this._mode) {
      case 'h': m.set('h', ny * 360, 'bar'); break
      case 's': m.set('s', (1 - ny) * 100, 'bar'); break
      case 'v': m.set('v', (1 - ny) * 100, 'bar'); break
      case 'r': m.set('r', (1 - ny) * 255, 'bar'); break
      case 'g': m.set('g', (1 - ny) * 255, 'bar'); break
      case 'b': m.set('b', (1 - ny) * 255, 'bar'); break
      case 'a': m.set('a', (1 - ny) * 255, 'bar'); break
    }
  }

  private _syncSliderPositions (): void {
    const mapSlider = this.shadowRoot?.querySelector('#map-slider') as SeColorSlider | null
    const barSlider = this.shadowRoot?.querySelector('#bar-slider') as SeColorSlider | null
    if (!mapSlider || !barSlider) return

    const m = this._active
    let mx: number, my: number, by: number

    switch (this._mode) {
      case 'h': mx = m.s; my = 100 - m.v; by = m.h / 360 * 100; break
      case 's': mx = m.h / 360 * 100; my = 100 - m.v; by = (1 - m.s / 100) * 100; break
      case 'v': mx = m.h / 360 * 100; my = (1 - m.s / 100) * 100; by = (1 - m.v / 100) * 100; break
      case 'r': mx = m.b / 255 * 100; my = (1 - m.g / 255) * 100; by = (1 - m.r / 255) * 100; break
      case 'g': mx = m.b / 255 * 100; my = (1 - m.r / 255) * 100; by = (1 - m.g / 255) * 100; break
      case 'b': mx = m.r / 255 * 100; my = (1 - m.g / 255) * 100; by = (1 - m.b / 255) * 100; break
      case 'a': mx = m.s; my = 100 - m.v; by = (1 - m.a / 255) * 100; break
      default: mx = 0; my = 0; by = 0
    }

    mapSlider.x = mx
    mapSlider.y = my
    barSlider.y = by
  }

  // ---------------------------------------------------------------------------
  // Canvas rendering
  // ---------------------------------------------------------------------------

  private _scheduleMapRender (): void {
    if (this._mapRafPending) return
    this._mapRafPending = true
    requestAnimationFrame(() => {
      this._mapRafPending = false
      this._renderMap()
    })
  }

  private _scheduleBarRender (): void {
    if (this._barRafPending) return
    this._barRafPending = true
    requestAnimationFrame(() => {
      this._barRafPending = false
      this._renderBar()
    })
  }

  private _forceMapRender (): void {
    this._lastMapChannel = ''
    this._lastMapValue = -1
    this._scheduleMapRender()
  }

  private _forceBarRender (): void {
    this._lastBarChannel = ''
    this._lastBarValue = -1
    this._scheduleBarRender()
  }

  private _renderMap (): void {
    if (!this._mapCtx) return
    const ctx = this._mapCtx
    const imgData = ctx.createImageData(256, 256)
    const data = imgData.data
    const m = this._active
    const mode = this._mode

    const fixedCh = this._getFixedChannelForMode()
    const fixedVal = this._getChannelValue(fixedCh)
    this._lastMapChannel = fixedCh
    this._lastMapValue = fixedVal

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const idx = (y * 256 + x) * 4
        let r: number, g: number, b: number

        switch (mode) {
          case 'h': {
            const rgb = hsvToRgb(m.h, x / 255 * 100, (1 - y / 255) * 100)
            r = rgb[0]; g = rgb[1]; b = rgb[2]
            break
          }
          case 's': {
            const rgb = hsvToRgb(x / 255 * 360, m.s, (1 - y / 255) * 100)
            r = rgb[0]; g = rgb[1]; b = rgb[2]
            break
          }
          case 'v': {
            const rgb = hsvToRgb(x / 255 * 360, (1 - y / 255) * 100, m.v)
            r = rgb[0]; g = rgb[1]; b = rgb[2]
            break
          }
          case 'r': {
            r = m.r
            g = (1 - y / 255) * 255
            b = x / 255 * 255
            break
          }
          case 'g': {
            r = (1 - y / 255) * 255
            g = m.g
            b = x / 255 * 255
            break
          }
          case 'b': {
            r = x / 255 * 255
            g = (1 - y / 255) * 255
            b = m.b
            break
          }
          case 'a': {
            const rgb = hsvToRgb(m.h, x / 255 * 100, (1 - y / 255) * 100)
            r = rgb[0]; g = rgb[1]; b = rgb[2]
            break
          }
          default:
            r = 0; g = 0; b = 0
        }

        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }

  private _renderBar (): void {
    if (!this._barCtx) return
    const ctx = this._barCtx
    const imgData = ctx.createImageData(20, 256)
    const data = imgData.data
    const m = this._active
    const mode = this._mode

    const barFixedCh = this._getBarFixedChannel()
    const barFixedVal = this._getChannelValue(barFixedCh)
    this._lastBarChannel = barFixedCh
    this._lastBarValue = barFixedVal

    for (let y = 0; y < 256; y++) {
      let r: number, g: number, b: number, a: number = 255

      switch (mode) {
        case 'h': {
          const rgb = hsvToRgb(y / 255 * 360, 100, 100)
          r = rgb[0]; g = rgb[1]; b = rgb[2]
          break
        }
        case 's': {
          const rgb = hsvToRgb(m.h, (1 - y / 255) * 100, m.v)
          r = rgb[0]; g = rgb[1]; b = rgb[2]
          break
        }
        case 'v': {
          const rgb = hsvToRgb(m.h, m.s, (1 - y / 255) * 100)
          r = rgb[0]; g = rgb[1]; b = rgb[2]
          break
        }
        case 'r': {
          r = (1 - y / 255) * 255
          g = m.g; b = m.b
          break
        }
        case 'g': {
          r = m.r
          g = (1 - y / 255) * 255
          b = m.b
          break
        }
        case 'b': {
          r = m.r; g = m.g
          b = (1 - y / 255) * 255
          break
        }
        case 'a': {
          r = m.r; g = m.g; b = m.b
          a = (1 - y / 255) * 255
          break
        }
        default:
          r = 0; g = 0; b = 0
      }

      // Fill all 20 pixels in this row
      for (let x = 0; x < 20; x++) {
        const idx = (y * 20 + x) * 4
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = a
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }

  // ---------------------------------------------------------------------------
  // Helpers for smart re-render gating
  // ---------------------------------------------------------------------------

  /** The fixed channel driving the MAP for the current mode. */
  private _getFixedChannelForMode (): string {
    switch (this._mode) {
      case 'h': return 'h'
      case 's': return 's'
      case 'v': return 'v'
      case 'r': return 'r'
      case 'g': return 'g'
      case 'b': return 'b'
      case 'a': return 'h'
    }
  }

  /** The fixed channel(s) driving the BAR for the current mode. */
  private _getBarFixedChannel (): string {
    switch (this._mode) {
      case 'h': return '_static'  // bar is pure hue spectrum, never changes
      case 's': return 'h+v'
      case 'v': return 'h+s'
      case 'r': return 'g+b'
      case 'g': return 'r+b'
      case 'b': return 'r+g'
      case 'a': return 'rgb'
    }
  }

  private _getChannelValue (ch: string): number {
    return packBarKey(ch, this._active)
  }

  // ---------------------------------------------------------------------------
  // Text input handlers
  // ---------------------------------------------------------------------------

  private _onChannelKeydown = (e: KeyboardEvent): void => {
    const input = e.target as HTMLInputElement
    const ch = input.dataset.channel as ColorChannel
    if (!ch) return

    if (e.key === 'Enter') {
      this._applyChannelInput(input, ch)
      e.preventDefault()
      return
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const current = parseInt(input.value, 10)
      if (isNaN(current)) return
      const delta = e.key === 'ArrowUp' ? 1 : -1
      const next = current + delta
      this._active.set(ch, next, 'input')
      input.value = String(this._getActiveChannel(ch))
      e.preventDefault()
    }
  }

  private _onChannelBlur = (e: FocusEvent): void => {
    const input = e.target as HTMLInputElement
    const ch = input.dataset.channel as ColorChannel
    if (!ch) return
    this._applyChannelInput(input, ch)
  }

  private _applyChannelInput (input: HTMLInputElement, ch: ColorChannel): void {
    const val = parseInt(input.value, 10)
    if (isNaN(val)) {
      input.value = String(this._getActiveChannel(ch))
      return
    }
    this._active.set(ch, val, 'input')
    input.value = String(this._getActiveChannel(ch))
  }

  private _onHexKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      this._applyHexInput()
      e.preventDefault()
    }
  }

  private _onHexBlur = (): void => {
    this._applyHexInput()
  }

  private _applyHexInput (): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Lit guarantees shadowRoot
    const input = this.shadowRoot!.querySelector('#hex-input') as HTMLInputElement
    if (!input) return
    const hex = input.value.trim()
    if (hex.length >= 6) {
      this._active.setHex(hex, 'input')
    }
    input.value = this._active.hex
  }

  private _getActiveChannel (ch: ColorChannel): number {
    switch (ch) {
      case 'r': return this._active.r
      case 'g': return this._active.g
      case 'b': return this._active.b
      case 'h': return this._active.h
      case 's': return this._active.s
      case 'v': return this._active.v
      case 'a': return this._active.a
    }
  }

  // ---------------------------------------------------------------------------
  // Button handlers
  // ---------------------------------------------------------------------------

  private _onOk = (): void => {
    this.dispatchEvent(new CustomEvent('commit', {
      detail: { color: this._active },
      bubbles: true,
      composed: true
    }))
  }

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent('cancel', {
      bubbles: true,
      composed: true
    }))
  }
}
