// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbedServer } from '../../src/embed/server.ts'

const makeFakeEditor = () => ({
  svgCanvas: { getZoom: () => 1.5, clearSelection: vi.fn() }
})

describe('EmbedServer — constructor + listener setup', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/')
  })

  it('does not attach when embedMode is false', () => {
    const editor = makeFakeEditor()
    const spy = vi.spyOn(window, 'addEventListener')
    new EmbedServer(editor, { detectEmbedMode: () => false })
    expect(spy).not.toHaveBeenCalledWith('message', expect.anything())
    spy.mockRestore()
  })

  it('attaches message listener when embedMode is true', () => {
    const editor = makeFakeEditor()
    const spy = vi.spyOn(window, 'addEventListener')
    new EmbedServer(editor, { detectEmbedMode: () => true, allowedOrigins: ['https://host.test'] })
    expect(spy).toHaveBeenCalledWith('message', expect.any(Function))
    spy.mockRestore()
  })

  it('applies URL-param chrome state on init', () => {
    window.history.replaceState({}, '', '/?embed=1&chrome=minimal')
    const editor = makeFakeEditor()
    new EmbedServer(editor)
    expect(document.body.classList.contains('embed')).toBe(true)
    expect(document.body.classList.contains('no-menu')).toBe(true)
    expect(document.body.classList.contains('no-toolbox')).toBe(false)
  })

  it('applies URL-param theme on init', () => {
    window.history.replaceState({}, '', '/?embed=1&theme=dark')
    const editor = makeFakeEditor()
    new EmbedServer(editor)
    expect(document.body.classList.contains('theme-dark')).toBe(true)
  })
})
