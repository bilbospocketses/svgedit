import { describe, expect, it } from 'vitest'
import {
  findPos,
  isObject,
  mergeDeep,
  getClosest,
  getParents,
  getParentsUntil
} from '../../packages/svgcanvas/common/util.js'

describe('common util helpers', () => {
  it('computes positions and merges objects deeply', () => {
    const grand = { offsetLeft: 5, offsetTop: 6, offsetParent: null }
    const parent = { offsetLeft: 10, offsetTop: 11, offsetParent: grand }
    const child = { offsetLeft: 7, offsetTop: 8, offsetParent: parent }

    expect(findPos(child as unknown as HTMLElement)).toEqual({ left: 22, top: 25 })
    expect(isObject({ foo: 'bar' })).toBe(true)

    const merged = mergeDeep(
      { a: 1, nested: { keep: true, replace: 'old' } },
      { nested: { replace: 'new', extra: 42 }, more: 'yes' }
    )
    expect(merged).toEqual({ a: 1, nested: { keep: true, replace: 'new', extra: 42 }, more: 'yes' })
  })

  it('finds closest elements across selectors', () => {
    const root = document.createElement('div')
    const wrapper = document.createElement('div')
    wrapper.className = 'wrapper'
    const section = document.createElement('section')
    section.id = 'section'
    const child = document.createElement('span')
    child.dataset.role = 'target'

    section.append(child)
    wrapper.append(section)
    root.append(wrapper)
    document.body.append(root)

    expect(getClosest(child, '.wrapper')?.className).toBe('wrapper')
    expect(getClosest(child, '#section')?.id).toBe('section')
    expect((getClosest(child, '[data-role=target]') as HTMLElement | null)?.dataset.role).toBe('target')
    expect(getClosest(child, 'div')?.tagName.toLowerCase()).toBe('div')
  })

  it('collects parents with and without limits', () => {
    const outer = document.createElement('div')
    outer.className = 'outer'
    const mid = document.createElement('section')
    mid.id = 'mid'
    const inner = document.createElement('span')
    inner.className = 'inner'

    mid.append(inner)
    outer.append(mid)
    document.body.append(outer)

    const parents = getParents(inner)?.map(el => (el as Element).tagName.toLowerCase())
    expect(parents).toContain('body')

    expect(getParents(inner, '.outer')?.map(el => (el as Element).className)).toEqual(['outer'])

    const untilMid = getParentsUntil(inner, '#mid', '.inner')?.map(el => (el as Element).tagName.toLowerCase())
    expect(untilMid).toEqual(['span'])

    // [attr=value] must match by value, not by an attribute literally named
    // "data-role=panel" (the per-function matcher copies had this bug, #53).
    mid.setAttribute('data-role', 'panel')
    expect(getParents(inner, '[data-role=panel]')?.map(el => (el as Element).id)).toEqual(['mid'])
    expect(getParentsUntil(inner, 'body', '[data-role=panel]')?.map(el => (el as Element).id)).toEqual(['mid'])
  })
})
