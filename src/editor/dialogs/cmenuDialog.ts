import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { styleMap } from 'lit/directives/style-map.js'
import SvgCanvas from '@svgedit/svgcanvas'

const { $id } = SvgCanvas

/** Context menu dialog for canvas operations, mapping right-click position and actions to edit commands */
@customElement('se-cmenu_canvas-dialog')
export class SeCMenuCanvasDialog extends LitElement {
  static styles = css`
    .contextMenu {
      position: absolute;
      z-index: 99999;
      border: solid 1px var(--se-border);
      background: var(--se-surface);
      padding: 5px 0;
      margin: 0px;
      font: 12px/15px var(--se-font-sans);
      border-radius: var(--se-radius-sm);
      box-shadow: var(--se-shadow-overlay);
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
      color: var(--se-text);
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
      background-color: var(--se-accent);
      color: var(--se-on-accent);
      cursor: default;
    }

    .contextMenu li.disabled a {
      color: var(--se-text-muted);
      pointer-events: none;
    }

    .contextMenu li.hover.disabled a {
      background-color: transparent;
    }

    .contextMenu li.separator {
      border-top: solid 1px var(--se-border);
      padding-top: 5px;
      margin-top: 5px;
    }
  `

  @property({ attribute: 'tools-cut' }) accessor toolsCut = ''
  @property({ attribute: 'tools-copy' }) accessor toolsCopy = ''
  @property({ attribute: 'tools-paste' }) accessor toolsPaste = ''
  @property({ attribute: 'tools-paste_in_place' }) accessor toolsPasteInPlace = ''
  @property({ attribute: 'tools-delete' }) accessor toolsDelete = ''
  @property({ attribute: 'tools-group' }) accessor toolsGroup = ''
  @property({ attribute: 'tools-ungroup' }) accessor toolsUngroup = ''
  @property({ attribute: 'tools-move_front' }) accessor toolsMoveFront = ''
  @property({ attribute: 'tools-move_up' }) accessor toolsMoveUp = ''
  @property({ attribute: 'tools-move_down' }) accessor toolsMoveDown = ''
  @property({ attribute: 'tools-move_back' }) accessor toolsMoveBack = ''
  @property() accessor disableallmenu = ''
  @property() accessor enablemenuitems = ''
  @property() accessor disablemenuitems = ''

  @state() private accessor menuOpen = false
  @state() private accessor menuTop = '0px'
  @state() private accessor menuLeft = '0px'

  private _workarea: Element | null = null
  private _workareaListenersAttached = false

