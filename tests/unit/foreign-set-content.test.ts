// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { setForeignContentMethod } from '../../packages/svgcanvas/core/foreign.js'

const makeCanvas = () => {
  const added: any[] = []
  const svgCanvas = {
    history: {
      BatchCommand: class { subs: any[] = []; addSubCommand (c: any) { this.subs.push(c) } },
      InsertElementCommand: class { constructor (public el: any) {} },
      RemoveElementCommand: class { constructor (public el: any, public sib: any, public parent: any) {} },
      ChangeElementCommand: class { constructor (public el: any, public attrs: any) {} }
    },
    sanitizeSvg: vi.fn(),
    addCommandToHistory: vi.fn((c) => added.push(c))
  }
  return { svgCanvas, added }
}

describe('setForeignContent', () => {
  it('swaps the foreignObject child and records one batch command', () => {
    const { svgCanvas, added } = makeCanvas()
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    fo.setAttribute('width', '200'); fo.setAttribute('height', '100')
    document.createElementNS(NS.SVG, 'svg').appendChild(fo)
    setForeignContentMethod(svgCanvas as any, fo, `<div xmlns="${NS.HTML}" class="se-fo-root"><p>hi</p></div>`)
    expect(fo.querySelector('p')?.textContent).toBe('hi')
    expect(svgCanvas.sanitizeSvg).toHaveBeenCalledTimes(1)
    expect(svgCanvas.addCommandToHistory).toHaveBeenCalledTimes(1)
    expect(added[0].subs.length).toBeGreaterThan(0)
  })

  it('appends sub-commands to a supplied parent batch without self-committing', () => {
    const { svgCanvas, added } = makeCanvas()
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    fo.setAttribute('width', '200'); fo.setAttribute('height', '100')
    document.createElementNS(NS.SVG, 'svg').appendChild(fo)
    const parent = new svgCanvas.history.BatchCommand()
    setForeignContentMethod(svgCanvas as any, fo, `<div xmlns="${NS.HTML}" class="se-fo-root"><p>hi</p></div>`, parent as any)
    expect(fo.querySelector('p')?.textContent).toBe('hi')
    // With a parent batch the method must NOT commit; the controller commits.
    expect(svgCanvas.addCommandToHistory).not.toHaveBeenCalled()
    expect(added.length).toBe(0)
    expect(parent.subs.length).toBeGreaterThan(0)
  })
})
