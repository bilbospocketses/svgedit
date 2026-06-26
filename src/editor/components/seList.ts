import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'
import { getSvgEditor } from '../svgEditorInstance.js'
import { maskImageStyle } from './component-utils.js'

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
      background-color: var(--se-accent-subtle);
    }

    #select-container::part(value) {
      background-color: var(--se-bg);
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
    .se-icon {
      display: inline-block;
      background-color: var(--se-icon);
      -webkit-mask-position: center; mask-position: center;
      -webkit-mask-size: contain; mask-size: contain;
      -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
      vertical-align: middle;
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
  // Index of the keyboard-active option (roving tabindex); -1 when none.
  private _activeIndex = -1

  render() {
    return html`
      <label id="se-list-label">${t(this.label)}</label>
      <div
        id="select-container"
        title=${ifDefined(this.title ? t(this.title) : undefined)}
        style=${[
          this.width ? `width:${this.width};` : '',
          this.height ? `height:${this.height};` : ''
        ].join('')}
      >
        <div
          id="selected-value"
          role="combobox"
          tabindex="0"
          aria-haspopup="listbox"
          aria-controls="options-container"
          aria-labelledby="se-list-label"
          aria-expanded=${this.isDropdownOpen ? 'true' : 'false'}
          @click=${this._toggleList}
        >
          ${this._renderSelectedValue()}
        </div>
        <div
          id="options-container"
          role="listbox"
          aria-labelledby="se-list-label"
          class=${this.isDropdownOpen ? '' : 'closed'}
        >
          <slot></slot>
        </div>
      </div>
    `
  }

  private _renderSelectedValue() {
    const imgPath = getSvgEditor().configObj.curConfig.imgPath
    const items = this.querySelectorAll('se-list-item')
    for (const el of Array.from(items)) {
      if (el.getAttribute('value') === this.value) {
        const src = el.getAttribute('src')
        if (src) {
          const imgHeight = el.getAttribute('img-height') ?? ''
          const titleAttr = el.getAttribute('title') ?? ''
          return html`<span
            class="se-icon"
            aria-hidden="true"
            title=${t(titleAttr)}
            style=${`width:${imgHeight || '24px'};height:${imgHeight || '24px'};${maskImageStyle(imgPath + '/' + src)}`}
          ></span>`
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

    // Keyboard nav for the combobox/listbox (#120): trigger keydowns (closed) and
    // focused-option keydowns (open) both bubble to the host.
    this.addEventListener('keydown', this._onKeydown)

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
    this.removeEventListener('keydown', this._onKeydown)
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

  private _onFocusOut = (e: FocusEvent) => {
    // Keep the list open while focus moves within the component (between options,
    // or back to the trigger); only close when focus leaves entirely.
    const next = e.relatedTarget as Node | null
    if (next && (this.contains(next) || this.shadowRoot?.contains(next))) return
    this.isDropdownOpen = false
  }

  private get _items(): HTMLElement[] {
    return Array.from(this.querySelectorAll('se-list-item'))
  }

  private _onKeydown = (e: KeyboardEvent) => {
    const items = this._items
    if (!this.isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this._openList()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._focusItem(Math.min(this._activeIndex + 1, items.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        this._focusItem(Math.max(this._activeIndex - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        this._focusItem(0)
        break
      case 'End':
        e.preventDefault()
        this._focusItem(items.length - 1)
        break
      case 'Enter':
      case ' ': {
        e.preventDefault()
        const active = items[this._activeIndex]
        if (active) this._selectItem(active)
        break
      }
      case 'Escape':
        e.preventDefault()
        this.isDropdownOpen = false
        this._focusTrigger()
        break
    }
  }

  private _openList() {
    this.isDropdownOpen = true
    void this.updateComplete.then(() => {
      this._setDropdownListPosition()
      const items = this._items
      const selected = items.findIndex((el) => el.getAttribute('value') === this.value)
      this._focusItem(selected >= 0 ? selected : 0)
    })
  }

  private _focusItem(index: number) {
    const items = this._items
    if (!items.length) return
    items.forEach((el, i) => el.setAttribute('tabindex', i === index ? '0' : '-1'))
    this._activeIndex = index
    items[index]?.focus()
  }

  private _focusTrigger() {
    const trigger = this.shadowRoot?.querySelector('#selected-value') as HTMLElement | null
    trigger?.focus()
  }

  private _selectItem(item: HTMLElement) {
    const value = item.getAttribute('value') ?? ''
    this.value = value
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value } }))
    this.isDropdownOpen = false
    this._focusTrigger()
  }
}
