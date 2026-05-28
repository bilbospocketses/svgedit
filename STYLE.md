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

> Sections 6-9 (commits, PRs, enforcement, scope) land in subsequent commits on this branch.

## 1. Voice & tone

Mixed by context. Three voices, three audiences:

- **Imperative** — STYLE.md, CONTRIBUTING.md, AGENTS.md, any rules doc.

  > Use 2nd person for tutorials. Cap CHANGELOG bullets at 180 chars. Strip upstream
  > `@copyright` headers.

- **2nd person** — `docs/tutorials/*.md`, READMEs of subpackages, how-to guides.

  > Open the editor at `http://localhost:8000/src/editor/index.html`. Click **File →
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
