import { expect, test } from '@playwright/test'

test.describe('embed: versioning', () => {
  test('protocolVersion mismatch throws on host construction', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/embed-host.html')
    const err = await page.evaluate(async () => {
      try {
        const embedModuleUrl = '/dist/embed/index.js'
        const { SvgEditEmbed } = await import(embedModuleUrl) as typeof import('../../src/embed/index.js')
        const iframe = document.createElement('iframe')
        document.body.appendChild(iframe)
        Object.defineProperty(iframe, 'contentWindow', { value: window, configurable: true })
        const c = new SvgEditEmbed(iframe, { allowedOrigins: [window.location.origin] })
        setTimeout(() => {
          window.dispatchEvent(new MessageEvent('message', {
            data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '99.0.0', protocolVersion: 99, capabilities: [] } },
            origin: window.location.origin,
            source: window
          }))
        }, 0)
        await c.ready
        return null
      } catch (e) {
        return { message: (e as Error).message }
      }
    })
    expect(err?.message).toMatch(/protocolVersion mismatch/)
  })
})
