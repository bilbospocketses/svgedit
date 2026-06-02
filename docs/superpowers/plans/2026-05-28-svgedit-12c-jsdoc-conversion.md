# svgedit JSDoc → TS Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Apply STYLE.md § 4 targeted-JSDoc rule across ~97 TypeScript files in
`packages/svgcanvas/` + `src/editor/` via ≤5-file subagent chunks. Strip type-only
`@param`/`@returns`, retain semantic-info ones (dropping `{type}` annotations),
backfill 1-line summaries for exported declarations lacking them, delete empty
JSDoc blocks.

**Architecture:** Three sequential PRs split by review surface (single PR would be
~97 files / 22 chunks). PR-A: `packages/svgcanvas/` (8 chunks). PR-B: `src/editor/`
shell + `components/` (8 chunks). PR-C: `src/editor/` dialogs + panels + extensions
(6 chunks). Each chunk is one implementer subagent + one spec-compliance reviewer +
one code-quality reviewer + commit. Sequential within each PR (avoids branch
conflicts). PRs land in order off the previous PR's merged master.

**Tech Stack:** TypeScript, ESLint (`typescript-eslint`), markdownlint-cli2 (for
CHANGELOG/doc enforcement), Vitest (701 tests), Playwright e2e (250 tests).

**Branch strategy:**

- This plan + spec ship together on `docs/12-c-jsdoc-conversion-spec` as a single PR
  (matching the 12.A/12.B pattern).
- PR-A: `feature/12-c-svgcanvas` off the spec-merged master.
- PR-B: `feature/12-c-editor-shell-components` off PR-A's merged master.
- PR-C: `feature/12-c-editor-dialogs-panels-extensions` off PR-B's merged master.

**Spec reference:** `docs/superpowers/specs/2026-05-28-svgedit-12c-jsdoc-conversion-design.md`.

---

## File structure

### PR-A — `packages/svgcanvas/` (chunks 1-8, 37 files)

| Chunk | Files | Count |
|---|---|---|
| 1 | `packages/svgcanvas/common/browser.ts`, `common/logger.ts`, `common/util.ts`, `svgcanvas.ts`, `core/svgcanvas-types.ts` | 5 |
| 2 | `packages/svgcanvas/core/blur-event.ts`, `clear.ts`, `copy-elem.ts`, `dataStorage.ts`, `draw.ts` | 5 |
| 3 | `packages/svgcanvas/core/elem-get-set.ts`, `event.ts`, `history.ts`, `historyrecording.ts`, `json.ts` | 5 |
| 4 | `packages/svgcanvas/core/layer.ts`, `math.ts`, `namespaces.ts`, `paint.ts`, `paste-elem.ts` | 5 |
| 5 | `packages/svgcanvas/core/path-actions.ts`, `path-data.ts`, `path-method.ts`, `path.ts` | 4 |
| 6 | `packages/svgcanvas/core/recalculate.ts`, `sanitize.ts`, `select.ts`, `selected-elem.ts`, `selection.ts` | 5 |
| 7 | `packages/svgcanvas/core/svg-exec.ts`, `svgroot.ts`, `text-actions.ts`, `touch.ts` | 4 |
| 8 | `packages/svgcanvas/core/undo.ts`, `units.ts`, `utilities.ts`, `coords.ts` | 4 |

CHANGELOG entry added at end of PR-A.

### PR-B — `src/editor/` shell + components (chunks 9-16, 33 files)

| Chunk | Files | Count |
|---|---|---|
| 9 | `src/editor/Editor.ts` (large file — solo chunk) | 1 |
| 10 | `src/editor/ConfigObj.ts`, `contextmenu.ts`, `editorInit.ts`, `locale.ts`, `MainMenu.ts` | 5 |
| 11 | `src/editor/Rulers.ts`, `svgEditorInstance.ts`, `typed-events.ts`, `common/shortcut.ts` | 4 |
| 12 | `src/editor/components/index.ts`, `PaintBox.ts`, `se-paint-picker.ts`, `seButton.ts`, `seDropdown.ts` | 5 |
| 13 | `src/editor/components/seExplorerButton.ts`, `seFlyingButton.ts`, `seInput.ts`, `seList.ts`, `seListItem.ts` | 5 |
| 14 | `src/editor/components/seMenu.ts`, `seMenuItem.ts`, `sePalette.ts`, `seSelect.ts`, `seSpinInput.ts` | 5 |
| 15 | `src/editor/components/seText.ts`, `seZoom.ts`, `jgraduate/ColorModel.ts`, `jgraduate/jPickerShim.ts`, `jgraduate/se-color-picker.ts` | 5 |
| 16 | `src/editor/components/jgraduate/se-color-slider.ts`, `se-gradient-editor.ts`, `se-gradient-stop.ts` | 3 |

