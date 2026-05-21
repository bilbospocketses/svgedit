// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getCurrentTheme } from '../../src/embed/theme.ts'

describe('embed theme', () => {
  beforeEach(() => {
    document.body.className = ''
  })

  it('applyTheme adds theme-<name> class', () => {
    applyTheme(document.body, 'dark')
    expect(document.body.classList.contains('theme-dark')).toBe(true)
  })

  it('applyTheme replaces existing theme-* class', () => {
    applyTheme(document.body, 'dark')
    applyTheme(document.body, 'light')
    expect(document.body.classList.contains('theme-dark')).toBe(false)
    expect(document.body.classList.contains('theme-light')).toBe(true)
  })

  it('getCurrentTheme returns the active theme name', () => {
    applyTheme(document.body, 'custom-blue')
    expect(getCurrentTheme(document.body)).toBe('custom-blue')
  })

  it('getCurrentTheme returns null when no theme applied', () => {
    expect(getCurrentTheme(document.body)).toBe(null)
  })

  it('applyTheme rejects empty/whitespace theme name', () => {
    expect(() => applyTheme(document.body, '')).toThrow()
    expect(() => applyTheme(document.body, ' ')).toThrow()
  })
})
