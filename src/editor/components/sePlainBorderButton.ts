import { template } from 'elix/src/base/internal.js'
import { fragmentFrom } from 'elix/src/core/htmlLiterals.js'
// @ts-expect-error: no declaration file for elix/src/plain/PlainButton.js
import PlainButton from 'elix/src/plain/PlainButton.js'

/**
 * @class SePlainBorderButton
 * Button with a border in the Plain reference design system
 *
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class SePlainBorderButton extends (PlainButton as unknown as typeof HTMLElement) {
  /**
    * @function get
    * @returns {PlainObject}
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get [template] (): any {
    // @ts-expect-error: elix computed property key not in HTMLElement type
    const result = super[template]
    result.content.append(
      fragmentFrom.html`
        <style>
          [part~="button"] {
            background: var(--main-bg-color);
            border: 1px solid #ccc;
          }
        </style>
      `
    )
    return result
  }
}

export default SePlainBorderButton
