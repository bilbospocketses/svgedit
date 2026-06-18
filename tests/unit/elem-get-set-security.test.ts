// @vitest-environment jsdom
// #48/#49 — elem-get-set href/color validation regressions.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as history from '../../packages/svgcanvas/core/history.js'
import dataStorage from '../../packages/svgcanvas/core/dataStorage.js'
import { init as initElemGetSet } from '../../packages/svgcanvas/core/elem-get-set.js'
import * as utilities from '../../packages/svgcanvas/core/utilities.js'

const el = (n: string): Element => document.createElementNS(NS.SVG, n)

// Image stub: never actually loads; fires onerror synchronously when src is set.
class FakeImage {
  width = 10
  height = 10
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  _src = ''
  set src (v: string) { this._src = v; this.onerror?.() }
  get src (): string { return this._src }
}

describe('elem-get-set security (#48/#49)', () => {
  let canvas: any
  let svgContent: Element
  let svgroot: Element
  let origImage: typeof globalThis.Image

  beforeEach(() => {
    document.body.textContent = ''
    svgroot = el('svg')
    svgContent = el('svg')
    svgContent.setAttribute('width', '100')
    svgContent.setAttribute('height', '100')
    svgroot.append(svgContent)
    document.body.append(svgroot)
    utilities.init({ getSvgRoot: () => svgroot } as never)
    canvas = {
      history,
      selectedElements: [] as Element[],
      selectorManager: { requestSelector: () => ({ resize () {} }) },
      call: vi.fn(),
      getDOMDocument: () => document,
      getSvgContent: () => svgContent,
      getSelectedElements (): Element[] { return this.selectedElements },
      getDataStorage: () => dataStorage,
      addCommandToHistory: vi.fn(),
      assignAttributes: (e: Element, attrs: Record<string, string>) => {
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
      }
    }
    initElemGetSet(canvas)
    origImage = globalThis.Image
    ;(globalThis as any).Image = FakeImage
  })

  afterEach(() => {
    globalThis.Image = origImage
    document.body.textContent = ''
    vi.restoreAllMocks()
  })

  const bgScaffold = (): Element => {
    const bg = el('g'); bg.id = 'canvasBackground'
    bg.append(el('rect'))
    svgContent.append(bg)
    return bg
  }

  // ---- #48 setImageURL ----
  it('#48 rejects an unsafe javascript: image URL (href unchanged)', () => {
    const image = el('image'); image.setAttribute('href', 'old.png'); svgContent.append(image)
    canvas.selectedElements = [image]
    canvas.setImageURL('javascript:alert(1)')
    expect(image.getAttribute('href')).toBe('old.png')
  })

  it('#48 rejects a data:text/html image URL', () => {
    const image = el('image'); image.setAttribute('href', 'old.png'); svgContent.append(image)
    canvas.selectedElements = [image]
    canvas.setImageURL('data:text/html,<script>alert(1)</script>')
    expect(image.getAttribute('href')).toBe('old.png')
  })

  it('#48 still accepts a safe relative image URL', () => {
    const image = el('image'); image.setAttribute('href', 'old.png'); svgContent.append(image)
    canvas.selectedElements = [image]
    canvas.setImageURL('new.png')
    expect(image.getAttribute('href')).toBe('new.png')
  })

  // ---- #49 setBackground ----
  it('#49 does not set an unsafe background image href', () => {
    bgScaffold()
    canvas.setBackground('#ffffff', 'javascript:alert(1)')
    const bgImg = svgContent.querySelector('#background_image')
    if (bgImg) expect(utilities.getHref(bgImg) ?? '').not.toContain('javascript:')
  })

  it('#49 does not write a url() paint value as the background color', () => {
    const bg = bgScaffold()
    canvas.setBackground('url(http://evil.example/x.png)', '')
    const rect = bg.querySelector('rect')!
    expect(rect.getAttribute('fill') ?? '').not.toContain('url(')
  })

  it('#49 still applies a normal color and a safe image url', () => {
    const bg = bgScaffold()
    canvas.setBackground('#abcdef', 'pic.png')
    expect(bg.querySelector('rect')!.getAttribute('fill')).toBe('#abcdef')
    const bgImg = svgContent.querySelector('#background_image')
    expect(bgImg && utilities.getHref(bgImg)).toBe('pic.png')
  })
})
