/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// svgCanvas / extension API surface is loosely typed; cleanup deferred to #3 or follow-up
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration
import storageDialogHTML from './storageDialog.html'

declare const svgEditor: SvgEditorGlobal

const template = document.createElement('template')
template.innerHTML = storageDialogHTML as string
/**
 * @class SeStorageDialog
 */
export class SeStorageDialog extends HTMLElement {
  declare _shadowRoot: ShadowRoot
  declare $dialog: any
  declare $storage: any
  declare $okBtn: any
  declare $cancelBtn: any
  declare $storageInput: any
  declare $rememberInput: any

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this.$dialog = this._shadowRoot.querySelector('#dialog_box')
    this.$storage = this._shadowRoot.querySelector('#js-storage')
    this.$okBtn = this._shadowRoot.querySelector('#storage_ok')
    this.$cancelBtn = this._shadowRoot.querySelector('#storage_cancel')
    this.$storageInput = this._shadowRoot.querySelector('#se-storage-pref')
    this.$rememberInput = this._shadowRoot.querySelector('#se-remember')
  }

  /**
   * @function init
   * @param {any} name
   * @returns {void}
   */
  init (i18next: any) {
    this.setAttribute('common-ok', i18next.t('common.ok'))
    this.setAttribute('common-cancel', i18next.t('common.cancel'))
    this.setAttribute('notify-editor_pref_msg', i18next.t('notification.editorPreferencesMsg'))
    this.setAttribute('properties-prefs_and_content', i18next.t('properties.prefs_and_content'))
    this.setAttribute('properties-prefs_only', i18next.t('properties.prefs_only'))
    this.setAttribute('properties-no_prefs_or_content', i18next.t('properties.no_prefs_or_content'))
    this.setAttribute('tools-remember_this_choice', i18next.t('tools.remember_this_choice'))
    this.setAttribute('tools-remember_this_choice_title', i18next.t('tools.remember_this_choice_title'))
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes () {
    return ['dialog', 'storage', 'common-ok', 'common-cancel', 'notify-editor_pref_msg', 'properties-prefs_and_content', 'tools-remember_this_choice', 'tools-remember_this_choice_title', 'properties-prefs_only', 'properties-no_prefs_or_content']
  }

  /**
   * @function attributeChangedCallback
   * @param {string} name
   * @param {string} oldValue
   * @param {string} newValue
   * @returns {void}
   */
  attributeChangedCallback (name: string, _oldValue: string | null, newValue: string | null) {
    let node: any
    switch (name) {
      case 'dialog':
        if (newValue === 'open') {
          this.$dialog.open()
        } else {
          this.$dialog.close()
        }
        break
      case 'storage':
        if (newValue === 'true') {
          this.$storageInput.options[0].disabled = false
        } else {
          this.$storageInput.options[0].disabled = true
        }
        break
      case 'common-ok':
        this.$okBtn.textContent = newValue
        break
      case 'common-cancel':
        this.$cancelBtn.textContent = newValue
        break
      case 'notify-editor_pref_msg':
        node = this._shadowRoot.querySelector('#notificationNote')
        node.textContent = newValue
        break
      case 'properties-prefs_and_content':
        node = this._shadowRoot.querySelector('#prefsAndContent')
        node.textContent = newValue
        break
      case 'properties-prefs_only':
        node = this._shadowRoot.querySelector('#prefsOnly')
        node.textContent = newValue
        break
      case 'properties-no_prefs_or_content':
        node = this._shadowRoot.querySelector('#noPrefsOrContent')
        node.textContent = newValue
        break
      case 'tools-remember_this_choice':
        node = this._shadowRoot.querySelector('#se-remember-title')
        node.prepend(newValue)
        break
      case 'tools-remember_this_choice_title':
        node = this._shadowRoot.querySelector('#se-remember-title')
        node.setAttribute('title', newValue)
        break
      default:
        // super.attributeChangedCallback(name, oldValue, newValue);
        break
    }
  }

  /**
   * @function get
   * @returns {any}
   */
  get dialog () {
    return this.getAttribute('dialog')
  }

  /**
   * @function set
   * @returns {void}
   */
  set dialog (value: string | null) {
    this.setAttribute('dialog', value ?? '')
  }

  /**
   * @function connectedCallback
   * @returns {void}
   */
  connectedCallback () {
    const onSubmitHandler = (_e: Event, action: string) => {
      const triggerEvent = new CustomEvent('change',
        {
          detail: {
            trigger: action,
            select: this.$storageInput.value,
            checkbox: this.$rememberInput.checked
          }
        })
      this.dispatchEvent(triggerEvent)
    }
    svgEditor.$click(this.$okBtn, (evt) => onSubmitHandler(evt, 'ok'))
    svgEditor.$click(this.$cancelBtn, (evt) => onSubmitHandler(evt, 'cancel'))
  }
}

// Register
customElements.define('se-storage-dialog', SeStorageDialog)
