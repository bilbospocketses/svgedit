import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'
import type { SvgEditorWindow } from './svg-editor-window.js'

/**
 * Platform-contract assertions — the specific browser SVG/DOM behaviors svgedit
 * actually depends on, pinned at app altitude.
 *
 * These are deliberately NOT a browser-conformance suite (WPT): that tests whether
 * the *browser* implements the SVG spec (vendor responsibility, already run upstream).
 * This file pins the handful of platform APIs whose regression would break *the
 * editor* — `getBBox()` geometry (selection/resize), path-`d` serialize/parse fidelity
 * (save/load), and `foreignObject` HTML layout (the Insert-HTML feature) — in the same
 * pinned Chromium + Firefox the rest of the e2e runs against. The scheduled
 * `browser-canary` workflow re-runs the whole e2e (this file included) against Chrome
 * Beta for early warning of an upcoming regression.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

test.describe('platform contract', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('getBBox() agrees with a known rect\'s geometry', async ({ page }) => {
    const svg = `<svg xmlns="${SVG_NS}"><rect x="10" y="20" width="30" height="40"/></svg>`
    const result = await page.evaluate((s) => {
      const canvas = (window as unknown as SvgEditorWindow).svgEditor.svgCanvas
      if (canvas.setSvgString(s) === false) return null
      const el = document.querySelector('#svgcontent rect') as SVGGraphicsElement | null
      if (!el) return null
      const b = el.getBBox()
      const num = (n: string): number => Number(el.getAttribute(n))
      return {
        attrs: { x: num('x'), y: num('y'), width: num('width'), height: num('height') },
        bbox: { x: b.x, y: b.y, width: b.width, height: b.height }
      }
    }, svg)
    expect(result).not.toBeNull()
    // setSvgString preserved the geometry...
    expect(result!.attrs).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    // ...and getBBox reports it (the contract selection/resize relies on).
    expect(result!.bbox).toEqual(result!.attrs)
  })

  test('a path survives a getSvgString -> setSvgString round-trip (geometry preserved)', async ({ page }) => {
    // svgedit re-encodes the `d` string on serialize (optimized relative form), so the
    // contract is geometric, not byte-for-byte: the round-trip must preserve the shape.
    const svg = `<svg xmlns="${SVG_NS}"><path d="M10 10 L50 30 L30 50 Z"/></svg>`
    const result = await page.evaluate((s) => {
      const canvas = (window as unknown as SvgEditorWindow).svgEditor.svgCanvas
      const bboxOf = (): { x: number, y: number, width: number, height: number } | null => {
        const el = document.querySelector('#svgcontent path') as SVGGraphicsElement | null
        if (!el) return null
        const b = el.getBBox()
        return { x: b.x, y: b.y, width: b.width, height: b.height }
      }
      canvas.setSvgString(s)
      const before = bboxOf()
      canvas.setSvgString(canvas.getSvgString()) // serialize then re-parse
      const after = bboxOf()
      return { before, after }
    }, svg)
    expect(result.before).not.toBeNull()
    // Geometry is identical before and after the round-trip...
    expect(result.after).toEqual(result.before)
    // ...and matches the triangle's expected bounding box.
    expect(result.after).toEqual({ x: 10, y: 10, width: 40, height: 40 })
  })

  test('foreignObject HTML content is laid out by the browser', async ({ page }) => {
    const svg = `<svg xmlns="${SVG_NS}"><foreignObject x="0" y="0" width="200" height="100">` +
      `<div xmlns="${XHTML_NS}" class="se-fo-root"><p>hello platform</p></div></foreignObject></svg>`
    const ok = await page.evaluate((s) =>
      (window as unknown as SvgEditorWindow).svgEditor.svgCanvas.setSvgString(s) !== false, svg)
    expect(ok).toBe(true)
    const laidOut = await page.evaluate(() => {
      const p = document.querySelector('#svgcontent foreignObject p') as HTMLElement | null
      if (!p) return null
      const r = p.getBoundingClientRect()
      return { width: r.width, height: r.height, text: p.textContent }
    })
    expect(laidOut).not.toBeNull()
    expect(laidOut!.text).toBe('hello platform')
    // The browser actually rendered/measured the HTML inside the foreignObject.
    expect(laidOut!.width).toBeGreaterThan(0)
    expect(laidOut!.height).toBeGreaterThan(0)
  })
})
