// tests/e2e/embed-theme.spec.js
import { expect, type Page, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: theme sync', () => {
  // M2: embed theming routes through M1's html[data-theme] token mechanism
  // (editor/styles/theme.ts), not the retired body.classList theme-* scheme.
  const frameTheme = (page: Page) =>
    page.frameLocator('#svge').locator(':root').evaluate((el: HTMLElement) => el.getAttribute('data-theme'))

  test('URL param ?theme=dark applies html[data-theme="dark"]', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&theme=dark' })
    expect(await frameTheme(page)).toBe('dark')
  })

  test('runtime setTheme("light") switches html[data-theme] to light', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&theme=dark' })
    // Await the postMessage round-trip: __setTheme resolves only after the
    // embed server has applied the theme inside the iframe.
    await page.evaluate(() => window.__svgeditEmbed.setTheme('light'))
    await expect.poll(() => frameTheme(page)).toBe('light')
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
