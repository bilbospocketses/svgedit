import { describe, expect, it } from 'vitest'
import { boolAttr, maskImageStyle } from '../../src/editor/components/component-utils.js'

/**
 * Characterizes the shared component utilities extracted in the #108-adjacent
 * components wave C1: the reflecting Boolean attribute converter (#113, was
 * duplicated across the seButton family) and `maskImageStyle` — the safe builder
 * for the icon mask-image inline style that was a CSS-injection sink (#115/#118).
 */
describe('maskImageStyle', () => {
  it('emits both -webkit and standard mask-image for a normal url', () => {
    expect(maskImageStyle('images/foo.svg')).toBe(
      '-webkit-mask-image:url("images/foo.svg");mask-image:url("images/foo.svg")'
    )
  })

  it('escapes a double-quote so a crafted url cannot inject a second CSS declaration', () => {
    const evil = 'x");background-image:url("//evil/track.png'
    const span = document.createElement('span')
    span.setAttribute('style', maskImageStyle(evil))
    // The would-be injected background-image must NOT materialize as its own declaration.
    expect(span.style.backgroundImage).toBe('')
    // The double-quote is backslash-escaped, keeping the payload inside url("...").
    expect(maskImageStyle(evil)).toContain('\\"')
    expect(maskImageStyle(evil)).not.toContain('url("x");background-image')
  })

  it('escapes backslashes', () => {
    expect(maskImageStyle('a\\b')).toContain('url("a\\\\b")')
  })
})

describe('boolAttr converter', () => {
  it('reflects true as the string "true" and false as null', () => {
    expect(boolAttr.converter.toAttribute(true)).toBe('true')
    expect(boolAttr.converter.toAttribute(false)).toBeNull()
  })

  it('reads attribute presence as true, absence (null) as false', () => {
    expect(boolAttr.converter.fromAttribute('true')).toBe(true)
    expect(boolAttr.converter.fromAttribute('')).toBe(true)
    expect(boolAttr.converter.fromAttribute(null)).toBe(false)
  })

  it('reflects so [pressed]-style attribute selectors match', () => {
    expect(boolAttr.reflect).toBe(true)
  })
})
