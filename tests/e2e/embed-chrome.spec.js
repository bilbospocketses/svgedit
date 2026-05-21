// tests/e2e/embed-chrome.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: chrome control', () => {
  test('chrome=full URL param shows all chrome', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&chrome=full' })
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).toContain('embed')
    expect(classes).not.toContain('no-toolbox')
    expect(classes).not.toContain('no-menu')
    expect(classes).not.toContain('no-layers')
  })

  test('chrome=none URL param hides everything', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&chrome=none' })
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).toContain('no-toolbox')
    expect(classes).toContain('no-menu')
    expect(classes).toContain('no-layers')
  })

  test('runtime setChrome("minimal") toggles classes', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&chrome=full' })
    await page.evaluate(() => window.__svgeditEmbed.setChrome('minimal'))
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).toContain('no-menu')
    expect(classes).toContain('no-layers')
    expect(classes).not.toContain('no-toolbox')
  })

  test('runtime setChrome({menu: true}) re-enables menu', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&chrome=minimal' })
    await page.evaluate(() => window.__svgeditEmbed.setChrome({ menu: true }))
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).not.toContain('no-menu')
  })
})
