import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSystemTheme, applyTheme, applyInitialTheme, getCurrentTheme, toggleTheme, resolveInitialTheme } from '../../src/editor/styles/theme'

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

  it('getCurrentTheme reads the html attribute (defaults light)', () => {
    document.documentElement.removeAttribute('data-theme')
    expect(getCurrentTheme()).toBe('light')
    applyTheme('dark')
    expect(getCurrentTheme()).toBe('dark')
  })

  it('applyTheme dispatches svgedit-themechange with the theme', () => {
    let got: string | null = null
    const h = (e: Event) => { got = (e as CustomEvent).detail.theme }
    document.addEventListener('svgedit-themechange', h)
    applyTheme('dark')
    document.removeEventListener('svgedit-themechange', h)
    expect(got).toBe('dark')
  })

  it('toggleTheme flips and returns the new theme', () => {
    applyTheme('light')
    expect(toggleTheme()).toBe('dark')
    expect(getCurrentTheme()).toBe('dark')
    expect(toggleTheme()).toBe('light')
  })

  it('resolveInitialTheme: stored wins, else system', () => {
    expect(resolveInitialTheme('dark')).toBe('dark')
    expect(resolveInitialTheme('light')).toBe('light')
    mockPrefersDark(true); expect(resolveInitialTheme('')).toBe('dark')
    mockPrefersDark(false); expect(resolveInitialTheme(null)).toBe('light')
    mockPrefersDark(true); expect(resolveInitialTheme('bogus')).toBe('dark')
  })
})
