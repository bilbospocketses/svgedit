import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportManager } from '../../src/editor/ExportManager.js'

/**
 * Characterizes ExportManager (extracted from Editor + editorInit in #108 PR-2).
 * Stubs `window.open` and the ambient `seAlert` global.
 */
const makeHost = () => ({
  i18next: { t: (k: string) => k },
  configObj: { pref: vi.fn(() => 'all') } // 'all' => export notice already dismissed
})

describe('ExportManager', () => {
  beforeEach(() => {
    globalThis.seAlert = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handleExported opens the named window and streams the blob URL to it', () => {
    const fakeWin = { closed: false, location: { href: '' } }
    vi.spyOn(window, 'open').mockReturnValue(fakeWin)
    const em = new ExportManager(makeHost())

    em.handleExported(null, { issues: [], exportWindowName: 'w1', bloburl: 'blob:abc', type: 'png' })

    expect(window.open).toHaveBeenCalledWith('', 'w1')
    expect(fakeWin.location.href).toBe('blob:abc')
    expect(em.exportWindow).toBe(fakeWin)
    expect(globalThis.seAlert).not.toHaveBeenCalled()
  })

  it('handleExported alerts and bails when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const em = new ExportManager(makeHost())

    em.handleExported(null, { issues: [], exportWindowName: 'w1', datauri: 'data:x', type: 'png' })

    expect(globalThis.seAlert).toHaveBeenCalled()
  })

  it('handleExportedPDF ignores empty output (Chrome)', () => {
    const openSpy = vi.spyOn(window, 'open')
    const em = new ExportManager(makeHost())

    em.handleExportedPDF(null, {})

    expect(openSpy).not.toHaveBeenCalled()
  })

  it('handleExportedPDF streams the PDF output to the export window', () => {
    const fakeWin = { closed: false, location: { href: '' } }
    vi.spyOn(window, 'open').mockReturnValue(fakeWin)
    const em = new ExportManager(makeHost())
    em.exportWindowName = 'pdf1'

    em.handleExportedPDF(null, { output: 'pdfdata', exportWindowName: 'pdf1' })

    expect(window.open).toHaveBeenCalledWith('', 'pdf1')
    expect(fakeWin.location.href).toBe('pdfdata')
  })
})
