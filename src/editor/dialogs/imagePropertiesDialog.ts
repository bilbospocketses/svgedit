/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import SvgCanvas from '@svgedit/svgcanvas'
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration
import imagePropertiesDialogHTML from './imagePropertiesDialog.html'

declare const svgEditor: SvgEditorGlobal

const { isValidUnit } = SvgCanvas

const template = document.createElement('template')
template.innerHTML = imagePropertiesDialogHTML as string  
/**
 * @class SeImgPropDialog
 */
export class SeImgPropDialog extends HTMLElement {
  declare eventlisten: boolean
  declare _shadowRoot: ShadowRoot
   
  declare $saveBtn: any
   
  declare $cancelBtn: any
   
  declare $resolution: any
   
  declare $canvasTitle: any
   
  declare $canvasWidth: any
   
  declare $canvasHeight: any
   
  declare $imageOptEmbed: any
   
  declare $imageOptRef: any
   
  declare $dialog: any

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this.eventlisten = false
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this.$saveBtn = this._shadowRoot.querySelector('#tool_docprops_save')
    this.$cancelBtn = this._shadowRoot.querySelector('#tool_docprops_cancel')
    this.$resolution = this._shadowRoot.querySelector('#resolution')
    this.$canvasTitle = this._shadowRoot.querySelector('#canvas_title')
    this.$canvasWidth = this._shadowRoot.querySelector('#canvas_width')
    this.$canvasHeight = this._shadowRoot.querySelector('#canvas_height')
    this.$imageOptEmbed = this._shadowRoot.querySelector('#image_embed')
    this.$imageOptRef = this._shadowRoot.querySelector('#image_ref')
    this.$dialog = this._shadowRoot.querySelector('#svg_docprops')
  }

  /**
   * @function init
   * @param name
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

  /**
   * @function observedAttributes
   * @returns observed
   */
  static get observedAttributes (): string[] {
    return ['title', 'width', 'height', 'save', 'dialog', 'embed', 'common-ok',
      'common-cancel', 'config-image_props', 'config-doc_title', 'config-doc_dims',
      'common-width', 'common-height', 'config-select_predefined',
      'tools-fit-to-content', 'config-included_images', 'config-image_opt_embed',
      'config-image_opt_ref']
  }

  /**
   * @function attributeChangedCallback
   * @param name
   * @param oldValue
   * @param newValue
   */
  attributeChangedCallback (name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return
    let node: Element | null
    switch (name) {
      case 'title':
        this.$canvasTitle.value = newValue
        break
      case 'width':
        if (newValue === 'fit') {
          this.$canvasWidth.removeAttribute('disabled')
          this.$canvasWidth.value = 100
          this.$canvasHeight.removeAttribute('disabled')
          this.$canvasHeight.value = 100
        } else {
          this.$canvasWidth.value = newValue
        }
        break
      case 'height':
        if (newValue === 'fit') {
          this.$canvasWidth.removeAttribute('disabled')
          this.$canvasWidth.value = 100
          this.$canvasHeight.removeAttribute('disabled')
          this.$canvasHeight.value = 100
        } else {
          this.$canvasHeight.value = newValue
        }
        break
      case 'dialog':
        if (this.eventlisten) {
          if (newValue === 'open') {
            this.$dialog.open()
          } else {
            this.$dialog.close()
          }
        }
        break
      case 'save':
        if (newValue === 'ref') {
          this.$imageOptEmbed.setAttribute('checked', false)
          this.$imageOptRef.setAttribute('checked', true)
        } else {
          this.$imageOptEmbed.setAttribute('checked', true)
          this.$imageOptRef.setAttribute('checked', false)
        }
        break
      case 'embed':
        if (newValue.includes('one')) {
          const data = newValue.split('|')
          if (data.length > 1 && data[1] !== undefined) {
            const embedEl = this._shadowRoot.querySelector<HTMLElement>('#image_opt_embed')
            if (embedEl) {
              embedEl.setAttribute('title', data[1])
              embedEl.setAttribute('disabled', 'disabled')
              embedEl.style.color = '#666'
            }
          }
        }
        break
      case 'common-ok':
        this.$saveBtn.textContent = newValue
        break
      case 'common-cancel':
        this.$cancelBtn.textContent = newValue
        break
      case 'config-image_props':
        node = this._shadowRoot.querySelector('#svginfo_image_props')
        if (node) node.textContent = newValue
        break
      case 'config-doc_title':
        node = this._shadowRoot.querySelector('#svginfo_title')
        if (node) node.textContent = newValue
        break
      case 'config-doc_dims':
        node = this._shadowRoot.querySelector('#svginfo_dim')
        if (node) node.textContent = newValue
        break
      case 'common-width':
        node = this._shadowRoot.querySelector('#svginfo_width')
        if (node) node.textContent = newValue
        break
      case 'common-height':
        node = this._shadowRoot.querySelector('#svginfo_height')
        if (node) node.textContent = newValue
        break
      case 'config-select_predefined':
        node = this._shadowRoot.querySelector('#selectedPredefined')
        if (node) node.textContent = newValue
        break
      case 'tools-fit-to-content':
        node = this._shadowRoot.querySelector('#fitToContent')
        if (node) node.textContent = newValue
        break
      case 'config-included_images':
        node = this._shadowRoot.querySelector('#includedImages')
        if (node) node.textContent = newValue
        break
      case 'config-image_opt_embed':
        node = this._shadowRoot.querySelector('#image_opt_embed')
        if (node) node.textContent = newValue
        break
      case 'config-image_opt_ref':
        node = this._shadowRoot.querySelector('#image_opt_ref')
        if (node) node.textContent = newValue
        break
      default:
        // TODO: see todo #10 — super.attributeChangedCallback may throw if HTMLElement doesn't implement it
        // @ts-expect-error: pre-existing null-misuse, see todo #10
        super.attributeChangedCallback(name, oldValue, newValue)
        break
    }
  }

  /**
   * @function get
   */
  get title (): string {
    return this.getAttribute('title') ?? ''
  }

  /**
   * @function set
   */
  set title (value: string) {
    this.setAttribute('title', value)
  }

  /**
   * @function get
   */
  get width (): string | null {
    return this.getAttribute('width')
  }

  /**
   * @function set
   */
  set width (value: string) {
    this.setAttribute('width', value)
  }

  /**
   * @function get
   */
  get height (): string | null {
    return this.getAttribute('height')
  }

  /**
   * @function set
   */
  set height (value: string) {
    this.setAttribute('height', value)
  }

  /**
   * @function get
   */
  get save (): string | null {
    return this.getAttribute('save')
  }

  /**
   * @function set
   */
  set save (value: string) {
    this.setAttribute('save', value)
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
   * @function get
   */
  get embed (): string | null {
    return this.getAttribute('embed')
  }

  /**
   * @function set
   */
  set embed (value: string) {
    this.setAttribute('embed', value)
  }

  /**
   * @function connectedCallback
   */
  connectedCallback (): void {
     
    const onChangeHandler = (ev: any): void => {
      if (!ev.target.selectedIndex) {
        if (this.$canvasWidth.value === 'fit') {
          this.$canvasWidth.removeAttribute('disabled')
          this.$canvasWidth.value = 100
          this.$canvasHeight.removeAttribute('disabled')
          this.$canvasHeight.value = 100
        }
      } else if (ev.target.value === 'content') {
        this.$canvasWidth.setAttribute('disabled', 'disabled')
        this.$canvasWidth.value = 'fit'
        this.$canvasHeight.setAttribute('disabled', 'disabled')
        this.$canvasHeight.value = 'fit'
      } else {
        const dims = ev.target.value.split('x')
        this.$canvasWidth.value = dims[0]
        this.$canvasWidth.removeAttribute('disabled')
        this.$canvasHeight.value = dims[1]
        this.$canvasHeight.removeAttribute('disabled')
      }
    }
    const onSaveHandler = () => {
      let saveOpt = ''
      const w = this.$canvasWidth.value
      const h = this.$canvasHeight.value
      // @ts-expect-error: pre-existing null-misuse, see todo #10 — isValidUnit called with 2 args (missing selectedElement)
      if (w !== 'fit' && !isValidUnit('width', w)) {
        this.$canvasWidth.parentElement.classList.add('error')
      } else {
        this.$canvasWidth.parentElement.classList.remove('error')
      }
      // @ts-expect-error: pre-existing null-misuse, see todo #10 — isValidUnit called with 2 args (missing selectedElement)
      if (h !== 'fit' && !isValidUnit('height', w)) {
        this.$canvasHeight.parentElement.classList.add('error')
      } else {
        this.$canvasHeight.parentElement.classList.remove('error')
      }
      if (this.$imageOptEmbed.getAttribute('checked') === 'true') {
        saveOpt = 'embed'
      }
      if (this.$imageOptRef.getAttribute('checked') === 'true') {
        saveOpt = 'ref'
      }
      const closeEvent = new CustomEvent('change', {
        detail: {
          title: this.$canvasTitle.value,
          w: this.$canvasWidth.value,
          h: this.$canvasHeight.value,
          save: saveOpt,
          dialog: 'close'
        }
      })
      this.$canvasWidth.removeAttribute('disabled')
      this.$canvasHeight.removeAttribute('disabled')
      this.$resolution.selectedIndex = 0
      this.dispatchEvent(closeEvent)
    }
    const onCancelHandler = () => {
      const closeEvent = new CustomEvent('change', {
        detail: {
          dialog: 'closed'
        }
      })
      this.$canvasWidth.removeAttribute('disabled')
      this.$canvasHeight.removeAttribute('disabled')
      this.$resolution.selectedIndex = 0
      this.dispatchEvent(closeEvent)
    }
    this.$resolution.addEventListener('change', onChangeHandler)
    svgEditor.$click(this.$saveBtn, onSaveHandler)
    svgEditor.$click(this.$cancelBtn, onCancelHandler)
    this.$dialog.addEventListener('close', onCancelHandler)
    this.eventlisten = true
  }
}

// Register
customElements.define('se-img-prop-dialog', SeImgPropDialog)
