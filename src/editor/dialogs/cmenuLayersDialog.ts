/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-this-alias */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration
import cMenuLayersDialog from './cmenuLayersDialog.html'

const template = document.createElement('template')
 
template.innerHTML = cMenuLayersDialog as string

declare const svgEditor: SvgEditorGlobal

/**
 * @class SeCMenuLayerDialog
 */
export class SeCMenuLayerDialog extends HTMLElement {
  declare _shadowRoot: ShadowRoot
  declare source: string
  declare _workarea: Element | undefined
  declare $sidePanels: Element | null
  declare $dialog: HTMLElement | null
  declare $duplicateLink: Element | null
  declare $deleteLink: Element | null
  declare $mergeDownLink: Element | null
  declare $mergeAllLink: Element | null

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this.source = ''
    this._workarea = undefined
    this.$sidePanels = document.getElementById('sidepanels')
    this.$dialog = this._shadowRoot.querySelector('#cmenu_layers')
    this.$duplicateLink = this._shadowRoot.querySelector('#se-dupe')
    this.$deleteLink = this._shadowRoot.querySelector('#se-layer-delete')
    this.$mergeDownLink = this._shadowRoot.querySelector('#se-merge-down')
    this.$mergeAllLink = this._shadowRoot.querySelector('#se-merge-all')
  }

  /**
   * @function init
   * @param {any} name
   * @returns {void}
   */
   
  init (i18next: any): void {
    this.setAttribute('layers-dupe', i18next.t('layers.dupe'))
    this.setAttribute('layers-del', i18next.t('layers.del'))
    this.setAttribute('layers-merge_down', i18next.t('layers.merge_down'))
    this.setAttribute('layers-merge_all', i18next.t('layers.merge_all'))
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes (): string[] {
    return ['value', 'leftclick', 'layers-dupe', 'layers-del', 'layers-merge_down', 'layers-merge_all']
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
      case 'value':
        this.source = newValue
        if (newValue !== '' && newValue !== undefined) {
          this._workarea = document.getElementById(this.source) ?? undefined
        }
        break
      case 'layers-dupe':
        if (this.$duplicateLink) this.$duplicateLink.textContent = newValue
        break
      case 'layers-del':
        if (this.$deleteLink) this.$deleteLink.textContent = newValue
        break
      case 'layers-merge_down':
        if (this.$mergeDownLink) this.$mergeDownLink.textContent = newValue
        break
      case 'layers-merge_all':
        if (this.$mergeAllLink) this.$mergeAllLink.textContent = newValue
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
  get value (): string | null {
    return this.getAttribute('value')
  }

  /**
   * @function set
   * @returns {void}
   */
  set value (value: string) {
    this.setAttribute('value', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get leftclick (): string | null {
    return this.getAttribute('leftclick')
  }

  /**
   * @function set
   * @returns {void}
   */
  set leftclick (value: string) {
    this.setAttribute('leftclick', value)
  }

  /**
   * @function connectedCallback
   * @returns {void}
   */
  connectedCallback (): void {
    const current = this
    const onMenuOpenHandler = (e: MouseEvent): void => {
      e.preventDefault()
      if (current.$dialog) {
        current.$dialog.style.top = e.pageY + 'px'
        current.$dialog.style.left = e.pageX - 126 + 'px'
        current.$dialog.style.display = 'block'
      }
    }
    const onMenuCloseHandler = (e: MouseEvent): void => {
      if (e.button !== 2) {
        if (current.$dialog) current.$dialog.style.display = 'none'
      }
    }
    const onMenuClickHandler = (_e: Event, action: string, id: string): void => {
      const triggerEvent = new CustomEvent('change', {
        detail: {
          trigger: action,
          source: id
        }
      })
      this.dispatchEvent(triggerEvent)
      if (current.$dialog) current.$dialog.style.display = 'none'
    }
    if (this._workarea !== undefined) {
      this._workarea.addEventListener('contextmenu', onMenuOpenHandler as EventListener)
      if (this.getAttribute('leftclick') === 'true') {
        svgEditor.$click(this._workarea, onMenuOpenHandler as EventListener)
      }
      this._workarea.addEventListener('mousedown', onMenuCloseHandler as EventListener)
      this.$sidePanels?.addEventListener('mousedown', onMenuCloseHandler as EventListener)
    }
    svgEditor.$click(this.$duplicateLink as EventTarget, (evt) => onMenuClickHandler(evt, 'dupe', this.source))
    svgEditor.$click(this.$deleteLink as EventTarget, (evt) => onMenuClickHandler(evt, 'delete', this.source))
    svgEditor.$click(this.$mergeDownLink as EventTarget, (evt) => onMenuClickHandler(evt, 'merge_down', this.source))
    svgEditor.$click(this.$mergeAllLink as EventTarget, (evt) => onMenuClickHandler(evt, 'merge_all', this.source))
  }
}

// Register
customElements.define('se-cmenu-layers', SeCMenuLayerDialog)