CHANGELOG entry added at end of PR-B.

### PR-C — `src/editor/` dialogs + panels + extensions (chunks 17-22, 27 files)

| Chunk | Files | Count |
|---|---|---|
| 17 | `src/editor/dialogs/cmenuDialog.ts`, `cmenuLayersDialog.ts`, `editorPreferencesDialog.ts`, `exportDialog.ts`, `globalDialogs.ts` | 5 |
| 18 | `src/editor/dialogs/imagePropertiesDialog.ts`, `index.ts`, `SePlainAlertDialog.ts`, `seStatusDialog.ts`, `svgSourceDialog.ts` | 5 |
| 19 | `src/editor/panels/BottomPanel.ts`, `LayersPanel.ts`, `LeftPanel.ts`, `TopPanel.ts` | 4 |
| 20 | `src/editor/extensions/ext-connector/ext-connector.ts`, `ext-eyedropper/ext-eyedropper.ts`, `ext-grid/ext-grid.ts`, `ext-layer_view/ext-layer_view.ts`, `ext-markers/ext-markers.ts` | 5 |
| 21 | `src/editor/extensions/ext-opensave/ext-opensave.ts`, `ext-overview_window/ext-overview_window.ts`, `ext-overview_window/dragmove/dragmove.ts`, `ext-panning/ext-panning.ts`, `ext-polystar/ext-polystar.ts` | 5 |
| 22 | `src/editor/extensions/ext-shapes/ext-shapes.ts`, `ext-storage/ext-storage.ts`, `ext-storage/storageDialog.ts` | 3 |

CHANGELOG entry added at end of PR-C.

### Out-of-scope files (don't touch)

- `**/locale/en.ts` (10 files) — i18n string bundles, not source.
- `src/editor/global-dialogs.d.ts`, `src/editor/vite-shims.d.ts` — pure type-shim files.
- `tests/**` — out of scope per STYLE.md § 9.
- `_reference/embed-api-v6/**` — preserved historical reference.

---

## Common reference — STYLE.md § 4 rules (verbatim for subagent prompts)

Every chunk's implementer subagent receives these rules verbatim. Copy this block into
the subagent prompt for each chunk.

### Rule 1 — Strip type-only `@param` / `@returns`

A `@param` or `@returns` line is **type-only** if its description, after stripping
whitespace and the optional leading `-`, is one of:

- A near-identical restatement of the parameter name. Examples:
  `@param {string} name - The name`
  `@param {Element} elem - The element`
  `@param {number} count - Number of items` (count = number of items, restatement)
- A pure type label with no extra semantic content. Examples:
  `@returns {string} The string representation`
  `@returns {boolean} Whether successful`
- Empty (no description at all). Example: `@param {string} name`

**Action:** Strip the entire line from the JSDoc block.

### Rule 2 — Preserve semantic-info `@param` / `@returns`

A line is **semantic-info** if its description contains any of:

- **Allowed values or enum constraints:** `e.g., 'select', 'fhpath', 'text'`,
  `must be one of {a, b, c}`, `'low' | 'high'`.
- **Units:** `milliseconds`, `pixels`, `radians`, `bytes`.
- **Range constraints:** `0 to 1`, `non-negative integer`, `≥ 0`.
- **Edge cases / null-handling:** `null when not found`, `undefined if X`.
- **Side-effect notes:** `dispatches modeChange event`, `mutates the argument`.
- **Examples:** `e.g. \`#fff\``, `(default 'svg-edit')`.

**Action:** Keep the line, but drop the `{type}` annotation. Example transform:

```typescript
// Before
/** @param {string} mode - The drawing mode (e.g., 'select', 'fhpath', 'text') */
setCurrentMode(mode: string): void

// After
/** @param mode - The drawing mode (e.g., 'select', 'fhpath', 'text') */
setCurrentMode(mode: string): void
```

**Bias:** When in doubt about whether a description carries semantic info, **prefer
preservation** — don't strip aggressively.

### Rule 3 — Delete empty JSDoc blocks

After Rules 1-2 apply, if a JSDoc block contains only the opening `/**`, optional blank
`*` lines, and closing `*/` (no remaining tags, no description), delete the entire
block including its leading whitespace and trailing newline.

### Rule 4 — Backfill public-API summaries

For every declaration in scope dirs that:

