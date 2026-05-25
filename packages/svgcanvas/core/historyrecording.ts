/**
 * HistoryRecordingService component of history.
 * @module history
 * @license MIT
 * @copyright 2016 Flint O'Brien
 */

import {
  BatchCommand, MoveElementCommand, InsertElementCommand, RemoveElementCommand,
  ChangeElementCommand, type CommandAttributes
} from './history.js'
import type { UndoManager } from './history.js'

/**
 * History recording service.
 *
 * A self-contained service interface for recording history. Once injected, no other dependencies
 * or globals are required (example: UndoManager, command types, etc.). Easy to mock for unit tests.
 * Built on top of history classes in history.js.
 *
 * There is a simple start/end interface for batch commands.
 *
 * HistoryRecordingService.NO_HISTORY is a singleton that can be passed in to functions
 * that record history. This helps when the caller requires that no history be recorded.
 *
 * The following will record history: insert, batch, insert.
 * @example
 * hrService = new HistoryRecordingService(this.undoMgr);
 * hrService.insertElement(elem, text); // add simple command to history.
 * hrService.startBatchCommand('create two elements');
 * hrService.changeElement(elem, attrs, text); // add to batchCommand
 * hrService.changeElement(elem, attrs2, text); // add to batchCommand
 * hrService.endBatchCommand(); // add batch command with two change commands to history.
 * hrService.insertElement(elem, text); // add simple command to history.
 *
 * @example
 * // Note that all functions return this, so commands can be chained, like so:
 * hrService
 *   .startBatchCommand('create two elements')
 *   .insertElement(elem, text)
 *   .changeElement(elem, attrs, text)
 *   .endBatchCommand();
 *
 * @memberof module:history
 */
class HistoryRecordingService {
  #undoManager: UndoManager | null
  #currentBatchCommand: BatchCommand | null
  #batchCommandStack: BatchCommand[]

  /**
  * @param undoManager - The undo manager.
  *     A value of `null` is valid for cases where no history recording is required.
  *     See singleton: {@link HistoryRecordingService.NO_HISTORY}
  */
  constructor (undoManager: UndoManager | null) {
    this.#undoManager = undoManager
    this.#currentBatchCommand = null
    this.#batchCommandStack = []
  }

  /**
   * Start a batch command so multiple commands can recorded as a single history command.
   * Requires a corresponding call to endBatchCommand. Start and end commands can be nested.
   *
   * @param text - Optional string describing the batch command.
   */
  startBatchCommand (text?: string): this {
    if (!this.#undoManager) { return this }
    this.#currentBatchCommand = new BatchCommand(text)
    this.#batchCommandStack.push(this.#currentBatchCommand)
    return this
  }

  /**
   * End a batch command and add it to the history or a parent batch command.
   */
  endBatchCommand (): this {
    if (!this.#undoManager) { return this }
    if (this.#currentBatchCommand) {
      const batchCommand = this.#currentBatchCommand
      this.#batchCommandStack.pop()
      const { length: len } = this.#batchCommandStack
      this.#currentBatchCommand = len ? (this.#batchCommandStack[len - 1] ?? null) : null
      if (!batchCommand.isEmpty()) {
        this.#addCommand(batchCommand)
      }
    }
    return this
  }

  /**
   * Add a `MoveElementCommand` to the history or current batch command.
   * @param elem - The DOM element that was moved
   * @param oldNextSibling - The element's next sibling before it was moved
   * @param oldParent - The element's parent before it was moved
   * @param [text] - An optional string visible to user related to this change
   */
  moveElement (elem: Element, oldNextSibling: Node | null, oldParent: Node, text?: string): this {
    if (!this.#undoManager) { return this }
    this.#addCommand(new MoveElementCommand(elem, oldNextSibling, oldParent, text))
    return this
  }

  /**
   * Add an `InsertElementCommand` to the history or current batch command.
   * @param elem - The DOM element that was added
   * @param [text] - An optional string visible to user related to this change
   */
  insertElement (elem: Element, text?: string): this {
    if (!this.#undoManager) { return this }
    this.#addCommand(new InsertElementCommand(elem, text))
    return this
  }

  /**
   * Add a `RemoveElementCommand` to the history or current batch command.
   * @param elem - The DOM element that was removed
   * @param oldNextSibling - The element's next sibling before it was removed
   * @param oldParent - The element's parent before it was removed
   * @param [text] - An optional string visible to user related to this change
   */
  removeElement (elem: Element, oldNextSibling: Node | null, oldParent: Node, text?: string): this {
    if (!this.#undoManager) { return this }
    this.#addCommand(new RemoveElementCommand(elem, oldNextSibling, oldParent, text))
    return this
  }

  /**
   * Add a `ChangeElementCommand` to the history or current batch command.
   * @param elem - The DOM element that was changed
   * @param attrs - An object with the attributes to be changed and the values they had *before* the change
   * @param [text] - An optional string visible to user related to this change
   */
  changeElement (elem: Element, attrs: CommandAttributes, text?: string): this {
    if (!this.#undoManager) { return this }
    this.#addCommand(new ChangeElementCommand(elem, attrs, text))
    return this
  }

  /**
   * Private function to add a command to the history or current batch command.
   * @private
   * @param cmd
   */
  #addCommand (cmd: BatchCommand | MoveElementCommand | InsertElementCommand | RemoveElementCommand | ChangeElementCommand): undefined {
    if (!this.#undoManager) { return undefined }
    if (this.#currentBatchCommand) {
      this.#currentBatchCommand.addSubCommand(cmd)
    } else {
      this.#undoManager.addCommandToHistory(cmd)
    }
    return undefined
  }
}

/**
 * @property {HistoryRecordingService} NO_HISTORY - Singleton that can be passed to functions that record history, but the caller requires that no history be recorded.
 */
interface HistoryRecordingServiceStatic {
  NO_HISTORY: HistoryRecordingService
}
 
;(HistoryRecordingService as unknown as HistoryRecordingServiceStatic).NO_HISTORY = new HistoryRecordingService(null)

export default HistoryRecordingService
