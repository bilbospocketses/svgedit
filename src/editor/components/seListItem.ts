import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

/**
 * SeListItem — option item inside a `<se-list>` dropdown.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-list-item`
 *   - Attributes: `option`, `src`, `title`, `img-height`, `selected`
 *   - Attribute: `value` (read from host by the `selectedindexchange` event detail)
 *   - Dispatches `selectedindexchange` CustomEvent (bubbles + composed) on mousedown;
 *     detail: `{ selectedItem: <host's 'value' attribute> }`
 *   - `selected` is a string attribute (`'true'` / `'false'`), not a boolean attribute;
 *     toggled by seList.ts via `setAttribute('selected', 'true'/'false')`.
 *
 * No host-id mirror needed: grep of all CSS + test files found no `#linejoin_*`,
 * `#linecap_*`, or `#tool_posleft` selectors targeting inner elements.
 *
 * Dropped:
 *   - Imperative DOM mutation (`$menuitem`, `$img` instance fields)
 *   - Constructor-time `svgEditor.configObj.curConfig.imgPath` access (moved to
 *     render() so it evaluates after svgEditor is set up on window)
 *   - `@function` / `@class` JSDoc tags (Tier B style; reference components don't use them)
 */
@customElement('se-list-item')
export class SeListItem extends LitElement {
  static styles = css`
    [aria-label="option"] {
      padding: 0.25rem 0.125rem !important;
      background-color: var(--icon-bg-color);
    }
    [aria-label="option"]:hover {
      background-color: var(--icon-bg-color-hover);
    }
    .selected {
      background-color: var(--icon-bg-color-hover);
    }
  `

  @property() accessor option = ''
  @property() accessor src = ''
  @property() accessor title = ''
  @property({ attribute: 'img-height' }) accessor imgHeight = ''
  @property() accessor selected = ''

  render() {
    const imgPath = svgEditor.configObj.curConfig.imgPath
    return html`
      <div
        aria-label="option"
        class=${this.selected === 'true' ? 'selected' : ''}
        @mousedown=${this._onMousedown}
      >
        ${this.src
          ? html`<img alt="icon" src=${imgPath + '/' + this.src} title=${t(this.title)} height=${ifDefined(this.imgHeight || undefined)} />`
          : nothing}
        ${this.option ? t(this.option) : nothing}
        <slot></slot>
      </div>
    `
  }

  private _onMousedown = (_e: Event) => {
    this.dispatchEvent(new CustomEvent('selectedindexchange', {
      bubbles: true,
      composed: true,
      detail: { selectedItem: this.getAttribute('value') }
    }))
  }
}
