import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { styleMap } from 'lit/directives/style-map.js'
import { getSvgEditor } from '../svgEditorInstance.js'
import { maskImageStyle, seIconMask } from './component-utils.js'

/**
 * SeZoom — numeric spin input with slotted dropdown of zoom-level options.
 *
 * External API preserved (verified via consumer grep before conversion):
 *   - Custom element name: `se-zoom`
 *   - Attributes observed: `value`
 *   - Attributes read but not observed: `src`, `inputsize`, `title`
 *   - Slotted content: `<se-text value="..." text="...">` children act as zoom-level options.
 *   - Dispatches `change` CustomEvent (NO bubbles/composed) with `detail: { value }` on host.
 *     Consumer (BottomPanel) attaches listener directly on the host so escape-shadow not needed.
 *
 * No host-id mirror needed: consumer uses `id="zoom"` on host; no `div#zoom` shadow-pierce
 * found in tests or CSS.
 *
 * Dropped:
 *   - Static template + `cloneNode`, `_shadowRoot`, instance fields for DOM refs
 *   - Imperative addEventListener wiring in constructor (moved to declarative @event= bindings
 *     and connectedCallback/disconnectedCallback for document + slot listeners)
 *   - Constructor-time `svgEditor.configObj.curConfig.imgPath` access (moved to render())
 *   - `@class` / `@function` JSDoc tags (Tier B style; reference components don't use them)
 *
 * Same-value input re-sync (attributeChangedCallback):
 *   Runs the "sync inputElement.value" block when oldValue === newValue. Intentional
 *   (characterized in audit #121), not an inverted-guard bug: Lit skips re-rendering an
 *   unchanged `.value=` binding, so a same-value re-set of `value` re-syncs a drifted input.
 *   See the inline comment below.
 *
 * Change event dispatch:
 *   Fires in updated() when `value` property changes (mirrors original attributeChangedCallback
 *   dispatch on the oldValue !== newValue branch). No bubbles/composed per original behavior.
 */
@customElement('se-zoom')
export class SeZoom extends LitElement {
  static styles = css`
    input {
      border: unset;
      background-color: var(--se-surface-2);
      min-width: unset;
      width: 40px;
      height: 23px;
      padding: 1px 2px;
      border: 2px;
      font: inherit;
      margin: 2px 1px 0px 2px;
      box-sizing: border-box;
      text-align: center;
      border-radius: 3px 0px 0px 3px;
    }
    #tool-wrapper {
      height: 20px;
      display: flex;
      align-items: center;
    }
    #icon {
      margin-bottom: 1px;
    }
    .se-icon {
      display: inline-block;
      ${seIconMask}
    }
    #spinner {
      display: flex;
      flex-direction: column;
    }
    #spinner > div {
      height: 11px;
      width: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      border-left: solid 1px transparent;
      border-right: solid 1px transparent;
      background-color: var(--se-surface-2);
    }
    #arrow-up {
      height: 9px;
      margin-top: 2px;
      margin-bottom: 1px;
    }
    #arrow-up, #arrow-down {
      user-select: none;
    }
    @keyframes hover-arrows {
      from {
        background: transparent;
        color: var(--se-accent-subtle);
      }
      to {
        background: var(--se-accent-subtle);
        color: var(--se-accent);
      }
    }
    #arrow-up:hover, #arrow-down:hover {
      animation: hover-arrows 0.2s forwards;
    }
    #down {
      width: 18px;
      height: 23px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--se-surface-2);
      border-radius: 0px 3px 3px 0px;
      margin: 2px 5px 0px 1px;
    }
    #down > .se-icon {
      margin-top: 2px;
    }
    #options-container {
      position: fixed;
      display: flex;
      flex-direction: column;
      background-color: var(--se-surface);
      border: solid 1px var(--se-border);
      box-shadow: var(--se-shadow-overlay);
    }
    ::slotted(*) {
      margin: 2px;
      padding: 3px;
      color: var(--se-on-accent);
    }
    ::slotted(*:hover) {
      background-color: var(--se-accent-subtle);
    }
  `

  @property() accessor value = ''
  @property() accessor src = ''

  @state() accessor showOptions = false

