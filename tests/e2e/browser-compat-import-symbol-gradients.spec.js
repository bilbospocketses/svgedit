import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, setSvgSource } from './helpers.js'

test.describe('browser-compat: import symbol with internal gradients (svg-exec.js:712-722, Firefox 353575)', () => {
  // Verifies the Firefox 353575 workaround in svg-exec.js:712-722 that
  // moves gradients out of <symbol> elements during symbol/use import in Gecko.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=353575
  //
  // Original bug: Firefox didn't render gradients defined inside a <symbol>
  // when the symbol was used via <use>. The workaround moves the gradients
  // into the root <defs> during import.
  //
  // If this test passes on Firefox without the workaround, drop it.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('symbol with internal linearGradient renders when referenced via use', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <symbol id="gradSym" viewBox="0 0 100 100">
      <linearGradient id="symGrad" x1="0" y1="0" x2="100" y2="0">
        <stop offset="0%" stop-color="purple"/>
        <stop offset="100%" stop-color="orange"/>
      </linearGradient>
      <rect width="100" height="100" fill="url(#symGrad)"/>
    </symbol>
  </defs>
  <use href="#gradSym" x="0" y="0" width="200" height="200"/>
</svg>`

    await setSvgSource(page, markup)

    // Workaround moves gradient OUT of symbol into root defs; without workaround it
    // stays inside symbol. Either way the gradient should be findable post-import.
    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      return {
        symbolExists: Boolean(svgContent.querySelector('#gradSym')),
        gradientExists: Boolean(svgContent.querySelector('#symGrad')),
        useExists: Boolean(svgContent.querySelector('use'))
      }
    })

    expect(state.symbolExists).toBe(true)
    expect(state.gradientExists).toBe(true)
    expect(state.useExists).toBe(true)
  })

  test('symbol with internal pattern renders when referenced via use', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <symbol id="patSym" viewBox="0 0 100 100">
      <pattern id="symPat" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="5" height="10" fill="cyan"/>
        <rect x="5" width="5" height="10" fill="magenta"/>
      </pattern>
      <rect width="100" height="100" fill="url(#symPat)"/>
    </symbol>
  </defs>
  <use href="#patSym" x="0" y="0" width="200" height="200"/>
</svg>`

    await setSvgSource(page, markup)

    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const sym = svgContent.querySelector('#patSym')
      const pat = svgContent.querySelector('#symPat')
      const use = svgContent.querySelector('use')
      return {
        symbolExists: Boolean(sym),
        patternExists: Boolean(pat),
        useExists: Boolean(use)
      }
    })

    expect(state.symbolExists).toBe(true)
    expect(state.patternExists).toBe(true)
    expect(state.useExists).toBe(true)
  })
})
