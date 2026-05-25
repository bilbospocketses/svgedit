# Post-Lit Migration Roadmap: TS Follow-ups + Correctness Backlog

> **Date:** 2026-05-25
> **Status:** Sequencing approved
> **Scope:** Combined ordering of TS migration follow-ups (item #2 deferred sub-items) and correctness backlog (item #10). 7 PRs, ordered by dependency + risk.

---

## Triage: Items closed before this roadmap begins

These items from todo #10 are **moot** — verified 2026-05-25:

| Item | Reason moot |
|------|-------------|
| `jQuery.jPicker.ts:1292, 1596` jQuery-on-DOM bugs | File deleted in PR-4a |
| Three `super.attributeChangedCallback()` sites (svgSourceDialog, imagePropertiesDialog, editorPreferencesDialog) | All 5 files with this pattern are now LitElement subclasses; `super.attributeChangedCallback()` is the correct Lit lifecycle call. Bug was "HTMLElement has no such method" — no longer applies. |
| `document.getElementById` inline-script sites | Already marked no-fix-needed (intentional bootstrap pattern) |

Update todo #10 to mark these shipped/closed when this roadmap's first PR lands.

---

## Sequencing principle

**Fix bugs in monolithic files first, then split the files.** The bug's full context is visible in one file; post-split the fix would need to find its new home. File splits are mechanical and safe on already-correct code.

---

## PR sequence

### PR-6: Triage sweep + dead code + small mechanical fixes

Low-risk, high-item-count PR that shrinks the backlog and clears small debt.

**From #10 (correctness):**
- Close 3 moot items (update todo)
- `cmenuDialog.ts:121-122` — `screen.width/height` → `window.innerWidth/innerHeight`
- `contextmenu.ts:81-84` — `appendChild(string)` → proper Node creation
- ext-markers 21 missing i18n keys (add to lang.en.ts `tools` namespace or ext-markers locale)
- `getVersion()` $Rev$ placeholder — verify consumers, drop or return package.json version
- `NS.MATH` dead code — drop definition (namespaces.ts:13) + selection.ts:143 check

**From #2 (TS follow-ups):**
- Mutable export refactor (`path.ts:77 export let path = null`)
- 10 code-quality reviewer findings (index signature, dead typeof guard, backward cast, seAlert/seConfirm consolidation, no tsc in build, ambient pathSegList, curCommand/filter any, Object.assign consolidation, return-type mismatch, SVGPathSegment cast sites)

**Estimate:** ~2 hours, mechanical, high parallelism potential

---

### PR-7: History/undo correctness

Two tightly-coupled items in `history.ts`.

- **Typing-undo compression** (`:442-444` + `:609-612`) — collapse consecutive Typing commands targeting same element. Currently every keystroke = 1 undo entry.
- **History stack size limit** (`:611-612`) — cap at 100 (Photoshop/Inkscape precedent) with `Config.maxUndoHistory` override. Sequence AFTER typing-compression so memory pressure is already reduced.

**Estimate:** ~2-3 hours, needs design for compression heuristic

---

### PR-8: Geometry/bbox bug bundle

Five items in `utilities.ts`, same domain (bounding-box calculations).

- `getExtraAttributesForConvertToPath` missing attrs (`:755-756`) — drops `transform`, `fill-rule`, `clip-rule`
- Rotated-groups bbox cross-browser (`:941-942`) — Firefox works, others don't
- Stroke-width single-horizontal-line bbox overrun (`:1057-1059`)
- `getStrokedBBox` min/max asymmetry (`:1126-1129`)
- Circle bbox-optim exclusion (`:1015-1017`)

**Estimate:** ~2-3 hours

---

### PR-9: SVG import/export + element correctness

Eight items across `svg-exec.ts` and `selected-elem.ts`.

- `uniquifyElems` symbol-not-removed (`:1112`) — counts ALL `<use>`, not per-symbol
- `uniquifyElems` image/a internal refs (`:1117`) — `<a href="#elemId">` not updated on ID rename
- Multi-element gradient duplication (`:1278`) — objectBoundingBox uses first element's bbox only
- `setUseData` on undo→redo (`:516`) — not re-run when objects re-added through redo
- Fill/stroke property pushdown on ungroup (`selected-elem.ts:823`) — only handles filter + opacity
- `convertToPath` attribute handling (`svgcanvas.ts:1252-1253`)
- `importSvgString` namespace + recalculateDimensions (`svg-exec.ts:633-639`)
- `importSvgString` viewBox non-zero origin (`svg-exec.ts:763-766`)

**Estimate:** ~3-4 hours

---

### PR-10: Remaining UI/UX correctness

Four items across various files.

- `<a>` parent walk after click (`event.ts:951`)
- `addPtsToSelection canDeleteNodes` (`svgcanvas.ts:433`)
- TopPanel.ts missing polyline/polygon entries (`:318-328`)
- Cursor reset after text creation (EditorStartup.ts / Editor.ts)

**Estimate:** ~2 hours

---

### PR-11: File splits

Mechanical splitting of 5 large files (after bugs in them are fixed by PRs 6-10).

| File | Current LOC | Split strategy |
|------|-------------|----------------|
| svgcanvas.ts | 1,543 | By responsibility: canvas core, tool dispatch, element methods |
| Editor.ts | 1,372 | By lifecycle: initialization, event handling, tool management |
| path-actions.ts | 1,177 | By operation type: drawing, editing, node manipulation |
| TopPanel.ts | 1,044 | By element type: per-element-type panel sections |
| EditorStartup.ts | 878 | By phase: DOM setup, event binding, extension loading |
| recalculate.ts | 832 | By element type: per-element recalculation helpers |

**Estimate:** ~4-5 hours, mechanical but high-touch. Each split is a separate commit within the PR.

---

### PR-12: Trailing underscore → `#` private + SelectModule + test TS conversion

Three independent refactors bundled because they all touch broad file sets.

- **Trailing underscore → `#` private fields** — 153 sites across src/ and packages/. Mechanical rename with tsc enforcement of access boundaries.
- **SelectModule + wire-methods refactor** — untangle the `initializeSvgCanvasMethods()` Object.assign pattern in svgcanvas.ts (depends on PR-11 split).
- **Test file JS → TS conversion** — vitest + Playwright test files. Independent, can be done in parallel.

**Estimate:** ~4-5 hours

---

## Design call items (deferred from #10, need their own brainstorm)

These items require design decisions before implementation and are NOT included in the PR sequence above. They should be brainstormed when prioritized:

- `ext-layer_view.ts:81` shortcut bug — display vs canonical format trade-off
- Display-only shortcut labels — attribute semantics design call
- `sePalette` configurable palette — embed-host theming feature
- `blur-event.ts:123` blur-algorithm — upstream TODO, unclear specification

---

## What this roadmap does NOT cover

- Item #5 (Control Menu integration) — different work stream
- Item #6 (dependency upgrades) — can interleave with any PR
- Item #7 (packaging) — blocked on #5
- Item #9 (foreignObject authoring) — feature work, not bug fixes
- Item #12 (doc review) — can slot anywhere
- Item #13 (native dialog replacement) — feature work
- SVG image attribution comments — cosmetic, optional

---

## Execution approach

Each PR gets its own brainstorm → spec → plan → execution cycle when reached. This document locks the ORDER, not the implementation details. Start with PR-6 (triage + mechanical fixes) which is ready to execute immediately.
