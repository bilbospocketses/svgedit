# Step 7: History/Undo Compression + Stack Limit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse consecutive text-typing undo entries into one and cap the undo stack at a configurable maximum (default 100).

**Architecture:** Both features live in `UndoManager.addCommandToHistory()`. Typing compression checks if the incoming command and stack top are both `#text` `ChangeElementCommand`s on the same element, and if so updates the top in-place. Stack limit trims oldest entries after each push. A `maxHistory` constructor parameter feeds from `Config.maxUndoHistory`.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Create branch + write typing-compression tests

**Files:**
- Test: `tests/unit/history.test.js` (append to existing file)

- [ ] **Step 1: Create feature branch**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feat/step-7-history-undo
```

- [ ] **Step 2: Add typing-compression tests to history.test.js**

Append these tests inside the existing `describe('history', ...)` block, after the last `it(...)` (after line 593's closing `}`):

```javascript
  it('compresses consecutive #text changes to the same element', function () {
    const svg = document.createElementNS(NS.SVG, 'svg')
    document.body.append(svg)
    const textEl = document.createElementNS(NS.SVG, 'text')
    svg.append(textEl)

    // Simulate typing "abc" — 3 consecutive #text changes
    textEl.textContent = 'a'
    const cmd1 = new history.BatchCommand('Change #text')
    cmd1.addSubCommand(new history.ChangeElementCommand(textEl, { '#text': '' }))
    undoMgr.addCommandToHistory(cmd1)

    textEl.textContent = 'ab'
    const cmd2 = new history.BatchCommand('Change #text')
    cmd2.addSubCommand(new history.ChangeElementCommand(textEl, { '#text': 'a' }))
    undoMgr.addCommandToHistory(cmd2)

    textEl.textContent = 'abc'
    const cmd3 = new history.BatchCommand('Change #text')
    cmd3.addSubCommand(new history.ChangeElementCommand(textEl, { '#text': 'ab' }))
    undoMgr.addCommandToHistory(cmd3)

    // All 3 collapsed into 1 entry
    assert.equal(undoMgr.getUndoStackSize(), 1)

    // Undo reverts to original empty text
    undoMgr.undo()
    assert.equal(textEl.textContent, '')
    assert.equal(undoMgr.getUndoStackSize(), 0)

    // Redo restores final text
    undoMgr.redo()
    assert.equal(textEl.textContent, 'abc')

    svg.remove()
  })

  it('does not compress #text changes to different elements', function () {
    const svg = document.createElementNS(NS.SVG, 'svg')
    document.body.append(svg)
    const textEl1 = document.createElementNS(NS.SVG, 'text')
    const textEl2 = document.createElementNS(NS.SVG, 'text')
    svg.append(textEl1, textEl2)

    textEl1.textContent = 'a'
    const cmd1 = new history.BatchCommand('Change #text')
    cmd1.addSubCommand(new history.ChangeElementCommand(textEl1, { '#text': '' }))
    undoMgr.addCommandToHistory(cmd1)

    textEl2.textContent = 'x'
    const cmd2 = new history.BatchCommand('Change #text')
    cmd2.addSubCommand(new history.ChangeElementCommand(textEl2, { '#text': '' }))
    undoMgr.addCommandToHistory(cmd2)

    assert.equal(undoMgr.getUndoStackSize(), 2)

    svg.remove()
  })

  it('breaks compression chain when non-text command intervenes', function () {
    const svg = document.createElementNS(NS.SVG, 'svg')
    document.body.append(svg)
    const textEl = document.createElementNS(NS.SVG, 'text')
    svg.append(textEl)

    textEl.textContent = 'a'
    const cmd1 = new history.BatchCommand('Change #text')
    cmd1.addSubCommand(new history.ChangeElementCommand(textEl, { '#text': '' }))
    undoMgr.addCommandToHistory(cmd1)

    // Non-text command breaks the chain
    undoMgr.addCommandToHistory(new MockCommand('move'))

    textEl.textContent = 'ab'
    const cmd3 = new history.BatchCommand('Change #text')
    cmd3.addSubCommand(new history.ChangeElementCommand(textEl, { '#text': 'a' }))
    undoMgr.addCommandToHistory(cmd3)

    assert.equal(undoMgr.getUndoStackSize(), 3)

    svg.remove()
  })
