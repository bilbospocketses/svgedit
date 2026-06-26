import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { t } from '../locale.js'
import { getSvgEditor } from '../svgEditorInstance.js'
import { boolAttr, maskImageStyle } from './component-utils.js'

/**
 * SeFlyingButton — toolbar flyout button with slotted secondary actions.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-flyingbutton`
 *   - Attributes: `title`, `pressed`, `disabled`, `opened` (observed)
 *   - Attribute: `shortcut` (read at render time for tooltip composition; not observed)
 *   - Default slot for child `<se-button>` flyout actions
 *   - `pressed` setter special-case: setting false also removes `opened`
 *     (enforced via willUpdate lifecycle hook)
 *
 * Behavioral fix (this conversion):
 *   - Drops the touchend half of the previous svgEditor.$click registration —
 *     synthetic click events cover touch on modern targets, removing the
 *     latent double-fire bug on touchscreen taps. Pure Lit @click= now,
 *     matching seSelect/seList declarative @click= precedent.
 *
 * Dropped:
 *   - Static template + cloneNode + querySelector field assignments
 *   - observedAttributes/attributeChangedCallback imperative dispatch
 *   - Constructor-time imgPath cache (moved to render)
 *   - @class/@function JSDoc tags
 */
@customElement('se-flyingbutton')
export class SeFlyingButton extends LitElement {
  static styles = css`
    :host {
      position: relative;
    }
    @keyframes btnHover {
      from {
        background-color: transparent;
      }

      to {
        background-color: var(--se-accent-subtle);
      }
    }
    .overall .menu-button:hover {
      animation: btnHover 0.2s forwards;
    }
    .se-icon {
      display: block;
      width: 100%;
      height: 100%;
      background-color: var(--se-icon);
      -webkit-mask-position: center; mask-position: center;
      -webkit-mask-size: contain; mask-size: contain;
      -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    }
    .overall.pressed .handle {
      background-color: var(--se-accent-subtle) !important;
    }
    .overall.pressed .menu-button {
      background-color: var(--se-accent-subtle) !important;
    }
    .overall.pressed .se-icon {
      background-color: var(--se-accent);
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
      background: none !important;
      display: none;
      margin-left: 34px;
    }
    .open {
      display: flex;
    }
    .menu-item {
      align-content: flex-start;
      height: 24px;
      width: 24px;
      top: 0px;
      left: 0px;
    }
    .overall {
      background: none !important;
    }
  `

  @property() accessor title = ''
  @property(boolAttr) accessor pressed = false
  @property(boolAttr) accessor disabled = false
  @property(boolAttr) accessor opened = false

  @state() private accessor _activeSlotSrc = ''

  private _activeSlot: Element | null = null
  private _documentClickHandler: ((e: Event) => void) | null = null

  connectedCallback() {
    super.connectedCallback()
    // Host-level click receives bubbled events from slotted <se-button> children
    this.addEventListener('click', this._onClick)
    // Document click closes opened menu (preserves original behavior)
    this._documentClickHandler = (_e: Event) => {
      if (this.opened) {
        this.opened = false
      }
    }
    document.addEventListener('click', this._documentClickHandler)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('click', this._onClick)
    if (this._documentClickHandler) {
      document.removeEventListener('click', this._documentClickHandler)
      this._documentClickHandler = null
    }
  }

  firstUpdated() {
    const slot = this.shadowRoot?.querySelector('slot') as HTMLSlotElement | null
    const elements = slot?.assignedElements() ?? []
    if (elements.length > 0) {
      this._activeSlot = elements[0] as Element
      this._activeSlotSrc = this._activeSlot.getAttribute('src') ?? ''
    }
  }

  willUpdate(changed: Map<string, unknown>) {
    // pressed=false must also clear opened (preserved from original setter behavior)
    if (changed.has('pressed') && this.pressed === false && this.opened === true) {
      this.opened = false
    }
  }

  render() {
    const imgPath = getSvgEditor().configObj.curConfig.imgPath
    const iconSrc = imgPath + '/' + this._activeSlotSrc
    const shortcut = this.getAttribute('shortcut')
    const titleText = `${t(this.title)} ${shortcut ? `[${t(shortcut)}]` : ''}`.trim()

    return html`
      <style>:host { --handle-bg-url: url(${imgPath}/handle.svg); }</style>
      <div class=${classMap({ overall: true, pressed: this.pressed, disabled: this.disabled })}>
        <div class=${classMap({ menu: true, open: this.opened })}>
          <slot></slot>
        </div>
        <div class="menu-button" title=${titleText}>
          <span
            class="se-icon"
            aria-hidden="true"
            style=${maskImageStyle(iconSrc)}
          ></span>
          <div class="handle" @click=${this._onClick}></div>
        </div>
      </div>
    `
  }

  private _onClick = (ev: Event) => {
    ev.stopPropagation()
    const target = ev.target as Element
    switch (target.nodeName) {
      case 'SE-FLYINGBUTTON':
        if (this.pressed) {
          this.opened = true
        } else {
          (this._activeSlot as HTMLElement | null)?.click()
          this.pressed = true
        }
        break
      case 'SE-BUTTON':
        this._activeSlotSrc = target.getAttribute('src') ?? ''
        this._activeSlot = target
        this.pressed = true
        this.opened = false
        break
      case 'DIV':
        if (this.opened) {
          this.opened = false
        } else {
          this.opened = true
          // Position the menu: preserve original menu.style.top behavior
          const rect = this.getBoundingClientRect()
          const menu = this.shadowRoot?.querySelector('.menu') as HTMLElement | null
          if (menu) menu.style.top = rect.top + 'px'
        }
        break
      default:
        console.error('unkonw nodeName for:', target, (target as HTMLElement).className)
    }
  }
}
