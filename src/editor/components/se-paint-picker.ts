/**
 * @file se-paint-picker — Lit-based replacement for the legacy seColorPicker.
 *
 * Registered as `<se-colorpicker>` (same tag name) for zero consumer churn.
 * Opens an `<se-gradient-editor>` popup to edit solid/linear/radial paints.
 *
 * @module se-paint-picker
 */
import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import PaintBox from './PaintBox.js'
import type { ISvgCanvas } from '@svgedit/svgcanvas'
import type Paint from '@svgedit/svgcanvas/core/paint.js'
import './jgraduate/se-gradient-editor.js'
import { t } from '../locale.js'
import { getSvgEditor } from '../svgEditorInstance.js'

/** `<se-colorpicker>` — paint picker button that opens a gradient editor popup for fill/stroke selection. */
@customElement('se-colorpicker')
export class SePaintPicker extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }
    #picker {
      background: var(--input-color);
      height: 23px;
      line-height: 23px;
      border-radius: 3px;
      width: 52px;
      display: flex;
      align-items: center;
      margin-right: 4px;
      margin-top: 1px;
      justify-content: space-evenly;
      cursor: pointer;
    }
    #logo {
      height: 18px;
      width: 18px;
    }
    .se-icon {
      background-color: var(--se-icon);
      -webkit-mask-position: center; mask-position: center;
      -webkit-mask-size: contain; mask-size: contain;
      -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    }
    #block {
      height: 17px;
      width: 14px;
      float: right;
      background-color: darkgrey;
    }
    #color_picker {
      z-index: 1000;
      position: absolute;
      bottom: 0;
    }
  `

  @property() accessor label = ''
  @property() accessor type: 'fill' | 'stroke' = 'fill'
  @property() accessor src = ''

  @state() accessor _open = false
  @state() accessor _paint: Paint | null = null

  private _paintBox: PaintBox | null = null
  private _imgPath = ''

  override connectedCallback (): void {
    super.connectedCallback()
    this._imgPath = getSvgEditor().configObj.curConfig.imgPath
  }

  override firstUpdated (): void {
    const block = this.renderRoot.querySelector('#block') as HTMLElement
    if (block) {
      this._paintBox = new PaintBox(block, this.type)
    }
  }

  /**
   * Initialise with i18next instance (called by BottomPanel.init).
   * The gradient editor uses t() directly; this method exists for API compat.
   */
  init (_i18next: unknown): void {
    // no-op: se-gradient-editor uses t() directly from locale.js
  }

  /**
   * Update paint from current canvas selection (called by BottomPanel.updateColorpickers).
   */
  updatePaint (svgCanvas: ISvgCanvas, selectedElement: Element | null, apply?: boolean): void {
    if (!this._paintBox) return
    const paint = this._paintBox.update(svgCanvas, selectedElement)

    // If the editor popup is already open, re-init with the new paint
    if (this._open && paint) {
      this._paint = paint
    }

    if (paint && apply) {
      this._paint = paint
      this.dispatchEvent(new CustomEvent('change', {
        detail: { paint },
        bubbles: true,
        composed: true
      }))
    }
  }

  /**
   * Directly set paint (called by palette handler in BottomPanel).
   */
  setPaint (paint: Paint): void {
    this._paint = paint
    this._paintBox?.setPaint(paint)
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _onTriggerClick = (): void => {
    // Read current paint from paintBox before opening editor
    if (this._paintBox?.paint) {
      this._paint = this._paintBox.paint
    }
    this._open = true
  }

  private _onOk = (e: CustomEvent<{ paint: Paint }>): void => {
    const { paint } = e.detail
    this._paint = paint
    this._paintBox?.setPaint(paint)
    this._open = false
    this.dispatchEvent(new CustomEvent('change', {
      detail: { paint },
      bubbles: true,
      composed: true
    }))
  }

  private _onCancel = (): void => {
    this._open = false
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected override render () {
    const imgSrc = this._imgPath ? `${this._imgPath}/${this.src}` : this.src

    return html`
      <div id="picker" @click=${this._onTriggerClick} title=${t(this.label)}>
        <span id="logo" class="se-icon" role="img" aria-label="icon" style=${`-webkit-mask-image:url("${imgSrc}");mask-image:url("${imgSrc}")`}></span>
        <label title=${t('config.pick_paint_opavity')}></label>
        <div id="block"></div>
      </div>
      ${this._open
        ? html`
          <div id="color_picker">
            <se-gradient-editor
              .paint=${this._paint}
              @ok=${this._onOk}
              @cancel=${this._onCancel}
            ></se-gradient-editor>
          </div>
        `
        : nothing}
    `
  }
}
