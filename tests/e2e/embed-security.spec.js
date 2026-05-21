// tests/e2e/embed-security.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost, getLog } from './embed-helpers.js'

test.describe('embed: security model', () => {
  test('valid same-origin handshake works (sanity)', async ({ page }) => {
    await openEmbedHost(page)
    expect(await getLog(page)).toMatch(/READY/)
  })

  test('host drops injected message claiming foreign origin', async ({ page }) => {
    await openEmbedHost(page)
    const captured = await page.evaluate(() => {
      let unexpectedFire = false
      window.__svgeditEmbed.on('save', () => { unexpectedFire = true })
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'save', payload: { svgString: 'EVIL' } },
        origin: 'https://evil.com',
        source: window
      }))
      return unexpectedFire
    })
    expect(captured).toBe(false)
  })
})
