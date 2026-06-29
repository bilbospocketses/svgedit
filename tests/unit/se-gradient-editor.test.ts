// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import '../../src/editor/components/jgraduate/se-gradient-editor.js'

// Regression guards for two audit findings (#122, #128) that turned out to be
// over-claims: a radial gradient's radius and gradientTransform survive a
// read -> build round-trip unchanged. These pass on current code and guard
// against a real regression being introduced later.

const SVG_NS = 'http://www.w3.org/2000/svg'

function makeRadialGradient (
  opts: { cx?: string, cy?: string, r?: string, gradientTransform?: string } = {}
): SVGRadialGradientElement {
  const g = document.createElementNS(SVG_NS, 'radialGradient') as SVGRadialGradientElement
  g.setAttribute('cx', opts.cx ?? '0.5')
  g.setAttribute('cy', opts.cy ?? '0.5')
  g.setAttribute('r', opts.r ?? '0.5')
  if (opts.gradientTransform) g.setAttribute('gradientTransform', opts.gradientTransform)
  for (const [offset, color] of [['0', '#000000'], ['1', '#ffffff']] as const) {
    const stop = document.createElementNS(SVG_NS, 'stop')
    stop.setAttribute('offset', offset)
    stop.setAttribute('stop-color', color)
    stop.setAttribute('stop-opacity', '1')
    g.appendChild(stop)
  }
  return g
}

async function mountFromRadial (grad: SVGRadialGradientElement): Promise<any> {
  document.body.textContent = ''
  const el = document.createElement('se-gradient-editor') as any
  el.paint = { type: 'radialGradient', alpha: 100, radialGradient: grad }
  document.body.appendChild(el)
  await customElements.whenDefined('se-gradient-editor')
  if (typeof el.updateComplete?.then === 'function') await el.updateComplete
  return el
}

describe('se-gradient-editor radial radius round-trip (#122)', () => {
  // read does round(r / 0.5 * 100); build does _radius / 100 * 0.5 -- exact
  // inverses, so an authored r that is a multiple of 0.005 returns unchanged
  // (there is no x200 corruption as the finding claimed).
  for (const r of ['0.5', '0.4', '0.25', '1']) {
    it(`preserves radius r=${r} across read -> build`, async () => {
      const el = await mountFromRadial(makeRadialGradient({ r }))
      const rebuilt = el._buildPaint().radialGradient as Element
      expect(parseFloat(rebuilt.getAttribute('r') ?? '')).toBeCloseTo(parseFloat(r), 6)
    })
  }
})

describe('se-gradient-editor radial gradientTransform round-trip (#128)', () => {
  it('preserves angle + ellipticity and re-emits the paired translate', async () => {
    // Canonical transform the editor itself emits for angle=30, ellipticity=-20
    // (sx=0.8), cx=cy=0.5: tx = -cx*(sx-1) = 0.1.
    const grad = makeRadialGradient({
      gradientTransform: 'rotate(30,0.5,0.5) translate(0.1,0) scale(0.8,1)'
    })
    const el = await mountFromRadial(grad)
    expect(el._angle).toBe(30)
    expect(el._ellipticity).toBe(-20)

    const rebuilt = el._buildPaint().radialGradient as Element
    const tf = rebuilt.getAttribute('gradientTransform') ?? ''
    expect(tf).toContain('scale(0.8,1)')
    expect(tf).toContain('translate(') // paired translate re-emitted, not dropped

    // A second round-trip reads back identically -> stable, no drift/jump.
    const el2 = await mountFromRadial(rebuilt as SVGRadialGradientElement)
    expect(el2._angle).toBe(30)
    expect(el2._ellipticity).toBe(-20)
  })

  it('preserves y-axis ellipticity (positive)', async () => {
    // ellipticity=+25 -> sy = 1 - 25/100 = 0.75; ty = -cy*(sy-1) = 0.125.
    const grad = makeRadialGradient({ gradientTransform: 'translate(0,0.125) scale(1,0.75)' })
    const el = await mountFromRadial(grad)
    expect(el._angle).toBe(0)
    expect(el._ellipticity).toBe(25)

    const rebuilt = el._buildPaint().radialGradient as Element
    const tf = rebuilt.getAttribute('gradientTransform') ?? ''
    expect(tf).toContain('scale(1,0.75)')

    const el2 = await mountFromRadial(rebuilt as SVGRadialGradientElement)
    expect(el2._ellipticity).toBe(25)
  })
})
