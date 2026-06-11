// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import * as cmd from '../../src/editor/dialogs/foreign-html-commands.ts'

const selectAll = (root: Element) => {
  const r = document.createRange(); r.selectNodeContents(root)
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(r)
}
let root: HTMLElement
beforeEach(() => {
  document.body.textContent = ''
  root = document.createElement('div'); root.contentEditable = 'true'
  document.body.appendChild(root)
})

describe('foreign-html commands', () => {
  it('toggleInline wraps the selection in <strong>', () => {
    root.innerHTML = '<p>hello</p>'; selectAll(root.querySelector('p')!)
    cmd.toggleInline(root, 'strong')
    expect(root.querySelector('strong')?.textContent).toBe('hello')
  })

  it('setBlock retags the block to <h2>', () => {
    root.innerHTML = '<p>title</p>'; selectAll(root.querySelector('p')!)
    cmd.setBlock(root, 'h2')
    expect(root.querySelector('h2')?.textContent).toBe('title')
    expect(root.querySelector('p')).toBeNull()
  })

  it('setColor wraps selection in a span with allowlisted style', () => {
    root.innerHTML = '<p>red</p>'; selectAll(root.querySelector('p')!)
    cmd.setColor(root, '#cc0000')
    const span = root.querySelector('span')!
    expect(span.getAttribute('style')).toContain('color')
  })

  it('setAlign sets text-align on the block', () => {
    root.innerHTML = '<p>x</p>'; selectAll(root.querySelector('p')!)
    cmd.setAlign(root, 'center')
    expect(root.querySelector('p')!.getAttribute('style')).toContain('text-align: center')
  })

  it('insertLink wraps selection in a hardened anchor', () => {
    root.innerHTML = '<p>link</p>'; selectAll(root.querySelector('p')!)
    cmd.insertLink(root, 'https://example.com')
    const a = root.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://example.com')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('setFontSize "M" removes an explicit size span', () => {
    root.innerHTML = '<p><span style="font-size: 24px">x</span></p>'
    selectAll(root.querySelector('span')!)
    cmd.setFontSize(root, 'M')
    expect(root.querySelector('span')).toBeNull()
  })
})
