# Design — foreignObject HTML authoring: #9 minor follow-ups (a)(b)(c)

**Date:** 2026-06-11
**Status:** Approved (brainstorming) — pending implementation
**Scope:** Three small, non-security cleanups surfaced by the #9 final code review.
One PR. Follow-up (d) is awareness-only and intentionally untouched.

## Context

The #9 "Insert HTML" tool (PR #116, master `b25dc4e6`) authors HTML inside an SVG
`foreignObject`. Its final code review logged four minor follow-ups. (d) needs no
action. (a)(b)(c) are addressed here.

The editable content model is a **flat block sequence**: the `contenteditable`
root (and the persisted `se-fo-root` div) holds `<p>` / `<h1>`–`<h3>` / `<ul>` /
`<ol>` as direct children; lists hold `<li>` children. Blocks do not nest beyond
list → item. The design below relies on that shape.

Files:
- `src/editor/dialogs/foreign-html-commands.ts` — the WYSIWYG command layer (a, b).
- `src/editor/foreignHtml.ts` — the create/edit controller wiring (c).

## Fix (a) — list-aware `setBlock` / `toggleList`

### Problem
- `setBlock` retags each block via `replaceWith` with no awareness of `<li>`.
  Retagging a list item yields `<ul><p>…</p></ul>` — a block as a direct child of
  a list (invalid).
- `toggleList` does `first.replaceWith(list)` then later calls `b.remove()` on that
  same now-detached node — a no-op that only "works" because the node is already
  detached (fragile). Applied to an existing list it double-nests
  (`<ul><ul>…</ul></ul>`). It also never toggles off, despite the name.

### Design
Introduce two small list-aware helpers; `setBlock` / `toggleList` become thin.
All element creation stays **literal-tag** (the file's existing anti-tainted-sink
discipline) — no DOM-sourced string ever reaches `document.createElement`.

**`liftItem(li, block)`** — move a list item's children into `block`, place `block`
immediately after its list, split trailing siblings into a fresh list of the same
kind, and remove the original list if it empties. Used by `setBlock`-on-`<li>` and
by `toggleList` toggle-off.

```
<ul>A B C</ul>, liftItem(B, <h2>) → <ul>A</ul> <h2>B</h2> <ul>C</ul>
```

Processing multiple selected items in turn coalesces correctly: each lifted item
carries its trailing siblings into a tail list that the next iteration operates on,
so lifting all of `[A,B,C]` yields three sibling blocks and removes the list.

**`wrapInList(blocks, kind)`** — create one new `kind` list at the first block's
root-level position; for each selected block (plain **or** an `<li>` from another
list) move its children into a new `<li>`; remove the source block and clean up any
source list left empty. Powers both wrap (plain → list) and ul↔ol retype (items
lifted from the old list into the new-kind list; old list emptied + removed).

**Resulting command bodies:**
```
setBlock(root, tag):
  for block in blocksInRange(root):
    repl = createBlockEl(tag); copy block's style
    if block is <li>:  liftItem(block, repl)
    else:              move children into repl; block.replaceWith(repl)   // unchanged path

toggleList(root, kind):
  blocks = blocksInRange(root); if empty → return
  if every block is an <li> whose parent list is `kind`:   // toggle OFF
      liftItem(li, <p>) for each
  else:                                                    // wrap / retype
      wrapInList(blocks, kind)
```

This eliminates the invalid `<p>`-in-`<ul>`, the fragile detach-then-`remove()`
no-op, and the double-nest, and delivers true toggle + ul↔ol retype.

### Known v1 edges (documented, not fixed)
- `<ol start="…">` numbering continuation is not preserved across a split.
- A *partial* retype (some items of a list) places the new list ahead of the old
  rather than splitting in place. Selecting whole lists (the common case) is exact.

## Fix (b) — `clearFormatting` preserves block structure

### Problem
`clearFormatting` does `range.toString()` then inserts a single text node,
collapsing every block boundary in the selection into one text run.

### Design
Operate per block instead of flattening the whole range:
```
clearFormatting(root):
  blocks = blocksInRange(root)
  if blocks:  for block in blocks: block.textContent = block.textContent   // strip inline, keep block
  else:       <existing range-flatten fallback for bare text directly in root>
```
Setting a block's `textContent` to its own text replaces inline children
(`<strong>`, `<span style>`, `<a>`, …) with one clean text node while preserving the
block element. Two formatted `<p>`s → two plain `<p>`s; headings stay headings.

**Deliberate v1 choice:** clears the *entire* block(s) the selection touches, not a
sub-span — this matches the "preserve blocks" goal. Range-precise partial clearing
is deferred.

## Fix (c) — empty content deletes the box (undoably on edit)

