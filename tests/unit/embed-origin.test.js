import { describe, expect, it } from 'vitest'
import { isOriginAllowed, parseAllowedOrigins } from '../../src/embed/origin.ts'

describe('embed origin validator', () => {
  it('allows exact-match origin', () => {
    expect(isOriginAllowed('https://example.com', ['https://example.com'])).toBe(true)
  })

  it('rejects unrelated origin', () => {
    expect(isOriginAllowed('https://evil.com', ['https://example.com'])).toBe(false)
  })

  it('wildcard "*" allows any origin', () => {
    expect(isOriginAllowed('https://anything.com', ['*'])).toBe(true)
  })

  it('empty list rejects everything', () => {
    expect(isOriginAllowed('https://example.com', [])).toBe(false)
  })

  it('parseAllowedOrigins splits comma-separated string', () => {
    expect(parseAllowedOrigins('https://a.com,https://b.com')).toEqual(['https://a.com', 'https://b.com'])
  })

  it('parseAllowedOrigins handles whitespace and empty entries', () => {
    expect(parseAllowedOrigins(' https://a.com , , https://b.com ')).toEqual(['https://a.com', 'https://b.com'])
  })

  it('parseAllowedOrigins of "*" returns ["*"]', () => {
    expect(parseAllowedOrigins('*')).toEqual(['*'])
  })

  it('parseAllowedOrigins of empty string returns []', () => {
    expect(parseAllowedOrigins('')).toEqual([])
  })
})
