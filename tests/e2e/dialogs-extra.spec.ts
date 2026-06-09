import { test, expect } from './fixtures.js'

test.describe('Dialog helpers', () => {
  test('se-status-dialog toggles title and close', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => Boolean(customElements.get('se-status-dialog')))

    const result = await page.evaluate(() => {
      const prompt = document.createElement('se-status-dialog')
      document.body.append(prompt)
      prompt.title = 'Hello'
      prompt.close = true
      prompt.close = false

      return {
        title: prompt.title,
        hasCloseAttr: prompt.hasAttribute('close')
      }
    })

    expect(result.title).toBe('Hello')
    expect(result.hasCloseAttr).toBe(false)
  })

  test('seAlert creates alert dialog', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.seAlert === 'function')

    const created = await page.evaluate(() => {
      const before = document.querySelectorAll('se-plain-alert-dialog').length
      window.seAlert('Cover alert dialog')
      const after = document.querySelectorAll('se-plain-alert-dialog').length
      return after > before
    })

    expect(created).toBe(true)
  })

  test('se-prompt-dialog resolves the typed value on OK (Enter)', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.sePrompt === 'function')

    await page.evaluate(() => {
      window.__promptResult = window.sePrompt('Enter value', 'seed')
    })

    const input = page.locator('se-prompt-dialog input')
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('seed')
    await input.fill('typed')
    await input.press('Enter')

    const value = await page.evaluate(() => window.__promptResult)
    expect(value).toBe('typed')
  })

  test('se-prompt-dialog resolves null on Cancel', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.sePrompt === 'function')

    await page.evaluate(() => {
      window.__promptResult = window.sePrompt('Enter value', 'seed')
    })

    await page.locator('se-prompt-dialog button[value="cancel"]').click()

    const value = await page.evaluate(() => window.__promptResult)
    expect(value).toBeNull()
  })

  test('se-prompt-dialog resolves null on Escape', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.sePrompt === 'function')

    await page.evaluate(() => {
      window.__promptResult = window.sePrompt('Enter value', 'seed')
    })

    const input = page.locator('se-prompt-dialog input')
    await expect(input).toBeFocused()
    await input.press('Escape')

    const value = await page.evaluate(() => window.__promptResult)
    expect(value).toBeNull()
  })
})
