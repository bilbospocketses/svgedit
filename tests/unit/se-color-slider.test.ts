import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../../src/editor/components/jgraduate/se-color-slider.ts'

let rafCb: FrameRequestCallback | null = null

beforeEach(() => {
  rafCb = null
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafCb = cb; return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => { rafCb = null })
})
afterEach(() => { vi.unstubAllGlobals() })

const mkSlider = async (): Promise<{ el: any, div: HTMLElement }> => {
  const el = document.createElement('se-color-slider') as any
  el.mode = '1d'
  el.width = 100
  el.height = 100
  document.body.append(el)
  await el.updateComplete
  const div = el.shadowRoot.querySelector('div') as HTMLElement
  // jsdom does not implement pointer capture
  div.setPointerCapture = vi.fn()
  div.releasePointerCapture = vi.fn()
  return { el, div }
}

// jsdom lacks a reliable PointerEvent ctor; a MouseEvent with a pointerId is enough.
const pointer = (type: string, y: number): Event => {
  const e = new MouseEvent(type, { clientX: 0, clientY: y, bubbles: true })
  Object.defineProperty(e, 'pointerId', { value: 1 })
  return e
}

describe('se-color-slider rAF handling (#17, #18)', () => {
  it('#17 repaints with the LATEST pointer position within a frame', async () => {
    const { el, div } = await mkSlider()
    div.dispatchEvent(pointer('pointerdown', 10)) // immediate update -> y=10, no frame
    div.dispatchEvent(pointer('pointermove', 30)) // schedules a frame
    div.dispatchEvent(pointer('pointermove', 70)) // frame pending -> currently dropped
    rafCb?.(0)                                     // flush the frame
    expect(Math.round(el.y)).toBe(70)              // must be the latest (70), not the stale 30
  })

  it('#18 commits the final position and drops the stale frame on pointer-up', async () => {
    const { el, div } = await mkSlider()
    div.dispatchEvent(pointer('pointerdown', 10))
    div.dispatchEvent(pointer('pointermove', 40)) // schedules a frame
    const seen: number[] = []
    el.addEventListener('sl-change', (e: any) => seen.push(Math.round(e.detail.y)))
    div.dispatchEvent(pointer('pointerup', 90))    // should commit 90 + cancel the pending frame
    rafCb?.(0)                                      // a leftover frame must be a no-op
    expect(el.y).toBe(90)
    expect(seen).not.toContain(40)                 // the stale 40 frame must not fire after up
  })
})
