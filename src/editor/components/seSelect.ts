import { t } from '../locale.js'
const template = document.createElement('template')
template.innerHTML = `
<style>
select {
  margin-top: 8px;
  background-color: var(--input-color);
  appearance: none;
  outline: none;
  padding: 3px;
}
label {
  margin-left: 2px;
}
::slotted(*) {
  padding:0;
  width:100%;
}
</style>
  <label></label>
  <select>
  </select>

`
/**
 * @class SeList
 */
export class SeSelect extends HTMLElement {
  _shadowRoot: ShadowRoot
  $select: HTMLSelectElement
  $label: HTMLLabelElement

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this.$select = this._shadowRoot.querySelector('select') as HTMLSelectElement
    this.$label = this._shadowRoot.querySelector('label') as HTMLLabelElement
  }

  /**
   * @function observedAttributes
   * @returns observed
   */
  static get observedAttributes () {
    return ['label', 'width', 'height', 'options', 'values', 'title', 'disabled']
  }

  /**
   * @function attributeChangedCallback
   * @param name
   * @param oldValue
   * @param newValue
   */
  attributeChangedCallback (name: string, oldValue: string, newValue: string): void {
    let options: string[]
    if (oldValue === newValue) return
    switch (name) {
      case 'label':
        this.$label.textContent = t(newValue)
        break
      case 'title':
        this.$select.setAttribute('title', t(newValue))
        break
      case 'disabled':
        if (newValue === null) {
          this.$select.removeAttribute('disabled')
        } else {
          this.$select.setAttribute('disabled', newValue)
        }
        break
      case 'height':
        this.$select.style.height = newValue
        break
      case 'width':
        this.$select.style.width = newValue
        break
      case 'options':
        if (newValue === '') {
          while (this.$select.firstChild) { this.$select.removeChild(this.$select.firstChild) }
        } else {
          options = newValue.split(',')
          options.forEach((option) => {
            const optionNode = document.createElement('OPTION')
            const text = document.createTextNode(t(option))
            optionNode.appendChild(text)
            this.$select.appendChild(optionNode)
          })
        }
        break
      case 'values':
        if (newValue === '') {
          while (this.$select.firstChild) { this.$select.removeChild(this.$select.firstChild) }
        } else {
          options = newValue.split('::')
          options.forEach((option, index) => {
            this.$select.children[index]?.setAttribute('value', option)
          })
        }
        break
      default:
        console.error(`unknown attribute: ${name}`)
        break
    }
  }

  /**
   * @function get
   */
  get label () {
    return this.getAttribute('label')
  }

  /**
   * @function set
   */
  set label (value: string | null) {
    this.setAttribute('label', value ?? '')
  }

  /**
   * @function get
   */
  get width () {
    return this.getAttribute('width')
  }

  /**
   * @function set
   */
  set width (value: string | null) {
    this.setAttribute('width', value ?? '')
  }

  /**
   * @function get
   */
  get height () {
    return this.getAttribute('height')
  }

  /**
   * @function set
   */
  set height (value: string | null) {
    this.setAttribute('height', value ?? '')
  }

  /**
   * @function get
   */
  get value () {
    return this.$select.value
  }

  /**
   * @function set
   */
  set value (value: string) {
    this.$select.value = value
  }

  /**
   * @function get
   */
  get disabled () {
    return this.$select.getAttribute('disabled')
  }

  /**
   * @function set
   */
  set disabled (value: string | null) {
    this.$select.setAttribute('disabled', value ?? '')
  }

  /**
   * @function connectedCallback
   */
  connectedCallback () {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const currentObj = this
    this.$select.addEventListener('change', () => {
      const value = this.$select.value
      const closeEvent = new CustomEvent('change', { detail: { value } })
      currentObj.dispatchEvent(closeEvent)
      currentObj.value = value
    })
  }
}

// Register
customElements.define('se-select', SeSelect)
