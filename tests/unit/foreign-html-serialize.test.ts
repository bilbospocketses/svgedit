// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { serialize, deserialize, FOREIGN_ROOT_CLASS, isForeignContentEmpty } from '../../src/editor/dialogs/foreign-html-serialize.js'
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

  it('strips a javascript: href on an <a> (editor-side mirror of the sanitizer)', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<a href="javascript:alert(1)">x</a>'
    const out = serialize(editor)
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('href')
    expect(out).toContain('>x</a>')
  })

  it('keeps a safe href and forces target=_blank rel=noopener noreferrer', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<a href="https://ex.com">x</a>'
    const out = serialize(editor)
    expect(out).toContain('href="https://ex.com"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('deserialize returns a fragment of the root\'s children', () => {
    const html = `<div xmlns="${NS.HTML}" class="${FOREIGN_ROOT_CLASS}"><p>hi</p></div>`
    const frag = deserialize(html)
    const div = document.createElement('div'); div.appendChild(frag)
    expect(div.querySelector('p')?.textContent).toBe('hi')
  })
})

describe('isForeignContentEmpty', () => {
  const mk = (html: string): HTMLElement => {
    const d = document.createElement('div'); d.innerHTML = html; return d
  }
  it('is true for no content', () => expect(isForeignContentEmpty(mk(''))).toBe(true))
  it('is true for an empty paragraph', () => expect(isForeignContentEmpty(mk('<p><br></p>'))).toBe(true))
  it('is true for whitespace-only text', () => expect(isForeignContentEmpty(mk('<p>   </p>'))).toBe(true))
  it('is false for text content', () => expect(isForeignContentEmpty(mk('<p>hi</p>'))).toBe(false))
  it('is false for hr-only content', () => expect(isForeignContentEmpty(mk('<hr>'))).toBe(false))
})
