import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

/**
 * Characterizes the rotation-center relocation that changeSelectedAttributeNoUndo
 * performs after a bbox-affecting attribute change on a rotated element. This is
 * the behaviour shared (and deduped) with history.ts's relocateRotationCenter.
 */
describe('changeSelectedAttributeNoUndo() rotation-center relocation', () => {
  let svgCanvas: ReturnType<typeof createSvgCanvasFixture>

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  const findRotate = (el: SVGGraphicsElement) => {
    const tlist = el.transform.baseVal
    for (let i = 0; i < tlist.numberOfItems; i++) {
      if (tlist.getItem(i).type === 4) { return tlist.getItem(i) } // SVG_TRANSFORM_ROTATE
    }
    return null
  }

  it('relocates the rotation center to the new bbox center on a bbox-affecting attr change', () => {
    const svgContent = svgCanvas.getSvgContent()
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '40')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', 'rotate(45 30 30)')
    // jsdom's getBBox is a zero stub; supply real geometry so the relocation has a
    // meaningful center (50,50).
    rect.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0, toJSON: () => ({}) })
    svgContent.append(rect)

    svgCanvas.changeSelectedAttributeNoUndo('width', 100, [rect])

    const rotate = findRotate(rect)
    const expected = svgCanvas.getSvgRoot().createSVGTransform()
    expected.setRotate(45, 50, 50)
    expect(rotate).not.toBeNull()
    expect(rotate!.angle).toBe(45)
    expect(rotate!.matrix.e).toBeCloseTo(expected.matrix.e, 4)
    expect(rotate!.matrix.f).toBeCloseTo(expected.matrix.f, 4)
  })

  it('leaves the rotation transform untouched for a non-bbox-affecting attr', () => {
    const svgContent = svgCanvas.getSvgContent()
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '40')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', 'rotate(45 30 30)')
    svgContent.append(rect)

    svgCanvas.changeSelectedAttributeNoUndo('fill', '#0f0', [rect])

    const rotate = findRotate(rect)
    const expected = svgCanvas.getSvgRoot().createSVGTransform()
    expected.setRotate(45, 30, 30)
    expect(rotate!.angle).toBe(45)
    expect(rotate!.matrix.e).toBeCloseTo(expected.matrix.e, 4)
    expect(rotate!.matrix.f).toBeCloseTo(expected.matrix.f, 4)
    expect(rect.getAttribute('fill')).toBe('#0f0')
  })
})
