import { getSvgEditor } from '../svgEditorInstance.js'

/**
 * Load an extension's i18n bundle for the current language, falling back to
 * English when the language file is missing. Extracted from the per-extension
 * copies that were byte-identical apart from the extension name (#111).
 *
 * The dynamic `import()` stays in the caller (`importLocale`) so vite's
 * dynamic-import-vars plugin resolves each extension's own `./locale/` glob; the
 * helper just owns the try/fallback + addResourceBundle logic.
 *
 * @param name - Extension name (used in the warning + as the default namespace).
 * @param importLocale - Imports `./locale/<lang>.js` relative to the extension.
 * @param namespace - i18next namespace to register under; defaults to `name`.
 *   (ext-opensave registers under `'translation'`, so it passes that explicitly.)
 * @license MIT
 */
export const loadExtensionTranslation = async (
  name: string,
  importLocale: (lang: string) => Promise<{ default: Record<string, unknown> }>,
  namespace: string = name
): Promise<void> => {
  const svgEditor = getSvgEditor()
  const lang = String(svgEditor.configObj.pref('lang'))
  let translationModule: { default: Record<string, unknown> }
  try {
    translationModule = await importLocale(lang)
  } catch (_error) {
    console.warn(`Missing translation (${lang}) for ${name} - using 'en'`)
    translationModule = await importLocale('en')
  }
  svgEditor.i18next.addResourceBundle(lang, namespace, translationModule.default)
}
