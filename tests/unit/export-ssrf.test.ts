// @vitest-environment jsdom
/**
 * Export-time SSRF regression (#34). convertImagesToBase64 inlines <image> hrefs
 * on raster/PDF export. A malicious opened/pasted SVG can carry an <image> href
 * pointing at an internal host or cloud-metadata endpoint; fetching it on export
 * is request forgery and exfiltrates the response into the exported file.
 * Policy: only same-origin (and already-data:) image hrefs may be fetched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { convertImagesToBase64 } from '../../packages/svgcanvas/core/svg-exec.js'

const makeImage = (href: string): Element => {
  const img = document.createElementNS(NS.SVG, 'image')
  img.setAttribute('href', href)
  return img
}

const svgWith = (...imgs: Element[]): Element => {
  const svg = document.createElementNS(NS.SVG, 'svg')
  imgs.forEach((i) => svg.append(i))
  return svg
}

describe('convertImagesToBase64 — export-time SSRF guard (#34)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn(async () => ({
      blob: async () => new Blob(['x'], { type: 'image/png' })
    }))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not fetch a cross-origin <image> href and leaves it unchanged', async () => {
    const evil = makeImage('https://evil.example/secret.png')
    await convertImagesToBase64(svgWith(evil))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(evil.getAttribute('href')).toBe('https://evil.example/secret.png')
  })

  it('does not fetch a protocol-relative (cross-origin) <image> href', async () => {
    const evil = makeImage('//evil.example/secret.png')
    await convertImagesToBase64(svgWith(evil))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(evil.getAttribute('href')).toBe('//evil.example/secret.png')
  })

  it('still inlines a same-origin (relative) <image> href', async () => {
    const local = makeImage('/local.png')
    await convertImagesToBase64(svgWith(local))
    expect(fetchSpy).toHaveBeenCalledWith('/local.png')
    expect(local.getAttribute('href')?.startsWith('data:image/png')).toBe(true)
  })

  it('never fetches an already-inline data: <image> href', async () => {
    const inline = makeImage('data:image/png;base64,AAAA')
    await convertImagesToBase64(svgWith(inline))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(inline.getAttribute('href')).toBe('data:image/png;base64,AAAA')
  })

  it('inlines only the same-origin image when mixed with a cross-origin one', async () => {
    const evil = makeImage('https://evil.example/secret.png')
    const local = makeImage('/ok.png')
    await convertImagesToBase64(svgWith(evil, local))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/ok.png')
    expect(evil.getAttribute('href')).toBe('https://evil.example/secret.png')
    expect(local.getAttribute('href')?.startsWith('data:image/png')).toBe(true)
  })
})
