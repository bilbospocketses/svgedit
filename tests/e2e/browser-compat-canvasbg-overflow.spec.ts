import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('browser-compat: canvasBackground overflow on zoom-out (select.ts)', () => {
  // Guards #canvasBackground, the white page behind the drawing, through a zoom-out.
  // History: select.js once set its overflow with `isWebkit() ? 'none' : 'visible'`
  // ("Chrome 7 has a problem with this when zooming out"). 0d255431 dropped that branch
  // on the strength of these tests, which then never zoomed (setZoom only stores the
  // number), so core/select.ts now sets overflow 'visible' on every engine. These tests
  // zoom the way the zoom control does and check the background after the redraw.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('canvas background does not overflow svgroot viewport when zoomed out to 0.25', async ({ page }) => {
    const before = await page.evaluate(() => {
      const c = window.svgEditor.svgCanvas
      return { zoom: c.getZoom(), contentW: c.contentW, contentH: c.contentH }
    })
    expect(before.zoom).not.toBe(0.25)

    // Zoom out the way a user does: open the zoom control's presets and pick 25%. The
    // control's change event runs BottomPanel.changeZoom -> zoomChanged -> updateCanvas,
    // which resizes and repositions #canvasBackground.
    await page.locator('#zoom').locator('#down').click()
    await page.locator('#zoom se-text[value="25"]').click()

    const bg = page.locator('#canvasBackground')
    const zoomedW = String(before.contentW * 0.25)
    const zoomedH = String(before.contentH * 0.25)
    // The redraw is done once the background has the zoomed-out size.
    await expect(bg).toHaveAttribute('width', zoomedW)
    await expect(bg).toHaveAttribute('height', zoomedH)

    // One synchronous read of the redrawn canvas.
    const state = await page.evaluate(() => {
      const c = window.svgEditor.svgCanvas
      const bgEl = document.getElementById('canvasBackground')!
      const content = c.getSvgContent()
      const svgRoot = document.getElementById('svgroot')!
      // The white page itself: the rect the background draws. (The nested svg's own
      // client rect differs by engine: Firefox stretches it back to the svgroot origin.)
      const bgBox = bgEl.querySelector('rect')!.getBoundingClientRect()
      const rootBox = svgRoot.getBoundingClientRect()
      return {
        zoom: c.getZoom(),
        overflow: getComputedStyle(bgEl).overflow,
        bg: {
          width: bgEl.getAttribute('width'),
          height: bgEl.getAttribute('height'),
          x: bgEl.getAttribute('x'),
          y: bgEl.getAttribute('y')
        },
        content: {
          width: content.getAttribute('width'),
          height: content.getAttribute('height'),
          x: content.getAttribute('x'),
          y: content.getAttribute('y')
        },
        bgBox: { left: bgBox.left, top: bgBox.top, right: bgBox.right, bottom: bgBox.bottom, width: bgBox.width, height: bgBox.height },
        rootBox: { left: rootBox.left, top: rootBox.top, right: rootBox.right, bottom: rootBox.bottom }
      }
    })
    const report = JSON.stringify(state)

    expect(state.zoom, report).toBe(0.25)
    // The background tracks the zoomed drawing exactly: same size, same place.
    expect(state.bg, report).toEqual(state.content)
    // Within 1px: Firefox's client rect includes the rect's 1px border stroke.
    expect(Math.abs(state.bgBox.width - before.contentW * 0.25), report).toBeLessThanOrEqual(1)
    expect(Math.abs(state.bgBox.height - before.contentH * 0.25), report).toBeLessThanOrEqual(1)
    // On screen it is drawn where the redraw placed it, inside svgroot.
    expect(Math.abs(state.bgBox.left - state.rootBox.left - Number(state.content.x)), report).toBeLessThanOrEqual(1)
    expect(Math.abs(state.bgBox.top - state.rootBox.top - Number(state.content.y)), report).toBeLessThanOrEqual(1)
    // Its overflow after the redraw is the one select.ts sets: visible, on every engine.
    expect(state.overflow, report).toBe('visible')
    // And it stays inside the svgroot viewport: the user-visible symptom the original
    // Chrome 7 bug created was a background spilling past it on zoom-out.
    expect(state.bgBox.left, report).toBeGreaterThanOrEqual(state.rootBox.left - 1) // +1px rounding tolerance
    expect(state.bgBox.top, report).toBeGreaterThanOrEqual(state.rootBox.top - 1)
    expect(state.bgBox.right, report).toBeLessThanOrEqual(state.rootBox.right + 1)
    expect(state.bgBox.bottom, report).toBeLessThanOrEqual(state.rootBox.bottom + 1)
  })

  test('canvasBackground overflow attribute is set and element has correct geometry', async ({ page }) => {
    // select.ts sets overflow='visible' on #canvasBackground when the canvas is created,
    // on every engine (the WebKit 'none' branch was dropped in 0d255431), and sizes it
    // to the document.
    const state = await page.evaluate(() => {
      const bg = document.getElementById('canvasBackground')!
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      return {
        overflowAttr: bg.getAttribute('overflow'),
        // canvasBackground width/height must match the document canvas dimensions
        bgWidthAttr: Number(bg.getAttribute('width')),
        bgHeightAttr: Number(bg.getAttribute('height')),
        docWidth: Number(svgContent.getAttribute('width')),
        docHeight: Number(svgContent.getAttribute('height'))
      }
    })

    expect(state.overflowAttr).toBe('visible')

    // canvasBackground dimensions must be positive and match document canvas dimensions
    expect(state.bgWidthAttr).toBeGreaterThan(0)
    expect(state.bgHeightAttr).toBeGreaterThan(0)
    expect(state.bgWidthAttr).toBe(state.docWidth)
    expect(state.bgHeightAttr).toBe(state.docHeight)
  })
})
