// tests/e2e/embed-helpers.js
export async function openEmbedHost (page, { editorSrc, allowedOrigins } = {}) {
  const params = new URLSearchParams()
  if (editorSrc) params.set('editorSrc', editorSrc)
  if (allowedOrigins) params.set('allowedOrigins', allowedOrigins.join(','))
  const url = `/tests/e2e/fixtures/embed-host.html${params.toString() ? `?${params.toString()}` : ''}`
  await page.goto(url)
  await page.waitForFunction(() => window.__svgeditEmbed && window.__getLog().includes('READY'), { timeout: 15000 })
}

export async function getLog (page) {
  return await page.evaluate(() => window.__getLog())
}

export async function clearLog (page) {
  await page.evaluate(() => window.__clearLog())
}
