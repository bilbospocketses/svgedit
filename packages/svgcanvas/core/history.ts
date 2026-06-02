 
/**
 * For command history tracking and undo functionality.
 * @module history
 * @license MIT
 */

import { NS } from './namespaces.js'
import { getHref, setHref, getRotationAngle, getBBox } from './utilities.js'
import { getTransformList, transformListToTransform, transformPoint } from './math.js'

/** SVG attributes that affect an element's bounding box; only these trigger rotation-center recalculation on change. */
export const BBOX_AFFECTING_ATTRS: Set<string> = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'd', 'points'
])

/**
* Relocate rotation center after a bbox-affecting attribute change.
* Uses the transform list API to update only the rotation entry,
* preserving compound transforms (translate, scale, etc.).
* @param elem - SVG element
* @param changedAttrs - attribute names that were changed
*/
function relocateRotationCenter (elem: Element, changedAttrs: string[]): void {
  const hasBboxChange = changedAttrs.some(attr => BBOX_AFFECTING_ATTRS.has(attr))
  if (!hasBboxChange) return

  const angle = getRotationAngle(elem)
  if (!angle) return

  const tlist = getTransformList(elem)
  if (!tlist) return
  const svgElem = (elem as SVGElement).ownerSVGElement
  if (!svgElem) return
  let n = tlist.numberOfItems
  while (n--) {
    const xform = tlist.getItem(n)
    if (xform.type === 4) { // SVG_TRANSFORM_ROTATE
      // Compute bbox BEFORE removing the rotation so we can bail out
      // safely if getBBox returns nothing (avoids losing the rotation).
      const box = getBBox(elem)
      if (!box) return

      tlist.removeItem(n)

      // Transform bbox center through only post-rotation transforms.
      // After removeItem(n), what was at n+1 is now at n.
      let centerMatrix: SVGMatrix
      if (n < tlist.numberOfItems) {
        centerMatrix = transformListToTransform(tlist, n, tlist.numberOfItems - 1).matrix
      } else {
        centerMatrix = svgElem.createSVGMatrix() // identity
      }
      const center = transformPoint(
        box.x + box.width / 2, box.y + box.height / 2, centerMatrix
      )

      const newrot = svgElem.createSVGTransform()
      newrot.setRotate(angle, center.x, center.y)
      tlist.insertItemBefore(newrot, n)
      break
    }
  }
}

/** Event type string constants fired before/after apply and unapply operations on history commands. */
export const HistoryEventTypes: {
  BEFORE_APPLY: string
  AFTER_APPLY: string
  BEFORE_UNAPPLY: string
  AFTER_UNAPPLY: string
} = {
  BEFORE_APPLY: 'before_apply',
  AFTER_APPLY: 'after_apply',
  BEFORE_UNAPPLY: 'before_unapply',
  AFTER_UNAPPLY: 'after_unapply'
}

/** Interface for history event handlers. */
export interface HistoryEventHandler {
  handleHistoryEvent(eventType: string, cmd: Command): void
}

/**
* Base class for commands.
*/
export class Command {
  text: string = ''
  elem: Element = null as unknown as Element

  getText (): string {
    return this.text
  }

  /**
   * @param [applyFunction] - Subclass-supplied continuation that performs the actual apply.
   *   The base no-op apply on the abstract Command class is unused at runtime; subclasses
   *   override apply(handler) and call super.apply(handler, () => { ... }).
  */
  apply (handler: HistoryEventHandler | null, applyFunction?: (handler: HistoryEventHandler | null) => void): void {
    if (handler) handler.handleHistoryEvent(HistoryEventTypes.BEFORE_APPLY, this)
    applyFunction?.(handler)
    if (handler) handler.handleHistoryEvent(HistoryEventTypes.AFTER_APPLY, this)
  }