```

- [ ] **Step 3: Run tests — expect 3 new tests to FAIL**

```bash
cd C:/Users/jscha/source/repos/svgedit && npx vitest run tests/unit/history.test.js
```

Expected: 3 failures (compression not yet implemented).

- [ ] **Step 4: Commit failing tests**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/unit/history.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(history): add typing-compression tests (red)"
```

---

## Task 2: Implement typing-undo compression

**Files:**
- Modify: `packages/svgcanvas/core/history.ts` — `addCommandToHistory` method + helper functions

- [ ] **Step 1: Add helper functions before the `UndoManager` class**

At `history.ts`, replace the TODO comment block at lines 392-394:

```typescript
// TODO: create a 'typing' command object that tracks changes in text
// if a new Typing command is created and the top command on the stack is also a Typing
// and they both affect the same element, then collapse the two commands into one
```

With:

```typescript
function unwrapTextChange (cmd: Command): ChangeElementCommand | null {
  if (cmd instanceof ChangeElementCommand && '#text' in cmd.oldValues) return cmd
  if (cmd instanceof BatchCommand && cmd.stack.length === 1) {
    return unwrapTextChange(cmd.stack[0])
  }
  return null
}
```

- [ ] **Step 2: Add compression logic to `addCommandToHistory`**

In the `addCommandToHistory` method (line 567), replace the existing body:

```typescript
  addCommandToHistory (cmd: Command): void {
    // TODO: we MUST compress consecutive text changes to the same element
    // (right now each keystroke is saved as a separate command that includes the
    // entire text contents of the text element)
    // TODO: consider limiting the history that we store here (need to do some slicing)

    // if our stack pointer is not at the end, then we have to remove
    // all commands after the pointer and insert the new command
    // (pre-existing audit-flagged behavior — see todo #10: typing-undo compression; no stack size limit)
    if (this.undoStackPointer < this.undoStack.length && this.undoStack.length > 0) {
      this.undoStack = this.undoStack.splice(0, this.undoStackPointer)
    }
    this.undoStack.push(cmd)
    this.undoStackPointer = this.undoStack.length
  }
```

With:

```typescript
  addCommandToHistory (cmd: Command): void {
    if (this.undoStackPointer < this.undoStack.length && this.undoStack.length > 0) {
      this.undoStack = this.undoStack.splice(0, this.undoStackPointer)
    }

    const incoming = unwrapTextChange(cmd)
    if (incoming && this.undoStackPointer > 0) {
      const existing = unwrapTextChange(this.undoStack[this.undoStackPointer - 1])
      if (existing && incoming.elem === existing.elem) {
        existing.newValues['#text'] = incoming.newValues['#text']
        return
      }
    }

    this.undoStack.push(cmd)
    this.undoStackPointer = this.undoStack.length
  }
```

- [ ] **Step 3: Run tests — expect all to PASS**

```bash
cd C:/Users/jscha/source/repos/svgedit && npx vitest run tests/unit/history.test.js
```

Expected: all tests pass including the 3 new compression tests.

- [ ] **Step 4: Run full vitest to verify no regressions**

```bash
cd C:/Users/jscha/source/repos/svgedit && npx vitest run
```

