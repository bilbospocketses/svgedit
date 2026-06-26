import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { maskImageStyle, seIconMask } from './component-utils.js'

/**
 * SeDropdown — toolbar dropdown with slotted options + popup container.
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
 *     input, so simplified to icon + button-toggle + popup + slot.
 *   - Class rename `Dropdown` → `SeDropdown` for PR-2 cascade consistency
 *     (matches SeButton / SePalette / SeFlyingButton / SeExplorerButton).
 *   - Document click + Escape listeners with full disconnectedCallback pairing
 *     per PR-2 pattern #5 — handlers now declared as class-field arrows
 *     (convention bullet #8) instead of nullable-typed fields assigned at connect.
 *
 * Aria posture (PR-3a Fix 3 follow-up): the toggle is a native
 * `<button type="button">` (keyboard-focusable via Tab) exposing
 * `aria-haspopup` + `aria-expanded`. The popup container is a plain `<div>`
 * with no `role`; slotted options also have no `role="option"` and there is
 * no keyboard navigation across options. Half-applied listbox aria was removed
 * because it was misleading rather than helpful. Full listbox semantics
 * (option roles + arrow-key navigation + activedescendant) is a follow-up if
 * a consumer ever relies on the dropdown for non-mouse interaction (currently:
 * ZERO consumers). Native-button visual parity preserved via CSS-default
 * neutralization (`border: none`, `background: transparent`, `font: inherit`,
 * etc.) plus a `:focus-visible` outline — same pattern as seMenu's trigger.
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
      /* Neutralize native <button> defaults so visual parity with the
         original <div> rendering is preserved (same pattern as seMenu). */
      border: none;
      font: inherit;
      color: inherit;
      line-height: inherit;
      outline: inherit;
      text-align: inherit;
      background: transparent;
      padding: 0;
    }
    .source:focus-visible {
      outline: 2px solid var(--se-focus-ring);
      outline-offset: 1px;
    }
    .se-icon {
      width: 18px;
      height: 18px;
      ${seIconMask}
    }
    .popup {
      position: absolute;
      top: 100%;
      left: 0;
      width: 150%;
      display: none;
      background: var(--se-surface);
      border: 1px solid var(--se-border-strong);
      z-index: 10;
    }
    .popup.open {
      display: block;
    }
    ::slotted(*) {
      padding: 4px;
      background: var(--se-surface);
      border: 1px solid var(--se-border-strong);
      width: 100%;
      display: block;
      box-sizing: border-box;
      cursor: pointer;
    }
  `

  @property() accessor title = ''
  @property() accessor src = 'logo.svg'
  // no-op — preserved for backward attribute parity; original elix-bound input
  // was decorative on non-typed-input usage and has been dropped from render.
  @property() accessor inputsize = '100%'
  @property() accessor value = ''

  @state() private accessor _open = false

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('click', this._onDocumentClick)
    document.addEventListener('keydown', this._onDocumentKeydown)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    document.removeEventListener('click', this._onDocumentClick)
    document.removeEventListener('keydown', this._onDocumentKeydown)
  }

  render() {
    return html`
      <button
        type="button"
        class="source"
        part="source"
        aria-haspopup="listbox"
        aria-expanded=${this._open ? 'true' : 'false'}
        @click=${this._onToggle}
      >
        <span class="se-icon" part="icon" aria-hidden="true" style=${maskImageStyle(this.src)}></span>
      </button>
      <div
        class=${classMap({ popup: true, open: this._open })}
        part="popup"
        @click=${this._onOptionClick}
      >
        <slot></slot>
      </div>
    `
  }

  // Class-field arrows per convention bullet #8 — avoids
  // @typescript-eslint/unbound-method false-positive on Lit's
  // @event=${this._handler} pattern and aligns with seMenu's posture.
  private _onToggle = (e: Event) => {
    e.stopPropagation()
    this._open = !this._open
  }

  private _onDocumentClick = (e: Event) => {
    // Close on outside-click; composedPath includes shadow tree, so self-clicks
    // (toggle, slotted options) won't match and stay open / close via own handlers.
    if (this._open && !e.composedPath().includes(this)) {
      this._open = false
    }
  }

  private _onDocumentKeydown = (e: KeyboardEvent) => {
    if (this._open && e.key === 'Escape') {
      this._open = false
    }
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
