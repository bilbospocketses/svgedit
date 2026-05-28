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

Keep bullets tight, fact-first. Dispatch by noun; don't lead with "now" or "added."

**Anchor formats:**

- `Fixed <X> <symptom>` — bug fix (what broke, what now works)
- `Added <X>` — new feature
- `Changed <X>` — behavior change, breaking or semver-minor
- `Removed <X>` — deleted code, config, or behavior
- `Docs <X>` — doc-only change

**Rules:**

- Capitalize the anchor noun only: `Fixed editor.js focus leak on mode toggle`.
- Keep bullets ≤180 chars. Line-wrap mid-sentence if needed; indent continuation lines
  by 2 spaces.
- List related fixes under a single anchor. Unrelated fixes: separate bullets.
- Never name yourself. Commits name authors; CHANGELOG is impersonal.
- Don't link in CHANGELOG bullets (links live in release notes, not the entry).

**Good:**

```markdown
- Fixed SVG import: path data now normalized before element creation. Resolves
  blank-canvas failures on non-normalized `<path>` input.
- Added `editor.getMousePos()` to public API. Returns canvas-relative
  coordinates from last mouse event; useful for plugin integrations.
- Removed legacy `getCursorPos()` function. Use `getMousePos()` instead.
```

**Bad:**

```markdown
- now fixed the SVG import path data normalization issue
- Added the new `getMousePos()` function so devs can get mouse coords
- See PR #123 for details (https://...)
```

## 4. JSDoc

Content coming in Task 4.

## 5. Inline code comments

Content coming in Task 4.

## 6. Commit messages

Content coming in Task 4.

## 7. PR descriptions

Content coming in Task 5.

## 8. Enforcement

Content coming in Task 5.

## 9. Out of scope

Content coming in Task 5.
