import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, setSvgSource } from './helpers.js'

test.describe('browser-compat: import gradients NOT in defs (svg-exec.js:503-512, Firefox 353575)', () => {
  // Verifies the Firefox 353575 workaround in svg-exec.js:503-512 that
  // moves linearGradient/radialGradient/pattern elements into <defs> on import
  // in Gecko browsers. https://bugzilla.mozilla.org/show_bug.cgi?id=353575
  //
  // Original bug: Firefox didn't render gradients placed at SVG root level
  // (outside <defs>) when referenced by fill="url(#id)". The workaround
  // moves them into <defs> during import.
  //
  // If this test passes on Firefox without the workaround (i.e., gradients
  // at root level still render), the workaround can be dropped.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('linearGradient at root (not in defs) renders correctly when imported', async ({ page }) => {
    // Note the linearGradient is OUTSIDE the <defs> tag -- at SVG root level
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <linearGradient id="rootGrad" x1="0" y1="0" x2="100" y2="0">
    <stop offset="0%" stop-color="red"/>
    <stop offset="100%" stop-color="blue"/>
  </linearGradient>
  <rect id="testRect" width="100" height="50" fill="url(#rootGrad)"/>
</svg>`

    await setSvgSource(page, markup)

    // Verify the gradient is reachable post-import (workaround moves it into defs;
    // without workaround it stays at root -- either way the gradient should be findable
    // and the rect should reference it via fill)
    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const grad = svgContent.querySelector('#rootGrad')
      const rect = svgContent.querySelector('rect[fill*="rootGrad"]')
      return {
        gradientExists: Boolean(grad),
        gradientTagName: grad?.tagName,
        rectExists: Boolean(rect),
        rectFill: rect?.getAttribute('fill')
      }
    })

    expect(state.gradientExists).toBe(true)
    expect(state.gradientTagName).toBe('linearGradient')
    expect(state.rectExists).toBe(true)
    expect(state.rectFill).toBe('url(#rootGrad)')
  })

  test('radialGradient at root renders correctly when imported', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <radialGradient id="rootRGrad" cx="50" cy="50" r="50">
    <stop offset="0%" stop-color="green"/>
    <stop offset="100%" stop-color="yellow"/>
  </radialGradient>
  <circle cx="100" cy="100" r="50" fill="url(#rootRGrad)"/>
</svg>`

    await setSvgSource(page, markup)

    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const grad = svgContent.querySelector('#rootRGrad')
      const circle = svgContent.querySelector('circle')
      return {
        gradientExists: Boolean(grad),
        circleFill: circle?.getAttribute('fill')
      }
    })

    expect(state.gradientExists).toBe(true)
    expect(state.circleFill).toBe('url(#rootRGrad)')
  })

  test('pattern at root renders correctly when imported', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <pattern id="rootPat" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="5" height="10" fill="blue"/>
    <rect x="5" width="5" height="10" fill="red"/>
  </pattern>
  <rect width="100" height="100" fill="url(#rootPat)"/>
</svg>`

    await setSvgSource(page, markup)

    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const pat = svgContent.querySelector('#rootPat')
      return {
        patternExists: Boolean(pat),
        patternTagName: pat?.tagName
      }
    })

    expect(state.patternExists).toBe(true)
    expect(state.patternTagName).toBe('pattern')
  })
})
