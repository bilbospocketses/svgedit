import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, waitForExtensions } from './helpers.js'

/**
 * Regression guard for the two build-only bugs that killed ALL extensions in the
 * BUILT editor (npm run serve / the packaged app); neither reproduces in jsdom,
 * which runs a single shared module graph.
 *
 * 1. Split singleton: extensions are built as a separate bundle that gets its own
 *    copy of svgEditorInstance.js. As a module-scoped variable the extensions'
 *    copy was never set, so every init() threw "svgEditor not initialized". Fixed
 *    by storing the instance on globalThis (Symbol.for) so both copies share it.
 * 2. Locale build: each locale-loading extension did a variable dynamic
 *    import('./locale/<lang>.js') that the separate rollup extension build cannot
 *    resolve, so the import 404'd, init() threw, and the editor logged
 *    "Extension failed to load: <name>". Fixed by a static
 *    `import enLocale from './locale/en.js'`.
 *
 * The assertion catches BOTH: #canvasGrid proves ext-grid's init ran past its
 * locale call, and an empty "Extension failed to load" / "svgEditor not
 * initialized" error set proves every default extension initialized cleanly.
 */
test.describe('built-editor extensions initialize', () => {
  test('all default extensions initialize without error in the built editor', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', (e) => consoleErrors.push(e.message))

    await visitAndApproveStorage(page)
    // Times out if #canvasGrid never appears, i.e. ext-grid's init() failed.
    await waitForExtensions(page)

    // Any extension whose init() rejects logs "Extension failed to load: <name>"
    // (Editor.ts); the split-singleton failure logged "svgEditor not initialized".
    // A healthy built editor produces neither.
    const extensionErrors = consoleErrors.filter(
      (e) => e.includes('Extension failed to load') || e.includes('svgEditor not initialized')
    )
    expect(extensionErrors).toEqual([])
  })
})
