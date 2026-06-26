import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { t } from '../locale.js'
import { getSvgEditor } from '../svgEditorInstance.js'
import { maskImageStyle, seIconMask } from './component-utils.js'

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
    .option {
      padding: 0.25rem 0.125rem !important;
      background-color: var(--se-surface);
    }
    .option:hover {
      background-color: var(--se-accent-subtle);
    }
    .selected {
      background-color: var(--se-accent-subtle);
    }
    .se-icon {
      display: inline-block;
      ${seIconMask}
      vertical-align: middle;
    }
  `

  @property() accessor option = ''
  @property() accessor src = ''
  @property() accessor title = ''
  @property({ attribute: 'img-height' }) accessor imgHeight = ''
  @property() accessor selected = ''

  connectedCallback() {
    super.connectedCallback()
    // The light-DOM host carries the listbox option semantics (role / selection /
    // roving tabindex) so they share the consumer's DOM scope with the seList
    // combobox — ARIA id-references don't cross the shadow boundary (#120).
    if (!this.hasAttribute('role')) this.setAttribute('role', 'option')
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1')
    this.setAttribute('aria-selected', this.selected === 'true' ? 'true' : 'false')
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('selected')) {
      this.setAttribute('aria-selected', this.selected === 'true' ? 'true' : 'false')
    }
  }

  render() {
    const imgPath = getSvgEditor().configObj.curConfig.imgPath
    return html`
      <div
        class=${this.selected === 'true' ? 'option selected' : 'option'}
        @mousedown=${this._onMousedown}
      >
        ${this.src
          ? html`<span
              class="se-icon"
              aria-hidden="true"
              title=${t(this.title)}
              style=${`width:${this.imgHeight || '24px'};height:${this.imgHeight || '24px'};${maskImageStyle(imgPath + '/' + this.src)}`}
            ></span>`
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
