# svgedit House Style Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `STYLE.md` at the svgedit repo root with a `.markdownlint.jsonc` companion that codifies the house style decisions from spec `2026-05-28-svgedit-style-guide-design.md`.

**Architecture:** Single canonical markdown reference doc at repo root. Lightweight markdownlint-cli2 config + npm script enforce the markdown-formatting rules on a scoped set of files (initially just STYLE.md itself; expansion to other docs is sub-project 12.B). CONTRIBUTING.md links to STYLE.md so contributors find it.

**Tech Stack:** Markdown, markdownlint-cli2 (devDep), npm scripts.

**Branch:** Implementation lands on a new branch `feature/style-guide` from current `origin/master`. The spec (PR #73) is on `docs/style-guide-spec`; merge that first, then branch from updated master.

---

### Task 1: Branch + add markdownlint-cli2 as devDep

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/package.json`
- Modify: `C:/Users/jscha/source/repos/svgedit/package-lock.json` (regenerated)

- [ ] **Step 1: Branch from updated master**

Spec PR #73 must be merged first. Then:

```bash
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feature/style-guide origin/master
```

Expected: clean branch creation; spec file `docs/superpowers/specs/2026-05-28-svgedit-style-guide-design.md` is present on master.

- [ ] **Step 2: Install markdownlint-cli2**

```bash
cd C:/Users/jscha/source/repos/svgedit
npm install -D markdownlint-cli2@0.18.1
```

Expected: `package.json` gains `"markdownlint-cli2": "0.18.1"` under `devDependencies`; `package-lock.json` updated.

Note: 0.18.1 is the current latest as of 2026-05-28; verify against `npm view markdownlint-cli2 version` before committing if a newer release lands.

- [ ] **Step 3: Verify package installed**

```bash
cd C:/Users/jscha/source/repos/svgedit
npx markdownlint-cli2 --version
```

Expected: prints version string matching what was installed.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add package.json package-lock.json
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore: add markdownlint-cli2 devDep for STYLE.md enforcement"
```

---

### Task 2: Write .markdownlint.jsonc config + npm script

**Files:**
- Create: `C:/Users/jscha/source/repos/svgedit/.markdownlint.jsonc`
- Create: `C:/Users/jscha/source/repos/svgedit/.markdownlint-cli2.jsonc`
- Modify: `C:/Users/jscha/source/repos/svgedit/package.json` (add `lint:md` script)

- [ ] **Step 1: Write `.markdownlint.jsonc`**

```jsonc
// markdownlint config for svgedit. See STYLE.md for the rationale behind each rule.
// Reference: https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md
{
  // Line length: soft 100 chars. Off for code blocks, tables, embedded HTML.
  "MD013": {
    "line_length": 100,
    "code_blocks": false,
    "tables": false,
    "headings": false
  },
  // Heading style: ATX (`#` syntax), not setext (underlines)
  "MD003": { "style": "atx" },
  // Code-block style: fenced with backticks
  "MD046": { "style": "fenced" },
  // Blank lines around headings — improves rendering + scannability
  "MD022": true,
  // Blank lines around fenced code blocks
  "MD031": true,
  // Blank lines around lists
  "MD032": true,
  // No trailing spaces (except 2-space line break — disabled for clarity)
  "MD009": { "br_spaces": 0 },
  // No multiple consecutive blank lines
  "MD012": { "maximum": 1 },
  // First line MUST be a top-level heading
  "MD041": true,
  // Allow inline HTML (badges, details/summary, etc.)
  "MD033": false,
  // Allow bare URLs (avoids noise in CHANGELOG links)
  "MD034": false,
  // Don't require trailing newline (Windows-friendly)
  "MD047": true
}
```

- [ ] **Step 2: Write `.markdownlint-cli2.jsonc`**

This file scopes WHICH .md files get linted. Initially scoped to STYLE.md only — sub-project 12.B will expand.

```jsonc
// markdownlint-cli2 runner config.
// Globs are intentionally narrow for sub-project 12.A:
// only STYLE.md is governed by the strict rules.
// Sub-project 12.B will expand the glob to README, CONTRIBUTING, docs/.
{
  "config": ".markdownlint.jsonc",
  "globs": [
    "STYLE.md"
  ],
  "ignores": [
    "node_modules/**",
    "dist/**",
    "docs/superpowers/**"
  ]
}
```

- [ ] **Step 3: Add `lint:md` npm script**

Edit `package.json` to add `lint:md` under `scripts`. Existing `lint` script stays unchanged (covers TS/JS via eslint). Do NOT wire `lint:md` into the main `lint` script in this PR — keep it standalone so the existing CI doesn't gain a new failure mode on day one. Wiring it in becomes a 12.B follow-up after existing docs are sweep-cleaned.

Example (assuming current `scripts` block has `"lint": "eslint ."`):

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:md": "markdownlint-cli2"
  }
}
```

