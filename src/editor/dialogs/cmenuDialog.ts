import { html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { styleMap } from 'lit/directives/style-map.js'
import SvgCanvas from '@svgedit/svgcanvas'
import { CMenuDialogBase } from './cmenuDialogBase.js'
import { contextMenuStyles } from './contextMenuStyles.js'

const { $id } = SvgCanvas

/** Context menu dialog for canvas operations, mapping right-click position and actions to edit commands */
@customElement('se-cmenu_canvas-dialog')
export class SeCMenuCanvasDialog extends CMenuDialogBase {
  static styles = contextMenuStyles

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

  private _onItemClick = (e: Event, action: string, disabled: boolean): void => {
    e.preventDefault()
    // Disabled items are inert (the `.disabled` class was visual-only before #3).
    if (disabled) return
    this._dispatchMenuChange(action)
  }

  private _enabledItems(): HTMLAnchorElement[] {
    return [...(this.shadowRoot?.querySelectorAll<HTMLAnchorElement>(
      'a[role="menuitem"]:not([aria-disabled="true"])'
    ) ?? [])]
  }

  // Roving-focus keyboard support for the WAI-ARIA `menu` pattern (#3): Arrow/Home/End
  // move focus, Enter/Space activate the focused item, Escape closes.
  private _onMenuKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { this.menuOpen = false; return }
    const items = this._enabledItems()
    if (!items.length) return
    const active = this.shadowRoot?.activeElement as HTMLAnchorElement | null
    const idx = active ? items.indexOf(active) : -1
    let next: number
    switch (e.key) {
      case 'ArrowDown': next = (idx + 1) % items.length; break
      case 'ArrowUp': next = (idx - 1 + items.length) % items.length; break
      case 'Home': next = 0; break
      case 'End': next = items.length - 1; break
      case 'Enter': case ' ':
        if (idx >= 0) { e.preventDefault(); items[idx]?.click() }
        return
      default: return
    }
    e.preventDefault()
    items[next]?.focus()
  }

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

  updated(changed: Map<string, unknown>): void {
    // On open, move focus into the menu so arrow keys + Enter work (WAI-ARIA menu, #3).
    if (changed.has('menuOpen') && this.menuOpen) {
      this._enabledItems()[0]?.focus()
    }
  }

  render() {
    const items: Array<{ action: string; label: string; shortcut?: string; separator?: boolean }> = [
      { action: 'cut', label: this.toolsCut, shortcut: 'META+X' },
      { action: 'copy', label: this.toolsCopy, shortcut: 'META+C' },
      { action: 'paste', label: this.toolsPaste },
      { action: 'paste_in_place', label: this.toolsPasteInPlace },
      { action: 'delete', label: this.toolsDelete, shortcut: 'BACKSPACE', separator: true },
      { action: 'group', label: this.toolsGroup, shortcut: 'G', separator: true },
      { action: 'ungroup', label: this.toolsUngroup, shortcut: 'G' },
      { action: 'move_front', label: this.toolsMoveFront, shortcut: 'CTRL+SHFT+]', separator: true },
      { action: 'move_up', label: this.toolsMoveUp, shortcut: 'CTRL+]' },
      { action: 'move_down', label: this.toolsMoveDown, shortcut: 'CTRL+[' },
      { action: 'move_back', label: this.toolsMoveBack, shortcut: 'CTRL+SHFT+[' }
    ]
    return html`
      <ul
        id="cmenu_canvas"
        class="contextMenu"
        role="menu"
        aria-label="Canvas context menu"
        @keydown=${this._onMenuKeydown}
        style=${styleMap({
          display: this.menuOpen ? 'block' : 'none',
          top: this.menuTop,
          left: this.menuLeft
        })}
      >
        ${items.map((item) => {
          const disabled = this._isDisabled(item.action)
          return html`
            <li role="presentation" class=${classMap({ separator: !!item.separator, disabled })}>
              <a
                href="#${item.action}"
                id="se-${item.action.replace(/_/g, '-')}"
                role="menuitem"
                tabindex="-1"
                aria-disabled=${disabled ? 'true' : 'false'}
                @click=${(e: Event) => this._onItemClick(e, item.action, disabled)}
              >${item.label}${item.shortcut ? html`<span class="shortcut">${item.shortcut}</span>` : ''}</a>
            </li>
          `
        })}
      </ul>
    `
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this._workarea = $id('workarea')
    this._attachWorkareaListeners()
  }

  protected _bindWorkareaListeners(workarea: Element): void {
    workarea.addEventListener('contextmenu', this._onMenuOpen as EventListener)
    workarea.addEventListener('mousedown', this._onMenuClose as EventListener)
  }

  protected _unbindWorkareaListeners(): void {
    this._workarea?.removeEventListener('contextmenu', this._onMenuOpen as EventListener)
    this._workarea?.removeEventListener('mousedown', this._onMenuClose as EventListener)
  }
}
