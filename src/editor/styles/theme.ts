// src/editor/styles/theme.ts
export type Theme = 'light' | 'dark'

/** OS-level color-scheme preference. */
export function getSystemTheme (): Theme {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The currently-applied theme (reads the document attribute; defaults light). */
export function getCurrentTheme (): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/** Apply a theme (sets html[data-theme]) and announce it via a CustomEvent. */
export function applyTheme (theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  document.dispatchEvent(new CustomEvent('svgedit-themechange', { detail: { theme } }))
}

/** Flip light<->dark; returns the new theme. (Does NOT persist — caller persists.) */
export function toggleTheme (): Theme {
  const next: Theme = getCurrentTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

/** A stored explicit 'light'/'dark' wins; anything else falls back to the OS preference. */
export function resolveInitialTheme (stored?: string | null): Theme {
  return stored === 'light' || stored === 'dark' ? stored : getSystemTheme()
}

/** Apply the initial theme: stored choice if present, else OS preference. */
export function applyInitialTheme (stored?: string | null): void {
  applyTheme(resolveInitialTheme(stored))
}
