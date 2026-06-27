import { vi } from 'vitest'
import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

// Audit #29 perf finding #63: Selector.resize() created a throwaway <svg>
// element on every call purely to obtain an identity SVGMatrix via
// createSVGMatrix(). resize() runs per resize-drag tick, so that's an SVG
// element allocated per tick. The identity matrix can come from the existing
// root <svg> instead.
describe('Selector.resize', () => {
  let svgCanvas

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
    sessionStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('does not allocate a throwaway <svg> element on each resize (#63)', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: { id: 'r', x: 10, y: 10, width: 40, height: 30 }
    })
    svgCanvas.selectOnly([rect], true)
    const selector = svgCanvas.selectorManager.requestSelector(rect)

    const spy = vi.spyOn(document, 'createElementNS')
    selector.resize()
    const svgElementsCreated = spy.mock.calls.filter((c) => c[1] === 'svg').length

    expect(svgElementsCreated).toBe(0)
  })
})
