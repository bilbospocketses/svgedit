import { describe, expect, it } from 'vitest'
import {
  FOREIGN_HTML_TAGS, FOREIGN_HTML_ATTRS, FOREIGN_STYLE_PROPS, FOREIGN_HREF_SCHEMES
} from '../../packages/svgcanvas/core/sanitize.js'

describe('foreign HTML allowlist constants', () => {
  it('allows inline + block tags, excludes script/table (v1)', () => {
    expect(FOREIGN_HTML_TAGS.has('strong')).toBe(true)
    expect(FOREIGN_HTML_TAGS.has('h2')).toBe(true)
    expect(FOREIGN_HTML_TAGS.has('a')).toBe(true)
    expect(FOREIGN_HTML_TAGS.has('script')).toBe(false)
    expect(FOREIGN_HTML_TAGS.has('table')).toBe(false)
  })
  it('allows the v1 CSS properties, not positioning', () => {
    expect(FOREIGN_STYLE_PROPS.has('color')).toBe(true)
    expect(FOREIGN_STYLE_PROPS.has('text-align')).toBe(true)
    expect(FOREIGN_STYLE_PROPS.has('font-size')).toBe(true)
    expect(FOREIGN_STYLE_PROPS.has('position')).toBe(false)
    expect(FOREIGN_STYLE_PROPS.has('background-color')).toBe(false) // phase 2
  })
  it('a-tag attrs and safe href schemes', () => {
    expect(FOREIGN_HTML_ATTRS.a).toContain('href')
    expect(FOREIGN_HTML_ATTRS.a).toContain('target')
    expect(FOREIGN_HTML_ATTRS.a).toContain('rel')
    expect(FOREIGN_HREF_SCHEMES.has('https:')).toBe(true)
    expect(FOREIGN_HREF_SCHEMES.has('javascript:')).toBe(false)
    expect(FOREIGN_HREF_SCHEMES.has('mailto:')).toBe(false) // decision: no mailto
  })
})
