/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
// i18next is passed as `any` from the editor; typing deferred to #3 (full i18n type pass)
import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { styleMap } from 'lit/directives/style-map.js'
import SvgCanvas from '@svgedit/svgcanvas'

const { $id } = SvgCanvas

@customElement('se-cmenu-layers')
export class SeCMenuLayersDialog extends LitElement {
  static styles = css`
    .contextMenu {
      position: absolute;
      z-index: 99999;
      border: solid 1px rgba(0, 0, 0, .33);
      background: rgba(255, 255, 255, .95);
      padding: 5px 0;
      margin: 0px;
      font: 12px/15px Lucida Sans, Helvetica, Verdana, sans-serif;
      border-radius: 5px;
      -moz-border-radius: 5px;
      -moz-box-shadow: 2px 5px 10px rgba(0, 0, 0, .3);
      -webkit-box-shadow: 2px 5px 10px rgba(0, 0, 0, .3);
      box-shadow: 2px 5px 10px rgba(0, 0, 0, .3);
    }

    .contextMenu li {
      list-style: none;
      padding: 0px;
      margin: 0px;
    }

    .contextMenu .shortcut {
      width: 115px;
      text-align: right;
      float: right;
    }

    .contextMenu a {
      -moz-user-select: none;
      -webkit-user-select: none;
      user-select: none;
      color: #222;
      text-decoration: none;
      display: block;
      line-height: 20px;
      height: 20px;
      background-position: 6px center;
      background-repeat: no-repeat;
      outline: none;
      padding: 0px 15px 1px 20px;
    }

    .contextMenu li.hover a {
      background-color: #2e5dea;
      color: white;
      cursor: default;
    }

    .contextMenu li.disabled a {
      color: #999;
      pointer-events: none;
    }

    .contextMenu li.hover.disabled a {
      background-color: transparent;
    }

    .contextMenu li.separator {
      border-top: solid 1px #E3E3E3;
      padding-top: 5px;
      margin-top: 5px;
    }
  `

  @property() accessor value = ''
  @property() accessor leftclick = ''
  @property({ attribute: 'layers-dupe' }) accessor layersDupe = ''
  @property({ attribute: 'layers-del' }) accessor layersDel = ''
  @property({ attribute: 'layers-merge_down' }) accessor layersMergeDown = ''
  @property({ attribute: 'layers-merge_all' }) accessor layersMergeAll = ''

  @state() private accessor menuOpen = false
  @state() private accessor menuTop = '0px'
  @state() private accessor menuLeft = '0px'

  source = ''
  private _workarea: Element | undefined
  private _sidePanels: Element | null = null
  private _workareaListenersAttached = false

  init(i18next: any): void {
    this.setAttribute('layers-dupe', i18next.t('layers.dupe'))
    this.setAttribute('layers-del', i18next.t('layers.del'))
    this.setAttribute('layers-merge_down', i18next.t('layers.merge_down'))
    this.setAttribute('layers-merge_all', i18next.t('layers.merge_all'))
  }

  private _onMenuOpen = (e: MouseEvent): void => {
    e.preventDefault()
    this.menuTop = e.pageY + 'px'
    this.menuLeft = (e.pageX - 126) + 'px'
    this.menuOpen = true
  }

  private _onMenuClose = (e: MouseEvent): void => {
    if (e.button !== 2) {
      this.menuOpen = false
    }
  }

  private _dispatchMenuChange(action: string): void {
    const triggerEvent = new CustomEvent('change', {
      detail: {
        trigger: action,
        source: this.source
      }
    })
    this.dispatchEvent(triggerEvent)
    this.menuOpen = false
  }

  private _onDupe = (e: Event): void => {
    e.preventDefault()
    this._dispatchMenuChange('dupe')
  }

  private _onDelete = (e: Event): void => {
    e.preventDefault()
    this._dispatchMenuChange('delete')
  }

  private _onMergeDown = (e: Event): void => {
    e.preventDefault()
    this._dispatchMenuChange('merge_down')
  }

  private _onMergeAll = (e: Event): void => {
    e.preventDefault()
    this._dispatchMenuChange('merge_all')
  }

  render() {
    return html`
      <ul id="cmenu_layers" class="contextMenu" style=${styleMap({
        display: this.menuOpen ? 'block' : 'none',
        top: this.menuTop,
        left: this.menuLeft
      })}>
        <li><a href="#dupe" id="se-dupe" @click=${this._onDupe}>${this.layersDupe}</a></li>
        <li><a href="#delete" id="se-layer-delete" @click=${this._onDelete}>${this.layersDel}</a></li>
        <li><a href="#merge_down" id="se-merge-down" @click=${this._onMergeDown}>${this.layersMergeDown}</a></li>
        <li><a href="#merge_all" id="se-merge-all" @click=${this._onMergeAll}>${this.layersMergeAll}</a></li>
      </ul>
    `
  }

  override updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('value')) {
      const newValue = this.value
      this.source = newValue
      if (newValue !== '' && newValue !== undefined) {
        this._detachWorkareaListeners()
        this._workarea = $id(newValue) ?? undefined
        this._attachWorkareaListeners()
      }
    }
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.value !== '') {
      this.source = this.value
      this._workarea = $id(this.value) ?? undefined
    }
    this._attachWorkareaListeners()
  }

  private _attachWorkareaListeners(): void {
    if (this._workareaListenersAttached || this._workarea === undefined) return
    this._workareaListenersAttached = true
    this._workarea.addEventListener('contextmenu', this._onMenuOpen as EventListener)
    if (this.leftclick === 'true') {
      this._workarea.addEventListener('click', this._onMenuOpen as EventListener)
    }
    this._workarea.addEventListener('mousedown', this._onMenuClose as EventListener)
    this._sidePanels = $id('sidepanels')
    this._sidePanels?.addEventListener('mousedown', this._onMenuClose as EventListener)
  }

  private _detachWorkareaListeners(): void {
    if (!this._workareaListenersAttached) return
    this._workarea?.removeEventListener('contextmenu', this._onMenuOpen as EventListener)
    if (this.leftclick === 'true') {
      this._workarea?.removeEventListener('click', this._onMenuOpen as EventListener)
    }
    this._workarea?.removeEventListener('mousedown', this._onMenuClose as EventListener)
    this._sidePanels?.removeEventListener('mousedown', this._onMenuClose as EventListener)
    this._sidePanels = null
    this._workareaListenersAttached = false
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._detachWorkareaListeners()
  }
}
