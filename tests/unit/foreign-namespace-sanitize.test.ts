// @vitest-environment jsdom
/**
 * #40 (confirm not-a-bug — regression guard). foreignObject content imported from an
 * SVG file (image/svg+xml, the real open path via selection.ts:prepareSvg) lands in a
 * NON-HTML namespace: a foreignObject child without its own xmlns inherits the SVG
 * namespace, so it takes the SVG sanitize ruleset rather than the strict foreign-HTML
 * allowlist. The audit flagged that fall-through as a "bypass." It is real as a
 * *mechanism* but NOT exploitable: the SVG ruleset (post-#132 hardening) neutralizes
 * the same active-content vectors — these probes attempt to smuggle a javascript:
 * href, a <script>, event-handler attributes, and CSS @import/url() through that path
 * and each is stripped. The only elements the SVG ruleset keeps that the HTML
 * allowlist would drop (a remote <image>, an external SVG <a>) are already permitted
 * canvas-wide by design, not a foreignObject-specific escalation; and the import path
 * is XML-parse -> sanitize -> live SVG DOM with no HTML re-parse, so the classic mXSS
 * mutation point is absent. Over-claim, like #14/#15. Kept as a regression guard so a
 * future weakening of the SVG path can't silently reopen the gap.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as sanitize from '../../packages/svgcanvas/core/sanitize.js'

const parseSvg = (markup: string): Element =>
  new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement

const fo = (inner: string): string =>
  `<svg xmlns="${NS.SVG}"><foreignObject width="200" height="100">${inner}</foreignObject></svg>`

describe('#40 foreignObject non-HTML-namespace sanitize', () => {
  beforeEach(() => { console.warn = () => {} })

  it('imported foreignObject children inherit the SVG namespace (documents the premise)', () => {
    const root = parseSvg(fo('<div id="d">x</div>'))
    expect(root.querySelector('div')?.namespaceURI).toBe(NS.SVG)
  })

  it('strips a javascript: href on an SVG-namespaced <a>', () => {
    const root = parseSvg(fo('<a id="a" href="javascript:alert(1)">x</a>'))
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('#a')?.getAttribute('href') ?? '').not.toContain('javascript:')
  })

  it('removes a <script> smuggled into a foreignObject', () => {
    const root = parseSvg(fo('<script>globalThis.__pwned = 1</script>'))
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('script')).toBeNull()
  })

  it('strips event-handler attributes on SVG-namespaced HTML-shaped tags', () => {
    const root = parseSvg(fo('<div id="d" onclick="alert(1)" onload="alert(2)">x</div>'))
    sanitize.sanitizeSvg(root)
    const div = root.querySelector('#d')!
    expect(div.hasAttribute('onclick')).toBe(false)
    expect(div.hasAttribute('onload')).toBe(false)
  })

  it('neutralizes @import/url() in an SVG-namespaced <style>', () => {
    const root = parseSvg(fo('<style>@import url(http://evil.example/x.css);</style>'))
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('style')?.textContent ?? '').not.toContain('@import')
  })
})