Expected: 698/698 (695 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add packages/svgcanvas/core/history.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(history): compress consecutive text-typing undo entries

Consecutive #text ChangeElementCommands targeting the same element
are collapsed in-place — the stack top's newValues are updated and
the incoming command is discarded. Preserves the original oldValues
so a single undo reverts to pre-typing-session text."
```

---

## Task 3: Write stack-limit tests + implement

**Files:**
- Test: `tests/unit/history.test.js` (append)
- Modify: `packages/svgcanvas/core/history.ts` — `UndoManager` constructor + `addCommandToHistory`

- [ ] **Step 1: Add stack-limit tests**

Append inside the `describe('history', ...)` block:

```javascript
  it('enforces maxHistory stack size limit', function () {
    const mgr = new history.UndoManager(null, 5)

    for (let i = 0; i < 10; i++) {
      mgr.addCommandToHistory(new MockCommand(`cmd${i}`))
    }

    assert.equal(mgr.getUndoStackSize(), 5)
    assert.equal(mgr.getNextUndoCommandText(), 'cmd9')

    // Oldest commands are gone — only cmd5..cmd9 remain
    mgr.undo()
    assert.equal(mgr.getNextUndoCommandText(), 'cmd8')
    mgr.undo()
    mgr.undo()
    mgr.undo()
    assert.equal(mgr.getNextUndoCommandText(), '')
    assert.equal(mgr.getUndoStackSize(), 0)
    assert.equal(mgr.getRedoStackSize(), 5)
  })

  it('adjusts undo pointer correctly after stack trim', function () {
    const mgr = new history.UndoManager(null, 3)

    mgr.addCommandToHistory(new MockCommand('a'))
    mgr.addCommandToHistory(new MockCommand('b'))
    mgr.addCommandToHistory(new MockCommand('c'))
    assert.equal(mgr.getUndoStackSize(), 3)

    // Undo once, then add new — trims redo + enforces cap
    mgr.undo()
    mgr.addCommandToHistory(new MockCommand('d'))
    assert.equal(mgr.getUndoStackSize(), 3)
    assert.equal(mgr.getRedoStackSize(), 0)
    assert.equal(mgr.getNextUndoCommandText(), 'd')

    // Push one more to exceed cap
    mgr.addCommandToHistory(new MockCommand('e'))
    assert.equal(mgr.getUndoStackSize(), 3)
    assert.equal(mgr.getNextUndoCommandText(), 'e')

    mgr.undo()
    mgr.undo()
    assert.equal(mgr.getNextUndoCommandText(), 'c')
  })

  it('defaults to 100 when no maxHistory is provided', function () {
    const mgr = new history.UndoManager(null)

    for (let i = 0; i < 110; i++) {
      mgr.addCommandToHistory(new MockCommand(`cmd${i}`))
    }

    assert.equal(mgr.getUndoStackSize(), 100)
    assert.equal(mgr.getNextUndoCommandText(), 'cmd109')
  })
```

- [ ] **Step 2: Run tests — expect 3 new tests to FAIL**

```bash
cd C:/Users/jscha/source/repos/svgedit && npx vitest run tests/unit/history.test.js
```

Expected: 3 failures (stack limit not yet implemented).

- [ ] **Step 3: Add `maxHistory` parameter to UndoManager constructor**

In `history.ts`, update the `UndoManager` class:

Change the field declarations (after line 491):

```typescript
export class UndoManager {
  _handler: HistoryEventHandler | null
  undoStackPointer: number
  undoStack: Command[]
  undoChangeStackPointer: number
  undoableChangeStack: (UndoableChangeEntry | null)[]
```

To:

```typescript
export class UndoManager {
  _handler: HistoryEventHandler | null
  maxHistory: number
  undoStackPointer: number
  undoStack: Command[]
  undoChangeStackPointer: number
  undoableChangeStack: (UndoableChangeEntry | null)[]
```

Change the constructor signature and body:

```typescript
  constructor (historyEventHandler: HistoryEventHandler | null) {
    this._handler = historyEventHandler || null
    this.undoStackPointer = 0
    this.undoStack = []
```

To:

```typescript
  constructor (historyEventHandler: HistoryEventHandler | null, maxHistory: number = 100) {
    this._handler = historyEventHandler || null
    this.maxHistory = maxHistory
    this.undoStackPointer = 0
    this.undoStack = []
```

- [ ] **Step 4: Add stack trimming at the end of `addCommandToHistory`**

After `this.undoStackPointer = this.undoStack.length`, add:

```typescript
    if (this.undoStack.length > this.maxHistory) {
      const excess = this.undoStack.length - this.maxHistory
      this.undoStack.splice(0, excess)
      this.undoStackPointer -= excess
    }
```

The full method should now be:

```typescript
  addCommandToHistory (cmd: Command): void {
    if (this.undoStackPointer < this.undoStack.length && this.undoStack.length > 0) {
      this.undoStack = this.undoStack.splice(0, this.undoStackPointer)
    }

    const incoming = unwrapTextChange(cmd)
    if (incoming && this.undoStackPointer > 0) {
      const existing = unwrapTextChange(this.undoStack[this.undoStackPointer - 1])
      if (existing && incoming.elem === existing.elem) {
        existing.newValues['#text'] = incoming.newValues['#text']
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
```

- [ ] **Step 5: Run tests — all should PASS**

```bash
cd C:/Users/jscha/source/repos/svgedit && npx vitest run tests/unit/history.test.js
```

- [ ] **Step 6: Run full vitest**

```bash
cd C:/Users/jscha/source/repos/svgedit && npx vitest run
```

Expected: 701/701 (695 + 6 new).

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add packages/svgcanvas/core/history.ts tests/unit/history.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(history): add configurable undo stack size limit (default 100)

UndoManager constructor accepts maxHistory parameter. After each
push, excess entries are trimmed from the front with pointer
adjustment. Prevents unbounded memory growth in long sessions."
```

---

## Task 4: Config plumbing + wire into svgcanvas

**Files:**
- Modify: `src/editor/ConfigObj.ts` — add `maxUndoHistory` to Config interface + default
- Modify: `packages/svgcanvas/core/undo.ts` — pass config value to UndoManager constructor

- [ ] **Step 1: Add `maxUndoHistory` to Config interface**

In `ConfigObj.ts`, inside the `interface Config` block (after the `layerView: boolean` line, before `extensions: string[]`):

Add:

```typescript
  maxUndoHistory: number
```

- [ ] **Step 2: Add default value to `defaultConfig`**

In `ConfigObj.ts`, inside the `this.defaultConfig = {` object (after `layerView: false`), add:

```typescript
      maxUndoHistory: 100,
```

- [ ] **Step 3: Wire config into UndoManager construction**

In `packages/svgcanvas/core/undo.ts`, the `getUndoManager` function at line 35 creates `new UndoManager(handler)`. Update it to pass `maxUndoHistory`:

Change:

```typescript
export const getUndoManager = (): InstanceType<typeof UndoManager> => {
  return new UndoManager({
```

To:

```typescript
export const getUndoManager = (): InstanceType<typeof UndoManager> => {
  const max: number = svgCanvas?.configObj?.curConfig?.maxUndoHistory ?? 100
  return new UndoManager({
```

And change the closing of the handler object + UndoManager constructor call. Find the line where the handler object closes and UndoManager construction ends (should be a `})` pattern). Change:

```typescript
    }
  })
```

To:

```typescript
    }
  }, max)
```

- [ ] **Step 4: Run tsc + lint + full vitest**

```bash
cd C:/Users/jscha/source/repos/svgedit
npx tsc --build packages/svgcanvas/tsconfig.json --force && npx tsc --noEmit
npm run lint
npx vitest run
```

Expected: tsc 0, lint 0, vitest 701/701.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/ConfigObj.ts packages/svgcanvas/core/undo.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore: wire Config.maxUndoHistory into UndoManager construction

Config interface gains maxUndoHistory (default 100). undo.ts passes
the value to the UndoManager constructor at canvas initialization."
```

---

## Task 5: CHANGELOG + e2e gate + PR

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry**

Under `## [Unreleased]`, before the PR-6 entry, add:

```markdown
### Changed (Step 7 — history/undo compression + stack limit — 2026-05-25)

**Typing-undo compression:** Consecutive text-editing keystrokes now collapse into a single undo entry. Previously every keystroke pushed a separate command with the full `textContent`. A single undo now reverts to the text before the typing session began.

**Stack size limit:** Undo history is capped at `maxUndoHistory` (default 100, configurable via `Config.maxUndoHistory`). Oldest entries are trimmed when the cap is exceeded. Prevents unbounded memory growth in long sessions.

**Verification:** tsc 0 / lint 0e+0w / vitest N/N / e2e N/N.
```

- [ ] **Step 2: Run full verification gate**

```bash
cd C:/Users/jscha/source/repos/svgedit
npx tsc --build packages/svgcanvas/tsconfig.json --force && npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx tsx scripts/run-e2e.ts
```

- [ ] **Step 3: Update CHANGELOG with actual test counts, commit**

- [ ] **Step 4: Push and create PR**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/step-7-history-undo
gh pr create --repo bilbospocketses/svgedit --title "feat(history): Step 7 — typing-undo compression + stack size limit" --body "..."
```

- [ ] **Step 5: Wait for CI, squash-merge**

```bash
gh pr merge <N> --repo bilbospocketses/svgedit --squash --delete-branch
```

---

## Verification

1. **tsc --noEmit** — 0 errors
2. **npm run lint** — 0 errors, 0 warnings
3. **vitest** — 701/701 (695 + 6 new)
4. **e2e** — 250/250
5. **npm run build** — clean
