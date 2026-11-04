// tests/e2e/embed-events.spec.js
import { expect, type Page, test } from '@playwright/test'
import { openEmbedHost, getLog } from './embed-helpers.js'

// Number of CHANGE lines in the host fixture's log. The fixture's own 'change'
// listener appends one per delivered event, in the same dispatch that runs every
// other 'change' handler, so a new CHANGE line means all handlers for it have run.
const changeCount = (page: Page): Promise<number> =>
  page.evaluate(() => (window.__getLog().match(/^CHANGE$/gm) ?? []).length)

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
    await page.waitForFunction(() => window.__getLog().includes('CHANGE'))
  })

  test('selection-changed fires when something is selected', async ({ page }) => {
    await openEmbedHost(page)
    // loadFromString resolves only after the editor has loaded the document (the
    // server replies after the synchronous load), so nothing is left pending here.
    await page.evaluate(() =>
      window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><rect id="r" x="0" y="0" width="10" height="10"/></svg>')
    )
    await page.evaluate(() => window.__svgeditEmbed.editor.selectAllInCurrentLayer!())
    await page.waitForFunction(() => window.__getLog().includes('SELECTION'))
  })

  test('once subscription fires exactly once', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => {
      window.__onceCount = 0
      window.__svgeditEmbed.once('change', () => { window.__onceCount += 1 })
    })
    // The editor debounces 'change' (200 ms), so each load waits for its own CHANGE
    // to reach the host before the next load: two separate events, never one
    // coalesced emit.
    const before = await changeCount(page)
    await page.evaluate(() =>
      window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    )
    // timing: allow -- expect timeout is 120 s in playwright.config.mjs
    await expect.poll(() => changeCount(page)).toBeGreaterThanOrEqual(before + 1)
    const afterFirst = await changeCount(page)
    await page.evaluate(() =>
      window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>')
    )
    // Once the second CHANGE is logged, every handler for it has run: a once
    // handler that was not removed would have counted it.
    // timing: allow -- expect timeout is 120 s in playwright.config.mjs
    await expect.poll(() => changeCount(page)).toBeGreaterThanOrEqual(afterFirst + 1)
    expect(await page.evaluate(() => window.__onceCount)).toBe(1)
  })

  test('off removes subscription', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => {
      window.__offCount = 0
      const handler = () => { window.__offCount += 1 }
      window.__svgeditEmbed.on('change', handler)
      window.__svgeditEmbed.off('change', handler)
    })
    const before = await changeCount(page)
    await page.evaluate(() =>
      window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    )
    // The CHANGE is delivered: a handler still subscribed would have run with it.
    // timing: allow -- expect timeout is 120 s in playwright.config.mjs
    await expect.poll(() => changeCount(page)).toBeGreaterThanOrEqual(before + 1)
    expect(await page.evaluate(() => window.__offCount)).toBe(0)
  })

  // v1.1 (PR-B audit #1): group/move lifecycle events. Verifies the embed channel mirrors
  // the new svgCanvas event-bus events that replaced ext-connector's monkey-patching.
  //
  // svgCanvas emits these events synchronously inside the call, before the server posts
  // the call's reply, and postMessage keeps their order, so once the awaited call settles
  // the events are already in the host log.

  test('before-group + after-group fire around groupSelectedElements', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(async () => {
      await window.__svgeditEmbed.editor.loadFromString!(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="0" y="0" width="10" height="10"/><rect id="r2" x="20" y="0" width="10" height="10"/></svg>'
      )
      await window.__svgeditEmbed.editor.selectAllInCurrentLayer!()
      window.__clearLog()
      await window.__svgeditEmbed.editor.groupSelectedElements!()
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
      await window.__svgeditEmbed.editor.selectAllInCurrentLayer!()
      window.__clearLog()
      // moveSelectedElements with a non-empty selection returns a BatchCommand whose
      // subcommands hold Element refs (SVGRectElement etc.). The embed serializer leaves
      // class instances as-is, and postMessage's structured clone rejects them, so the
      // call rejects with an error reply. The events STILL fire (svgCanvas runs
      // synchronously to completion before the reply is constructed), so the test
      // asserts the log, and waits for the error reply only as the sign that the call
      // has finished. BatchCommand serialization across the embed boundary is a real
      // but separate gap; flagged as a post-v1.2 follow-up.
      await window.__svgeditEmbed.editor.moveSelectedElements!(5, 5, false).catch(() => {})
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
    })
    const log = await page.evaluate(() => window.__getLog())
    expect(log).toMatch(/BEFORE-MOVE/)
    expect(log).toMatch(/AFTER-MOVE/)
  })
})
