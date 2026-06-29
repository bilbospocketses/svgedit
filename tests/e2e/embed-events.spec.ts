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
      window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    )
    await page.waitForFunction(() => window.__getLog().includes('CHANGE'), { timeout: 5000 })
  })

  test('selection-changed fires when something is selected', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(async () => {
      await window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><rect id="r" x="0" y="0" width="10" height="10"/></svg>')
      await new Promise(r => setTimeout(r, 100))
    })
    await page.evaluate(() => window.__svgeditEmbed.editor.selectAllInCurrentLayer!())
    await page.waitForFunction(() => window.__getLog().includes('SELECTION'), { timeout: 5000 })
  })

  test('once subscription fires exactly once', async ({ page }) => {
    await openEmbedHost(page)
    const count = await page.evaluate(async () => {
      let n = 0
      window.__svgeditEmbed.once('change', () => { n += 1 })
      await window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
      await new Promise(r => setTimeout(r, 300))
      await window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>')
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
      await window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
      await new Promise(r => setTimeout(r, 300))
      return n
    })
    expect(count).toBe(0)
  })

  // v1.1 (PR-B audit #1): group/move lifecycle events. Verifies the embed channel mirrors
  // the new svgCanvas event-bus events that replaced ext-connector's monkey-patching.

  test('before-group + after-group fire around groupSelectedElements', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(async () => {
      await window.__svgeditEmbed.editor.loadFromString!(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="0" y="0" width="10" height="10"/><rect id="r2" x="20" y="0" width="10" height="10"/></svg>'
      )
      await new Promise(r => setTimeout(r, 200))
      await window.__svgeditEmbed.editor.selectAllInCurrentLayer!()
      window.__clearLog()
      await window.__svgeditEmbed.editor.groupSelectedElements!()
      await new Promise(r => setTimeout(r, 200))
    })
    const log = await page.evaluate(() => window.__getLog())
    expect(log).toMatch(/BEFORE-GROUP/)
    expect(log).toMatch(/AFTER-GROUP/)
    expect(log.indexOf('BEFORE-GROUP')).toBeLessThan(log.indexOf('AFTER-GROUP'))
  })

  test('before-move + after-move fire around moveSelectedElements', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(async () => {
      await window.__svgeditEmbed.editor.loadFromString!(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="0" y="0" width="10" height="10"/></svg>'
      )
      await new Promise(r => setTimeout(r, 200))
      await window.__svgeditEmbed.editor.selectAllInCurrentLayer!()
      window.__clearLog()
      // moveSelectedElements with a non-empty selection returns a BatchCommand whose
      // subcommands hold Element refs (SVGRectElement etc.). The embed serializer leaves
      // class instances as-is, and postMessage's structured clone rejects them. The events
      // STILL fire (svgCanvas runs synchronously to completion before the postMessage reply
      // is constructed), so the test asserts the log, not the return-value Promise.
      // BatchCommand serialization across the embed boundary is a real but separate gap;
      // flagged as a post-v1.2 follow-up.
      window.__svgeditEmbed.editor.moveSelectedElements!(5, 5, false).catch(() => {})
      await new Promise(r => setTimeout(r, 300))
    })
    const log = await page.evaluate(() => window.__getLog())
    expect(log).toMatch(/BEFORE-MOVE/)
    expect(log).toMatch(/AFTER-MOVE/)
    expect(log.indexOf('BEFORE-MOVE')).toBeLessThan(log.indexOf('AFTER-MOVE'))
  })

  test('after-move fires even when no command is produced (empty selection)', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(async () => {
      await window.__svgeditEmbed.editor.clearSelection!()
      window.__clearLog()
      // Empty selection → moveSelectedElements returns undefined (serializable). No catch needed.
      await window.__svgeditEmbed.editor.moveSelectedElements!(1, 1, false)
      await new Promise(r => setTimeout(r, 200))
    })
    const log = await page.evaluate(() => window.__getLog())
    expect(log).toMatch(/BEFORE-MOVE/)
    expect(log).toMatch(/AFTER-MOVE/)
  })
})
