// tests/e2e/embed-init.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost, getLog } from './embed-helpers.js'

test.describe('embed: init handshake', () => {
  test('READY event fires with version + protocolVersion + capabilities', async ({ page }) => {
    await openEmbedHost(page)
    const log = await getLog(page)
    expect(log).toMatch(/READY/)
    const readyLine = log.split('\n').find((l: string) => l.startsWith('READY'))
    const payload = JSON.parse(readyLine!.replace('READY ', ''))
    expect(payload.protocolVersion).toBe(1)
    expect(payload.version).toBeTruthy()
    expect(payload.capabilities).toEqual(expect.arrayContaining(['chrome', 'theme', 'dialog-hooks']))
  })

  test('URL-param chrome=minimal hides menu+layers but keeps toolbox', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&chrome=minimal' })
    const bodyClasses = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(bodyClasses).toContain('embed')
    expect(bodyClasses).toContain('no-menu')
    expect(bodyClasses).toContain('no-layers')
    expect(bodyClasses).not.toContain('no-toolbox')
  })

  test('queued calls before ready flush after ready resolves', async ({ page }) => {
    await openEmbedHost(page)
    const zoom = await page.evaluate(() => window.__svgeditEmbed.editor.getZoom!())
    expect(typeof zoom).toBe('number')
    expect(zoom).toBeGreaterThan(0)
  })
})
