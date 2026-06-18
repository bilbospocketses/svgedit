import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('Zoom tool', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('setZoom changes the canvas zoom level', async ({ page }) => {
    const { before, after } = await page.evaluate(() => {
      const c = window.svgEditor.svgCanvas
      const before = c.getZoom()
      c.setZoom(before * 2)
      return { before, after: c.getZoom() }
    })
    expect(after).toBe(before * 2)
    expect(after).not.toBe(before)
  })
})
