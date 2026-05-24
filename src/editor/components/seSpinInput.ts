import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

/**
 * SESpinInput — number-input custom element with optional icon or label.
 * Migrated from elix `<elix-number-spin-box>` wrapper to Lit-owned native
 * `<input type="number">` per PR-3a Task 1 (pilot). Reference shape B (seInput.ts)
 * adapted with `type="number"` plus min/max/step pass-through.
 *
 * External API preserved (verified via consumer grep across TopPanel.html,
 * BottomPanel.html, exportDialog.html, ext-polystar.ts + their *.ts callsites):
 *   - Custom element name: `se-spin-input` (registration tag unchanged)
 *   - Class name: `SESpinInput` (not in PR-2 class-renames list)
 *   - Attributes: `value`, `label`, `src`, `size`, `min`, `max`, `step`, `title`
 *   - Reads `shortcut` attribute at render-time for title display (not observed)
 *   - Dispatches `change` Event (bubbles + composed) on user input.
 *     Consumers attach `.addEventListener('change', ...)` on the host
 *     (TopPanel.ts:976-979, BottomPanel.ts:210-223, ext-polystar.ts:136-203)
 *     and read `e.target.value` / `e.target.getAttribute('data-attr')` —
 *     both work because Shadow DOM retargets `e.target` to the host on
 *     composed-bubbled events.
 *   - `.value` property setter+getter used by callers
 *     (Editor.ts, EditorStartup.ts, TopPanel.ts, ext-polystar.ts) — backed by
 *     the Lit `accessor` which mirrors to the inner `<input>`.
 *   - CSS variable `--global-se-spin-input-width` preserved verbatim
 *     (svgedit.css:12 → consumed here in `div.imginside` rule).
 *   - `::part(input)` exposed as styling hook (parity with seInput.ts).
 *
 * Substrate notes:
 *   - Drops `import '../dialogs/se-elix/define/NumberSpinBox.js'` — 1 of the
 *     12 elix-bound deps killed in PR-3a.
 *   - Native `<input type="number">` provides browser-native spin-button UX,
 *     replacing elix's custom spin-button shadow parts (no external consumer
 *     targeted `::part(spin-button)`, verified by repo-wide grep).
 *   - 3 shadowDOM-piercing sites (`this.$input.shadowRoot.getElementById('input')`
 *     at lines 115, 117; childNodes-iteration at lines 217-229 in the original)
 *     resolve naturally — the Lit version owns the input directly, so
 *     `size`, `style.width`, and the `keyup` listener bind declaratively.
 *   - `svgEditor.$click(this.$input, …)` at original line 235 replaced with
 *     declarative `@click=${this._onChange}`: the helper registered both
 *     `click` and `touchend`, which modern browsers double-fire on tap
 *     because they synthesize `click` from touch natively. Native `@click=`
 *     fires once.
 *   - The original shared `CustomEvent('change')` allocated once at
 *     constructor is replaced with a fresh `new Event('change', …)` per
 *     dispatch (convention bullet 8).
 *   - `imgPath` read at render-time via `svgEditor.configObj.curConfig.imgPath`
 *     (matches the seButton.ts pattern, avoids constructor-time global access).
 */
@customElement('se-spin-input')
export class SESpinInput extends LitElement {
  static styles = css`
    div {
      height: 24px;
      margin: 5px 1px;
      padding: 3px;
    }
    div.imginside {
      width: var(--global-se-spin-input-width);
    }
    img {
      position: relative;
      right: -4px;
      top: 2px;
    }
    span {
      bottom: -0.5em;
      right: -4px;
      position: relative;
      margin-left: -4px;
      margin-right: 1px;
      color: #fff;
    }
    input {
      background-color: var(--input-color);
      border-radius: 3px;
      height: 20px;
      margin-top: 1px;
      vertical-align: top;
      width: 54px;
    }
  `

  @property() accessor value = ''
  @property() accessor label = ''
  @property() accessor title = ''
  @property() accessor src = ''
  @property() accessor size = ''
  @property() accessor min = ''
  @property() accessor max = ''
  @property() accessor step = ''

  render() {
    const shortcut = this.getAttribute('shortcut')
    const divTitle = `${t(this.title)} ${shortcut ? '[' + t(shortcut) + ']' : ''}`
    const imgSrc = this.src ? svgEditor.configObj.curConfig.imgPath + '/' + this.src : undefined
    const showImg = !!this.src && !this.label
    const showLabel = !!this.label
    const divClass = showImg ? 'imginside' : ''

    return html`
      <div class=${divClass} title=${divTitle}>
        ${showImg
          ? html`<img alt="icon" width="24" height="24" aria-labelledby="label" src=${ifDefined(imgSrc)} />`
          : nothing}
        ${showLabel
          ? html`<span id="label" part="label">${t(this.label)}</span>`
          : nothing}
        <input
          type="number"
          part="input"
          .value=${this.value}
          size=${ifDefined(this.size || undefined)}
          min=${ifDefined(this.min || undefined)}
          max=${ifDefined(this.max || undefined)}
          step=${ifDefined(this.step || undefined)}
          @change=${this._onChange}
          @keyup=${this._onKeyup}
          @click=${this._onChange}
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

  // keyup mirrors the original's NaN-guard so e.g. stray modifier-key presses
  // don't push 'NaN' into consumers via the shared change-handler.
  private _onKeyup = (e: KeyboardEvent) => {
    const val = (e.target as HTMLInputElement).value
    if (!isNaN(Number(val))) {
      this.value = val
      this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    }
  }
}
