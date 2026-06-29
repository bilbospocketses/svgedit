import { describe, it, expect } from 'vitest'
import * as history from '../../packages/svgcanvas/core/history.js'

// Characterization guards for the #74/#75 allocation refactors in history.ts.
// Both refactors are behaviour-preserving, so these pin the exact behaviour the
// refactor must keep — the existing suite only exercises single-subcommand
// batches and never adds a command after an undo, so neither behaviour below was
// otherwise covered.

/** Minimal command that records its apply/unapply into a shared log. */
class TrackCommand extends history.Command {
  constructor (name: string, log: string[]) {
    super()
    this.name = name
    this.log = log
  }

  apply (handler: history.HistoryEventHandler | null) {
    super.apply(handler, () => { this.log.push('apply:' + this.name) })
  }

  unapply (handler: history.HistoryEventHandler | null) {
    super.unapply(handler, () => { this.log.push('unapply:' + this.name) })
  }

  elements () { return [] }
}

describe('history stack-allocation refactors (#74, #75)', () => {
  it('#74 — BatchCommand.unapply runs subcommands in reverse order', () => {
    const log: string[] = []
    const batch = new history.BatchCommand('batch')
    batch.addSubCommand(new TrackCommand('1', log))
    batch.addSubCommand(new TrackCommand('2', log))
    batch.addSubCommand(new TrackCommand('3', log))

    batch.apply(null)
    expect(log).toEqual(['apply:1', 'apply:2', 'apply:3'])

    log.length = 0
    batch.unapply(null)
    expect(log).toEqual(['unapply:3', 'unapply:2', 'unapply:1'])
  })

  it('#75 — a command added after an undo discards the redo tail', () => {
    const um = new history.UndoManager()
    um.addCommandToHistory(new TrackCommand('a', []))
    um.addCommandToHistory(new TrackCommand('b', []))
    um.addCommandToHistory(new TrackCommand('c', []))

    um.undo()
    um.undo()
    expect(um.getUndoStackSize()).toBe(1)
    expect(um.getRedoStackSize()).toBe(2)

    um.addCommandToHistory(new TrackCommand('d', []))
    expect(um.getUndoStackSize()).toBe(2)
    expect(um.getRedoStackSize()).toBe(0)

    // The discarded tail must not be redoable.
    um.redo()
    expect(um.getUndoStackSize()).toBe(2)
    expect(um.getRedoStackSize()).toBe(0)
  })
})
