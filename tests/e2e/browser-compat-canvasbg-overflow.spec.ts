import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('browser-compat: canvasBackground overflow on zoom-out (select.js:423)', () => {
  // Verifies the `isWebkit() ? 'none' : 'visible'` workaround in select.js:423.
  // Original bug: "Chrome 7 has a problem with this when zooming out".
  // If this test passes on both Chromium AND Firefox, the workaround can be
  // dropped (C4) -- the modern WebKit/Chromium engine no longer needs the
  // overflow override.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('canvas background does not overflow svgroot viewport when zoomed out to 0.25', async ({ page }) => {
    // Set zoom to 0.25 (4x zoom out) -- triggers the original Chrome 7 bug scenario
    await page.evaluate(() => {
      window.svgEditor.svgCanvas.setZoom(0.25)
    })
    await page.waitForTimeout(100) // let rendering settle

    // Capture observable canvas state
    const state = await page.evaluate(() => {
      const bg = document.getElementById('canvasBackground')!
      const svgRoot = document.getElementById('svgroot')!
      const bgBox = bg.getBoundingClientRect()
      const rootBox = svgRoot.getBoundingClientRect()
      return {
        bgWidth: bgBox.width,
        bgHeight: bgBox.height,
        rootWidth: rootBox.width,
        rootHeight: rootBox.height
      }
    })

    // Assertions: canvas background must have positive geometry and be smaller-than-or-equal
    // to the svgroot viewport (no overflow into the page). Both browsers should match.
    expect(state.bgWidth).toBeGreaterThan(0)
    expect(state.bgHeight).toBeGreaterThan(0)
    expect(state.rootWidth).toBeGreaterThan(0)
    expect(state.rootHeight).toBeGreaterThan(0)
    // Background should not visually extend beyond the SVG root viewport -- this is the
    // user-visible symptom the original Chrome 7 bug created
    expect(state.bgWidth).toBeLessThanOrEqual(state.rootWidth + 1) // +1px rounding tolerance
    expect(state.bgHeight).toBeLessThanOrEqual(state.rootHeight + 1)
  })

  test('canvasBackground overflow attribute is set by workaround and element has correct geometry', async ({ page }) => {
    // The workaround (select.js:423) sets overflow='none' on WebKit and overflow='visible'
    // on Gecko during canvas initialization. This test verifies the attribute is set
    // (workaround ran) and that the element's declared width/height match the document
    // dimensions -- if they differ, the Chrome 7 bug caused a mismatch.
    const state = await page.evaluate(() => {
      const bg = document.getElementById('canvasBackground')!
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      return {
        // The overflow attribute must be present (workaround set it)
        overflowAttr: bg.getAttribute('overflow'),
        // canvasBackground width/height must match the document canvas dimensions
        bgWidthAttr: Number(bg.getAttribute('width')),
        bgHeightAttr: Number(bg.getAttribute('height')),
        docWidth: Number(svgContent.getAttribute('width')),
        docHeight: Number(svgContent.getAttribute('height'))
      }
    })

    // overflow attribute must be explicitly set (either 'none' or 'visible') --
    // the workaround always sets one of these values during initialization
    expect(['none', 'visible']).toContain(state.overflowAttr)

    // canvasBackground dimensions must be positive and match document canvas dimensions
    expect(state.bgWidthAttr).toBeGreaterThan(0)
    expect(state.bgHeightAttr).toBeGreaterThan(0)
    expect(state.bgWidthAttr).toBe(state.docWidth)
    expect(state.bgHeightAttr).toBe(state.docHeight)
  })
})
