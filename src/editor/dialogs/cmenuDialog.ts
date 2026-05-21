/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-this-alias */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration
import cMenuDialogHTML from './cmenuDialog.html'

// Template uses a static HTML file; innerHTML is safe (build-time constant, not user input)
const template = document.createElement('template')
template.innerHTML = cMenuDialogHTML as string  

declare const svgEditor: SvgEditorGlobal

/**
 * @class SeCMenuDialog
 */
export class SeCMenuDialog extends HTMLElement {
  declare _shadowRoot: ShadowRoot
  declare _workarea: Element | null
  declare $dialog: HTMLElement | null
  declare $copyLink: Element | null
  declare $cutLink: Element | null
  declare $pasteLink: Element | null
  declare $pasteInPlaceLink: Element | null
  declare $deleteLink: Element | null
  declare $groupLink: Element | null
  declare $ungroupLink: Element | null
  declare $moveFrontLink: Element | null
  declare $moveUpLink: Element | null
  declare $moveDownLink: Element | null
  declare $moveBackLink: Element | null

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this._workarea = document.getElementById('workarea')
    this.$dialog = this._shadowRoot.querySelector('#cmenu_canvas')
    this.$copyLink = this._shadowRoot.querySelector('#se-copy')
    this.$cutLink = this._shadowRoot.querySelector('#se-cut')
    this.$pasteLink = this._shadowRoot.querySelector('#se-paste')
    this.$pasteInPlaceLink = this._shadowRoot.querySelector('#se-paste-in-place')
    this.$deleteLink = this._shadowRoot.querySelector('#se-delete')
    this.$groupLink = this._shadowRoot.querySelector('#se-group')
    this.$ungroupLink = this._shadowRoot.querySelector('#se-ungroup')
    this.$moveFrontLink = this._shadowRoot.querySelector('#se-move-front')
    this.$moveUpLink = this._shadowRoot.querySelector('#se-move-up')
    this.$moveDownLink = this._shadowRoot.querySelector('#se-move-down')
    this.$moveBackLink = this._shadowRoot.querySelector('#se-move-back')
  }

  /**
   * @function init
   * @param {any} name
   * @returns {void}
   */
   
  init (i18next: any): void {
    this.setAttribute('tools-cut', i18next.t('tools.cut'))
    this.setAttribute('tools-copy', i18next.t('tools.copy'))
    this.setAttribute('tools-paste', i18next.t('tools.paste'))
    this.setAttribute('tools-paste_in_place', i18next.t('tools.paste_in_place'))
    this.setAttribute('tools-delete', i18next.t('tools.delete'))
    this.setAttribute('tools-group', i18next.t('tools.group'))
    this.setAttribute('tools-ungroup', i18next.t('tools.ungroup'))
    this.setAttribute('tools-move_front', i18next.t('tools.move_front'))
    this.setAttribute('tools-move_up', i18next.t('tools.move_up'))
    this.setAttribute('tools-move_down', i18next.t('tools.move_down'))
    this.setAttribute('tools-move_back', i18next.t('tools.move_back'))
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes (): string[] {
    return ['disableallmenu', 'enablemenuitems', 'disablemenuitems', 'tools-cut',
      'tools-copy', 'tools-paste', 'tools-paste_in_place', 'tools-delete', 'tools-group',
      'tools-ungroup', 'tools-move_front', 'tools-move_up', 'tools-move_down',
      'tools-move_back']
  }

  /**
   * @function attributeChangedCallback
   * @param {string} name
   * @param {string} oldValue
   * @param {string} newValue
   * @returns {void}
   */
  attributeChangedCallback (name: string, _oldValue: string, newValue: string): void {
    let eles: string[] = []
    let textnode: Text | undefined
    const sdowRoot = this._shadowRoot
    switch (name) {
      case 'disableallmenu':
        if (newValue === 'true') {
          const elesli = sdowRoot.querySelectorAll('li')
          elesli.forEach(function (eleli) {
            eleli.classList.add('disabled')
          })
        }
        break
      case 'enablemenuitems':
        eles = newValue.split(',')
        eles.forEach(function (ele) {
          const selEle = sdowRoot.querySelector('a[href*="' + ele + '"]')
          selEle?.parentElement?.classList.remove('disabled')
        })
        break
      case 'disablemenuitems':
        eles = newValue.split(',')
        eles.forEach(function (ele) {
          const selEle = sdowRoot.querySelector('a[href*="' + ele + '"]')
          selEle?.parentElement?.classList.add('disabled')
        })
        break
      case 'tools-cut':
        textnode = document.createTextNode(newValue)
        this.$cutLink?.prepend(textnode)
        break
      case 'tools-copy':
        textnode = document.createTextNode(newValue)
        this.$copyLink?.prepend(textnode)
        break
      case 'tools-paste':
        if (this.$pasteLink) this.$pasteLink.textContent = newValue
        break
      case 'tools-paste_in_place':
        if (this.$pasteInPlaceLink) this.$pasteInPlaceLink.textContent = newValue
        break
      case 'tools-delete':
        textnode = document.createTextNode(newValue)
        this.$deleteLink?.prepend(textnode)
        break
      case 'tools-group':
        textnode = document.createTextNode(newValue)
        this.$groupLink?.prepend(textnode)
        break
      case 'tools-ungroup':
        textnode = document.createTextNode(newValue)
        this.$ungroupLink?.prepend(textnode)
        break
      case 'tools-move_front':
        textnode = document.createTextNode(newValue)
        this.$moveFrontLink?.prepend(textnode)
        break
      case 'tools-move_up':
        textnode = document.createTextNode(newValue)
        this.$moveUpLink?.prepend(textnode)
        break
      case 'tools-move_down':
        textnode = document.createTextNode(newValue)
        this.$moveDownLink?.prepend(textnode)
        break
      case 'tools-move_back':
        textnode = document.createTextNode(newValue)
        this.$moveBackLink?.prepend(textnode)
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
  get disableallmenu (): string | null {
    return this.getAttribute('disableallmenu')
  }

  /**
   * @function set
   * @returns {void}
   */
  set disableallmenu (value: string) {
    this.setAttribute('disableallmenu', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get enablemenuitems (): string | null {
    return this.getAttribute('enablemenuitems')
  }

  /**
   * @function set
   * @returns {void}
   */
  set enablemenuitems (value: string) {
    this.setAttribute('enablemenuitems', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get disablemenuitems (): string | null {
    return this.getAttribute('disablemenuitems')
  }

  /**
   * @function set
   * @returns {void}
   */
  set disablemenuitems (value: string) {
    this.setAttribute('disablemenuitems', value)
  }

  /**
   * @function connectedCallback
   * @returns {void}
   */
  connectedCallback (): void {
    const current = this
    const onMenuOpenHandler = (e: MouseEvent): void => {
      e.preventDefault()
      // Detect mouse position
      let x = e.pageX
      let y = e.pageY

      // TODO: see todo #10 — uses screen.* instead of window.inner* (UX bug, fix deferred)
      const xOff = screen.width - 250 // menu width
      const yOff = screen.height - (276 + 150) // menu height + bottom panel height and scroll bar

      if (x > xOff) {
        x = xOff
      }
      if (y > yOff) {
        y = yOff
      }
      if (current.$dialog) {
        current.$dialog.style.top = y + 'px'
        current.$dialog.style.left = x + 'px'
        current.$dialog.style.display = 'block'
      }
    }
    const onMenuCloseHandler = (e: MouseEvent): void => {
      if (e.button !== 2) {
        if (current.$dialog) current.$dialog.style.display = 'none'
      }
    }
    const onMenuClickHandler = (_e: Event, action: string): void => {
      const triggerEvent = new CustomEvent('change', {
        detail: {
          trigger: action
        }
      })
      this.dispatchEvent(triggerEvent)
    }
    if (this._workarea) {
      this._workarea.addEventListener('contextmenu', onMenuOpenHandler as EventListener)
      this._workarea.addEventListener('mousedown', onMenuCloseHandler as EventListener)
    }
    svgEditor.$click(this.$cutLink as EventTarget, (evt) => onMenuClickHandler(evt, 'cut'))
    svgEditor.$click(this.$copyLink as EventTarget, (evt) => onMenuClickHandler(evt, 'copy'))
    svgEditor.$click(this.$pasteLink as EventTarget, (evt) => onMenuClickHandler(evt, 'paste'))
    svgEditor.$click(this.$pasteInPlaceLink as EventTarget, (evt) => onMenuClickHandler(evt, 'paste_in_place'))
    svgEditor.$click(this.$deleteLink as EventTarget, (evt) => onMenuClickHandler(evt, 'delete'))
    svgEditor.$click(this.$groupLink as EventTarget, (evt) => onMenuClickHandler(evt, 'group'))
    svgEditor.$click(this.$ungroupLink as EventTarget, (evt) => onMenuClickHandler(evt, 'ungroup'))
    svgEditor.$click(this.$moveFrontLink as EventTarget, (evt) => onMenuClickHandler(evt, 'move_front'))
    svgEditor.$click(this.$moveUpLink as EventTarget, (evt) => onMenuClickHandler(evt, 'move_up'))
    svgEditor.$click(this.$moveDownLink as EventTarget, (evt) => onMenuClickHandler(evt, 'move_down'))
    svgEditor.$click(this.$moveBackLink as EventTarget, (evt) => onMenuClickHandler(evt, 'move_back'))
  }
}

// Register
customElements.define('se-cmenu_canvas-dialog', SeCMenuDialog)
