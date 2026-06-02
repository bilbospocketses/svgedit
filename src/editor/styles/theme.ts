// src/editor/styles/theme.ts
export type Theme = 'light' | 'dark'

/** OS-level color-scheme preference. */
export function getSystemTheme(): Theme {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Apply a theme by setting the document attribute the token sheet keys off. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/**
 * M1: set the initial theme from the OS preference.
 * M2 will layer an explicit toggle + persistence on top of this.
 */
export function applyInitialTheme(): void {
  applyTheme(getSystemTheme())
}
