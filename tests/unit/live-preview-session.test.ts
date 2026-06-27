import { describe, it, expect, vi } from 'vitest'
import { LivePreviewSession } from '../../src/editor/panels/LivePreviewSession.js'

// LivePreviewSession is the shared orchestration behind audit #29 item #4's
// live-preview for numeric controls (opacity, stroke-width, font-size, ...). It
// mirrors TopPanel.attrChanger: open ONE beginUndoableChange on the first `input`
// (snapshotting the originals BEFORE any preview -> the undo-trap fix), apply each
// keystroke with preventUndo, then finish into a single command on `change`.

const makeUndoMgr = (cmdEmpty = false): any => ({
  beginUndoableChange: vi.fn(),
  finishUndoableChange: vi.fn(() => ({ isEmpty: () => cmdEmpty })),
  addCommandToHistory: vi.fn()
})

const ELEMS = ['elemA'] as unknown as Element[]

describe('LivePreviewSession', () => {
  it('opens one undoable change on the first input and applies with preventUndo', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('input', 'opacity', ELEMS, apply)

    expect(undoMgr.beginUndoableChange).toHaveBeenCalledTimes(1)
    expect(undoMgr.beginUndoableChange).toHaveBeenCalledWith('opacity', ELEMS)
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(true)
  })

  it('does not re-open the undoable change on subsequent inputs (one snapshot per session)', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('input', 'opacity', ELEMS, apply)
    session.handle('input', 'opacity', ELEMS, apply)

    expect(undoMgr.beginUndoableChange).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledTimes(2)
    expect(apply).toHaveBeenNthCalledWith(2, true)
  })

  it('commits on change after preview: final preventUndo apply, finish, one recorded command', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('input', 'opacity', ELEMS, apply)
    session.handle('change', 'opacity', ELEMS, apply)

    expect(apply).toHaveBeenNthCalledWith(2, true) // final apply is still preventUndo
    expect(undoMgr.finishUndoableChange).toHaveBeenCalledTimes(1)
    expect(undoMgr.addCommandToHistory).toHaveBeenCalledTimes(1)
  })

  it('does not record an empty command on commit', () => {
    const undoMgr = makeUndoMgr(true) // finishUndoableChange -> empty
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('input', 'opacity', ELEMS, apply)
    session.handle('change', 'opacity', ELEMS, apply)

    expect(undoMgr.finishUndoableChange).toHaveBeenCalledTimes(1)
    expect(undoMgr.addCommandToHistory).not.toHaveBeenCalled()
  })

  it('commits directly (undo-recording) when change fires with no prior preview', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('change', 'opacity', ELEMS, apply)

    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(false) // direct, undo-recording commit
    expect(undoMgr.beginUndoableChange).not.toHaveBeenCalled()
    expect(undoMgr.finishUndoableChange).not.toHaveBeenCalled()
  })

  it('reopens cleanly for a second edit session after a commit', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('input', 'opacity', ELEMS, apply)
    session.handle('change', 'opacity', ELEMS, apply)
    session.handle('input', 'opacity', ELEMS, apply)

    expect(undoMgr.beginUndoableChange).toHaveBeenCalledTimes(2)
  })

  it('finishIfOpen() closes an open preview, recording one command (focusout)', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('input', 'opacity', ELEMS, apply)
    session.finishIfOpen()

    expect(undoMgr.finishUndoableChange).toHaveBeenCalledTimes(1)
    expect(undoMgr.addCommandToHistory).toHaveBeenCalledTimes(1)
  })

  it('finishIfOpen() is a no-op when no preview is open', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)

    session.finishIfOpen()

    expect(undoMgr.finishUndoableChange).not.toHaveBeenCalled()
    expect(undoMgr.addCommandToHistory).not.toHaveBeenCalled()
  })

  it('finishIfOpen() does not double-commit after a change already committed', () => {
    const undoMgr = makeUndoMgr()
    const session = new LivePreviewSession(() => undoMgr)
    const apply = vi.fn()

    session.handle('input', 'opacity', ELEMS, apply)
    session.handle('change', 'opacity', ELEMS, apply)
    session.finishIfOpen() // focusout fired after the change already committed

    expect(undoMgr.finishUndoableChange).toHaveBeenCalledTimes(1) // not twice
  })
})
