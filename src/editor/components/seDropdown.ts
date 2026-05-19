/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import ListComboBox from 'elix/define/ListComboBox.js'
import { defaultState } from 'elix/src/base/internal.js'
import { templateFrom, fragmentFrom } from 'elix/src/core/htmlLiterals.js'
import { internal } from 'elix'
// @ts-expect-error: local elix override; no declaration file exists yet
import NumberSpinBox from '../dialogs/se-elix/define/NumberSpinBox.js'

/**
 * @class Dropdown
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class Dropdown extends (ListComboBox as any) {
  $img!: HTMLImageElement
  $input!: HTMLElement
  /**
    * @function get
    * @returns {PlainObject}
    */
  get [defaultState] () {
    return Object.assign(super[defaultState], {
      inputPartType: NumberSpinBox,
      src: 'logo.svg',
      inputsize: '100%'
    })
  }

  /**
    * @function get
    * @returns {PlainObject}
  */
  get [internal.template] () {
    const result = super[internal.template]
    const source = result.content.getElementById('source')
    // add a icon before our dropdown
    source.prepend(fragmentFrom.html`
      <img src="dropdown.svg" alt="icon" width="18" height="18"></img>
      `.cloneNode(true))
    // change the style so it fits in our toolbar
    result.content.append(
      templateFrom.html`
        <style>
        [part~="source"] {
          grid-template-columns: 20px 1fr auto;
        }
        ::slotted(*) {
          padding: 4px;
          background: #E8E8E8;
          border: 1px solid #5a6162;
          width: 100%;
        }
        [part~="popup"] {
          width: 150%;
        }
        </style>
      `.content
    )
    return result
  }

  /**
   * @function observedAttributes
   * @returns {any} observed
   */
  static get observedAttributes () {
    return ['title', 'src', 'inputsize', 'value']
  }

  /**
   * @function attributeChangedCallback
   * @param {string} name
   * @param {string} oldValue
   * @param {string} newValue
   * @returns {void}
   */
  attributeChangedCallback (name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return
    switch (name) {
      case 'title':
      // this.$span.setAttribute('title', `${newValue} ${shortcut ? `[${shortcut}]` : ''}`);
        break
      case 'src':
        this.src = newValue
        break
      case 'inputsize':
        this.inputsize = newValue
        break
      default:
        super.attributeChangedCallback(name, oldValue, newValue)
        break
    }
  }

  /**
    * @function [internal.render]
    * @param {PlainObject} changed
    * @returns {void}
    */
  [internal.render] (changed: Record<string, boolean>) {
    super[internal.render](changed)
    if (this[internal.firstRender]) {
      this.$img = this.shadowRoot.querySelector('img')
      this.$input = this.shadowRoot.getElementById('input')
    }
    if (changed.src) {
      this.$img.setAttribute('src', this[internal.state].src)
    }
    if (changed.inputsize) {
      ;(this.$input.shadowRoot?.querySelector('[part~="input"]') as HTMLElement | null)?.style.setProperty('width', this[internal.state].inputsize)
    }
    if (changed.inputPartType) {
      // Wire up handler on new input.
      ;(this as unknown as HTMLElement).addEventListener('close', (e) => {
        e.preventDefault()
        const value = (e as CustomEvent).detail?.closeResult?.getAttribute('value')
        if (value) {
          const closeEvent = new CustomEvent('change', { detail: { value } })
          ;(this as unknown as HTMLElement).dispatchEvent(closeEvent)
        }
      })
    }
  }

  /**
   * @function src
   * @returns {string} src
   */
  get src () {
    return this[internal.state].src
  }

  /**
   * @function src
   * @returns {void}
   */
  set src (src: string) {
    this[internal.setState]({ src })
  }

  /**
   * @function inputsize
   * @returns {string} src
   */
  get inputsize () {
    return this[internal.state].inputsize
  }

  /**
   * @function src
   * @returns {void}
   */
  set inputsize (inputsize: string) {
    this[internal.setState]({ inputsize })
  }

  /**
   * @function value
   * @returns {string} src
   */
  get value () {
    return this[internal.state].value
  }

  /**
   * @function value
   * @returns {void}
   */
  set value (value: string) {
    this[internal.setState]({ value })
  }
}

// Register
customElements.define('se-dropdown', Dropdown as unknown as CustomElementConstructor)

/*
{TODO
    min: 0.001, max: 10000, step: 50, stepfunc: stepZoom,
  function stepZoom (elem, step) {
    const origVal = Number(elem.value);
    if (origVal === 0) { return 100; }
    const sugVal = origVal + step;
    if (step === 0) { return origVal; }

    if (origVal >= 100) {
      return sugVal;
    }
    if (sugVal >= origVal) {
      return origVal * 2;
    }
    return origVal / 2;
  }
*/
