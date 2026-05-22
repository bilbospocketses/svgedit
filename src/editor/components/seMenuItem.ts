import 'elix/define/Menu.js'
import 'elix/define/MenuItem.js'
import { t } from '../locale.js'
const template = document.createElement('template')
template.innerHTML = `
  <style>
  </style>
  <elix-menu-item>
    <div style="display:flex; align-items: center;">
      <img src="logo.svg" alt="icon" style="display:none;" width="24"/>
      <span style="margin-left: 7px;"></span>
    </div>
  </elix-menu-item>
`
/**
 * @class SeMenuItem
 */
export class SeMenuItem extends HTMLElement {
  _shadowRoot: ShadowRoot
  $img: HTMLImageElement
  $label: HTMLSpanElement
  $menuitem: Element
  // TODO: see todo #10 — shadowDOM-piercing preserved; replaced when #3 (elix→Lit) lands
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $svg: any
  imgPath: string

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this.$img = this._shadowRoot.querySelector('img') as HTMLImageElement
    this.$label = this._shadowRoot.querySelector('span') as HTMLSpanElement
    this.$menuitem = this._shadowRoot.querySelector('elix-menu-item') as Element
    // TODO: see todo #10 — shadowDOM-piercing; replaced when #3 (elix→Lit) lands
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    this.$svg = (this.$menuitem as any).shadowRoot.querySelector('#checkmark')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.$svg.setAttribute('style', 'display: none;')
    this.imgPath = svgEditor.configObj.curConfig.imgPath
  }

  /**
   * @function observedAttributes
   * @returns observed
   */
  static get observedAttributes () {
    return ['label', 'src']
  }

  /**
   * @function attributeChangedCallback
   * @param name
   * @param oldValue
   * @param newValue
   */
  attributeChangedCallback (name: string, oldValue: string, newValue: string): void {
    let shortcut = ''
    if (oldValue === newValue) return
    switch (name) {
      case 'src':
        this.$img.style.display = 'inline-block'
        this.$img.setAttribute('src', this.imgPath + '/' + newValue)
        break
      case 'label':
        shortcut = this.getAttribute('shortcut') ?? ''
        this.$label.textContent = `${t(newValue)} ${shortcut ? `(${shortcut})` : ''}`
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
  get src () {
    return this.getAttribute('src')
  }

  /**
   * @function set
   */
  set src (value: string | null) {
    this.setAttribute('src', value ?? '')
  }

  /**
   * @function connectedCallback
   */
  connectedCallback () {
    // capture shortcuts
    const shortcut = this.getAttribute('shortcut')
    if (shortcut) {
      // register the keydown event
      document.addEventListener('keydown', (e) => {
        // only track keyboard shortcuts for the body containing the svgedit editor
        if ((e.target as Element).nodeName !== 'BODY') return
        // normalize key
        const key = `${(e.metaKey) ? 'meta+' : ''}${(e.ctrlKey) ? 'ctrl+' : ''}${(e.shiftKey) ? 'shift+' : ''}${e.key.toUpperCase()}`
        if (shortcut !== key) return
        // launch the click event
        if (this.id) {
          document.getElementById(this.id)?.click()
        }
        e.preventDefault()
      })
    }
  }
}

// Register
customElements.define('se-menu-item', SeMenuItem)
