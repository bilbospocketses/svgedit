// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../../src/editor/styles/tokens.css', import.meta.url)),
  'utf8'
)

const SEMANTIC = [
  '--se-bg', '--se-surface', '--se-surface-2', '--se-canvas',
  '--se-border', '--se-border-strong',
  '--se-text', '--se-text-muted', '--se-text-subtle',
  '--se-accent', '--se-accent-hover', '--se-accent-active', '--se-accent-subtle', '--se-on-accent',
  '--se-danger', '--se-warn', '--se-success', '--se-info',
  '--se-focus-ring', '--se-scrim', '--se-shadow-sm', '--se-shadow-overlay'
]

function block(selector: string): string {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 's')
  return css.match(re)?.[1] ?? ''
}

describe('design tokens', () => {
  const light = block(':root')
  const dark = block('html[data-theme="dark"]')

  it('defines every semantic token in light (:root)', () => {
    for (const t of SEMANTIC) expect(light, `missing ${t} in :root`).toContain(`${t}:`)
  })

  it('remaps all themeable semantic tokens in dark', () => {
    const themeable = SEMANTIC.filter((t) => t !== '--se-focus-ring')
    for (const t of themeable) expect(dark, `missing ${t} in dark`).toContain(`${t}:`)
  })

  it('sets color-scheme for both themes', () => {
    expect(light).toContain('color-scheme: light')
    expect(dark).toContain('color-scheme: dark')
  })

  const SCALES = [
    '--se-font-sans',
    '--se-text-xs', '--se-text-sm', '--se-text-base', '--se-text-md', '--se-text-lg',
    '--se-fw-normal', '--se-fw-medium', '--se-fw-semibold',
    '--se-lh-tight', '--se-lh-normal',
    '--se-space-1', '--se-space-2', '--se-space-3', '--se-space-4', '--se-space-5', '--se-space-6', '--se-space-7',
    '--se-radius-sm', '--se-radius-md', '--se-radius-lg', '--se-radius-pill',
    '--se-control-h', '--se-tool-size', '--se-toolbar-h'
  ]

  it('defines all scale tokens in :root', () => {
    for (const t of SCALES) expect(light, `missing ${t} in :root`).toContain(`${t}:`)
  })
})
