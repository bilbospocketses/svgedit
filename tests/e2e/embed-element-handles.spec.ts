// tests/e2e/embed-element-handles.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: element handle round-trip', () => {
  test('getElem returns a handle; passing it back resolves to the element', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.editor.loadFromString!(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect id="rect-x" width="10" height="10"/></svg>'
    ))
    const handle = await page.evaluate(() => window.__svgeditEmbed.editor.getElem!('rect-x'))
    expect(handle).toMatchObject({ __svgeditHandle: expect.any(String) })

    const id = await page.evaluate((h) => window.__svgeditEmbed.editor.getId!(h), handle)
    expect(id).toBe('rect-x')
  })

  test('handle for deleted element returns ELEMENT_NOT_FOUND on reuse', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.editor.loadFromString!(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect id="goner" width="10" height="10"/></svg>'
    ))
    const handle = await page.evaluate(() => window.__svgeditEmbed.editor.getElem!('goner'))
    await page.evaluate(() => window.__svgeditEmbed.editor.loadFromString!('<svg xmlns="http://www.w3.org/2000/svg"/>'))
    const err = await page.evaluate((h) =>
      window.__svgeditEmbed.editor.getId!(h).then(() => null, (e: { code: string; message: string }) => ({ code: e.code, message: e.message })),
      handle
    )
    expect(err?.code).toBe('ELEMENT_NOT_FOUND')
  })
})