- Has the `export` keyword (function, class, `const`, `let`, type alias, interface), AND
- Lacks a preceding JSDoc block with any prose content,

…add a 1-line JSDoc summary describing intent.

**Summary rules:**

- Imperative present tense (`Compute …`, `Set …`, `Dispatch …`).
- ≤100 characters total inside `/** ... */`.
- No trailing period.
- Capture intent + one non-obvious detail if applicable (side effects, allowed values).
- Don't restate the function name (`/** Compute X. */` for `computeX()` is noise).

Example:

```typescript
// Before
export const buildHistory = (entries: ChangeEntry[]): History => {

// After
/** Build a History instance from change entries; oldest first */
export const buildHistory = (entries: ChangeEntry[]): History => {
```

**When to skip:** if the declaration already has any JSDoc block with prose content
(even a single descriptive line), leave it alone. Don't disturb existing intent.

**Internal (non-exported) declarations:** default to NO JSDoc. Only add if behavior is
genuinely non-obvious (hidden constraint, subtle invariant, workaround). Use judgment;
when in doubt, leave alone.

### Rule 5 — Preserve other tags

`@throws`, `@deprecated`, `@example`, `@see`, `@module`, `@license`, `@override`
are preserved untouched. The strip rules above ONLY apply to `@param` and `@returns`.

---

## Prerequisite

Spec PR (this plan + the design spec on branch `docs/12-c-jsdoc-conversion-spec`) must
be merged to master before Task 1. The spec PR ship sequence is at the bottom of this
plan under "Spec PR ship sequence."

---

## PR-A — `packages/svgcanvas/` (chunks 1-8)

### Task 1: Branch + start PR-A

- [ ] **Step 1: Pre-flight check**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
git -C "C:/Users/jscha/source/repos/svgedit" log --oneline -1
```

Expected: master is at the post-spec-PR merge SHA; spec + plan files exist on master.

- [ ] **Step 2: Branch**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feature/12-c-svgcanvas origin/master
git -C "C:/Users/jscha/source/repos/svgedit" status --short
```

Expected: clean branch off updated master.

---

### Task 2: Chunk 1 — `packages/svgcanvas/common/` + top-level (5 files)

**Files:**

- Modify: `C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/common/browser.ts`
- Modify: `C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/common/logger.ts`
- Modify: `C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/common/util.ts`
- Modify: `C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/svgcanvas.ts`
- Modify: `C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/core/svgcanvas-types.ts`

- [ ] **Step 1: Dispatch implementer subagent**

Subagent prompt (controller pastes verbatim):

```
You are applying STYLE.md § 4 to 5 TypeScript files in svgedit packages/svgcanvas/.
This is chunk 1 of TODO #12.C.

## Files

C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/common/browser.ts
C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/common/logger.ts
C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/common/util.ts
C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/svgcanvas.ts
C:/Users/jscha/source/repos/svgedit/packages/svgcanvas/core/svgcanvas-types.ts

## Rules (verbatim from STYLE.md § 4 / 12.C spec)

[Controller: paste the full Common Reference block from this plan — Rules 1-5 + Bias note.]

## Workflow

For each file in the list above:

1. Read the file in full.
2. Apply Rule 1 — identify and strip type-only @param/@returns lines.
3. Apply Rule 2 — for semantic-info lines, drop the {type} annotation, keep the rest.
4. Apply Rule 3 — delete any JSDoc block that became empty.
5. Apply Rule 4 — for every exported declaration lacking a JSDoc summary, add one.
6. Apply Rule 5 — verify @throws/@deprecated/@example/@see/@module/@license untouched.
7. Save the file.

After all 5 files are processed:

8. Run from C:/Users/jscha/source/repos/svgedit:
   - npm run lint  (expected: exit 0)
   - npx vitest run  (expected: 701/701 passing)
   - npm run build  (expected: success)
9. Commit:
   git -C "C:/Users/jscha/source/repos/svgedit" add packages/svgcanvas/common packages/svgcanvas/svgcanvas.ts packages/svgcanvas/core/svgcanvas-types.ts
   git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor: 12.C chunk 1 — apply STYLE.md § 4 to packages/svgcanvas/common + top-level (TODO #12.C)"

## Environment

- Repo: C:/Users/jscha/source/repos/svgedit
- Shell: PowerShell preferred; Bash for POSIX-shaped tasks.
- Git: ALWAYS use `git -C "C:/Users/jscha/source/repos/svgedit"`. No `cd` into the repo.
- Files: absolute paths everywhere.
- Commits: signed (SSH pre-configured). NO AI attribution lines.
- e2e: defer to CI; don't run locally unless quick.

## When You're in Over Your Head

If a file has a JSDoc structure you don't recognize (e.g., complex @example blocks,
nested @typedef, or content that's ambiguous between Rule 1 and Rule 2):
- STOP
- Report DONE_WITH_CONCERNS with the file path + the ambiguous block verbatim
- The controller decides whether to escalate, hand-edit, or proceed

## Self-Review

Before reporting, re-read each file's diff and verify:
- Every @param/@returns line touched matches Rule 1 (stripped) or Rule 2 (kept, {type} dropped)
- Every exported declaration has a JSDoc summary (or already had one)
- No @throws/@deprecated/@example/@see/@module/@license tags accidentally removed
- File compiles (npm run build success)
- 701/701 vitest

## Report

Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Commits made (SHA + subject)
Test/lint/build results
Per-file summary: how many @param/@returns stripped vs kept; how many summaries backfilled
Anything ambiguous you skipped
Self-review findings
```

