/**
 * @file se-gradient-editor — Full gradient picker built on Lit.
 *
 * Replaces jQuery.jGraduate with a framework-free, Lit-based implementation.
 * Supports solid color, linear gradient, and radial gradient editing with
 * draggable coordinate markers, gradient stop management, and live preview.
 *
 * @module se-gradient-editor
 */
import { LitElement, html, svg, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import SvgCanvas from '@svgedit/svgcanvas'
import type Paint from '@svgedit/svgcanvas/core/paint.js'
import { invertHex, intToHex, type ColorModel } from './ColorModel.js'
import './se-color-picker.js'
import './se-color-slider.js'
import './se-gradient-stop.js'
import { t } from '../../locale.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

interface GradientStop {
  id: string
  offset: number
  color: string   // '#rrggbb'
  opacity: number // 0-1
}

let stopIdCounter = 0
function nextStopId (): string {
  return 'gs_' + String(++stopIdCounter)
}

/** Clamp a number to [min, max]. */
function clamp (v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Full gradient editor supporting solid color, linear, and radial gradients with stop management */
@customElement('se-gradient-editor')
export class SeGradientEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--se-font-sans);
      font-size: var(--se-text-sm);
      background: var(--se-surface);
      border: 1px solid var(--se-border-strong);
      padding: 8px;
      min-width: 350px;
    }
    .tabs {
      list-style: none;
      margin: 0 0 6px;
      padding: 0;
      display: flex;
      gap: 0;
    }
    .tabs li {
      padding: 4px 10px;
      cursor: pointer;
      border: 1px solid var(--se-border);
      border-bottom: none;
      background: var(--se-surface-2);
      font-size: var(--se-text-xs);
      margin-right: -1px;
      user-select: none;
    }
    .tabs li.active {
      background: var(--se-surface);
      font-weight: bold;
      border-bottom: 1px solid var(--se-surface);
      position: relative;
      z-index: 1;
    }
    .grad-container {
      position: relative;
      width: 256px;
      height: 256px;
      border: 1px solid var(--se-border);
      margin-bottom: 6px;
    }
    .grad-container svg {
      display: block;
    }
    .coord-marker {
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid #000; /* hex-guard-allow: contrast handle — coord marker border must be absolute black to read over any gradient color */
      border-radius: 50%;
      background: rgba(255,255,255,0.6); /* hex-guard-allow: contrast handle — semi-transparent white fill makes coord marker readable on any gradient while preserving context */
      cursor: move;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: bold;
      user-select: none;
      touch-action: none;
      z-index: 5;
    }
    .stop-track {
      position: relative;
      height: 40px;
      margin: 4px 0 8px;
      cursor: crosshair;
      border: 1px solid var(--se-border);
      background: var(--se-surface-2);
      width: 256px;
    }
    .coord-section {
      display: flex;
      gap: 16px;
      margin-bottom: 4px;
    }
    .coord-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .coord-group label {
      font-size: var(--se-text-xs);
      font-weight: bold;
    }
    .coord-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .coord-row label {
      font-size: var(--se-text-xs);
      width: 12px;
    }
    .coord-row input[type="text"] {
      width: 40px;
      height: 18px;
      font-size: var(--se-text-xs);
      text-align: right;
      padding: 0 2px;
      border: 1px solid var(--se-border);
    }
    .focal-check {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
      font-size: var(--se-text-xs);
    }
    .focal-check input {
      margin: 0;
    }
    .slider-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .slider-row .slider-label {
      width: 40px;
      font-size: var(--se-text-xs);
      text-align: right;
      flex-shrink: 0;
    }
    .slider-row input[type="text"] {
      width: 36px;
      height: 18px;
      font-size: var(--se-text-xs);
      text-align: right;
      padding: 0 2px;
      border: 1px solid var(--se-border);
    }
    .slider-row .slider-unit {
      font-size: var(--se-text-xs);
      width: 16px;
    }
    .spread-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .spread-row label {
      font-size: var(--se-text-xs);
    }
    .spread-row select {
      font-size: var(--se-text-xs);
      height: 20px;
    }
    .buttons {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .buttons input[type="button"] {
      flex: 1;
      height: 24px;
      font-size: var(--se-text-xs);
      cursor: pointer;
    }
    .color-picker-overlay {
      position: absolute;
      z-index: 100;
      left: 0;
      top: 0;
      background: var(--se-surface);
      border: 1px solid var(--se-border-strong);
      padding: 4px;
    }
  `

  // -- Public properties (set via JS, not attributes) --
  @property() accessor paint: Paint | null = null
  @property() accessor imagesPath = './components/jgraduate/images/'

  // -- Internal state --
  @state() accessor _type: 'solidColor' | 'linearGradient' | 'radialGradient' = 'solidColor'
  @state() accessor _stops: GradientStop[] = []
  @state() accessor _selectedStopId: string | null = null
  @state() accessor _editingStop = false
  @state() accessor _coords = { x1: 0, y1: 0, x2: 1, y2: 0, cx: 0.5, cy: 0.5, fx: 0.5, fy: 0.5 }
  @state() accessor _radius = 100
  @state() accessor _ellipticity = 0
  @state() accessor _angle = 0
  @state() accessor _opacity = 100
  @state() accessor _spreadMethod: 'pad' | 'reflect' | 'repeat' = 'pad'
  @state() accessor _showFocus = false

  private _gradIdSuffix = String(Math.floor(Math.random() * 100000))

  override connectedCallback (): void {
    super.connectedCallback()
    if (this.paint) {
      this._initFromPaint(this.paint)
    }
  }

  private _initFromPaint (p: Paint): void {
    const pType = p.type ?? 'solidColor'
    this._opacity = typeof p.alpha === 'number' ? p.alpha : 100

    if (pType === 'solidColor') {
      this._type = 'solidColor'
      const hex = typeof p.solidColor === 'string' && p.solidColor !== 'none'
        ? p.solidColor
        : 'ffffff'
      const normalHex = hex.startsWith('#') ? hex : '#' + hex
      this._stops = [
        { id: nextStopId(), offset: 0, color: normalHex, opacity: 1 },
        { id: nextStopId(), offset: 1, color: invertHex(normalHex), opacity: 1 }
      ]
    } else if (pType === 'linearGradient' || pType === 'radialGradient') {
      this._type = pType
      const gradEl = p[pType]
      if (gradEl) {
        this._extractStopsFromGradient(gradEl)
        this._extractCoordsFromGradient(gradEl, pType)
      } else {
        this._stops = [
          { id: nextStopId(), offset: 0, color: '#000000', opacity: 1 },
          { id: nextStopId(), offset: 1, color: '#ffffff', opacity: 1 }
        ]
      }
    }
    if (this._stops.length > 0 && !this._selectedStopId) {
      this._selectedStopId = this._stops[0]?.id ?? null
    }
  }

  private _extractStopsFromGradient (gradEl: Element): void {
    const stopEls = gradEl.querySelectorAll('stop')
    const stops: GradientStop[] = []
    stopEls.forEach((s) => {
      const offset = parseFloat(s.getAttribute('offset') ?? '0')
      let color = s.getAttribute('stop-color') ?? '#000000'
      if (!color.startsWith('#')) color = '#000000'
      const opacity = parseFloat(s.getAttribute('stop-opacity') ?? '1')
      stops.push({ id: nextStopId(), offset, color, opacity })
    })
    if (stops.length < 2) {
      while (stops.length < 2) {
        stops.push({ id: nextStopId(), offset: stops.length === 0 ? 0 : 1, color: '#000000', opacity: 1 })
      }
    }
    this._stops = stops
  }

  private _extractCoordsFromGradient (gradEl: Element, gType: 'linearGradient' | 'radialGradient'): void {
    if (gType === 'linearGradient') {
      this._coords = {
        ...this._coords,
        x1: parseFloat(gradEl.getAttribute('x1') ?? '0'),
        y1: parseFloat(gradEl.getAttribute('y1') ?? '0'),
        x2: parseFloat(gradEl.getAttribute('x2') ?? '1'),
        y2: parseFloat(gradEl.getAttribute('y2') ?? '0')
      }
    } else {
      const cx = parseFloat(gradEl.getAttribute('cx') ?? '0.5')
      const cy = parseFloat(gradEl.getAttribute('cy') ?? '0.5')
      const hasFx = gradEl.hasAttribute('fx')
      const fx = parseFloat(gradEl.getAttribute('fx') ?? String(cx))
      const fy = parseFloat(gradEl.getAttribute('fy') ?? String(cy))
      this._showFocus = hasFx && !(cx === fx && cy === fy)
      this._coords = { ...this._coords, cx, cy, fx, fy }

      const r = parseFloat(gradEl.getAttribute('r') ?? '0.5')
      this._radius = Math.round(r / 0.5 * 100)

      this._extractTransform(gradEl)
    }
    const sm = gradEl.getAttribute('spreadMethod')
    if (sm === 'pad' || sm === 'reflect' || sm === 'repeat') {
      this._spreadMethod = sm
    }
  }

  private _extractTransform (gradEl: Element): void {
    const tf = gradEl.getAttribute('gradientTransform')
    if (!tf) return
    // Parse rotate(...) and scale(...)
    const rotateMatch = tf.match(/rotate\(\s*([-\d.]+)/)
    if (rotateMatch?.[1]) {
      this._angle = Math.round(parseFloat(rotateMatch[1]))
    }
    const scaleMatch = tf.match(/scale\(\s*([-\d.]+)\s*,\s*([-\d.]+)/)
    if (scaleMatch?.[1] && scaleMatch[2]) {
      const sx = parseFloat(scaleMatch[1])
      const sy = parseFloat(scaleMatch[2])
      if (sx !== 1) {
        this._ellipticity = Math.round(-(1 - sx) * 100)
      } else if (sy !== 1) {
        this._ellipticity = Math.round((1 - sy) * 100)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected override render () {
    return html`
      <ul class="tabs">
        <li class=${this._type === 'solidColor' ? 'active' : ''} @click=${() => this._setType('solidColor')}>
          ${t('config.jgraduate_solid_color')}
        </li>
        <li class=${this._type === 'linearGradient' ? 'active' : ''} @click=${() => this._setType('linearGradient')}>
          ${t('config.jgraduate_linear_gradient')}
        </li>
        <li class=${this._type === 'radialGradient' ? 'active' : ''} @click=${() => this._setType('radialGradient')}>
          ${t('config.jgraduate_radial_gradient')}
        </li>
      </ul>
      ${this._type === 'solidColor' ? this._renderSolidPicker() : this._renderGradientPicker()}
    `
  }

  private _renderSolidPicker () {
    const stopColor = this._stops[0]?.color ?? '#ff0000'
    const raw = stopColor.startsWith('#') ? stopColor.slice(1) : stopColor
    const alphaHex = intToHex(Math.round(this._opacity / 100 * 255))
    const ahex = raw + alphaHex

    return html`
      <se-color-picker
        .color=${ahex}
        @commit=${this._onSolidCommit}
        @cancel=${this._onCancel}
      ></se-color-picker>
    `
  }

  private _renderGradientPicker () {
    const gradId = 'ge_grad_' + this._gradIdSuffix
    const isRadial = this._type === 'radialGradient'
    const selectedStop = this._stops.find(s => s.id === this._selectedStopId)

    return html`
      <div class="grad-container">
        ${svg`
          <svg width="256" height="256" xmlns="${SVG_NS}">
            <defs>
              ${this._renderGradientDef(gradId)}
            </defs>
            <rect width="256" height="256" fill="url(#${gradId})" fill-opacity="${this._opacity / 100}" />
          </svg>
        `}
        ${this._type === 'linearGradient' ? this._renderLinearMarkers() : this._renderRadialMarkers()}
      </div>

      <div class="stop-track" @click=${this._onTrackClick}>
        ${this._stops.map(s => html`
          <se-gradient-stop
            .offset=${s.offset}
            .color=${s.color}
            .opacity=${s.opacity}
            stop-id=${s.id}
            .selected=${s.id === this._selectedStopId}
            @stop-select=${this._onStopSelect}
            @stop-move=${this._onStopMove}
            @stop-edit=${this._onStopEdit}
            @stop-delete=${this._onStopDelete}
          ></se-gradient-stop>
        `)}
      </div>

      ${this._editingStop && selectedStop
        ? this._renderStopColorPicker(selectedStop)
        : nothing}

      ${this._type === 'linearGradient' ? this._renderLinearCoords() : this._renderRadialCoords()}

      ${isRadial ? html`
        ${this._renderSlider('radius', t('config.jgraduate_radius'), this._radius, 0, 200, '%', t('config.jgraduate_set_radius'))}
        ${this._renderSlider('ellip', t('config.jgraduate_ellip'), this._ellipticity, -100, 100, '%', t('config.jgraduate_set_ellip'))}
        ${this._renderSlider('angle', t('config.jgraduate_angle'), this._angle, -90, 90, t('config.jgraduate_deg'), t('config.jgraduate_set_angle'))}
      ` : nothing}

      ${this._renderSlider('opacity', t('config.jgraduate_opac'), this._opacity, 0, 100, '%', t('config.jgraduate_set_opac'))}

      <div class="spread-row">
        <label>${t('config.jgraduate_spread_method')}</label>
        <select @change=${this._onSpreadChange}>
          <option value="pad" .selected=${this._spreadMethod === 'pad'}>${t('properties.jgraduate_pad')}</option>
          <option value="reflect" .selected=${this._spreadMethod === 'reflect'}>${t('properties.jgraduate_reflect')}</option>
          <option value="repeat" .selected=${this._spreadMethod === 'repeat'}>${t('properties.jgraduate_repeat')}</option>
        </select>
      </div>

      <div class="buttons">
        <input type="button" value="${t('common.ok')}" @click=${this._onOk}>
        <input type="button" value="${t('common.cancel')}" @click=${this._onCancel}>
      </div>
    `
  }

  // ---------------------------------------------------------------------------
  // SVG gradient definition for preview
  // ---------------------------------------------------------------------------

  private _renderGradientDef (gradId: string) {
    const stopsSvg = this._stops.map(s =>
      svg`<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity}" />`
    )
    if (this._type === 'linearGradient') {
      return svg`
        <linearGradient id="${gradId}"
          x1="${this._coords.x1}" y1="${this._coords.y1}"
          x2="${this._coords.x2}" y2="${this._coords.y2}"
          spreadMethod="${this._spreadMethod}">
          ${stopsSvg}
        </linearGradient>
      `
    }
    // radial
    const r = this._radius / 100 * 0.5
    const tfStr = this._buildGradientTransformString()
    return svg`
      <radialGradient id="${gradId}"
        cx="${this._coords.cx}" cy="${this._coords.cy}"
        ${this._showFocus ? svg`fx="${this._coords.fx}" fy="${this._coords.fy}"` : nothing}
        r="${r}"
        spreadMethod="${this._spreadMethod}"
        ${tfStr ? svg`gradientTransform="${tfStr}"` : nothing}>
        ${stopsSvg}
      </radialGradient>
    `
  }

  private _buildGradientTransformString (): string {
    if (this._ellipticity === 0 && this._angle === 0) return ''
    const cx = this._coords.cx
    const cy = this._coords.cy
    let sx = 1
    let sy = 1
    if (this._ellipticity < 0) {
      sx = 1 + this._ellipticity / 100
    } else if (this._ellipticity > 0) {
      sy = 1 - this._ellipticity / 100
    }
    const rot = this._angle !== 0 ? `rotate(${this._angle},${cx},${cy}) ` : ''
    if (sx === 1 && sy === 1) return rot.trim()
    const tx = -cx * (sx - 1)
    const ty = -cy * (sy - 1)
    return `${rot}translate(${tx},${ty}) scale(${sx},${sy})`
  }

  // ---------------------------------------------------------------------------
  // Coordinate markers
  // ---------------------------------------------------------------------------

  private _renderLinearMarkers () {
    const c = this._coords
    return html`
      <div class="coord-marker"
        style="left:${c.x1 * 256}px;top:${c.y1 * 256}px"
        @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'x1', 'y1')}
      >1</div>
      <div class="coord-marker"
        style="left:${c.x2 * 256}px;top:${c.y2 * 256}px"
        @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'x2', 'y2')}
      >2</div>
    `
  }

  private _renderRadialMarkers () {
    const c = this._coords
    return html`
      <div class="coord-marker"
        style="left:${c.cx * 256}px;top:${c.cy * 256}px"
        @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'cx', 'cy')}
      >C</div>
      ${this._showFocus
        ? html`
          <div class="coord-marker"
            style="left:${c.fx * 256}px;top:${c.fy * 256}px"
            @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'fx', 'fy')}
          >F</div>
        `
        : nothing}
    `
  }

  private _startCoordDrag = (e: PointerEvent, xKey: string, yKey: string): void => {
    const marker = e.currentTarget as HTMLElement
    marker.setPointerCapture(e.pointerId)
    const container = marker.parentElement
    if (!container) return

    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const x = clamp((ev.clientX - rect.left) / 256, 0, 1)
      const y = clamp((ev.clientY - rect.top) / 256, 0, 1)
      this._coords = {
        ...this._coords,
        [xKey]: Math.round(x * 1000) / 1000,
        [yKey]: Math.round(y * 1000) / 1000
      }
    }

    const onUp = (ev: PointerEvent) => {
      marker.releasePointerCapture(ev.pointerId)
      marker.removeEventListener('pointermove', onMove)
      marker.removeEventListener('pointerup', onUp)
    }

    marker.addEventListener('pointermove', onMove)
    marker.addEventListener('pointerup', onUp)
    e.preventDefault()
  }

  // ---------------------------------------------------------------------------
  // Coordinate inputs
  // ---------------------------------------------------------------------------

  private _renderLinearCoords () {
    const c = this._coords
    return html`
      <div class="coord-section">
        <div class="coord-group">
          <label>${t('config.jgraduate_begin_point')}</label>
          <div class="coord-row">
            <label>x:</label>
            <input type="text" .value=${String(c.x1)}
              @change=${(e: Event) => this._onCoordInput(e, 'x1')}>
            <label>y:</label>
            <input type="text" .value=${String(c.y1)}
              @change=${(e: Event) => this._onCoordInput(e, 'y1')}>
          </div>
        </div>
        <div class="coord-group">
          <label>${t('config.jgraduate_end_point')}</label>
          <div class="coord-row">
            <label>x:</label>
            <input type="text" .value=${String(c.x2)}
              @change=${(e: Event) => this._onCoordInput(e, 'x2')}>
            <label>y:</label>
            <input type="text" .value=${String(c.y2)}
              @change=${(e: Event) => this._onCoordInput(e, 'y2')}>
          </div>
        </div>
      </div>
    `
  }

  private _renderRadialCoords () {
    const c = this._coords
    return html`
      <div class="coord-section">
        <div class="coord-group">
          <label>${t('config.jgraduate_center_point')}</label>
          <div class="coord-row">
            <label>x:</label>
            <input type="text" .value=${String(c.cx)}
              @change=${(e: Event) => this._onCoordInput(e, 'cx')}>
            <label>y:</label>
            <input type="text" .value=${String(c.cy)}
              @change=${(e: Event) => this._onCoordInput(e, 'cy')}>
          </div>
        </div>
        <div class="coord-group">
          <label>${t('config.jgraduate_focal_point')}</label>
          <div class="focal-check">
            <input type="checkbox" .checked=${!this._showFocus}
              @change=${this._onMatchCenterChange}>
            <span>${t('config.jgraduate_match_center')}</span>
          </div>
          ${this._showFocus
            ? html`
              <div class="coord-row">
                <label>x:</label>
                <input type="text" .value=${String(c.fx)}
                  @change=${(e: Event) => this._onCoordInput(e, 'fx')}>
                <label>y:</label>
                <input type="text" .value=${String(c.fy)}
                  @change=${(e: Event) => this._onCoordInput(e, 'fy')}>
              </div>
            `
            : nothing}
        </div>
      </div>
    `
  }

  private _onCoordInput = (e: Event, key: string): void => {
    const input = e.target as HTMLInputElement
    const val = parseFloat(input.value)
    if (isNaN(val)) {
      const currentVal = (this._coords as Record<string, number>)[key]
      input.value = currentVal !== undefined ? String(currentVal) : '0'
      return
    }
    const clamped = clamp(val, 0, 1)
    this._coords = { ...this._coords, [key]: clamped }
    input.value = String(clamped)
  }

  private _onMatchCenterChange = (e: Event): void => {
    const checked = (e.target as HTMLInputElement).checked
    this._showFocus = !checked
    if (!this._showFocus) {
      this._coords = { ...this._coords, fx: this._coords.cx, fy: this._coords.cy }
    }
  }

  // ---------------------------------------------------------------------------
  // Stop color picker overlay
  // ---------------------------------------------------------------------------

  private _renderStopColorPicker (stop: GradientStop) {
    const raw = stop.color.startsWith('#') ? stop.color.slice(1) : stop.color
    const alphaHex = intToHex(Math.round(stop.opacity * 255))
    const ahex = raw + alphaHex

    return html`
      <div class="color-picker-overlay">
        <se-color-picker
          .color=${ahex}
          @commit=${this._onStopColorCommit}
          @cancel=${this._onStopColorCancel}
        ></se-color-picker>
      </div>
    `
  }

  // ---------------------------------------------------------------------------
  // Sliders
  // ---------------------------------------------------------------------------

  private _renderSlider (type: string, label: string, value: number, min: number, max: number, unit: string, _title: string) {
    const range = max - min
    const norm = range > 0 ? (value - min) / range : 0

    return html`
      <div class="slider-row">
        <span class="slider-label">${label}</span>
        <se-color-slider
          mode="1d"
          width=${145}
          height=${14}
          range-min-x=${0}
          range-max-x=${100}
          range-min-y=${0}
          range-max-y=${100}
          .y=${norm * 100}
          @sl-change=${(e: CustomEvent<{ x: number, y: number }>) => this._onSliderChange(type, e.detail.y, min, max)}
        ></se-color-slider>
        <input type="text" .value=${String(Math.round(value))}
          @change=${(e: Event) => this._onSliderInput(type, e, min, max)}>
        <span class="slider-unit">${unit}</span>
      </div>
    `
  }

  private _onSliderChange = (type: string, yPercent: number, min: number, max: number): void => {
    const range = max - min
    const val = Math.round(min + (yPercent / 100) * range)
    this._applySliderValue(type, val)
  }

  private _onSliderInput = (type: string, e: Event, min: number, max: number): void => {
    const input = e.target as HTMLInputElement
    let val = parseInt(input.value, 10)
    if (isNaN(val)) val = 0
    val = clamp(val, min, max)
    input.value = String(val)
    this._applySliderValue(type, val)
  }

  private _applySliderValue (type: string, val: number): void {
    switch (type) {
      case 'radius':
        this._radius = val
        break
      case 'ellip':
        this._ellipticity = val
        break
      case 'angle':
        this._angle = val
        break
      case 'opacity':
        this._opacity = val
        break
    }
  }

  // ---------------------------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------------------------

  private _setType (type: 'solidColor' | 'linearGradient' | 'radialGradient'): void {
    if (this._type === type) return
    this._type = type
    this._editingStop = false
    if ((type === 'linearGradient' || type === 'radialGradient') && this._stops.length < 2) {
      this._stops = [
        { id: nextStopId(), offset: 0, color: '#000000', opacity: 1 },
        { id: nextStopId(), offset: 1, color: '#ffffff', opacity: 1 }
      ]
      this._selectedStopId = this._stops[0]?.id ?? null
    }
  }

  // ---------------------------------------------------------------------------
  // Stop management
  // ---------------------------------------------------------------------------

  private _onStopSelect = (e: CustomEvent<{ id: string }>): void => {
    this._selectedStopId = e.detail.id
  }

  private _onStopMove = (e: CustomEvent<{ id: string, offset: number }>): void => {
    const { id, offset } = e.detail
    const updated = this._stops.map(s =>
      s.id === id ? { ...s, offset: clamp(offset, 0, 1) } : s
    )
    updated.sort((a, b) => a.offset - b.offset)
    this._stops = updated
  }

  private _onStopEdit = (): void => {
    this._editingStop = true
  }

  private _onStopDelete = (e: CustomEvent<{ id: string }>): void => {
    if (this._stops.length <= 2) return
    const filtered = this._stops.filter(s => s.id !== e.detail.id)
    this._stops = filtered
    if (this._selectedStopId === e.detail.id) {
      this._selectedStopId = filtered[0]?.id ?? null
    }
  }

  private _onTrackClick = (e: MouseEvent): void => {
    const track = e.currentTarget as HTMLElement
    if (e.target !== track) return
    const rect = track.getBoundingClientRect()
    const offset = clamp((e.clientX - rect.left) / rect.width, 0, 1)

    // Find nearest stop and create inverse color
    let nearest = this._stops[0]
    let minDist = Math.abs((nearest?.offset ?? 0) - offset)
    for (const s of this._stops) {
      const dist = Math.abs(s.offset - offset)
      if (dist < minDist) {
        minDist = dist
        nearest = s
      }
    }
    const newColor = nearest ? invertHex(nearest.color) : '#808080'
    const newStop: GradientStop = {
      id: nextStopId(),
      offset,
      color: newColor,
      opacity: 1
    }
    const stops = [...this._stops, newStop]
    stops.sort((a, b) => a.offset - b.offset)
    this._stops = stops
    this._selectedStopId = newStop.id
  }

  // ---------------------------------------------------------------------------
  // Stop color editing
  // ---------------------------------------------------------------------------

  private _onStopColorCommit = (e: CustomEvent<{ color: ColorModel }>): void => {
    const colorModel = e.detail.color
    if (!this._selectedStopId) return
    const hex = '#' + colorModel.hex
    const opacity = colorModel.a / 255
    this._stops = this._stops.map(s =>
      s.id === this._selectedStopId ? { ...s, color: hex, opacity } : s
    )
    this._editingStop = false
  }

  private _onStopColorCancel = (): void => {
    this._editingStop = false
  }

  // ---------------------------------------------------------------------------
  // Spread method
  // ---------------------------------------------------------------------------

  private _onSpreadChange = (e: Event): void => {
    const val = (e.target as HTMLSelectElement).value
    if (val === 'pad' || val === 'reflect' || val === 'repeat') {
      this._spreadMethod = val
    }
  }

  // ---------------------------------------------------------------------------
  // Solid color commit
  // ---------------------------------------------------------------------------

  private _onSolidCommit = (e: CustomEvent<{ color: ColorModel }>): void => {
    const colorModel = e.detail.color
    const hex: string = colorModel.hex ?? 'ffffff'
    const alpha: number = Math.round((colorModel.a / 255) * 100)

    const paint = new SvgCanvas.Paint({ solidColor: hex })
    paint.alpha = alpha
    this.dispatchEvent(new CustomEvent('ok', {
      detail: { paint },
      bubbles: true,
      composed: true
    }))
  }

  // ---------------------------------------------------------------------------
  // Ok / Cancel
  // ---------------------------------------------------------------------------

  private _onOk = (): void => {
    const paint = this._buildPaint()
    this.dispatchEvent(new CustomEvent('ok', {
      detail: { paint },
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

  private _buildPaint (): Paint {
    if (this._type === 'solidColor') {
      const stop = this._stops[0]
      const hex = stop ? stop.color.replace('#', '') : 'ffffff'
      const paint = new SvgCanvas.Paint({ solidColor: hex })
      paint.alpha = this._opacity
      return paint
    }

    const gradTag = this._type === 'linearGradient' ? 'linearGradient' : 'radialGradient'
    const gradEl = document.createElementNS(SVG_NS, gradTag)

    if (this._type === 'linearGradient') {
      gradEl.setAttribute('x1', String(this._coords.x1))
      gradEl.setAttribute('y1', String(this._coords.y1))
      gradEl.setAttribute('x2', String(this._coords.x2))
      gradEl.setAttribute('y2', String(this._coords.y2))
    } else {
      gradEl.setAttribute('cx', String(this._coords.cx))
      gradEl.setAttribute('cy', String(this._coords.cy))
      if (this._showFocus) {
        gradEl.setAttribute('fx', String(this._coords.fx))
        gradEl.setAttribute('fy', String(this._coords.fy))
      }
      gradEl.setAttribute('r', String(this._radius / 100 * 0.5))
      const tfStr = this._buildGradientTransformString()
      if (tfStr) {
        gradEl.setAttribute('gradientTransform', tfStr)
      }
    }

    gradEl.setAttribute('spreadMethod', this._spreadMethod)

    for (const s of this._stops) {
      const stopEl = document.createElementNS(SVG_NS, 'stop')
      stopEl.setAttribute('offset', String(s.offset))
      stopEl.setAttribute('stop-color', s.color)
      stopEl.setAttribute('stop-opacity', String(s.opacity))
      gradEl.appendChild(stopEl)
    }

    const paint = gradTag === 'linearGradient'
      ? new SvgCanvas.Paint({ linearGradient: gradEl as SVGLinearGradientElement })
      : new SvgCanvas.Paint({ radialGradient: gradEl as SVGRadialGradientElement })
    paint.alpha = this._opacity
    return paint
  }
}
