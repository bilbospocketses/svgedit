import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'
import { getSvgEditor } from '../svgEditorInstance.js'

/**
 * SeList — dropdown container custom element.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-list`
 *   - Attributes: `label`, `width`, `height`, `title`, `value`
 *   - Dispatches `change` CustomEvent (bubbles + composed) on item selection;
 *     detail: `{ value: <selected value> }`
 *   - Listens for `selectedindexchange` from child `<se-list-item>` elements;
 *     seListItem dispatches with `bubbles: true, composed: true` so the event
 *     crosses the shadow boundary and is received on this host element.
 *
 * No host-id mirror needed: grep of CSS + test files found no selectors
 * targeting inner elements via consumer host ids (stroke_linejoin,
 * stroke_linecap, tool_position, tool_text_anchor).
 *
 * Dropped:
 *   - Imperative DOM construction via `template` + `cloneNode`
 *   - Constructor-time `svgEditor.configObj.curConfig.imgPath` access (moved to
 *     `_renderSelectedValue()` so it evaluates after svgEditor is set up on window)
 *   - `@class` / `@function` JSDoc tags (Tier B style)
 *   - `eslint-disable-next-line @typescript-eslint/no-this-alias` / `currentObj` alias
 */
@customElement('se-list')
export class SeList extends LitElement {
  static styles = css`
    #select-container {
      margin-top: 10px;
      display: inline-block;
    }

    #select-container:hover {
      background-color: var(--icon-bg-color-hover);
    }

    #select-container::part(value) {
      background-color: var(--main-bg-color);
    }

    #select-container::part(popup-toggle) {
      display: none;
    }

    ::slotted(*) {
      padding: 0;
      width: 100%;
    }

    .closed {
      display: none;
    }

    #options-container {
      position: fixed;
    }
  `

  @property() accessor label = ''
  @property() accessor width = ''
  @property() accessor height = ''
  @property() accessor title = ''
  @property() accessor value = ''

  @state() accessor isDropdownOpen = false

  // Saved reference for removal in disconnectedCallback
  private _mousedownHandler: ((e: MouseEvent) => void) | null = null

  render() {
    return html`
      <label>${t(this.label)}</label>
      <div
        id="select-container"
        tabindex="0"
        title=${ifDefined(this.title ? t(this.title) : undefined)}
        style=${[
          this.width ? `width:${this.width};` : '',
          this.height ? `height:${this.height};` : ''
        ].join('')}
      >
        <div id="selected-value" @click=${this._toggleList}>
          ${this._renderSelectedValue()}
        </div>
        <div id="options-container" class=${this.isDropdownOpen ? '' : 'closed'}>
          <slot></slot>
        </div>
      </div>
    `
  }

  private _renderSelectedValue() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const imgPath = getSvgEditor().configObj.curConfig.imgPath
    const items = this.querySelectorAll('se-list-item')
    for (const el of Array.from(items)) {
      if (el.getAttribute('value') === this.value) {
        const src = el.getAttribute('src')
        if (src) {
          const imgHeight = el.getAttribute('img-height') ?? ''
          const titleAttr = el.getAttribute('title') ?? ''
          return html`<img
            src=${imgPath + '/' + src}
            style=${imgHeight ? `height:${imgHeight}` : ''}
            title=${t(titleAttr)}
          />`
        } else {
          return html`${t(el.getAttribute('option') ?? '')}`
        }
      }
    }
    return nothing
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('value')) {
      this._syncItemSelected()
    }
  }

  private _syncItemSelected() {
    const items = this.querySelectorAll('se-list-item')
    for (const el of Array.from(items)) {
      el.setAttribute('selected', el.getAttribute('value') === this.value ? 'true' : 'false')
    }
  }

  private _toggleList = (_e: Event) => {
    if (!this.isDropdownOpen) {
      this.isDropdownOpen = true
      // Position runs after Lit has committed the open state and the container is visible
      void this.updateComplete.then(() => { this._setDropdownListPosition() })
    } else {
      this.isDropdownOpen = false
    }
  }

  private _setDropdownListPosition() {
    const selection = this.shadowRoot?.querySelector('#selected-value') as HTMLElement | null
    const optionsContainer = this.shadowRoot?.querySelector('#options-container') as HTMLElement | null
    if (!selection || !optionsContainer) return
    const windowHeight = window.innerHeight
    const selectedPos = selection.getBoundingClientRect()
    const optionsPos = optionsContainer.getBoundingClientRect()
    if (selectedPos.bottom + optionsPos.height > windowHeight) {
      optionsContainer.style.top = selectedPos.top - optionsPos.height + 'px'
      optionsContainer.style.left = selectedPos.left + 'px'
    } else {
      optionsContainer.style.top = selectedPos.bottom + 'px'
      optionsContainer.style.left = selectedPos.left + 'px'
    }
  }

  connectedCallback() {
    super.connectedCallback()

    // selectedindexchange bubbles + composed from seListItem shadow DOM, received on host
    this.addEventListener('selectedindexchange', this._onSelectedIndexChange)

    // focusout on the shadow container — composed events cross shadow boundary to host
    this.addEventListener('focusout', this._onFocusOut)

    // Outside-click closes dropdown
    this._mousedownHandler = (e: MouseEvent) => {
      if (this.isDropdownOpen) {
        if (!(e.target as Element).closest('se-list')) {
          e.stopPropagation()
          this.isDropdownOpen = false
        }
      }
    }
    window.addEventListener('mousedown', this._mousedownHandler, { capture: true })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('selectedindexchange', this._onSelectedIndexChange)
    this.removeEventListener('focusout', this._onFocusOut)
    if (this._mousedownHandler) {
      window.removeEventListener('mousedown', this._mousedownHandler, { capture: true })
      this._mousedownHandler = null
    }
  }

  private _onSelectedIndexChange = (e: Event) => {
    const detail = (e as CustomEvent).detail as { selectedItem?: string } | undefined
    if (detail?.selectedItem !== undefined) {
      const value = detail.selectedItem
      this.value = value
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { value }
      }))
      this.isDropdownOpen = false
    }
  }

  private _onFocusOut = (_e: Event) => {
    this.isDropdownOpen = false
  }
}
