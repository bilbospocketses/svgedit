import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { init as pathMethodInit, replacePathSegBatchMethod, toPathSeg } from '../../packages/svgcanvas/core/path-method.js'
import { getPathData, setPathData } from '../../packages/svgcanvas/core/path-data.js'

// Count setPathData (pass-through) to prove Segment.move's helper applies all of
// a node's segment updates in ONE path-data round-trip rather than one per segment
// (audit #29 perf #57).
vi.mock('../../packages/svgcanvas/core/path-data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/svgcanvas/core/path-data.js')>()
  return { ...actual, setPathData: vi.fn(actual.setPathData) }
})

// The real segment-type → property-name map (packages/svgcanvas/core/path.ts).
const SEG_DATA: Record<number, string[]> = {
  2: ['x', 'y'],
  4: ['x', 'y'],
  6: ['x', 'y', 'x1', 'y1', 'x2', 'y2'],
  8: ['x', 'y', 'x1', 'y1']
}

describe('replacePathSegBatchMethod', () => {
  let pathEl: SVGPathElement

  beforeEach(() => {
    pathEl = document.createElementNS(NS.SVG, 'path') as SVGPathElement
    pathEl.setAttribute('d', 'M0,0 C10,10 20,20 30,30 C40,40 50,50 60,60')
    document.body.append(pathEl)
    pathMethodInit({
      getPathObj: () => ({ elem: pathEl }),
      getSegData: () => SEG_DATA
    } as unknown as Parameters<typeof pathMethodInit>[0])
  })

  afterEach(() => {
    document.body.textContent = ''
    vi.clearAllMocks()
  })

  it('applies multiple segment updates with a single path-data write (#57)', () => {
    vi.mocked(setPathData).mockClear()

    replacePathSegBatchMethod([
      { type: 6, index: 1, pts: [35, 35, 11, 11, 21, 21] },
      { type: 6, index: 2, pts: [65, 65, 41, 41, 51, 51] }
    ], pathEl)

    // One write for both segment updates, not one per update.
    expect(vi.mocked(setPathData).mock.calls.length).toBe(1)

    // Both segments were updated with the supplied coordinates.
    const data = getPathData(pathEl)
    const s1 = toPathSeg(data[1]!)
    const s2 = toPathSeg(data[2]!)
    expect([s1.x, s1.y, s1.x1, s1.y1, s1.x2, s1.y2]).toEqual([35, 35, 11, 11, 21, 21])
    expect([s2.x, s2.y, s2.x1, s2.y1, s2.x2, s2.y2]).toEqual([65, 65, 41, 41, 51, 51])
  })
})
