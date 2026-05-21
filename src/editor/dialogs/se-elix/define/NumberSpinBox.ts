/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import PlainNumberSpinBox from '../src/plain/PlainNumberSpinBox.js'

/**
 * @class ElixNumberSpinBox
 */
 
export default class ElixNumberSpinBox extends (PlainNumberSpinBox as unknown as typeof HTMLElement) {}

customElements.define('elix-number-spin-box', ElixNumberSpinBox)
