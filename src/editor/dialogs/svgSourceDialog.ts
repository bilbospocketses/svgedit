import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { getSvgEditor } from '../svgEditorInstance.js'

/**
 * SVG Source Editor dialog — allows viewing/editing raw SVG markup.
 *
 * Tag: se-svg-source-editor-dialog
 * External API (preserved):
 *   - init(i18next)  — sets labels
 *   - dialog attr    — 'open' shows modal; else closes
 *   - value attr     — gets/sets textarea content
 *   - applysec attr  — 'false' hides save section
 *   - copysec attr   — 'false' hides copy section
 *   - Dispatches CustomEvent('change') with varying detail shapes
 */
@customElement('se-svg-source-editor-dialog')
export class SeSvgSourceEditorDialog extends LitElement {
  static styles = css`
    dialog {
      background-color: #5a6162;
      color: #c5c5c5;
      opacity: 1.0;
      text-align: center;
      border: 1px outset #777;
      z-index: 6;
      padding: 1em;
      border-radius: 5px;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.3);
    }

    #save_output_btns {
      display: none;
      text-align: left;
    }

    #save_output_btns p {
      margin: .5em 1.5em;
      display: inline-block;
    }

    form {
      width: 100%;
    }

    #svg_source_textarea {
      padding: 5px;
      font-size: 12px;
      min-height: 200px;
      width: 95%;
      height: 95%;
    }

    #tool_source_back {
      text-align: left;
      height: 30px;
    }

    #tool_source_save {
      width: 20%;
      background-color: #c79605;
      margin-left: 30%;
      margin-top: 5px;
    }

    #tool_source_dynamic {
      cursor: pointer;
    }

    .tool_label {
      cursor: pointer;
      margin: 5px 0;
      display: inline-block;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }

    #tool_source_cancel {
      width: 20%;
      background-color: #c8c8c8;
    }
  `

  @property({ reflect: true }) accessor dialog = ''

  static get observedAttributes (): string[] {
    return [...super.observedAttributes, 'value', 'applysec', 'copysec']
  }

  @state() accessor _saveLabel = ''
  @state() accessor _cancelLabel = ''
  @state() accessor _noteLabel = ''
  @state() accessor _doneLabel = ''
  @state() accessor _textareaValue = ''
  @state() accessor _applysecVisible = true
  @state() accessor _copysecVisible = true

  /**
   * Sets i18n labels and triggers Lit re-render.
   */
  init (i18next: { t: (key: string) => string }): void {
    this._saveLabel = i18next.t('tools.source_save')
    this._cancelLabel = i18next.t('common.cancel')
    this._noteLabel = i18next.t('notification.source_dialog_note')
    this._doneLabel = i18next.t('config.done')
  }

  // --- Property accessors (external API preserved) ---

  protected updated (changed: Map<string, unknown>): void {
    if (changed.has('dialog')) {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (this.dialog === 'open') {
        if (dlg && !dlg.open) dlg.showModal()
        this.shadowRoot?.querySelector('textarea')?.focus()
      } else {
        if (dlg?.open) dlg.close()
        this.shadowRoot?.querySelector('textarea')?.blur()
      }
    }
  }

  get value (): string | null {
    return this._textareaValue
  }

  set value (value: string) {
    this._textareaValue = value
  }

  get applysec (): string | null {
    return this.getAttribute('applysec')
  }

  set applysec (value: string) {
    this.setAttribute('applysec', value)
  }

  get copysec (): string | null {
    return this.getAttribute('copysec')
  }

  set copysec (value: string) {
    this.setAttribute('copysec', value)
  }

  /**
   * Hybrid attributeChangedCallback: handles 'dialog' imperatively
   * (showModal/close), delegates rest to Lit's reactive pipeline.
   */
  attributeChangedCallback (name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue)
    switch (name) {
      case 'value':
        this._textareaValue = newValue ?? ''
        break
      case 'applysec':
        this._applysecVisible = newValue !== 'false'
        break
      case 'copysec':
        this._copysecVisible = newValue !== 'false'
        break
      default:
        break
    }
  }

  // --- Event handlers (class-field arrows) ---

  private _onCancelClick = (): void => {
    this.dispatchEvent(new CustomEvent('change', {
      detail: { dialog: 'closed' }
    }))
  }

  private _onCopyClick = (): void => {
    const ta = this.shadowRoot?.querySelector('textarea')
    this.dispatchEvent(new CustomEvent('change', {
      detail: { copy: 'click', value: ta?.value ?? '' }
    }))
  }

  private _onSaveClick = (): void => {
    const ta = this.shadowRoot?.querySelector('textarea')
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value: ta?.value ?? '', dialog: 'close' }
    }))
  }

  private _onToggleDynamic = (e: Event): void => {
    const checked = (e.target as HTMLInputElement).checked
    this.dispatchEvent(new CustomEvent('change', {
      detail: { dynamic: checked, dialog: 'dynamic' }
    }))
  }

  private _onDialogClose = (): void => {
    this.dispatchEvent(new CustomEvent('change', {
      detail: { dialog: 'closed' }
    }))
  }

  render () {
    const dynamicChecked = getSvgEditor().configObj.curConfig.dynamicOutput
    return html`
      <dialog @close=${this._onDialogClose}>
        <div id="svg_source_container">
          <div id="tool_source_back" class="toolbar_button"
               style=${this._applysecVisible ? 'display:block' : 'display:none'}>
            <button type="button" id="tool_source_save" @click=${this._onSaveClick}>${this._saveLabel}</button>
            <button type="button" id="tool_source_cancel" @click=${this._onCancelClick}>${this._cancelLabel}</button>
          </div>
          <div id="save_output_btns"
               style=${this._copysecVisible ? 'display:block' : 'display:none'}>
            <p id="copy_save_note">${this._noteLabel}</p>
            <button type="button" id="copy_save_done" @click=${this._onCopyClick}>${this._doneLabel}</button>
          </div>
          <form>
            <textarea id="svg_source_textarea" spellcheck="false" rows="5" cols="80"
                      .value=${this._textareaValue}></textarea>
          </form>
          <label class="tool_label" for="tool_source_dynamic">
            <input type="checkbox" id="tool_source_dynamic"
                   ?checked=${dynamicChecked}
                   @change=${this._onToggleDynamic}>Toggle dynamic size
          </label>
        </div>
      </dialog>
    `
  }
}