  private _changedTimeout: ReturnType<typeof setTimeout> | null = null
  private _options: Element[] = []
  private _incrementHold = false
  private _decrementHold = false
  private _docClickHandler: ((e: MouseEvent) => void) | null = null

  connectedCallback() {
    super.connectedCallback()
    this._docClickHandler = (e: MouseEvent) => this._handleClose(e)
    document.addEventListener('click', this._docClickHandler)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler)
      this._docClickHandler = null
    }
    if (this._changedTimeout) {
      clearTimeout(this._changedTimeout)
      this._changedTimeout = null
    }
    this._options.forEach(option => option.removeEventListener('click', this._handleSelect))
    this._options = []
  }

  // attributeChangedCallback re-syncs the inner input when `value` is re-set to the SAME
  // value. Intentional (characterized in audit #121 — not the dead "inverted guard" it was
  // originally labelled): Lit's `.value=${this.value}` binding skips the re-render on an
  // unchanged value, so when the editor re-applies the current zoom an uncommitted/drifted
  // input would otherwise stay stale. On a same-value re-set, if the displayed value no
  // longer matches, re-sync it. (A `!==` condition would be redundant — Lit re-renders then.)
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue)
    if (oldValue === newValue && name === 'value') {
      const inputEl = this.shadowRoot?.querySelector('input') as HTMLInputElement | null
      if (inputEl && parseInt(inputEl.value) !== parseInt(newValue ?? '')) {
        inputEl.value = newValue ?? ''
      }
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('value')) {
      const oldValue = changedProperties.get('value') as string | undefined
      const newValue = this.value
      if (oldValue !== undefined && oldValue !== newValue) {
        this.dispatchEvent(
          new CustomEvent('change', { detail: { value: newValue } })
        )
      }
    }
  }

  render() {
    const imgPath = getSvgEditor().configObj.curConfig.imgPath
    const iconSrc = this.src ? `${imgPath}/${this.src}` : undefined
    const arrowDownSrc = `${imgPath}/arrow_down.svg`
    const optionsStyle = styleMap({ display: this.showOptions ? 'flex' : 'none' })

    return html`
      <div id="tool-wrapper">
        <span id="icon" class="se-icon" aria-hidden="true" style=${`width:18px;height:18px;${iconSrc ? maskImageStyle(iconSrc) : ''}`}></span>
        <input
          aria-label="Zoom level"
          .value=${this.value}
          @click=${this._handleInputClick}
          @change=${this._handleInput}
          @keydown=${this._handleKeyDown}
        />
        <div id="spinner">
          <div
            id="arrow-up"
            role="button"
            tabindex="0"
            aria-label="Zoom in"
            @click=${this._increment}
            @keydown=${this._onControlKeydown}
            @mousedown=${this._onArrowUpMouseDown}
            @mouseleave=${this._onArrowUpMouseLeave}
            @mouseup=${this._onArrowUpMouseUp}
          >&#x25B2;</div>
          <div
            id="arrow-down"
            role="button"
            tabindex="0"
            aria-label="Zoom out"
            @click=${this._decrement}
            @keydown=${this._onControlKeydown}
            @mousedown=${this._onArrowDownMouseDown}
            @mouseleave=${this._onArrowDownMouseLeave}
            @mouseup=${this._onArrowDownMouseUp}
          >&#x25BC;</div>
        </div>
        <div id="down" role="button" tabindex="0" aria-label="Zoom presets" @click=${this._handleClick} @keydown=${this._onControlKeydown}>
          <span class="se-icon" aria-hidden="true" style=${`width:16px;height:8px;${maskImageStyle(arrowDownSrc)}`}></span>
        </div>
      </div>
      <div id="options-container" style=${optionsStyle}>
        <slot @slotchange=${this._handleOptionsChange}></slot>
      </div>
    `
  }

  private _handleOptionsChange = () => {
    const slot = this.shadowRoot?.querySelector('slot') as HTMLSlotElement | null
    if (!slot) return
    const assigned = slot.assignedElements()
    if (assigned.length > 0) {
      // Detach listeners from the previously slotted options before rebinding so
      // repeated slotchanges don't accumulate duplicate click handlers. Binding the
      // stable `this._handleSelect` reference (not a fresh closure) keeps them removable.
      this._options.forEach(option => option.removeEventListener('click', this._handleSelect))
      this._options = assigned
      this._initPopup()
      this._options.forEach(option => option.addEventListener('click', this._handleSelect))
    }
  }

  private _handleInputClick = () => {
    this.showOptions = true
    const inputEl = this.shadowRoot?.querySelector('input') as HTMLInputElement | null
    inputEl?.select()
    void this.updateComplete.then(() => { this._initPopup() })
  }

  private _handleClick = () => {
    this.showOptions = true
    const inputEl = this.shadowRoot?.querySelector('input') as HTMLInputElement | null
    inputEl?.select()
    void this.updateComplete.then(() => { this._initPopup() })
  }

  // Keyboard activation for the role="button" stepper / presets controls (#119):
  // Enter or Space triggers the same action as a click, scoped by control id.
  private _onControlKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    switch ((e.currentTarget as HTMLElement).id) {
      case 'arrow-up': this._increment(); break
      case 'arrow-down': this._decrement(); break
      case 'down': this._handleClick(); break
    }
  }

  private _handleSelect = (e: Event) => {
    const target = e.target as Element
    this.value = target.getAttribute('value') ?? ''
    this.title = target.getAttribute('text') ?? ''
  }

  private _initPopup() {
    const optionsContainer = this.shadowRoot?.querySelector('#options-container') as HTMLElement | null
    if (!optionsContainer) return
    const zoomPos = this.getBoundingClientRect()
    const popupPos = optionsContainer.getBoundingClientRect()
    const top = zoomPos.top - popupPos.height
    const left = zoomPos.left
    optionsContainer.style.position = 'fixed'
    optionsContainer.style.top = `${top}px`
    optionsContainer.style.left = `${left}px`
  }

  private _handleClose(e: MouseEvent) {
    if (e.target !== this) {
      this.showOptions = false
      const inputEl = this.shadowRoot?.querySelector('input') as HTMLInputElement | null
      inputEl?.blur()
    }
  }

  private _handleInput = () => {
    if (this._changedTimeout) {
      clearTimeout(this._changedTimeout)
    }
    this._changedTimeout = setTimeout(() => this._triggerInputChanged(), 500)
  }

  private _triggerInputChanged() {
    const inputEl = this.shadowRoot?.querySelector('input') as HTMLInputElement | null
    if (inputEl) {
      this.value = inputEl.value
    }
  }

  private _increment = () => {
    this.value = String(parseInt(this.value) + 10)
  }

  private _decrement = () => {
    const current = parseInt(this.value)
    if (current - 10 <= 0) {
      this.value = '10'
    } else {
      this.value = String(current - 10)
    }
  }

  private _handleMouseDown(dir: string, isFirst: boolean): void {
    if (dir === 'up') {
      this._incrementHold = true
      if (!isFirst) { this._increment() }
      setTimeout(
        () => {
          if (this._incrementHold) {
            this._handleMouseDown(dir, false)
          }
        },
        isFirst ? 500 : 50
      )
    } else if (dir === 'down') {
      this._decrementHold = true
      if (!isFirst) { this._decrement() }
      setTimeout(
        () => {
          if (this._decrementHold) {
            this._handleMouseDown(dir, false)
          }
        },
        isFirst ? 500 : 50
      )
    }
  }

  private _handleMouseUp(dir: string): void {
    if (dir === 'up') {
      this._incrementHold = false
    } else {
      this._decrementHold = false
    }
  }

  private _onArrowUpMouseDown = () => this._handleMouseDown('up', true)
  private _onArrowUpMouseLeave = () => this._handleMouseUp('up')
  private _onArrowUpMouseUp = () => this._handleMouseUp('up')
  private _onArrowDownMouseDown = () => this._handleMouseDown('down', true)
  private _onArrowDownMouseLeave = () => this._handleMouseUp('down')
  private _onArrowDownMouseUp = () => this._handleMouseUp('down')

  private _handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      this._increment()
    } else if (e.key === 'ArrowDown') {
      this._decrement()
    }
  }
}
