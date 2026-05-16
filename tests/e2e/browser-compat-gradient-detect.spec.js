import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, setSvgSource } from './helpers.js'

test.describe('browser-compat: gradient querySelector detection (svg-exec.js:1269)', () => {
  // Verifies the `if (!elems.length && isWebkit()) { ... }` fallback in
  // svg-exec.js:1269. Original bug: "Bug in webkit prevents regular *Gradient
  // selector search". If standard querySelectorAll finds gradients on both
  // browsers, the WebKit fallback is obsolete.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('querySelectorAll detects linearGradient and radialGradient after SVG import', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="100" y2="0">
      <stop offset="0%" stop-color="red"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
    <radialGradient id="g2" cx="50" cy="50" r="50">
      <stop offset="0%" stop-color="green"/>
      <stop offset="100%" stop-color="yellow"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#g1)"/>
  <circle cx="150" cy="50" r="40" fill="url(#g2)"/>
</svg>`

    await setSvgSource(page, markup)

    // Verify the standard querySelectorAll finds both gradients post-import
    const detected = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const elems = svgContent.querySelectorAll('linearGradient, radialGradient')
      return {
        count: elems.length,
        ids: Array.from(elems).map(e => e.id)
      }
    })

    // Both gradients must be found via the standard selector -- without falling back to
    // the WebKit-specific element iteration in svg-exec.js:1269
    expect(detected.count).toBe(2)
    expect(detected.ids).toEqual(expect.arrayContaining(['g1', 'g2']))
  })

  test('querySelectorAll detects gradients inside symbol elements', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <symbol id="sym1">
      <linearGradient id="sg1"><stop offset="0%"/></linearGradient>
      <rect fill="url(#sg1)" width="50" height="50"/>
    </symbol>
  </defs>
  <use href="#sym1"/>
</svg>`

    await setSvgSource(page, markup)

    const detected = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const elems = svgContent.querySelectorAll('linearGradient, radialGradient')
      return { count: elems.length }
    })

    // Gradient inside symbol must also be found via standard selector
    expect(detected.count).toBe(1)
  })
})