  /**
   * @param [unapplyFunction]
  */
  unapply (handler: HistoryEventHandler | null, unapplyFunction?: () => void): void {
    if (handler) handler.handleHistoryEvent(HistoryEventTypes.BEFORE_UNAPPLY, this)
    unapplyFunction?.()
    if (handler) handler.handleHistoryEvent(HistoryEventTypes.AFTER_UNAPPLY, this)
  }

  /**
   * @returns Array with element associated with this command
   * This function needs to be surcharged if multiple elements are returned.
  */
  elements (): Element[] {
    return [this.elem]
  }

  /**
    * Returns the command class name for display/debugging.
  */
  type (): string {
    return this.constructor.name
  }
}

/**
 * History command for an element that had its DOM position changed.
*/
export class MoveElementCommand extends Command {
  oldNextSibling: Node | null
  oldParent: Node
  newNextSibling: Node | null
  newParent: Node | null

  /**
  * @param elem - The DOM element that was moved
  * @param oldNextSibling - The element's next sibling before it was moved
  * @param oldParent - The element's parent before it was moved
  * @param [text] - An optional string visible to user related to this change
  */
  constructor (elem: Element, oldNextSibling: Node | null, oldParent: Node, text?: string) {
    super()
    this.elem = elem
    this.text = text ? `Move ${elem.tagName} to ${text}` : `Move ${elem.tagName}`
    this.oldNextSibling = oldNextSibling
    this.oldParent = oldParent
    this.newNextSibling = elem.nextSibling
    this.newParent = elem.parentNode
  }

  /**
   * Re-positions the element.
  */
  apply (handler: HistoryEventHandler | null): void {
    super.apply(handler, () => {
      const reference =
        this.newNextSibling && this.newNextSibling.parentNode === this.newParent
          ? this.newNextSibling
          : null
      if (this.newParent) {
        this.elem = this.newParent.insertBefore(this.elem, reference)
      }
    })
  }

  /**
   * Positions the element back to its original location.
  */
  unapply (handler: HistoryEventHandler | null): void {
    super.unapply(handler, () => {
      const reference =
        this.oldNextSibling && this.oldNextSibling.parentNode === this.oldParent
          ? this.oldNextSibling
          : null
      this.elem = this.oldParent.insertBefore(this.elem, reference)
    })
  }
}

/**
* History command for an element that was added to the DOM.
*/
export class InsertElementCommand extends Command {
  parent: Node | null
  nextSibling: Node | null

  /**
   * @param elem - The newly added DOM element
   * @param [text] - An optional string visible to user related to this change
  */
  constructor (elem: Element, text?: string) {
    super()
    this.elem = elem
    this.text = text || `Create ${elem.tagName}`
    this.parent = elem.parentNode
    this.nextSibling = this.elem.nextSibling
  }

  /**
  * Re-inserts the new element.
  */
  apply (handler: HistoryEventHandler | null): void {
    super.apply(handler, () => {
      const reference =
        this.nextSibling && this.nextSibling.parentNode === this.parent
          ? this.nextSibling
          : null
      if (this.parent) {
        this.elem = this.parent.insertBefore(this.elem, reference)
      }
    })
  }

  /**
  * Removes the element.
  */
  unapply (handler: HistoryEventHandler | null): void {
    super.unapply(handler, () => {
      this.parent = this.elem.parentNode
      this.elem.remove()
    })
  }
}

/**
* History command for an element removed from the DOM.
*/
export class RemoveElementCommand extends Command {
  nextSibling: Node | null
  parent: Node

  /**
  * @param elem - The removed DOM element
  * @param oldNextSibling - The DOM element's nextSibling when it was in the DOM
  * @param oldParent - The DOM element's parent
  * @param [text] - An optional string visible to user related to this change
  */
  constructor (elem: Element, oldNextSibling: Node | null, oldParent: Node, text?: string) {
    super()
    this.elem = elem
    this.text = text || `Delete ${elem.tagName}`
    this.nextSibling = oldNextSibling
    this.parent = oldParent
  }

