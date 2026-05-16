import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('Firefox dirty-state on save: markSaved() clears showSaveWarning', () => {
  // Regression for todo #10: after a successful save, the "unsaved changes"
  // beforeunload warning should NOT appear because the showSaveWarning dirty
  // flag is cleared by Editor.markSaved(), invoked from ext-opensave after
  // fileSave resolves. Pre-fix, the flag was never reset and Firefox (which
  // honors beforeunload returnValue strictly, unlike modern Chromium which
  // suppresses the prompt aggressively) showed the warning even after save.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('markSaved() clears the dirty flag; subsequent edits re-arm it', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Initial state: editor just loaded, nothing edited yet
      const initial = window.svgEditor.showSaveWarning

      // Simulate the dirty state (any element change normally sets this via
      // the elementChanged handler at Editor.js:715)
      window.svgEditor.showSaveWarning = true
      const dirty = window.svgEditor.showSaveWarning

      // Call the new accessor: this is what ext-opensave invokes on successful save
      window.svgEditor.markSaved()
      const clean = window.svgEditor.showSaveWarning

      // Simulate a subsequent edit re-dirtying the document
      window.svgEditor.showSaveWarning = true
      const dirtyAgain = window.svgEditor.showSaveWarning

      return { initial, dirty, clean, dirtyAgain }
    })

    expect(result.initial).toBe(false)
    expect(result.dirty).toBe(true)
    expect(result.clean).toBe(false)
    expect(result.dirtyAgain).toBe(true)
  })

  test('markSaved() is idempotent and safe to call on an already-clean state', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.svgEditor.markSaved()
      const first = window.svgEditor.showSaveWarning
      window.svgEditor.markSaved()
      const second = window.svgEditor.showSaveWarning
      return { first, second }
    })

    expect(result.first).toBe(false)
    expect(result.second).toBe(false)
  })
})
