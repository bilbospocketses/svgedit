/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { LitElement, html, css } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import SvgCanvas from '@svgedit/svgcanvas'

const { isValidUnit } = SvgCanvas

/**
 * @class SeImgPropDialog
 */
@customElement('se-img-prop-dialog')
export class SeImgPropDialog extends LitElement {
  static styles = css`
    :not(:defined) {
      display: none;
    }

    /* Force the scroll bar to appear so we see it hide when overlay opens. */
    body::-webkit-scrollbar {
      background: lightgray;
    }

    body::-webkit-scrollbar-thumb {
      background: darkgray;
    }

    dialog {
      padding: 0;
      border: none;
      background: transparent;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.3);
    }

    #svg_docprops_container {
      padding: 10px;
      background-color: #5a6162;
      color: #c5c5c5;
      border: 1px outset #777;
      opacity: 1.0;
      font-family: Verdana, Helvetica, sans-serif;
      font-size: .8em;
      z-index: 20001;
    }

    .error {
      border: 1px solid red;
      padding: 3px;
    }

    #resolution {
      max-width: 14em;
    }

    #tool_docprops_back {
      margin-left: 1em;
      overflow: auto;
    }

    #svg_docprops_container #svg_docprops_docprops {
      float: left;
      width: 221px;
      margin: 5px .7em;
      overflow: hidden;
    }

    legend {
      max-width: 195px;
    }

    #svg_docprops_docprops > legend {
      font-weight: bold;
      font-size: 1.1em;
    }

    #svg_docprops_container fieldset {
      padding: 5px;
      margin: 5px;
      border: 1px solid #DDD;
    }

    #svg_docprops_container label {
      display: block;
      margin: .5em;
    }
  `

  @state() accessor _labelOk = ''
  @state() accessor _labelCancel = ''
  @state() accessor _labelImageProps = ''
  @state() accessor _labelDocTitle = ''
  @state() accessor _labelDocDims = ''
  @state() accessor _labelWidth = ''
  @state() accessor _labelHeight = ''
  @state() accessor _labelSelectPredefined = ''
  @state() accessor _labelFitToContent = ''
  @state() accessor _labelIncludedImages = ''
  @state() accessor _labelImageOptEmbed = ''
  @state() accessor _labelImageOptRef = ''

  @query('#svg_docprops') accessor _dialog!: HTMLDialogElement
  @query('#canvas_title') accessor _canvasTitle!: HTMLInputElement
  @query('#canvas_width') accessor _canvasWidth!: HTMLInputElement
  @query('#canvas_height') accessor _canvasHeight!: HTMLInputElement
  @query('#resolution') accessor _resolution!: HTMLSelectElement
  @query('#image_embed') accessor _imageOptEmbed!: HTMLInputElement
  @query('#image_ref') accessor _imageOptRef!: HTMLInputElement

  static get observedAttributes (): string[] {
    return [...super.observedAttributes, 'title', 'width', 'height', 'save', 'embed', 'common-ok',
      'common-cancel', 'config-image_props', 'config-doc_title', 'config-doc_dims',
      'common-width', 'common-height', 'config-select_predefined',
      'tools-fit-to-content', 'config-included_images', 'config-image_opt_embed',
      'config-image_opt_ref']
  }

  /**
   * @function init
   */
  init (i18next: any): void {
    this.setAttribute('common-ok', i18next.t('common.ok'))
    this.setAttribute('common-cancel', i18next.t('common.cancel'))
    this.setAttribute('config-image_props', i18next.t('config.image_props'))
    this.setAttribute('config-doc_title', i18next.t('config.doc_title'))
    this.setAttribute('config-doc_dims', i18next.t('config.doc_dims'))
    this.setAttribute('common-width', i18next.t('common.width'))
    this.setAttribute('common-height', i18next.t('common.height'))
    this.setAttribute('config-select_predefined', i18next.t('config.select_predefined'))
    this.setAttribute('tools-fit-to-content', i18next.t('tools.fitToContent'))
    this.setAttribute('config-included_images', i18next.t('config.included_images'))
    this.setAttribute('config-image_opt_embed', i18next.t('config.image_opt_embed'))
    this.setAttribute('config-image_opt_ref', i18next.t('config.image_opt_ref'))
  }

