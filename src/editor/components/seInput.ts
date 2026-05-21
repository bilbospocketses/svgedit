/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import 'elix/define/Input.js'
import { t } from '../locale.js'

const template = document.createElement('template')
template.innerHTML = `
  <style>
  div {
    height: 24px;
    margin: 5px 1px;
    padding: 3px;
  }
  img {
    top: 2px;
    left: 4px;
    position: relative;
  }
  span {
    bottom: 1px;
    right: -4px;
    position: relative;
    margin-right: 4px;
    color: #fff;
  }
  elix-input {
    background-color: var(--input-color);
    border-radius: 3px;
    height: 24px;
  }
  </style>
  <div>
  <img alt="icon" width="12" height="12" />
  <span id="label">label</span>
  <elix-input></elix-input>
  </div>
`

/**
 * @class SEInput
 */
export class SEInput extends HTMLElement {
  _shadowRoot: ShadowRoot
  $div: HTMLDivElement
  $img: HTMLImageElement
  $label: HTMLElement
  $event: CustomEvent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $input: any

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    // locate the component
    this.$div = this._shadowRoot.querySelector('div') as HTMLDivElement
    this.$img = this._shadowRoot.querySelector('img') as HTMLImageElement
    this.$label = this.shadowRoot?.getElementById('label') as HTMLElement
    this.$event = new CustomEvent('change')
    this.$input = this._shadowRoot.querySelector('elix-input')
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes () {
    return ['value', 'label', 'src', 'size', 'title']
  }

  /**
   * @function attributeChangedCallback
   * @param {string} name
   * @param {string} oldValue
   * @param {string} newValue
   * @returns {void}
   */
  attributeChangedCallback (name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return
    switch (name) {
      case 'title':
        this.$div.setAttribute('title', `${t(newValue)}`)
        break
      case 'src':
        this.$img.setAttribute('src', newValue)
        this.$label.remove()
        break
      case 'size':
        this.$input.setAttribute('size', newValue)
        break
      case 'label':
        this.$label.textContent = t(newValue)
        this.$img.remove()
        break
      case 'value':
        this.$input.value = newValue
        break
      default:
        console.error(`unknown attribute: ${name}`)
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
    this.setAttribute('title', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get label () {
    return this.getAttribute('label')
  }

  /**
   * @function set
   * @returns {void}
   */
  set label (value: string | null) {
    this.setAttribute('label', value ?? '')
  }

  /**
   * @function get
   * @returns {any}
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  get value () {
    return this.$input.value
  }

  /**
   * @function set
   * @returns {void}
   */
  set value (value: string) {
    this.$input.value = value
  }

  /**
   * @function get
   * @returns {any}
   */
  get src () {
    return this.getAttribute('src')
  }

  /**
   * @function set
   * @returns {void}
   */
  set src (value: string | null) {
    this.setAttribute('src', value ?? '')
  }

  /**
   * @function get
   * @returns {any}
   */
  get size () {
    return this.getAttribute('size')
  }

  /**
   * @function set
   * @returns {void}
   */
  set size (value: string | null) {
    this.setAttribute('size', value ?? '')
  }

  /**
   * @function connectedCallback
   * @returns {void}
   */
  connectedCallback () {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.$input.addEventListener('change', (e: Event) => {
      e.preventDefault()
      this.value = (e.target as HTMLInputElement).value
      this.dispatchEvent(this.$event)
    })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.$input.addEventListener('keyup', (e: Event) => {
      e.preventDefault()
      this.value = (e.target as HTMLInputElement).value
      this.dispatchEvent(this.$event)
    })
  }
}
// Register
customElements.define('se-input', SEInput)