- [ ] **Step 4: Verify config + script work**

STYLE.md doesn't exist yet, so the lint will report "no files matched" — that's expected.

```bash
cd C:/Users/jscha/source/repos/svgedit
npm run lint:md
```

Expected output: either "no files matched glob STYLE.md" (acceptable; means glob resolution works) OR clean exit 0. Either way no thrown error from the runner itself.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add .markdownlint.jsonc .markdownlint-cli2.jsonc package.json
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore: add markdownlint config + lint:md script (scoped to STYLE.md)"
```

---

### Task 3: Write STYLE.md — frontmatter + Sections 1-3 (Header, Voice, Prose)

**Files:**
- Create: `C:/Users/jscha/source/repos/svgedit/STYLE.md`

- [ ] **Step 1: Write Section 1 (Header) + table of contents**

```markdown
# svgedit House Style Guide

How svgedit's docs, code comments, commit messages, and PRs are written. Read this before substantial doc or code contribution. Flag exceptions on the PR; don't silently deviate.

The guide is opinionated — calibrated terse, fork-flavored. Examples carry as much weight as rules; consult them when "tight" or "non-obvious" feels ambiguous.

## Contents

1. [Voice & tone](#1-voice--tone)
2. [Markdown prose](#2-markdown-prose)
3. [CHANGELOG entries](#3-changelog-entries)
4. [JSDoc](#4-jsdoc)
5. [Inline code comments](#5-inline-code-comments)
6. [Commit messages](#6-commit-messages)
7. [PR descriptions](#7-pr-descriptions)
8. [Enforcement](#8-enforcement)
9. [Out of scope](#9-out-of-scope)
```

- [ ] **Step 2: Write Section 2 (Voice & tone)**

```markdown
## 1. Voice & tone

Mixed by context. Three voices, three audiences:

- **Imperative** — STYLE.md, CONTRIBUTING.md, AGENTS.md, any rules doc.

  > Use 2nd person for tutorials. Cap CHANGELOG bullets at 180 chars. Strip upstream `@copyright` headers.

- **2nd person** — `docs/tutorials/*.md`, READMEs of subpackages, how-to guides.

  > Open the editor at `http://localhost:8000/src/editor/index.html`. Click **File → New** to start a blank canvas.

- **3rd-person factual** — CHANGELOG entries, API reference, design specs.

  > The editor now dispatches a `modeChange` event on internal mode transitions. Previously, `setCursorStyle` was not invoked for in-process transitions.

Pick the voice that matches the audience. Don't mix mid-document.
```

- [ ] **Step 3: Write Section 3 (Markdown prose)**

```markdown
## 2. Markdown prose

Tight by default. Add prose only when it earns its place.

**Rules:**

- Soft 100-char line cap. Don't hard-wrap; editors handle visual wrap.
- One concept per paragraph. Split a paragraph the moment it carries two ideas.
- Sentence-case headings (`## How rebases land`, not `## How Rebases Land`).
- Backticks for code, file paths, env vars, npm scripts.
- Lists for enumerations; prose for flow. Don't bullet sentences that flow naturally.
- Blank line before/after headings, code blocks, and lists.

**Good:**

> The editor reads `~/.config/svgedit/settings.json` at startup. Missing file: fall back to defaults. Malformed JSON: log a warning and continue with defaults.

**Bad** (over-bulleted; flow lost):

> The editor:
> - reads `~/.config/svgedit/settings.json` at startup
> - falls back to defaults if the file is missing
> - logs a warning if JSON is malformed
> - continues with defaults in that case
```

- [ ] **Step 4: Verify lint passes**

```bash
cd C:/Users/jscha/source/repos/svgedit
npm run lint:md
```

Expected: exit 0, no violations. If MD013 (line-length) flags any line, hand-wrap or shorten. If MD022/MD031/MD032 flag blank-line issues, add the blank lines.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add STYLE.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: STYLE.md sections 1-3 (header, voice, markdown prose)"
```

---

### Task 4: Write STYLE.md — Sections 4-6 (CHANGELOG, JSDoc, Comments)

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/STYLE.md`

- [ ] **Step 1: Append Section 4 (CHANGELOG entries)**

```markdown
## 3. CHANGELOG entries

Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), already in use in `CHANGELOG.md`.

**Entry shape:**

```
### <Category> (<Title> -- YYYY-MM-DD)

- Bullet describing what changed. 100-180 chars. Tight but informative.
- Another bullet if the change has multiple distinct surfaces.

**Why:** (optional) one sentence when the rationale isn't obvious from the change itself.

**Verification:** (optional) test counts when test surface was touched (e.g., `vitest 701/701 / e2e 250/250`).
```

**Categories** (one of, matching Keep-a-Changelog): `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

**Rules:**

- Subheader is `### Category (Title -- YYYY-MM-DD)`. Title in sentence-case.
- Bullets 100-180 chars. Avoid sub-bullets unless a true hierarchy exists.
- Reference file paths inline in backticks.
- PR references (`[PR #N](https://github.com/bilbospocketses/svgedit/pull/N)`) in body bullets when relevant; don't repeat across multiple bullets of one entry.
- `**Why:**` block only when the change description doesn't carry the rationale.
- `**Verification:**` block only when test counts changed or matter.

**Good:**

```
### Changed (CI Playwright Docker container -- 2026-05-28)

- e2e jobs now run inside `mcr.microsoft.com/playwright:v1.57.0-noble` (browsers pre-installed). Eliminates intermittent install hangs that caused 60-min timeouts on PRs #68/#70.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on `npm ci` skips the @playwright/test postinstall (image covers it).
```

**Bad** (verbose; nested sub-bullets without hierarchy; repeats PR # per bullet):

```
### Changed

- e2e jobs (e2e-chromium, e2e-firefox) now run inside the official Playwright Docker container ([PR #71](https://github.com/bilbospocketses/svgedit/pull/71)) (`mcr.microsoft.com/playwright:v1.57.0-noble`) with browsers pre-installed:
  - Eliminates the playwright install --with-deps step entirely
  - Which had been hanging on GitHub-hosted runners ([PR #71](https://github.com/bilbospocketses/svgedit/pull/71))
  - After the browser download reached 100%
  - And caused 60-min timeouts on PR #70 e2e-firefox ([PR #71](https://github.com/bilbospocketses/svgedit/pull/71))
```
```

- [ ] **Step 2: Append Section 5 (JSDoc)**

```markdown
## 4. JSDoc

Targeted, not exhaustive.

**Rules:**

- **Public-API functions** (anything exported from `packages/svgcanvas/` or `src/editor/`): 1-line summary required.
- **Internal/private**: JSDoc only when behavior is non-obvious or has hidden constraints.
- **Strip** `@param` and `@returns` when TS types cover them fully. (TS types appear in IDE hover; JSDoc duplicating them is noise.)
- **Keep** `@throws`, `@deprecated`, `@example`, `@see` — these carry information types don't.
- **Strip** upstream `@copyright 2010 …` and `@author` headers. Fork lineage is in git history.

**Before (upstream-style, verbose):**

```typescript
/**
 * Sets the current drawing mode for the editor.
 * @copyright 2010 Jeff Schiller
 * @author Jeff Schiller
 * @param {string} mode - The mode name (e.g., 'select', 'fhpath', 'text')
 * @param {Object} [options] - Optional configuration
 * @returns {void}
 */
setCurrentMode(mode: string, options?: ModeOptions): void {
```

**After (targeted):**

```typescript
/** Sets the current drawing mode. Dispatches `modeChange` event on transition. */
setCurrentMode(mode: string, options?: ModeOptions): void {
```

The 1-line summary captures intent + a non-obvious side effect (the event). `@param`/`@returns` removed because TS types in the signature carry the same info.
```

- [ ] **Step 3: Append Section 6 (Inline code comments)**

```markdown
## 5. Inline code comments

Default: no comment.

Identifiers, type signatures, and structure do the explaining. Add a comment only when the WHY is non-obvious: hidden constraint, subtle invariant, workaround for a specific bug, behavior that contradicts intuition.

**Rules:**

- Never explain WHAT the code does (the code does that).
- Never reference task/PR context (`// added for the X flow`, `// used by Y`, `// fixes #123`). That belongs in PR descriptions and commit messages, not source.
- Workaround comments should name the constraint, not the workaround.

**Good** (non-obvious why):

```typescript
// Firefox refuses to launch when $HOME isn't owned by the current user (Playwright container quirk).
process.env.HOME = '/root'
```

**Bad** (explains the what; restates code in prose):

```typescript
// Set HOME to /root
process.env.HOME = '/root'
```

**Also bad** (references PR context):

```typescript
// Added in PR #71 for the Playwright Docker container migration
process.env.HOME = '/root'
```
```

- [ ] **Step 4: Verify lint passes**

```bash
cd C:/Users/jscha/source/repos/svgedit
npm run lint:md
```

Expected: exit 0, no violations.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add STYLE.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: STYLE.md sections 3-5 (CHANGELOG, JSDoc, inline comments)"
```

---

### Task 5: Write STYLE.md — Sections 7-9 (Commits, PRs, Enforcement, Out of scope)

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/STYLE.md`

- [ ] **Step 1: Append Section 7 (Commit messages)**

```markdown
## 6. Commit messages

**Subject:**

- Imperative present tense: `Add X`, not `Added X` or `Adding X`.
- ≤72 characters.
- No trailing period.
- Type prefix optional but conventional: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`.

**Body (optional):**

- Wrapped ≤80 characters.
- Separated from subject by one blank line.
- Explains motivation and non-obvious tradeoffs. Don't restate the diff.

**Forbidden:**

- AI attribution lines (`Co-Authored-By: Claude…`, `Generated with Claude Code`, etc.). Fork lineage is human-only.
- Issue/PR references in the subject; put them in the body.

**Good:**

```
ci: set HOME=/root in Playwright container jobs for firefox launch

Firefox in the Playwright Docker image refuses to launch when $HOME
isn't owned by the current user. Container runs as root but $HOME
inherits from the runner's environment, so firefox sees a HOME folder
owned by a different uid and aborts.

Refs PR #71.
```

**Bad** (past tense; trailing period; AI attribution; subject > 72 chars):

```
ci: Added the HOME=/root environment variable for firefox launch in container.

This was needed because firefox kept failing in the docker container we
added in the previous PR.

Co-Authored-By: Claude
```
```

- [ ] **Step 2: Append Section 8 (PR descriptions)**

```markdown
## 7. PR descriptions

Two required sections:

```
## Summary

<1-5 terse bullets matching the CHANGELOG terseness target (100-180 chars per bullet)>

## Test plan

- [ ] <verification step the reviewer should mentally run through>
- [ ] <another>
```

**Additional sections allowed when scope warrants:**

- `## Background` — context the reviewer needs to evaluate the change
- `## Why` — rationale, if not obvious from Summary
- `## Notes for reviewer` — call-outs for things easy to miss
- `## Out of scope` — what the PR intentionally does NOT do (heads off review comments)

**Good Summary bullet:**

> e2e jobs now run inside `mcr.microsoft.com/playwright:v1.57.0-noble` — eliminates the install hang on GitHub-hosted runners (60-min timeouts on PRs #68/#70).

**Bad Summary bullet** (verbose, lists context that belongs in Background):

> We've been having problems with the GitHub Actions runners where the Playwright install hangs after the browser download reaches 100%, causing 60-minute timeouts and blocking PR merges, so this PR switches the e2e jobs to run inside the official Playwright Docker container which has the browsers pre-installed, eliminating the install step entirely.
```

- [ ] **Step 3: Append Section 8 (Enforcement) + Section 9 (Out of scope)**

```markdown
## 8. Enforcement

Honor system primary. Tooling catches markdown-formatting drift on files we choose to enforce.

**Tools:**

- **markdownlint-cli2** — config in `.markdownlint.jsonc`; runner config in `.markdownlint-cli2.jsonc`. Currently scoped to `STYLE.md` only; sub-project 12.B expands to README, CONTRIBUTING, `docs/tutorials/`.
- **eslint** — existing config covers TS/JS line length and comment formatting.
- **No new required CI checks.** Lint runs locally via `npm run lint:md`; not yet wired into `npm run lint` (avoids day-one CI failures on existing docs).

**Contributor workflow:**

1. Before substantial doc/code contribution: skim this guide.
2. Before opening PR: run `npm run lint` and `npm run lint:md` locally.
3. If a rule feels wrong for a specific case: flag on the PR. Don't silently deviate.

## 9. Out of scope

The following are NOT governed by this guide:

- **Spec docs** in `docs/superpowers/specs/` follow the superpowers brainstorming-skill format.
- **Plan docs** in `docs/superpowers/plans/` follow the superpowers writing-plans-skill format.
- **Test fixtures** in `tests/` and `packages/svgcanvas/tests/` follow practical conventions; this guide doesn't constrain test code style beyond what eslint already enforces.
- **Third-party JSDoc** in `node_modules/` — obviously.

Existing docs (`README.md`, `CONTRIBUTING.md`, `docs/tutorials/*.md`, in-tree JSDoc) are NOT retro-edited as part of the initial STYLE.md ship. Sub-project 12.B applies these rules to existing docs in a follow-up sweep.
```

- [ ] **Step 4: Verify lint passes**

```bash
cd C:/Users/jscha/source/repos/svgedit
npm run lint:md
```

Expected: exit 0, no violations across the full STYLE.md.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add STYLE.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: STYLE.md sections 6-9 (commits, PRs, enforcement, out of scope)"
```

---

### Task 6: Link CONTRIBUTING.md to STYLE.md

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/CONTRIBUTING.md`

- [ ] **Step 1: Read CONTRIBUTING.md to find the right insertion point**

```bash
cat "C:/Users/jscha/source/repos/svgedit/CONTRIBUTING.md"
```

Expected: see existing structure. Look for a section like "Commit Style", "Contribution Workflow", or the top of the file — wherever a style-guide link reads naturally.

- [ ] **Step 2: Add link near the top of CONTRIBUTING.md**

Add a short sentence in the introduction or first section:

```markdown
For doc/comment/commit/PR style conventions, see [`STYLE.md`](./STYLE.md).
```

Place it where it'll be seen by anyone reading CONTRIBUTING. If CONTRIBUTING.md has a "Style" section, replace any duplicated style guidance with the link (don't have rules in two places).

- [ ] **Step 3: Verify**

```bash
grep -n "STYLE.md" "C:/Users/jscha/source/repos/svgedit/CONTRIBUTING.md"
```

Expected: at least one match showing the new link line.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add CONTRIBUTING.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: link CONTRIBUTING.md to STYLE.md"
```

---

### Task 7: CHANGELOG entry + final verification + PR

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry under `[Unreleased]`**

Insert above existing entries under `## [Unreleased]`:

```markdown
### Added (House style guide -- 2026-05-28)

- `STYLE.md` at repo root codifies doc, JSDoc, code-comment, commit-message, and PR-description conventions. Calibrated-terse, contributor-doc framing, mixed voice by context.
- `.markdownlint.jsonc` + `.markdownlint-cli2.jsonc` companion configs. New `npm run lint:md` script — scoped to `STYLE.md` initially; sub-project 12.B expands to other docs.
- `CONTRIBUTING.md` links to the new style guide.
```

- [ ] **Step 2: Verify full repo state**

```bash
cd C:/Users/jscha/source/repos/svgedit
git status --short
npm run lint:md
npm run lint
```

Expected:
- `git status` shows modified `CHANGELOG.md`, plus all the committed files from previous tasks already on the branch.
- `npm run lint:md` exit 0 with no violations.
- `npm run lint` (eslint) unchanged from baseline — no regressions.

- [ ] **Step 3: Commit CHANGELOG**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: CHANGELOG entry for STYLE.md + markdownlint companion"
```

- [ ] **Step 4: Push branch**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feature/style-guide
```

Expected: branch pushed; remote tracks new branch.

- [ ] **Step 5: Open PR**

```bash
gh pr create --repo bilbospocketses/svgedit --base master --head feature/style-guide --title "docs: add STYLE.md house style guide + markdownlint companion (TODO #12.A)" --body "$(cat <<'EOF'
## Summary

Implements TODO #12.A per spec `docs/superpowers/specs/2026-05-28-svgedit-style-guide-design.md`. Adds `STYLE.md` at repo root + `.markdownlint.jsonc` companion. No existing docs are retro-edited (that's sub-project 12.B).

## Test plan

- [ ] CI green (build-and-unit + e2e-chromium + e2e-firefox)
- [ ] `npm run lint:md` exits 0 locally
- [ ] `STYLE.md` renders correctly in the PR diff view
- [ ] `CONTRIBUTING.md` link to STYLE.md works (click-through in rendered view)

## Out of scope

- Applying STYLE.md rules to existing docs (README.md, CONTRIBUTING.md beyond the link, docs/tutorials/*.md) — handled in sub-project 12.B.
- JSDoc → TS type conversion in packages/svgcanvas/ — handled in sub-project 12.C.
- Tutorial rewrites — handled in sub-project 12.D.

Refs: spec PR #73, TODO #12 in `todo_svgedit.md`.
EOF
)"
```

- [ ] **Step 6: Watch CI via polling loop (NOT background watcher alone)**

Arm a ScheduleWakeup loop at 120s cadence as the primary signal — background `gh pr checks --watch` watchers fail silently per the lesson learned today (see `master_github_pr_workflow.md` Wait for Checks section).

Each tick: `gh pr checks <N> --repo bilbospocketses/svgedit` → check for terminal state.

When all required checks green:

- [ ] **Step 7: Squash-merge**

```bash
gh pr merge <N> --repo bilbospocketses/svgedit --squash --delete-branch
```

Expected: PR merged with squash strategy; remote branch deleted.

- [ ] **Step 8: Sync local master**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

Expected: local master at the new merge SHA; `feature/style-guide` no longer in origin branches.

- [ ] **Step 9: Update todo_svgedit.md memory file**

Mark TODO #12.A as SHIPPED in `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`. Add a note that 12.B (brand hygiene sweep) is now unblocked and ready to brainstorm when prioritized.

Per CLAUDE.md memory rules, this is a minor update (status flip + small note) — no separate approval gate required.

---

## Self-review checklist (run after writing the plan)

- [x] **Spec coverage:** Every section from the spec maps to a task. Sections 1-10 of STYLE.md → Tasks 3-5. Markdownlint config → Task 2. CONTRIBUTING.md link → Task 6. CHANGELOG entry → Task 7. Migration to sub-projects 12.B/C/D → STYLE.md Section 9 + plan-level notes.
- [x] **Placeholder scan:** No TBDs, no "implement later", no "similar to Task N". All content is present.
- [x] **Type consistency:** N/A (doc work, no function signatures across tasks). File paths and script names used consistently.
- [x] **Branch protocol:** Branches from `origin/master` (not local); uses `git -C` everywhere; squash-merge with `--delete-branch`; force-push not needed (linear additions only).
- [x] **CI-wait protocol:** Uses ScheduleWakeup polling loop as primary signal per today's lesson; doesn't rely on background watcher alone.
