import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'

const NO_COLOR_SVG_DATA_URL = 'data:image/svg+xml;charset=utf-8;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgY2xhc3M9InN2Z19pY29uIj48c3ZnIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+CiAgICA8bGluZSBmaWxsPSJub25lIiBzdHJva2U9IiNkNDAwMDAiIGlkPSJzdmdfOTAiIHkyPSIyNCIgeDI9IjI0IiB5MT0iMCIgeDE9IjAiLz4KICAgIDxsaW5lIGlkPSJzdmdfOTIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Q0MDAwMCIgeTI9IjI0IiB4Mj0iMCIgeTE9IjAiIHgxPSIyNCIvPgogIDwvc3ZnPjwvc3ZnPg=='

const palette = [
  // Todo: Make into configuration item?
  'none',
  '#000000',
  '#3f3f3f',
  '#7f7f7f',
  '#bfbfbf',
  '#ffffff',
  '#ff0000',
  '#ff7f00',
  '#ffff00',
  '#7fff00',
  '#00ff00',
  '#00ff7f',
  '#00ffff',
  '#007fff',
  '#0000ff',
  '#7f00ff',
  '#ff00ff',
  '#ff007f',
  '#7f0000',
  '#7f3f00',
  '#7f7f00',
  '#3f7f00',
  '#007f00',
  '#007f3f',
  '#007f7f',
  '#003f7f',
  '#00007f',
  '#3f007f',
  '#7f007f',
  '#7f003f',
  '#ffaaaa',
  '#ffd4aa',
  '#ffffaa',
  '#d4ffaa',
  '#aaffaa',
  '#aaffd4',
  '#aaffff',
  '#aad4ff',
  '#aaaaff',
  '#d4aaff',
  '#ffaaff',
  '#ffaad4'
]

/**
 * SePalette — color palette strip + expandable popup custom element.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-palette`
 *   - Attribute: `ui-palette_info` (kebab-case) — reflects to inner `#palette_holder` title
 *   - Public method `init(i18next)` — called by `BottomPanel.ts:190` via
 *     `($id('palette') as any).init(i18next)`; sets the `ui-palette_info` attribute
 *   - Dispatches `change` CustomEvent with **`bubbles: false`** (CRITICAL — listener at
 *     `BottomPanel.ts:189` attaches directly to host via `$id('palette').addEventListener`;
 *     NOT promoted to `bubbles: true, composed: true` "for consistency" — it's a contract)
 *   - 42-color hardcoded palette + audit-preserve `// Todo: Make into configuration item?`
 *     comment carried forward for future configurable-palette work (PR-2 audit Todo #10)
 *
 * No host-id mirror needed: consumer uses `$id('palette')` which matches the host element
 * directly (no inner element selectors target a `#palette` id).
 *
 * Dropped:
 *   - Imperative DOM mutation (static `template` + `cloneNode` + querySelector field
 *     assignments to `$strip` / `expand_btn` / `popUp`)
 *   - Constructor-time global access (`svgEditor.$click` + `svgEditor.svgCanvas.container
 *     .addEventListener`) — moved to declarative `@click` binding (expand toggle) and
 *     `firstUpdated` + `queueMicrotask` (container close listener) with paired cleanup
 *     in `disconnectedCallback`
 *   - Split `showPopUp` / `hidePopUp` methods — collapsed into a single `@state` toggle
 *   - `eslint-disable` directive + explanatory comment from line 1-2 (elix `any` leakage
 *     gone now that the elix base class is dropped)
 *   - `@class` / `@function` JSDoc tags (Tier B style; reference components don't use them)
 */
@customElement('se-palette')
export class SePalette extends LitElement {
  static styles = css`
    .square {
      height: 15px;
      width: 15px;
      float: left;
    }
    #palette_holder {
      overflow: hidden;
      padding: 4px;
      background: #f0f0f0;
      border-radius: 3px;
      z-index: 2;
    }

    #js-se-palette {
      float: left;
      min-width: 30px;
      height: 15px;
      overflow: hidden;
    }

    div.palette_item {
      height: 15px;
      width: 15px;
      float: left;
    }

    div.palette_item:first-child {
      background: white;
    }

    .palette_expand_btn {
      background: none;
      border: none;
      width: 14px;
      height: 14px;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }

    #palette_popup {
      padding: 4px;
      margin-left: 24px;
      background: white;
      min-width: 180px;
      max-width: 360px;
      min-height: 14px;
      flex-wrap: wrap;
      border-radius: 4px;

      position: absolute;
      bottom: 36px;
      right: 30px;
    }
  `

  @property({ attribute: 'ui-palette_info' }) accessor uiPaletteInfo = ''
  @state() accessor isPopupOpen = false

  private _containerClickHandler: (() => void) | null = null

  // External API: signature preserved for BottomPanel.ts:190 caller
  init(i18next: { t(key: string): string }) {
    this.setAttribute('ui-palette_info', i18next.t('ui.palette_info'))
  }

  firstUpdated() {
    // Lazy access in case svgEditor.svgCanvas is not yet set up at connection time
    queueMicrotask(() => {
      const container = svgEditor.svgCanvas.container
      this._containerClickHandler = () => { this.isPopupOpen = false }
      container.addEventListener('click', this._containerClickHandler)
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this._containerClickHandler) {
      svgEditor.svgCanvas.container.removeEventListener('click', this._containerClickHandler)
      this._containerClickHandler = null
    }
  }

  render() {
    return html`
      <div id="palette_holder" title=${ifDefined(this.uiPaletteInfo || undefined)}>
        <div id="js-se-palette">
          ${palette.map(rgb => this._renderSquare(rgb))}
        </div>
      </div>
      <button
        class="palette_expand_btn"
        title=${this.isPopupOpen ? 'Hide palette window' : 'Show whole palette'}
        @click=${this._toggleExpand}
      >${this.isPopupOpen ? '▲' : '▼'}</button>
      <div id="palette_popup" style=${this.isPopupOpen ? 'display:flex' : 'display:none'}>
        ${palette.map(rgb => this._renderSquare(rgb))}
      </div>
    `
  }

  private _renderSquare(rgb: string) {
    if (rgb === 'none') {
      return html`
        <div class="square" data-rgb=${rgb} @click=${this._onSquareClick}>
          <img src=${NO_COLOR_SVG_DATA_URL} alt="No color" style="width:15px;height:15px" />
        </div>
      `
    }
    return html`<div class="square" data-rgb=${rgb} style="background-color:${rgb}" @click=${this._onSquareClick}></div>`
  }

  private _onSquareClick = (evt: MouseEvent) => {
    evt.preventDefault()
    const target = evt.currentTarget as HTMLElement
    // shift key or right click for stroke
    const picker = evt.shiftKey || evt.button === 2 ? 'stroke' : 'fill'
    let color = target.dataset['rgb']
    // Webkit-based browsers returned 'initial' here for no stroke
    if (color === 'none' || color === 'transparent' || color === 'initial') {
      color = 'none'
    }
    this.dispatchEvent(new CustomEvent('change', {
      detail: { picker, color },
      bubbles: false  // CRITICAL: preserve API contract — not bubbling
    }))
  }

  private _toggleExpand = (e: Event) => {
    e.stopPropagation()
    this.isPopupOpen = !this.isPopupOpen
  }
}
