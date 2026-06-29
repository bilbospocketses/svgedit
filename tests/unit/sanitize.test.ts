import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as sanitize from '../../packages/svgcanvas/core/sanitize.js'
import * as utilities from '../../packages/svgcanvas/core/utilities.js'
import type { ISvgCanvas } from '../../packages/svgcanvas/core/svgcanvas-types.js'

describe('sanitize', function () {
  let container: HTMLDivElement
  let svg: SVGSVGElement
  let originalWarn: typeof console.warn

  const createSvgElement = (name: string) => document.createElementNS(NS.SVG, name)

  beforeEach(() => {
    originalWarn = console.warn
    console.warn = () => {}
    container = document.createElement('div')
    svg = createSvgElement('svg') as SVGSVGElement
    container.append(svg)
    document.body.append(container)

    utilities.init({
      getSvgRoot: () => svg
    } as unknown as ISvgCanvas)
  })

  afterEach(() => {
    container.remove()
    console.warn = originalWarn
  })

  it('sanitizeSvg() strips ws from style attr', function () {
    const rect = createSvgElement('rect')
    rect.setAttribute('style', 'stroke: blue ;\t\tstroke-width :\t\t40; vector-effect: non-scaling-stroke;')
    // sanitizeSvg() requires the node to have a parent and a document.
    svg.append(rect)
    sanitize.sanitizeSvg(rect)

    assert.equal(rect.getAttribute('stroke'), 'blue')
    assert.equal(rect.getAttribute('stroke-width'), '40')
    assert.equal(rect.hasAttribute('style'), false)
    assert.equal(rect.hasAttribute('vector-effect'), false)
  })

  it('sanitizeSvg() removes disallowed attributes but keeps data-*', function () {
    const rect = createSvgElement('rect')
    rect.setAttribute('onclick', 'alert(1)')
    rect.setAttribute('data-note', 'safe')
    svg.append(rect)

    sanitize.sanitizeSvg(rect)

    assert.equal(rect.hasAttribute('onclick'), false)
    assert.equal(rect.getAttribute('data-note'), 'safe')
  })

  it('sanitizeSvg() mirrors xlink:href to href', function () {
    const image = createSvgElement('image')
    image.setAttributeNS(NS.XLINK, 'xlink:href', 'http://example.com/test.png')
    svg.append(image)

    sanitize.sanitizeSvg(image)

    assert.equal(image.getAttribute('href'), 'http://example.com/test.png')
    assert.equal(image.hasAttributeNS(NS.XLINK, 'href'), false)
  })

  it('sanitizeSvg() drops non-local hrefs on local-only elements', function () {
    const gradient = createSvgElement('linearGradient')
    gradient.setAttribute('href', 'http://example.com/grad')
    svg.append(gradient)

    sanitize.sanitizeSvg(gradient)

    assert.equal(gradient.hasAttribute('href'), false)
  })

  it('sanitizeSvg() removes <use> without href', function () {
    const use = createSvgElement('use')
    svg.append(use)

    sanitize.sanitizeSvg(use)

    assert.equal(use.parentNode, null)
    assert.equal(svg.querySelector('use'), null)
  })

  it('sanitizeSvg() keeps <use> with a local href', function () {
    const symbol = createSvgElement('symbol')
    symbol.id = 'icon'
    symbol.setAttribute('viewBox', '0 0 200 100')
    svg.append(symbol)

    const use = createSvgElement('use')
    use.setAttribute('href', '#icon')
    svg.append(use)

    sanitize.sanitizeSvg(use)

    assert.equal(use.parentNode, svg)
    assert.equal(use.getAttribute('href'), '#icon')
    assert.equal(use.hasAttribute('width'), false)
    assert.equal(use.hasAttribute('height'), false)
  })

  it('sanitizeSvg() removes non-local url() paint references', function () {
    const rect = createSvgElement('rect')
    rect.setAttribute('fill', 'url(http://example.com/pat)')
    svg.append(rect)

    sanitize.sanitizeSvg(rect)

    assert.equal(rect.hasAttribute('fill'), false)
  })

  it('sanitizeSvg() trims and removes text nodes', function () {
    const text = createSvgElement('text')
    text.append(document.createTextNode('  Hello  '), document.createTextNode('   '))
    svg.append(text)

    sanitize.sanitizeSvg(text)

    assert.equal(text.textContent, 'Hello')
  })

  it('sanitizeSvg() removes unsupported elements but keeps children', function () {
    const unknown = createSvgElement('foo')
    const rect = createSvgElement('rect')
    unknown.append(rect)
    svg.append(unknown)

    sanitize.sanitizeSvg(unknown)

    assert.equal(svg.querySelector('foo'), null)
    assert.equal(rect.parentNode, svg)
  })

  it('sanitizeSvg() handles element with id attribute', function () {
    const rect = createSvgElement('rect')
    rect.setAttribute('id', 'myRect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    svg.append(rect)

    sanitize.sanitizeSvg(rect)

    assert.equal(rect.getAttribute('id'), 'myRect')
  })

  it('sanitizeSvg() handles comment nodes', function () {
    const g = createSvgElement('g')
    const comment = document.createComment('This is a comment')
    g.append(comment)
    svg.append(g)

    sanitize.sanitizeSvg(g)
    // sanitize no-ops non-element nodes, so the comment survives untouched
    assert.equal(g.childNodes.length, 1)
    assert.equal(g.firstChild!.nodeType, 8) // COMMENT_NODE
    assert.equal(g.firstChild!.nodeValue, 'This is a comment')
  })

  it('sanitizeSvg() handles nested groups', function () {
    const g1 = createSvgElement('g')
    const g2 = createSvgElement('g')
    const rect = createSvgElement('rect')
    g2.append(rect)
    g1.append(g2)
    svg.append(g1)

    sanitize.sanitizeSvg(g1)

    assert.ok(svg.querySelector('rect'))
  })
})
