import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import SvgCanvas from '@svgedit/svgcanvas'
import { getSvgEditor } from '../svgEditorInstance.js'
import { boolAttr, maskImageStyle, seIconMask } from './component-utils.js'

const { $id } = SvgCanvas

/**
 * SeExplorerButton — toolbar explorer button with shape library and menu popups.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-explorerbutton`
 *   - Attributes: `title`, `pressed`, `disabled`, `lib`, `src` (observed)
 *   - Attribute: `shortcut` (read at render time for tooltip composition; not observed)
 *   - Consumer: ext-shapes uses `id="tool_shapelib"` on host — default Lit behavior correct
 *
 * Behavioral fix (this conversion):
 *   - Drops the touchend half of the previous svgEditor.$click registration —
 *     synthetic click events cover touch on modern targets, removing the
 *     latent double-fire bug on touchscreen taps. Host addEventListener('click')
 *     for slotted/shadow bubbled events, matching seFlyingButton precedent.
 *
 * Dropped:
 *   - Static template + cloneNode + querySelector field assignments
 *   - observedAttributes/attributeChangedCallback imperative dispatch
 *   - Constructor-time imgPath cache (moved to render)
 *   - @class/@function JSDoc tags
 */
@customElement('se-explorerbutton')
export class SeExplorerButton extends LitElement {
  static styles = css`
    :host {
      position: relative;
    }
    .menu-button:hover,
    se-button:hover,
    .menu-item:hover {
      background-color: var(--se-accent-subtle);
    }
    .se-icon {
      display: block;
      width: 100%;
      height: 100%;
      ${seIconMask}
    }
    .overall.pressed,
    .menu-item.pressed {
      background-color: var(--se-accent-subtle) !important;
    }
    .overall.pressed .se-icon {
      background-color: var(--se-accent);
    }
    .overall.pressed .menu-button {
      background-color: var(--se-accent-subtle) !important;
    }
    .disabled {
      opacity: 0.3;
      cursor: default;
    }
    .menu-button {
      height: 24px;
      width: 24px;
      margin: 2px 1px 4px;
      padding: 3px;
      background-color: var(--se-surface);
      cursor: pointer;
      position: relative;
      border-radius: 3px;
      overflow: hidden;
    }
    .handle {
      height: 8px;
      width: 8px;
      position: absolute;
      bottom: 0px;
      right: 0px;
      background-color: var(--se-icon);
      -webkit-mask: var(--handle-bg-url) center / contain no-repeat;
      mask: var(--handle-bg-url) center / contain no-repeat;
    }
    .menu {
      position: fixed;
      margin-left: 34px;
      background: none !important;
      display: none;
      top: 30%;
      left: 171px;
    }
    .image-lib {
      position: fixed;
      left: 34px;
      top: 30%;
      background: var(--se-surface);
      display: none;
      flex-wrap: wrap;
      flex-direction: row;
      width: 170px;
    }
    .menu-item {
      line-height: 1em;
      padding: 0.5em;
      border: 1px solid var(--se-border-strong);
      background: var(--se-surface);
      margin-bottom: -1px;
      white-space: nowrap;
    }
    .open-lib {
      display: inline-flex;
    }
    .open {
      display: block;
    }
    .overall {
      background: none !important;
    }
  `

  @property() accessor title = ''
  @property(boolAttr) accessor pressed = false
  @property(boolAttr) accessor disabled = false
  @property() accessor lib = ''
  @property() accessor src = ''

  @state() private accessor _opened = false
  @state() private accessor _activeSrc = ''
  // Shape-library menu names + the currently-selected one (reactive pressed state).
  @state() private accessor _menu: string[] = []
  @state() private accessor _activeMenu = ''
  // Per-shape icon buttons (key + data-URI src) + the currently-selected shape key.
  @state() private accessor _shapes: Array<{ key: string; src: string }> = []
  @state() private accessor _activeShape = ''

  private _data: Record<string, string> = {}
  private _workareaClickHandler: ((e: Event) => void) | null = null

