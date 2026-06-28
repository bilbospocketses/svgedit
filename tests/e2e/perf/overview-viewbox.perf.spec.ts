import { test, expect } from '../fixtures.js'
import { visitAndApproveStorage } from '../helpers.js'
import { installPerfCounters, measure } from './perf-instrument.js'

/**
 * Audit #29 #79 — ext-overview_window's `updateViewBox()` read `getComputedStyle`
 * twice per element (width + height) for #workarea, #svgcanvas, #overviewMiniView on
 * every workarea scroll = 6 reads/scroll. It now reads each element's computed style
 * once (3/scroll). The overview window is disabled by default (ConfigObj.ts:262,
 * "disabled until we fix performance issue"), so the spec loads it explicitly.
 * Browser-only: jsdom's `getComputedStyle` returns empty.
 */
test.describe('perf #79: overview window dedupes per-scroll getComputedStyle reads', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'deterministic call counts; chromium only')

  test.beforeEach(async ({ page }) => {
    await installPerfCounters(page)
    await visitAndApproveStorage(page)
    // Overview is disabled by default; load it explicitly (mirrors Editor's loader).
    await page.evaluate(async () => {
      const path = '/extensions/ext-overview_window/ext-overview_window.js'
      const mod = await import(/* @vite-ignore */ path)
      await window.svgEditor.svgCanvas.addExtension(mod.default.name, mod.default.init.bind(window.svgEditor), { langParam: 'en' })
    })
    await page.waitForSelector('#overviewMiniView', { state: 'attached' })
  })

  test('a scroll reads each element computed style once', async ({ page }) => {
    const counts = await measure(page, async () => {
      await page.evaluate(() => document.getElementById('workarea')!.dispatchEvent(new Event('scroll')))
    })
    // Pre-fix: 2 reads per element (width + height). Post-fix: 1 each.
    expect(counts['getComputedStyle:workarea'] ?? 0).toBe(1)
    expect(counts['getComputedStyle:svgcanvas'] ?? 0).toBe(1)
    expect(counts['getComputedStyle:overviewMiniView'] ?? 0).toBe(1)
  })
})
