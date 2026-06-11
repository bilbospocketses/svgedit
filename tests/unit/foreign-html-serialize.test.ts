// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { serialize, deserialize, FOREIGN_ROOT_CLASS } from '../../src/editor/dialogs/foreign-html-serialize.ts'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'

describe('foreign-html serialize/deserialize', () => {
  it('wraps content in an xmlns="…/xhtml" root with the marker class', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<p>hi <strong>x</strong></p>'
    const out = serialize(editor)
    expect(out).toContain(`xmlns="${NS.HTML}"`)
    expect(out).toContain(FOREIGN_ROOT_CLASS)
    expect(out).toContain('<strong>x</strong>')
  })

  it('drops non-allowlisted tags/attrs in the pre-injection pass', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<p onclick="x()">a<script>1<\/script></p>'
    const out = serialize(editor)
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('<script')
  })

  it('deserialize returns a fragment of the root\'s children', () => {
    const html = `<div xmlns="${NS.HTML}" class="${FOREIGN_ROOT_CLASS}"><p>hi</p></div>`
    const frag = deserialize(html)
    const div = document.createElement('div'); div.appendChild(frag)
    expect(div.querySelector('p')?.textContent).toBe('hi')
  })
})
