# svgedit House Style Guide

How svgedit's docs, code comments, commit messages, and PRs are written. Read this before
substantial doc or code contribution. Flag exceptions on the PR; don't silently deviate.

The guide is opinionated — calibrated terse, fork-flavored. Examples carry as much weight
as rules; consult them when "tight" or "non-obvious" feels ambiguous.

## Contents

1. [Voice & tone](#1-voice--tone)
2. [Markdown prose](#2-markdown-prose)

> Sections 3-9 (CHANGELOG, JSDoc, code comments, commits, PRs, enforcement, scope) land in
> subsequent commits on this branch.

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
