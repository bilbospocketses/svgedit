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

/** A bundle is a nested dictionary of string values. */
type Bundle = Record<string, unknown>

const bundles: Record<string, Bundle> = { translation: enStrings }

const lookup = (obj: Bundle | null | undefined, dotted: string): unknown => {
  if (obj == null) return undefined
  return dotted.split('.').reduce((acc: unknown, k: string) => {
    if (acc == null || typeof acc !== 'object') return acc
    return (acc as Record<string, unknown>)[k]
  }, obj as unknown)
}

const interpolate = (str: unknown, vars?: Record<string, unknown>): string => {
  if (typeof str !== 'string') return ''
  if (!vars) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => (key in vars ? String(vars[key]) : `{{${key}}}`))
}

/**
 * Translate a key. Supports `'key.path'` against the default bundle and
 * `'namespace:key.path'` against extension-registered bundles. Optional
 * `vars` object replaces `{{name}}` placeholders.
 *
 * @param key
 * @param [vars]
 */
export const t = (keyArg: string | string[], vars?: Record<string, unknown>): string => {
  const key: string = Array.isArray(keyArg) ? (keyArg[0] ?? '') : keyArg
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
 * Recursive deep-merge of plain-object trees. Arrays and primitives at
 * any depth replace the corresponding target value rather than concat/merging.
 * Used by `addResourceBundle` so extension-loaded translation bundles
 * augment the base bundle without clobbering sibling namespaces.
 */
const deepMerge = (target: Bundle, source: Bundle): Bundle => {
  if (target == null || typeof target !== 'object') return source
  if (source == null || typeof source !== 'object') return target
  const result: Bundle = { ...target }
  for (const [key, value] of Object.entries(source)) {
    const targetVal = result[key]
    const bothObjects = (
      value !== null && typeof value === 'object' && !Array.isArray(value) &&
      targetVal !== null && typeof targetVal === 'object' && !Array.isArray(targetVal)
    )
    result[key] = bothObjects ? deepMerge(targetVal as Bundle, value as Bundle) : value
  }
  return result
}

/**
 * Compatibility facade for code that still references `svgEditor.i18next`.
 * Implements only the surface used by the editor shell + extensions:
 * `.t()` for lookups and `.addResourceBundle()` for extension-locale
 * registration.
 *
 * `addResourceBundle` does a deep merge into the existing namespace bundle
 * rather than a flat overwrite, matching the semantics extensions expect
 * when they call `addResourceBundle(lang, ns, dict, deep=true, overwrite=true)`.
 * The pre-fix flat overwrite caused the FIRST extension to load its
 * translations to clobber the entire bundle for that namespace, leaving
 * other consumers (e.g., the storage prefs dialog) with raw key text.
 */
const i18nextFacade = {
  t,
  addResourceBundle (_lang: string, ns: string, dict: Bundle) {
    bundles[ns] = deepMerge(bundles[ns] ?? {}, dict)
  }
}

/**
 * No-op stand-in for the old i18next-based loader. Kept on the same
 * signature so `Editor.ts` and friends don't need to change.
 *
 */
export const putLocale = function (
  _lang?: unknown,
  _goodLangs?: unknown
): Promise<{ langParam: string; i18next: typeof i18nextFacade }> {
  return Promise.resolve({ langParam: 'en', i18next: i18nextFacade })
}