  attributeChangedCallback (name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue)
    if (oldValue === newValue) return
    switch (name) {
      case 'title':
        void this.updateComplete.then(() => {
          if (this._canvasTitle) this._canvasTitle.value = newValue ?? ''
        })
        break
      case 'width':
        void this.updateComplete.then(() => {
          if (newValue === 'fit') {
            this._canvasWidth.removeAttribute('disabled')
            this._canvasWidth.value = '100'
            this._canvasHeight.removeAttribute('disabled')
            this._canvasHeight.value = '100'
          } else {
            this._canvasWidth.value = newValue ?? ''
          }
        })
        break
      case 'height':
        void this.updateComplete.then(() => {
          if (newValue === 'fit') {
            this._canvasWidth.removeAttribute('disabled')
            this._canvasWidth.value = '100'
            this._canvasHeight.removeAttribute('disabled')
            this._canvasHeight.value = '100'
          } else {
            this._canvasHeight.value = newValue ?? ''
          }
        })
        break
      case 'dialog':
        break
      case 'save':
        void this.updateComplete.then(() => {
          if (newValue === 'ref') {
            this._imageOptEmbed.checked = false
            this._imageOptRef.checked = true
          } else {
            this._imageOptEmbed.checked = true
            this._imageOptRef.checked = false
          }
        })
        break
      case 'embed':
        void this.updateComplete.then(() => {
          if (newValue && newValue.includes('one')) {
            const data = newValue.split('|')
            if (data.length > 1 && data[1] !== undefined) {
              const embedEl = this.renderRoot.querySelector<HTMLElement>('#image_opt_embed')
              if (embedEl) {
                embedEl.setAttribute('title', data[1])
                embedEl.setAttribute('disabled', 'disabled')
                embedEl.style.color = '#666'
              }
            }
          }
        })
        break
      case 'common-ok':
        this._labelOk = newValue ?? ''
        break
      case 'common-cancel':
        this._labelCancel = newValue ?? ''
        break
      case 'config-image_props':
        this._labelImageProps = newValue ?? ''
        break
      case 'config-doc_title':
        this._labelDocTitle = newValue ?? ''
        break
      case 'config-doc_dims':
        this._labelDocDims = newValue ?? ''
        break
      case 'common-width':
        this._labelWidth = newValue ?? ''
        break
      case 'common-height':
        this._labelHeight = newValue ?? ''
        break
      case 'config-select_predefined':
        this._labelSelectPredefined = newValue ?? ''
        break
      case 'tools-fit-to-content':
        this._labelFitToContent = newValue ?? ''
        break
      case 'config-included_images':
        this._labelIncludedImages = newValue ?? ''
        break
      case 'config-image_opt_embed':
        this._labelImageOptEmbed = newValue ?? ''
        break
      case 'config-image_opt_ref':
        this._labelImageOptRef = newValue ?? ''
        break
      default:
        break
    }
  }

  get title (): string {
    return this.getAttribute('title') ?? ''
  }

  set title (value: string) {
    this.setAttribute('title', value)
  }

  get width (): string | null {
    return this.getAttribute('width')
  }

  set width (value: string) {
    this.setAttribute('width', value)
  }

  get height (): string | null {
    return this.getAttribute('height')
  }

  set height (value: string) {
    this.setAttribute('height', value)
  }

  get save (): string | null {
    return this.getAttribute('save')
  }

  set save (value: string) {
    this.setAttribute('save', value)
  }

  @property({ reflect: true }) accessor dialog = ''

  protected updated (changed: Map<string, unknown>): void {
    if (changed.has('dialog')) {
      if (this.dialog === 'open') {
        if (this._dialog && !this._dialog.open) this._dialog.showModal()
      } else {
        if (this._dialog?.open) this._dialog.close()
      }
    }
  }

  get embed (): string | null {
    return this.getAttribute('embed')
  }

  set embed (value: string) {
    this.setAttribute('embed', value)
  }

  private _onResolutionChange = (ev: Event): void => {
    const target = ev.target as HTMLSelectElement
    if (!target.selectedIndex) {
      if (this._canvasWidth.value === 'fit') {
        this._canvasWidth.removeAttribute('disabled')
        this._canvasWidth.value = '100'
        this._canvasHeight.removeAttribute('disabled')
        this._canvasHeight.value = '100'
      }
    } else if (target.value === 'content') {
      this._canvasWidth.setAttribute('disabled', 'disabled')
      this._canvasWidth.value = 'fit'
      this._canvasHeight.setAttribute('disabled', 'disabled')
      this._canvasHeight.value = 'fit'
    } else {
      const dims = target.value.split('x')
      this._canvasWidth.value = dims[0] ?? ''
      this._canvasWidth.removeAttribute('disabled')
      this._canvasHeight.value = dims[1] ?? ''
      this._canvasHeight.removeAttribute('disabled')
    }
  }

  private _onSave = (): void => {
    let saveOpt = ''
    const w = this._canvasWidth.value
    const h = this._canvasHeight.value
    if (w !== 'fit' && !isValidUnit('width', w)) {
      this._canvasWidth.parentElement?.classList.add('error')
    } else {
      this._canvasWidth.parentElement?.classList.remove('error')
    }
    if (h !== 'fit' && !isValidUnit('height', w)) {
      this._canvasHeight.parentElement?.classList.add('error')
    } else {
      this._canvasHeight.parentElement?.classList.remove('error')
    }
    if (this._imageOptEmbed.checked) {
      saveOpt = 'embed'
    }
    if (this._imageOptRef.checked) {
      saveOpt = 'ref'
    }
    const closeEvent = new CustomEvent('change', {
      detail: {
        title: this._canvasTitle.value,
        w: this._canvasWidth.value,
        h: this._canvasHeight.value,
        save: saveOpt,
        dialog: 'close'
      }
    })
    this._canvasWidth.removeAttribute('disabled')
    this._canvasHeight.removeAttribute('disabled')
    this._resolution.selectedIndex = 0
    this.dispatchEvent(closeEvent)
  }

  private _onCancel = (): void => {
    const closeEvent = new CustomEvent('change', {
      detail: {
        dialog: 'closed'
      }
    })
    this._canvasWidth.removeAttribute('disabled')
    this._canvasHeight.removeAttribute('disabled')
    this._resolution.selectedIndex = 0
    this.dispatchEvent(closeEvent)
  }

  render () {
    return html`
      <dialog id="svg_docprops" aria-label="Image properties" @close=${this._onCancel}>
        <div id="svg_docprops_container">
          <div id="tool_docprops_back" class="toolbar_button">
            <button id="tool_docprops_save" @click=${this._onSave}>${this._labelOk}</button>
            <button id="tool_docprops_cancel" @click=${this._onCancel}>${this._labelCancel}</button>
          </div>
          <fieldset id="svg_docprops_docprops">
            <legend id="svginfo_image_props">${this._labelImageProps}</legend>
            <label>
              <span id="svginfo_title">${this._labelDocTitle}</span>
              <input type="text" id="canvas_title" />
            </label>
            <fieldset id="change_resolution">
              <legend id="svginfo_dim">${this._labelDocDims}</legend>
              <label>
                <span id="svginfo_width">${this._labelWidth}</span>
                <input type="text" id="canvas_width" size="6" />
              </label>
              <label>
                <span id="svginfo_height">${this._labelHeight}</span>
                <input type="text" id="canvas_height" size="6" />
              </label>
              <label>
                <select id="resolution" @change=${this._onResolutionChange}>
                  <option id="selectedPredefined" selected>${this._labelSelectPredefined}</option>
                  <option>640x480</option>
                  <option>800x600</option>
                  <option>1024x768</option>
                  <option>1280x960</option>
                  <option>1600x1200</option>
                  <option id="fitToContent" value="content">${this._labelFitToContent}</option>
                </select>
              </label>
            </fieldset>
            <fieldset id="image_save_opts">
              <legend id="includedImages">${this._labelIncludedImages}</legend>
              <label>
                <input type="radio" id="image_embed" name="image_opt" value="embed" checked />
                <span id="image_opt_embed">${this._labelImageOptEmbed}</span>
              </label>
              <label>
                <input type="radio" id="image_ref" name="image_opt" value="ref" />
                <span id="image_opt_ref">${this._labelImageOptRef}</span>
              </label>
            </fieldset>
          </fieldset>
        </div>
      </dialog>
    `
  }
}