### Problem
The intent (per the `foreignHtml.ts` flow comment) is "empty content → delete the
box." But it never fires: `serialize()` (`foreign-html-serialize.ts:57-62`) ALWAYS
wraps content in `<div class="se-fo-root">…</div>`, and on OK the dialog returns
`serialize(editor)` with `_editor` still attached (`SeForeignHtmlDialog.ts:179`), so
the accepted result is never `''`. The `result.trim() === ''` branches in BOTH
`authorEdit` and `authorNew` (`foreignHtml.ts:54,79`) are unreachable — clearing a
box's content and clicking OK today sets the content to an empty wrapper (an empty
box) instead of deleting it. And the edit-path delete, even if reached, used a raw
`fo.remove()` with no history command.

### Design
Two parts: make "empty" detectable, then make the edit-path delete undoable.

**1. Empty detection (shared).** Add `isForeignContentEmpty` to
`foreign-html-serialize.ts` and have the dialog report empty content as `''`:
```ts
// foreign-html-serialize.ts — <hr> is the only no-text element in the allowlist
// (<img> is stripped), so blank text + no <hr> ⇒ empty.
export const isForeignContentEmpty = (editorRoot: Element): boolean =>
  (editorRoot.textContent ?? '').trim() === '' && editorRoot.querySelector('hr') === null

// SeForeignHtmlDialog.ts _onClose — replaces `out = serialize(editor)`
out = isForeignContentEmpty(editor) ? '' : serialize(editor)
```
This makes the existing `result.trim() === ''` branches reachable in both controller
paths. An empty paragraph (`<p></p>`, `<p><br></p>`) counts as empty (blank text) —
which is why detection is text-based, not "no element children".

**2. Edit-path delete is undoable.** `authorEdit`'s empty branch removes the existing
(already-committed) box via `RemoveElementCommand`, mirroring the canvas's own
pattern (`foreign.ts:43-48`):
```ts
if (result.trim() === '') {
  const parent = fo.parentNode
  if (!parent) return
  const { RemoveElementCommand } = canvas.history
  const sibling = fo.nextSibling
  canvas.clearSelection()                 // release the selector box (fo selected from the dblclick)
  fo.remove()
  canvas.addCommandToHistory(new RemoveElementCommand(fo, sibling, parent))
  return
}
```
Undo re-inserts the foreignObject whole (its child content rides along on the
detached node).

`authorNew`'s empty branch needs **no code change**: its `fo.remove()` is correctly
history-free (the just-drawn box was never committed to history per
`event.ts:842-848`) — it simply starts working now that the dialog reports empty as
`''`. The create-**cancel** path (result `null`) is likewise untouched.
`clearSelection` / `addCommandToHistory` / `RemoveElementCommand` are all on the
canvas API (`svgcanvas-types.ts:232,448`; `history.ts:235`).

## Testing

- **(a)** unit (`tests/unit/foreign-html-commands.test.ts`):
  - `setBlock` on a lone list item, a middle item (split), and all items (list removed).
  - `toggleList` wrap (plain → list), toggle-off (list → plain), ul↔ol retype, and
    no double-nest on an existing list.
  - **Structural invariant:** after any `setBlock` / `toggleList`, assert no non-`li`
    block is a direct child of a list, and no list is a direct child of a list.
  - Existing plain-`<p>` `setBlock`/`toggleInline`/etc. tests continue to pass
    (the non-`li` path is unchanged).
- **(b)** unit: multi-block selection with inline formatting → blocks preserved,
  inline stripped; heading vs paragraph distinction kept.
- **(c)** unit (`tests/unit/foreign-html-serialize.test.ts`): `isForeignContentEmpty`
  → true for blank and `<p><br></p>`, false for text and for `<hr>`-only content.
  e2e (`tests/e2e/foreign-html.spec.ts`): (i) edit → clear all content → OK deletes the
  box and **Ctrl+Z restores it** (undoable edit-delete); (ii) draw a box → OK with no
  content → box removed (create-path empty, now reachable). Matches the existing #9
  e2e style.

## Out of scope
- Follow-up (d): `FOREIGN_HTML_TAGS` allowlists `sub`/`sup`/`blockquote` as a
  deliberate import-survival superset that the toolbar can't author — no change.
- No new dependencies. No sanitizer/allowlist changes (none of (a)(b)(c) alters the
  set of producible tags).

## Files touched
- `src/editor/dialogs/foreign-html-commands.ts` — +2 helpers (`liftItem`,
  `wrapInList`); rework `setBlock`, `toggleList`, `clearFormatting`.
- `src/editor/dialogs/foreign-html-serialize.ts` — +`isForeignContentEmpty`.
- `src/editor/dialogs/SeForeignHtmlDialog.ts` — report empty content as `''` in `_onClose`.
- `src/editor/foreignHtml.ts` — undoable `RemoveElementCommand` in `authorEdit`'s empty branch.
- `tests/unit/foreign-html-commands.test.ts`, `tests/unit/foreign-html-serialize.test.ts`,
  `tests/e2e/foreign-html.spec.ts` — new cases.
