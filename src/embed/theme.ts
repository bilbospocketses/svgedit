// src/embed/theme.ts
// Self-contained theme applier for the embed bundle. Deliberately mirrors
// editor/styles/theme.ts's html[data-theme] + svgedit-themechange contract so
// the embed bundle stays self-contained (importing editor/* widened rootDir and
// broke the dist/embed output structure). Keep in sync with editor/styles/theme.ts.
export type Theme = 'light' | 'dark'

export function resolveInitialTheme (stored?: string | null): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme (theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  document.dispatchEvent(new CustomEvent('svgedit-themechange', { detail: { theme } }))
}
