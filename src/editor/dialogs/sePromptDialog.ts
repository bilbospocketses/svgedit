/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import SePlainAlertDialog from './SePlainAlertDialog.js'

/**
 * @class SePromptDialog
 * Note: misnamed — this is a status-display dialog, not a prompt. Rename deferred.
 */
export class SePromptDialog extends HTMLElement {
  declare _shadowRoot: ShadowRoot
   
  declare dialog: any

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
     
    this.dialog = new SePlainAlertDialog() as any
  }

  /**
   * @function observedAttributes
   * @returns observed
   */
  static get observedAttributes (): string[] {
    return ['title', 'close']
  }

  /**
   * @function attributeChangedCallback
   * @param name
   * @param oldValue
   * @param newValue
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
   */
  get title (): string {
    return this.getAttribute('title') ?? ''
  }

  /**
   * @function set
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
   */
  get close (): string | null {
    return this.getAttribute('close')
  }

  /**
   * @function set
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
 
customElements.define('se-prompt-dialog', SePromptDialog as any)
