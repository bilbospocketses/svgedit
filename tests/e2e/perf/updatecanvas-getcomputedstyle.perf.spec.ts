import { test, expect } from '../fixtures.js'
import { visitAndApproveStorage } from '../helpers.js'
import { installPerfCounters, measure } from './perf-instrument.js'

/**
 * Audit #29 #90 — `updateCanvas` (UICoordinator) read `getComputedStyle` twice per
 * element (width + height) for both `#workarea` and `#svgcanvas`. The values are
 * stable within the call, so one `CSSStyleDeclaration` per element suffices. This
 * is browser-only: jsdom's `getComputedStyle` returns empty, so the redundant read
 * never materialises there.
 */
test.describe('perf #90: updateCanvas dedupes getComputedStyle reads', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'deterministic call counts; chromium only')

  test.beforeEach(async ({ page }) => {
    await installPerfCounters(page)
    await visitAndApproveStorage(page)
    // Isolate updateCanvas's own reads from the rulers overlay, which also reads
    // getComputedStyle(#svgcanvas) when shown.
    await page.evaluate(() => window.svgEditor.setConfig({ showRulers: false }))
  })

  test('reads #workarea and #svgcanvas computed style at most once each', async ({ page }) => {
    const counts = await measure(page, async () => {
      await page.evaluate(() => window.svgEditor.updateCanvas())
    })
    // Pre-fix: 2 reads per element (width + height). Post-fix: 1 each.
    expect(counts['getComputedStyle:workarea'] ?? 0).toBeLessThanOrEqual(1)
    expect(counts['getComputedStyle:svgcanvas'] ?? 0).toBeLessThanOrEqual(1)
  })
})