  /**
  * Re-removes the new element.
  */
  apply (handler: HistoryEventHandler | null): void {
    super.apply(handler, () => {
      this.parent = this.elem.parentNode ?? this.parent
      this.elem.remove()
    })
  }

  /**
  * Re-adds the new element.
  */
  unapply (handler: HistoryEventHandler | null): void {
    super.unapply(handler, () => {
      const reference =
        this.nextSibling && this.nextSibling.parentNode === this.parent
          ? this.nextSibling
          : null
      this.parent.insertBefore(this.elem, reference) // Don't use `before` or `prepend` as `reference` may be `null`
    })
  }
}

/** Attributes map: attribute name → old value (before change). */
export type CommandAttributes = Record<string, string | null>

/**
* History command to make a change to an element.
* Usually an attribute change, but can also be textcontent.
*/
export class ChangeElementCommand extends Command {
  newValues: CommandAttributes
  oldValues: CommandAttributes

  /**
  * @param elem - The DOM element that was changed
  * @param attrs - Attributes to be changed with the values they had *before* the change
  * @param [text] - An optional string visible to user related to this change
   */
  constructor (elem: Element, attrs: CommandAttributes, text?: string) {
    super()
    this.elem = elem
    this.text = text ? `Change ${elem.tagName} ${text}` : `Change ${elem.tagName}`
    this.newValues = {}
    this.oldValues = attrs
    for (const attr in attrs) {
      if (attr === '#text') {
        this.newValues[attr] = (elem) ? elem.textContent : ''
      } else if (attr === '#href') {
        this.newValues[attr] = getHref(elem)
      } else {
        this.newValues[attr] = elem.getAttribute(attr)
      }
    }
  }

  /**
  * Performs the stored change action.
  */
  apply (handler: HistoryEventHandler | null): void {
    super.apply(handler, () => {
      let bChangedTransform = false
      Object.entries(this.newValues).forEach(([attr, value]) => {
        const isNullishOrEmpty = value === null || value === undefined || value === ''
        if (attr === '#text') {
          this.elem.textContent = value === null || value === undefined ? '' : String(value)
        } else if (attr === '#href') {
          if (isNullishOrEmpty) {
            this.elem.removeAttribute('href')
            this.elem.removeAttributeNS(NS.XLINK, 'href')
          } else {
            setHref(this.elem, String(value))
          }
        } else if (isNullishOrEmpty) {
          this.elem.setAttribute(attr, '')
          this.elem.removeAttribute(attr)
        } else {
          this.elem.setAttribute(attr, value)
        }

        if (attr === 'transform') { bChangedTransform = true }
      })

      // relocate rotational transform, if necessary
      if (!bChangedTransform) {
        relocateRotationCenter(this.elem, Object.keys(this.newValues))
      }
    })
  }

  /**
  * Reverses the stored change action.
  */
  unapply (handler: HistoryEventHandler | null): void {
    super.unapply(handler, () => {
      let bChangedTransform = false
      Object.entries(this.oldValues).forEach(([attr, value]) => {
        const isNullishOrEmpty = value === null || value === undefined || value === ''
        if (attr === '#text') {
          this.elem.textContent = value === null || value === undefined ? '' : String(value)
        } else if (attr === '#href') {
          if (isNullishOrEmpty) {
            this.elem.removeAttribute('href')
            this.elem.removeAttributeNS(NS.XLINK, 'href')
          } else {
            setHref(this.elem, String(value))
          }
        } else if (isNullishOrEmpty) {
          this.elem.removeAttribute(attr)
        } else {
          this.elem.setAttribute(attr, value)
        }
        if (attr === 'transform') { bChangedTransform = true }
      })
      // relocate rotational transform, if necessary
      if (!bChangedTransform) {
        relocateRotationCenter(this.elem, Object.keys(this.oldValues))
      }
    })
  }
}

