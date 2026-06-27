import type { ISvgCanvas } from '@svgedit/svgcanvas'

/**
 * Shared live-preview orchestration for numeric toolbar controls (audit #29 item #4).
 *
 * Mirrors `TopPanel.attrChanger`: open ONE undoable change on the first `input`
 * event -- snapshotting the original values BEFORE any preview, which is the fix
 * for the undo-trap (a naive NoUndo preview mutates the element, so a later commit
 * would read the previewed value as the "old" value and undo would only revert to
 * the last preview) -- apply each keystroke with `preventUndo`, then close it into
 * a single command on `change`. A `change` with no prior preview (e.g. a
 * programmatic set) commits directly with undo recording. `finishIfOpen()` is the
 * focusout safety net (tab/click away without a final `change`).
 *
 * One instance per control so concurrent edits of different controls never share
 * an open snapshot.
 */

type UndoMgr = ISvgCanvas['undoMgr']

export class LivePreviewSession {
  private open = false
  private readonly getUndoMgr: () => UndoMgr

  constructor (getUndoMgr: () => UndoMgr) {
    this.getUndoMgr = getUndoMgr
  }

  /**
   * Route an `input`/`change` event for one numeric control.
   * @param eventType - the DOM event type (`input` for live preview, `change` to commit)
   * @param attr - the attribute `beginUndoableChange` should snapshot
   * @param elems - the elements being edited
   * @param apply - applies the current value; receives `preventUndo` (true while
   *   previewing and on the final previewed commit; false for a direct no-preview commit)
   */
  handle (
    eventType: string,
    attr: string,
    elems: (Element | null)[],
    apply: (preventUndo: boolean) => void
  ): void {
    if (eventType === 'input') {
      if (!this.open) {
        this.getUndoMgr().beginUndoableChange(attr, elems)
        this.open = true
      }
      apply(true)
    } else if (this.open) {
      // Commit the previewed edit: apply the final value (still no per-keystroke
      // command), then close the change opened at the first keystroke -> one undo
      // entry spanning original -> final.
      apply(true)
      this.commit()
    } else {
      // No preview ran (programmatic change, or a commit with no prior input) --
      // commit directly with undo recording.
      apply(false)
    }
  }

  /** Close an open preview session without applying a new value (focusout safety net). */
  finishIfOpen (): void {
    if (this.open) { this.commit() }
  }

  private commit (): void {
    this.open = false
    const undoMgr = this.getUndoMgr()
    const cmd = undoMgr.finishUndoableChange()
    if (!cmd.isEmpty()) { undoMgr.addCommandToHistory(cmd) }
  }
}