- [ ] **Step 2: Spec compliance review**

After implementer returns DONE or DONE_WITH_CONCERNS, dispatch spec reviewer:

```
You are reviewing whether chunk 1 of svgedit TODO #12.C matches the spec.

Spec: C:/Users/jscha/source/repos/svgedit/docs/superpowers/specs/2026-05-28-svgedit-12c-jsdoc-conversion-design.md
Plan: C:/Users/jscha/source/repos/svgedit/docs/superpowers/plans/2026-05-28-svgedit-12c-jsdoc-conversion.md

Chunk 1 files:
[paste file list]

Implementer claims:
[paste implementer report]

Verify by reading the diffs (not the report):
1. git -C "C:/Users/jscha/source/repos/svgedit" log --oneline -1 — confirm one commit on branch
2. git -C "C:/Users/jscha/source/repos/svgedit" diff HEAD~1..HEAD — read the chunk diff
3. Per file, spot-check:
   - Stripped @param/@returns lines match Rule 1 (type-only)
   - Kept @param/@returns lines match Rule 2 (semantic-info), {type} dropped
   - Empty JSDoc blocks deleted, no orphan /** or */
   - Newly-added 1-line summaries on exported declarations are imperative + ≤100 chars
   - @throws/@deprecated/@example/@see/@module/@license still present where they were
4. Commit signed? git -C "C:/Users/jscha/source/repos/svgedit" log --show-signature HEAD
5. No AI attribution? git -C "C:/Users/jscha/source/repos/svgedit" log --pretty=fuller HEAD | Select-String "Co-Authored-By|Generated with"

Report:
✅ Spec compliant — list noteworthy observations
❌ Issues found — file:line specifics

Bias toward checking that semantic-info @param lines were NOT stripped aggressively
(that's the highest-risk failure mode for this work).
```

- [ ] **Step 3: Code quality review**

Dispatch code-quality reviewer (only after spec ✅):

```
Code-quality review for chunk 1 of svgedit TODO #12.C.

Files: [paste]
Diff range: git -C "C:/Users/jscha/source/repos/svgedit" diff HEAD~1..HEAD

Focus:
- Newly-added 1-line summaries: are they meaningful or generic ("/** Set X. */" for setX is noise)?
- Stripped lines: anything that LOOKED type-only but actually had subtle semantic info (e.g., a parenthetical example)?
- JSDoc structure post-strip: any malformed blocks, stray `* `, weird indentation?
- Did the implementer accidentally touch non-JSDoc content (signature changes, logic edits, import reorders)?
- Commit subject ≤72 chars (STYLE.md § 6); imperative present?

Verify:
- npm run lint exit 0
- npx vitest run 701/701

Report:
Strengths
Issues: 🔴 Critical | 🟡 Important | 🔵 Minor
Assessment: ✅ Approved | ⚠️ Approved with caveats | ❌ Changes needed
```

- [ ] **Step 4: Mark chunk 1 complete**

If both reviews ✅ Approved, mark the chunk task complete in TodoWrite. If issues, the
implementer (same dispatch) fixes and reviewers re-review.

---

### Tasks 3-9: Chunks 2-8

Each chunk follows the **same workflow as Task 2 Step 1-4**:

1. Dispatch implementer subagent with chunk-specific file list + same rules
2. Spec compliance reviewer
3. Code-quality reviewer
4. Mark complete

Substitute the file list, commit message, and chunk number per the file structure table
at the top of this plan.

**Commit message template per chunk:**

```
refactor: 12.C chunk N — apply STYLE.md § 4 to <directory description> (TODO #12.C)
```

Examples:

