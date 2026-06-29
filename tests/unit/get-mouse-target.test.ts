import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

// Covers the ancestor walk in getMouseTargetMethod (selection.ts). Audit #29 perf
// finding #68: the walk dereferences parentNode with no null guard, so a target
// whose ancestor chain never reaches the current group/layer (an element in a
// non-current layer, or a detached subtree) walks off the top of the tree and
// crashes on `null.parentNode`.
describe('getMouseTarget', () => {
  let svgCanvas: ReturnType<typeof createSvgCanvasFixture>

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
    sessionStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
    sessionStorage.clear()
  })

  it('returns the svg root for a target outside the current layer instead of crashing', () => {
    // A detached subtree: orphan's ancestor chain (g → null) never reaches the
    // current layer, so the walk runs off the top of the tree.
    const detachedParent = document.createElementNS(NS.SVG, 'g')
    const orphan = document.createElementNS(NS.SVG, 'rect')
    detachedParent.append(orphan)

    expect(() => svgCanvas.getMouseTarget({ target: orphan } as unknown as MouseEvent)).not.toThrow()
    expect(svgCanvas.getMouseTarget({ target: orphan } as unknown as MouseEvent)).toBe(svgCanvas.getSvgRoot())
  })

  it('returns the element itself when it is a direct child of the current layer', () => {
    const rect = svgCanvas.addSVGElementsFromJson({
      element: 'rect',
      attr: { id: 'direct', x: 0, y: 0, width: 10, height: 10 }
    })

    expect(svgCanvas.getMouseTarget({ target: rect } as unknown as MouseEvent)).toBe(rect)
  })

  it('returns the top-level ancestor under the current layer for a nested target', () => {
    const layer = svgCanvas.getCurrentDrawing().getCurrentLayer()!
    const g = document.createElementNS(NS.SVG, 'g')
    const inner = document.createElementNS(NS.SVG, 'rect')
    g.append(inner)
    layer.append(g)

    expect(svgCanvas.getMouseTarget({ target: inner } as unknown as MouseEvent)).toBe(g)
  })
})
