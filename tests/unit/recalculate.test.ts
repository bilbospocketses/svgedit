import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as utilities from '../../packages/svgcanvas/core/utilities.js'
import * as coords from '../../packages/svgcanvas/core/coords.js'
import * as recalculate from '../../packages/svgcanvas/core/recalculate.js'

/**
 * jsdom does not implement the `.points` SVGPointList on polyline/polygon, so
 * `recalculateDimensions` throws when it reads `selected.points.numberOfItems`.
 * Snapshot the current `points` attribute into a minimal mock so the real remap
 * path runs under test (production code is exercised; only the jsdom-missing DOM
 * API is supplied).
 */
const mockPoints = (el: Element): void => {
  const pts = (el.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    return { x, y }
  })
  Object.defineProperty(el, 'points', {
    configurable: true,
    value: { numberOfItems: pts.length, getItem: (i: number) => pts[i] }
  })
}

describe('recalculate', function () {
  const root = document.createElement('div')
  root.id = 'root'
  root.style.visibility = 'hidden'

  const svgroot = document.createElementNS(NS.SVG, 'svg')
  svgroot.id = 'svgroot'
  root.append(svgroot)
  const svg = document.createElementNS(NS.SVG, 'svg')
  svgroot.append(svg)

  const dataStorage = {
    _storage: new WeakMap(),
    put: function (element, key, obj) {
      if (!this._storage.has(element)) {
        this._storage.set(element, new Map())
      }
      this._storage.get(element).set(key, obj)
    },
    get: function (element, key) {
      return this._storage.get(element).get(key)
    },
    has: function (element, key) {
      return this._storage.has(element) && this._storage.get(element).has(key)
    },
    remove: function (element, key) {
      const ret = this._storage.get(element).delete(key)
      if (this._storage.get(element).size === 0) {
        this._storage.delete(element)
      }
      return ret
    }
  }

  let elemId = 1

  /**
   * Initilize modules to set up the tests.
   * @returns {void}
   */
  function setUp () {
    utilities.init(
      /**
      * @implements {module:utilities.EditorContext}
      */
      {
        getSvgRoot () { return svg },
        getDOMDocument () { return null },
        getDOMContainer () { return null },
        getDataStorage () { return dataStorage }
      }
    )
    coords.init(
      /**
      * @implements {module:coords.EditorContext}
      */
      {
        getGridSnapping () { return false },
        getDrawing () {
          return {
            getNextId () { return String(elemId++) }
          }
        },
        getDataStorage () { return dataStorage }
      }
    )
    recalculate.init(
      /**
      * @implements {module:recalculate.EditorContext}
      */
      {
        getSvgRoot () { return svg },
        getStartTransform () { return '' },
        setStartTransform () { /* empty fn */ },
        getDataStorage () { return dataStorage }
      }
    )
  }

  let elem

  /**
   * Initialize for tests and set up `rect` element.
   * @returns {void}
   */
  function setUpRect () {
    setUp()
    elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('x', '200')
    elem.setAttribute('y', '150')
    elem.setAttribute('width', '250')
    elem.setAttribute('height', '120')
    svg.append(elem)
  }

  /**
   * Initialize for tests and set up `text` element with `tspan` child.
   * @returns {void}
   */
  function setUpTextWithTspan () {
    setUp()
    elem = document.createElementNS(NS.SVG, 'text')
    elem.setAttribute('x', '200')
    elem.setAttribute('y', '150')

    const tspan = document.createElementNS(NS.SVG, 'tspan')
    tspan.setAttribute('x', '200')
    tspan.setAttribute('y', '150')

    const theText = 'Foo bar'
    tspan.append(theText)
    elem.append(tspan)
    svg.append(elem)
  }

  /**
   * Initialize for tests and set up a `g` element with a `rect` child.
   * @returns {SVGRectElement}
   */
  function setUpGroupWithRect () {
    setUp()
    elem = document.createElementNS(NS.SVG, 'g')

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '200')
    rect.setAttribute('y', '150')
    rect.setAttribute('width', '250')
    rect.setAttribute('height', '120')

    elem.append(rect)
    svg.append(elem)
    return rect
  }

  /**
   * Tear down the tests (empty the svg element).
   * @returns {void}
   */
  afterEach(() => {
    while (svg.hasChildNodes()) {
      svg.firstChild.remove()
    }
  })

  it('Test recalculateDimensions() on rect with identity matrix', function () {
    setUpRect()
    elem.setAttribute('transform', 'matrix(1,0,0,1,0,0)')

    recalculate.recalculateDimensions(elem)

    // Ensure that the identity matrix is swallowed and the element has no
    // transform on it.
    assert.equal(elem.hasAttribute('transform'), false)
  })

  it('Test recalculateDimensions() on rect with simple translate', function () {
    setUpRect()
    elem.setAttribute('transform', 'translate(100,50)')

    recalculate.recalculateDimensions(elem)

    assert.equal(elem.hasAttribute('transform'), false)
    assert.equal(elem.getAttribute('x'), '300')
    assert.equal(elem.getAttribute('y'), '200')
    assert.equal(elem.getAttribute('width'), '250')
    assert.equal(elem.getAttribute('height'), '120')
  })

  it('Test recalculateDimensions() on text w/tspan with simple translate', function () {
    setUpTextWithTspan()
    elem.setAttribute('transform', 'translate(100,50)')

    recalculate.recalculateDimensions(elem)

    // Ensure that the identity matrix is swallowed and the element has no
    // transform on it.
    assert.equal(elem.hasAttribute('transform'), false)
    assert.equal(elem.getAttribute('x'), '300')
    assert.equal(elem.getAttribute('y'), '200')

    const tspan = elem.firstElementChild
    assert.equal(tspan.getAttribute('x'), '300')
    assert.equal(tspan.getAttribute('y'), '200')
  })

  it('Test recalculateDimensions() on group with simple translate', function () {
    const rect = setUpGroupWithRect()
    elem.setAttribute('transform', 'translate(100,50)')

    recalculate.recalculateDimensions(elem)

    // Groups should preserve their transforms, not flatten them into children
    assert.equal(elem.hasAttribute('transform'), true)
    assert.equal(elem.getAttribute('transform'), 'translate(100,50)')
    assert.equal(rect.hasAttribute('transform'), false)
    assert.equal(rect.getAttribute('x'), '200')
    assert.equal(rect.getAttribute('y'), '150')
    assert.equal(rect.getAttribute('width'), '250')
    assert.equal(rect.getAttribute('height'), '120')
  })

  it('Test recalculateDimensions() on group with simple scale', function () {
    const rect = setUpGroupWithRect()
    elem.setAttribute('transform', 'translate(10,20) scale(2) translate(-10,-20)')

    recalculate.recalculateDimensions(elem)

    // Groups should preserve their transforms, not flatten them into children
    assert.equal(elem.hasAttribute('transform'), true)
    assert.equal(elem.getAttribute('transform'), 'translate(10,20) scale(2) translate(-10,-20)')
    assert.equal(rect.hasAttribute('transform'), false)
    assert.equal(rect.getAttribute('x'), '200')
    assert.equal(rect.getAttribute('y'), '150')
    assert.equal(rect.getAttribute('width'), '250')
    assert.equal(rect.getAttribute('height'), '120')
  })

  // TODO: Since recalculateDimensions() and surrounding code is
  // probably the largest, most complicated and strange piece of
  // code in SVG-edit, we need to write a whole lot of unit tests
  // for it here.

  it('updateClipPath() skips empty clipPaths safely', () => {
    setUp()
    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'clip-empty'
    svg.append(clipPath)

    // Should not throw when clipPath has no children.
    recalculate.updateClipPath('url(#clip-empty)', 5, 5)
  })

  it('updateClipPath() appends translate to path child when present', () => {
    setUp()
    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'clip-path'
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '5')
    rect.setAttribute('height', '5')
    clipPath.append(rect)
    svg.append(clipPath)

    recalculate.updateClipPath('url(#clip-path)', 2, -3)

    assert.equal(rect.getAttribute('x'), '2')
    assert.equal(rect.getAttribute('y'), '-3')
    assert.equal(rect.transform.baseVal.numberOfItems, 0)
  })

  it('updateClipPath() shifts circle clipPath geometry', () => {
    setUp()
    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'clip-circle'
    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '4')
    circle.setAttribute('cy', '5')
    circle.setAttribute('r', '2')
    clipPath.append(circle)
    svg.append(clipPath)

    recalculate.updateClipPath('url(#clip-circle)', -1, 3)

    assert.equal(circle.getAttribute('cx'), '3')
    assert.equal(circle.getAttribute('cy'), '8')
    assert.equal(circle.transform.baseVal.numberOfItems, 0)
  })

  it('updateClipPath() shifts polyline points', () => {
    setUp()
    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'clip-poly'
    const poly = document.createElementNS(NS.SVG, 'polyline')
    poly.setAttribute('points', '0,0 2,0 2,2')
    clipPath.append(poly)
    svg.append(clipPath)

    recalculate.updateClipPath('url(#clip-poly)', 3, -2)

    assert.equal(poly.getAttribute('points'), '3,-2 5,-2 5,0')
  })

  it('updateClipPath() shifts polygon points', () => {
    setUp()
    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'clip-polygon'
    const poly = document.createElementNS(NS.SVG, 'polygon')
    poly.setAttribute('points', '1,1 4,1 4,5')
    clipPath.append(poly)
    svg.append(clipPath)

    recalculate.updateClipPath('url(#clip-polygon)', -1, 2)

    assert.equal(poly.getAttribute('points'), '0,3 3,3 3,7')
  })

  // Tests for circle element with scale transform
  it('recalculateDimensions() handles circle with scale transform', () => {
    setUp()

    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '20')
    circle.setAttribute('transform', 'translate(-25,-25) scale(2,2) translate(25,25)')
    svg.append(circle)

    const cmd = recalculate.recalculateDimensions(circle)

    // scale(2) about (25,25): (50,50) -> (125,125), r 20 -> 40; transform baked away.
    assert.ok(cmd)
    assert.equal(circle.getAttribute('cx'), '125')
    assert.equal(circle.getAttribute('cy'), '125')
    assert.equal(circle.getAttribute('r'), '40')
    assert.equal(circle.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles circle with translate transform', () => {
    setUp()

    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '20')
    circle.setAttribute('transform', 'translate(10,20)')
    svg.append(circle)

    const cmd = recalculate.recalculateDimensions(circle)

    assert.equal(Number.parseFloat(circle.getAttribute('cx')), 60)
    assert.equal(Number.parseFloat(circle.getAttribute('cy')), 70)
    assert.ok(cmd)
  })

  // Tests for ellipse element
  it('recalculateDimensions() handles ellipse with scale transform', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '30')
    ellipse.setAttribute('ry', '20')
    ellipse.setAttribute('transform', 'translate(-50,-50) scale(2,3) translate(50,50)')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)

    // scale(2,3) about (50,50): center -> (150,250), rx 30->60, ry 20->60; transform baked away.
    assert.ok(cmd)
    assert.equal(ellipse.getAttribute('cx'), '150')
    assert.equal(ellipse.getAttribute('cy'), '250')
    assert.equal(ellipse.getAttribute('rx'), '60')
    assert.equal(ellipse.getAttribute('ry'), '60')
    assert.equal(ellipse.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles ellipse with translate transform', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '30')
    ellipse.setAttribute('ry', '20')
    ellipse.setAttribute('transform', 'translate(15,25)')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)

    assert.equal(Number.parseFloat(ellipse.getAttribute('cx')), 65)
    assert.equal(Number.parseFloat(ellipse.getAttribute('cy')), 75)
    assert.ok(cmd)
  })

  // Tests for line element
  it('recalculateDimensions() handles line with scale transform', () => {
    setUp()

    const line = document.createElementNS(NS.SVG, 'line')
    line.setAttribute('x1', '10')
    line.setAttribute('y1', '10')
    line.setAttribute('x2', '50')
    line.setAttribute('y2', '50')
    line.setAttribute('transform', 'translate(-10,-10) scale(2,2) translate(10,10)')
    svg.append(line)

    const cmd = recalculate.recalculateDimensions(line)

    // scale(2) about (10,10): (10,10)->(30,30), (50,50)->(110,110); transform baked away.
    assert.ok(cmd)
    assert.equal(line.getAttribute('x1'), '30')
    assert.equal(line.getAttribute('y1'), '30')
    assert.equal(line.getAttribute('x2'), '110')
    assert.equal(line.getAttribute('y2'), '110')
    assert.equal(line.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles line with translate transform', () => {
    setUp()

    const line = document.createElementNS(NS.SVG, 'line')
    line.setAttribute('x1', '10')
    line.setAttribute('y1', '10')
    line.setAttribute('x2', '50')
    line.setAttribute('y2', '50')
    line.setAttribute('transform', 'translate(5,15)')
    svg.append(line)

    const cmd = recalculate.recalculateDimensions(line)

    assert.equal(Number.parseFloat(line.getAttribute('x1')), 15)
    assert.equal(Number.parseFloat(line.getAttribute('y1')), 25)
    assert.equal(Number.parseFloat(line.getAttribute('x2')), 55)
    assert.equal(Number.parseFloat(line.getAttribute('y2')), 65)
    assert.ok(cmd)
  })

  it('recalculateDimensions() handles line with matrix transform', () => {
    setUp()

    const line = document.createElementNS(NS.SVG, 'line')
    line.setAttribute('x1', '10')
    line.setAttribute('y1', '10')
    line.setAttribute('x2', '50')
    line.setAttribute('y2', '50')
    line.setAttribute('transform', 'matrix(1,0,0,1,10,20)')
    svg.append(line)

    const cmd = recalculate.recalculateDimensions(line)

    assert.equal(Number.parseFloat(line.getAttribute('x1')), 20)
    assert.equal(Number.parseFloat(line.getAttribute('y1')), 30)
    assert.equal(Number.parseFloat(line.getAttribute('x2')), 60)
    assert.equal(Number.parseFloat(line.getAttribute('y2')), 70)
    assert.ok(cmd)
  })

  // Tests for polyline element
  it('recalculateDimensions() handles polyline with scale transform', () => {
    setUp()

    const polyline = document.createElementNS(NS.SVG, 'polyline')
    polyline.setAttribute('points', '10,10 20,20 30,10 40,20')
    polyline.setAttribute('transform', 'translate(-10,-10) scale(2,2) translate(10,10)')
    svg.append(polyline)

    mockPoints(polyline)
    recalculate.recalculateDimensions(polyline)
    // scale(2) about (10,10): each (x,y) -> (2x+10, 2y+10)
    assert.equal(polyline.getAttribute('points'), '30,30 50,50 70,30 90,50')
  })

  it('recalculateDimensions() handles polyline with translate transform', () => {
    setUp()

    const polyline = document.createElementNS(NS.SVG, 'polyline')
    polyline.setAttribute('points', '10,10 20,20 30,10')
    polyline.setAttribute('transform', 'translate(5,10)')
    svg.append(polyline)

    mockPoints(polyline)
    recalculate.recalculateDimensions(polyline)
    assert.equal(polyline.getAttribute('points'), '15,20 25,30 35,20')
  })

  // Tests for polygon element
  it('recalculateDimensions() handles polygon with translate transform', () => {
    setUp()

    const polygon = document.createElementNS(NS.SVG, 'polygon')
    polygon.setAttribute('points', '10,10 20,10 15,20')
    polygon.setAttribute('transform', 'translate(10,15)')
    svg.append(polygon)

    mockPoints(polygon)
    recalculate.recalculateDimensions(polygon)
    assert.equal(polygon.getAttribute('points'), '20,25 30,25 25,35')
  })

  // Tests for path element
  it('recalculateDimensions() handles path with scale transform', () => {
    setUp()

    const path = document.createElementNS(NS.SVG, 'path')
    path.setAttribute('d', 'M 10,10 L 20,20 L 30,10 Z')
    path.setAttribute('transform', 'translate(-10,-10) scale(2,2) translate(10,10)')
    svg.append(path)

    const cmd = recalculate.recalculateDimensions(path)

    // scale(2) about (10,10) baked into the path data; transform removed.
    assert.ok(cmd)
    assert.equal(path.getAttribute('d'), 'M30,30 L50,50 L70,30 z')
    assert.equal(path.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles path with translate transform', () => {
    setUp()

    const path = document.createElementNS(NS.SVG, 'path')
    path.setAttribute('d', 'M 10,10 L 20,20 L 30,10 Z')
    path.setAttribute('transform', 'translate(5,10)')
    svg.append(path)

    const cmd = recalculate.recalculateDimensions(path)

    assert.ok(cmd)
    // Path should have transform removed and translate(5,10) baked into coordinates
    assert.equal(path.hasAttribute('transform'), false)
    assert.equal(path.getAttribute('d'), 'M15,20 L25,30 L35,20 z')
  })

  // Tests for image element
  it('recalculateDimensions() handles image with rotation', () => {
    setUp()

    const image = document.createElementNS(NS.SVG, 'image')
    image.setAttribute('x', '10')
    image.setAttribute('y', '10')
    image.setAttribute('width', '100')
    image.setAttribute('height', '80')
    image.setAttribute('transform', 'rotate(45,60,50)')
    svg.append(image)

    const cmd = recalculate.recalculateDimensions(image)

    // Rotation should be preserved
    assert.ok(image.getAttribute('transform').includes('rotate'))
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles image with scale transform', () => {
    setUp()

    const image = document.createElementNS(NS.SVG, 'image')
    image.setAttribute('x', '10')
    image.setAttribute('y', '10')
    image.setAttribute('width', '100')
    image.setAttribute('height', '80')
    image.setAttribute('transform', 'translate(-60,-50) scale(2,2) translate(60,50)')
    svg.append(image)

    const cmd = recalculate.recalculateDimensions(image)

    assert.ok(Math.abs(Number.parseFloat(image.getAttribute('width')) - 200) < 1)
    assert.ok(Math.abs(Number.parseFloat(image.getAttribute('height')) - 160) < 1)
    assert.ok(cmd)
  })

  // Tests for text element with rotation
  it('recalculateDimensions() handles text with rotation', () => {
    setUp()

    const text = document.createElementNS(NS.SVG, 'text')
    text.setAttribute('x', '50')
    text.setAttribute('y', '50')
    text.textContent = 'Test'
    text.setAttribute('transform', 'rotate(45,50,50)')
    svg.append(text)

    const cmd = recalculate.recalculateDimensions(text)

    // Rotation should be preserved
    assert.ok(text.getAttribute('transform').includes('rotate'))
    assert.equal(cmd, null)
  })

  // Tests for use element
  it('recalculateDimensions() handles use element with translate', () => {
    setUp()

    const use = document.createElementNS(NS.SVG, 'use')
    use.setAttribute('x', '10')
    use.setAttribute('y', '10')
    use.setAttribute('href', '#someId')
    use.setAttribute('transform', 'translate(5,10)')
    svg.append(use)

    const cmd = recalculate.recalculateDimensions(use)

    // Use elements return null to preserve referenced positioning
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles use element with scale', () => {
    setUp()

    const use = document.createElementNS(NS.SVG, 'use')
    use.setAttribute('x', '10')
    use.setAttribute('y', '10')
    use.setAttribute('href', '#someId')
    use.setAttribute('transform', 'translate(-10,-10) scale(2,2) translate(10,10)')
    svg.append(use)

    const cmd = recalculate.recalculateDimensions(use)

    // Use elements return null to preserve referenced positioning
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles use element with matrix (returns null)', () => {
    setUp()

    const use = document.createElementNS(NS.SVG, 'use')
    use.setAttribute('x', '10')
    use.setAttribute('y', '10')
    use.setAttribute('href', '#someId')
    use.setAttribute('transform', 'matrix(2,0,0,2,5,5)')
    svg.append(use)

    const cmd = recalculate.recalculateDimensions(use)

    // <use> is short-circuited to null up front so referenced geometry is
    // preserved; the transform is left intact (exercises the path the now-dead
    // per-branch <use> matrix handling used to sit on).
    assert.equal(cmd, null)
    assert.equal(use.hasAttribute('transform'), true)
  })

  // Tests for group with rotation
  it('recalculateDimensions() handles group with rotation and translate', () => {
    setUpGroupWithRect()

    elem.setAttribute('transform', 'rotate(45,35,25) translate(10,20)')

    const cmd = recalculate.recalculateDimensions(elem)

    // Groups return null per line 146 - transforms stay on the group
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles group with matrix transform', () => {
    const rect = setUpGroupWithRect()

    elem.setAttribute('transform', 'matrix(1,0,0,1,10,20)')

    const cmd = recalculate.recalculateDimensions(elem)

    // Groups return null per line 146 - transforms stay on the group
    assert.equal(cmd, null)
    // Child rect should be unchanged
    assert.ok(rect !== null)
  })

  it('recalculateDimensions() handles group scale with multiple children', () => {
    const rect1 = setUpGroupWithRect()

    rect1.setAttribute('x', '10')
    rect1.setAttribute('y', '10')
    rect1.setAttribute('width', '20')
    rect1.setAttribute('height', '20')

    const rect2 = document.createElementNS(NS.SVG, 'rect')
    rect2.setAttribute('x', '50')
    rect2.setAttribute('y', '50')
    rect2.setAttribute('width', '30')
    rect2.setAttribute('height', '30')
    elem.append(rect2)

    elem.setAttribute('transform', 'translate(-35,-35) scale(2,2) translate(35,35)')

    const cmd = recalculate.recalculateDimensions(elem)

    // Groups return null per line 146 - transforms stay on the group
    assert.equal(cmd, null)
    assert.equal(elem.hasAttribute('transform'), true)
  })

  // Tests for clip-path handling in groups
  it('recalculateDimensions() handles group with clip-path during translate', () => {
    const rect = setUpGroupWithRect()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'testClip'
    const clipRect = document.createElementNS(NS.SVG, 'rect')
    clipRect.setAttribute('x', '0')
    clipRect.setAttribute('y', '0')
    clipRect.setAttribute('width', '100')
    clipRect.setAttribute('height', '100')
    clipPath.append(clipRect)
    svg.append(clipPath)

    elem.setAttribute('clip-path', 'url(#testClip)')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '30')
    elem.setAttribute('transform', 'translate(10,20)')

    const cmd = recalculate.recalculateDimensions(elem)

    // Groups return null per line 146
    assert.equal(cmd, null)
    assert.equal(elem.hasAttribute('transform'), true)
  })

  it('recalculateDimensions() handles child with clip-path in translated group', () => {
    const rect = setUpGroupWithRect()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'childClip'
    const clipRect = document.createElementNS(NS.SVG, 'rect')
    clipRect.setAttribute('x', '0')
    clipRect.setAttribute('y', '0')
    clipRect.setAttribute('width', '50')
    clipRect.setAttribute('height', '50')
    clipPath.append(clipRect)
    svg.append(clipPath)

    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '30')
    rect.setAttribute('height', '30')
    rect.setAttribute('clip-path', 'url(#childClip)')
    elem.setAttribute('transform', 'translate(5,10)')

    const cmd = recalculate.recalculateDimensions(elem)

    // Groups return null per line 146
    assert.equal(cmd, null)
    assert.ok(rect !== null)
  })

  // Edge case tests
  it('recalculateDimensions() returns null for element without bounding box', () => {
    setUp()

    const defs = document.createElementNS(NS.SVG, 'defs')
    defs.setAttribute('transform', 'translate(10,20)')
    svg.append(defs)

    const cmd = recalculate.recalculateDimensions(defs)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() returns null for element with no transforms', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '30')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() returns null for group with only rotation', () => {
    const rect = setUpGroupWithRect()

    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '30')
    elem.setAttribute('transform', 'rotate(45,35,25)')

    const cmd = recalculate.recalculateDimensions(elem)

    // Group with only rotation returns null
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles foreignObject with scale', () => {
    setUp()

    const foreignObject = document.createElementNS(NS.SVG, 'foreignObject')
    foreignObject.setAttribute('x', '10')
    foreignObject.setAttribute('y', '10')
    foreignObject.setAttribute('width', '100')
    foreignObject.setAttribute('height', '80')
    foreignObject.setAttribute('transform', 'translate(-60,-50) scale(2,2) translate(60,50)')
    svg.append(foreignObject)

    const cmd = recalculate.recalculateDimensions(foreignObject)

    assert.ok(Math.abs(Number.parseFloat(foreignObject.getAttribute('width')) - 200) < 1)
    assert.ok(Math.abs(Number.parseFloat(foreignObject.getAttribute('height')) - 160) < 1)
    assert.ok(cmd)
  })

  // Additional edge case tests for more branch coverage
  it('recalculateDimensions() handles rect with zero translation', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '30')
    rect.setAttribute('transform', 'translate(0,0)')
    svg.append(rect)

    recalculate.recalculateDimensions(rect)

    // Zero translation should be removed
    assert.equal(rect.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles circle with rotation and translate', () => {
    setUp()

    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '20')
    circle.setAttribute('transform', 'rotate(45,50,50) translate(10,20)')
    svg.append(circle)

    const cmd = recalculate.recalculateDimensions(circle)

    // Rotation is peeled off, leaving translate(10,20) which bakes into cx/cy
    // (50->60, 50->70); radius unchanged. A command is produced.
    assert.ok(cmd)
    assert.equal(circle.getAttribute('cx'), '60')
    assert.equal(circle.getAttribute('cy'), '70')
    assert.equal(circle.getAttribute('r'), '20')
  })

  it('recalculateDimensions() handles ellipse with rotation', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '30')
    ellipse.setAttribute('ry', '20')
    ellipse.setAttribute('transform', 'rotate(45,50,50)')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)

    // Rotation only returns null
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles rect with combined transforms', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '30')
    rect.setAttribute('transform', 'translate(5,10) scale(1.5,1.5)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    // 'translate scale' (no trailing translate) is not a form recalc bakes in:
    // it is left untouched (no-op) and returns null.
    assert.equal(cmd, null)
    assert.equal(rect.getAttribute('transform'), 'translate(5,10) scale(1.5,1.5)')
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '10')
    assert.equal(rect.getAttribute('width'), '50')
    assert.equal(rect.getAttribute('height'), '30')
  })

  it('recalculateDimensions() handles tspan', () => {
    setUp()

    const text = document.createElementNS(NS.SVG, 'text')
    text.setAttribute('x', '50')
    text.setAttribute('y', '50')
    const tspan = document.createElementNS(NS.SVG, 'tspan')
    tspan.setAttribute('x', '50')
    tspan.setAttribute('y', '60')
    tspan.textContent = 'Test'
    text.append(tspan)
    svg.append(text)
    tspan.setAttribute('transform', 'translate(10,10)')

    const cmd = recalculate.recalculateDimensions(tspan)

    // translate(10,10) baked into tspan x/y (50->60, 60->70); transform removed.
    assert.ok(cmd)
    assert.equal(tspan.getAttribute('x'), '60')
    assert.equal(tspan.getAttribute('y'), '70')
    assert.equal(tspan.hasAttribute('transform'), false)
  })

  it('updateClipPath() with empty clip-path reference', () => {
    setUp()

    // A clip-path URL with no matching clipPath element returns undefined.
    const result = recalculate.updateClipPath('url(#nonexistent)', 5, 10)
    assert.equal(result, undefined)
  })

  it('recalculateDimensions() handles path with zero-degree rotation', () => {
    setUp()

    const path = document.createElementNS(NS.SVG, 'path')
    path.setAttribute('d', 'M 10,10 L 20,20')
    path.setAttribute('transform', 'rotate(0)')
    svg.append(path)

    recalculate.recalculateDimensions(path)

    // Zero-degree rotation should be removed
    assert.equal(path.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles element with clip-path attribute', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.id = 'testClip2'
    svg.append(clipPath)

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('clip-path', 'url(#testClip2)')
    rect.setAttribute('width', '100')
    rect.setAttribute('height', '100')
    rect.setAttribute('transform', 'translate(10,10)')
    svg.append(rect)

    const innerRect = document.createElementNS(NS.SVG, 'rect')
    innerRect.setAttribute('clip-path', 'url(#testClip2)')
    innerRect.setAttribute('width', '50')
    innerRect.setAttribute('height', '50')
    rect.append(innerRect)

    const cmd = recalculate.recalculateDimensions(rect)

    // Element with nested clip-paths should return null
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles image with translate', () => {
    setUp()

    const image = document.createElementNS(NS.SVG, 'image')
    image.setAttribute('x', '10')
    image.setAttribute('y', '10')
    image.setAttribute('width', '100')
    image.setAttribute('height', '80')
    image.setAttribute('transform', 'translate(20,30)')
    svg.append(image)

    const cmd = recalculate.recalculateDimensions(image)

    // translate(20,30) baked into x/y (10->30, 10->40); size unchanged; transform removed.
    assert.ok(cmd)
    assert.equal(image.getAttribute('x'), '30')
    assert.equal(image.getAttribute('y'), '40')
    assert.equal(image.getAttribute('width'), '100')
    assert.equal(image.getAttribute('height'), '80')
    assert.equal(image.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() removes identity matrix transform', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    rect.setAttribute('transform', 'matrix(1,0,0,1,0,0)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    // Identity matrix should be removed and return null
    assert.equal(cmd, null)
    assert.equal(rect.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles scale transform', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    rect.setAttribute('transform', 'scale(2)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    // A bare scale() (not wrapped in translate...translate) is left untouched
    // and returns null; geometry and transform are unchanged.
    assert.equal(cmd, null)
    assert.equal(rect.getAttribute('transform'), 'scale(2)')
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '10')
    assert.equal(rect.getAttribute('width'), '50')
    assert.equal(rect.getAttribute('height'), '50')
  })

  it('recalculateDimensions() handles multiple transforms', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    rect.setAttribute('transform', 'translate(5,5) scale(1.5)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    // 'translate scale' (no trailing translate) is not a bake-in form: no-op, null.
    assert.equal(cmd, null)
    assert.equal(rect.getAttribute('transform'), 'translate(5,5) scale(1.5)')
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '10')
    assert.equal(rect.getAttribute('width'), '50')
    assert.equal(rect.getAttribute('height'), '50')
  })

  it('recalculateDimensions() handles ellipse with scale', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '30')
    ellipse.setAttribute('ry', '20')
    ellipse.setAttribute('transform', 'scale(1.5)')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)

    // A bare scale() is left untouched and returns null.
    assert.equal(cmd, null)
    assert.equal(ellipse.getAttribute('transform'), 'scale(1.5)')
    assert.equal(ellipse.getAttribute('cx'), '50')
    assert.equal(ellipse.getAttribute('cy'), '50')
    assert.equal(ellipse.getAttribute('rx'), '30')
    assert.equal(ellipse.getAttribute('ry'), '20')
  })

  it('recalculateDimensions() handles line with transform', () => {
    setUp()

    const line = document.createElementNS(NS.SVG, 'line')
    line.setAttribute('x1', '0')
    line.setAttribute('y1', '0')
    line.setAttribute('x2', '100')
    line.setAttribute('y2', '100')
    line.setAttribute('transform', 'translate(10,10)')
    svg.append(line)

    const cmd = recalculate.recalculateDimensions(line)

    // translate(10,10) baked into endpoints; transform removed.
    assert.ok(cmd)
    assert.equal(line.getAttribute('x1'), '10')
    assert.equal(line.getAttribute('y1'), '10')
    assert.equal(line.getAttribute('x2'), '110')
    assert.equal(line.getAttribute('y2'), '110')
    assert.equal(line.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles use element (should return null)', () => {
    setUp()

    const use = document.createElementNS(NS.SVG, 'use')
    use.setAttribute('x', '10')
    use.setAttribute('y', '10')
    use.setAttribute('transform', 'translate(20,30)')
    svg.append(use)

    const cmd = recalculate.recalculateDimensions(use)

    // use elements should preserve transforms
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles foreignObject', () => {
    setUp()

    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    fo.setAttribute('x', '10')
    fo.setAttribute('y', '10')
    fo.setAttribute('width', '100')
    fo.setAttribute('height', '100')
    fo.setAttribute('transform', 'translate(5,5)')
    svg.append(fo)

    const cmd = recalculate.recalculateDimensions(fo)

    // translate(5,5) baked into x/y (10->15); size unchanged; transform removed.
    assert.ok(cmd)
    assert.equal(fo.getAttribute('x'), '15')
    assert.equal(fo.getAttribute('y'), '15')
    assert.equal(fo.getAttribute('width'), '100')
    assert.equal(fo.getAttribute('height'), '100')
    assert.equal(fo.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles text element', () => {
    setUp()

    const text = document.createElementNS(NS.SVG, 'text')
    text.setAttribute('x', '10')
    text.setAttribute('y', '10')
    text.textContent = 'Test'
    text.setAttribute('transform', 'translate(5,5)')
    svg.append(text)

    const cmd = recalculate.recalculateDimensions(text)

    // translate(5,5) baked into text x/y (10->15); transform removed.
    assert.ok(cmd)
    assert.equal(text.getAttribute('x'), '15')
    assert.equal(text.getAttribute('y'), '15')
    assert.equal(text.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() with matrix and rotation transforms', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    rect.setAttribute('transform', 'matrix(1,0,0,1,10,10) rotate(45 35 35)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    // Should return null for matrix + rotation
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles group with rotation', () => {
    setUp()

    const g = document.createElementNS(NS.SVG, 'g')
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    g.append(rect)
    g.setAttribute('transform', 'rotate(45 35 35)')
    svg.append(g)

    const cmd = recalculate.recalculateDimensions(g)

    // Groups always return null - transforms stay on the group element
    assert.equal(cmd, null)
    assert.equal(g.getAttribute('transform'), 'rotate(45 35 35)')
  })

  it('recalculateDimensions() handles anchor tag with transform', () => {
    setUp()

    const a = document.createElementNS(NS.SVG, 'a')
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    a.append(rect)
    a.setAttribute('transform', 'translate(10,10)')
    svg.append(a)

    const cmd = recalculate.recalculateDimensions(a)

    // Anchor (<a>) is treated like a group - returns null, transform preserved
    assert.equal(cmd, null)
    assert.equal(a.getAttribute('transform'), 'translate(10,10)')
  })

  it('recalculateDimensions() handles polyline with identity transform', () => {
    setUp()

    const polyline = document.createElementNS(NS.SVG, 'polyline')
    polyline.setAttribute('points', '0,0 10,10 20,0')
    polyline.setAttribute('transform', 'matrix(1,0,0,1,0,0)')
    svg.append(polyline)

    const cmd = recalculate.recalculateDimensions(polyline)

    // Identity matrix should be removed
    assert.equal(cmd, null)
    assert.equal(polyline.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles polygon with scale', () => {
    setUp()

    const polygon = document.createElementNS(NS.SVG, 'polygon')
    polygon.setAttribute('points', '0,0 10,0 5,10')
    polygon.setAttribute('transform', 'scale(2)')
    svg.append(polygon)

    mockPoints(polygon)
    const cmd = recalculate.recalculateDimensions(polygon)
    // A bare scale() on a polygon is not a bake-in form: no-op, returns null,
    // points and transform left unchanged.
    assert.equal(cmd, null)
    assert.equal(polygon.getAttribute('points'), '0,0 10,0 5,10')
    assert.equal(polygon.getAttribute('transform'), 'scale(2)')
  })

  it('recalculateDimensions() handles path with complex transform chain', () => {
    setUp()

    const path = document.createElementNS(NS.SVG, 'path')
    path.setAttribute('d', 'M0,0 L10,10 L20,0 Z')
    path.setAttribute('transform', 'translate(10,10) scale(1.5) rotate(30)')
    svg.append(path)

    const cmd = recalculate.recalculateDimensions(path)

    // 'translate scale rotate' is not a recognised bake-in form: no-op, returns
    // null, path data and transform left unchanged.
    assert.equal(cmd, null)
    assert.equal(path.getAttribute('d'), 'M0,0 L10,10 L20,0 Z')
    assert.equal(path.getAttribute('transform'), 'translate(10,10) scale(1.5) rotate(30)')
  })

  it('recalculateDimensions() handles rect with no transform', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    // No transform should return null
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles circle with no transform', () => {
    setUp()

    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '25')
    svg.append(circle)

    const cmd = recalculate.recalculateDimensions(circle)

    assert.equal(cmd, null)
  })

  it('updateClipPath() with valid clip-path URL', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'testClip3')
    const clipRect = document.createElementNS(NS.SVG, 'rect')
    clipRect.setAttribute('width', '100')
    clipRect.setAttribute('height', '100')
    clipPath.append(clipRect)
    svg.append(clipPath)

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('clip-path', 'url(#testClip3)')
    rect.setAttribute('width', '100')
    rect.setAttribute('height', '100')
    svg.append(rect)

    const result = recalculate.updateClipPath('url(#testClip3)', 7, 11, rect)
    // Single user of the clipPath: child rect shifted by (7,11) in place; attr returned.
    assert.equal(result, 'url(#testClip3)')
    assert.equal(clipRect.getAttribute('x'), '7')
    assert.equal(clipRect.getAttribute('y'), '11')
  })

  it('recalculateDimensions() handles svg element', () => {
    setUp()

    const innerSvg = document.createElementNS(NS.SVG, 'svg')
    innerSvg.setAttribute('x', '10')
    innerSvg.setAttribute('y', '10')
    innerSvg.setAttribute('width', '100')
    innerSvg.setAttribute('height', '100')
    innerSvg.setAttribute('transform', 'translate(5,5)')
    svg.append(innerSvg)

    const cmd = recalculate.recalculateDimensions(innerSvg)

    // A nested <svg> has no remap handler, so the translate is consumed (transform
    // removed) but x/y/width/height are left unchanged. A command is still returned.
    assert.ok(cmd)
    assert.equal(innerSvg.getAttribute('x'), '10')
    assert.equal(innerSvg.getAttribute('y'), '10')
    assert.equal(innerSvg.getAttribute('width'), '100')
    assert.equal(innerSvg.getAttribute('height'), '100')
    assert.equal(innerSvg.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles ellipse with no transform', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '30')
    ellipse.setAttribute('ry', '20')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles path with no transform', () => {
    setUp()

    const path = document.createElementNS(NS.SVG, 'path')
    path.setAttribute('d', 'M0,0 L10,10 L20,0 Z')
    svg.append(path)

    const cmd = recalculate.recalculateDimensions(path)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles line with no transform', () => {
    setUp()

    const line = document.createElementNS(NS.SVG, 'line')
    line.setAttribute('x1', '0')
    line.setAttribute('y1', '0')
    line.setAttribute('x2', '100')
    line.setAttribute('y2', '100')
    svg.append(line)

    const cmd = recalculate.recalculateDimensions(line)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles image with no transform', () => {
    setUp()

    const image = document.createElementNS(NS.SVG, 'image')
    image.setAttribute('x', '10')
    image.setAttribute('y', '10')
    image.setAttribute('width', '100')
    image.setAttribute('height', '80')
    svg.append(image)

    const cmd = recalculate.recalculateDimensions(image)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles text with no transform', () => {
    setUp()

    const text = document.createElementNS(NS.SVG, 'text')
    text.setAttribute('x', '10')
    text.setAttribute('y', '10')
    text.textContent = 'Test'
    svg.append(text)

    const cmd = recalculate.recalculateDimensions(text)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles g element with child elements', () => {
    setUp()

    const g = document.createElementNS(NS.SVG, 'g')
    const child1 = document.createElementNS(NS.SVG, 'rect')
    child1.setAttribute('x', '10')
    child1.setAttribute('y', '10')
    child1.setAttribute('width', '30')
    child1.setAttribute('height', '30')
    const child2 = document.createElementNS(NS.SVG, 'circle')
    child2.setAttribute('cx', '50')
    child2.setAttribute('cy', '50')
    child2.setAttribute('r', '20')
    g.append(child1, child2)
    g.setAttribute('transform', 'translate(10,10) scale(1.5)')
    svg.append(g)

    const cmd = recalculate.recalculateDimensions(g)

    // Groups always return null - transform preserved on the group
    assert.equal(cmd, null)
    assert.equal(g.getAttribute('transform'), 'translate(10,10) scale(1.5)')
  })

  it('recalculateDimensions() handles rect with only rotation', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    rect.setAttribute('transform', 'rotate(90 35 35)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)

    // Single rotation should return null
    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles ellipse with only rotation', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '30')
    ellipse.setAttribute('ry', '20')
    ellipse.setAttribute('transform', 'rotate(45)')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles circle with only rotation', () => {
    setUp()

    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '25')
    circle.setAttribute('transform', 'rotate(30)')
    svg.append(circle)

    const cmd = recalculate.recalculateDimensions(circle)

    assert.equal(cmd, null)
  })

  it('recalculateDimensions() handles rect with scale and translate', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    rect.setAttribute('transform', 'translate(0,0) scale(2) translate(0,0)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // The zero translates are stripped, leaving a bare scale(2), which is not a
    // bake-in form: no-op, returns null, geometry unchanged.
    assert.equal(cmd, null)
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '10')
    assert.equal(rect.getAttribute('width'), '50')
    assert.equal(rect.getAttribute('height'), '50')
  })

  it('recalculateDimensions() handles polyline with points', () => {
    setUp()

    const polyline = document.createElementNS(NS.SVG, 'polyline')
    polyline.setAttribute('points', '0,0 10,10 20,0 30,10')
    polyline.setAttribute('transform', 'translate(10,10)')
    svg.append(polyline)

    mockPoints(polyline)
    const cmd = recalculate.recalculateDimensions(polyline)
    // translate(10,10) baked into every point; transform removed.
    assert.ok(cmd)
    assert.equal(polyline.getAttribute('points'), '10,10 20,20 30,10 40,20')
    assert.equal(polyline.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles polygon with points', () => {
    setUp()

    const polygon = document.createElementNS(NS.SVG, 'polygon')
    polygon.setAttribute('points', '0,0 10,0 5,10')
    polygon.setAttribute('transform', 'translate(5,5)')
    svg.append(polygon)

    mockPoints(polygon)
    const cmd = recalculate.recalculateDimensions(polygon)
    // translate(5,5) baked into every point; transform removed.
    assert.ok(cmd)
    assert.equal(polygon.getAttribute('points'), '5,5 15,5 10,15')
    assert.equal(polygon.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles text with multiple transforms', () => {
    setUp()

    const text = document.createElementNS(NS.SVG, 'text')
    text.setAttribute('x', '10')
    text.setAttribute('y', '10')
    text.textContent = 'Test'
    text.setAttribute('transform', 'translate(5,5) scale(1.2)')
    svg.append(text)

    const cmd = recalculate.recalculateDimensions(text)
    // 'translate scale' (no trailing translate) is not a bake-in form: no-op, null.
    assert.equal(cmd, null)
    assert.equal(text.getAttribute('x'), '10')
    assert.equal(text.getAttribute('y'), '10')
    assert.equal(text.getAttribute('transform'), 'translate(5,5) scale(1.2)')
  })

  it('recalculateDimensions() handles foreignObject with transform', () => {
    setUp()

    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    fo.setAttribute('x', '10')
    fo.setAttribute('y', '10')
    fo.setAttribute('width', '100')
    fo.setAttribute('height', '100')
    fo.setAttribute('transform', 'scale(1.5)')
    svg.append(fo)

    const cmd = recalculate.recalculateDimensions(fo)
    // A bare scale() is not a bake-in form: no-op, returns null, geometry unchanged.
    assert.equal(cmd, null)
    assert.equal(fo.getAttribute('x'), '10')
    assert.equal(fo.getAttribute('y'), '10')
    assert.equal(fo.getAttribute('width'), '100')
    assert.equal(fo.getAttribute('height'), '100')
    assert.equal(fo.getAttribute('transform'), 'scale(1.5)')
  })

  it('recalculateDimensions() handles image with scale', () => {
    setUp()

    const image = document.createElementNS(NS.SVG, 'image')
    image.setAttribute('x', '10')
    image.setAttribute('y', '10')
    image.setAttribute('width', '100')
    image.setAttribute('height', '80')
    image.setAttribute('transform', 'scale(2,2)')
    svg.append(image)

    const cmd = recalculate.recalculateDimensions(image)
    // A bare scale() is not a bake-in form: no-op, returns null, geometry unchanged.
    assert.equal(cmd, null)
    assert.equal(image.getAttribute('x'), '10')
    assert.equal(image.getAttribute('y'), '10')
    assert.equal(image.getAttribute('width'), '100')
    assert.equal(image.getAttribute('height'), '80')
    assert.equal(image.getAttribute('transform'), 'scale(2,2)')
  })

  it('recalculateDimensions() handles path with translate only', () => {
    setUp()

    const path = document.createElementNS(NS.SVG, 'path')
    path.setAttribute('d', 'M0,0 L10,10 L20,0 Z')
    path.setAttribute('transform', 'translate(15,15)')
    svg.append(path)

    const cmd = recalculate.recalculateDimensions(path)
    // translate(15,15) baked into the path data; transform removed.
    assert.ok(cmd)
    assert.equal(path.getAttribute('d'), 'M15,15 L25,25 L35,15 z')
    assert.equal(path.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles empty transform attribute', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    rect.setAttribute('width', '30')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', '')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // Empty transform has no items: it is removed and null is returned; geometry unchanged.
    assert.equal(cmd, null)
    assert.equal(rect.hasAttribute('transform'), false)
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '20')
    assert.equal(rect.getAttribute('width'), '30')
    assert.equal(rect.getAttribute('height'), '40')
  })

  it('recalculateDimensions() handles polyline with translate', () => {
    setUp()

    const polyline = document.createElementNS(NS.SVG, 'polyline')
    polyline.setAttribute('points', '0,0 10,10 20,5')
    polyline.setAttribute('transform', 'translate(5,5)')
    svg.append(polyline)

    mockPoints(polyline)
    const cmd = recalculate.recalculateDimensions(polyline)
    // translate(5,5) baked into every point; transform removed.
    assert.ok(cmd)
    assert.equal(polyline.getAttribute('points'), '5,5 15,15 25,10')
    assert.equal(polyline.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles tspan element', () => {
    setUp()

    const text = document.createElementNS(NS.SVG, 'text')
    const tspan = document.createElementNS(NS.SVG, 'tspan')
    tspan.textContent = 'test'
    tspan.setAttribute('x', '10')
    tspan.setAttribute('y', '20')
    text.append(tspan)
    svg.append(text)

    const cmd = recalculate.recalculateDimensions(tspan)
    // No transform present: returns null, geometry unchanged.
    assert.equal(cmd, null)
    assert.equal(tspan.getAttribute('x'), '10')
    assert.equal(tspan.getAttribute('y'), '20')
    assert.equal(tspan.hasAttribute('transform'), false)
  })

  it('updateClipPath() with translation', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip1')
    const clipRect = document.createElementNS(NS.SVG, 'rect')
    clipRect.setAttribute('x', '0')
    clipRect.setAttribute('y', '0')
    clipRect.setAttribute('width', '100')
    clipRect.setAttribute('height', '100')
    clipPath.append(clipRect)
    svg.append(clipPath)

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#clip1)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#clip1)', 10, 20, elem)
    // Single user: clipPath child rect shifted by (10,20) in place; attr returned.
    assert.equal(result, 'url(#clip1)')
    assert.equal(clipRect.getAttribute('x'), '10')
    assert.equal(clipRect.getAttribute('y'), '20')
  })

  it('recalculateDimensions() handles marker elements', () => {
    setUp()

    const line = document.createElementNS(NS.SVG, 'line')
    line.setAttribute('x1', '0')
    line.setAttribute('y1', '0')
    line.setAttribute('x2', '100')
    line.setAttribute('y2', '100')
    line.setAttribute('marker-end', 'url(#arrow)')
    line.setAttribute('transform', 'scale(2)')
    svg.append(line)

    const cmd = recalculate.recalculateDimensions(line)
    // A bare scale() on a line is not a bake-in form: no-op, returns null, endpoints unchanged.
    assert.equal(cmd, null)
    assert.equal(line.getAttribute('x1'), '0')
    assert.equal(line.getAttribute('y1'), '0')
    assert.equal(line.getAttribute('x2'), '100')
    assert.equal(line.getAttribute('y2'), '100')
    assert.equal(line.getAttribute('transform'), 'scale(2)')
  })

  it('recalculateDimensions() handles switch element', () => {
    setUp()

    const switchElem = document.createElementNS(NS.SVG, 'switch')
    switchElem.setAttribute('transform', 'translate(10,10)')
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    switchElem.append(rect)
    svg.append(switchElem)

    const cmd = recalculate.recalculateDimensions(switchElem)
    // <switch> has no bounding box (and is not a path), so recalc returns null and
    // leaves the transform in place.
    assert.equal(cmd, null)
    assert.equal(switchElem.getAttribute('transform'), 'translate(10,10)')
  })

  it('recalculateDimensions() handles nested groups', () => {
    setUp()

    const g1 = document.createElementNS(NS.SVG, 'g')
    g1.setAttribute('transform', 'translate(10,10)')
    const g2 = document.createElementNS(NS.SVG, 'g')
    g2.setAttribute('transform', 'scale(2)')
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '50')
    rect.setAttribute('height', '50')
    g2.append(rect)
    g1.append(g2)
    svg.append(g1)

    const cmd = recalculate.recalculateDimensions(g1)

    // Outer group always returns null - transform preserved
    assert.equal(cmd, null)
    assert.equal(g1.getAttribute('transform'), 'translate(10,10)')
  })

  it('recalculateDimensions() handles skewX transform', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    rect.setAttribute('width', '30')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', 'skewX(15)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // jsdom does not parse skewX() into a transform item, so the (empty) transform
    // list is removed and null is returned; geometry is unchanged.
    assert.equal(cmd, null)
    assert.equal(rect.hasAttribute('transform'), false)
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '20')
    assert.equal(rect.getAttribute('width'), '30')
    assert.equal(rect.getAttribute('height'), '40')
  })

  it('recalculateDimensions() handles skewY transform', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    rect.setAttribute('width', '30')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', 'skewY(15)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // jsdom does not parse skewY() into a transform item, so the (empty) transform
    // list is removed and null is returned; geometry is unchanged.
    assert.equal(cmd, null)
    assert.equal(rect.hasAttribute('transform'), false)
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '20')
    assert.equal(rect.getAttribute('width'), '30')
    assert.equal(rect.getAttribute('height'), '40')
  })

  it('recalculateDimensions() handles zero width rect', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    rect.setAttribute('width', '0')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', 'translate(5,5)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // translate(5,5) baked into x/y (10->15, 20->25); zero width preserved; transform removed.
    assert.ok(cmd)
    assert.equal(rect.getAttribute('x'), '15')
    assert.equal(rect.getAttribute('y'), '25')
    assert.equal(rect.getAttribute('width'), '0')
    assert.equal(rect.getAttribute('height'), '40')
    assert.equal(rect.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles zero height rect', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    rect.setAttribute('width', '30')
    rect.setAttribute('height', '0')
    rect.setAttribute('transform', 'translate(5,5)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // translate(5,5) baked into x/y (10->15, 20->25); zero height preserved; transform removed.
    assert.ok(cmd)
    assert.equal(rect.getAttribute('x'), '15')
    assert.equal(rect.getAttribute('y'), '25')
    assert.equal(rect.getAttribute('width'), '30')
    assert.equal(rect.getAttribute('height'), '0')
    assert.equal(rect.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles circle with zero radius', () => {
    setUp()

    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '0')
    circle.setAttribute('transform', 'translate(5,5)')
    svg.append(circle)

    const cmd = recalculate.recalculateDimensions(circle)
    // translate(5,5) baked into cx/cy (50->55); zero radius preserved; transform removed.
    assert.ok(cmd)
    assert.equal(circle.getAttribute('cx'), '55')
    assert.equal(circle.getAttribute('cy'), '55')
    assert.equal(circle.getAttribute('r'), '0')
    assert.equal(circle.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles ellipse with zero rx', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '0')
    ellipse.setAttribute('ry', '20')
    ellipse.setAttribute('transform', 'translate(5,5)')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)
    // translate(5,5) baked into cx/cy (50->55); zero rx preserved; transform removed.
    assert.ok(cmd)
    assert.equal(ellipse.getAttribute('cx'), '55')
    assert.equal(ellipse.getAttribute('cy'), '55')
    assert.equal(ellipse.getAttribute('rx'), '0')
    assert.equal(ellipse.getAttribute('ry'), '20')
    assert.equal(ellipse.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles ellipse with zero ry', () => {
    setUp()

    const ellipse = document.createElementNS(NS.SVG, 'ellipse')
    ellipse.setAttribute('cx', '50')
    ellipse.setAttribute('cy', '50')
    ellipse.setAttribute('rx', '20')
    ellipse.setAttribute('ry', '0')
    ellipse.setAttribute('transform', 'translate(5,5)')
    svg.append(ellipse)

    const cmd = recalculate.recalculateDimensions(ellipse)
    // translate(5,5) baked into cx/cy (50->55); zero ry preserved; transform removed.
    assert.ok(cmd)
    assert.equal(ellipse.getAttribute('cx'), '55')
    assert.equal(ellipse.getAttribute('cy'), '55')
    assert.equal(ellipse.getAttribute('rx'), '20')
    assert.equal(ellipse.getAttribute('ry'), '0')
    assert.equal(ellipse.hasAttribute('transform'), false)
  })

  it('recalculateDimensions() handles multiple transforms', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    rect.setAttribute('width', '30')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', 'translate(5,5) scale(2) rotate(45)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // 'translate scale rotate' is not a recognised bake-in form: no-op, returns null,
    // geometry unchanged.
    assert.equal(cmd, null)
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '20')
    assert.equal(rect.getAttribute('width'), '30')
    assert.equal(rect.getAttribute('height'), '40')
  })

  it('recalculateDimensions() handles line with zero length', () => {
    setUp()

    const line = document.createElementNS(NS.SVG, 'line')
    line.setAttribute('x1', '10')
    line.setAttribute('y1', '20')
    line.setAttribute('x2', '10')
    line.setAttribute('y2', '20')
    line.setAttribute('transform', 'translate(5,5)')
    svg.append(line)

    const cmd = recalculate.recalculateDimensions(line)
    // translate(5,5) baked into both (coincident) endpoints; transform removed.
    assert.ok(cmd)
    assert.equal(line.getAttribute('x1'), '15')
    assert.equal(line.getAttribute('y1'), '25')
    assert.equal(line.getAttribute('x2'), '15')
    assert.equal(line.getAttribute('y2'), '25')
    assert.equal(line.hasAttribute('transform'), false)
  })

  it('updateClipPath() handles circle clipPath', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip2')
    const clipCircle = document.createElementNS(NS.SVG, 'circle')
    clipCircle.setAttribute('cx', '50')
    clipCircle.setAttribute('cy', '50')
    clipCircle.setAttribute('r', '25')
    clipPath.append(clipCircle)
    svg.append(clipPath)

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#clip2)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#clip2)', 10, 20, elem)
    // Circle clipPath child shifted by (10,20): cx 50->60, cy 50->70; radius unchanged.
    assert.equal(result, 'url(#clip2)')
    assert.equal(clipCircle.getAttribute('cx'), '60')
    assert.equal(clipCircle.getAttribute('cy'), '70')
    assert.equal(clipCircle.getAttribute('r'), '25')
  })

  it('updateClipPath() handles ellipse clipPath', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip3')
    const clipEllipse = document.createElementNS(NS.SVG, 'ellipse')
    clipEllipse.setAttribute('cx', '50')
    clipEllipse.setAttribute('cy', '50')
    clipEllipse.setAttribute('rx', '30')
    clipEllipse.setAttribute('ry', '20')
    clipPath.append(clipEllipse)
    svg.append(clipPath)

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#clip3)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#clip3)', 10, 20, elem)
    // Ellipse clipPath child shifted by (10,20): cx 50->60, cy 50->70; radii unchanged.
    assert.equal(result, 'url(#clip3)')
    assert.equal(clipEllipse.getAttribute('cx'), '60')
    assert.equal(clipEllipse.getAttribute('cy'), '70')
    assert.equal(clipEllipse.getAttribute('rx'), '30')
    assert.equal(clipEllipse.getAttribute('ry'), '20')
  })

  it('updateClipPath() handles line clipPath', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip4')
    const clipLine = document.createElementNS(NS.SVG, 'line')
    clipLine.setAttribute('x1', '0')
    clipLine.setAttribute('y1', '0')
    clipLine.setAttribute('x2', '100')
    clipLine.setAttribute('y2', '100')
    clipPath.append(clipLine)
    svg.append(clipPath)

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#clip4)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#clip4)', 10, 20, elem)
    // Line clipPath child shifted by (10,20).
    assert.equal(result, 'url(#clip4)')
    assert.equal(clipLine.getAttribute('x1'), '10')
    assert.equal(clipLine.getAttribute('y1'), '20')
    assert.equal(clipLine.getAttribute('x2'), '110')
    assert.equal(clipLine.getAttribute('y2'), '120')
  })

  it('updateClipPath() handles polygon clipPath', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip5')
    const clipPolygon = document.createElementNS(NS.SVG, 'polygon')
    clipPolygon.setAttribute('points', '0,0 50,0 25,50')
    clipPath.append(clipPolygon)
    svg.append(clipPath)

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#clip5)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#clip5)', 10, 20, elem)
    // Polygon clipPath child points shifted by (10,20).
    assert.equal(result, 'url(#clip5)')
    assert.equal(clipPolygon.getAttribute('points'), '10,20 60,20 35,70')
  })

  it('updateClipPath() handles polyline clipPath', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip6')
    const clipPolyline = document.createElementNS(NS.SVG, 'polyline')
    clipPolyline.setAttribute('points', '0,0 50,25 100,0')
    clipPath.append(clipPolyline)
    svg.append(clipPath)

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#clip6)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#clip6)', 10, 20, elem)
    // Polyline clipPath child points shifted by (10,20).
    assert.equal(result, 'url(#clip6)')
    assert.equal(clipPolyline.getAttribute('points'), '10,20 60,45 110,20')
  })

  it('updateClipPath() handles path clipPath', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip7')
    const clipPathElem = document.createElementNS(NS.SVG, 'path')
    clipPathElem.setAttribute('d', 'M0,0 L50,50 L100,0 Z')
    clipPath.append(clipPathElem)
    svg.append(clipPath)

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#clip7)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#clip7)', 10, 20, elem)
    // Path clipPath child: a translate(10,20) is appended then baked into the path
    // data via a recursive recalculateDimensions, leaving no transform.
    assert.equal(result, 'url(#clip7)')
    assert.equal(clipPathElem.getAttribute('d'), 'M10,20 L60,70 L110,20 z')
    assert.equal(clipPathElem.hasAttribute('transform'), false)
  })

  it('updateClipPath() with invalid clip-path reference', () => {
    setUp()

    const elem = document.createElementNS(NS.SVG, 'rect')
    elem.setAttribute('clip-path', 'url(#nonexistent)')
    svg.append(elem)

    const result = recalculate.updateClipPath('url(#nonexistent)', 10, 20, elem)
    // No clipPath element resolves for the reference, so undefined is returned.
    assert.equal(result, undefined)
  })

  it('updateClipPath() without element parameter', () => {
    setUp()

    const clipPath = document.createElementNS(NS.SVG, 'clipPath')
    clipPath.setAttribute('id', 'clip8')
    const clipRect = document.createElementNS(NS.SVG, 'rect')
    clipRect.setAttribute('x', '0')
    clipRect.setAttribute('y', '0')
    clipRect.setAttribute('width', '100')
    clipRect.setAttribute('height', '100')
    clipPath.append(clipRect)
    svg.append(clipPath)

    const result = recalculate.updateClipPath('url(#clip8)', 10, 20)
    // Without an element argument the clipPath child rect is still shifted by (10,20).
    assert.equal(result, 'url(#clip8)')
    assert.equal(clipRect.getAttribute('x'), '10')
    assert.equal(clipRect.getAttribute('y'), '20')
  })

  it('recalculateDimensions() with element having only translate(0,0)', () => {
    setUp()

    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '20')
    rect.setAttribute('width', '30')
    rect.setAttribute('height', '40')
    rect.setAttribute('transform', 'translate(0,0)')
    svg.append(rect)

    const cmd = recalculate.recalculateDimensions(rect)
    // translate(0,0) is a zero translation: it is stripped, leaving no transforms,
    // so the attribute is removed and null is returned; geometry unchanged.
    assert.equal(cmd, null)
    assert.equal(rect.hasAttribute('transform'), false)
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '20')
  })

  it('recalculateDimensions() never flattens a <g> transform into its children', () => {
    setUp()

    const g = document.createElementNS(NS.SVG, 'g')
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '20')
    rect.setAttribute('height', '20')
    const circle = document.createElementNS(NS.SVG, 'circle')
    circle.setAttribute('cx', '50')
    circle.setAttribute('cy', '50')
    circle.setAttribute('r', '5')
    circle.setAttribute('transform', 'translate(3,4)')
    g.append(rect, circle)
    // translate/scale/translate -- the exact shape the group-only flatten loops handled.
    g.setAttribute('transform', 'translate(-35,-35) scale(2,2) translate(35,35)')
    svg.append(g)

    const cmd = recalculate.recalculateDimensions(g)

    // Groups keep their transform on the group element; children are left untouched.
    assert.equal(cmd, null)
    assert.equal(g.getAttribute('transform'), 'translate(-35,-35) scale(2,2) translate(35,35)')
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '10')
    assert.equal(rect.getAttribute('width'), '20')
    assert.equal(rect.getAttribute('height'), '20')
    assert.equal(rect.hasAttribute('transform'), false)
    assert.equal(circle.getAttribute('cx'), '50')
    assert.equal(circle.getAttribute('cy'), '50')
    assert.equal(circle.getAttribute('transform'), 'translate(3,4)')
  })

  it('recalculateDimensions() never flattens an <a> transform into its children', () => {
    setUp()

    const a = document.createElementNS(NS.SVG, 'a')
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('x', '10')
    rect.setAttribute('y', '10')
    rect.setAttribute('width', '20')
    rect.setAttribute('height', '20')
    a.append(rect)
    a.setAttribute('transform', 'translate(5,10)')
    svg.append(a)

    const cmd = recalculate.recalculateDimensions(a)

    assert.equal(cmd, null)
    assert.equal(a.getAttribute('transform'), 'translate(5,10)')
    assert.equal(rect.getAttribute('x'), '10')
    assert.equal(rect.getAttribute('y'), '10')
    assert.equal(rect.hasAttribute('transform'), false)
  })
})
