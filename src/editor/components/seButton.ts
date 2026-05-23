import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

/**
 * SeButton — icon-button custom element.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-button`
 *   - Attributes: `title`, `src`, `pressed`, `disabled`, `size`, `style` (observed)
 *   - Attribute: `shortcut` (read in connectedCallback; not observed)
 *   - Consumers attach click handlers via `$click($id('tool_xxx'), handler)` on the host.
 *   - Tests select by host id only (`#tool_export`, `#tool_undo`, etc.) — no shadow-pierce.
 *
 * No host-id mirror needed: test locators target the host element, not inner shadow elements.
 *
 * Dropped:
 *   - Static template + `cloneNode`, `_shadowRoot`, `$div`, `$img` instance fields
 *   - `observedAttributes` / `attributeChangedCallback` imperative dispatch
 *   - Getters/setters for title/pressed/disabled/src/size (Lit attr↔property handles them)
 *   - Constructor-time `svgEditor.configObj.curConfig.imgPath` access (moved to render())
 *   - `@class` / `@function` JSDoc tags (Tier B style; reference components don't use them)
 *
 * style attribute conflict: HTMLElement.style is a CSSStyleDeclaration — do NOT declare
 * @property() accessor style. Forward host's `style` attribute to inner div via
 * `this.getAttribute('style')` in render().
 */
@customElement('se-button')
export class SeButton extends LitElement {
  static styles = css`
    @keyframes btnHover {
      from {
        background-color: var(--main-bg-color);
      }

      to {
        background-color: var(--icon-bg-color-hover);
      }
    }
    :host(:hover) :not(.disabled)
    {
      animation: btnHover 0.2s forwards;
    }
    div
    {
      height: 24px;
      width: 24px;
      margin: 4px 1px 4px;
      padding: 3px;
      background-color: var(--icon-bg-color);
      cursor: pointer;
      border-radius: 3px;
    }
    .small {
      width: 14px;
      height: 14px;
      padding: 1px;
      border-radius: 1px;
    }
    img {
      border: none;
      width: 100%;
      height: 100%;
    }
    .pressed {
      background-color: var(--icon-bg-color-hover);
    }
    .disabled {
      opacity: 0.3;
      cursor: default;
    }
  `

  @property() accessor title = ''
  @property() accessor src = ''
  @property({ type: Boolean }) accessor pressed = false
  @property({ type: Boolean }) accessor disabled = false
  @property() accessor size = ''

  render() {
    const divClass = [
      this.pressed && 'pressed',
      this.disabled && 'disabled',
      this.size === 'small' && 'small'
    ].filter(Boolean).join(' ')

    const shortcut = this.getAttribute('shortcut') ?? ''
    const divTitle = `${t(this.title)} ${shortcut ? '[' + t(shortcut) + ']' : ''}`.trim()

    let imgSrc: string | undefined
    if (this.src) {
      if (this.src.indexOf('data:') !== -1) {
        imgSrc = this.src
      } else {
        imgSrc = svgEditor.configObj.curConfig.imgPath + '/' + this.src
      }
    }

    const hostStyle = this.getAttribute('style')

    return html`
      <div
        title=${divTitle}
        class=${divClass}
        style=${ifDefined(hostStyle ?? undefined)}
      >
        <img alt="icon" src=${ifDefined(imgSrc)} />
      </div>
    `
  }

  connectedCallback() {
    super.connectedCallback()
    // capture shortcuts
    const shortcut = this.getAttribute('shortcut')
    if (shortcut) {
      // register the keydown event
      document.addEventListener('keydown', (e) => {
        // only track keyboard shortcuts for the body containing the svgedit editor
        if ((e.target as Element).nodeName !== 'BODY') return
        // normalize key
        const key = `${(e.metaKey) ? 'meta+' : ''}${(e.ctrlKey) ? 'ctrl+' : ''}${e.key.toUpperCase()}`
        if (shortcut !== key) return
        // launch the click event
        this.click()
        e.preventDefault()
      })
    }
  }
}
