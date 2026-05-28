# svgedit Brand Hygiene Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Apply STYLE.md (12.A) to existing fork docs and strip upstream `@copyright` / `@author`
JSDoc lines from 36 source files. Ships as two PRs split by review character — PR-1 substantive doc
framing, PR-2 mechanical strip.

**Architecture:** Two sequential PRs off master. PR-1 lands first, creating `AGENTS.md`, refreshing
`CONTRIBUTING.md` and `README.md`, expanding markdownlint coverage to top-level fork docs, and
wiring `markdownlint-cli2` into `npm run lint`. PR-2 lands second off the updated master, applying a
surgical strip of `@copyright` / `@author` lines via a one-shot helper script (run from
`ClaudeScratch`, not committed) followed by per-file diff-skim.

**Tech Stack:** Markdown, JSONC (markdownlint config), Node.js (one-shot helper script), npm
scripts. Source files are TypeScript but no compilation logic is touched.

**Branch strategy:**

- This plan + spec ship together on `docs/12-b-brand-hygiene-spec` as a single PR (matching the 12.A
  pattern from PR #73).
- PR-1 implementation lands on `feature/12-b-docs-framing` after the spec PR merges.
- PR-2 implementation lands on `feature/12-b-copyright-strip` after PR-1 merges.

**Spec reference:** `docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md`.

---

## File structure

### PR-1 (docs framing + markdownlint expansion)

| Action | Path | Responsibility |
|---|---|---|
| Create | `AGENTS.md` | Agent-context entry point; references STYLE.md, conventions, no AI attribution |
| Modify | `CONTRIBUTING.md` | Replace upstream-PR routing; drop outdated TS-migration framing |
| Modify | `README.md` | Update tutorials row pointer; verify sentence-case headings |
| Modify | `.markdownlint-cli2.jsonc` | Expand `globs` to top-level fork docs |
| Modify | `package.json` | Chain `markdownlint-cli2` into `lint` script |
| Modify | `CHANGELOG.md` | `### Changed` entry under `[Unreleased]` |

### PR-2 (mechanical strip)

| Action | Path | Responsibility |
|---|---|---|
| Modify (24) | `packages/svgcanvas/**/*.ts` (per file list in Task 9) | Strip `@copyright` / `@author` lines, drop empty JSDoc blocks |
| Modify (12) | `src/editor/**/*.ts` (per file list in Task 9) | Same surgical pattern |
| Modify | `CHANGELOG.md` | `### Changed` entry under `[Unreleased]` |

### Helper script (NOT committed)

| Action | Path | Responsibility |
|---|---|---|
| Create | `C:/Users/jscha/ClaudeScratch/strip-copyright.mjs` | One-shot Node script; reads the 36 file list, applies surgical strip, leaves the working tree dirty for diff-skim |

---

## Prerequisite

Spec PR (this plan + the design spec on branch `docs/12-b-brand-hygiene-spec`) must be merged to
master before Task 1 begins. The spec PR ship sequence is documented at the bottom of this plan
under "Spec PR ship sequence."

---

## PR-1 — Docs framing + markdownlint expansion

### Task 1: Branch from updated master

**Files:** none changed yet.

- [ ] **Step 1: Fetch + check out master + pull**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

Expected: master at the post-spec-PR merge SHA. Spec file
`docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md` is present on master.

- [ ] **Step 2: Create branch**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feature/12-b-docs-framing origin/master
```

Expected: clean branch off the updated remote master.

- [ ] **Step 3: Verify clean working tree**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" status --short
```

Expected: empty output.

---

### Task 2: Create AGENTS.md

**Files:**

- Create: `C:/Users/jscha/source/repos/svgedit/AGENTS.md`

- [ ] **Step 1: Write `AGENTS.md`**

Exact content:

````markdown
# AGENTS.md — svgedit

Notes for AI coding agents (Claude Code, aider, codex, etc.) working in this repo.

## Style

All doc, JSDoc, code-comment, commit-message, and PR-description conventions live in
[`STYLE.md`](./STYLE.md). Read it before substantial contribution. Flag exceptions on the
PR; don't silently deviate.

## File and git operations

This repo lives on a multi-session host where multiple agents may operate on the same
working tree. Treat the filesystem and git index as shared state:

- Use absolute paths for every file operation (read, write, edit, glob, grep).
- Use `git -C "<repo-root>"` for every git operation. Plain `git <subcommand>` relies on
  cwd and can target a different session's working tree.
- Don't `cd` into the repo directory. Pass the absolute path each call.

## No AI attribution

Per `STYLE.md` § 6, commit messages must not include `Co-Authored-By: Claude…`,
`Generated with Claude Code`, or any AI-attribution trailer. Fork lineage is human-only.

## Verify against current code

Memories, training-data snapshots, and prior-session summaries can drift from the
working tree. Before asserting that a file, function, or flag exists, verify against
the current code with `Read`, `Grep`, or `git -C "<repo-root>" log`.

## In-flight design work

- Design specs (frozen snapshots): `docs/superpowers/specs/`
- Implementation plans (frozen snapshots): `docs/superpowers/plans/`
- Active backlog: see the project TODO file (path documented in repo owner's memory).

## Quick commands

```bash
npm start          # vite dev → http://localhost:8000/src/editor/index.html
npm run build      # build to dist/editor
npm test           # lint + vitest + Playwright e2e
npm run lint       # eslint + markdownlint-cli2
npm run lint:md    # markdownlint only
```
````

- [ ] **Step 2: Verify file written and lints clean**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" status --short
cd C:/Users/jscha/source/repos/svgedit
npx markdownlint-cli2 AGENTS.md
```

Expected: `AGENTS.md` appears as `??` (untracked). `markdownlint-cli2` exits 0 (or warns
about a configured-glob mismatch — globs get expanded in Task 5, so an "no files matched"
or "ignored by config" message is acceptable here; the direct file invocation runs the
config rules against AGENTS.md regardless).

- [ ] **Step 3: Commit**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add AGENTS.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: add AGENTS.md agent-context entry point (TODO #12.B)"
```

---

### Task 3: Refresh CONTRIBUTING.md

**Files:**

- Modify: `C:/Users/jscha/source/repos/svgedit/CONTRIBUTING.md`

- [ ] **Step 1: Read CONTRIBUTING.md to confirm current state**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" diff HEAD -- CONTRIBUTING.md
```

Use the `Read` tool to view the current file. Confirm lines 3-7 contain the
upstream-PR-routing language ("For general svgedit features and bug fixes, file PRs
against [SVG-Edit/svgedit]…") and lines 44-58 contain the "Code Style" section with the
outdated TS-migration framing ("The codebase is mid-migration… The active branch
`feat/ts-migration`… New code on `master`: existing JS + `standard` conventions…").

- [ ] **Step 2: Replace the upstream-PR-routing paragraph**

Use `Edit` on `C:/Users/jscha/source/repos/svgedit/CONTRIBUTING.md`.

Replace this block:

```markdown
Thanks for your interest. **Important context:** this repo is a personal hard fork of [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit), shaped toward standalone distribution (Velopack + Docker) and iframe-embeddable use inside [Control Menu](https://github.com/bilbospocketses/control-menu). Upstream changes are not merged here, and most contributions belong with the upstream project rather than this fork.

For general svgedit features and bug fixes, file PRs against [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit).

For fork-specific issues — the Velopack installer, iframe embed surface, Control Menu integration, the in-progress TypeScript migration — this is the right place.
```

With:

```markdown
Thanks for your interest. **Important context:** this repo is a personal hard fork of [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit), shaped toward standalone distribution (Velopack + Docker) and iframe-embeddable use inside [Control Menu](https://github.com/bilbospocketses/control-menu). Upstream changes are not merged. The fork is personal-taste-driven, not maintainer-acceptance-driven.

**Issues are welcome** for bug reports, feature suggestions, and discussion — particularly fork-specific topics (Velopack installer, iframe embed surface, Control Menu integration). General svgedit issues that apply equally to upstream are better filed at [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit).

**Pull requests are reviewed case-by-case** with no guarantee of merge. The fork's scope is locked (see `README.md`); changes outside that scope generally won't land. Coordinate via an issue first if the work is substantial.
```

- [ ] **Step 3: Replace the Code Style section's TS-migration framing**

Replace this block:

```markdown
## Code Style

For doc, comment, commit-message, and PR-description conventions, see [`STYLE.md`](./STYLE.md).

The codebase is mid-migration from JavaScript to TypeScript. The active branch `feat/ts-migration` is converting files in stages.

- New code on `master`: existing JS + `standard` conventions
- New code on `feat/ts-migration` (and post-merge `master`): TypeScript + ESLint + `typescript-eslint`

General conventions:

- Vanilla DOM + web components — no React; new code avoids jQuery (legacy jQuery in `jQuery.j*.js` files is being migrated out)
- ES modules throughout; no CommonJS
- 2-space indentation, single quotes
```

With:

```markdown
## Code Style

For doc, JSDoc, code-comment, commit-message, and PR-description conventions, see [`STYLE.md`](./STYLE.md).

Master is on TypeScript + ESLint + `typescript-eslint`. The `feat/ts-migration` branch is retained as historical reference for the JS → TS conversion work that landed on master via TODO #3 and TODO #19.

General conventions:

- Vanilla DOM + web components — no React; new code avoids jQuery (legacy jQuery files are being migrated out).
- ES modules throughout; no CommonJS.
- 2-space indentation, single quotes.
```

- [ ] **Step 4: Run markdownlint against CONTRIBUTING.md**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npx markdownlint-cli2 CONTRIBUTING.md
```

Expected: exit 0. If line-length warnings appear, hand-wrap to the 100-char soft cap.

- [ ] **Step 5: Commit**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add CONTRIBUTING.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: refresh CONTRIBUTING.md framing (TODO #12.B)"
```

---

### Task 4: Light pass on README.md

**Files:**

- Modify: `C:/Users/jscha/source/repos/svgedit/README.md`

- [ ] **Step 1: Read README.md to confirm current state**

Use the `Read` tool. Confirm the `docs/tutorials/` row in the "Repository layout" table
reads: `Editor / Canvas / API / Events / FAQ tutorials (legacy upstream content; revisit
during TS migration)`.

- [ ] **Step 2: Update the tutorials row**

Use `Edit` on `C:/Users/jscha/source/repos/svgedit/README.md`.

Replace:

```markdown
| `docs/tutorials/` | Editor / Canvas / API / Events / FAQ tutorials (legacy upstream content; revisit during TS migration) |
```

With:

```markdown
| `docs/tutorials/` | Editor / Canvas / API / Events / FAQ tutorials (rewrite pending — see TODO #12.D) |
```

- [ ] **Step 3: Run markdownlint against README.md**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npx markdownlint-cli2 README.md
```

Expected: exit 0. If line-length warnings appear, hand-wrap.

- [ ] **Step 4: Commit**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add README.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: point README tutorials row at TODO #12.D (TODO #12.B)"
```

---

### Task 5: Expand .markdownlint-cli2.jsonc + wire into npm run lint

**Files:**

- Modify: `C:/Users/jscha/source/repos/svgedit/.markdownlint-cli2.jsonc`
- Modify: `C:/Users/jscha/source/repos/svgedit/package.json`

- [ ] **Step 1: Replace `.markdownlint-cli2.jsonc` contents**

Use `Edit` on `C:/Users/jscha/source/repos/svgedit/.markdownlint-cli2.jsonc`. Replace
the existing `globs` array with the expanded list and add `docs/tutorials/**` to
`ignores`.

Full file after edit:

```jsonc
// markdownlint-cli2 runner config.
// Globs cover the top-level fork docs governed by STYLE.md.
// Sub-project 12.D will add docs/tutorials/** once those files are rewritten.
{
  "config": ".markdownlint.jsonc",
  "globs": [
    "STYLE.md",
    "README.md",
    "CONTRIBUTING.md",
    "AGENTS.md",
    "CHANGELOG.md"
  ],
  "ignores": [
    "node_modules/**",
    "dist/**",
    "docs/superpowers/**",
    "docs/tutorials/**"
  ]
}
```

- [ ] **Step 2: Run `npm run lint:md` against the expanded globs**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npm run lint:md
```

Expected outcomes:

- Exit 0 — all five files clean. Continue to Step 3.
- Non-zero — markdownlint flags a violation. Address each violation per STYLE.md prose rules
  (hand-wrap long lines, fix heading levels, etc.). For pre-12.A CHANGELOG entries with
  long bullets, edit them inline (the soft pass mentioned in the 12.A spec). Today's PRs
  #71/#68/#70/#72 get a soft pass — only fix if they actively trip a rule.
- If a CHANGELOG entry truly cannot be reformatted without distorting historical record,
  add a `<!-- markdownlint-disable-next-line MD013 -->` comment above the offending line.
  Document why in the commit message.

Re-run `npm run lint:md` until exit 0.

- [ ] **Step 3: Wire markdownlint-cli2 into `npm run lint`**

Use `Edit` on `C:/Users/jscha/source/repos/svgedit/package.json`. Find the existing
`"lint"` script (currently `"lint": "eslint ."`) and chain `markdownlint-cli2`:

Before:

```json
"lint": "eslint .",
"lint:md": "markdownlint-cli2",
```

After:

```json
"lint": "eslint . && markdownlint-cli2",
"lint:md": "markdownlint-cli2",
```

The standalone `lint:md` script is retained for selective invocation. Note: if the
current `package.json` has a different `lint` script body (e.g., it already chains
something), preserve the chain — append `&& markdownlint-cli2` rather than replace.

- [ ] **Step 4: Verify `npm run lint` chains correctly**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npm run lint
```

Expected: eslint runs first, then markdownlint-cli2. Both exit 0. Total exit code 0.

- [ ] **Step 5: Commit**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add .markdownlint-cli2.jsonc package.json
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore: expand markdownlint globs + wire into npm run lint (TODO #12.B)"
```

If any CHANGELOG.md edits were made in Step 2:

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: bring pre-STYLE.md CHANGELOG entries to lint-clean state (TODO #12.B)"
```

---

### Task 6: CHANGELOG entry for PR-1

**Files:**

- Modify: `C:/Users/jscha/source/repos/svgedit/CHANGELOG.md`

- [ ] **Step 1: Read CHANGELOG.md `[Unreleased]` section**

Use the `Read` tool. Confirm there's a `## [Unreleased]` heading and locate the
insertion point above existing entries (or at the top of the section if none).

- [ ] **Step 2: Add `### Changed` entry**

Use `Edit` to insert under `## [Unreleased]` (above any existing entries):

```markdown
### Changed (Brand hygiene sweep — docs framing -- 2026-05-28)

- `AGENTS.md` (new) at repo root anchors STYLE.md's agent-context references — multi-session conventions, no AI attribution, verify against current code.
- `CONTRIBUTING.md` refreshed: drops upstream-PR-routing, drops outdated `feat/ts-migration` "active branch" + `standard` linter framing, adopts open-issues / case-by-case-PRs posture.
- `README.md` `docs/tutorials/` row points at TODO #12.D as the home for tutorial rewrites.
- `.markdownlint-cli2.jsonc` globs expanded to `STYLE.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CHANGELOG.md`. `docs/tutorials/**` stays ignored pending 12.D rewrites.
- `npm run lint` now chains `markdownlint-cli2` after `eslint`. Standalone `npm run lint:md` retained.
```

- [ ] **Step 3: Verify markdownlint passes**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npm run lint:md
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: CHANGELOG entry for 12.B docs framing (TODO #12.B)"
```

---

### Task 7: Full verification + push + open PR-1

**Files:** none changed.

- [ ] **Step 1: Verify branch state**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" status --short
git -C "C:/Users/jscha/source/repos/svgedit" log --oneline origin/master..HEAD
```

Expected: clean working tree; 5-6 commits on the branch (one per Task 2-6, plus optional
CHANGELOG cleanup commit).

- [ ] **Step 2: Run full lint + test + build**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npm run lint
npx vitest run
node scripts/run-e2e.ts
npm run build
```

Expected:

- `npm run lint`: exit 0 (eslint + markdownlint chained).
- `npx vitest run`: 701/701 passing.
- `node scripts/run-e2e.ts`: 250/250 passing.
- `npm run build`: success, no errors.

- [ ] **Step 3: Push branch**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feature/12-b-docs-framing
```

Expected: branch tracked at origin.

- [ ] **Step 4: Open PR-1**

```pwsh
gh pr create --repo bilbospocketses/svgedit --base master --head feature/12-b-docs-framing --title "docs: 12.B PR-1 — docs framing + markdownlint expansion" --body @'
## Summary

- `AGENTS.md` (new) anchors STYLE.md's agent-context references — multi-session host conventions, no AI attribution, verify against current code.
- `CONTRIBUTING.md` refreshed: drops upstream-PR-routing, drops outdated `feat/ts-migration` / `standard` framing, adopts open-issues / case-by-case-PRs posture.
- `README.md` tutorials row repointed at TODO #12.D.
- `.markdownlint-cli2.jsonc` globs expanded to top-level fork docs; `docs/tutorials/**` deferred to 12.D.
- `npm run lint` now chains `markdownlint-cli2` after `eslint`.

Implements sub-project 12.B PR-1 per spec `docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md`.

## Test plan

- [ ] CI green (build-and-unit + e2e-chromium + e2e-firefox + CodeQL + Scorecard)
- [ ] `npm run lint` exits 0 locally (eslint + markdownlint)
- [ ] `npm run lint:md` exits 0 standalone
- [ ] `AGENTS.md` renders cleanly in the PR diff view
- [ ] `CONTRIBUTING.md` framing reads correctly post-refresh

## Out of scope

- @copyright/@author strip on 36 source files — PR-2 of this sub-project.
- Tutorial rewrites — sub-project 12.D.
- JSDoc body conversion — sub-project 12.C.

Refs: spec `docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md`,
plan `docs/superpowers/plans/2026-05-28-svgedit-12b-brand-hygiene.md`, TODO #12.B.
'@
```

Expected: PR opened; URL returned. Capture the PR number for the next steps.

- [ ] **Step 5: Watch CI via polling loop**

Per the lesson in `master_github_pr_workflow.md` (Wait for Checks section), don't rely
on a background `gh pr checks --watch` watcher alone — those fail silently. Arm a
`ScheduleWakeup` polling loop at 120s cadence as the primary signal.

At each tick:

```pwsh
gh pr checks <PR-NUMBER> --repo bilbospocketses/svgedit
```

Continue ticking until all required checks reach a terminal state. Required checks:
`build-and-unit`, `e2e-chromium`, `e2e-firefox`, CodeQL (multiple variants), Scorecard.

- [ ] **Step 6: Squash-merge once all checks green**

Per `master_github_pr_workflow.md` and CLAUDE.md "PR Merge Method on Signed Repos —
Squash, Never Rebase":

```pwsh
gh pr merge <PR-NUMBER> --repo bilbospocketses/svgedit --squash --delete-branch
```

Expected: PR merged with squash strategy; remote branch deleted.

- [ ] **Step 7: Sync local master**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

Expected: local master at the new merge SHA.

---

## PR-2 — `@copyright` / `@author` mechanical strip

### Task 8: Branch + write strip-copyright helper script

**Files:**

- Create: `C:/Users/jscha/ClaudeScratch/strip-copyright.mjs` (helper, NOT committed)

- [ ] **Step 1: Branch from updated master**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feature/12-b-copyright-strip origin/master
```

Expected: clean branch off the post-PR-1 master.

- [ ] **Step 2: Verify ClaudeScratch directory exists**

```pwsh
if (-not (Test-Path "C:/Users/jscha/ClaudeScratch")) { New-Item -ItemType Directory "C:/Users/jscha/ClaudeScratch" }
```

Expected: directory exists. No-op if already present.

- [ ] **Step 3: Write the helper script**

Create `C:/Users/jscha/ClaudeScratch/strip-copyright.mjs` with this content:

```javascript
// One-shot helper for svgedit TODO #12.B PR-2.
// Strips @copyright and @author lines from listed TS files; deletes JSDoc
// blocks that become empty after the strip. Leaves the working tree dirty for
// manual diff-skim. NOT committed.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = 'C:/Users/jscha/source/repos/svgedit'

const files = [
  // packages/svgcanvas (24)
  'packages/svgcanvas/svgcanvas.ts',
  'packages/svgcanvas/common/browser.ts',
  'packages/svgcanvas/core/blur-event.ts',
  'packages/svgcanvas/core/clear.ts',
  'packages/svgcanvas/core/draw.ts',
  'packages/svgcanvas/core/elem-get-set.ts',
  'packages/svgcanvas/core/event.ts',
  'packages/svgcanvas/core/history.ts',
  'packages/svgcanvas/core/historyrecording.ts',
  'packages/svgcanvas/core/json.ts',
  'packages/svgcanvas/core/layer.ts',
  'packages/svgcanvas/core/path-actions.ts',
  'packages/svgcanvas/core/path-method.ts',
  'packages/svgcanvas/core/path.ts',
  'packages/svgcanvas/core/sanitize.ts',
  'packages/svgcanvas/core/select.ts',
  'packages/svgcanvas/core/selected-elem.ts',
  'packages/svgcanvas/core/selection.ts',
  'packages/svgcanvas/core/svg-exec.ts',
  'packages/svgcanvas/core/svgroot.ts',
  'packages/svgcanvas/core/text-actions.ts',
  'packages/svgcanvas/core/undo.ts',
  'packages/svgcanvas/core/units.ts',
  'packages/svgcanvas/core/utilities.ts',
  // src/editor (12)
  'src/editor/Editor.ts',
  'src/editor/contextmenu.ts',
  'src/editor/extensions/ext-connector/ext-connector.ts',
  'src/editor/extensions/ext-eyedropper/ext-eyedropper.ts',
  'src/editor/extensions/ext-grid/ext-grid.ts',
  'src/editor/extensions/ext-markers/ext-markers.ts',
  'src/editor/extensions/ext-opensave/ext-opensave.ts',
  'src/editor/extensions/ext-overview_window/ext-overview_window.ts',
  'src/editor/extensions/ext-panning/ext-panning.ts',
  'src/editor/extensions/ext-polystar/ext-polystar.ts',
  'src/editor/extensions/ext-shapes/ext-shapes.ts',
  'src/editor/extensions/ext-storage/ext-storage.ts'
]

const stripTags = (content) => {
  // Remove any line that is a JSDoc body line consisting of
  // optional whitespace, `*`, then @copyright or @author plus the rest of the line.
  const stripped = content.replace(
    /^[ \t]*\*[ \t]*@(?:copyright|author)\b[^\n]*\n/gm,
    ''
  )

  // After tag removal, collapse JSDoc blocks that now contain only `*` bullet lines
  // with no remaining content. Pattern matches `/**` + zero-or-more empty `*` lines
  // (optionally with whitespace) + `*/` and removes the entire block including its
  // trailing newline if present.
  const collapsed = stripped.replace(
    /\/\*\*[ \t]*\n(?:[ \t]*\*[ \t]*\n)*[ \t]*\*\/[ \t]*\n?/g,
    ''
  )

  return collapsed
}

let touched = 0
let unchanged = 0
const errors = []

for (const rel of files) {
  const absolute = resolve(repoRoot, rel)
  try {
    const original = readFileSync(absolute, 'utf8')
    const updated = stripTags(original)
    if (updated !== original) {
      writeFileSync(absolute, updated, 'utf8')
      touched += 1
      console.log(`✓ ${rel}`)
    } else {
      unchanged += 1
      console.log(`  (no change) ${rel}`)
    }
  } catch (e) {
    errors.push({ file: rel, message: e.message })
    console.error(`✗ ${rel}: ${e.message}`)
  }
}

console.log(`\nTouched: ${touched}, Unchanged: ${unchanged}, Errors: ${errors.length}`)
if (errors.length) process.exit(1)
```

- [ ] **Step 4: Verify helper script is valid Node ESM**

```pwsh
node --check C:/Users/jscha/ClaudeScratch/strip-copyright.mjs
```

Expected: no syntax errors, exit 0.

---

### Task 9: Run the helper + per-file diff-skim

**Files:** the 36 listed in Task 8 Step 3.

- [ ] **Step 1: Run the helper**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
node C:/Users/jscha/ClaudeScratch/strip-copyright.mjs
```

Expected: prints `✓ <path>` for each file with stripped tags, `(no change) <path>` for
any file whose tags were already removed (unlikely given the grep baseline). Final line
prints `Touched: 36, Unchanged: 0, Errors: 0` (or close — some files have multiple
occurrences but the regex strips all on first pass).

If `Errors > 0`: stop. Surface the error to the user; do not commit.

- [ ] **Step 2: Verify expected file count touched**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" diff --name-only
```

Expected: 36 file paths printed, matching the helper's input list.

- [ ] **Step 3: Verify no @copyright/@author tags remain in the touched files**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
git diff --name-only | ForEach-Object { Select-String -Path $_ -Pattern '@copyright|@author' -SimpleMatch:$false }
```

Expected: zero output. If anything matches, the regex missed a variant — investigate the
specific file and either extend the regex or hand-edit, then re-run from Step 1.

- [ ] **Step 4: Per-file diff-skim (visual)**

Open each of the 36 files in the diff. The acceptable patterns are:

- **Two lines deleted** within a JSDoc block; the block retains content (e.g., `@module`,
  description, `@license`).
- **Two lines deleted plus the entire JSDoc block deleted** if the block had no other
  content after the strip.

Anything else — stray malformed JSDoc, accidentally-deleted unrelated lines, broken
imports, comment artifacts (`*\n*\n`) — fix by hand before continuing.

Quick visual scan command (one file at a time):

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" diff -- packages/svgcanvas/svgcanvas.ts
# repeat per file
```

Or all at once with a pager:

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" diff | less
```

- [ ] **Step 5: Run lint + test + build**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npm run lint
npx vitest run
node scripts/run-e2e.ts
npm run build
```

Expected:

- `npm run lint`: exit 0. JSDoc deletion does not trigger any eslint rule the project
  uses. If a JSDoc-related rule trips (e.g., `jsdoc/require-jsdoc`), investigate per-rule —
  the rule may require a file-level JSDoc that the empty-block deletion removed. If so,
  add a minimal one-line JSDoc summary back per STYLE.md § 4 ("Public-API functions:
  1-line summary required") and re-run.
- `npx vitest run`: 701/701 passing.
- `node scripts/run-e2e.ts`: 250/250 passing.
- `npm run build`: success.

---

### Task 10: Commit + CHANGELOG + push + open PR-2

**Files:**

- Modify: `C:/Users/jscha/source/repos/svgedit/CHANGELOG.md`

- [ ] **Step 1: Stage the 36 file edits**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add packages/svgcanvas src/editor
```

Verify:

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" status --short
```

Expected: 36 modified `.ts` files staged; no other paths.

- [ ] **Step 2: Commit the mechanical strip**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore: strip upstream @copyright/@author JSDoc headers from 36 source files (TODO #12.B)"
```

- [ ] **Step 3: Add CHANGELOG entry**

Use `Edit` on `C:/Users/jscha/source/repos/svgedit/CHANGELOG.md`. Insert under
`## [Unreleased]` (above the PR-1 entry if PR-1 is still in Unreleased; otherwise add
fresh under Unreleased):

```markdown
### Changed (Brand hygiene sweep — upstream attribution strip -- 2026-05-28)

- Stripped upstream `@copyright` / `@author` JSDoc lines from 36 TypeScript source files (24 in `packages/svgcanvas/`, 12 in `src/editor/`). Fork lineage is in git history; per-file `@license` tags kept.
- Surgical edit pattern: only the `@copyright` and `@author` lines were removed. JSDoc blocks that became empty after the strip were deleted in full. File descriptions, `@module`, `@example`, `@license`, and other tags preserved.
```

- [ ] **Step 4: Verify markdownlint passes**

```pwsh
cd C:/Users/jscha/source/repos/svgedit
npm run lint:md
```

Expected: exit 0.

- [ ] **Step 5: Commit CHANGELOG**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: CHANGELOG entry for 12.B PR-2 attribution strip (TODO #12.B)"
```

- [ ] **Step 6: Push branch**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feature/12-b-copyright-strip
```

- [ ] **Step 7: Open PR-2**

```pwsh
gh pr create --repo bilbospocketses/svgedit --base master --head feature/12-b-copyright-strip --title "chore: 12.B PR-2 — strip upstream @copyright/@author from 36 source files" --body @'
## Summary

- Mechanical surgical strip of upstream `@copyright` and `@author` JSDoc lines from 36 TypeScript source files (24 in `packages/svgcanvas/`, 12 in `src/editor/`).
- JSDoc blocks that became empty post-strip were deleted in full. Per-file `@license` tags, `@module`, `@example`, file descriptions all kept.
- Fork lineage is in git history per STYLE.md § 4. No runtime or build-time behavior change.

Implements sub-project 12.B PR-2 per spec `docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md`.

## Test plan

- [ ] CI green (build-and-unit + e2e-chromium + e2e-firefox + CodeQL + Scorecard)
- [ ] `npm run lint` exits 0
- [ ] Per-file diff-skim shows only `@copyright` / `@author` removal (plus empty-block deletion where applicable)
- [ ] `npx vitest run`: 701/701
- [ ] `node scripts/run-e2e.ts`: 250/250
- [ ] `npm run build` succeeds

## Out of scope

- JSDoc body conversion (`@param` / `@returns` → TS types) — sub-project 12.C.
- Tutorial rewrites — sub-project 12.D.
- `path-data.ts` (forked-in polyfill from PR #67) — no `@copyright` / `@author` tags to strip; not in the 36-file list.

Refs: spec `docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md`,
plan `docs/superpowers/plans/2026-05-28-svgedit-12b-brand-hygiene.md`, TODO #12.B.
'@
```

- [ ] **Step 8: Watch CI via polling loop**

Same protocol as Task 7 Step 5. ScheduleWakeup at 120s cadence; `gh pr checks <N>` at
each tick until terminal.

- [ ] **Step 9: Squash-merge once green**

```pwsh
gh pr merge <PR-NUMBER> --repo bilbospocketses/svgedit --squash --delete-branch
```

- [ ] **Step 10: Sync local master**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

- [ ] **Step 11: Delete the helper script**

The helper was scratch — no follow-up use:

```pwsh
Remove-Item C:/Users/jscha/ClaudeScratch/strip-copyright.mjs
```

---

### Task 11: Update todo_svgedit.md memory file

**Files:**

- Modify: `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`

- [ ] **Step 1: Mark TODO #12.B SHIPPED in the top banner**

Use `Edit` on `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`.
Add a new closed-status line near the top banner, after the existing
`**TODO #12.A SHIPPED**` line:

```markdown
> **TODO #12.B SHIPPED** -- PR-1 (docs framing) merged 2026-MM-DD + PR-2 (attribution strip) merged 2026-MM-DD. `AGENTS.md` created; `CONTRIBUTING.md` framing refreshed; `README.md` tutorials row repointed to TODO #12.D; markdownlint globs expanded to top-level fork docs; `npm run lint` chains `markdownlint-cli2`; 36 source files stripped of upstream `@copyright` / `@author` lines. 12.C (JSDoc → TS conversion) now UNBLOCKED and ready to brainstorm when prioritized. Spec at `docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md`, plan at `docs/superpowers/plans/2026-05-28-svgedit-12b-brand-hygiene.md`.
```

Replace `2026-MM-DD` with the actual merge dates.

- [ ] **Step 2: Update the active item count + last-updated date**

In the line `Active items: 7 substantive (#5, #7, #9, #12.B-D, #13) + 2 with deferred items only (#10 sePalette, #16 sePalette) | Last updated: 2026-05-28.`,
change `#12.B-D` to `#12.C-D` and update the count from `7 substantive` to `6 substantive`. Update
the date if it's no longer today.

- [ ] **Step 3: Save**

No commit needed (this is the personal memory file, not a repo file).

- [ ] **Step 4: Confirm to the user that 12.B is SHIPPED**

Final user-facing summary: PR-1 merged at `<sha1>`, PR-2 merged at `<sha2>`, todo memory
updated, 12.C unblocked. Suggest the next move: brainstorm 12.C, or pause.

---

## Spec PR ship sequence (this plan + the design spec)

This plan and the design spec ship together as a single PR matching the 12.A PR #73
pattern. Run these steps before starting Task 1 of the implementation work above.

- [ ] **Step 1: Branch + add the spec + plan**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b docs/12-b-brand-hygiene-spec
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/specs/2026-05-28-svgedit-12b-brand-hygiene-design.md docs/superpowers/plans/2026-05-28-svgedit-12b-brand-hygiene.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: #12.B spec + plan (brand hygiene sweep)"
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin docs/12-b-brand-hygiene-spec
```

- [ ] **Step 2: Open the spec PR**

```pwsh
gh pr create --repo bilbospocketses/svgedit --base master --head docs/12-b-brand-hygiene-spec --title "docs: #12.B spec + plan (brand hygiene sweep)" --body @'
## Summary

- Adds the design spec and implementation plan for sub-project 12.B per the 12.A migration plan.
- 12.B applies STYLE.md to existing fork docs, creates AGENTS.md, refreshes CONTRIBUTING framing, and strips upstream `@copyright` / `@author` from 36 source files.
- Ships as two follow-up PRs (PR-1 docs framing + PR-2 mechanical strip) per the spec's PR shape decision.

## Test plan

- [ ] Spec doc renders cleanly in PR diff view
- [ ] Plan doc renders cleanly in PR diff view
- [ ] CI green on doc-only changes (markdownlint may flag the new files; spec/plan globs are intentionally ignored by `.markdownlint-cli2.jsonc`)

Refs: TODO #12.B in `todo_svgedit.md`.
'@
```

- [ ] **Step 3: Watch CI + squash-merge**

Same ScheduleWakeup loop protocol as Tasks 7 and 10. Once green:

```pwsh
gh pr merge <SPEC-PR-NUMBER> --repo bilbospocketses/svgedit --squash --delete-branch
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

Then proceed to Task 1.

---

## Self-review checklist (run after writing the plan)

- [x] **Spec coverage:** Every decision in the spec maps to a task. AGENTS.md → Task 2.
  CONTRIBUTING framing → Task 3. README pointer → Task 4. Markdownlint config + lint wiring → Task 5.
  CHANGELOG entries → Task 6 (PR-1) + Task 10 step 3 (PR-2). `@copyright` / `@author` strip → Tasks 8-9.
  Memory update → Task 11. Spec ship → "Spec PR ship sequence" section.
- [x] **Placeholder scan:** No "TBD", "implement later", or "similar to Task N" entries. All AGENTS.md,
  CONTRIBUTING.md, README.md, `.markdownlint-cli2.jsonc`, `package.json`, CHANGELOG.md, and helper script
  contents are spelled out verbatim. The `2026-MM-DD` placeholders in Task 11 are template fields filled
  at execution time from actual merge dates — not unfilled author placeholders.
- [x] **Type consistency:** N/A for the helper script (pure string manipulation); the 36-file list in Task 8
  matches the 36-file enumeration in the spec.
- [x] **Branch protocol:** Branches from `origin/master` not local; uses `git -C` everywhere with absolute
  paths; squash-merge with `--delete-branch` per CLAUDE.md "PR Merge Method on Signed Repos"; no
  rebase or force-push.
- [x] **CI-wait protocol:** Uses ScheduleWakeup polling loop as primary signal per
  `master_github_pr_workflow.md`; doesn't rely on background watcher alone.
- [x] **Multi-session cwd discipline:** Every git command uses `git -C "C:/Users/jscha/source/repos/svgedit"`.
  Every file path is absolute. No `cd` into the repo.
- [x] **PowerShell on Windows:** Shell commands use PowerShell syntax (`@'...'@` here-strings, `Test-Path`,
  `New-Item`, `Remove-Item`, `ForEach-Object`). Node and gh commands work from PS.
