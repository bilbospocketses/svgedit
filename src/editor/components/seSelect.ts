import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

/**
 * SeSelect — attribute-driven `<select>` form-control custom element.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-select`
 *   - Attributes: `label`, `width`, `height`, `options`, `values`, `title`, `disabled`
 *   - `options` splits on `,`; `values` splits on `::` and zips as `value=` on each option.
 *   - `value` property read/write forwarded to the inner `<select>` via `.value` binding.
 *   - Dispatches `change` CustomEvent (bubbles + composed) with `detail: { value }` on host.
 *   - `<slot>` preserved for consumers that supply inline `<option>` children (BottomPanel,
 *     TopPanel stroke_style / tool_align_relative).
 *
 * No host-id mirror needed: grep of tests/ found only `#export_box select` (Playwright CSS
 * selector pierces shadow DOM by tag; no explicit `select#<id>` selectors anywhere).
 *
 * Dropped:
 *   - Imperative DOM mutation (`$select`, `$label` instance fields, `connectedCallback`)
 *   - `@class` / `@function` JSDoc tags (Tier B style; reference components don't use them)
 */
@customElement('se-select')
export class SeSelect extends LitElement {
  static styles = css`
    select {
      margin-top: 8px;
      background-color: var(--se-surface-2);
      appearance: none;
      outline: none;
      padding: 3px;
    }
    label {
      margin-left: 2px;
    }
    ::slotted(*) {
      padding: 0;
      width: 100%;
    }
  `

  @property() accessor label = ''
  @property() accessor title = ''
  @property() accessor width = ''
  @property() accessor height = ''
  @property() accessor options = ''
  @property() accessor values = ''
  @property() accessor value = ''
  @property({ type: Boolean }) accessor disabled = false

  render() {
    // Zip options + values into <option value="...">label</option> pairs.
    // When options is non-empty, build option elements; otherwise fall through to <slot>.
    const optionList = this.options
      ? this.options.split(',').map((opt, i) => {
          const vals = this.values ? this.values.split('::') : []
          const val = vals[i] ?? opt
          return html`<option value=${val}>${t(opt)}</option>`
        })
      : nothing

    return html`
      ${this.label ? html`<label>${t(this.label)}</label>` : nothing}
      <select
        title=${ifDefined(this.title ? t(this.title) : undefined)}
        ?disabled=${this.disabled}
        style=${ifDefined(
          this.width || this.height
            ? `${this.width ? `width:${this.width};` : ''}${this.height ? `height:${this.height};` : ''}`
            : undefined
        )}
        .value=${this.value}
        @change=${this._onChange}
      >
        ${optionList}
        <slot></slot>
      </select>
    `
  }

  // Class-field arrow auto-binds `this` (avoids @typescript-eslint/unbound-method
  // false-positive on Lit's `@event=${this._handler}` pattern, which Lit binds itself).
  private _onChange = (e: Event) => {
    this.value = (e.target as HTMLSelectElement).value
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { value: this.value }
    }))
  }
}
