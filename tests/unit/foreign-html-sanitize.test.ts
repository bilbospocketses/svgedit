import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as sanitize from '../../packages/svgcanvas/core/sanitize.js'

describe('sanitizeForeignHtml — tags', () => {
  const h = (tag: string) => document.createElementNS(NS.HTML, tag)
  let root: Element
  beforeEach(() => {
    console.warn = () => {}
    const svg = document.createElementNS(NS.SVG, 'svg')
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    root = h('div'); fo.appendChild(root); svg.appendChild(fo)
    document.body.appendChild(svg)
  })
  afterEach(() => { document.body.textContent = '' })

  it('keeps allowed inline/block tags', () => {
    root.innerHTML = '<p>a <strong>b</strong> <em>c</em></p>'
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('strong')).toBeTruthy()
    expect(root.querySelector('em')).toBeTruthy()
  })

  it('unwraps a disallowed tag but keeps its text (script)', () => {
    root.innerHTML = '<p>safe<script>alert(1)<\/script></p>'
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('script')).toBeNull()
    expect(root.textContent).toContain('safe')
  })

  it('unwraps a disallowed tag but keeps children (table -> its text)', () => {
    root.innerHTML = '<table><tr><td>cell</td></tr></table>'
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('table')).toBeNull()
    expect(root.textContent).toContain('cell')
  })
})
