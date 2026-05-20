// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration
import editorPreferencesDialog from './editorPreferencesDialog.html'

declare const svgEditor: SvgEditorGlobal

const template = document.createElement('template')
template.innerHTML = editorPreferencesDialog as string // eslint-disable-line @typescript-eslint/no-unsafe-assignment
/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- static HTML template */
/**
 * @class SeEditPrefsDialog
 */
export class SeEditPrefsDialog extends HTMLElement {
  declare colorBlocks: string[]
  declare _shadowRoot: ShadowRoot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $dialog: any
  declare $saveBtn: Element | null
  declare $cancelBtn: Element | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $langSelect: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $bgBlocks: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $bgURL: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $gridSnappingOn: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $gridSnappingStep: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $gridColor: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $showRulers: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare $baseUnit: any

  /**
    * @function constructor
    */
  constructor () {
    super()
    // create the shadowDom and insert the template
    this.colorBlocks = ['#FFF', '#888', '#000', 'chessboard']
    this._shadowRoot = this.attachShadow({ mode: 'open' })
    this._shadowRoot.append(template.content.cloneNode(true))
    this.$dialog = this._shadowRoot.querySelector('#svg_prefs')
    this.$saveBtn = this._shadowRoot.querySelector('#tool_prefs_save')
    this.$cancelBtn = this._shadowRoot.querySelector('#tool_prefs_cancel')
    this.$langSelect = this._shadowRoot.querySelector('#lang_select')
    this.$bgBlocks = this._shadowRoot.querySelector('#bg_blocks')
    this.$bgURL = this._shadowRoot.querySelector('#canvas_bg_url')
    this.$gridSnappingOn = this._shadowRoot.querySelector('#grid_snapping_on')
    this.$gridSnappingStep = this._shadowRoot.querySelector('#grid_snapping_step')
    this.$gridColor = this._shadowRoot.querySelector('#grid_color')
    this.$showRulers = this._shadowRoot.querySelector('#show_rulers')
    this.$baseUnit = this._shadowRoot.querySelector('#base_unit')
  }

