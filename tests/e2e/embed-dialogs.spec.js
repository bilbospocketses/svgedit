// tests/e2e/embed-dialogs.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: dialog hooks', () => {
  test('host-registered alert handler intercepts editor alert', async ({ page }) => {
    await openEmbedHost(page)

    // Register the dialog handler on the host side
    await page.evaluate(async () => {
      window.__capturedDialog = null
      window.__svgeditEmbed.setDialogHandler('alert', async (msg) => {
        window.__capturedDialog = msg
      })
    })

    // Give __registerDialogHandler call time to reach the server
    await page.waitForTimeout(150)

    // Trigger requestDialog from inside the iframe via Playwright frame API
    // (cannot nest page.evaluate — use frame.evaluate instead)
    const frame = page.frames().find(f => f.url().includes('/index.html'))
    await frame.evaluate(() => window.svgEditor._embedServer.requestDialog('alert', ['hello from test']))

    // Wait for the postMessage round-trip to complete
    await page.waitForTimeout(300)

    const captured = await page.evaluate(() => window.__capturedDialog)
    expect(captured).toBe('hello from test')
  })

  test('host-registered handler is unregistered correctly', async ({ page }) => {
    await openEmbedHost(page)

    // Register then immediately unregister
    await page.evaluate(async () => {
      window.__capturedDialog2 = null
      const off = window.__svgeditEmbed.setDialogHandler('alert', async (msg) => {
        window.__capturedDialog2 = msg
      })
      off()
    })

    // Give __unregisterDialogHandler call time to reach the server
    await page.waitForTimeout(150)

    // Trigger requestDialog — handler should NOT fire (server no longer has it registered)
    const frame = page.frames().find(f => f.url().includes('/index.html'))
    await frame.evaluate(() => window.svgEditor._embedServer.requestDialog('alert', ['should not arrive']))

    // Wait for any potential round-trip
    await page.waitForTimeout(300)

    const captured = await page.evaluate(() => window.__capturedDialog2)
    // Handler was unregistered: captured must still be null
    expect(captured).toBeNull()
  })
})
