import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { getPathData, getPathDataReadonly, setPathData } from '../../packages/svgcanvas/core/path-data.js'

describe('path-data caching', function () {
  /**
   * Create a detached <path> with the given `d`. Path-data parsing only reads the
   * `d` attribute, so the element does not need to be attached to the document.
   */
  const makePath = (d: string) => {
    const path = document.createElementNS(NS.SVG, 'path')
    path.setAttribute('d', d)
    return path
  }

  it('getPathData() returns a fresh clone on every call (cache is defensively copied)', function () {
    const path = makePath('M0,0 L10,10 Z')
    const a = getPathData(path)
    const b = getPathData(path)
    assert.notStrictEqual(a, b) // distinct arrays -> a clone was returned
    assert.deepEqual(a, b) // ...with identical content
  })

  it('mutating a getPathData() result does not corrupt the cache', function () {
    const path = makePath('M0,0 L10,10 Z')
    const first = getPathData(path)
    assert.equal(first.length, 3)
    first.push({ type: 'L', values: [99, 99] }) // mutate the returned (cloned) array
    const second = getPathData(path)
    assert.equal(second.length, 3) // cache untouched by the caller's mutation
  })

  it('getPathDataReadonly() returns the same cached reference on repeated calls (no clone)', function () {
    const path = makePath('M0,0 L10,10 Z')
    const a = getPathDataReadonly(path)
    const b = getPathDataReadonly(path)
    assert.strictEqual(a, b) // identical reference -> no per-call clone
  })

  it('getPathDataReadonly() returns the same content as getPathData()', function () {
    const path = makePath('M0,0 C1,2 3,4 5,6 Z')
    assert.deepEqual([...getPathDataReadonly(path)], getPathData(path))
  })

  it('getPathDataReadonly() reflects setPathData() cache invalidation', function () {
    const path = makePath('M0,0 L10,10 Z')
    getPathDataReadonly(path) // populate the cache
    setPathData(path, [{ type: 'M', values: [5, 5] }])
    const after = getPathDataReadonly(path)
    assert.equal(after.length, 1)
    assert.equal(after[0]!.type, 'M')
    assert.deepEqual(after[0]!.values, [5, 5])
  })

  it('getPathDataReadonly() shares its cache with getPathData()', function () {
    const path = makePath('M0,0 L10,10 Z')
    const ro = getPathDataReadonly(path) // populate via the read-only path
    const cloned = getPathData(path) // default path must hit the same cache
    assert.notStrictEqual(ro, cloned) // default still clones
    assert.deepEqual([...ro], cloned) // ...same content from the shared cache
  })
})
