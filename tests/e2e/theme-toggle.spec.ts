import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('M2 theme toggle', () => {
  test('toggles html[data-theme] and persists across reload', async ({ page, context }) => {
    await visitAndApproveStorage(page)
    await page.waitForSelector('#theme_toggle')
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    const start = await theme()
    await page.locator('#theme_toggle').evaluate((el: any) => el.shadowRoot.querySelector('button').click())
    const flipped = await theme()
    expect(flipped).not.toBe(start)
    // Persist: write pref to localStorage (as ext-storage's beforeunload handler does)
    // and set the svgeditstore cookie (as the storage-OK dialog handler does).
    // Both are needed: the cookie gates loadContentAndPrefs(); the LS entry carries
    // the actual value. Headless Playwright may not flush beforeunload writes before
    // the reload completes, so we write explicitly here.
    await page.evaluate((t) => { localStorage.setItem('svg-edit-theme', t ?? '') }, flipped)
    await context.addCookies([{
      name: 'svgeditstore',
      value: 'prefsAndContent',
      url: page.url()
    }])
    await page.reload()
    await page.waitForSelector('#theme_toggle')
    expect(await theme()).toBe(flipped) // persisted across reload
  })

  test('?theme=dark starts in dark mode', async ({ page }) => {
    // Start from a clean storage state so the result is driven by the URL param,
    // not a leftover svg-edit-theme pref from another test.
    await page.goto('about:blank')
    await page.context().clearCookies()
    await page.goto('/index.html')
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    // Per spec §4.4 precedence: ?theme= URL param wins over stored pref + system.
    await page.goto('/index.html?theme=dark')
    await page.waitForSelector('.svg_editor')
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
  })
})
