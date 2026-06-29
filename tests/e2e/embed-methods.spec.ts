// tests/e2e/embed-methods.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: methods round-trip', () => {
  test('getZoom returns a number', async ({ page }) => {
    await openEmbedHost(page)
    const zoom = await page.evaluate(() => window.__svgeditEmbed.editor.getZoom())
    expect(typeof zoom).toBe('number')
  })

  test('loadFromString + getSvgString round-trip', async ({ page }) => {
    await openEmbedHost(page)
    const svgIn = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="red"/></svg>'
    await page.evaluate((s) => window.__svgeditEmbed.editor.loadFromString(s), svgIn)
    const svgOut = await page.evaluate(() => window.__svgeditEmbed.editor.getSvgString())
    expect(svgOut).toContain('<rect')
    expect(svgOut).toContain('fill="red"')
  })

  test('clearSelection executes without throwing', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.editor.clearSelection())
  })

  test('METHOD_NOT_FOUND error code on unknown method', async ({ page }) => {
    await openEmbedHost(page)
    const err = await page.evaluate(() =>
      window.__svgeditEmbed.editor.thisIsNotAMethod().then(() => null, (e: Error & { code?: string }) => ({ message: e.message, code: e.code }))
    )
    expect(err).not.toBeNull()
    expect(err.code).toBe('METHOD_NOT_FOUND')
  })
})
