import { describe, expect, it, vi } from 'vitest'
import { EditorSelection } from '../../src/editor/EditorSelection.js'

describe('EditorSelection', () => {
  it('starts empty', () => {
    const s = new EditorSelection()
    expect(s.selectedElement).toBeNull()
    expect(s.multiselected).toBe(false)
  })

  it('setSelection updates both fields and emits one snapshot', () => {
    const s = new EditorSelection()
    const listener = vi.fn()
    s.subscribe(listener)
    const el = document.createElement('div')

    s.setSelection(el, true)

    expect(s.selectedElement).toBe(el)
    expect(s.multiselected).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ selectedElement: el, multiselected: true })
  })

  it('individual setters update state and emit', () => {
    const s = new EditorSelection()
    const listener = vi.fn()
    s.subscribe(listener)
    const el = document.createElement('div')

    s.selectedElement = el
    s.multiselected = true

    expect(listener).toHaveBeenCalledTimes(2)
    expect(s.selectedElement).toBe(el)
    expect(s.multiselected).toBe(true)
  })

  it('unsubscribe stops notifications', () => {
    const s = new EditorSelection()
    const listener = vi.fn()
    const unsubscribe = s.subscribe(listener)

    unsubscribe()
    s.setSelection(document.createElement('div'), false)

    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies every subscriber', () => {
    const s = new EditorSelection()
    const a = vi.fn()
    const b = vi.fn()
    s.subscribe(a)
    s.subscribe(b)

    s.setSelection(null, false)

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
