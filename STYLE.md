# svgedit House Style Guide

How svgedit's docs, code comments, commit messages, and PRs are written. Read this before
substantial doc or code contribution. Flag exceptions on the PR; don't silently deviate.

The guide is opinionated — calibrated terse, fork-flavored. Examples carry as much weight
as rules; consult them when "tight" or "non-obvious" feels ambiguous.

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

## 1. Voice & tone

Mixed by context. Three voices, three audiences:

- **Imperative** — STYLE.md, CONTRIBUTING.md, AGENTS.md, any rules doc.

  > Use 2nd person for tutorials. Cap CHANGELOG bullets at 180 chars. Strip upstream
  > `@copyright` headers.

- **2nd person** — `docs/tutorials/*.md`, READMEs of subpackages, how-to guides.

  > Open the editor at `http://localhost:8100/src/editor/index.html`. Click **File →
  > New** to start a blank canvas.

- **3rd-person factual** — CHANGELOG entries, API reference, design specs.

  > The editor now dispatches a `modeChange` event on internal mode transitions.
  > Previously, `setCursorStyle` was not invoked for in-process transitions.

Pick the voice that matches the audience. Don't mix mid-document.

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

> The editor reads `~/.config/svgedit/settings.json` at startup. Missing file: fall back
> to defaults. Malformed JSON: log a warning and continue with defaults.

**Bad** (over-bulleted; flow lost):

> The editor:
>
> - reads `~/.config/svgedit/settings.json` at startup
> - falls back to defaults if the file is missing
> - logs a warning if JSON is malformed
> - continues with defaults in that case

## 3. CHANGELOG entries

Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), already in use in `CHANGELOG.md`.

**Entry shape:**

````text
### <Category> (<Title> -- YYYY-MM-DD)

- Bullet describing what changed. 100-180 chars. Tight but informative.
- Another bullet if the change has multiple distinct surfaces.

**Why:** (optional) one sentence when the rationale isn't obvious from the change itself.

**Verification:** (optional) test counts when test surface was touched (e.g., `vitest 701/701 / e2e 250/250`).
````

**Categories** (one of, matching Keep-a-Changelog): `Added`, `Changed`, `Deprecated`,
`Removed`, `Fixed`, `Security`.

**Rules:**

- Subheader is `### Category (Title -- YYYY-MM-DD)`. Title in sentence-case.
- Bullets 100-180 chars. Avoid sub-bullets unless a true hierarchy exists.
- Reference file paths inline in backticks.
- PR references (`[PR #N](https://github.com/bilbospocketses/svgedit/pull/N)`) in body
  bullets when relevant; don't repeat across multiple bullets of one entry.
- `**Why:**` block only when the change description doesn't carry the rationale.
- `**Verification:**` block only when test counts changed or matter.

**Good:**

````markdown
### Changed (CI Playwright Docker container -- 2026-05-28)

- e2e jobs now run inside `mcr.microsoft.com/playwright:v1.57.0-noble` (browsers pre-installed). Eliminates intermittent install hangs that caused 60-min timeouts on PRs #68/#70.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on `npm ci` skips the @playwright/test postinstall (image covers it).
````