function unwrapTextChange (cmd: Command): ChangeElementCommand | null {
  if (cmd instanceof ChangeElementCommand && '#text' in cmd.oldValues) return cmd
  if (cmd instanceof BatchCommand && cmd.stack.length === 1) {
    const sub = cmd.stack[0]
    if (sub) return unwrapTextChange(sub)
  }
  return null
}

/**
* History command that can contain/execute multiple other commands.
*/
export class BatchCommand extends Command {
  stack: Command[]

  /**
  * @param [text] - An optional string visible to user related to this change
  */
  constructor (text?: string) {
    super()
    this.text = text || 'Batch Command'
    this.stack = []
  }

  /**
  * Runs "apply" on all subcommands.
  * @param handler
  */
  apply (handler: HistoryEventHandler | null): void {
    super.apply(handler, () => {
      this.stack.forEach((stackItem) => {
        console.assert(!!stackItem, 'stack item should not be null')
        if (stackItem) stackItem.apply(handler)
      })
    })
  }

  /**
  * Runs "unapply" on all subcommands.
  * @param handler
  */
  unapply (handler: HistoryEventHandler | null): void {
    super.unapply(handler, () => {
      ;[...this.stack].reverse().forEach((stackItem) => {
        console.assert(!!stackItem, 'stack item should not be null')
        if (stackItem) stackItem.unapply(handler)
      })
    })
  }

  /**
  * Iterate through all our subcommands.
  * @returns All the elements we are changing
  */
  elements (): Element[] {
    const elems: Element[] = []
    let cmd = this.stack.length
    while (cmd--) {
      const stackCmd = this.stack[cmd]
      if (!stackCmd) continue
      const thisElems = stackCmd.elements()
      let elem = thisElems.length
      while (elem--) {
        const thisElem = thisElems[elem]
        if (thisElem && !elems.includes(thisElem)) { elems.push(thisElem) }
      }
    }
    return elems
  }

  /**
  * Adds a given command to the history stack.
  * @param cmd - The undo command object to add
  */
  addSubCommand (cmd: Command): void {
    console.assert(cmd !== null, 'cmd should not be null')
    this.stack.push(cmd)
  }

  /**
  * Returns true when no subcommands have been added.
  */
  isEmpty (): boolean {
    return !this.stack.length
  }
}

/** Changeset entry used in beginUndoableChange / finishUndoableChange. */
interface UndoableChangeEntry {
  attrName: string
  oldValues: (string | null)[]
  elements: (Element | null)[]
}

/** Manages the undo/redo command stack, supporting beginUndoableChange/finishUndoableChange for batch attr edits. */
export class UndoManager {
  _handler: HistoryEventHandler | null
  maxHistory: number
  undoStackPointer: number
  undoStack: Command[]
  undoChangeStackPointer: number
  undoableChangeStack: (UndoableChangeEntry | null)[]

  /**
  * @param maxHistory - Maximum undo stack size (oldest entries trimmed when exceeded)
  */
  constructor (historyEventHandler: HistoryEventHandler | null, maxHistory: number = 100) {
    this._handler = historyEventHandler || null
    this.maxHistory = maxHistory
    this.undoStackPointer = 0
    this.undoStack = []

    this.undoChangeStackPointer = -1
    this.undoableChangeStack = []
  }

  /**
  * Resets the undo stack, effectively clearing the undo/redo history.
  */
  resetUndoStack (): void {
    this.undoStack = []
    this.undoStackPointer = 0
  }

  /**
  * Returns the number of commands available to undo.
  */
  getUndoStackSize (): number {
    return this.undoStackPointer
  }

  /**
  * Returns the number of commands available to redo.
  */
  getRedoStackSize (): number {
    return this.undoStack.length - this.undoStackPointer
  }

