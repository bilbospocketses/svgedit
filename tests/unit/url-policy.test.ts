import { describe, it, expect } from 'vitest'
import { isSameOriginHttpUrl } from '../../packages/svgcanvas/core/url-policy.js'

describe('isSameOriginHttpUrl (#45 / #34 — same-origin http(s) fetch policy)', () => {
  const origin = window.location.origin

  it('accepts same-origin absolute http(s) URLs', () => {
    expect(isSameOriginHttpUrl(`${origin}/drawing.svg`)).toBe(true)
  })

  it('accepts same-origin relative URLs', () => {
    expect(isSameOriginHttpUrl('/drawings/foo.svg')).toBe(true)
    expect(isSameOriginHttpUrl('foo.svg')).toBe(true)
  })

  it('rejects cross-origin URLs', () => {
    expect(isSameOriginHttpUrl('https://evil.example/x.svg')).toBe(false)
    expect(isSameOriginHttpUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  it('rejects protocol-relative URLs (they resolve cross-origin)', () => {
    expect(isSameOriginHttpUrl('//evil.example/x.svg')).toBe(false)
  })

  it('rejects non-http(s) schemes', () => {
    expect(isSameOriginHttpUrl('file:///etc/passwd')).toBe(false)
    expect(isSameOriginHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSameOriginHttpUrl('data:image/svg+xml,<svg/>')).toBe(false)
  })

  it('treats a different port as cross-origin', () => {
    const url = new URL(window.location.href)
    url.port = String((Number(url.port) || 80) + 1)
    expect(isSameOriginHttpUrl(url.href)).toBe(false)
  })
})
