import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

/**
 * SeMenuItem — menu-item custom element with optional icon and keyboard shortcut.
 * Migrated from a manual-shadowDOM wrapper around `<elix-menu-item>` to a
 * Lit-owned `<button role="menuitem">` per PR-3a Task 3.
 *
 * External API preserved: tag `se-menu-item`, class `SeMenuItem`, attrs
 * `label`/`src` (observed) + `shortcut`/`id` (read-only). Native `click` bubbles
 * from the host so MainMenu + ext-opensave `$click($id('tool_xxx'), …)` keeps firing.
 *
 * Substrate: drops `elix/define/Menu.js` + `elix/define/MenuItem.js`. The original
 * shadowDOM-pierce that hid elix's `#checkmark` resolves naturally (no checkmark
 * rendered). Document keydown listener now paired with `disconnectedCallback`
 * cleanup per PR-2 pattern #5. `imgPath` read at render-time. Shortcut normalization
 * preserved verbatim (shared helper deferred to todo #10).
 */
@customElement('se-menu-item')
export class SeMenuItem extends LitElement {
  static styles = css`
    :host button {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    :host button > span {
      margin-left: 7px;
    }
  `

  @property() accessor label = ''
  @property() accessor src = ''

  render() {
    const shortcut = this.getAttribute('shortcut') ?? ''
    const imgSrc = this.src ? svgEditor.configObj.curConfig.imgPath + '/' + this.src : undefined
    const labelText = `${t(this.label)} ${shortcut ? `(${shortcut})` : ''}`

    return html`
      <button type="button" role="menuitem" part="item">
        ${this.src
          ? html`<img alt="icon" width="24" src=${ifDefined(imgSrc)} />`
          : nothing}
        <span part="label">${labelText}</span>
      </button>
    `
  }

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('keydown', this._onDocumentKeydown)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this._onDocumentKeydown)
  }

  // Class-field arrow per convention bullet #8 — aligned with seMenu's
  // `_onDocumentKeydown` pattern. Reads `shortcut` at fire time rather than
  // caching at connect time; semantically equivalent since consumers do not
  // mutate the attribute after connect.
  private _onDocumentKeydown = (e: KeyboardEvent) => {
    const shortcut = this.getAttribute('shortcut')
    if (!shortcut) return
    // only track keyboard shortcuts for the body containing the svgedit editor
    if ((e.target as Element).nodeName !== 'BODY') return
    // normalize key
    const key = `${(e.metaKey) ? 'meta+' : ''}${(e.ctrlKey) ? 'ctrl+' : ''}${(e.shiftKey) ? 'shift+' : ''}${e.key.toUpperCase()}`
    if (shortcut !== key) return
    // launch the click event — `this` IS the element document.getElementById
    // would return, so call click() directly. Guard on `this.id` preserved
    // because consumers bind their handlers via `$click($id('tool_xxx'), …)`,
    // i.e. an ID-less menu-item has no consumer listener to trigger.
    if (this.id) {
      this.click()
    }
    e.preventDefault()
  }
}
