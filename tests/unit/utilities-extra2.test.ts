import { describe, it, expect, beforeEach } from 'vitest'

import { init as initUnits } from '../../packages/svgcanvas/core/units.js'
import {
  init as initUtilities,
  findDefs,
  assignAttributes,
  snapToGrid,
  getHref,
  setHref,
  dropXMLInternalSubset,
  encodeUTF8,
  decodeUTF8
} from '../../packages/svgcanvas/core/utilities.js'

describe('utilities extra coverage', () => {
  let svg

  beforeEach(() => {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    document.body.innerHTML = ''
    document.body.append(svg)

    // Initialize units and utilities with a minimal canvas/context stub
    initUnits({
      getBaseUnit: () => 'px',
      getWidth: () => 200,
      getHeight: () => 100,
      getRoundDigits: () => 2
    })
    initUtilities({
      getSvgRoot: () => svg,
      getSvgContent: () => svg,
      getDOMDocument: () => document,
      getDOMContainer: () => svg,
      getBaseUnit: () => 'cm',
      getSnappingStep: () => 0.5
    })
  })

  it('creates defs and removes namespaced attributes via assignAttributes', () => {
    const defs = findDefs()
    expect(defs.tagName).toBe('defs')
    expect(svg.querySelectorAll('defs').length).toBe(1)

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    assignAttributes(rect, { width: '10', height: '5', 'xml:space': undefined }, 0, true)
    expect(rect.getAttribute('width')).toBe('10')
    expect(rect.getAttribute('height')).toBe('5')
  })

  it('snaps to grid with unit conversion and handles href helpers', () => {
    const value = snapToGrid(2.3)
    expect(value).toBe(0)

    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    setHref(use, '#ref')
    expect(getHref(use)).toBe('#ref')
  })

  it('drops XML internal subsets and round trips UTF8 helpers', () => {
    const doc = '<!DOCTYPE svg [<!ENTITY test "x">]><svg/>'
    expect(dropXMLInternalSubset(doc)).toContain('<!DOCTYPE svg')

    const mixed = 'äöü & < >'
    const encoded = encodeUTF8(mixed)
    expect(decodeUTF8(encoded)).toBe(mixed)
  })
})

describe('encodeUTF8 / decodeUTF8 byte-exact behavior', () => {
  it('leaves ASCII unchanged', () => {
    expect(encodeUTF8('hello')).toBe('hello')
    expect(decodeUTF8('hello')).toBe('hello')
  })

  it('encodes Latin-1, BMP and astral code points to their exact UTF-8 byte strings', () => {
    expect(encodeUTF8('é')).toBe('Ã©') // U+00E9 -> C3 A9
    expect(encodeUTF8('€')).toBe('â¬') // U+20AC -> E2 82 AC
    expect(encodeUTF8('中')).toBe('ä¸­') // U+4E2D -> E4 B8 AD
    expect(encodeUTF8('😀')).toBe('ð') // U+1F600 -> F0 9F 98 80
  })

  it('decodes exact UTF-8 byte strings back to their code points', () => {
    expect(decodeUTF8('Ã©')).toBe('é')
    expect(decodeUTF8('â¬')).toBe('€')
    expect(decodeUTF8('ä¸­')).toBe('中')
    expect(decodeUTF8('ð')).toBe('😀')
  })

  it('preserves a leading BOM (U+FEFF) instead of stripping it', () => {
    expect(encodeUTF8('﻿')).toBe('ï»¿')
    expect(decodeUTF8('ï»¿')).toBe('﻿')
  })

  it('throws on malformed UTF-8 byte sequences', () => {
    expect(() => decodeUTF8('ÿÿ')).toThrow()
  })

  it('round-trips mixed ASCII / multi-plane Unicode content', () => {
    const mixed = 'Witaj świecie 😀 中文 € äöü & < >'
    expect(decodeUTF8(encodeUTF8(mixed))).toBe(mixed)
  })
})
