/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
// @ts-expect-error: no declaration file for elix/src/plain/PlainMenuButton.js
import PlainMenuButton from 'elix/src/plain/PlainMenuButton.js'
import { defaultState } from 'elix/src/base/internal.js'
import sePlainBorderButton from './sePlainBorderButton.js'

/**
 * @class ElixMenuButton
 */
export default class ElixMenuButton extends (PlainMenuButton as unknown as typeof HTMLElement) {
  /**
    * @function get
    * @returns {PlainObject}
  */
  get [defaultState] (): any {
    // @ts-expect-error: elix computed property key not in HTMLElement type
    return Object.assign(super[defaultState], {
      sourcePartType: sePlainBorderButton
    })
  }
}

customElements.define('elix-menu-button', ElixMenuButton)
