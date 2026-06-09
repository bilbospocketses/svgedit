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

  test('seAlert opens an alert dialog and removes it from the DOM on close', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.seAlert === 'function')

    const before = await page.evaluate(
      () => document.querySelectorAll('se-plain-alert-dialog').length
    )

    await page.evaluate(() => window.seAlert('Cover alert dialog'))
    await page.waitForFunction(
      () => document.querySelector('se-plain-alert-dialog')?.shadowRoot?.querySelector('dialog')?.open === true
    )
    expect(
      await page.evaluate(() => document.querySelectorAll('se-plain-alert-dialog').length)
    ).toBe(before + 1)

    // Closing the alert (single "Ok" choice) must remove the element from the DOM.
    await page.locator('se-plain-alert-dialog button', { hasText: 'Ok' }).click()
    await page.waitForFunction(
      (b) => document.querySelectorAll('se-plain-alert-dialog').length === b,
      before
    )
    expect(
      await page.evaluate(() => document.querySelectorAll('se-plain-alert-dialog').length)
    ).toBe(before)
  })

  test('se-prompt-dialog resolves the typed value on OK (Enter)', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.sePrompt === 'function')

    // Kick off sePrompt without awaiting (it blocks on user interaction); __promptResult
    // holds the Promise, read back after the dialog closes.
    await page.evaluate(() => {
      window.__promptResult = window.sePrompt('Enter value', 'seed')
    })
    await page.waitForFunction(
      () => document.querySelector('se-prompt-dialog')?.shadowRoot?.querySelector('dialog')?.open === true
    )

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
    await page.waitForFunction(
      () => document.querySelector('se-prompt-dialog')?.shadowRoot?.querySelector('dialog')?.open === true
    )

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
    await page.waitForFunction(
      () => document.querySelector('se-prompt-dialog')?.shadowRoot?.querySelector('dialog')?.open === true
    )

    const input = page.locator('se-prompt-dialog input')
    await expect(input).toBeFocused()
    await input.press('Escape')

    const value = await page.evaluate(() => window.__promptResult)
    expect(value).toBeNull()
  })
})
