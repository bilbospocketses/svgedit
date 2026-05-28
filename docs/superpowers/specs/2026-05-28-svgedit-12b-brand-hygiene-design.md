# svgedit Brand Hygiene Sweep — Design

**Date:** 2026-05-28
**Status:** Approved (brainstorming round complete; implementation plan pending)
**Sub-project:** TODO #12.B of 4 — applies the STYLE.md house style (12.A) to existing
fork docs and source files

## Context

12.A shipped `STYLE.md` + `.markdownlint.jsonc` + `.markdownlint-cli2.jsonc` (PRs #74, #75).
The companion sub-projects laid out in the 12.A spec are:

| Order | Sub-project | Status |
|---|---|---|
| 12.A | House style guide | **SHIPPED** (PR #74 + #75, 2026-05-28) |
| **12.B** | **Brand hygiene sweep (apply 12.A; strip upstream headers; refresh framing)** | **this spec** |
| 12.C | JSDoc → TS type conversion (couples with TODO #2) | pending |
| 12.D | Publish-quality user tutorials (rewrite `docs/tutorials/*.md`) | pending |

12.B targets the residual upstream artifacts and framing drift surfaced when STYLE.md shipped:

- **36 source files** carry upstream `@copyright` / `@author` JSDoc headers (24 in
  `packages/svgcanvas/`, 12 in `src/editor/`).
- **`CONTRIBUTING.md`** contradicts `project_svgedit.md` in three places: routes general
  PRs upstream (line 5), describes `feat/ts-migration` as "active branch" (line 48), and
  claims master still uses the `standard` linter (line 51) — TODO #19 closed the
  type-safety sweep on master.
- **`STYLE.md` § 1** references `AGENTS.md` as an imperative-voice rules doc, but the
  file does not exist in the repo.
- **`.markdownlint-cli2.jsonc`** is scoped to `STYLE.md` only — by design, deferring
  glob expansion to 12.B after existing docs are sweep-cleaned.

## Goal

Two PRs that close the residual hygiene gap from 12.A:

1. Refresh fork-facing framing in `README.md` and `CONTRIBUTING.md`; create `AGENTS.md`;
   expand markdownlint coverage to the top-level fork docs.
2. Strip upstream `@copyright` / `@author` lines from the 36 source files in a separate
   mechanical pass.

## Decisions captured

| Decision | Choice |
|---|---|
| Tutorials (`docs/tutorials/*.md`) | **Out of scope.** Full rewrite in 12.D — not touched in 12.B. |
| `@copyright` / `@author` strip scope | **Surgical** — strip only those two JSDoc lines; keep `@module`, `@license`, `@example`, file descriptions, etc. If a block becomes empty, delete the block. |
| `@license` JSDoc tags | **Keep.** Repo root `LICENSE` + per-file `LICENSE-MIT.txt` are authoritative; in-line `@license` tags carry useful per-file context. |
| `AGENTS.md` | **Create.** Minimal ~25-line agent-context entry point referencing STYLE.md, multi-session host conventions, no AI attribution. |
| Contribution posture | **Open to issues; PRs rarely accepted (case-by-case).** Realistic middle ground between the project doc's "personal fork" framing and the existing CONTRIBUTING.md's upstream-routing language. |
| PR shape | **Two PRs** split by review character — substantive (PR-1) vs mechanical (PR-2). |
| Order | PR-1 first (resolves STYLE.md's `AGENTS.md` reference fast + markdownlint covers docs being touched). PR-2 second, off the updated master. |
| markdownlint glob expansion | Include `STYLE.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CHANGELOG.md`. Keep `docs/superpowers/**` and `docs/tutorials/**` ignored. |
| markdownlint CI wiring | Wire `markdownlint-cli2` into `npm run lint` (so local devs see violations). **Don't** add as a required CI status check — honor system + STYLE.md guidance is the gate. |
| SVG icon attribution comments | **Out of scope** — already shipped in PR #72. |
| Forked-in `path-data.ts` (formerly `path-data-polyfill`) | **Not affected.** PR #67 forked the polyfill in as `packages/svgcanvas/core/path-data.ts` with no `@copyright` / `@author` tags. Not in the 36-file list. |

## PR-1 — Docs framing + markdownlint expansion

**Branch:** `feature/12-b-docs-framing` off `origin/master`.

**Files modified or created (~5-8):**

### `AGENTS.md` (NEW)

~25 lines. Imperative voice per STYLE.md § 1. Sections:

- **Style** — single sentence pointing to STYLE.md for all doc / comment / commit / PR
  conventions.
- **Multi-session host conventions** — agents working in this repo from a multi-session
  Claude Code host must use `git -C "<repo-root>"` for every git operation and absolute
  paths for every file operation. Cwd-implicit commands risk cross-session interference.
- **No AI attribution** — restate STYLE.md § 6: no `Co-Authored-By: Claude…` or
  `Generated with Claude Code` lines.
- **Verify against current code** — agents must verify claims about file contents from
  the working tree, not from memory snapshots or training-data assumptions.
- **In-flight design work** — pointer to `docs/superpowers/specs/` (frozen design specs)
  and `docs/superpowers/plans/` (frozen implementation plans).

### `CONTRIBUTING.md` (refresh)

Targeted edits to the three drift sites:

- **Line 5 (upstream-PR routing):** replace with the "open to issues; PRs rarely
  accepted" posture. Issues are welcome for bug reports and feature suggestions; PRs
  may be reviewed but no guarantee of merge — the fork is personal-taste-driven.
- **Lines 48-52 (linter / branch framing):** drop the "active branch `feat/ts-migration`
  is converting files in stages" + "master uses `standard`" framing. Replace with a
  single sentence noting master is on TypeScript + ESLint + `typescript-eslint` and
  `feat/ts-migration` is retained as historical reference.
- **General prose pass:** verify sentence-case headings; verify soft 100-char wrap (no
  hard breaks); tighten any verbose paragraphs.

### `README.md` (light pass)

- Replace the `docs/tutorials/` row's "(legacy upstream content; revisit during TS
  migration)" parenthetical with "(rewrite pending — see TODO #12.D)".
- Verify sentence-case headings (currently mostly compliant).
- Verify no other drift.

### `.markdownlint-cli2.jsonc` (config expansion)

Expand the `globs` array:

```jsonc
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

`docs/tutorials/**` stays ignored — 12.D will rewrite those files and add them to the
glob list at that point. `docs/superpowers/**` stays ignored (specs and plans are frozen
snapshots).

### `package.json` (script wiring)

Wire `markdownlint-cli2` into `npm run lint` so local `npm run lint` runs both linters:

```json
{
  "scripts": {
    "lint": "eslint . && markdownlint-cli2",
    "lint:md": "markdownlint-cli2"
  }
}
```

Keep the standalone `lint:md` script for selective invocation. Don't add markdownlint as
a separate required CI status check — the existing 5 checks (build-and-unit, e2e-chromium,
e2e-firefox, CodeQL, Scorecard) gate the merge.

### `CHANGELOG.md` entry

Single `### Changed (Brand hygiene sweep -- 2026-05-28)` entry under `[Unreleased]`,
following the STYLE.md § 3 entry shape.

**Verification gates (PR-1):**

| Gate | Expected |
|---|---|
| `npm run lint` (now chained) | exit 0 |
| `npm run lint:md` standalone | exit 0 |
| `npm test` | vitest 701/701, e2e 250/250 unchanged |
| `npm run build` | success |
| Required CI checks | all green |

**Review character:** substantive (voice, framing, drift fixes, new doc).

## PR-2 — `@copyright` / `@author` mechanical strip

**Branch:** `feature/12-b-copyright-strip` off the updated master post-PR-1.

**Files modified (36):**

**24 in `packages/svgcanvas/`** (per `grep '@copyright|@author'`):

```text
svgcanvas.ts
common/browser.ts
core/blur-event.ts
core/clear.ts
core/draw.ts
core/elem-get-set.ts
core/event.ts
core/history.ts
core/historyrecording.ts
core/json.ts
core/layer.ts
core/path-actions.ts
core/path-method.ts
core/path.ts
core/sanitize.ts
core/select.ts
core/selected-elem.ts
core/selection.ts
core/svg-exec.ts
core/svgroot.ts
core/text-actions.ts
core/undo.ts
core/units.ts
core/utilities.ts
```

**12 in `src/editor/`** (per same grep, 16 occurrences across 12 files):

```text
contextmenu.ts
Editor.ts
extensions/ext-connector/ext-connector.ts
extensions/ext-eyedropper/ext-eyedropper.ts
extensions/ext-grid/ext-grid.ts
extensions/ext-markers/ext-markers.ts
extensions/ext-opensave/ext-opensave.ts
extensions/ext-overview_window/ext-overview_window.ts
extensions/ext-panning/ext-panning.ts
extensions/ext-polystar/ext-polystar.ts
extensions/ext-shapes/ext-shapes.ts
extensions/ext-storage/ext-storage.ts
```

**Edit pattern (surgical):**

- Strip every line matching `\s*\*\s*@copyright\s` or `\s*\*\s*@author\s`.
- If the resulting JSDoc block contains only the opening `/**` and closing `*/` with no
  content (or only blank `*` lines), delete the entire JSDoc block including the
  trailing newline.
- Touch nothing else in the file.

**Tooling:**

A one-off `scripts/strip-copyright.mjs` helper (NOT committed) generates the diff in a
single sweep, then each file gets a visual diff-skim before commit. Don't blind-apply —
the empty-block case warrants per-file inspection.

The script lives in `ClaudeScratch` (per `feedback_scratch_files_use_claudescratch.md`),
not the repo, since it's a one-shot tool.

**Verification gates (PR-2):**

| Gate | Expected |
|---|---|
| `npm run lint` (now chained from PR-1) | exit 0 — JSDoc deletion doesn't trip eslint or markdownlint |
| `npm run lint:md` | exit 0 — no doc changes |
| `npm test` | vitest 701/701, e2e 250/250 unchanged |
| `npm run build` | success — no behavior change expected |
| Required CI checks | all green |
| Manual diff-skim per file | confirms surgical edits only |

**Review character:** mechanical, diff-skim only. A reviewer should be able to scan all
36 file diffs in <5 min.

## Risks + rollback

### PR-1

- **Risk:** markdownlint expansion may flag existing CHANGELOG entries (long bullets from
  pre-STYLE.md PRs). Mitigation: run `npm run lint:md` locally before opening PR; either
  fix flagged entries inline (preferred — only ~5 PRs predate STYLE.md) or temporarily
  exempt the prior section. Today's PRs (#71/#68/#70/#72) get a soft pass per 12.A spec.
- **Rollback:** `gh pr revert <N>` or `git revert -m 1 <sha>`. Disjoint file set from
  PR-2 means independent revertability.

### PR-2

- **Risk:** Negligible. JSDoc `@copyright` / `@author` carry no runtime or build-time
  significance. The TSDoc-style tooling we'd be concerned about (Typedoc, API
  Extractor) is not in use here.
- **Edge case:** A few files may have `@copyright` / `@author` lines as the only JSDoc
  content. The empty-block deletion case handles this — but visual diff-skim catches
  malformed leftovers (e.g., stray leading blank lines).
- **Rollback:** `gh pr revert <N>` or `git revert -m 1 <sha>`. Disjoint file set from
  PR-1 means independent revertability.

## Effort

- **PR-1:** ~60-90 min (substantive doc work + verification + CI wait)
- **PR-2:** ~30-45 min (scripted pass + per-file diff-skim + verification + CI wait)
- **Total elapsed:** ~2-3 hours including CI cadence

## Open questions

None blocking. Implementation plan (next step via the writing-plans skill) will surface
tactical questions about markdownlint version pinning verification, the exact final
shape of the strip-copyright helper script, and `CHANGELOG.md` retroactive fixes.

## Success criteria

- `AGENTS.md` exists at repo root and is markdownlint-clean.
- `CONTRIBUTING.md` no longer routes general PRs upstream, no longer describes
  `feat/ts-migration` as active, and no longer claims master uses `standard`.
- `README.md` points TODO #12.D as the home for tutorial rewrites.
- `.markdownlint-cli2.jsonc` covers the top-level fork docs.
- `npm run lint` runs both eslint and markdownlint-cli2.
- All 36 source files no longer carry upstream `@copyright` / `@author` JSDoc lines.
- No regressions: vitest 701/701, e2e 250/250, build succeeds.
- 12.C and 12.D remain unblocked for their respective brainstorm cycles.

## Migration plan (for follow-up sub-projects 12.C / 12.D)

- **12.C JSDoc → TS conversion:** Apply STYLE.md § 4 targeted-JSDoc rule across the same
  ~36 source files (and beyond). Drop redundant `@param` / `@returns` where TS types
  cover them. Bundles with TODO #2 (linter swap completion verification).
- **12.D Publish-quality user tutorials:** Rewrite all 8 `docs/tutorials/*.md` files as
  proper user-facing docs (examples, prereqs, walkthroughs). Add `docs/tutorials/**` to
  the markdownlint globs once rewrites are clean. Largest effort.

Each sub-project follows the same spec → plan → implementation cycle established by
12.A and 12.B.
