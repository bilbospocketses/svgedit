// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'

describe('foreignObject XHTML namespace round-trip', () => {
  it('XHTML content survives parse → serialize → reparse (image/svg+xml) keeping NS.HTML', () => {
    // Production shape: ONE xmlns on the wrapper root only (what serialize() emits;
    // inner elements carry no per-element xmlns). NEVER double up xmlns.
    const htmlString = `<div xmlns="${NS.HTML}" class="se-fo-root"><p><strong>hi</strong></p></div>`
    const svgString = `<svg xmlns="${NS.SVG}"><foreignObject width="200" height="100">${htmlString}</foreignObject></svg>`

    // Inject (mirrors setForeignContent parse).
    const doc1 = new DOMParser().parseFromString(svgString, 'image/svg+xml')
    expect(doc1.querySelector('parsererror')).toBeNull()
    const strong1 = doc1.getElementsByTagName('strong')[0]
    expect(strong1).toBeTruthy()
    expect(strong1.namespaceURI).toBe(NS.HTML)

    // Round-trip: serialize whole SVG (save) → reparse (load).
    const serialized = new XMLSerializer().serializeToString(doc1.documentElement)
    const doc2 = new DOMParser().parseFromString(serialized, 'image/svg+xml')
    expect(doc2.querySelector('parsererror')).toBeNull()
    const strong2 = doc2.getElementsByTagName('strong')[0]
    expect(strong2).toBeTruthy()
    expect(strong2.namespaceURI).toBe(NS.HTML)
  })
})
