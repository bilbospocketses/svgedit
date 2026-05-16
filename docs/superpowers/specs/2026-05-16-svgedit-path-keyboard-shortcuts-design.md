# svgedit path tool keyboard shortcuts — design spec

**Status:** Approved (brainstorm 2026-05-16). Surfaced by post-Step-1.5 smoke + investigation. Implements the missing Enter/Escape keys for the path drawing tool.

**Inputs:** `todo_svgedit.md` #10 Investigations sub-entry "Enter-key path completion" (logged after Step 1.5 smoke).

---

## Scope

**Goal:** Add `Enter` (complete path open) and `Escape` (cancel current drawing) keys to the path tool. Match the keyboard convention of every other vector editor (Inkscape, Illustrator, Figma).

**Branch:** `feat/path-tool-enter-escape-keys` off master (`d91ad930`).

### Background

Today the path tool is mouse-only. Double-click "completes" the path via a side-effect of two mousedowns at the same point — not via a `dblclick` event handler. No keydown listener exists for path mode anywhere in the codebase (verified by grep). This is upstream behavior; no regression from any fork change.

### In scope

**`packages/svgcanvas/core/path-actions.js`** — single file:

1. **`PathActions.finishPath()`** — new method. Completes the in-progress path open (NOT closed). Requires `getDrawnPath()` truthy AND `pathSegList.numberOfItems >= 2`.
   - Remove `path_stretch_line` preview
   - `setDrawnPath(null)` + `setStarted(false)`
   - `toEditMode(drawnPathElement)` — mirrors what `mouseUpEvent` does for the existing dblclick-completion flow

2. **`PathActions.cancelPath()`** — new method. Discards the in-progress path entirely. Delegates to the existing `PathActions.clear()` method (which already removes the stretchy + path element + hides grips + resets state when drawnPath is truthy). Stays in `'path'` mode so user can start a new path.

3. **`init()`** — add a `document` keydown listener (matches `Editor.js:407`, `seButton.js:231`, `ext-eyedropper.js:145` patterns):

```js
document.addEventListener('keydown', (e) => {
  if (svgCanvas.getCurrentMode() !== 'path') return
  if (!svgCanvas.getDrawnPath()) return
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'Enter') {
    e.preventDefault()
    pathActionsMethod.finishPath()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    pathActionsMethod.cancelPath()
  }
})
```

### Tests

**`tests/e2e/path-keyboard-shortcuts.spec.js`** — new file, 4 tests, runs both browsers:

1. Enter completes path with ≥ 2 points → mode is `pathedit`, drawnPath is null, path element in DOM
2. Enter is no-op with < 2 points → still in `path` mode, drawnPath unchanged
3. Escape cancels path → element NOT in DOM, mode still `path`, drawnPath null
4. Enter inside Source-editor textarea is NOT intercepted → source dialog handles Enter normally, no path-mode side-effect

### Docs

**`README.md`** — new `## Path tool keys` section between "Repository layout" and "Embedding (planned)". 5 bullets matching upstream terseness.

**`CHANGELOG.md`** — single bullet under `### Added (path tool keys 2026-05-16)`.

### Out of scope

- Editor-wide keyboard shortcut overhaul (would be a much larger doc + UX project)
- A keyboard-shortcuts help dialog
- `docs/tutorials/*.md` rewrites — covered by new TODO #12 (full doc review, separate work)

## Verification

- `npm run lint` clean
- `npx vitest run` → 564/564 unchanged
- `node scripts/run-e2e.mjs` → 184 prior + 4 new × 2 browsers / 2 = 188 passed, 0 skipped
- Manual smoke: dev server restart + cross-browser confirm

## Risks + rollback

- **Risk:** the document-level keydown listener may interfere with other path-mode interactions. Mitigation: filter by `getDrawnPath()` (only fires when actively drawing) + `input-focus` guard. The handler is no-op when not actively drawing a path, eliminating most surprise.
- **Rollback:** `git revert -m 1 <merge-sha>` if a regression slips past tests + smoke. Single-file source change makes revert clean.

## Effort

30-45 min execution.
