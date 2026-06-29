// tests/e2e/embed-dialogs.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: dialog hooks', () => {
  test('host-registered alert handler intercepts editor alert', async ({ page }) => {
    await openEmbedHost(page)

    // Register the dialog handler on the host side
    await page.evaluate(async () => {
      window.__capturedDialog = null
      window.__svgeditEmbed.setDialogHandler('alert', async (msg: string) => {
        window.__capturedDialog = msg
      })
    })

    // Wait until the __registerDialogHandler call has reached the server (the server
    // marks the host handler registered), rather than guessing with a fixed delay.
    const frame = page.frames().find(f => f.url().includes('/index.html'))!
    await expect
      .poll(() => frame.evaluate(() => window.svgEditor._embedServer._isHostHandlerRegistered('alert')))
      .toBe(true)

    // Trigger requestDialog from inside the iframe via Playwright frame API
    // (cannot nest page.evaluate — use frame.evaluate instead)
    await frame.evaluate(() => window.svgEditor._embedServer.requestDialog('alert', ['hello from test']))

    // Poll for the postMessage round-trip to complete instead of a fixed delay.
    await expect.poll(() => page.evaluate(() => window.__capturedDialog)).toBe('hello from test')
  })

  test('host-registered handler is unregistered correctly', async ({ page }) => {
    await openEmbedHost(page)

    // Register then immediately unregister
    await page.evaluate(async () => {
      window.__capturedDialog2 = null
      const off = window.__svgeditEmbed.setDialogHandler('alert', async (msg: string) => {
        window.__capturedDialog2 = msg
      })
      off()
    })

    // Wait until the __unregisterDialogHandler call has reached the server (the server
    // clears the host-handler mark) instead of guessing with a fixed delay.
    const frame = page.frames().find(f => f.url().includes('/index.html'))!
    await expect
      .poll(() => frame.evaluate(() => window.svgEditor._embedServer._isHostHandlerRegistered('alert')))
      .toBe(false)

    // Trigger requestDialog — handler should NOT fire (server no longer has it registered)
    await frame.evaluate(() => window.svgEditor._embedServer.requestDialog('alert', ['should not arrive']))

    // Wait for any potential round-trip
    await page.waitForTimeout(300)

    const captured = await page.evaluate(() => window.__capturedDialog2)
    // Handler was unregistered: captured must still be null
    expect(captured).toBeNull()
  })
})
