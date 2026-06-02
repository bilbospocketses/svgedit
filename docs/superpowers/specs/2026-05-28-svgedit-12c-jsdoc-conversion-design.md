# svgedit JSDoc → TS Conversion — Design

**Date:** 2026-05-28
**Status:** Approved (brainstorming round complete; implementation plan pending)
**Sub-project:** TODO #12.C of 4 — applies STYLE.md § 4 targeted-JSDoc rule across the
TypeScript source tree

## Context

12.A shipped `STYLE.md` (PRs #74, #75) with this rule in § 4:

> - **Public-API functions** (anything exported from `packages/svgcanvas/` or `src/editor/`):
>   1-line summary required.
> - **Internal/private**: JSDoc only when behavior is non-obvious or has hidden constraints.
> - **Strip** `@param` and `@returns` when TS types cover them fully.
> - **Keep** `@throws`, `@deprecated`, `@example`, `@see` — these carry information types don't.

12.B shipped the brand-hygiene sweep (PRs #76, #77, #78), stripping upstream
`@copyright` / `@author` headers from 36 files. 12.B explicitly deferred the JSDoc body
work to 12.C.

The 12.A spec also notes 12.C "Bundles with TODO #2 (linter swap completion verification)."

### Current state of the codebase (verified 2026-05-28)

- **`packages/svgcanvas/`:** 37 .ts files; 26 carry `@param` / `@returns` JSDoc tags
  (525 occurrences).
- **`src/editor/`:** 75 .ts files; 22 carry `@param` / `@returns` JSDoc tags
  (216 occurrences).
- **Combined:** 741 `@param` / `@returns` occurrences across 48 of the ~112 .ts files in
  scope.
- **Linter:** `eslint.config.js` is fully on `typescript-eslint`
  (`tseslint.configs.recommendedTypeChecked` for .ts; no `standard` dependency;
  no `eslint-plugin-jsdoc`). **TODO #2 is effectively SHIPPED** — JSDoc edits will not
  trip lint rules, and the planned "bundle with linter swap" is reduced to a
  verification observation: the swap is already done.

## Goal

A single PR that applies STYLE.md § 4 to all .ts files in `packages/svgcanvas/` and
`src/editor/`. The pass:

1. **Strips type-only `@param` / `@returns`** — lines whose description is just a type
   restatement (e.g., `@param {string} name - The name`) are removed entirely.
2. **Preserves semantic-info `@param` / `@returns`** — lines whose description carries
   info beyond the type (allowed values, units, edge cases, examples) are kept, but the
   `{type}` annotation is dropped (TS types cover it).
3. **Deletes JSDoc blocks that become empty** after the strip.
4. **Backfills 1-line summaries** for exported functions, classes, and constants in the
   scope dirs that lack a JSDoc summary.
5. **Preserves** all `@throws`, `@deprecated`, `@example`, `@see`, `@module`, `@license`
   tags untouched.

## Decisions captured

| Decision | Choice |
|---|---|
| `@param` / `@returns` retention | **Case-by-case.** Strip when description is just a type restatement. Keep when description carries info beyond the type (allowed values, edge cases, examples). Drop the `{type}` annotation on retained tags. |
| File set | **All `.ts` files in `packages/svgcanvas/` + `src/editor/`** — ~112 files. Cleanup pass + public-API summary backfill. |
| Public-API summary backfill | **In scope.** For every exported function / class / `const` lacking a JSDoc 1-line summary, add one. "Exported" = `export` keyword present in the declaration. |
| Execution strategy | **Per-directory subagent dispatch, single PR.** Files chunked at **≤5 files per subagent**. ~22-24 chunks total. |
| Locale files (`**/locale/en.ts`) | **Out of scope.** Not real source; they're i18n string bundles. |
| `.d.ts` declaration files | **Out of scope.** Pure type-shim files (`global-dialogs.d.ts`, `vite-shims.d.ts`). |
| Test files (`tests/**`) | **Out of scope** per STYLE.md § 9. |
| `path-data.ts` (forked-in polyfill, PR #67) | **In scope.** Treat like any other source file. Its `@param` / `@returns` cover the public path-data API and benefit from the same cleanup. |
| `_reference/embed-api-v6/` | **Out of scope.** Preserved historical reference per `README.md`. |
| TODO #2 (linter swap) | **No work required.** Already shipped. Spec notes the verification observation; no follow-up actions. |
| PR shape | Single PR `feature/12-c-jsdoc-conversion` off updated master. Multiple commits — one per subagent chunk. |
| Retained `{type}` annotations on `@param` / `@returns` | **Drop them.** TS function signatures carry the type; JSDoc `{type}` is duplicate noise. |

## Edit rules

For each .ts file in scope, the implementer subagent applies these rules in order:

### Rule 1 — Strip type-only `@param` / `@returns`

A `@param` or `@returns` line is **type-only** if its description, after stripping
whitespace and the optional leading `-`, is either:

- A single phrase identical or near-identical to the parameter name (e.g.,
  `@param {string} name - The name`)
- A single phrase that just restates the type (e.g.,
  `@returns {string} The string representation`)
- Empty (e.g., `@param {string} name`)

Strip the entire line.

### Rule 2 — Preserve semantic-info `@param` / `@returns`

A line is **semantic-info** if its description includes any of:

- Allowed values or enum constraints (`(e.g., 'select', 'fhpath', 'text')`,
  `must be one of …`)
- Units (`milliseconds`, `pixels`, `radians`)
- Range constraints (`0 to 1`, `non-negative`)
- Edge cases or null-handling (`null when …`, `undefined if …`)
- Side-effect notes (`dispatches X event`, `mutates Y`)
- Examples (`e.g. …`)

**Keep the line, but drop the `{type}` annotation:**

```typescript
// Before
/** @param {string} mode - The drawing mode (e.g., 'select', 'fhpath', 'text') */
setCurrentMode(mode: string): void

// After
/** @param mode - The drawing mode (e.g., 'select', 'fhpath', 'text') */
setCurrentMode(mode: string): void
```

When in doubt, **prefer preservation** — strip only when certain the description is
pure type restatement.

### Rule 3 — Delete empty JSDoc blocks

After Rules 1-2 apply, if a JSDoc block contains only the opening `/**`, optional blank
`*` lines, and closing `*/`, delete the entire block.

### Rule 4 — Backfill public-API summaries

For every declaration with `export` keyword (function, class, `const`, `let`, type,
interface) lacking a JSDoc 1-line summary, add one. The summary describes intent in
imperative present tense, ≤100 chars, no trailing period.

```typescript
// Before
export const computeBBox = (elem: SVGElement): DOMRect => {

// After
/** Compute the bounding box of an SVG element. */
export const computeBBox = (elem: SVGElement): DOMRect => {
```

Skip declarations that already have a JSDoc block with any prose content (don't disturb
existing intent).

**Internal (non-exported) declarations** — only add JSDoc if behavior is non-obvious
(matches existing STYLE.md § 4 "internal" guidance). The default is: leave them alone.

### Rule 5 — Preserve other tags

`@throws`, `@deprecated`, `@example`, `@see`, `@module`, `@license`, `@override` are
preserved as-is. Strip only `@param` / `@returns` per the rules above and the upstream
attribution tags already handled in 12.B (`@copyright` / `@author` — should be gone
post-12.B).

## Chunking strategy

The implementation plan enumerates ~22-24 chunks. Chunking principles:

- **≤5 files per chunk** (user-locked).
- **Group by directory** so chunks have semantic coherence (e.g., all `dialogs/` together).
- **Roughly even token cost** — chunks with one large file (`Editor.ts` is ~700 LOC) get
  fewer companion files. Chunks of small files (locale files, components) can hit 5.
- **Sequential execution on the same branch** — avoids merge conflicts; later chunks
  build on earlier chunks' commits.

Indicative chunking (final list in implementation plan):

| Chunk | Directory | Files |
|---|---|---|
| 1-8 | `packages/svgcanvas/` (common + core + top-level) | ~37 files in 8 chunks |
| 9-10 | `src/editor/` shell (Editor.ts + ConfigObj.ts + main entry points) | ~10 files in 2 chunks |
| 11-15 | `src/editor/components/` + jgraduate/ | ~25 files in 5 chunks |
| 16-17 | `src/editor/dialogs/` | ~11 files in 2 chunks |
| 18 | `src/editor/panels/` | 4 files |
| 19-22 | `src/editor/extensions/` (`ext-*.ts` only) | ~12 files in 4 chunks |

Locale files (`**/locale/en.ts`) and `.d.ts` files excluded. Total touched: ~95 files.

## Verification gates

Per-chunk:

- `npm run lint` (eslint + markdownlint chained) — exit 0
- `npx vitest run` — 701/701 passing (no regressions)
- `npm run build` — success

End of full PR:

- All above + `node scripts/run-e2e.ts` — 250/250 (or defer to CI as PR-1/PR-2 did)
- Grep: zero remaining `@param {.*}` patterns with type-only descriptions across scope
  (sanity check; some semantic-info lines remain by design)
- Grep: every `export function` / `export class` / `export const` in scope dirs has
  a preceding `/** ... */` block (sanity check on backfill coverage)

## Out of scope

- **Anything outside `packages/svgcanvas/` and `src/editor/`.** Tests, scripts, config
  files, `_reference/`, dist files, node_modules.
- **`docs/tutorials/*.md` rewrites** — sub-project 12.D.
- **JSDoc additions for non-obvious internal logic.** STYLE.md allows this; 12.C does
  not actively hunt for opportunities. If a subagent notices a non-obvious internal
  function and flags it in their report, that's a 12.D-adjacent observation, not a
  12.C requirement.
- **Refactoring code structure.** Subagents touch JSDoc only. No renames, no signature
  changes, no logic edits.
- **`@module` / `@license` cleanup.** Both stay per STYLE.md § 4. The blank-`*`-line
  residue noted as a 12.B observation gets folded in here only if it lives in a JSDoc
  block being touched anyway; otherwise leave for future cleanup.

## Risks + rollback

- **Risk:** Subagent over-strips a semantic-info `@param` line, losing info that wasn't
  in the TS type. Mitigation: spec-reviewer subagent specifically checks per-chunk for
  this regression by spot-comparing pre-strip and post-strip descriptions.
- **Risk:** Subagent backfills a generic summary that doesn't help readers (e.g.,
  `/** Set X. */` for a method called `setX`). Mitigation: code-quality reviewer flags
  empty/redundant summaries.
- **Risk:** Branch grows long and gets merge conflict with master if other work lands.
  Mitigation: 12.C is the only active 12.X work; coordinate to avoid concurrent doc PRs.
  If conflict occurs, rebase chunks sequentially.
- **Rollback:** Standard `git revert -m 1 <merge-sha>`. The PR ships as one merge commit;
  revert restores prior master. Individual chunk commits can be reverted if a specific
  chunk is bad (but full-PR revert is simpler).

## Effort estimate

- **~22-24 chunks** × **3 subagent dispatches per chunk** (implementer + spec reviewer +
  code-quality reviewer) = **~66-72 subagent dispatches**.
- **Per-chunk wall time:** 5-15 min (implementer takes most of it; reviewers are faster).
- **Total wall time:** **8-15 hours of focused execution**. Realistically spans
  multiple sessions; the writing-plans skill will produce a plan that's
  session-resumable.
- **CI wait time:** trivial — no per-chunk CI; only one final CI run at PR open.
- **Reviewer + final code-review at PR ship:** ~30 min.

## Success criteria

- Every .ts file in `packages/svgcanvas/` and `src/editor/` (excluding locale/`.d.ts`)
  has been visited by a subagent.
- Every `@param` / `@returns` line that is purely type-only has been stripped.
- Every retained `@param` / `@returns` line has its `{type}` annotation removed.
- Every empty JSDoc block (post-strip) has been deleted.
- Every exported declaration lacking a JSDoc 1-line summary has gained one.
- `@throws`, `@deprecated`, `@example`, `@see`, `@module`, `@license` tags untouched.
- vitest 701/701, e2e 250/250 (CI), `npm run build` success — no regressions.
- 12.D remains unblocked.

## Open questions

None blocking. The implementation plan (next step via writing-plans skill) will surface
tactical questions about chunk boundaries, exact chunk file lists, and how subagent
prompts encode the Rule 2 "semantic info" heuristic.

## Migration plan (for follow-up sub-project 12.D)

12.D rewrites the 8 `docs/tutorials/*.md` files as proper user-facing docs (examples,
prereqs, walkthroughs). Adds `docs/tutorials/**` to the markdownlint globs once
rewrites are clean. Spec calls 12.D "the largest effort." Brainstorm + spec + plan +
implementation per the established cycle.
