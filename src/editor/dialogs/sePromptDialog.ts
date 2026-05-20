import SePlainAlertDialog from './SePlainAlertDialog.js'

/**
 * @class SePromptDialog
 * Note: misnamed — this is a status-display dialog, not a prompt. Rename deferred.
 */
export class SePromptDialog extends HTMLElement {
  declare _shadowRoot: ShadowRoot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare dialog: any

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.dialog = new SePlainAlertDialog() as any
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes (): string[] {
    return ['title', 'close']
  }

  /**
   * @function attributeChangedCallback
   * @param {string} name
   * @param {string} oldValue
   * @param {string} newValue
   * @returns {void}
   */
  attributeChangedCallback (name: string, _oldValue: string, newValue: string): void {
    switch (name) {
      case 'title':
        if (this.dialog.opened) {
          this.dialog.close()
        }
        this.dialog.textContent = newValue
        this.dialog.choices = ['Cancel']
        this.dialog.open()
        break
      case 'close':
        if (this.dialog.opened) {
          this.dialog.close()
        } else {
          this.dialog.open()
        }
        break
      default:
        console.error('unknown attr for:', name, 'newValue =', newValue)
        break
    }
  }

  /**
   * @function get
   * @returns {any}
   */
  get title (): string {
    return this.getAttribute('title') ?? ''
  }

  /**
   * @function set
   * @returns {void}
   */
  set title (value: string) {
    if (value) {
      this.setAttribute('title', value)
    } else {
      this.removeAttribute('title')
    }
  }

  /**
   * @function get
   * @returns {any}
   */
  get close (): string | null {
    return this.getAttribute('close')
  }

  /**
   * @function set
   * @returns {void}
   */
  set close (value: string | null) {
    // boolean value => existence = true
    if (value) {
      this.setAttribute('close', 'true')
    } else {
      this.removeAttribute('close')
    }
  }
}

// Register
// eslint-disable-next-line @typescript-eslint/no-explicit-any
customElements.define('se-prompt-dialog', SePromptDialog as any)
