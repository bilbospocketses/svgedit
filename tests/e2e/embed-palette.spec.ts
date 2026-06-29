import { expect, test, type Page } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

// Read the rendered swatch strip's data-rgb list from inside se-palette's shadow root.
const stripColors = (page: Page) =>
  page.frameLocator('#svge').locator('se-palette').first().evaluate(
    el => Array.from(el.shadowRoot!.querySelectorAll('#js-se-palette .square'))
      .map(s => s.getAttribute('data-rgb'))
  )

test.describe('embed: palette injection', () => {
  test('URL param ?palette= renders the host palette (none prepended)', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23ff0000,%2300ff00' })
    expect(await stripColors(page)).toEqual(['none', '#ff0000', '#00ff00'])
  })

  test('runtime setPalette replaces the strip', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.setPalette(['#112233', '#445566']))
    await expect.poll(() => stripColors(page)).toEqual(['none', '#112233', '#445566'])
  })

  test('replace semantics — built-in colors are gone', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23abcdef' })
    const colors = await stripColors(page)
    expect(colors).toEqual(['none', '#abcdef'])
    expect(colors).not.toContain('#000000')
  })

  test('invalid color is dropped and emits an error event', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.setPalette(['#00ff00', 'notacolor']))
    await expect.poll(() => page.evaluate(() => window.__getLog())).toContain('ERR invalid-palette-color')
    expect(await stripColors(page)).toEqual(['none', '#00ff00'])
  })

  test('none is preserved even when the host omits it', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23123456' })
    const colors = await stripColors(page)
    expect(colors[0]).toBe('none')
  })

  test('an injected swatch is clickable without error', async ({ page, baseURL }) => {
    // Pre-approve storage so ext-storage's first-run consent modal never opens. Now
    // that extensions load in the built editor, that modal is appended + opened
    // asynchronously AFTER the embed 'ready' event, so dismissing it post-load is
    // racy; seeding the svgeditstore cookie suppresses it at the source (ext-storage
    // only prompts when the cookie is absent). Otherwise it intercepts the click.
    await page.context().addCookies([{ name: 'svgeditstore', value: 'prefsAndContent', url: baseURL }])
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23ff0000' })
    await page.frameLocator('#svge').locator('se-palette').first()
      .locator('#js-se-palette .square[data-rgb="#ff0000"]').click()
    expect(await page.evaluate(() => window.__getLog())).not.toContain('ERR')
  })
})
