import { getSvgEditor } from '../svgEditorInstance.js'

/**
 * Register an extension's English i18n bundle. The fork is English-only, so each
 * extension statically imports its locale object and passes it directly:
 *
 *   import enLocale from './locale/en.js'
 *   await loadExtensionTranslation(name, enLocale)
 *
 * The STATIC import is required — NOT a variable dynamic import. Extensions are
 * built as a separate rollup bundle (scripts/build-extensions.ts, preserveModules)
 * in which `@rollup/plugin-dynamic-import-vars` cannot resolve
 * `import('./locale/<lang>.js')` against the `.ts` sources: the locale module is
 * never emitted and 404s at runtime, throwing out of init() and killing the
 * extension in the BUILT editor (the dev server hides this — #35). A static
 * import makes rollup emit `locale/en.js` as a sibling module that resolves.
 *
 * Registration goes through the English-only i18next facade (locale.ts), which
 * ignores the language argument and deep-merges by namespace — so ext-opensave's
 * `'translation'` namespace merges into the core bundle. Kept `async` so the
 * existing `await` call sites (and their require-await lint) stay valid.
 *
 * @param name - Extension name; the default i18next namespace.
 * @param locale - The extension's locale object (default export of ./locale/en.js).
 * @param namespace - Namespace to register under; defaults to `name`. ext-opensave
 *   passes `'translation'` to merge into the core bundle.
 * @license MIT
 */
// eslint-disable-next-line @typescript-eslint/require-await
export const loadExtensionTranslation = async (name: string, locale: Record<string, unknown>, namespace: string = name): Promise<void> => {
  getSvgEditor().i18next.addResourceBundle('en', namespace, locale)
}
