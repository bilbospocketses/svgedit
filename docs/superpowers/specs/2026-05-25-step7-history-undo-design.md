# Step 7: History/Undo Correctness — Typing Compression + Stack Size Limit

> **Date:** 2026-05-25
> **Status:** Design approved

## Problem

Every keystroke while editing text pushes a separate `ChangeElementCommand` to the undo stack containing the full `textContent`. Typing "hello" = 5 undo entries. No stack size limit means long sessions grow memory without bound.

## Undo chain (current)

```
keyup/input on hidden <input#text>
→ EditorStartup.ts:300 — setTextContent(fullInputValue)
→ elem-get-set.ts:872 — changeSelectedAttribute('#text', val)
→ undo.ts:298 — beginUndoableChange + changeNoUndo + finishUndoableChange
→ history.ts:567 — addCommandToHistory(batchCmd)  ← one per keystroke
```

Each `BatchCommand` wraps a single `ChangeElementCommand` with `oldValues: { '#text': previousFullText }` and `newValues: { '#text': currentFullText }`.

## Design

### 1. Typing-undo compression (in `addCommandToHistory`)

**Approach:** Collapse at the entry point. When a new command arrives at `addCommandToHistory`, check if it and the stack top are both single-`#text` `ChangeElementCommand`s targeting the same element. If so, update the top command's `newValues['#text']` to the incoming value and discard the new command. The top's `oldValues['#text']` stays as-is — preserving the text from before the typing session began.

**Detection heuristic:**

```typescript
function isTextChangeCommand (cmd: Command): cmd is ChangeElementCommand {
  if (cmd instanceof ChangeElementCommand && '#text' in cmd.oldValues) return true
  if (cmd instanceof BatchCommand && cmd.stack.length === 1) {
    return isTextChangeCommand(cmd.stack[0])
  }
  return false
}
```

`changeSelectedAttribute` wraps every change in a `BatchCommand` via `beginUndoableChange/finishUndoableChange`. So the incoming command will be a `BatchCommand` with one `ChangeElementCommand` sub-command. The helper unwraps one level.

**Collapse logic in `addCommandToHistory`:**

```typescript
// Before pushing, try to collapse consecutive text edits
const top = this.undoStackPointer > 0 ? this.undoStack[this.undoStackPointer - 1] : null
if (top && isTextChangeCommand(cmd) && isTextChangeCommand(top)) {
  const incoming = unwrapTextChange(cmd)
  const existing = unwrapTextChange(top)
  if (incoming.elem === existing.elem) {
    existing.newValues['#text'] = incoming.newValues['#text']
    return  // don't push, just updated the top
  }
}
```

**What breaks the chain:** Any non-text command (move, fill change, attribute edit, etc.) pushes normally and becomes the new top. The next text change starts a fresh entry. Element deselection + reselection also breaks it because the element reference changes.

**No timer needed.** The chain is broken by any interleaving action, which covers all real editing patterns (click elsewhere, change tool, modify another property).

### 2. History stack size limit

**Config field:** Add `maxUndoHistory: number` to the `Config` interface in `ConfigObj.ts`, default `100`.

**Enforcement in `addCommandToHistory`:** After pushing (or collapsing), if `this.undoStack.length > maxUndoHistory`, trim from the front:

```typescript
const max = svgCanvas?.configObj?.curConfig?.maxUndoHistory ?? 100
if (this.undoStack.length > max) {
  const excess = this.undoStack.length - max
  this.undoStack.splice(0, excess)
  this.undoStackPointer = Math.max(0, this.undoStackPointer - excess)
}
```

The `undoStackPointer` adjustment is critical — it's an index into `undoStack`, so removing entries from the front shifts it.

**Access pattern:** `UndoManager` currently has no reference to `svgCanvas` or config. Two options:
- (a) Pass `maxUndoHistory` into the constructor or a setter
- (b) Pass it as a parameter to `addCommandToHistory`

Option (a) is cleaner — add a `maxHistory` field set during `UndoManager` construction (which happens in `svgcanvas.ts` constructor where config is available). Default to `100` if not provided.

## Files touched

| File | Change |
|------|--------|
| `packages/svgcanvas/core/history.ts` | `isTextChangeCommand` helper + collapse logic in `addCommandToHistory` + stack trim + `maxHistory` field on `UndoManager` |
| `src/editor/ConfigObj.ts` | Add `maxUndoHistory: number` to `Config` interface + default `100` in `defaultConfig` |
| `packages/svgcanvas/svgcanvas.ts` | Pass `maxUndoHistory` to `UndoManager` constructor |
| `tests/unit/history*.test.js` or new test file | Tests for compression + stack limit |

## Testing

**Typing compression:**
- Push 5 consecutive `#text` ChangeElementCommands to the same element → stack size should be 1 (not 5)
- Undo that single entry → text reverts to original (pre-typing) value
- Interleave a non-text command between text edits → stack has 3 entries (text, other, text)
- Text changes to different elements → no compression (2 entries)

**Stack size limit:**
- Set maxHistory=5, push 10 commands → stack size is 5, oldest 5 are gone
- Undo pointer adjusts correctly after trim
- Redo still works after trim

## What this does NOT cover

- Compression for non-text attribute changes (drag moves, color changes, etc.) — different problem, different heuristic
- Debouncing the `keyup`/`input` events in `EditorStartup.ts` — would reduce command frequency but the compression handles it cleaner at the undo layer
