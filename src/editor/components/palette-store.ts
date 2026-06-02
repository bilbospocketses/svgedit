// src/editor/components/palette-store.ts
// Single source of truth + validation site for the editor's swatch palette.
import { DEFAULT_PALETTE } from '../../embed/palette-defaults.js'

export type SetPaletteResult = { applied: readonly string[]; dropped: string[] }

let current: readonly string[] = DEFAULT_PALETTE
const listeners = new Set<() => void>()

// A detached element whose style setter rejects invalid CSS colors. Works in both
// real browsers and jsdom (cssstyle validates color), unlike CSS.supports in jsdom.
const probe = document.createElement('span')
function isValidColor (value: unknown): boolean {
  if (value === 'none') return true
  if (typeof value !== 'string' || value.trim() === '') return false
  probe.style.color = ''
  probe.style.color = value
  return probe.style.color !== ''
}

export function getPalette (): readonly string[] {
  return current
}

export function setPalette (colors: readonly unknown[]): SetPaletteResult {
  const valid: string[] = []
  const dropped: string[] = []
  for (const c of colors) {
    if (isValidColor(c)) valid.push(c as string)
    else dropped.push(String(c))
  }
  const withNone = valid.includes('none') ? valid : ['none', ...valid]
  const hasRealColor = withNone.some(c => c !== 'none')
  current = hasRealColor ? withNone : DEFAULT_PALETTE
  listeners.forEach(fn => fn())
  return { applied: current, dropped }
}

export function subscribePalette (fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Test-only: restore module state between tests.
export function _resetPaletteForTest (): void {
  current = DEFAULT_PALETTE
  listeners.clear()
}
