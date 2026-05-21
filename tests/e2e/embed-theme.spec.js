// tests/e2e/embed-theme.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: theme sync', () => {
  test('URL param ?theme=dark applies theme-dark class', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&theme=dark' })
    const cls = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList).find(c => c.startsWith('theme-')))
    expect(cls).toBe('theme-dark')
  })

  test('runtime setTheme("light") replaces theme-dark with theme-light', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&theme=dark' })
    await page.evaluate(() => window.__svgeditEmbed.setTheme('light'))
    const cls = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList).find(c => c.startsWith('theme-')))
    expect(cls).toBe('theme-light')
  })

  test('host-call setTheme does NOT emit theme-changed (echo-loop prevention)', async ({ page }) => {
    await openEmbedHost(page)
    const before = await page.evaluate(() => (window.__getLog().match(/THEME /g) ?? []).length)
    await page.evaluate(() => window.__svgeditEmbed.setTheme('dark'))
    await new Promise(r => setTimeout(r, 200))
    const after = await page.evaluate(() => (window.__getLog().match(/THEME /g) ?? []).length)
    expect(after).toBe(before)
  })
})