  /**
   * @function init
   * @param {any} name
   * @returns {void}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  init (i18next: any): void {
    this.setAttribute('common-ok', i18next.t('common.ok'))
    this.setAttribute('common-cancel', i18next.t('common.cancel'))
    this.setAttribute('config-editor_prefs', i18next.t('config.editor_prefs'))
    this.setAttribute('config-language', i18next.t('config.language'))
    this.setAttribute('config-background', i18next.t('config.background'))
    this.setAttribute('common-url', i18next.t('common.url'))
    this.setAttribute('config-editor_bg_note', i18next.t('config.editor_bg_note'))
    this.setAttribute('config-grid', i18next.t('config.grid'))
    this.setAttribute('config-snapping_onoff', i18next.t('config.snapping_onoff'))
    this.setAttribute('config-snapping_stepsize', i18next.t('config.snapping_stepsize'))
    this.setAttribute('config-grid_color', i18next.t('config.grid_color'))
    this.setAttribute('config-units_and_rulers', i18next.t('config.units_and_rulers'))
    this.setAttribute('config-show_rulers', i18next.t('config.show_rulers'))
    this.setAttribute('config-base_unit', i18next.t('config.base_unit'))
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes (): string[] {
    // eslint-disable-next-line max-len
    return ['dialog', 'lang', 'canvasbg', 'bgurl', 'gridsnappingon', 'gridsnappingstep', 'gridcolor', 'showrulers', 'baseunit', 'common-ok', 'common-cancel', 'config-editor_prefs', 'config-language', 'config-background', 'common-url', 'config-editor_bg_note', 'config-grid', 'config-snapping_onoff', 'config-snapping_stepsize', 'config-grid_color', 'config-units_and_rulers', 'config-show_rulers', 'config-base_unit']
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any = this.$bgBlocks.querySelectorAll('div')
    const curBg = 'cur_background'
    let node: Element | null
    switch (name) {
      case 'dialog':
        if (newValue === 'open') {
          this.$dialog.open()
        } else {
          this.$dialog.close()
        }
        break
      case 'lang':
        this.$langSelect.value = newValue
        break
      case 'canvasbg':
        if (!newValue) {
          if (blocks.length > 0) {
            blocks[0].classList.add(curBg)
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          blocks.forEach(function (blk: any) {
            const isBg = blk.dataset.bgColor === newValue
            if (isBg) {
              blk.classList.add(curBg)
            } else {
              blk.classList.remove(curBg)
            }
          })
        }
        break
      case 'bgurl':
        this.$bgURL.value = newValue
        break
      case 'gridsnappingon':
        if (newValue === 'true') {
          this.$gridSnappingOn.checked = true
        } else if (newValue === 'false') {
          this.$gridSnappingOn.checked = false
        }
        break
      case 'gridsnappingstep':
        this.$gridSnappingStep.value = newValue
        break
      case 'gridcolor':
        this.$gridColor.value = newValue
        break
      case 'showrulers':
        if (newValue === 'true') {
          this.$showRulers.checked = true
        } else if (newValue === 'false') {
          this.$showRulers.checked = false
        }
        break
      case 'baseunit':
        this.$baseUnit.value = newValue
        break
      case 'common-ok':
        if (this.$saveBtn) this.$saveBtn.textContent = newValue
        break
      case 'common-cancel':
        if (this.$cancelBtn) this.$cancelBtn.textContent = newValue
        break
      case 'config-editor_prefs':
        node = this._shadowRoot.querySelector('#svginfo_editor_prefs')
        if (node) node.textContent = newValue
        break
      case 'config-language':
        node = this._shadowRoot.querySelector('#svginfo_lang')
        if (node) node.textContent = newValue
        break
      case 'config-background':
        node = this._shadowRoot.querySelector('#svginfo_change_background')
        if (node) node.textContent = newValue
        break
      case 'common-url':
        node = this._shadowRoot.querySelector('#svginfo_bg_url')
        if (node) node.textContent = newValue
        break
      case 'config-editor_bg_note':
        node = this._shadowRoot.querySelector('#svginfo_bg_note')
        if (node) node.textContent = newValue
        break
      case 'config-grid':
        node = this._shadowRoot.querySelector('#svginfo_grid_settings')
        if (node) node.textContent = newValue
        break
      case 'config-snapping_onoff':
        node = this._shadowRoot.querySelector('#svginfo_snap_onoff')
        if (node) node.textContent = newValue
        break
      case 'config-snapping_stepsize':
        node = this._shadowRoot.querySelector('#svginfo_snap_step')
        if (node) node.textContent = newValue
        break
      case 'config-grid_color':
        node = this._shadowRoot.querySelector('#svginfo_grid_color')
        if (node) node.textContent = newValue
        break
      case 'config-units_and_rulers':
        node = this._shadowRoot.querySelector('#svginfo_units_rulers')
        if (node) node.textContent = newValue
        break
      case 'config-show_rulers':
        node = this._shadowRoot.querySelector('#svginfo_rulers_onoff')
        if (node) node.textContent = newValue
        break
      case 'config-base_unit':
        node = this._shadowRoot.querySelector('#svginfo_unit')
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
   * @returns {any}
   */
  get lang (): string {
    return this.getAttribute('lang') ?? ''
  }