  init(i18next: { t: (key: string) => string }): void {
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

  private _onMenuOpen = (e: MouseEvent): void => {
    e.preventDefault()
    // Detect mouse position
    let x = e.pageX
    let y = e.pageY

    const xOff = window.innerWidth - 250
    const yOff = window.innerHeight - (276 + 150)

    if (x > xOff) {
      x = xOff
    }
    if (y > yOff) {
      y = yOff
    }
    this.menuTop = y + 'px'
    this.menuLeft = x + 'px'
    this.menuOpen = true
  }

  private _onMenuClose = (e: MouseEvent): void => {
    if (e.button !== 2) {
      this.menuOpen = false
    }
  }

  private _dispatchMenuChange = (action: string): void => {
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        trigger: action
      }
    }))
  }

  private _onCut = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('cut') }
  private _onCopy = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('copy') }
  private _onPaste = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('paste') }
  private _onPasteInPlace = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('paste_in_place') }
  private _onDelete = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('delete') }
  private _onGroup = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('group') }
  private _onUngroup = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('ungroup') }
  private _onMoveFront = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('move_front') }
  private _onMoveUp = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('move_up') }
  private _onMoveDown = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('move_down') }
  private _onMoveBack = (e: Event): void => { e.preventDefault(); this._dispatchMenuChange('move_back') }

  private _isDisabled(action: string): boolean {
    // The external API uses href-style tokens: '#cut', '#copy', etc.
    const token = '#' + action
    if (this.disableallmenu === 'true') {
      // If enablemenuitems is also set, those items are re-enabled
      if (this.enablemenuitems) {
        const enabled = this.enablemenuitems.split(',').map(s => s.trim())
        if (enabled.includes(token)) return false
      }
      return true
    }
    if (this.disablemenuitems) {
      const disabled = this.disablemenuitems.split(',').map(s => s.trim())
      if (disabled.includes(token)) return true
    }
    return false
  }

  render() {
    return html`
      <ul id="cmenu_canvas" class="contextMenu" style=${styleMap({
        display: this.menuOpen ? 'block' : 'none',
        top: this.menuTop,
        left: this.menuLeft
      })}>
        <li class=${classMap({ disabled: this._isDisabled('cut') })}>
          <a href="#cut" id="se-cut" @click=${this._onCut}>${this.toolsCut}<span class="shortcut">META+X</span></a>
        </li>
        <li class=${classMap({ disabled: this._isDisabled('copy') })}>
          <a href="#copy" id="se-copy" @click=${this._onCopy}>${this.toolsCopy}<span class="shortcut">META+C</span></a>
        </li>
        <li class=${classMap({ disabled: this._isDisabled('paste') })}>
          <a href="#paste" id="se-paste" @click=${this._onPaste}>${this.toolsPaste}</a>
        </li>
        <li class=${classMap({ disabled: this._isDisabled('paste_in_place') })}>
          <a href="#paste_in_place" id="se-paste-in-place" @click=${this._onPasteInPlace}>${this.toolsPasteInPlace}</a>
        </li>
        <li class=${classMap({ separator: true, disabled: this._isDisabled('delete') })}>
          <a href="#delete" id="se-delete" @click=${this._onDelete}>${this.toolsDelete}<span class="shortcut">BACKSPACE</span></a>
        </li>
        <li class=${classMap({ separator: true, disabled: this._isDisabled('group') })}>
          <a href="#group" id="se-group" @click=${this._onGroup}>${this.toolsGroup}<span class="shortcut">G</span></a>
        </li>
        <li class=${classMap({ disabled: this._isDisabled('ungroup') })}>
          <a href="#ungroup" id="se-ungroup" @click=${this._onUngroup}>${this.toolsUngroup}<span class="shortcut">G</span></a>
        </li>
        <li class=${classMap({ separator: true, disabled: this._isDisabled('move_front') })}>
          <a href="#move_front" id="se-move-front" @click=${this._onMoveFront}>${this.toolsMoveFront}<span class="shortcut">CTRL+SHFT+]</span></a>
        </li>
        <li class=${classMap({ disabled: this._isDisabled('move_up') })}>
          <a href="#move_up" id="se-move-up" @click=${this._onMoveUp}>${this.toolsMoveUp}<span class="shortcut">CTRL+]</span></a>
        </li>
        <li class=${classMap({ disabled: this._isDisabled('move_down') })}>
          <a href="#move_down" id="se-move-down" @click=${this._onMoveDown}>${this.toolsMoveDown}<span class="shortcut">CTRL+[</span></a>
        </li>
        <li class=${classMap({ disabled: this._isDisabled('move_back') })}>
          <a href="#move_back" id="se-move-back" @click=${this._onMoveBack}>${this.toolsMoveBack}<span class="shortcut">CTRL+SHFT+[</span></a>
        </li>
      </ul>
    `
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this._workarea = $id('workarea')
    this._attachWorkareaListeners()
  }

  private _attachWorkareaListeners(): void {
    if (this._workareaListenersAttached || this._workarea === null) return
    this._workareaListenersAttached = true
    this._workarea.addEventListener('contextmenu', this._onMenuOpen as EventListener)
    this._workarea.addEventListener('mousedown', this._onMenuClose as EventListener)
  }

  private _detachWorkareaListeners(): void {
    if (!this._workareaListenersAttached) return
    this._workarea?.removeEventListener('contextmenu', this._onMenuOpen as EventListener)
    this._workarea?.removeEventListener('mousedown', this._onMenuClose as EventListener)
    this._workareaListenersAttached = false
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._detachWorkareaListeners()
  }
}
