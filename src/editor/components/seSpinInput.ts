/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import '../dialogs/se-elix/define/NumberSpinBox.js'
import { t } from '../locale.js'

const template = document.createElement('template')
template.innerHTML = `
  <style>
  div {
    height: 24px;
    margin: 5px 1px;
    padding: 3px;
  }
  div.imginside {
    width: var(--global-se-spin-input-width);
  }
  img {
    position: relative;
    right: -4px;
    top: 2px;
  }
  span {
    bottom: -0.5em;
    right: -4px;
    position: relative;
    margin-left: -4px;
    margin-right: 1px;
    color: #fff;
  }
  elix-number-spin-box {
    background-color: var(--input-color);
    border-radius: 3px;
    height: 20px;
    margin-top: 1px;
    vertical-align: top;
  }
  elix-number-spin-box::part(spin-button) {
    padding: 0px;
  }
  elix-number-spin-box::part(input) {
    width: 3em;
  }
  elix-number-spin-box{
    width: 54px;
    height: 24px;
  }
  </style>
  <div>
  <img alt="icon" width="24" height="24" aria-labelledby="label" />
  <span id="label">label</span>
  <elix-number-spin-box min="1" step="1"></elix-number-spin-box>
  </div>
`

/**
 * @class SESpinInput
 */
export class SESpinInput extends HTMLElement {
  _shadowRoot: ShadowRoot
  $div: HTMLDivElement
  $img: HTMLImageElement
  $label: HTMLElement
  $event: CustomEvent
  $input: any
  imgPath: string

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
    this.$label = this._shadowRoot.getElementById('label') as HTMLElement
    this.$event = new CustomEvent('change')
    this.$input = this._shadowRoot.querySelector('elix-number-spin-box')
    this.imgPath = svgEditor.configObj.curConfig.imgPath
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes () {
    return ['value', 'label', 'src', 'size', 'min', 'max', 'step', 'title']
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
        {
          const shortcut = this.getAttribute('shortcut')
          this.$div.setAttribute('title', `${t(newValue)} ${shortcut ? `[${t(shortcut)}]` : ''}`)
        }
        break
      case 'src':
        this.$img.setAttribute('src', this.imgPath + '/' + newValue)
        this.$label.remove()
        this.$div.classList.add('imginside')
        break
      case 'size':
      // access to the underlying input box
        // TODO: see todo #10 — shadowDOM-piercing; replaced when #3 (elix→Lit) lands
        this.$input.shadowRoot.getElementById('input').size = newValue
        // below seems mandatory to override the default width style that takes precedence on size
        this.$input.shadowRoot.getElementById('input').style.width = 'unset'
        break
      case 'step':
        this.$input.setAttribute('step', newValue)
        break
      case 'min':
        this.$input.setAttribute('min', newValue)
        break
      case 'max':
        this.$input.setAttribute('max', newValue)
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
    // TODO: see todo #10 — shadowDOM-piercing; replaced when #3 (elix→Lit) lands
    const shadow = this.$input.shadowRoot
    const childNodes = Array.from((shadow as ShadowRoot).childNodes)
    childNodes.forEach((childNode) => {
      if ((childNode as HTMLElement).id === 'input') {
        childNode.addEventListener('keyup', (e) => {
          e.preventDefault()
          const val = (e.target as HTMLInputElement).value
          if (!isNaN(Number(val))) {
            this.value = val
            this.dispatchEvent(this.$event)
          }
        })
      }
    })
    this.$input.addEventListener('change', (e: Event) => {
      e.preventDefault()
      this.value = (e.target as HTMLInputElement).value
      this.dispatchEvent(this.$event)
    })
    svgEditor.$click(this.$input, (e: Event) => {
      e.preventDefault()
      this.value = (e.target as HTMLInputElement).value
      this.dispatchEvent(this.$event)
    })
  }
}

// Register
customElements.define('se-spin-input', SESpinInput)
