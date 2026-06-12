# foreignObject HTML-authoring #9 Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the three non-security #9 code-review follow-ups: list-aware `setBlock`/`toggleList`, block-preserving `clearFormatting`, and a real (undoable-on-edit) empty-content delete.

**Architecture:** All changes are in the editor's foreignObject HTML layer. Fix (a)/(b) are pure DOM transforms in the WYSIWYG command module (`foreign-html-commands.ts`). Fix (c) adds a shared empty-content predicate (`foreign-html-serialize.ts`), has the dialog report empty content as `''` (`SeForeignHtmlDialog.ts`), and makes the edit-path delete undoable via `RemoveElementCommand` (`foreignHtml.ts`). The editable content model is a flat block sequence: the root holds `<p>`/`<h1>`–`<h3>`/`<ul>`/`<ol>`; lists hold `<li>`s.

**Tech Stack:** TypeScript, Lit 3, Vitest (jsdom) for unit, Playwright for e2e. Spec: `docs/superpowers/specs/2026-06-11-svgedit-foreign-html-followups-design.md`.

---

## Conventions for every task

- **Working directory:** repo root `C:/Users/jscha/source/repos/svgedit`. Run the commands below from there.
- **Git is absolute + signed, no AI attribution:** `git -C C:/Users/jscha/source/repos/svgedit <…>`. SSH signing is on via git config — do not disable it. Use conventional-commit messages; do **not** add Co-Authored-By / "Generated with" lines.
- **Branch:** already created — `fix/foreign-html-followups` (off `origin/master` `4238b3ff`). Do not re-branch.
- **Run a single unit file:** `npx vitest run <path>`
- **Editor typecheck (covers `src/editor/**`):** `npx tsc --noEmit -p tsconfig.json` — the `npm run typecheck` script only covers `packages/svgcanvas`, so it will NOT catch editor type errors.
- **Lint a touched file:** `npx eslint <path>`
- **e2e:** the project harness builds + serves + runs Playwright: `npx tsx scripts/run-e2e.ts`. To iterate on one test, in one shell run `npm run start:e2e` (preview on :9000), then in another: `npx playwright test tests/e2e/foreign-html.spec.ts -g "<title substring>"`.
- **Full gate (the real pass/fail):** `npm test` (lint → vitest+coverage → e2e).

---

## Task 1: `liftItem` helper + list-aware `setBlock` (fix a, part 1)

**Files:**
- Modify: `src/editor/dialogs/foreign-html-commands.ts` (add `liftItem` after `blocksInRange` ~line 56; rework `setBlock` ~lines 69-77)
- Test: `tests/unit/foreign-html-commands.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('foreign-html commands', …)` block in `tests/unit/foreign-html-commands.test.ts`:

```ts
// Helper: assert the structural invariant — no non-<li> block directly inside a list,
// and no list directly inside a list.
const assertNoInvalidLists = (host: Element): void => {
  host.querySelectorAll('ul,ol').forEach((list) => {
    for (const child of [...list.children]) {
      expect(child.localName, `invalid <${child.localName}> child of <${list.localName}>`).toBe('li')
    }
  })
}

it('setBlock on a lone list item lifts it out and removes the empty list', () => {
  root.innerHTML = '<ul><li>only</li></ul>'
  selectAll(root.querySelector('li')!)
  cmd.setBlock(root, 'h2')
  expect(root.querySelector('ul')).toBeNull()
  expect(root.querySelector('h2')?.textContent).toBe('only')
  assertNoInvalidLists(root)
})

it('setBlock on a middle list item splits the list around the new block', () => {
  root.innerHTML = '<ul><li>a</li><li>b</li><li>c</li></ul>'
  selectAll(root.querySelectorAll('li')[1]!) // select "b"
  cmd.setBlock(root, 'h2')
  // Expect: <ul>a</ul> <h2>b</h2> <ul>c</ul>
  const lists = root.querySelectorAll('ul')
  expect(lists.length).toBe(2)
  expect(lists[0].textContent).toBe('a')
  expect(lists[1].textContent).toBe('c')
  expect(root.querySelector('h2')?.textContent).toBe('b')
  assertNoInvalidLists(root)
})

it('setBlock over a whole list converts every item and drops the list', () => {
  root.innerHTML = '<ul><li>a</li><li>b</li><li>c</li></ul>'
  selectAll(root.querySelector('ul')!)
  cmd.setBlock(root, 'p')
  expect(root.querySelector('ul')).toBeNull()
  expect([...root.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['a', 'b', 'c'])
  assertNoInvalidLists(root)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: the three new tests FAIL (current `setBlock` produces `<ul><h2>…</h2></ul>` etc.), existing tests still PASS.

- [ ] **Step 3: Add `liftItem` and rework `setBlock`**

In `src/editor/dialogs/foreign-html-commands.ts`, add this helper immediately after the `blocksInRange` function:

```ts
/**
 * Replace a list item with a block element, lifting it OUT of its list.
 *
 * `block` (created + styled by the caller) receives the item's children and is placed
 * immediately after the item's list; any siblings that followed the item are moved into
 * a fresh list of the same kind after `block` (a split), so the list is never left with
 * a non-`li` block as a child. The original list is removed if the lift empties it.
 * Processing a run of items in turn coalesces — each lifted item carries its trailing
 * siblings into the tail list the next call operates on.
 */
