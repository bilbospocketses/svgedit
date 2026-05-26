/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// fetch().json() returns `any`; typed via `as` casts below; cleanup deferred to #3

import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import SvgCanvas from '@svgedit/svgcanvas'
import { getSvgEditor } from '../svgEditorInstance.js'

const { $id } = SvgCanvas

/**
 * Boolean attribute contract for `pressed` / `disabled`:
 * reflect as the string `'true'` so DOM queries like `[pressed]` and
 * regex matchers like `toHaveAttribute('pressed', /./)` succeed. Lit's
 * default Boolean reflect emits `''`, which fails single-character matchers.
 */
const boolAttr = {
  reflect: true,
  converter: {
    fromAttribute: (v: string | null) => v !== null,
    toAttribute: (v: boolean) => v ? 'true' : null
  }
} as const

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
      background-color: var(--icon-bg-color-hover);
    }
    img {
      border: none;
      width: 24px;
      height: 24px;
    }
    .overall.pressed .button-icon,
    .overall.pressed,
    .menu-item.pressed {
      background-color: var(--icon-bg-color-hover) !important;
    }
    .overall.pressed .menu-button {
      background-color: var(--icon-bg-color-hover) !important;
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
      background-color: var(--icon-bg-color);
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
      background-image: var(--handle-bg-url);
    }
    .button-icon {
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
      background: #E8E8E8;
      display: none;
      flex-wrap: wrap;
      flex-direction: row;
      width: 170px;
    }
    .menu-item {
      line-height: 1em;
      padding: 0.5em;
      border: 1px solid #5a6162;
      background: #E8E8E8;
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
  @state() private accessor _menuHtml = '<div class="menu-item">menu</div>'
  @state() private accessor _libHtml = '<se-button></se-button>'

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
    const shortcut = this.getAttribute('shortcut')
    const titleText = `${this.title}${shortcut ? ` [${shortcut}]` : ''}`

    return html`
      <style>:host { --handle-bg-url: url(${imgPath}/handle.svg); }</style>
      <div class=${classMap({ overall: true, pressed: this.pressed, disabled: this.disabled })}>
        <div class="menu-button" title=${titleText}>
          <img class="button-icon" src=${this._activeSrc || 'explorer.svg'} alt="icon" />
          <div class="handle" @click=${this._onClick}></div>
        </div>
        <div class=${classMap({ 'image-lib': true, 'open-lib': this._opened })}>
          ${unsafeHTML(this._libHtml)}
        </div>
        <div class=${classMap({ menu: true, open: this._opened })} @click=${this._onClick}>
          ${unsafeHTML(this._menuHtml)}
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
      case 'SE-BUTTON':
        // change to the current action
        this._activeSrc = target.getAttribute('src') ?? ''
        this.dataset.draw = this._data[target.dataset.shape ?? '']
        this.shadowRoot?.querySelectorAll('.image-lib [pressed]').forEach((b) => {
          (b as SeExplorerButton).pressed = false
        })
        target.setAttribute('pressed', 'pressed')
        // and close the menu
        this._opened = false
        break
      case 'DIV':
        if (target.classList[0] === 'handle') {
          // click on the handle: open/close the menu
          this._opened = !this._opened
        } else if (target.classList.contains('menu-item')) {
          this.shadowRoot?.querySelectorAll('.menu > .pressed').forEach((b) => {
            b.classList.remove('pressed')
          })
          target.classList.add('pressed')
          void this._updateLib(target.dataset.menu ?? '')
        }
        break
      default:
        console.error('unknown nodeName for:', target, target.className)
    }
  }

  private async _loadLib(libDir: string): Promise<void> {
    try {
      const response = await fetch(`${libDir}index.json`)
      const json = await response.json()
      const { lib } = json as { lib: string[] }
      this._menuHtml = lib.map((menu: string, i: number) =>
        `<div data-menu="${menu}" class="menu-item ${i === 0 ? 'pressed' : ''} ">${menu}</div>`
      ).join('')
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
      const json = await response.json()
      this._data = json.data as Record<string, string>
      const size = (json.size as number) ?? 300
      const fill = json.fill ? '#333' : 'none'
      const off = size * 0.05
      const vb = [-off, -off, size + off * 2, size + off * 2].join(' ')
      const stroke = json.fill ? 0 : (size / 30)
      this._libHtml = Object.entries(this._data).map(([key, path]) => {
        const encoded = btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
          <svg viewBox="${vb}"><path fill="${fill}" stroke="#f8bb00" stroke-width="${stroke}" d="${path}"></path></svg>
        </svg>`)
        return `<se-button data-shape="${key}"src="data:image/svg+xml;base64,${encoded}"></se-button>`
      }).join('')
    } catch (error) {
      console.error(`could not read file:${libDir}${lib}.json`, error)
    }
  }
}
