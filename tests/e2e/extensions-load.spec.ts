import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, waitForExtensions } from './helpers.js'

/**
 * Regression guard for the split-singleton bug: the extensions are built as a
 * separate bundle that gets its own copy of svgEditorInstance.js. When that
 * singleton was a module-scoped variable, the extensions' copy was never set, so
 * every extension's init() threw "svgEditor not initialized" and NO extension
 * loaded in the built editor (npm run serve / the packaged app). The fix stores
 * the instance on globalThis so both bundle copies share it.
 *
 * This only reproduces against the BUILT editor (the e2e preview), not jsdom —
 * jsdom runs a single module graph and never splits the singleton.
 */
test.describe('built-editor extensions initialize', () => {
  test('the grid extension init runs and the shared singleton resolves', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', (e) => consoleErrors.push(e.message))

    await visitAndApproveStorage(page)
    // Throws if #canvasGrid never appears, i.e. ext-grid's init() failed.
    await waitForExtensions(page)

    expect(consoleErrors.filter((e) => e.includes('svgEditor not initialized'))).toEqual([])
  })
})
