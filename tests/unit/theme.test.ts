import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSystemTheme, applyTheme, applyInitialTheme } from '../../src/editor/styles/theme'

function mockPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: dark && q.includes('dark'),
    media: q, addEventListener() {}, removeEventListener() {}
  }))
}

describe('theme bootstrap', () => {
  beforeEach(() => { document.documentElement.removeAttribute('data-theme') })

  it('reads the OS preference', () => {
    mockPrefersDark(true); expect(getSystemTheme()).toBe('dark')
    mockPrefersDark(false); expect(getSystemTheme()).toBe('light')
  })

  it('applyTheme sets the html data-theme attribute', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applyInitialTheme applies the OS preference', () => {
    mockPrefersDark(true); applyInitialTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
