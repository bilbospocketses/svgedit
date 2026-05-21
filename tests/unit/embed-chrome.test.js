// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyChrome, resolveChromePreset } from '../../src/embed/chrome.ts'

describe('embed chrome control', () => {
  beforeEach(() => {
    document.body.className = ''
  })

  it('resolveChromePreset full = all visible', () => {
    expect(resolveChromePreset('full')).toEqual({
      menu: true, toolbox: true, layers: true, palette: true, statusbar: true, header: true
    })
  })

  it('resolveChromePreset minimal = only toolbox', () => {
    expect(resolveChromePreset('minimal')).toEqual({
      menu: false, toolbox: true, layers: false, palette: false, statusbar: false, header: false
    })
  })

  it('resolveChromePreset none = all hidden', () => {
    expect(resolveChromePreset('none')).toEqual({
      menu: false, toolbox: false, layers: false, palette: false, statusbar: false, header: false
    })
  })

  it('applyChrome sets embed body class', () => {
    applyChrome(document.body, { menu: true, toolbox: true, layers: true, palette: true, statusbar: true, header: true })
    expect(document.body.classList.contains('embed')).toBe(true)
  })

  it('applyChrome adds no-* class per false element', () => {
    applyChrome(document.body, { menu: false, toolbox: true, layers: false, palette: true, statusbar: false, header: true })
    expect(document.body.classList.contains('no-menu')).toBe(true)
    expect(document.body.classList.contains('no-toolbox')).toBe(false)
    expect(document.body.classList.contains('no-layers')).toBe(true)
    expect(document.body.classList.contains('no-palette')).toBe(false)
    expect(document.body.classList.contains('no-statusbar')).toBe(true)
    expect(document.body.classList.contains('no-header')).toBe(false)
  })

  it('applyChrome removes stale no-* class when element re-enabled', () => {
    applyChrome(document.body, { menu: false })
    expect(document.body.classList.contains('no-menu')).toBe(true)
    applyChrome(document.body, { menu: true })
    expect(document.body.classList.contains('no-menu')).toBe(false)
  })

  it('applyChrome with empty state still tags body.embed', () => {
    applyChrome(document.body, {})
    expect(document.body.classList.contains('embed')).toBe(true)
  })
})
