import type { Page } from '@playwright/test'

export async function openEmbedHost (page: Page, { editorSrc, allowedOrigins }: { editorSrc?: string; allowedOrigins?: string[] } = {}): Promise<void> {
  const params = new URLSearchParams()
  if (editorSrc) params.set('editorSrc', editorSrc)
  if (allowedOrigins) params.set('allowedOrigins', allowedOrigins.join(','))
  const url = `/tests/e2e/fixtures/embed-host.html${params.toString() ? `?${params.toString()}` : ''}`
  await page.goto(url)
  await page.waitForFunction(() => window.__svgeditEmbed && window.__getLog().includes('READY'), { timeout: 15000 })
}

export async function getLog (page: Page): Promise<string> {
  return await page.evaluate(() => window.__getLog())
}

export async function clearLog (page: Page): Promise<void> {
  await page.evaluate(() => window.__clearLog())
}
