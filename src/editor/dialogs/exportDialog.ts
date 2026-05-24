import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import SvgCanvas from '@svgedit/svgcanvas'

const { $id } = SvgCanvas

/**
 * SeExportDialog — export-format picker dialog.
 *
 * Migrated from elix-dialog wrapper + HTML string template to Lit 3 LitElement
 * with native HTML5 `<dialog>` per PR-3c Task 1 (pilot).
 *
 * External API preserved:
 *   - Tag: `se-export-dialog`
 *   - Class: `SeExportDialog`
 *   - `init(i18next): void` — sets i18n text + resets value to 100
 *   - `dialog` attribute: 'open' -> showModal(), else -> close()
 *   - `value: number` property — quality (0-100)
 *   - Dispatches `CustomEvent('change', { detail: { trigger, imgType, quality } })`
 */
@customElement('se-export-dialog')
export class SeExportDialog extends LitElement {
  static styles = css`
    #dialog_content {
      margin: 10px 10px 5px 10px;
      background: #5a6162;
      overflow: auto;
      border: 1px solid #c8c8c8;
    }

    #dialog_content p,
    #dialog_content select,
    #dialog_content label {
      margin: 10px;
      line-height: 0.3em;
      color: #fff;
    }

    dialog {
      padding: 0;
      font-family: Verdana, Helvetica, sans-serif;
      text-align: center;
      max-width: 400px;
      background: #5a6162;
      border: 1px outset #777;
      font-size: 0.8em;
      border-radius: 5px;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.3);
    }

    #dialog_content {
      border-radius: 5px;
    }

    #dialog_buttons input[type=text] {
      width: 90%;
      display: block;
      margin: 0 0 5px 11px;
    }

    #dialog_buttons input[type=button] {
      margin: 0 1em;
    }

    .se-select {
      text-align: center;
    }
  `

  @property({ reflect: true }) accessor dialog = ''

  @state() accessor _okText = ''
  @state() accessor _cancelText = ''
  @state() accessor _exportLabel = ''
  @state() accessor _showQuality = true

  value = 100

  init (i18next: { t: (key: string) => string }): void {
    this._okText = i18next.t('common.ok')
    this._cancelText = i18next.t('common.cancel')
    this._exportLabel = i18next.t('ui.export_type_label')
    this.value = 100
  }

  protected override updated (changed: Map<string, unknown>): void {
    if (changed.has('dialog')) {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (this.dialog === 'open') {
        if (dlg && !dlg.open) dlg.showModal()
      } else {
        if (dlg?.open) dlg.close()
      }
    }
  }

  private _onOk = (): void => {
    const selectEl = this.shadowRoot?.querySelector('#se-storage-pref') as HTMLElement & { value: string } | null
    const triggerEvent = new CustomEvent('change', {
      detail: {
        trigger: 'ok',
        imgType: selectEl?.value ?? 'PNG',
        quality: this.value
      }
    })
    this.dispatchEvent(triggerEvent)
    $id('se-export-dialog')?.setAttribute('dialog', 'close')
  }

  private _onCancel = (): void => {
    $id('se-export-dialog')?.setAttribute('dialog', 'close')
  }

  private _onQualityChange = (e: Event): void => {
    const target = e.target as HTMLElement & { value: string }
    this.value = Number(target.value)
  }

  private _onFormatChange = (e: Event): void => {
    const target = e.target as HTMLElement & { value: string }
    this._showQuality = target.value !== 'PDF'
  }

  render () {
    return html`
      <dialog id="export_box" aria-label="export svg">
        <div id="dialog_content">
          <p id="export_select">${this._exportLabel}</p>
          <se-select
            id="se-storage-pref"
            label=""
            options="PNG,JPEG,BMP,WEBP,PDF"
            values="PNG::JPEG::BMP::WEBP::PDF"
            @change=${this._onFormatChange}
          ></se-select>
          <se-spin-input
            id="se-quality"
            label="ui.quality"
            size="3"
            min="0"
            max="100"
            value="100"
            step="5"
            style=${this._showQuality ? 'display:block' : 'display:none'}
            @change=${this._onQualityChange}
          ></se-spin-input>
        </div>
        <div id="dialog_buttons">
          <button type="button" id="export_ok" @click=${this._onOk}>${this._okText}</button>
          <button type="button" id="export_cancel" @click=${this._onCancel}>${this._cancelText}</button>
        </div>
      </dialog>
    `
  }
}
