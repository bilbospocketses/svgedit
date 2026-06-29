import { buildStarPoints, buildRegularPolygonPoints } from '../../src/editor/extensions/ext-polystar/polystar-points.js'

describe('polystar point generation', () => {
  const parsePoints = (s: string) =>
    s.trim().split(/\s+/).filter(Boolean).map(p => p.split(',').map(Number))

  it('buildRegularPolygonPoints returns sides+1 vertices on the circumradius circle', () => {
    const pts = parsePoints(buildRegularPolygonPoints(0, 0, 4, 10))
    expect(pts).toHaveLength(5) // s = 0..sides inclusive (closing vertex)
    expect(pts[0]![0]).toBeCloseTo(10) // angle 0 -> (r, 0)
    expect(pts[0]![1]).toBeCloseTo(0)
    for (const [x, y] of pts) {
      expect(Math.hypot(x!, y!)).toBeCloseTo(10)
    }
  })

  it('buildStarPoints alternates circumradius and inradius vertices', () => {
    const pts = parsePoints(buildStarPoints(0, 0, 5, 10, 5, 'point', 0))
    expect(pts).toHaveLength(12) // s = 0..5 inclusive, an outer + inner vertex each
    expect(Math.hypot(pts[0]![0]!, pts[0]![1]!)).toBeCloseTo(10) // outer
    expect(Math.hypot(pts[1]![0]!, pts[1]![1]!)).toBeCloseTo(5) // inner
    expect(Math.hypot(pts[2]![0]!, pts[2]![1]!)).toBeCloseTo(10) // outer
  })

  it('buildStarPoints omits inner vertices when inradius is NaN', () => {
    const pts = parsePoints(buildStarPoints(0, 0, 5, 10, NaN, 'point', 0))
    expect(pts).toHaveLength(6) // outer vertices only
    for (const [x, y] of pts) {
      expect(Math.hypot(x!, y!)).toBeCloseTo(10)
    }
  })
})
