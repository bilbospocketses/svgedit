import { describe, expect, it } from 'vitest'
import { parseEmbedURLParams } from '../../src/embed/url-params.ts'

describe('embed URL param parser', () => {
  it('returns defaults for empty URL', () => {
    const p = parseEmbedURLParams(new URLSearchParams(''))
    expect(p.embedMode).toBe(false)
    expect(p.chrome).toBe(undefined)
    expect(p.theme).toBe(undefined)
    expect(p.allowedOrigins).toEqual([])
    expect(p.dialogTimeoutMs).toBe(30000)
    expect(p.palette).toBe(undefined)
  })

  it('parses embed=1 as truthy', () => {
    expect(parseEmbedURLParams(new URLSearchParams('embed=1')).embedMode).toBe(true)
  })

  it('parses chrome preset', () => {
    expect(parseEmbedURLParams(new URLSearchParams('chrome=minimal')).chrome).toBe('minimal')
    expect(parseEmbedURLParams(new URLSearchParams('chrome=full')).chrome).toBe('full')
    expect(parseEmbedURLParams(new URLSearchParams('chrome=none')).chrome).toBe('none')
  })

  it('ignores invalid chrome value', () => {
    expect(parseEmbedURLParams(new URLSearchParams('chrome=bogus')).chrome).toBe(undefined)
  })

  it('parses theme as opaque string', () => {
    expect(parseEmbedURLParams(new URLSearchParams('theme=dark')).theme).toBe('dark')
    expect(parseEmbedURLParams(new URLSearchParams('theme=custom-x')).theme).toBe('custom-x')
  })

  it('parses allowedOrigins comma list', () => {
    const p = parseEmbedURLParams(new URLSearchParams('allowedOrigins=https://a.com,https://b.com'))
    expect(p.allowedOrigins).toEqual(['https://a.com', 'https://b.com'])
  })

  it('parses dialogTimeout integer', () => {
    expect(parseEmbedURLParams(new URLSearchParams('dialogTimeout=10000')).dialogTimeoutMs).toBe(10000)
  })

  it('rejects non-integer dialogTimeout, keeps default', () => {
    expect(parseEmbedURLParams(new URLSearchParams('dialogTimeout=abc')).dialogTimeoutMs).toBe(30000)
  })

  it('rejects negative dialogTimeout, keeps default', () => {
    expect(parseEmbedURLParams(new URLSearchParams('dialogTimeout=-1')).dialogTimeoutMs).toBe(30000)
  })

  it('parses palette as a comma-separated, URL-decoded list', () => {
    const p = parseEmbedURLParams(new URLSearchParams('palette=%23ff0000,%2300ff00,none'))
    expect(p.palette).toEqual(['#ff0000', '#00ff00', 'none'])
  })

  it('returns undefined palette when absent', () => {
    expect(parseEmbedURLParams(new URLSearchParams('')).palette).toBe(undefined)
  })

  it('drops empty palette entries', () => {
    const p = parseEmbedURLParams(new URLSearchParams('palette=%23ff0000,,%2300ff00'))
    expect(p.palette).toEqual(['#ff0000', '#00ff00'])
  })

  it('returns undefined palette for an all-empty value', () => {
    expect(parseEmbedURLParams(new URLSearchParams('palette=,,')).palette).toBe(undefined)
  })

  it('returns undefined palette for an empty value', () => {
    expect(parseEmbedURLParams(new URLSearchParams('palette=')).palette).toBe(undefined)
  })
})