- Chunk 2: `refactor: 12.C chunk 2 — apply STYLE.md § 4 to svgcanvas/core batch 1 (TODO #12.C)`
- Chunk 5: `refactor: 12.C chunk 5 — apply STYLE.md § 4 to svgcanvas/core path files (TODO #12.C)`

**Chunk file lists (exact paths for subagent dispatch):**

- **Chunk 2** (5 files): `packages/svgcanvas/core/blur-event.ts`, `clear.ts`, `copy-elem.ts`, `dataStorage.ts`, `draw.ts`
- **Chunk 3** (5 files): `packages/svgcanvas/core/elem-get-set.ts`, `event.ts`, `history.ts`, `historyrecording.ts`, `json.ts`
- **Chunk 4** (5 files): `packages/svgcanvas/core/layer.ts`, `math.ts`, `namespaces.ts`, `paint.ts`, `paste-elem.ts`
- **Chunk 5** (4 files): `packages/svgcanvas/core/path-actions.ts`, `path-data.ts`, `path-method.ts`, `path.ts`
- **Chunk 6** (5 files): `packages/svgcanvas/core/recalculate.ts`, `sanitize.ts`, `select.ts`, `selected-elem.ts`, `selection.ts`
- **Chunk 7** (4 files): `packages/svgcanvas/core/svg-exec.ts`, `svgroot.ts`, `text-actions.ts`, `touch.ts`
- **Chunk 8** (4 files): `packages/svgcanvas/core/undo.ts`, `units.ts`, `utilities.ts`, `coords.ts`

After chunk 8 lands, PR-A has 8 implementation commits on `feature/12-c-svgcanvas`.

---

### Task 10: PR-A CHANGELOG + verify + push + open + merge

**Files:**

- Modify: `C:/Users/jscha/source/repos/svgedit/CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry**

Use `Edit` to insert under `## [Unreleased]`:

```markdown
### Changed (JSDoc conversion — packages/svgcanvas/ -- 2026-MM-DD)

- Applied STYLE.md § 4 targeted-JSDoc rule across all 37 .ts files in `packages/svgcanvas/`.
  Stripped type-only `@param`/`@returns` lines; retained semantic-info lines (allowed values, units, side effects) with `{type}` annotations dropped.
- Backfilled 1-line summaries on exported functions, classes, types, and constants lacking them.
- Empty JSDoc blocks deleted; `@throws`/`@deprecated`/`@example`/`@see`/`@module`/`@license` preserved untouched.
- Sub-project 12.C PR-A of 3. PRs B (editor shell + components) and C (dialogs + panels + extensions) follow.
```

Replace `2026-MM-DD` with the actual day of opening the PR.

