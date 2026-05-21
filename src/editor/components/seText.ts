import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { t } from '../locale.js'

/**
 * SeText — simple text-display custom element.
 * Reference component A for the elix → Lit migration (PR-1 / spec § "Reference component shape A").
 *
 * External API preserved (verified via consumer grep at PR-1 execution):
 *   - Custom element name: `se-text`
 *   - Attributes: `text`, `title` (rendered via t() at render time)
 *   - Attribute: `value` (exposed via @property; read by `<se-zoom>` from child
 *     `<se-text>` options in BottomPanel for zoom-option values)
 *   - Host's `id` attribute: drives the optional `#layersLabel` bold-sizing
 *     via the `:host()` selector (preserves LayersPanel.html:5 behavior;
 *     no other consumer affected)
 *
 * Dropped:
 *   - `style` attribute observation (no consumer found in src/ or tests/)
 *   - Buggy `this.$div.value = newValue` (`@ts-expect-error: pre-existing
 *     null-misuse`) line — HTMLDivElement has no `.value` property
 */
@customElement('se-text')
export class SeText extends LitElement {
  static styles = css`
    :host([id="layersLabel"]) div {
      font-size: 13px;
      line-height: normal;
      font-weight: 700;
    }
  `

  @property() accessor text = ''
  @property() accessor title = ''
  @property() accessor value = ''

  render() {
    return html`
      <div title=${t(this.title)}>${t(this.text)}</div>
    `
  }
}
