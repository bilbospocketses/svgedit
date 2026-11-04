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

    // Register first, and wait until the server has marked the host handler registered.
    // Polling only for the unregistered state after off() could pass on its first sample,
    // since unregistered is also the starting state.
    await page.evaluate(() => {
      window.__capturedDialog2 = null
      window.__offDialog2 = window.__svgeditEmbed.setDialogHandler('alert', async (msg: string) => {
        window.__capturedDialog2 = msg
      })
    })
    const frame = page.frames().find(f => f.url().includes('/index.html'))!
    // timing: allow -- expect timeout is 120 s in playwright.config.mjs
    await expect
      .poll(() => frame.evaluate(() => window.svgEditor._embedServer._isHostHandlerRegistered('alert')))
      .toBe(true)

    // Unregister, and wait until the __unregisterDialogHandler call has reached the
    // server (it clears the host-handler mark) instead of guessing with a fixed delay.
    await page.evaluate(() => { window.__offDialog2() })
    // timing: allow -- expect timeout is 120 s in playwright.config.mjs
    await expect
      .poll(() => frame.evaluate(() => window.svgEditor._embedServer._isHostHandlerRegistered('alert')))
      .toBe(false)

    // Trigger requestDialog — handler should NOT fire (server no longer has it registered).
    // Both server branches end in the editor's own in-app alert (seAlert): the
    // unregistered one at once, the registered one only after its dialog timeout, when it
    // also emits a dialog-handler-timeout error. So wait for the alert, then check below
    // that no such error reached the host.
    await frame.evaluate(() => window.svgEditor._embedServer.requestDialog('alert', ['should not arrive']))
    await expect(frame.locator('se-plain-alert-dialog', { hasText: 'should not arrive' })).toHaveCount(1)

    // One more call round trip: postMessage keeps order, so anything the editor posted
    // to the host before this reply has already been delivered.
    await page.evaluate(() => window.__svgeditEmbed.editor.getZoom!())

    // The request took the unregistered branch: no dialog-handler timeout was reported.
    expect(await page.evaluate(() => window.__getLog())).not.toMatch(/ERR dialog-handler-timeout/)
    const captured = await page.evaluate(() => window.__capturedDialog2)
    // Handler was unregistered: captured must still be null
    expect(captured).toBeNull()
  })
})
