/**
 * Selector-injection regression tests. Untrusted element ids (from opened/pasted
 * SVG, carried in url(#…)/href references) are interpolated into CSS selectors.
 * A crafted id throws a SyntaxError (aborting the operation) or mis-matches.
 *   #35 getElement  — unquoted `#id` (breaks on ]/:/quotes/space)
 *   #37 setSvgString dup-id  — `[id="…"]`
 *   #36 convertGradients     — `[fill="url(#…)"]`
 */
import { describe, it, expect, beforeEach } from 'vitest'
import SvgCanvas from '../../packages/svgcanvas/svgcanvas.js'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as utilities from '../../packages/svgcanvas/core/utilities.js'
import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

describe('getElement — selector injection (#35)', () => {
  let svg: SVGSVGElement
  const el = (n: string): Element => document.createElementNS(NS.SVG, n)

  beforeEach(() => {
    document.body.textContent = ''
    svg = el('svg') as SVGSVGElement
    document.body.append(svg)
    utilities.init({ getSvgRoot: () => svg } as never)
  })

  it('finds an element whose id contains CSS-selector metacharacters without throwing', () => {
    const rect = el('rect')
    rect.setAttribute('id', 'a]b:c')
    svg.append(rect)
    expect(() => utilities.getElement('a]b:c')).not.toThrow()
    expect(utilities.getElement('a]b:c')).toBe(rect)
  })

  it('returns null (not a throw) for a malformed missing id', () => {
    expect(() => utilities.getElement('no]such:id')).not.toThrow()
    expect(utilities.getElement('no]such:id')).toBeNull()
  })

  it('still finds a normal id', () => {
    const rect = el('rect')
    rect.setAttribute('id', 'plain')
    svg.append(rect)
    expect(utilities.getElement('plain')).toBe(rect)
  })
})

describe('setSvgString / convertGradients — selector injection (#37, #36)', () => {
  let svgCanvas: InstanceType<typeof SvgCanvas>

  beforeEach(() => { svgCanvas = createSvgCanvasFixture() as InstanceType<typeof SvgCanvas> })

  it('imports duplicate ids containing a quote without aborting (#37)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
      '<rect id="a&quot;b" x="0" y="0" width="10" height="10"/>' +
      '<rect id="a&quot;b" x="20" y="0" width="10" height="10"/>' +
      '</svg>'
    let ok: unknown
    expect(() => { ok = svgCanvas.setSvgString(svg) }).not.toThrow()
    expect(ok).toBeTruthy()
  })

  it('imports a gradient whose id contains a quote without aborting (#36)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100">' +
      '<defs><linearGradient id="g&quot;x" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#000000"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>' +
      '<rect x="0" y="0" width="10" height="10" fill="url(#g&quot;x)"/>' +
      '</svg>'
    let ok: unknown
    expect(() => { ok = svgCanvas.setSvgString(svg) }).not.toThrow()
    expect(ok).toBeTruthy()
  })
})
