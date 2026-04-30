/**
 * Localizing shim for SVG-edit UI — English-only.
 * @module locale
 * @license MIT
 *
 * Replaces the former i18next-based runtime. Keeps the existing
 * `t('foo.bar')`, `t('ns:foo.bar')`, and `t('key', { var })` callsite
 * shapes working without modification. Multi-language support was
 * intentionally dropped per the project scope directive — this fork is
 * English-only.
 */

import enStrings from './locale/lang.en.js'

const bundles = { translation: enStrings }

const lookup = (obj, dotted) => {
  if (obj == null) return undefined
  return dotted.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

const interpolate = (str, vars) => {
  if (typeof str !== 'string' || !vars) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_match, key) => (key in vars ? String(vars[key]) : `{{${key}}}`))
}

/**
 * Translate a key. Supports `'key.path'` against the default bundle and
 * `'namespace:key.path'` against extension-registered bundles. Optional
 * `vars` object replaces `{{name}}` placeholders.
 *
 * @param {string|string[]} key
 * @param {object} [vars]
 * @returns {string}
 */
export const t = (key, vars) => {
  if (Array.isArray(key)) key = key[0]
  if (typeof key !== 'string') return key

  let ns = 'translation'
  let path = key
  const colon = key.indexOf(':')
  if (colon >= 0) {
    ns = key.slice(0, colon)
    path = key.slice(colon + 1)
  }

  const bundle = bundles[ns]
  const value = lookup(bundle, path)
  if (value == null) return key
  return interpolate(value, vars)
}

/**
 * Compatibility facade for code that still references `svgEditor.i18next`.
 * Implements only the surface used by the editor shell + extensions:
 * `.t()` for lookups and `.addResourceBundle()` for extension-locale
 * registration.
 */
const i18nextFacade = {
  t,
  addResourceBundle (_lang, ns, dict) {
    bundles[ns] = dict
  }
}

/**
 * No-op stand-in for the old i18next-based loader. Kept on the same
 * signature so `EditorStartup.js` and friends don't need to change.
 *
 * @returns {Promise<{langParam: string, i18next: object}>}
 */
export const putLocale = async function () {
  return { langParam: 'en', i18next: i18nextFacade }
}
