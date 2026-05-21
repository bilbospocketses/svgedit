const THEME_CLASS_PREFIX = 'theme-'

export function applyTheme (body: HTMLElement, theme: string): void {
  const trimmed = theme.trim()
  if (trimmed.length === 0) throw new Error('applyTheme: theme name cannot be empty')
  for (const cls of Array.from(body.classList)) {
    if (cls.startsWith(THEME_CLASS_PREFIX)) body.classList.remove(cls)
  }
  body.classList.add(`${THEME_CLASS_PREFIX}${trimmed}`)
}

export function getCurrentTheme (body: HTMLElement): string | null {
  for (const cls of Array.from(body.classList)) {
    if (cls.startsWith(THEME_CLASS_PREFIX)) {
      return cls.substring(THEME_CLASS_PREFIX.length)
    }
  }
  return null
}
