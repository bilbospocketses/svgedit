import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'

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
 */
@customElement('se-menu')
export class SeMenu extends LitElement {
  static styles = css`
    :host {
      padding: 0px;
      position: relative;
    }
    .menu-button {
      padding: 0.25em 0.30em;
      background-color: var(--icon-bg-color);
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
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
      display: none;
      min-width: 100%;
    }
    .popup.open {
      display: block;
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
      <div
        class="menu-button"
        role="button"
        aria-haspopup="true"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-label="Main Menu"
        @click=${this._toggle}
      >
        ${imgSrc
          ? html`<img alt="logo" width="24" height="24" src=${imgSrc} />`
          : nothing}
        ${this.label ? html`<span>${this.label}</span>` : nothing}
      </div>
      <div
        class=${classMap({ popup: true, open: this._open })}
        role="menu"
        @click=${this._onSlotClick}
      >
        <slot></slot>
      </div>
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
