/**
 * Shared utilities for the `se-*` Lit components.
 *
 * Extracted in the components audit wave (C1) to remove duplication and to make
 * the icon mask-image inline style a single, safe sink:
 *  - `boolAttr` — the reflecting Boolean attribute converter the button family
 *    duplicated (#113).
 *  - `maskImageStyle` — builds the dual-prefixed `mask-image` declarations with
 *    the URL escaped for a CSS `url("...")` context, closing the CSS-injection
 *    sink where a crafted `src` could break out and inject extra declarations
 *    (#115 / #118).
 * @license MIT
 */

import { css } from 'lit'

/**
 * Reflecting Boolean attribute converter: reflect as the string `'true'` (not
 * Lit's default empty string) so DOM queries like `#tools_left *[pressed]` —
 * used by LeftPanel to clear the previously-active tool's highlight — and
 * single-character matchers like `toHaveAttribute('pressed', /./)` actually
 * match. Without reflection a property-set `pressed` never grows the attribute,
 * so the clear-loop matches nothing and tool highlights accumulate.
 */
export const boolAttr = {
  reflect: true,
  converter: {
    fromAttribute: (v: string | null) => v !== null,
    toAttribute: (v: boolean) => (v ? 'true' : null)
  }
} as const

/**
 * Escape a value for safe interpolation inside a CSS `url("...")`
 * double-quoted string: backslash-escape `\` and `"`, and hex-escape the
 * newline/CR/FF chars that cannot appear literally in a CSS string. This keeps
 * any attacker-controlled `src` confined to the URL token so it cannot inject a
 * second CSS declaration.
 */
const escapeCssUrl = (value: string): string =>
  value
    .replace(/["\\]/g, '\\$&')
    .replace(/[\n\r\f]/g, (c) => '\\' + c.charCodeAt(0).toString(16) + ' ')

/**
 * Build the `-webkit-mask-image` + `mask-image` declaration pair for an icon
 * URL, escaping the URL so it cannot break out of `url("...")` (#115 / #118).
 */
export const maskImageStyle = (url: string): string => {
  const u = escapeCssUrl(url)
  return `-webkit-mask-image:url("${u}");mask-image:url("${u}")`
}

/**
 * The shared `.se-icon` mask declarations (icon tint + center/contain/no-repeat)
 * duplicated verbatim across the se-* icon components (#114). Interpolate into a
 * component's own `.se-icon` rule, which keeps its component-specific size.
 */
export const seIconMask = css`
  background-color: var(--se-icon);
  -webkit-mask-position: center; mask-position: center;
  -webkit-mask-size: contain; mask-size: contain;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
`
