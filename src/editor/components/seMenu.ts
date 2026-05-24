import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

/**
 * SeMenu — popup wrapper for `<se-menu-item>` children, owning its own button
 * face + popup container directly. Replaces the `<elix-menu-button>` wrapper.
 *
 * External API preserved: tag `se-menu`, class `SeMenu`, attributes `label` /
 * `src`. No events fired by `<se-menu>` itself; child `<se-menu-item>` clicks
 * bubble natively (host listens to close the popup on a slotted-child click).
 *
 * Substrate notes: drops `import 'elix/define/MenuItem.js'` and
 * `import './sePlainMenuButton.js'`. The double shadow-pierce in the original
 * (constructor line 54: `(this.$menu as any).shadowRoot.querySelector('#popupToggle').shadowRoot`)
 * resolves naturally — Lit owns the button face directly. `imgPath` is read at
 * render-time per the seSpinInput pilot pattern. Document-level click /
 * Escape-key listeners are attached on open and detached on close +
 * `disconnectedCallback` per PR-2 pattern #5.
 *
 * Firefox-layout hardening: the popup container is conditionally rendered —
 * when closed the popup `<div>` is omitted entirely (no slot, no
 * position:absolute element) so it cannot influence document scroll or
 * containing-block geometry. `:host` is given `contain: layout` to additionally
 * isolate layout effects when the popup IS open. Originally a `display:none`
 * popup was always rendered with a slot inside; observed Firefox-only e2e
 * flakiness (clipboard right-click coordinate drift by one SVG-canvas viewport)
 * traced back to layout instability around the always-mounted absolute popup.
 */
@customElement('se-menu')
export class SeMenu extends LitElement {
  static styles = css`
    :host {
      padding: 0px;
      position: relative;
      display: inline-block;
      contain: layout;
    }
    .menu-button {
      padding: 0.25em 0.30em;
      background-color: var(--icon-bg-color);
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      /* Neutralize native <button> defaults so visual parity with the
         original <div role="button"> rendering is preserved. */
      border: none;
      font: inherit;
      text-align: inherit;
      line-height: inherit;
    }
    .menu-button:focus-visible {
      outline: 2px solid var(--icon-bg-color-hover);
      outline-offset: 1px;
    }
    .menu-button img {
      width: 24px;
      height: 24px;
    }
    .popup {
      position: absolute;
      top: 100%;
      left: 0;
      background-color: var(--icon-bg-color);
      color: #fff;
      z-index: 1;
      min-width: 100%;
    }
    :host ::slotted([current]) {
      background-color: var(--icon-bg-color-hover) !important;
      color: #fff;
    }
    :host ::slotted(*) {
      padding: 0.25em 1.25em 0.25em 0.25em !important;
      margin: 2px;
    }
  `

  @property() accessor label = ''
  @property() accessor src = ''

  @state() private accessor _open = false

  render() {
    const imgSrc = this.src
      ? svgEditor.configObj.curConfig.imgPath + '/' + this.src
      : undefined
    return html`
      <button
        type="button"
        class="menu-button"
        aria-haspopup="true"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-label="Main Menu"
        @click=${this._toggle}
      >
        ${imgSrc
          ? html`<img alt="logo" width="24" height="24" src=${imgSrc} />`
          : nothing}
        ${this.label ? html`<span>${this.label}</span>` : nothing}
      </button>
      ${this._open
        ? html`
            <div class="popup" role="menu" @click=${this._onSlotClick}>
              <slot></slot>
            </div>
          `
        : nothing}
    `
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._detachDocumentListeners()
  }

  private _toggle = (e: Event) => {
    e.stopPropagation()
    if (this._open) {
      this._close()
    } else {
      this._openPopup()
    }
  }

  // Slotted <se-menu-item> child clicks bubble through the popup container;
  // close the menu so the user sees the action take effect.
  private _onSlotClick = () => {
    this._close()
  }

  private _openPopup() {
    this._open = true
    this._attachDocumentListeners()
  }

  private _close() {
    this._open = false
    this._detachDocumentListeners()
  }

  private _onDocumentClick = (e: Event) => {
    // Click outside the host closes the popup. composedPath() pierces shadow
    // boundaries so clicks inside our own shadow tree don't count as outside.
    if (!e.composedPath().includes(this)) {
      this._close()
    }
  }

  private _onDocumentKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this._close()
    }
  }

  private _attachDocumentListeners() {
    document.addEventListener('click', this._onDocumentClick)
    document.addEventListener('keydown', this._onDocumentKeydown)
  }

  private _detachDocumentListeners() {
    document.removeEventListener('click', this._onDocumentClick)
    document.removeEventListener('keydown', this._onDocumentKeydown)
  }
}
