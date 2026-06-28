import { test, expect } from '../fixtures.js'
import { visitAndApproveStorage } from '../helpers.js'
import { installPerfCounters, measure } from './perf-instrument.js'

/**
 * Audit #29 #81 — ext-grid's `updateGrid()` redraws the grid canvas (getContext +
 * draw + `toDataURL` PNG encode) on every `zoomChanged` extension event. One user
 * zoom fires `zoomChanged` through more than one path (`svgCanvas.setZoom`'s
 * `runExtensions` at elem-get-set.ts:377 + the `zoomed` event ->
 * `UICoordinator.zoomChanged` -> `runExtensions` at UICoordinator.ts:244), so the
 * IDENTICAL grid (same `bigInt`) was re-encoded each time. `updateGrid` now memoizes
 * by `(bigInt, gridColor)` and early-returns when unchanged. Browser-only: jsdom has
 * no canvas `getContext`/`toDataURL`, so the encode never runs there.
 */
test.describe('perf #81: grid memoizes the canvas redraw for an unchanged zoom', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'deterministic call counts; chromium only')

  test.beforeEach(async ({ page }) => {
    await installPerfCounters(page)
    await visitAndApproveStorage(page)
    // The grid is off by default; turn it on so `updateGrid` runs on zoomChanged.
    await page.locator('#view_grid').click()
  })

  test('repeated zoomChanged at the same zoom re-encodes the grid PNG once', async ({ page }) => {
    const counts = await measure(page, async () => {
      // Two zoomChanged events at the SAME zoom, mirroring the multi-path fan-out one
      // real zoom triggers. The grid is identical (same bigInt) -> the memo encodes
      // it once (pre-fix: twice).
      await page.evaluate(() => {
        const c = window.svgEditor.svgCanvas
        c.runExtensions({ action: 'zoomChanged', vars: 2 })
        c.runExtensions({ action: 'zoomChanged', vars: 2 })
      })
    })
    expect(counts['toDataURL'] ?? 0).toBe(1)
  })
})
