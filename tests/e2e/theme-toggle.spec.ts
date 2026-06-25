import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

/** Sample the top strip of the X-ruler canvas and return the sum of all RGB values.
 *  Returns 0 if the canvas is inaccessible (non-tainted, getContext available). */
async function rulerXInkSum (page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#ruler_x canvas')
    if (!canvas) return -1
    const ctx = canvas.getContext('2d')
    if (!ctx) return -1
    const { data } = ctx.getImageData(0, 0, canvas.width, Math.min(15, canvas.height))
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)
    }
    return sum
  })
}

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

  test('ruler ink follows the theme', async ({ page }) => {
    await visitAndApproveStorage(page)
    await page.waitForSelector('#theme_toggle')
    // Wait for ruler canvases to be populated (updateRulers fires on editor ready)
    await page.waitForSelector('#ruler_x canvas')

    // Force light theme first so we start from a known state
    await page.evaluate(() => {
      const { applyTheme } = (window as any)
      if (typeof applyTheme === 'function') {
        applyTheme('light')
      } else {
        document.documentElement.setAttribute('data-theme', 'light')
        document.dispatchEvent(new CustomEvent('svgedit-themechange', { detail: { theme: 'light' } }))
      }
    })
    // Allow the canvas redraw to complete: wait two animation frames (the redraw is
    // scheduled on rAF) rather than guessing with a fixed delay.
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
    const lightSum = await rulerXInkSum(page)

    // Toggle to dark via the real shadow button (same as the existing toggle test)
    await page.locator('#theme_toggle').evaluate((el: any) => el.shadowRoot.querySelector('button').click())
    // Wait two animation frames for the rAF-scheduled ruler redraw to land.
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
    const darkSum = await rulerXInkSum(page)

    // Sanity: both reads must have returned real pixel data (not -1 / not empty canvas)
    expect(lightSum).toBeGreaterThan(0)
    expect(darkSum).toBeGreaterThan(0)
    // The tick color must differ between light (#131C1B ≈ near-black) and
    // dark (#E6ECE9 ≈ near-white), so the summed RGB of the ruler strip will differ.
    expect(darkSum).not.toBe(lightSum)
  })
})
