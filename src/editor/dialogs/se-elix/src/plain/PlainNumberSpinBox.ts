// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import PlainSpinBoxMixin from 'elix/src/plain/PlainSpinBoxMixin.js'
import NumberSpinBox from '../base/NumberSpinBox.js'

/**
 * @class PlainNumberSpinBox
 */
class PlainNumberSpinBox extends (PlainSpinBoxMixin(NumberSpinBox) as unknown as typeof HTMLElement) {}

export default PlainNumberSpinBox
