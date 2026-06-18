// @vitest-environment jsdom
// #47 — the context-panel breadcrumb must not inject HTML from element ids / layer name.
import { describe, it, expect } from 'vitest'
import { renderContextPanel } from '../../src/editor/contextPanel.js'

const g = (id?: string): Element => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  if (id) e.id = id
  return e
}

describe('renderContextPanel — HTML injection (#47)', () => {
  it('does not inject HTML from a malicious element id', () => {
    const panel = document.createElement('div')
    const ctx = g('ctx')
    const evil = g('"><img src=x onerror=alert(1)>')
    renderContextPanel(panel, 'Layer 1', [evil, ctx], ctx)
    expect(panel.querySelector('img')).toBeNull()
    expect(panel.textContent).toContain('"><img src=x onerror=alert(1)>') // kept as text
  })

  it('does not inject HTML from a malicious layer name', () => {
    const panel = document.createElement('div')
    const ctx = g('ctx')
    renderContextPanel(panel, '<img src=x onerror=alert(1)>', [ctx], ctx)
    expect(panel.querySelector('img')).toBeNull()
  })

  it('renders the layer name and ancestor ids as a breadcrumb', () => {
    const panel = document.createElement('div')
    const ctx = g('group2')
    const parent = g('group1')
    renderContextPanel(panel, 'Layer 1', [parent, ctx], ctx)
    const root = panel.querySelector('a[data-root="y"]')!
    expect(root.textContent).toBe('Layer 1')
    expect(panel.textContent).toContain('group1')
    expect(panel.textContent).toContain('group2')
  })
})