- [ ] **Step 2: Commit CHANGELOG**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: CHANGELOG entry for 12.C PR-A (TODO #12.C)"
```

- [ ] **Step 3: Verify branch state**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" log --oneline origin/master..HEAD
git -C "C:/Users/jscha/source/repos/svgedit" status --short
git -C "C:/Users/jscha/source/repos/svgedit" diff --stat origin/master..HEAD
```

Expected: 9 commits (8 chunks + 1 CHANGELOG); clean working tree; ~37 files modified.

- [ ] **Step 4: Final local verification**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npm run lint
npx vitest run
npm run build
```

Expected: lint exit 0; vitest 701/701; build success. e2e defer to CI.

- [ ] **Step 5: Push branch**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feature/12-c-svgcanvas
```

- [ ] **Step 6: Open PR-A**

```pwsh
gh pr create --repo bilbospocketses/svgedit --base master --head feature/12-c-svgcanvas --title "refactor: 12.C PR-A — JSDoc conversion in packages/svgcanvas/" --body @'
## Summary

- Applied STYLE.md § 4 targeted-JSDoc rule across 37 .ts files in `packages/svgcanvas/`.
- Stripped type-only `@param`/`@returns`; retained semantic-info ones with `{type}` annotations dropped.
- Backfilled 1-line summaries on exported declarations lacking them.
- Empty JSDoc blocks deleted; other tags preserved untouched.

Implements sub-project 12.C PR-A of 3 per spec `docs/superpowers/specs/2026-05-28-svgedit-12c-jsdoc-conversion-design.md`.

## Test plan

- [ ] CI green (build-and-unit + e2e-chromium + e2e-firefox + CodeQL + Scorecard)
- [ ] `npm run lint` exits 0 locally
- [ ] Per-chunk diff-skim shows STYLE.md § 4 applied surgically
- [ ] vitest 701/701
- [ ] `npm run build` succeeds

## Out of scope

- `src/editor/` files — PR-B (shell + components) and PR-C (dialogs + panels + extensions).
- Tutorial rewrites — sub-project 12.D.

Refs: TODO #12.C.
'@
```

- [ ] **Step 7: Watch CI via ScheduleWakeup polling loop**

Per `master_github_pr_workflow.md`. 120s-270s cadence; `gh pr checks <N>` per tick.
Required checks: `build-and-unit`, `e2e-chromium`, `e2e-firefox`, CodeQL, Scorecard.

- [ ] **Step 8: Squash-merge once green**

```pwsh
gh pr merge <PR-NUMBER> --repo bilbospocketses/svgedit --squash --delete-branch
```

Per CLAUDE.md "PR Merge Method on Signed Repos — Squash, Never Rebase".

- [ ] **Step 9: Sync local master**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

---

## PR-B — `src/editor/` shell + components (chunks 9-16)

### Task 11: Branch + start PR-B

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feature/12-c-editor-shell-components origin/master
git -C "C:/Users/jscha/source/repos/svgedit" status --short
```

Expected: clean branch off PR-A-merged master.

### Tasks 12-19: Chunks 9-16

Same workflow as PR-A's chunk tasks. Each chunk = implementer + spec review + code review + commit.

**Chunk file lists:**

- **Chunk 9** (1 file — solo because `Editor.ts` is the largest): `src/editor/Editor.ts`
- **Chunk 10** (5 files): `src/editor/ConfigObj.ts`, `contextmenu.ts`, `editorInit.ts`, `locale.ts`, `MainMenu.ts`
- **Chunk 11** (4 files): `src/editor/Rulers.ts`, `svgEditorInstance.ts`, `typed-events.ts`, `common/shortcut.ts`
- **Chunk 12** (5 files): `src/editor/components/index.ts`, `PaintBox.ts`, `se-paint-picker.ts`, `seButton.ts`, `seDropdown.ts`
- **Chunk 13** (5 files): `src/editor/components/seExplorerButton.ts`, `seFlyingButton.ts`, `seInput.ts`, `seList.ts`, `seListItem.ts`
- **Chunk 14** (5 files): `src/editor/components/seMenu.ts`, `seMenuItem.ts`, `sePalette.ts`, `seSelect.ts`, `seSpinInput.ts`
- **Chunk 15** (5 files): `src/editor/components/seText.ts`, `seZoom.ts`, `jgraduate/ColorModel.ts`, `jgraduate/jPickerShim.ts`, `jgraduate/se-color-picker.ts`
- **Chunk 16** (3 files): `src/editor/components/jgraduate/se-color-slider.ts`, `se-gradient-editor.ts`, `se-gradient-stop.ts`

**Special note for chunk 9 (`Editor.ts` solo):** This file is the largest in the codebase
(~1200+ LOC). The subagent should expect to spend significantly more time on this single
file than on a 5-file chunk. Verification at the end of the chunk should explicitly run
`npm run build` and `npx vitest run` to catch any regression introduced by the
larger-than-usual edit surface.

### Task 20: PR-B CHANGELOG + verify + push + open + merge

Same workflow as Task 10 with these substitutions:

- Branch: `feature/12-c-editor-shell-components`
- CHANGELOG entry:

```markdown
### Changed (JSDoc conversion — editor shell + components -- 2026-MM-DD)

- Applied STYLE.md § 4 targeted-JSDoc rule across `src/editor/` shell files (Editor.ts, ConfigObj.ts, etc.) and `src/editor/components/` (including `jgraduate/`).
- Stripped type-only `@param`/`@returns`; retained semantic-info ones with `{type}` annotations dropped.
- Backfilled 1-line summaries on exported declarations lacking them.
- Sub-project 12.C PR-B of 3. PR-C (dialogs + panels + extensions) follows.
```

- PR title: `refactor: 12.C PR-B — JSDoc conversion in editor shell + components/`
- Expected commits: 9 (8 chunks + 1 CHANGELOG); ~33 files changed.

---

## PR-C — `src/editor/` dialogs + panels + extensions (chunks 17-22)

### Task 21: Branch + start PR-C

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feature/12-c-editor-dialogs-panels-extensions origin/master
git -C "C:/Users/jscha/source/repos/svgedit" status --short
```

Expected: clean branch off PR-B-merged master.

### Tasks 22-27: Chunks 17-22

Same workflow. Chunk file lists:

- **Chunk 17** (5 files): `src/editor/dialogs/cmenuDialog.ts`, `cmenuLayersDialog.ts`, `editorPreferencesDialog.ts`, `exportDialog.ts`, `globalDialogs.ts`
- **Chunk 18** (5 files): `src/editor/dialogs/imagePropertiesDialog.ts`, `index.ts`, `SePlainAlertDialog.ts`, `seStatusDialog.ts`, `svgSourceDialog.ts`
- **Chunk 19** (4 files): `src/editor/panels/BottomPanel.ts`, `LayersPanel.ts`, `LeftPanel.ts`, `TopPanel.ts`
- **Chunk 20** (5 files): `src/editor/extensions/ext-connector/ext-connector.ts`, `ext-eyedropper/ext-eyedropper.ts`, `ext-grid/ext-grid.ts`, `ext-layer_view/ext-layer_view.ts`, `ext-markers/ext-markers.ts`
- **Chunk 21** (5 files): `src/editor/extensions/ext-opensave/ext-opensave.ts`, `ext-overview_window/ext-overview_window.ts`, `ext-overview_window/dragmove/dragmove.ts`, `ext-panning/ext-panning.ts`, `ext-polystar/ext-polystar.ts`
- **Chunk 22** (3 files): `src/editor/extensions/ext-shapes/ext-shapes.ts`, `ext-storage/ext-storage.ts`, `ext-storage/storageDialog.ts`

### Task 28: PR-C CHANGELOG + verify + push + open + merge

Same workflow as Task 10. Substitutions:

- Branch: `feature/12-c-editor-dialogs-panels-extensions`
- CHANGELOG entry:

```markdown
### Changed (JSDoc conversion — editor dialogs + panels + extensions -- 2026-MM-DD)

- Applied STYLE.md § 4 targeted-JSDoc rule across `src/editor/dialogs/`, `panels/`, and `extensions/`.
- Stripped type-only `@param`/`@returns`; retained semantic-info ones with `{type}` annotations dropped.
- Backfilled 1-line summaries on exported declarations lacking them.
- Sub-project 12.C COMPLETE. 12.D (publish-quality user tutorials) now unblocked.
```

- PR title: `refactor: 12.C PR-C — JSDoc conversion in editor dialogs + panels + extensions/`
- Expected commits: 7 (6 chunks + 1 CHANGELOG); ~27 files changed.

---

## Task 29: Update todo_svgedit.md memory file

**Files:**

- Modify: `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`

- [ ] **Step 1: Add SHIPPED banner line**

Use `Edit` to add after the `**TODO #12.B SHIPPED**` banner line:

```markdown
> **TODO #12.C SHIPPED** -- spec/plan PR #__ + PR-A #__ (svgcanvas) + PR-B #__ (editor shell + components) + PR-C #__ (dialogs + panels + extensions), all merged 2026-MM-DD. STYLE.md § 4 targeted-JSDoc rule applied across ~97 .ts files in `packages/svgcanvas/` + `src/editor/`. Type-only `@param`/`@returns` stripped; semantic-info ones retained with `{type}` dropped; 1-line summaries backfilled on exported declarations. TODO #2 (linter swap) observed effectively SHIPPED — eslint.config.js already on typescript-eslint. vitest 701/701, e2e 250/250 throughout. 12.D (publish-quality user tutorials) now UNBLOCKED. Spec at `docs/superpowers/specs/2026-05-28-svgedit-12c-jsdoc-conversion-design.md`, plan at `docs/superpowers/plans/2026-05-28-svgedit-12c-jsdoc-conversion.md`.
```

Fill in actual PR numbers and merge date from execution.

- [ ] **Step 2: Update active items line**

Find the "Active items:" line and change:

- `6 substantive (#5, #7, #9, #12.C-D, #13)` → `5 substantive (#5, #7, #9, #12.D, #13)`
- Update master SHA to the latest post-PR-C merge SHA
- Update last-updated date

- [ ] **Step 3: No commit needed** (memory file, not repo file).

---

## Task 30: Final code review of entire 12.C implementation

Dispatch a final code reviewer subagent to review the merged 12.C work across all 3 PRs
against the spec. Focus:

- Sweep completeness (every in-scope .ts file visited)
- Cross-PR consistency (same rule application style across all chunks)
- No type-only `@param`/`@returns` remaining in scope dirs
- Every `export` declaration has a summary (sanity grep)
- Test/build still green at the merged-final state

Reviewer prompt template:

```
You are doing a final code review of the entire svgedit TODO #12.C implementation across 3 PRs.

Spec: C:/Users/jscha/source/repos/svgedit/docs/superpowers/specs/2026-05-28-svgedit-12c-jsdoc-conversion-design.md

Inspect master at the post-PR-C HEAD. Verify:

1. Cumulative diff: git -C "C:/Users/jscha/source/repos/svgedit" diff <pre-PR-A-SHA>..HEAD
2. Type-only @param/@returns sanity grep across scope dirs — should be near-zero.
3. Exported declarations in scope dirs — spot-check 10-15 random files for JSDoc summary presence.
4. Other tags preserved: grep for @throws/@deprecated/@example/@see in scope dirs; counts should be roughly unchanged from pre-12.C.
5. npm run lint, npx vitest run, npm run build all clean.
6. No commit subjects exceed STYLE.md § 6 caps egregiously.
7. CHANGELOG.md has 3 12.C entries (PR-A, PR-B, PR-C).

Report cross-PR consistency observations + any latent issues missed by per-chunk reviews.
```

---

## Spec PR ship sequence (this plan + the design spec)

Run these steps BEFORE Task 1 of the implementation work above.

- [ ] **Step 1: Branch + commit**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b docs/12-c-jsdoc-conversion-spec
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/specs/2026-05-28-svgedit-12c-jsdoc-conversion-design.md docs/superpowers/plans/2026-05-28-svgedit-12c-jsdoc-conversion.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: #12.C spec + plan (JSDoc → TS conversion)"
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin docs/12-c-jsdoc-conversion-spec
```

- [ ] **Step 2: Open spec PR**

```pwsh
gh pr create --repo bilbospocketses/svgedit --base master --head docs/12-c-jsdoc-conversion-spec --title "docs: #12.C spec + plan (JSDoc → TS conversion)" --body @'
## Summary

- Adds the design spec and implementation plan for sub-project 12.C of TODO #12.
- 12.C applies STYLE.md § 4 targeted-JSDoc rule across ~97 .ts files in `packages/svgcanvas/` + `src/editor/`: strip type-only `@param`/`@returns`, retain semantic-info ones (drop `{type}` annotations), backfill 1-line summaries for exported declarations lacking them, delete empty JSDoc blocks.
- Ships as three sequential PRs (PR-A svgcanvas + PR-B editor shell + components + PR-C editor dialogs + panels + extensions) split by review surface; per-chunk subagent dispatch at ≤5 files per chunk.
- TODO #2 (linter swap) observed effectively SHIPPED — eslint.config.js is fully on typescript-eslint; no `standard` linter dependency.

## Test plan

- [ ] Spec doc renders cleanly in PR diff view
- [ ] Plan doc renders cleanly in PR diff view
- [ ] CI green on doc-only changes

Refs: TODO #12.C in `todo_svgedit.md`.
'@
```

- [ ] **Step 3: Watch CI + squash-merge**

Same ScheduleWakeup polling protocol as the implementation PRs. Once green:

```pwsh
gh pr merge <SPEC-PR-NUMBER> --repo bilbospocketses/svgedit --squash --delete-branch
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

Then proceed to Task 1 (PR-A start).

---

## Self-review checklist (run after writing the plan)

- [x] **Spec coverage:** Every spec section maps to tasks. Edit Rules 1-5 → Common Reference block embedded in every chunk task. Public-API backfill → Rule 4 + verification in final review. Chunking strategy → 22 chunks enumerated with exact file lists. PR shape → 3 PRs locked. Memory update → Task 29. TODO #2 verification → noted in spec + final review.
- [x] **Placeholder scan:** No "TBD", "implement later", or "similar to Task N" entries. Per-chunk file lists are explicit. The "2026-MM-DD" placeholders in CHANGELOG entries and memory file are template fields the executor fills with the actual merge date.
- [x] **Type consistency:** N/A (refactor work, not new APIs). File paths and chunk numbers consistent across the plan.
- [x] **Branch protocol:** Branches from `origin/master` (each PR's base is the prior PR's merged master); `git -C` everywhere; squash-merge with `--delete-branch`; no rebase.
- [x] **CI-wait protocol:** Each PR ship uses ScheduleWakeup polling per `master_github_pr_workflow.md`.
- [x] **Multi-session cwd discipline:** All git commands use absolute paths; no `cd` into the repo.
- [x] **PowerShell on Windows:** PS syntax (`@'...'@` here-strings) used throughout for `gh pr create`.
- [x] **Reviewer order:** Every chunk does spec-compliance review BEFORE code-quality review per the subagent-driven-development skill.
- [x] **Implementer prompts are self-contained:** Each chunk's prompt includes the full Common Reference rules (Rules 1-5 + Bias), not a "see § X" reference, so subagents have everything they need without reading the plan file.