  /**
   * @function set
   * @returns {void}
   */
  set lang (value: string) {
    this.setAttribute('lang', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get canvasbg (): string | null {
    return this.getAttribute('canvasbg')
  }

  /**
   * @function set
   * @returns {void}
   */
  set canvasbg (value: string) {
    this.setAttribute('canvasbg', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get bgurl (): string | null {
    return this.getAttribute('bgurl')
  }

  /**
   * @function set
   * @returns {void}
   */
  set bgurl (value: string) {
    this.setAttribute('bgurl', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get dialog (): string | null {
    return this.getAttribute('dialog')
  }

  /**
   * @function set
   * @returns {void}
   */
  set dialog (value: string) {
    this.setAttribute('dialog', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get gridsnappingon (): string | null {
    return this.getAttribute('gridsnappingon')
  }

  /**
   * @function set
   * @returns {void}
   */
  set gridsnappingon (value: string) {
    this.setAttribute('gridsnappingon', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get gridsnappingstep (): string | null {
    return this.getAttribute('gridsnappingstep')
  }

  /**
   * @function set
   * @returns {void}
   */
  set gridsnappingstep (value: string) {
    this.setAttribute('gridsnappingstep', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get gridcolor (): string | null {
    return this.getAttribute('gridcolor')
  }

  /**
   * @function set
   * @returns {void}
   */
  set gridcolor (value: string) {
    this.setAttribute('gridcolor', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get showrulers (): string | null {
    return this.getAttribute('showrulers')
  }

  /**
   * @function set
   * @returns {void}
   */
  set showrulers (value: string) {
    this.setAttribute('showrulers', value)
  }

  /**
   * @function get
   * @returns {any}
   */
  get baseunit (): string | null {
    return this.getAttribute('baseunit')
  }

  /**
   * @function set
   * @returns {void}
   */
  set baseunit (value: string) {
    this.setAttribute('baseunit', value)
  }

  /**
   * @function connectedCallback
   * @returns {void}
   */
  connectedCallback (): void {
    const onCancelHandler = () => {
      const closeEvent = new CustomEvent('change', {
        detail: {
          dialog: 'closed'
        }
      })
      this.dispatchEvent(closeEvent)
    }
    const onSaveHandler = () => {
      const color = this.$bgBlocks.querySelector('.cur_background').dataset.bgColor || '#FFF'
      const closeEvent = new CustomEvent('change', {
        detail: {
          lang: this.$langSelect.value,
          dialog: 'close',
          bgcolor: color,
          bgurl: this.$bgURL.value,
          gridsnappingon: this.$gridSnappingOn.checked,
          gridsnappingstep: this.$gridSnappingStep.value,
          showrulers: this.$showRulers.checked,
          baseunit: this.$baseUnit.value
        }
      })
      this.dispatchEvent(closeEvent)
    }
    // Set up editor background functionality
    const currentObj = this
    this.colorBlocks.forEach(function (e) {
      const newdiv = document.createElement('div')
      if (e === 'chessboard') {
        newdiv.dataset.bgColor = e
        newdiv.style.backgroundImage = 'url(data:image/gif;base64,R0lGODlhEAAQAIAAAP///9bW1iH5BAAAAAAALAAAAAAQABAAAAIfjG+gq4jM3IFLJgpswNly/XkcBpIiVaInlLJr9FZWAQA7)'
        newdiv.classList.add('color_block')
      } else {
        newdiv.dataset.bgColor = e // setAttribute('data-bgcolor', e);
        newdiv.style.backgroundColor = e
        newdiv.classList.add('color_block')
      }
      currentObj.$bgBlocks.append(newdiv)
    })
    const blocks = this.$bgBlocks.querySelectorAll('div')
    const curBg = 'cur_background'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blocks.forEach(function (blk: any) {
      svgEditor.$click(blk, function () {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blocks.forEach((el: any) => el.classList.remove(curBg))
        blk.classList.add(curBg)
      })
    })
    svgEditor.$click(this.$saveBtn as EventTarget, onSaveHandler)
    svgEditor.$click(this.$cancelBtn as EventTarget, onCancelHandler)
    this.$dialog.addEventListener('close', onCancelHandler)
  }
}

// Register
// eslint-disable-next-line @typescript-eslint/no-explicit-any
customElements.define('se-edit-prefs-dialog', SeEditPrefsDialog as any)
