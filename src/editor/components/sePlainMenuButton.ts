// @ts-expect-error: no declaration file for elix/src/plain/PlainMenuButton.js
import PlainMenuButton from 'elix/src/plain/PlainMenuButton.js'
import { defaultState } from 'elix/src/base/internal.js'
import sePlainBorderButton from './sePlainBorderButton.js'

/**
 * @class ElixMenuButton
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export default class ElixMenuButton extends (PlainMenuButton as unknown as typeof HTMLElement) {
  /**
    * @function get
    * @returns {PlainObject}
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get [defaultState] (): any {
    // @ts-expect-error: elix computed property key not in HTMLElement type
    return Object.assign(super[defaultState], {
      sourcePartType: sePlainBorderButton
    })
  }
}

customElements.define('elix-menu-button', ElixMenuButton)
