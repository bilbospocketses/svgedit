import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('Editor web components', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('se-button clicks', async ({ page }) => {
    await page.exposeFunction('onSeButton', () => {})
    await page.evaluate(() => {
      const el = document.createElement('se-button')
      el.id = 'playwright-se-button'
      el.style.display = 'inline-block'
      el.addEventListener('click', window.onSeButton!)
      document.body.append(el)
    })
    const button = page.locator('#playwright-se-button')
    await expect(button).toHaveCount(1)
    expect(await button.evaluate(el => el.matches(':defined'))).toBe(true)
    await button.click()
  })

  test('se-flyingbutton clicks', async ({ page }) => {
    await page.exposeFunction('onSeFlying', () => {})
    await page.evaluate(() => {
      const el = document.createElement('se-flyingbutton')
      el.id = 'playwright-se-flying'
      el.style.display = 'inline-block'
      el.addEventListener('click', window.onSeFlying!)
      document.body.append(el)
    })
    const button = page.locator('#playwright-se-flying')
    await expect(button).toHaveCount(1)
    expect(await button.evaluate(el => el.matches(':defined'))).toBe(true)
    await button.evaluate(el => (el as HTMLElement).click())
  })

  test('se-explorerbutton clicks', async ({ page }) => {
    await page.exposeFunction('onSeExplorer', () => {})
    await page.evaluate(() => {
      const el = document.createElement('se-explorerbutton')
      el.id = 'playwright-se-explorer'
      el.style.display = 'inline-block'
      el.addEventListener('click', window.onSeExplorer!)
      document.body.append(el)
    })
    const button = page.locator('#playwright-se-explorer')
    await expect(button).toHaveCount(1)
    expect(await button.evaluate(el => el.matches(':defined'))).toBe(true)
    await button.evaluate(el => (el as HTMLElement).click())
  })
})