  /**
  * Returns the display text of the next command that would be undone.
  */
  getNextUndoCommandText (): string {
    return this.undoStackPointer > 0 ? (this.undoStack[this.undoStackPointer - 1]?.getText() ?? '') : ''
  }

  /**
  * Returns the display text of the next command that would be redone.
  */
  getNextRedoCommandText (): string {
    return this.undoStackPointer < this.undoStack.length ? (this.undoStack[this.undoStackPointer]?.getText() ?? '') : ''
  }

  /**
  * Performs an undo step.
  */
  undo (): void {
    if (this.undoStackPointer > 0) {
      const cmd = this.undoStack[--this.undoStackPointer]
      cmd?.unapply(this._handler)
    }
  }

  /**
  * Performs a redo step.
  */
  redo (): void {
    if (this.undoStackPointer < this.undoStack.length && this.undoStack.length > 0) {
      const cmd = this.undoStack[this.undoStackPointer++]
      cmd?.apply(this._handler)
    }
  }

  /**
  * Adds a command object to the undo history stack.
  * @param cmd - The command object to add
  */
  addCommandToHistory (cmd: Command): void {
    if (this.undoStackPointer < this.undoStack.length && this.undoStack.length > 0) {
      this.undoStack = this.undoStack.splice(0, this.undoStackPointer)
    }

    const incoming = unwrapTextChange(cmd)
    const topCmd = this.undoStackPointer > 0 ? this.undoStack[this.undoStackPointer - 1] : undefined
    if (incoming && topCmd) {
      const existing = unwrapTextChange(topCmd)
      if (existing && incoming.elem === existing.elem) {
        existing.newValues['#text'] = incoming.newValues['#text'] ?? null
        return
      }
    }

    this.undoStack.push(cmd)
    this.undoStackPointer = this.undoStack.length

    if (this.undoStack.length > this.maxHistory) {
      const excess = this.undoStack.length - this.maxHistory
      this.undoStack.splice(0, excess)
      this.undoStackPointer -= excess
    }
  }

  /**
  * This function tells the canvas to remember the old values of the
  * `attrName` attribute for each element sent in.  The elements and values
  * are stored on a stack, so the next call to `finishUndoableChange()` will
  * pop the elements and old values off the stack, gets the current values
  * from the DOM and uses all of these to construct the undo-able command.
  * @param attrName - The name of the attribute being changed
  * @param elems - Array of DOM elements being changed
  */
  beginUndoableChange (attrName: string, elems: (Element | null)[]): void {
    const p = ++this.undoChangeStackPointer
    let i = elems.length
    const oldValues: (string | null)[] = new Array<string | null>(i)
    const elements: (Element | null)[] = new Array<Element | null>(i)
    while (i--) {
      const elem = elems[i]
      if (!elem) { continue }
      elements[i] = elem
      oldValues[i] = elem.getAttribute(attrName)
    }
    this.undoableChangeStack[p] = {
      attrName,
      oldValues,
      elements
    }
  }

  /**
  * This function returns a `BatchCommand` object which summarizes the
  * change since `beginUndoableChange` was called.  The command can then
  * be added to the command history.
  * @returns Batch command object with resulting changes
  */
  finishUndoableChange (): BatchCommand {
    const p = this.undoChangeStackPointer--
    const changeset = this.undoableChangeStack[p]
    if (!changeset) {
      return new BatchCommand('Change (empty)')
    }
    const { attrName } = changeset
    const batchCmd = new BatchCommand(`Change ${attrName}`)
    let i = changeset.elements.length
    while (i--) {
      const elem = changeset.elements[i]
      if (!elem) { continue }
      const changes: CommandAttributes = {}
      changes[attrName] = changeset.oldValues[i] ?? null
      if (changes[attrName] !== elem.getAttribute(attrName)) {
        batchCmd.addSubCommand(new ChangeElementCommand(elem, changes, attrName))
      }
    }
    this.undoableChangeStack[p] = null
    return batchCmd
  }
}