**Bad** (verbose; nested sub-bullets without hierarchy; repeats PR # per bullet):

````markdown
### Changed

- e2e jobs (e2e-chromium, e2e-firefox) now run inside the official Playwright Docker container ([PR #71](https://github.com/bilbospocketses/svgedit/pull/71)) (`mcr.microsoft.com/playwright:v1.57.0-noble`) with browsers pre-installed:
  - Eliminates the playwright install --with-deps step entirely
  - Which had been hanging on GitHub-hosted runners ([PR #71](https://github.com/bilbospocketses/svgedit/pull/71))
  - After the browser download reached 100%
  - And caused 60-min timeouts on PR #70 e2e-firefox ([PR #71](https://github.com/bilbospocketses/svgedit/pull/71))
````

## 4. JSDoc

Targeted, not exhaustive.

**Rules:**

- **Public-API functions** (anything exported from `packages/svgcanvas/` or
  `src/editor/`): 1-line summary required.
- **Internal/private**: JSDoc only when behavior is non-obvious or has hidden constraints.
- **Strip** `@param` and `@returns` when TS types cover them fully. (TS types appear
  in IDE hover; JSDoc duplicating them is noise.)
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

The 1-line summary captures intent + a non-obvious side effect (the event).
`@param`/`@returns` removed because TS types in the signature carry the same info.

## 5. Inline code comments

Default: no comment.

Identifiers, type signatures, and structure do the explaining. Add a comment only when
the WHY is non-obvious: hidden constraint, subtle invariant, workaround for a specific
bug, behavior that contradicts intuition.

**Rules:**

- Never explain WHAT the code does (the code does that).
- Never reference task/PR context (`// added for the X flow`, `// used by Y`,
  `// fixes #123`). That belongs in PR descriptions and commit messages, not source.
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

- AI attribution lines (`Co-Authored-By: Claude…`, `Generated with Claude Code`, etc.).
  Fork lineage is human-only.
- Issue/PR references in the subject; put them in the body.

**Good:**

```text
ci: set HOME=/root in Playwright container jobs for firefox launch

Firefox in the Playwright Docker image refuses to launch when $HOME
isn't owned by the current user. Container runs as root but $HOME
inherits from the runner's environment, so firefox sees a HOME folder
owned by a different uid and aborts.

Refs PR #71.
```

**Bad** (past tense; trailing period; AI attribution; subject > 72 chars):

```text
ci: Added the HOME=/root environment variable for firefox launch in container.

This was needed because firefox kept failing in the docker container we
added in the previous PR.

Co-Authored-By: Claude
```

## 7. PR descriptions

Two required sections:

```text
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

> e2e jobs now run inside `mcr.microsoft.com/playwright:v1.57.0-noble` — eliminates
> the install hang on GitHub-hosted runners (60-min timeouts on PRs #68/#70).

**Bad Summary bullet** (verbose, lists context that belongs in Background):

> We've been having problems with the GitHub Actions runners where the Playwright
> install hangs after the browser download reaches 100%, causing 60-minute timeouts
> and blocking PR merges, so this PR switches the e2e jobs to run inside the official
> Playwright Docker container which has the browsers pre-installed, eliminating the
> install step entirely.

## 8. Enforcement

Honor system primary. Tooling catches markdown-formatting drift on files we choose to enforce.

**Tools:**

- **markdownlint-cli2** — style rules in `.markdownlint.jsonc`; runner globs in
  `.markdownlint-cli2.jsonc` (the authoritative scope list). Covers the fork's top-level
  Markdown docs and `docs/tutorials/*.md`; `node_modules/`, `dist/`, and `docs/superpowers/**`
  are excluded.
- **eslint** — existing config covers TS/JS line length and comment formatting.
- **hex-guard** — `scripts/check-no-raw-hex.mjs` (run as `npm run lint:hex`) fails on raw
  colors outside `src/editor/styles/tokens.css`. See [`THEMING.md`](./THEMING.md).
- **`npm run lint`** chains `eslint .` → `markdownlint-cli2` → `npm run lint:hex`, and runs as
  the `pretest` step, so `npm test` gates on it. `npm run lint:md` runs markdownlint alone.

**Contributor workflow:**

1. Before substantial doc/code contribution: skim this guide.
2. Before opening PR: run `npm run lint` and `npm run lint:md` locally.
3. If a rule feels wrong for a specific case: flag on the PR. Don't silently deviate.

## 9. Out of scope

The following are NOT governed by this guide:

- **Spec docs** in `docs/superpowers/specs/` follow the superpowers
  brainstorming-skill format.
- **Plan docs** in `docs/superpowers/plans/` follow the superpowers
  writing-plans-skill format.
- **Test fixtures** in `tests/` and `packages/svgcanvas/tests/` follow practical
  conventions; this guide doesn't constrain test code style beyond what eslint
  already enforces.
- **Third-party JSDoc** in `node_modules/` — obviously.

Existing docs (`README.md`, `CONTRIBUTING.md`, `docs/tutorials/*.md`, in-tree JSDoc) were
brought under these rules by the follow-up sweeps — sub-project 12.B (brand hygiene:
README/CONTRIBUTING), 12.C (targeted JSDoc → TS conversion), and 12.D (tutorials rewrite).
