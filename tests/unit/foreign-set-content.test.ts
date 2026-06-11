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
    expect(svgCanvas.addCommandToHistory).toHaveBeenCalledTimes(1)
    expect(added[0].subs.length).toBeGreaterThan(0)
  })
})
