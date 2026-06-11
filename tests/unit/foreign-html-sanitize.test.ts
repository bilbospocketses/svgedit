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

describe('sanitizeForeignHtml — attrs + style', () => {
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

  it('keeps allowlisted CSS props, drops the rest', () => {
    root.innerHTML = '<span style="color: red; font-size: 16px; position: absolute">x</span>'
    sanitize.sanitizeSvg(root)
    const span = root.querySelector('span')!
    const style = span.getAttribute('style') || ''
    expect(style).toContain('color')
    expect(style).toContain('font-size')
    expect(style).not.toContain('position')
  })

  it('drops style values containing url()/expression()', () => {
    root.innerHTML = '<span style="color: url(javascript:alert(1)); font-size: 16px">x</span>'
    sanitize.sanitizeSvg(root)
    const style = root.querySelector('span')!.getAttribute('style') || ''
    expect(style).not.toContain('url(')
    expect(style).toContain('font-size')
  })

  it('strips event handlers and unknown attrs, keeps class/id', () => {
    root.innerHTML = '<p class="c" id="i" onclick="alert(1)" data-x="1">x</p>'
    sanitize.sanitizeSvg(root)
    const p = root.querySelector('p')!
    expect(p.getAttribute('class')).toBe('c')
    expect(p.getAttribute('id')).toBe('i')
    expect(p.hasAttribute('onclick')).toBe(false)
    expect(p.hasAttribute('data-x')).toBe(false)
  })
})
