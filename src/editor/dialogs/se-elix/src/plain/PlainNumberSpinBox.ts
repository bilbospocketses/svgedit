/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import PlainSpinBoxMixin from 'elix/src/plain/PlainSpinBoxMixin.js'
import NumberSpinBox from '../base/NumberSpinBox.js'

/**
 * @class PlainNumberSpinBox
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class PlainNumberSpinBox extends (PlainSpinBoxMixin(NumberSpinBox) as unknown as typeof HTMLElement) {}

export default PlainNumberSpinBox
