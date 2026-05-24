import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

/**
 * SeDropdown — toolbar dropdown with slotted options + popup listbox.
 *
 * External API preserved (verified via consumer grep before conversion — ZERO
 * external consumers found: no <se-dropdown> markup, no document.createElement,
 * no class imports; the registration is preserved for the slot/popup contract):
 *   - Custom element name: `se-dropdown`
 *   - Attributes: `title`, `src`, `inputsize`, `value` (observed)
 *   - Default <slot> for `<option value="...">` children
 *   - Dispatches `change` CustomEvent (bubbles + composed) with `detail: { value }`
 *     when a slotted option is clicked (preserves the original elix `close`-then-
 *     `change` re-dispatch shape; consumers may read e.detail.value).
 *
 * Substrate changes (this conversion):
 *   - Dropped elix ListComboBox + NumberSpinBox + internal.template/render/state
 *     overrides; replaced with native Lit @state + classMap popup toggle.
 *   - Original combined typed-input + popup-list; no consumers exercise the typed
 *     input, so simplified to icon + button-toggle + popup-listbox + slot.
 *   - Class rename `Dropdown` → `SeDropdown` for PR-2 cascade consistency
 *     (matches SeButton / SePalette / SeFlyingButton / SeExplorerButton).
 *   - Document click + Escape listeners with full disconnectedCallback pairing
 *     per PR-2 pattern #5.
 */
@customElement('se-dropdown')
export class SeDropdown extends LitElement {
  static styles = css`
    :host {
      position: relative;
      display: inline-block;
    }
    .source {
      display: grid;
      grid-template-columns: 20px 1fr auto;
      align-items: center;
      cursor: pointer;
      gap: 2px;
    }
    img {
      width: 18px;
      height: 18px;
    }
    input[part~="input"] {
      background: var(--input-color);
      border: 1px solid #5a6162;
      border-radius: 3px;
      padding: 2px 4px;
      box-sizing: border-box;
    }
    .popup {
      position: absolute;
      top: 100%;
      left: 0;
      width: 150%;
      display: none;
      background: #fff;
      border: 1px solid #5a6162;
      z-index: 10;
    }
    .popup.open {
      display: block;
    }
    ::slotted(*) {
      padding: 4px;
      background: #E8E8E8;
      border: 1px solid #5a6162;
      width: 100%;
      display: block;
      box-sizing: border-box;
      cursor: pointer;
    }
  `

  @property() accessor title = ''
  @property() accessor src = 'logo.svg'
  @property() accessor inputsize = '100%'
  @property() accessor value = ''

  @state() private accessor _open = false

  private _documentClickHandler: ((e: Event) => void) | null = null
  private _documentKeyHandler: ((e: KeyboardEvent) => void) | null = null

  connectedCallback() {
    super.connectedCallback()
    this._documentClickHandler = (e: Event) => {
      // Close on outside-click; composedPath includes shadow tree, so self-clicks
      // (toggle button, slotted options) won't match and stay open / close via own handlers.
      if (this._open && !e.composedPath().includes(this)) {
        this._open = false
      }
    }
    this._documentKeyHandler = (e: KeyboardEvent) => {
      if (this._open && e.key === 'Escape') {
        this._open = false
      }
    }
    document.addEventListener('click', this._documentClickHandler)
    document.addEventListener('keydown', this._documentKeyHandler)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this._documentClickHandler) {
      document.removeEventListener('click', this._documentClickHandler)
      this._documentClickHandler = null
    }
    if (this._documentKeyHandler) {
      document.removeEventListener('keydown', this._documentKeyHandler)
      this._documentKeyHandler = null
    }
  }

  render() {
    return html`
      <div
        class="source"
        part="source"
        title=${ifDefined(this.title ? t(this.title) : undefined)}
        @click=${this._onToggle}
      >
        <img src=${this.src} alt="icon" part="icon" />
        <input
          part="input"
          .value=${this.value}
          style=${`width: ${this.inputsize};`}
          readonly
        />
      </div>
      <div
        class=${classMap({ popup: true, open: this._open })}
        part="popup"
        role="listbox"
        @click=${this._onOptionClick}
      >
        <slot></slot>
      </div>
    `
  }

  // Class-field arrows: avoid @typescript-eslint/unbound-method false-positive
  // on Lit's @event=${this._handler} pattern (per convention bullet #8).
  private _onToggle = (e: Event) => {
    e.stopPropagation()
    this._open = !this._open
  }

  private _onOptionClick = (e: Event) => {
    e.stopPropagation()
    // Walk composedPath to find the slotted option element bearing a `value` attr.
    const path = e.composedPath()
    for (const node of path) {
      if (node === this) break
      if (node instanceof Element) {
        const v = node.getAttribute('value')
        if (v !== null) {
          this.value = v
          this.dispatchEvent(new CustomEvent('change', {
            detail: { value: v },
            bubbles: true,
            composed: true
          }))
          this._open = false
          return
        }
      }
    }
  }
}

/*
{TODO
    min: 0.001, max: 10000, step: 50, stepfunc: stepZoom,
  function stepZoom (elem, step) {
    const origVal = Number(elem.value);
    if (origVal === 0) { return 100; }
    const sugVal = origVal + step;
    if (step === 0) { return origVal; }

    if (origVal >= 100) {
      return sugVal;
    }
    if (sugVal >= origVal) {
      return origVal * 2;
    }
    return origVal / 2;
  }
*/