  connectedCallback() {
    super.connectedCallback()
    // Host-level click receives bubbled events from shadow children and slotted elements
    this.addEventListener('click', this._onClick)

    // Closes opened lib menu on click on the canvas (preserved from original constructor)
    const workarea = $id('workarea')
    if (workarea) {
      this._workareaClickHandler = (_e: Event) => {
        this._opened = false
      }
      workarea.addEventListener('click', this._workareaClickHandler)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('click', this._onClick)
    const workarea = $id('workarea')
    if (workarea && this._workareaClickHandler) {
      workarea.removeEventListener('click', this._workareaClickHandler)
      this._workareaClickHandler = null
    }
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('lib') && this.lib) {
      void this._loadLib(this.lib)
    }
    if (changed.has('src') && this.src) {
      const imgPath = getSvgEditor().configObj.curConfig.imgPath
      this._activeSrc = imgPath + '/' + this.src
    }
  }

  render() {
    const imgPath = getSvgEditor().configObj.curConfig.imgPath
    const iconSrc = this._activeSrc || 'explorer.svg'
    const shortcut = this.getAttribute('shortcut')
    const titleText = `${this.title}${shortcut ? ` [${shortcut}]` : ''}`

    return html`
      <style>:host { --handle-bg-url: url(${imgPath}/handle.svg); }</style>
      <div class=${classMap({ overall: true, pressed: this.pressed, disabled: this.disabled })}>
        <div class="menu-button" title=${titleText}>
          <span
            class="se-icon"
            aria-hidden="true"
            style=${maskImageStyle(iconSrc)}
          ></span>
          <div class="handle" @click=${this._onClick}></div>
        </div>
        <div class=${classMap({ 'image-lib': true, 'open-lib': this._opened })}>
          ${this._shapes.map((shape) => html`
            <se-button
              data-shape=${shape.key}
              src=${shape.src}
              .pressed=${shape.key === this._activeShape}
            ></se-button>
          `)}
        </div>
        <div class=${classMap({ menu: true, open: this._opened })} @click=${this._onClick}>
          ${this._menu.map((menu) => html`
            <div
              data-menu=${menu}
              class=${classMap({ 'menu-item': true, pressed: menu === this._activeMenu })}
            >${menu}</div>
          `)}
        </div>
      </div>
    `
  }

  private _onClick = (ev: Event) => {
    ev.stopPropagation()
    const target = ev.target as HTMLElement
    switch (target.nodeName) {
      case 'SE-EXPLORERBUTTON':
        this._opened = !this._opened
        break
      case 'SE-BUTTON': {
        // change to the current action; reactive pressed state re-renders the buttons
        const shape = target.dataset.shape ?? ''
        this._activeSrc = target.getAttribute('src') ?? ''
        this.dataset.draw = this._data[shape]
        this._activeShape = shape
        // and close the menu
        this._opened = false
        break
      }
      case 'DIV':
        if (target.classList[0] === 'handle') {
          // click on the handle: open/close the menu
          this._opened = !this._opened
        } else if (target.classList.contains('menu-item')) {
          const menu = target.dataset.menu ?? ''
          this._activeMenu = menu
          void this._updateLib(menu)
        }
        break
      default:
        console.error('unknown nodeName for:', target, target.className)
    }
  }

  private async _loadLib(libDir: string): Promise<void> {
    try {
      const response = await fetch(`${libDir}index.json`)
      const json = await response.json() as { lib: string[] }
      const { lib } = json
      this._menu = lib
      this._activeMenu = lib[0] ?? ''
      if (lib[0]) await this._updateLib(lib[0])
    } catch (error) {
      console.error(error)
    }
  }

  private async _updateLib(lib: string): Promise<void> {
    const libDir = this.lib
    try {
      // initialize buttons for all shapes defined for this library
      const response = await fetch(`${libDir}${lib}.json`)
      const json = await response.json() as { data: Record<string, string>; size?: number; fill?: boolean }
      this._data = json.data
      const size = json.size ?? 300
      const fill = json.fill ? '#333' : 'none'
      const off = size * 0.05
      const vb = [-off, -off, size + off * 2, size + off * 2].join(' ')
      const stroke = json.fill ? 0 : (size / 30)
      this._shapes = Object.entries(this._data).map(([key, path]) => {
        const encoded = btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <svg viewBox="${vb}"><path fill="${fill}" stroke="#f8bb00" stroke-width="${stroke}" d="${path}"></path></svg>
        </svg>`)
        return { key, src: `data:image/svg+xml;base64,${encoded}` }
      })
    } catch (error) {
      console.error(`could not read file:${libDir}${lib}.json`, error)
    }
  }
}
