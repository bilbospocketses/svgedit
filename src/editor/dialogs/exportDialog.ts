/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import './se-elix/define/NumberSpinBox.js'
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration
import exportDialogHTML from './exportDialog.html'

declare const svgEditor: SvgEditorGlobal

const template = document.createElement('template')
template.innerHTML = exportDialogHTML as string  

/**
 * @class SeExportDialog
 */
export class SeExportDialog extends HTMLElement {
  declare _shadowRoot: ShadowRoot
   
  declare $dialog: any
  declare $okBtn: Element | null
  declare $cancelBtn: Element | null
   
  declare $exportOption: any
   
  declare $qualityCont: any
   
  declare $input: any
  declare value: number

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this.$dialog = this._shadowRoot.querySelector('#export_box')
    this.$okBtn = this._shadowRoot.querySelector('#export_ok')
    this.$cancelBtn = this._shadowRoot.querySelector('#export_cancel')
    this.$exportOption = this._shadowRoot.querySelector('#se-storage-pref')
    this.$qualityCont = this._shadowRoot.querySelector('#se-quality')
    this.$input = this._shadowRoot.querySelector('#se-quality')
    this.value = 1
  }

  /**
   * @function init
   * @param name
   */
   
  init (i18next: any): void {
    this.setAttribute('common-ok', i18next.t('common.ok'))
    this.setAttribute('common-cancel', i18next.t('common.cancel'))
    this.setAttribute('ui-export_type_label', i18next.t('ui.export_type_label'))
    this.value = 100
  }

  /**
   * @function observedAttributes
   * @returns observed
   */
  static get observedAttributes (): string[] {
    return ['dialog', 'common-ok', 'common-cancel', 'ui-export_type_label']
  }

  /**
   * @function attributeChangedCallback
   * @param name
   * @param oldValue
   * @param newValue
   */
  attributeChangedCallback (name: string, _oldValue: string, newValue: string): void {
    let node: Element | null
    switch (name) {
      case 'dialog':
        if (newValue === 'open') {
          this.$dialog.open()
        } else {
          this.$dialog.close()
        }
        break
      case 'common-ok':
        if (this.$okBtn) this.$okBtn.textContent = newValue
        break
      case 'common-cancel':
        if (this.$cancelBtn) this.$cancelBtn.textContent = newValue
        break
      case 'ui-export_type_label':
        node = this._shadowRoot.querySelector('#export_select')
        if (node) node.textContent = newValue
        break
      default:
      // super.attributeChangedCallback(name, oldValue, newValue);
        break
    }
  }

  /**
   * @function get
   */
  get dialog (): string | null {
    return this.getAttribute('dialog')
  }

  /**
   * @function set
   */
  set dialog (value: string) {
    this.setAttribute('dialog', value)
  }

  /**
   * @function connectedCallback
   */
  connectedCallback (): void {
     
    this.$input.addEventListener('change', (e: any) => {
      e.preventDefault()
      this.value = e.target.value
    })
     
    svgEditor.$click(this.$input, (e: any) => {
      e.preventDefault()
      this.value = e.target.value
    })
    const onSubmitHandler = (_e: Event, action: string): void => {
      if (action === 'cancel') {
        document.getElementById('se-export-dialog')?.setAttribute('dialog', 'close')
      } else {
        const triggerEvent = new CustomEvent('change', {
          detail: {
            trigger: action,
            imgType: this.$exportOption.value,
            quality: this.value
          }
        })
        this.dispatchEvent(triggerEvent)
        document.getElementById('se-export-dialog')?.setAttribute('dialog', 'close')
      }
    }
     
    const onChangeHandler = (e: any): void => {
      if (e.target.value === 'PDF') {
        this.$qualityCont.style.display = 'none'
      } else {
        this.$qualityCont.style.display = 'block'
      }
    }
    svgEditor.$click(this.$okBtn as EventTarget, (evt) => onSubmitHandler(evt, 'ok'))
    svgEditor.$click(this.$cancelBtn as EventTarget, (evt) => onSubmitHandler(evt, 'cancel'))
    this.$exportOption.addEventListener('change', (evt: Event) => onChangeHandler(evt))
  }
}

// Register
customElements.define('se-export-dialog', SeExportDialog)
