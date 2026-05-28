# svgedit House Style Guide — Design

**Date:** 2026-05-28
**Status:** Approved (brainstorming round complete; implementation plan pending)
**Sub-project:** TODO #12.A of 4 — the foundational sub-project of TODO #12 (full doc review)

## Context

Upstream docs (`docs/tutorials/*.md`, JSDoc in `packages/svgcanvas/`) use a terse bullet-oriented style. Our in-flight work since the fork (CHANGELOG entries, inline JSDoc, README additions) has drifted toward verbose multi-paragraph prose. Today's PRs (#71/#68/#70/#72) made the drift especially visible.

TODO #12 ("full document review — establish house style + audit upstream drift") is decomposed into four sequential sub-projects:

| Order | Sub-project | Status |
|---|---|---|
| **12.A** | **House style guide** | **this spec** |
| 12.B | Brand hygiene sweep (apply 12.A; strip upstream headers; audit tutorials) | pending |
| 12.C | JSDoc → TS type conversion (couples with TODO #2) | pending |
| 12.D | Publish-quality user tutorials (rewrite `docs/tutorials/*.md`) | pending |

This spec covers only **12.A** — the foundational style guide that the other three sub-projects apply.

## Goal

Ship `STYLE.md` at the repo root: a single canonical reference that humans and AI agents follow to keep prose, CHANGELOG entries, JSDoc, code comments, commit messages, and PR descriptions consistent. Calibrated-terse, fork-flavored, contributor-doc framing.

## Decisions captured

| Decision | Choice |
|---|---|
| Audience | Real contributor doc (rules + rationale + examples + anti-patterns) |
| Location | `STYLE.md` at repo root (canonical), linked from `CONTRIBUTING.md` |
| Scope domains | Prose voice, CHANGELOG entries, JSDoc, inline comments, commit messages, PR descriptions |
| Terseness target | Calibrated middle — tight by default, room for context when non-obvious |
| Voice | Mixed by context: imperative for rules, 2nd-person for tutorials, 3rd-person factual for CHANGELOG/API reference |
| JSDoc strictness | Targeted — public-API summary required, internal only when non-obvious |
| Code-comment philosophy | Only when WHY non-obvious (matches AI-agent default; resists drift) |
| Enforcement | Honor system + linter where possible (markdownlint, existing eslint); no new CI gates |
| Commit + PR shape | Codified in STYLE.md (not just CONTRIBUTING.md) |

## STYLE.md structure

Ten sections, ~300-400 lines total including examples. Each rule section includes one good/bad example pair (≤6 lines each).

### 1. Header
2-3 sentence intro: audience (contributors + AI agents), when to read (before substantial doc/code contribution), how to flag exceptions.

### 2. Voice & tone
Mixed by context rule. Three example blocks showing each voice:
- **Imperative** (STYLE.md, CONTRIBUTING.md rules): "Use 2nd person for tutorials. Cap CHANGELOG bullets at 180 chars."
- **2nd person** (`docs/tutorials/*.md`, how-tos): "Open the editor at `http://localhost:8000/src/editor/index.html`."
- **3rd-person factual** (CHANGELOG, API reference, design specs): "The editor now dispatches a `modeChange` event on internal mode transitions."

### 3. Markdown prose
- Soft 100-char line cap; no hard wrap (editors wrap visually).
- One concept per paragraph.
- Headings sentence-case.
- Code in backticks; file paths in backticks.
- Lists for enumerations; prose for flow.
- One good/bad example pair.

### 4. CHANGELOG entries
- Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) (already in use).
- Per-entry shape: `### <Category> (<Title> -- YYYY-MM-DD)` where category is one of `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Bullets 100-180 chars. Avoid sub-bullets unless a hierarchy is genuinely present.
- Optional `**Why:**` subsection for decisions whose rationale isn't obvious from the change itself.
- Optional `**Verification:**` line for test-touching changes — cite counts (e.g., `vitest 701/701 / e2e 250/250`).
- Cite file paths inline in backticks. PR references (`[PR #N](https://github.com/bilbospocketses/svgedit/pull/N)`) go in body bullets when relevant; don't repeat the same PR # across multiple bullets of one entry.
- One good/bad example.

### 5. JSDoc
- **Public-API functions** (anything exported from `packages/svgcanvas/` or `src/editor/`): 1-line summary required.
- **Internal/private**: JSDoc only when behavior is non-obvious or has hidden constraints.
- Strip `@param` and `@returns` when TS types fully cover (which is most cases post-#19).
- Keep `@throws`, `@deprecated`, `@example`, `@see`.
- Strip upstream `@copyright 2010 ...` and `@author` headers.
- One before/after migration example (showing a typical upstream JSDoc block reduced to the targeted equivalent).

### 6. Inline code comments
- **Default: no comment.** Identifiers, type signatures, and structure do the explaining.
- **Add only when the WHY is non-obvious**: hidden constraints, subtle invariants, workarounds for specific bugs, behavior that contradicts intuition.
- **Never explain WHAT** the code does (the code does that).
- **Never reference task/PR context** ("added for the X flow", "used by Y") — that belongs in PR descriptions, not source.
- One good/bad example pair showing the WHY-only rule.

### 7. Commit messages
- **Subject**: imperative present tense (`Add X`, not `Added X`); ≤72 chars; no trailing period.
- **Body** (optional): wrapped ≤80; separated from subject by blank line; explains motivation and non-obvious tradeoffs.
- **No AI attribution lines** (existing CONTRIBUTING.md rule, restated here for one-stop reference).
- **Issue/PR references**: in body, not subject.
- Co-author lines: only when actual co-authorship occurred (not for AI assistance).
- One good/bad example.

### 8. PR descriptions
- Two required sections: `## Summary` and `## Test plan`.
- **Summary**: 1-5 terse bullets matching the CHANGELOG terseness target (100-180 chars).
- **Test plan**: bulleted markdown checklist (`- [ ]`) of TODO verifications the reviewer should mentally run through.
- Additional sections (`## Background`, `## Why`, `## Notes for reviewer`) allowed when scope warrants.
- One good example.

### 9. Enforcement
- **Primary**: honor system. AI agents read STYLE.md as part of contributor context; humans reference it.
- **Tooling**: `.markdownlint.jsonc` at repo root with:
  - `line-length: 100` (off for code blocks, tables, embedded HTML)
  - `heading-style: atx`
  - `code-block-style: fenced`
  - `blanks-around-headings: true`
  - `no-trailing-spaces: true`
- Existing eslint config covers TS/JS line length and inline comment formatting; no changes there.
- Wire markdownlint into existing `npm run lint` if the package can be added cleanly. Otherwise standalone `npm run lint:md` invocation.
- No new required CI status checks (avoid bikeshedding gates).

### 10. Out of scope
- Spec docs in `docs/superpowers/specs/` follow the brainstorming skill's spec format (this very file is an example) — not governed by STYLE.md.
- Plan docs in `docs/superpowers/plans/` follow the writing-plans skill's plan format — not governed by STYLE.md.
- Existing docs are NOT retro-edited as part of 12.A. They get rewritten in sub-projects 12.B / 12.C / 12.D using the rules from 12.A.

## Examples strategy

Each rule section gets ONE good/bad example pair. Examples are load-bearing — rules without examples drift quickly because what counts as "tight" or "non-obvious" is empirical. Examples should be ≤6 lines each, drawn from real svgedit code/docs where possible (so they look like what contributors actually see).

## Companion: `.markdownlint.jsonc`

Add a sibling file to STYLE.md. Lightweight config covering the few rules that matter. Comments inside the JSONC explain why each rule is configured (or disabled).

## Migration plan (for follow-up sub-projects 12.B/C/D)

12.A ships standalone — `STYLE.md` + `.markdownlint.jsonc` only, no rewrites of existing docs. Subsequent sub-projects:

- **12.B Brand hygiene sweep**: Apply STYLE.md to `README.md`, `CONTRIBUTING.md`, `docs/tutorials/*.md` headers/voice. Strip upstream `@copyright` headers across `packages/svgcanvas/`. Refresh stale fork-vs-upstream framing.
- **12.C JSDoc → TS conversion**: Bundle with TODO #2 (linter swap + TS strictness). Apply targeted-JSDoc rule across `packages/svgcanvas/` and `src/editor/`. Drop redundant `@param`/`@returns`.
- **12.D Publish-quality user tutorials**: Rewrite `docs/tutorials/*.md` (8 files) as proper user-facing docs — examples, prereqs, walkthroughs. Largest effort.

CHANGELOG entries from today's PRs (#71/#68/#70/#72) get a soft pass — already shipped; not retro-edited unless they actively mislead. Future entries follow STYLE.md.

## Open questions

None blocking. Implementation plan (next step via writing-plans skill) will surface tactical questions about markdownlint version pinning and CONTRIBUTING.md cross-link placement.

## Success criteria

- `STYLE.md` exists at repo root and is linked from `CONTRIBUTING.md`.
- `.markdownlint.jsonc` exists and passes against current `*.md` files (after a one-time formatting pass on the new STYLE.md itself — no other files touched).
- `npm run lint` (or `npm run lint:md`) runs markdownlint cleanly.
- Future CHANGELOG entries, JSDoc additions, commit messages, and PR descriptions can be reviewed against STYLE.md without ambiguity for the common cases.
