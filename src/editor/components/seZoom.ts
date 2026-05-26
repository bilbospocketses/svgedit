import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { styleMap } from 'lit/directives/style-map.js'
import { getSvgEditor } from '../svgEditorInstance.js'

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
 * Inverted-guard attributeChangedCallback:
 *   The original code runs its "sync inputElement.value" block when oldValue === newValue
 *   (guard is inverted — should be oldValue !== newValue). This behavior is preserved via
 *   an attributeChangedCallback override that calls super then adds the parseInt-mismatch
 *   re-sync path. See TODO comment below.
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
      background-color: var(--input-color);
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
      background-color: var(--input-color);
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
        color: var(--icon-bg-color-hover);
      }
      to {
        background: var(--icon-bg-color-hover);
        color: var(--orange-color);
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
      background-color: var(--input-color);
      border-radius: 0px 3px 3px 0px;
      margin: 2px 5px 0px 1px;
    }
    #down > img {
      margin-top: 2px;
    }
    #options-container {
      position: fixed;
      display: flex;
      flex-direction: column;
      background-color: var(--icon-bg-color);
      border: solid 1px white;
      box-shadow: 0 0px 10px rgb(0 0 0 / 50%);
    }
    ::slotted(*) {
      margin: 2px;
      padding: 3px;
      color: white;
    }
    ::slotted(*:hover) {
      background-color: rgb(43, 60, 69);
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
  }

  // TODO: see todo #10 — inverted-guard attributeChangedCallback: runs inner block when
  // old===new; preserved as-is. When oldValue === newValue, if parseInt of the current input
  // value doesn't match parseInt of newValue, re-sync the input. This fires even when the
  // attribute didn't actually change (the condition should logically be oldValue !== newValue).
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
        <img id="icon" alt="icon" width="18" height="18" src=${ifDefined(iconSrc)} />
        <input
          .value=${this.value}
          @click=${this._handleInputClick}
          @change=${this._handleInput}
          @keydown=${this._handleKeyDown}
        />
        <div id="spinner">
          <div
            id="arrow-up"
            @click=${this._increment}
            @mousedown=${this._onArrowUpMouseDown}
            @mouseleave=${this._onArrowUpMouseLeave}
            @mouseup=${this._onArrowUpMouseUp}
          >&#x25B2;</div>
          <div
            id="arrow-down"
            @click=${this._decrement}
            @mousedown=${this._onArrowDownMouseDown}
            @mouseleave=${this._onArrowDownMouseLeave}
            @mouseup=${this._onArrowDownMouseUp}
          >&#x25BC;</div>
        </div>
        <div id="down" @click=${this._handleClick}>
          <img width="16" height="8" src=${arrowDownSrc} alt="Zoom dropdown" />
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
      this._options = assigned
      this._initPopup()
      this._options.forEach(option => {
        option.addEventListener('click', e => this._handleSelect(e))
      })
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
