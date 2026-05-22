import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
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
 *   - Host's `id` attribute is mirrored onto the inner `<div>` to preserve two
 *     consumer behaviors carried over from the original seText: (a) CSS
 *     `#layersLabel` bold-sizing for `<se-text id="layersLabel">` at
 *     LayersPanel.html:5 (also re-anchored via the `:host([id="layersLabel"])`
 *     selector below as a belt-and-braces guard); (b) Playwright selector
 *     `div#sidepanel_handle` for `<se-text id="sidepanel_handle">` at
 *     LayersPanel.html:2 (used by layers-panel.spec.js:20 and :46). The
 *     original seText's `attributeChangedCallback` `case 'id'` did the same
 *     mirroring imperatively; Lit's `ifDefined` keeps the inner `id` attribute
 *     out of the DOM when the host has no `id`.
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
      <div id=${ifDefined(this.id || undefined)} title=${t(this.title)}>${t(this.text)}</div>
    `
  }
}
