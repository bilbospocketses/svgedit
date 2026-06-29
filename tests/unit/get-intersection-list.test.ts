import { vi } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

// Regression guard for audit #29 perf finding #64. The finding claimed
// getIntersectionList does a per-element bbox "reflow" on every rubber-band
// tick. It does not: it builds the visible-element bbox list once (when the
// curBBoxes cache is empty) and reuses it on subsequent calls within the same
// rubber-band session (the cache is cleared on mouseUp). This pins that
// build-once/reuse behaviour so it can't silently regress to a per-tick rebuild.
describe('getIntersectionList', () => {
  let svgCanvas: ReturnType<typeof createSvgCanvasFixture>

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
    sessionStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('builds the element bbox cache once and reuses it across calls (#64)', () => {
    svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'a', x: 0, y: 0, width: 20, height: 20 } })
    svgCanvas.addSVGElementsFromJson({ element: 'rect', attr: { id: 'b', x: 30, y: 0, width: 20, height: 20 } })
    // getIntersectionList returns null without a rubber-band box.
    svgCanvas.setRubberBox(document.createElementNS(NS.SVG, 'rect'))
    svgCanvas.setCurBBoxes([])

    const spy = vi.spyOn(svgCanvas, 'setCurBBoxes')
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    svgCanvas.getIntersectionList(rect)
    svgCanvas.getIntersectionList(rect)
    svgCanvas.getIntersectionList(rect)

    // The bbox cache is populated once on the first call and reused thereafter
    // (rebuilding would call setCurBBoxes again).
    expect(spy).toHaveBeenCalledTimes(1)
    // Non-empty cache: had it been left empty, every call would rebuild it
    // (setCurBBoxes would be called more than once).
    expect(svgCanvas.getCurBBoxes().length).toBeGreaterThan(0)
  })
})
