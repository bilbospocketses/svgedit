import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

/**
 * SeInput — form-control custom element.
 * Reference component B for the elix → Lit migration (PR-1 / spec § "Reference component shape B").
 *
 * External API preserved (verified by tests/unit/seInput.test.js):
 *   - Custom element name: `se-input`
 *   - Attributes: `value`, `label`, `src`, `size`, `title`
 *   - Dispatches `change` Event (bubbles + composed) on user input via inner <input>
 *   - When `label` is set, renders <span id="label" part="label"> with t(label)
 *   - When `src` is set (with no `label`), renders <img> with that src
 *   - ::part('label'), ::part('input'), ::part('icon') exposed as styling hooks for downstream callers
 *
 * Substrate notes:
 *   - Drops `import 'elix/define/Input.js'` — 1 of the 12 elix-bound deps killed.
 *   - Inner <input> owned directly; no elix wrapping.
 *   - Theme variable preserved verbatim: `--input-color`.
 *   - `accessor` keyword required on @property declarations (TC39 standard decorators + Lit 3).
 */
@customElement('se-input')
export class SeInput extends LitElement {
  static styles = css`
    .wrap {
      height: 24px;
      margin: 5px 1px;
      padding: 3px;
    }
    img {
      top: 2px;
      left: 4px;
      position: relative;
    }
    #label {
      bottom: 1px;
      right: -4px;
      position: relative;
      margin-right: 4px;
      color: #fff;
    }
    input {
      background-color: var(--input-color);
      border-radius: 3px;
      height: 24px;
    }
  `

  @property() accessor value = ''
  @property() accessor label = ''
  @property() accessor title = ''
  @property() accessor src = ''
  @property({ type: Number }) accessor size = 0

  render() {
    return html`
      <div class="wrap" title=${t(this.title)}>
        ${this.src && !this.label
          ? html`<img alt="icon" width="12" height="12" src=${this.src} part="icon" />`
          : nothing}
        ${this.label
          ? html`<span id="label" part="label">${t(this.label)}</span>`
          : nothing}
        <input
          part="input"
          .value=${this.value}
          size=${ifDefined(this.size || undefined)}
          @change=${this._onChange}
          @keyup=${this._onChange}
        />
      </div>
    `
  }

  // Class-field arrow auto-binds `this` (avoids @typescript-eslint/unbound-method
   // false-positive on Lit's `@event=${this._handler}` pattern, which Lit binds itself).
  private _onChange = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }
}
