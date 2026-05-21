// tests/e2e/embed-events.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost, getLog } from './embed-helpers.js'

test.describe('embed: events', () => {
  test('ready event fires', async ({ page }) => {
    await openEmbedHost(page)
    expect(await getLog(page)).toMatch(/READY/)
  })

  test('change event fires after content modification', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() =>
      window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    )
    await page.waitForFunction(() => window.__getLog().includes('CHANGE'), { timeout: 5000 })
  })

  test('selection-changed fires when something is selected', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(async () => {
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect id="r" x="0" y="0" width="10" height="10"/></svg>')
      await new Promise(r => setTimeout(r, 100))
    })
    await page.evaluate(() => window.__svgeditEmbed.editor.selectAllInCurrentLayer())
    await page.waitForFunction(() => window.__getLog().includes('SELECTION'), { timeout: 5000 })
  })

  test('once subscription fires exactly once', async ({ page }) => {
    await openEmbedHost(page)
    const count = await page.evaluate(async () => {
      let n = 0
      window.__svgeditEmbed.once('change', () => { n += 1 })
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
      await new Promise(r => setTimeout(r, 300))
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>')
      await new Promise(r => setTimeout(r, 300))
      return n
    })
    expect(count).toBe(1)
  })

  test('off removes subscription', async ({ page }) => {
    await openEmbedHost(page)
    const count = await page.evaluate(async () => {
      let n = 0
      const handler = () => { n += 1 }
      window.__svgeditEmbed.on('change', handler)
      window.__svgeditEmbed.off('change', handler)
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
      await new Promise(r => setTimeout(r, 300))
      return n
    })
    expect(count).toBe(0)
  })
})