const liftItem = (li: HTMLElement, block: HTMLElement): void => {
  const list = li.parentElement
  if (!list) return
  while (li.firstChild) block.appendChild(li.firstChild)
  const after: ChildNode[] = []
  for (let n = li.nextSibling; n; n = n.nextSibling) after.push(n)
  list.after(block)
  if (after.length) {
    // Literal createElement — `list.localName` is a read, never a tainted sink arg.
    const tail = list.localName === 'ol' ? document.createElement('ol') : document.createElement('ul')
    const style = list.getAttribute('style')
    if (style) tail.setAttribute('style', style)
    for (const node of after) tail.appendChild(node)
    block.after(tail)
  }
  li.remove()
  if (!list.children.length) list.remove()
}
```

Replace the existing `setBlock` (currently lines ~69-77) with:

```ts
export const setBlock = (root: Element, tag: BlockTag): void => {
  for (const block of blocksInRange(root)) {
    const repl = createBlockEl(tag)
    const style = block.getAttribute('style')
    if (style) repl.setAttribute('style', style)
    if (block.localName === 'li') {
      liftItem(block, repl)
    } else {
      while (block.firstChild) repl.appendChild(block.firstChild)
      block.replaceWith(repl)
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Typecheck + lint the touched file**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/editor/dialogs/foreign-html-commands.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/foreign-html-commands.ts tests/unit/foreign-html-commands.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "fix(foreign): setBlock lifts list items out instead of emitting invalid p-in-ul"
```

---

## Task 2: `wrapInList` helper + true-toggle `toggleList` (fix a, part 2)

**Files:**
- Modify: `src/editor/dialogs/foreign-html-commands.ts` (add `wrapInList` after `liftItem`; rework `toggleList` ~lines 79-92)
- Test: `tests/unit/foreign-html-commands.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('foreign-html commands', …)` block (reuses `assertNoInvalidLists` from Task 1):

```ts
it('toggleList wraps plain blocks into a list', () => {
  root.innerHTML = '<p>a</p><p>b</p>'
  selectAll(root)
  cmd.toggleList(root, 'ul')
  const ul = root.querySelector('ul')!
  expect(ul).not.toBeNull()
  expect([...ul.children].map((li) => li.localName)).toEqual(['li', 'li'])
  expect([...ul.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['a', 'b'])
  expect(root.querySelector('p')).toBeNull()
  assertNoInvalidLists(root)
})

it('toggleList toggles OFF when the items are already in a list of that kind', () => {
  root.innerHTML = '<ul><li>a</li><li>b</li></ul>'
  selectAll(root.querySelector('ul')!)
  cmd.toggleList(root, 'ul')
  expect(root.querySelector('ul')).toBeNull()
  expect([...root.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['a', 'b'])
  assertNoInvalidLists(root)
})

it('toggleList retypes ul -> ol (no double-nest)', () => {
  root.innerHTML = '<ul><li>a</li><li>b</li></ul>'
  selectAll(root.querySelector('ul')!)
  cmd.toggleList(root, 'ol')
  expect(root.querySelector('ul')).toBeNull()
  const ol = root.querySelector('ol')!
  expect(ol).not.toBeNull()
  expect([...ol.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['a', 'b'])
  // No nested list (the old double-nest bug).
  expect(ol.querySelector('ul,ol')).toBeNull()
  assertNoInvalidLists(root)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: the three new tests FAIL (current `toggleList` never toggles off, double-nests on retype).

- [ ] **Step 3: Add `wrapInList` and rework `toggleList`**

Add this helper immediately after `liftItem` in `src/editor/dialogs/foreign-html-commands.ts`:

```ts
/**
 * Gather the given blocks into a single new list of `kind`.
 *
 * The new list is inserted at the first block's root-level position (for a list item,
 * just before its current list). Each block — a paragraph/heading or an existing `<li>`
 * from another list — contributes a new `<li>` carrying its children. Source blocks are
 * removed and any source list left empty is dropped. Powers both wrap (plain → list)
 * and ul↔ol retype.
 */
const wrapInList = (blocks: HTMLElement[], kind: 'ul' | 'ol'): void => {
  if (!blocks.length) return
  // Literal createElement — `kind` is a typed union, never a DOM-sourced string.
  const list = kind === 'ol' ? document.createElement('ol') : document.createElement('ul')
  const first = blocks[0]
  const anchor = first.localName === 'li' ? (first.parentElement ?? first) : first
  anchor.parentNode?.insertBefore(list, anchor)
  for (const block of blocks) {
    const source = block.localName === 'li' ? block.parentElement : null
    const li = document.createElement('li')
    while (block.firstChild) li.appendChild(block.firstChild)
    list.appendChild(li)
    block.remove()
    if (source && source !== list && !source.children.length) source.remove()
  }
}
```

Replace the existing `toggleList` (currently lines ~79-92) with:

```ts
export const toggleList = (root: Element, kind: 'ul' | 'ol'): void => {
  const blocks = blocksInRange(root)
  if (!blocks.length) return
  const allInKind = blocks.every(
    (b) => b.localName === 'li' && b.parentElement?.localName === kind
  )
  if (allInKind) {
    // Toggle OFF — unwrap each item back to a paragraph.
    for (const li of blocks) liftItem(li, document.createElement('p'))
    return
  }
  wrapInList(blocks, kind)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/editor/dialogs/foreign-html-commands.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/foreign-html-commands.ts tests/unit/foreign-html-commands.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "fix(foreign): toggleList true toggle + ul<->ol retype, drop fragile no-op/double-nest"
```

---

## Task 3: block-preserving `clearFormatting` (fix b)

**Files:**
- Modify: `src/editor/dialogs/foreign-html-commands.ts` (rework `clearFormatting` ~lines 129-133)
- Test: `tests/unit/foreign-html-commands.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('foreign-html commands', …)` block:

```ts
it('clearFormatting strips inline formatting but preserves block boundaries', () => {
  root.innerHTML = '<p><strong>bo</strong>ld</p><h2><span style="color: red">head</span></h2>'
  selectAll(root)
  cmd.clearFormatting(root)
  // Both blocks survive as their own elements, with inline formatting removed.
  expect(root.querySelector('p')?.textContent).toBe('bold')
  expect(root.querySelector('p')?.querySelector('strong')).toBeNull()
  expect(root.querySelector('h2')?.textContent).toBe('head')
  expect(root.querySelector('h2')?.querySelector('span')).toBeNull()
  // Block count unchanged (no collapse into one text run).
  expect(root.children.length).toBe(2)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: FAILS — current `clearFormatting` collapses both blocks into a single text node (`root.children.length` becomes 0 and `querySelector('p')` is null).

- [ ] **Step 3: Rework `clearFormatting`**

Replace the existing `clearFormatting` (currently lines ~129-133) with:

```ts
export const clearFormatting = (root: Element): void => {
  const blocks = blocksInRange(root)
  if (blocks.length) {
    // Strip inline formatting per block, preserving block boundaries.
    // (RHS keeps the `?? ''` so this is not a no-self-assign; textContent is typed string|null.)
    for (const block of blocks) block.textContent = block.textContent ?? ''
    return
  }
  // No enclosing block (bare text directly in root) — flatten the range.
  const r = activeRange(root); if (!r) return
  const text = r.toString()
  r.deleteContents(); r.insertNode(document.createTextNode(text))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/editor/dialogs/foreign-html-commands.ts`
Expected: no errors (in particular, no `no-self-assign` on the textContent line).

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/foreign-html-commands.ts tests/unit/foreign-html-commands.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "fix(foreign): clearFormatting preserves block boundaries"
```

---

## Task 4: `isForeignContentEmpty` + dialog reports empty as `''` (fix c, part 1)

**Files:**
- Modify: `src/editor/dialogs/foreign-html-serialize.ts` (add `isForeignContentEmpty` after `serialize` ~line 62)
- Modify: `src/editor/dialogs/SeForeignHtmlDialog.ts` (import it; use it in `_onClose` at line 179)
- Test: `tests/unit/foreign-html-serialize.test.ts`, `tests/unit/se-foreign-html-dialog.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/foreign-html-serialize.test.ts`, add `isForeignContentEmpty` to the existing import from `'../../src/editor/dialogs/foreign-html-serialize.ts'`, then add:

```ts
describe('isForeignContentEmpty', () => {
  const mk = (html: string): HTMLElement => {
    const d = document.createElement('div'); d.innerHTML = html; return d
  }
  it('is true for no content', () => expect(isForeignContentEmpty(mk(''))).toBe(true))
  it('is true for an empty paragraph', () => expect(isForeignContentEmpty(mk('<p><br></p>'))).toBe(true))
  it('is true for whitespace-only text', () => expect(isForeignContentEmpty(mk('<p>   </p>'))).toBe(true))
  it('is false for text content', () => expect(isForeignContentEmpty(mk('<p>hi</p>'))).toBe(false))
  it('is false for hr-only content', () => expect(isForeignContentEmpty(mk('<hr>'))).toBe(false))
})
```

In `tests/unit/se-foreign-html-dialog.test.ts`, add inside the top-level `describe('se-foreign-html-dialog', …)` block:

```ts
it('resolves empty string on OK when the editor is empty (delete path)', async () => {
  await flush(el) // no value seeded -> editor empty
  const closed = el.whenClosed()
  closeWith(el, 'ok')
  await expect(closed).resolves.toEqual({ html: '' })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/foreign-html-serialize.test.ts tests/unit/se-foreign-html-dialog.test.ts`
Expected: the serialize tests FAIL with "isForeignContentEmpty is not a function" (not yet exported); the dialog test FAILS because OK currently resolves the `se-fo-root` wrapper string, not `''`.

- [ ] **Step 3: Add `isForeignContentEmpty` and wire it into the dialog**

In `src/editor/dialogs/foreign-html-serialize.ts`, add immediately after the `serialize` function (after line ~62):

```ts
/**
 * True when an editor subtree has no displayable content: blank text and no `<hr>`.
 * `<hr>` is the only no-text element on the foreign allowlist (`<img>` is stripped),
 * so blank text + no `<hr>` means nothing would render. The dialog uses this to report
 * an emptied box as `''` so the controller deletes it instead of writing an empty wrapper.
 */
export const isForeignContentEmpty = (editorRoot: Element): boolean =>
  (editorRoot.textContent ?? '').trim() === '' && editorRoot.querySelector('hr') === null
```

In `src/editor/dialogs/SeForeignHtmlDialog.ts`, extend the existing serialize import (line 3) to include the new export:

```ts
import { serialize, deserialize, parseToEditorFragment, isForeignContentEmpty } from './foreign-html-serialize.js'
```

Then in `_onClose`, replace line 179 (`out = serialize(editor)`) with:

```ts
        out = isForeignContentEmpty(editor) ? '' : serialize(editor)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/foreign-html-serialize.test.ts tests/unit/se-foreign-html-dialog.test.ts`
Expected: PASS (including the pre-existing dialog/serialize tests — the `<p>hi</p>` OK test still returns a wrapper containing "hi").

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/editor/dialogs/foreign-html-serialize.ts src/editor/dialogs/SeForeignHtmlDialog.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/foreign-html-serialize.ts src/editor/dialogs/SeForeignHtmlDialog.ts tests/unit/foreign-html-serialize.test.ts tests/unit/se-foreign-html-dialog.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "fix(foreign): dialog reports empty content as '' so empty-OK can delete"
```

---

## Task 5: undoable edit-delete + e2e (fix c, part 2)

**Files:**
- Modify: `src/editor/foreignHtml.ts` (rework `authorEdit` empty branch, lines ~79-82)
- Test: `tests/e2e/foreign-html.spec.ts`

- [ ] **Step 1: Write the failing e2e tests**

Append inside the `test.describe('foreignObject HTML authoring', …)` block in `tests/e2e/foreign-html.spec.ts` (reuses the existing `drawForeignBox`, `typeInEditor`, `foreignCount`, `DIALOG`, `EDITOR`, `OK` helpers):

```ts
test('edit then empty-OK deletes the box; undo restores it', async ({ page }) => {
  await drawForeignBox(page)
  await typeInEditor(page, 'DeleteMe')
  await page.locator(OK).click()
  const fo = page.locator('#svgcontent foreignObject')
  await expect(fo).toHaveCount(1)
  await expect(fo).toContainText('DeleteMe')

  // Re-open, clear all content, OK -> the box is deleted.
  await page.locator('#tool_select').click()
  await fo.dblclick()
  await expect(page.locator(DIALOG)).toBeAttached()
  await page.locator(EDITOR).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.locator(OK).click()
  await expect(page.locator(DIALOG)).toHaveCount(0)
  await expect.poll(() => foreignCount(page)).toBe(0)

  // Undo restores the deleted box with its content (undoable RemoveElementCommand).
  await page.locator('#svgcanvas').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => foreignCount(page)).toBe(1)
  await expect(page.locator('#svgcontent foreignObject')).toContainText('DeleteMe')
})

test('drawing a box then OK with no content removes it', async ({ page }) => {
  await drawForeignBox(page)
  await expect.poll(() => foreignCount(page)).toBe(1)
  // OK without typing -> empty -> the just-drawn (uncommitted) box is removed.
  await page.locator(OK).click()
  await expect(page.locator(DIALOG)).toHaveCount(0)
  await expect.poll(() => foreignCount(page)).toBe(0)
})
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run (preview server must be up — `npm run start:e2e` in another shell):
`npx playwright test tests/e2e/foreign-html.spec.ts -g "empty-OK deletes|OK with no content"`
Expected: both FAIL — today clearing+OK leaves an empty `foreignObject` (count stays 1), so the delete + undo-restore assertions fail. (The dialog already reports `''` after Task 4, so the create-path test may already pass via `authorNew`'s existing `fo.remove()`; the edit-path test fails until Step 3 because `authorEdit`'s empty branch is unreachable/raw.)

> Note: after Task 4 the dialog returns `''` for empty, so `authorNew` already deletes on empty-OK — the "drawing a box then OK" test may pass at Step 2. The "edit then empty-OK" test still fails until the `authorEdit` change below. Both must be green at Step 4.

- [ ] **Step 3: Make the edit-path delete undoable**

In `src/editor/foreignHtml.ts`, replace the empty branch of `authorEdit` (currently lines ~79-82):

```ts
    if (result.trim() === '') {
      fo.remove()
      return
    }
```

with:

```ts
    if (result.trim() === '') {
      // Empty content on an existing (already-committed) box deletes it — undoably, so
      // Ctrl+Z restores the foreignObject (its child content rides along on re-insert).
      const parent = fo.parentNode
      if (!parent) return
      const { RemoveElementCommand } = canvas.history
      const sibling = fo.nextSibling
      canvas.clearSelection()
      fo.remove()
      canvas.addCommandToHistory(new RemoveElementCommand(fo, sibling, parent))
      return
    }
```

(`authorNew` is left unchanged: its `fo.remove()` is correctly history-free — the just-drawn box was never committed to history — and now fires because the dialog reports empty as `''`.)

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `npx playwright test tests/e2e/foreign-html.spec.ts -g "empty-OK deletes|OK with no content"`
Expected: PASS in every configured browser.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/editor/foreignHtml.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/foreignHtml.ts tests/e2e/foreign-html.spec.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "fix(foreign): edit-path empty delete is an undoable RemoveElementCommand"
```

---

## Task 6: full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Editor typecheck (whole editor surface)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 2: Full test gate (lint + unit + coverage + e2e, both browsers)**

Run: `npm test`
Expected: lint clean; all vitest unit tests pass; `scripts/run-e2e.ts` passes the full `foreign-html.spec.ts` in every configured browser (existing + the new (a)/(b)/(c) cases).

- [ ] **Step 3: Confirm the working tree is clean and the branch is ready**

Run: `git -C C:/Users/jscha/source/repos/svgedit status -sb && git -C C:/Users/jscha/source/repos/svgedit log --oneline 4238b3ff..HEAD`
Expected: clean tree; the spec commits plus the five fix commits from Tasks 1-5.

> Do NOT open the PR here — return to the user; PR/merge is handled per the user's workflow (squash-merge on this signed repo) after they review.

---

## Self-Review

**Spec coverage:**
- (a) `setBlock` list-awareness → Task 1. `toggleList` true toggle + retype + no double-nest → Task 2. ✓
- (b) `clearFormatting` block preservation → Task 3. ✓
- (c) empty detection (`isForeignContentEmpty` + dialog `''`) → Task 4; undoable edit delete + create-path-now-fires + e2e → Task 5. ✓
- Structural invariant test → Task 1 (`assertNoInvalidLists`, reused in Task 2). ✓
- Known v1 edges (`<ol start>` split, partial retype) are documented in the spec; no task needed (intentionally out of scope). ✓
- (d) untouched. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows complete code; every run step has a command + expected result. ✓

**Type/name consistency:** `liftItem(li, block)`, `wrapInList(blocks, kind)`, `isForeignContentEmpty(editorRoot)`, `RemoveElementCommand(elem, sibling, parent)` are used identically across tasks and match the verified canvas API (`svgcanvas-types.ts:232,448`, `history.ts:235`). `assertNoInvalidLists` is defined in Task 1 and reused in Task 2 (same file, append order). `clearSelection` is a no-arg call (typed `(noCall?: boolean) => void`). ✓
