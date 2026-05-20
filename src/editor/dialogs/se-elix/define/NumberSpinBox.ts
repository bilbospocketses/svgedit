/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import PlainNumberSpinBox from '../src/plain/PlainNumberSpinBox.js'

/**
 * @class ElixNumberSpinBox
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export default class ElixNumberSpinBox extends (PlainNumberSpinBox as unknown as typeof HTMLElement) {}

customElements.define('elix-number-spin-box', ElixNumberSpinBox)
