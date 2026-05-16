# svgedit brand sweep — design spec

**Status:** Approved (brainstorm 2026-05-16). Surfaced by manual cross-browser smoke during Step 1.5; first-run storage preferences dialog still read "SVG-Edit". Tiny mechanical follow-up to Step 1's brand-update pass.

**Inputs:** `todo_svgedit.md` #11 (NEW item from Step 1.5 smoke).

---

## Scope

**Goal:** Rename all remaining `SVG-Edit` / `SVG Edit` / `SVG-Editor` references in active source code to lowercase `svgedit`. Matches scope directive in `project_svgedit.md` and the brand visible in `clear.js:51`'s generator string (already updated in Step 1).

**Branch:** `feat/brand-sweep-svgedit-lowercase` off master (`911e3a23` — post Step 1.5 merge).

**Single mechanical commit** — no architectural decisions, no branching logic, no per-site judgment calls beyond the verbatim renames in the table below.

### In scope — 16 sites

**User-visible strings (4 sites):**

| File | Line(s) | Change |
|---|---|---|
| `src/editor/extensions/ext-storage/locale/en.js` | 2, 4 | "SVG-Edit" → "svgedit" (storage prefs dialog body, 2 occurrences in template) |
| `src/editor/locale/lang.en.js` | 316 (`editorPreferencesMsg`) | Duplicate of above in i18n bundle — rename both occurrences within the string |
| `src/editor/locale/lang.en.js` | 175 (`editor_homepage`) | "SVG-Edit Home Page" → "svgedit Home Page" |
| `src/editor/extensions/ext-storage/storageDialog.html` | 47 | `aria-label="SVG-Edit storage preferences"` → `aria-label="svgedit storage preferences"` |

**Code / JSDoc comments (11 sites):**

| File | Line(s) | Change |
|---|---|---|
| `src/editor/Editor.js` | 407 | "the body containing the SVG-Editor" → "the body containing the svgedit editor" |
| `src/editor/components/seButton.js` | 231 | (same — triplicate of Editor.js comment) |
| `src/editor/components/seMenuItem.js` | 111 | (same — triplicate) |
| `src/editor/extensions/ext-storage/ext-storage.js` | 8 | "originally part of the SVG Editor" → "originally part of the svgedit editor" |
| `src/editor/extensions/ext-panning/ext-panning.js` | 10 | "very basic SVG-Edit extension" → "very basic svgedit extension" |
| `src/editor/ConfigObj.js` | 54 | JSDoc "multiple independent instances of SVG Edit" → "multiple independent instances of svgedit" |
| `src/editor/EditorStartup.js` | 17 | "let the opener know SVG Edit is ready" → "let the opener know svgedit is ready" |
| `packages/svgcanvas/svgcanvas.js` | 1209-1210 | JSDoc "SVG-Edit" (×2 lines) → "svgedit" |
| `packages/svgcanvas/core/svg-exec.js` | 78 | **Reword** `// Keep SVG-Edit comment on top` → `// Keep generator comment on top` (the literal generator string in `clear.js:51` is "svgedit" since Step 1; the comment was identifying which comment-text to hoist — now stale phrasing) |
| `src/editor/tests/unit-harness.html` | 5 | `<title>SVG-Edit Unit Harness</title>` → `<title>svgedit Unit Harness</title>` |

### Out of scope

- **10 `src/editor/images/*.svg` XML attribution comments** (`<!-- Created with SVG-edit - ... -->`) — defensible historical attribution (upstream's tool DID create them). Tracked separately under `todo_svgedit.md` #10 "Dead code surfaced by Step 1" subsection.
- **`@copyright 2010 Alexis Deveria, 2010 Jeff Schiller` JSDoc headers** — historical author attribution (not project-name references); leave intact.

## Verification gates

- `npm run lint` clean (no diff to lintable JS)
- `npx vitest run` → 564/564 passing (no test changes)
- `node scripts/run-e2e.mjs` → 178 passed + 2 skipped (no test changes)
- `npm run build` succeeds

## Risks

Negligible. Mechanical string-content edits inside comments + i18n string values + one HTML title + one HTML aria-label. No code logic touched. No file structure changes. No imports added or removed.

Edge case: if any external consumer (extension, docs, third-party tool) hard-codes the string `"SVG-Edit Home Page"` to detect the editor presence, they would break — but svgedit accepts no third-party PRs and the editor's stable detection surface is `window.svgEditor` per Step 1.5's audit, not a localized string.

## Rollback

Pre-merge: `git branch -D feat/brand-sweep-svgedit-lowercase` — zero impact.
Post-merge: `git revert -m 1 <merge-sha>` — recovers master fully.

## Effort

15-30 min execution.
