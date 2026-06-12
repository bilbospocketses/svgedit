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

  // Helper: assert the structural invariant — no non-<li> block directly inside a list,
  // and no list directly inside a list.
  const assertNoInvalidLists = (host: Element): void => {
    host.querySelectorAll('ul,ol').forEach((list) => {
      for (const child of [...list.children]) {
        expect(child.localName, `invalid <${child.localName}> child of <${list.localName}>`).toBe('li')
      }
    })
  }

  it('setBlock on a lone list item lifts it out and removes the empty list', () => {
    root.innerHTML = '<ul><li>only</li></ul>'
    selectAll(root.querySelector('li')!)
    cmd.setBlock(root, 'h2')
    expect(root.querySelector('ul')).toBeNull()
    expect(root.querySelector('h2')?.textContent).toBe('only')
    assertNoInvalidLists(root)
  })

  it('setBlock on a middle list item splits the list around the new block', () => {
    root.innerHTML = '<ul><li>a</li><li>b</li><li>c</li></ul>'
    selectAll(root.querySelectorAll('li')[1]!) // select "b"
    cmd.setBlock(root, 'h2')
    // Expect: <ul>a</ul> <h2>b</h2> <ul>c</ul>
    const lists = root.querySelectorAll('ul')
    expect(lists.length).toBe(2)
    expect(lists[0].textContent).toBe('a')
    expect(lists[1].textContent).toBe('c')
    expect(root.querySelector('h2')?.textContent).toBe('b')
    assertNoInvalidLists(root)
  })

  it('setBlock over a whole list converts every item and drops the list', () => {
    root.innerHTML = '<ul><li>a</li><li>b</li><li>c</li></ul>'
    selectAll(root.querySelector('ul')!)
    cmd.setBlock(root, 'p')
    expect(root.querySelector('ul')).toBeNull()
    expect([...root.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['a', 'b', 'c'])
    assertNoInvalidLists(root)
  })
})
