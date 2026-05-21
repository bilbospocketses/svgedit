# svgedit JS → TS migration — design spec

**Status:** Approved (brainstorm 2026-05-16). Feeds the implementation plan written by `superpowers:writing-plans`.

**Maps to:** `todo_svgedit.md` item #2 ("JS → TS migration"). Step 3 of the four-step migration sequence below.

**Inputs:** `docs/AUDIT_2026-05-16.md` (per-file audit + decisions log + open-decisions section + migration architectural decisions); `todo_svgedit.md` items #2, #3, #6, #8, #10; `project_svgedit.md` scope directive.

---

## 1. Migration sequencing — four PRs, not one

The audit framed #2 as a "big-bang TS migration with elix→Lit (#3) and pathseg drop (#6) running in lockstep." Brainstorm settled on a sequential decomposition into four PRs:

| Step | PR | Scope | Status before this spec |
|---|---|---|---|
| 1 | `feat/pre-migration-cleanup` | Pre-migration deletions + dead-code removal + brand updates + verify-then-delete duplicates | Not started; mostly mechanical from audit doc |
| 2 | `feat/pathseg-drop` | 8 `createSVGPathSeg*` refactors in `path-actions.js` + polyfill removal + 7 `import 'pathseg'` removals | Not started; transition plan in audit § pathseg-drop |
| 3 | `feat/ts-migration` | **THIS SPEC.** 188 `.js` → `.ts` conversion under day-one strict, with `.d.ts` augmentation for wired-on `SvgCanvas` methods, mechanical naming-consistency renames, linter swap, e2e coverage scaffolding cleanup | Designed (this doc); plan to be written |
| 4 | `feat/elix-to-lit` | elix→Lit component-by-component rewrite | Deferred to dedicated brainstorm (#3 in todo) |

Each step is independently testable and revertible. Trade-off accepted: elix-using files get touched twice (once in Step 3, once in Step 4 when they get rewritten as Lit components). The reviewability and bisectability win outweigh the duplicated touch.

This spec covers **only Step 3**. Steps 1 and 2 land first as mostly-mechanical cleanup; Step 4 gets its own brainstorm + spec.

---

## 2. Scope of Step 3

### In scope
- `tsconfig.json` (root) + `packages/svgcanvas/tsconfig.json` (package, with `composite: true`); both at `strict: true` from line one.
- Convert all ~112 production `.js`/`.mjs` files under `packages/svgcanvas/`, `src/editor/`, and `scripts/` to `.ts` (pre-Step-1 baseline is ~115 files; Step 1 deletes 3 of them: `browser-not-supported.js`, `ext-helloworld/ext-helloworld.js`, `ext-helloworld/locale/en.js`).
- Replace existing hand-written `packages/svgcanvas/svgcanvas.d.ts` (226-line shim) with:
  - The `SvgCanvas` interface declared in the new `packages/svgcanvas/svgcanvas.ts`.
  - A new `packages/svgcanvas/svgcanvas.augment.d.ts` (~50 lines) using module augmentation to declare every method wired on by `core/*.ts init()` calls. Hand-maintained but small; drift is caught immediately by usage failing to compile.
- Mechanical naming-consistency renames (per audit § Naming consistency cleanup):
  - `controllPoint1`/`controllPoint2` → `controlPoint1`/`controlPoint2` (8 sites)
  - `getrootSctm` → `getRootSctm` (heavy use in `event.js`)
  - `getrefAttrs` → `getRefAttrs`
  - `gettingSelectorManager` → `getSelectorManager`
  - `idprefix` → `idPrefix`
  - `getbSpline` / `setbSpline` → `getBSpline` / `setBSpline`
  - `current_drawing_` → `currentDrawing`
  - Trailing-underscore pseudo-privates throughout `core/` → `#` private fields (`historyrecording.js`, `layer.js`, `draw.js Drawing`, `undo.js handler_`, `recalculate.js`, etc.)
- Linter swap: drop `standard` (no TS support); add `eslint` v9 + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` (flat config `eslint.config.js`).
- Build wiring: Vite handles `.ts` natively (no plugin needed); add `tsc --build` as a CI gate alongside lint + tests (`--build` follows the root's `references` to also check `packages/svgcanvas` workspace, which a bare `tsc --noEmit` skips).
- Drop `vite-plugin-istanbul` + remove the coverage scaffolding in `tests/e2e/fixtures.js` and `scripts/copy-static.mjs` (todo #8 — confirmed user choice during audit Area I; bundled here to avoid touching `vite.config` twice).

### Out of scope (deferred to follow-up PRs after Step 3 lands)
- Test conversion (`tests/unit/`, `tests/e2e/`) — separate follow-up PR.
- File splits: `EditorStartup.js init()`, `Editor.js` trifurcation (Editor + EditorShortcuts + EditorLoaders), `TopPanel.js` per-element-type split, `LeftPanel.js` dispatch table, `recalculate.js` per-element split.
- `path.js:77 export let path = null` mutable-export refactor → typed as `Path | null` in this PR; refactor to getter/setter or class-instance is a follow-up.
- `SelectModule` singleton refactor → typed as-is; refactor follow-up.
- `convertToPath` cleanup, `seZoom.js` inverted-guard refactor, `ColorValuePicker.js`/`Slider.js` modernization.
- elix→Lit migration (#3, dedicated brainstorm later).

### Already done by Step 1 + Step 1.5 + Step 2 (not this PR's job)
- All pre-migration deletions (`browser-not-supported.*`, `ext-helloworld/`, dead `window.widget`, IE6 `jQuery.jPicker`, Opera `path-actions` blocks, MathML allowlist, Optimistik `oi:`, commented-out namespaces, brand/URL updates).
- `Editor.js:439-456 getParents` verify-then-delete (succeeded; deleted in Step 1).
- `path.js:633-786 convertPath` verify-then-delete was **ABORTED** in Step 1 (audit doc corrected via commit `a63fc744`; inline comment now at `path.js:630-643` explains why). `convertPath` still exists at `path.js:644`; APIs are incompatible with `path-actions.js:54` version. Consolidation is a real refactor, deferred. Step 3 types it as-is.
- Step 1.5 dropped four browser-compat workarounds confirmed obsolete by regression tests: `select.js:423` + `svg-exec.js:1269` `isWebkit()` Chrome-7 (plus `isWebkit` getter + export removed); `svg-exec.js:503-512` + `:712-722` Firefox bug 353575.
- Pathseg drop: **10** `createSVGPathSeg*` refactors (`path-actions.js` × 8 + `path-method.js` × 2; the audit's "8 sites" count was wrong — caught via manual smoke). `pathseg` runtime dep removed; `path-data-polyfill` (SVG 2 spec polyfill) is the replacement in BOTH prod (`svgcanvas.js` import) and test env.

---

## 3. TypeScript configuration

Two `tsconfig.json` files — root for the editor + scripts, package one for the canvas core (workspace).

```jsonc
// tsconfig.json (root — covers src/editor/ and scripts/)
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2025",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "lib": ["ES2025", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest"],
    "paths": {
      "@svgedit/svgcanvas": ["./packages/svgcanvas/svgcanvas.ts"],
      "@svgedit/svgcanvas/*": ["./packages/svgcanvas/*"]
    }
  },
  "include": ["src/editor/**/*.ts", "scripts/**/*.ts", "*.config.ts"],
  "references": [{ "path": "./packages/svgcanvas" }]
}
```

```jsonc
// packages/svgcanvas/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "isolatedDeclarations": true,
    "outDir": "./dist",
    "rootDir": "./",
    "noEmit": false
  },
  "include": ["**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

### Key choices

- **`strict: true`** — day-one full strict (`noImplicitAny` + `strictNullChecks` + `strictFunctionTypes` + `strictBindCallApply` + `strictPropertyInitialization` + `noImplicitThis` + `alwaysStrict` + `useUnknownInCatchVariables`). Justification: the audit found 11 latent bugs that mostly fit the shape full strict catches (null misuse, implicit-any in callbacks). Ratcheting later means deferring that bug-catch.
- **`noEmit: true` at root** — Vite handles bundling; `tsc` is purely a type-check gate. Build speed stays high.
- **`composite: true` + `references` for the workspace package** — gives proper project-references behavior so `tsc --build` is incremental and cross-package types resolve correctly.
- **`verbatimModuleSyntax: true`** — forces every type-only import to be `import type { Foo }`. Catches accidental runtime imports of types and prevents subtle bundler-side issues with re-exports.
- **`isolatedModules: true`** — every file can be transpiled standalone (Vite/esbuild compatible).
- **`moduleResolution: "bundler"`** — Node-resolution behavior tuned for bundlers. Avoids the `.js`-extension-in-imports issue.
- **`paths`** — preserves the `@svgedit/svgcanvas` import alias the editor uses today; saves converting every consumer to relative paths.
- **`noUnusedLocals` + `noUnusedParameters`** — extra catch beyond `strict`. Surfaces dead args during conversion.
- **`noUncheckedSideEffectImports: true`** — TS 6 default; explicit documents the choice. Catches `import 'missing-module'` side-effect imports that don't resolve.
- **`noUncheckedIndexedAccess: true`** — forces `array[i]` to be typed as `T | undefined`. Aligns with the audit's flagged bugs (rotated-bbox cross-browser at `utilities.js:941-942`, `getStrokedBBox` min/max asymmetry at `utilities.js:1126-1129`, `pathSegList`-style direct-index access throughout `path-actions.ts`). Will add narrowing requirements to Task-5+ conversions; pays for itself in latent-bug catch.
- **`exactOptionalPropertyTypes: true`** — distinguishes `{ foo?: string }` from `{ foo: string \| undefined }`. The audit's confirmed bugs around `Config` shape mismatches benefit. Stricter than `strict`; expect to surface real callsite discipline gaps during Tasks 11–15 (`ConfigObj.ts`, `Editor.ts`, panel files).
- **Workspace `isolatedDeclarations: true`** — library workspace (`packages/svgcanvas/`) emits `.d.ts` via `declaration: true`; this flag forces every exported function/method to have an explicit return type so each file's declarations can be produced independently. Parallelizes well + becomes critical when TS 7's Go-ported compiler ships (~10x speedup) since `isolatedDeclarations` is one of the gates for it.

### Wire-methods declaration approach

Existing `packages/svgcanvas/svgcanvas.d.ts` (the hand-written 226-line shim) gets replaced by:

1. A `SvgCanvas` class (or interface) declared in `packages/svgcanvas/svgcanvas.ts` covering the methods/fields the class actually owns.
2. A new `packages/svgcanvas/svgcanvas.augment.d.ts` using module augmentation to declare every method wired on by `core/*.ts init()` calls.

Why central augment file vs per-module declarations: option (a) (`.d.ts` augmentation) won the wire-methods decision in brainstorming Q2. Single place to look, one file to keep in sync, no `declare module` block in every `core/*.ts` file. Drift is caught by usage failing to compile.

---

## 4. Migration approach — commit cadence + ordering

**Branch:** `feat/ts-migration` (cut from `master` after Step 1 cleanup + Step 2 pathseg PRs land).

**Cadence:** Bottom-up by dependency, area-by-area matching audit's A→J. **18 commits total** (4 scaffolding + 12 conversion + 1 rename + 1 cleanup):

```
C0   chore(ts): add tsconfig.json + packages/svgcanvas/tsconfig.json (strict)
C1   chore(lint): swap standard for eslint v9 + typescript-eslint
C2   chore(ts): replace svgcanvas.d.ts shim with svgcanvas.augment.d.ts
C3   chore(scripts): drop vite-plugin-istanbul + e2e fixtures coverage scaffolding

C4   refactor(svgcanvas/common): convert common/ to TS                            [3 files]

# C5 split upfront for reviewability — core/ has 31 files; one commit too large.
C5a  refactor(svgcanvas/core): convert utility leaves (no inter-core deps)        [8 files: namespaces, math, json, dataStorage, units, touch, utilities, coords]
C5b  refactor(svgcanvas/core): convert history + drawing layer                    [8 files: sanitize, history, historyrecording, undo, layer, draw, clear, copy-elem]
C5c  refactor(svgcanvas/core): convert elem ops + select                          [8 files: elem-get-set, paste-elem, paint, blur-event, text-actions, select, selected-elem, selection]
C5d  refactor(svgcanvas/core): convert event + path + compose                     [7 files: event, path, path-actions, path-method, recalculate, svg-exec, svgroot]

C6   refactor(svgcanvas): convert top-level svgcanvas.ts barrel                   [1 file]
C7   refactor(editor): convert top-level src/editor/ + locale/ to TS              [9 files post-Step-1: 8 top-level (ConfigObj, EditorStartup, MainMenu, Rulers, contextmenu, typedefs, locale, Editor) + 1 locale/lang.en.js]
C8   refactor(editor/components): convert components/ to TS                       [23 files]
C9   refactor(editor/dialogs): convert dialogs/ to TS                             [15 files]
C10  refactor(editor/extensions): convert extensions/ to TS                       [11 extensions post-Step-1: ~23 files including each ext's main + locale/en.js]
C11  refactor(editor/panels): convert panels/ to TS                               [4 files]
C12  refactor(scripts): convert scripts/ to TS                                    [3 .mjs files: build-extensions, copy-static, run-e2e]

C13  refactor: mechanical naming-consistency renames (TS-aware)
C14  chore: remove dead svgcanvas.d.ts shim; final verification
```

### Why this cadence

- **Bottom-up by dependency.** `common/` is leaf (nothing in canvas depends on it but it depends on nothing). `core/` builds on `common/`. Editor builds on canvas. Each area has full upstream type info available when converted.
- **Bisectable.** `git bisect` lands on one area-conversion commit (~3-23 files) instead of one giant commit.
- **Reviewable.** Each commit is reviewable in ~15 min. C5 split into C5a-d upfront so no sub-commit exceeds ~10 files.
- **Audit-section parity.** Maps 1:1 to audit doc areas, so the audit doc is a literal review checklist for each commit.
- **Renames last (C13).** TS rename uses type info (works on identifier references only, not strings) — safer than text-based search-and-replace.

### Per-file conversion playbook (uniform across all conversion commits)

For each `.js` → `.ts`:

1. Rename file extension `.js` → `.ts`.
2. Run `tsc --noEmit` against just that file via `npx tsc --noEmit path/to/file.ts`. Capture errors.
3. Resolve errors top-down:
   - Add type annotations to function parameters where `noImplicitAny` complains.
   - Add return types where the inference is non-obvious.
   - Resolve `null`/`undefined` narrowing where `strictNullChecks` complains (real bug-catch surface — the audit's bugs land here).
   - Resolve `unknown` in catch where `useUnknownInCatchVariables` complains.
   - For wired-on `svgCanvas` methods, ensure the method appears in `svgcanvas.augment.d.ts`.
4. For genuinely-untyped third-party shapes (jamilih return values, etc.) — use a local `interface` declaration. Never `any` unless flagged with `// eslint-disable-next-line` and a comment explaining why.
5. Run `npm test` (vitest + e2e). All 565 vitest + 81 e2e must pass before the file is considered done.
6. Commit individual files OR batch within the area's commit (depends on file size/complexity).

### Things explicitly NOT done during conversion (stay focused)

- No file splits.
- No structural refactors.
- No "while I'm here, let me clean up this function" — that's how PRs grow uncontrollably.
- No introducing new dependencies.
- No rewording comments unless TS literally requires it.
- No fixing bugs (those go in #10 follow-up PR — typing the buggy line as-is shows the bug as a TS warning OR captures the buggy behavior in the type, which is documentation).

### Estimated PR size

- ~112 files renamed (post-Step-1 production count)
- ~3,500–6,000 lines of type annotations added (estimate: 112 files × avg ~30–50 lines of additions per file for function param types, return types, interface declarations, augment-file entries)
- ~50 lines of dead-code suppression deliberately not fixed here
- Net: large but uniform PR. Each commit reviewable in ~15 min.

---

## 5. Verification gates

Three checkpoints: per-file (developer loop), per-area-commit (must pass before commit lands), PR-merge (full bar).

### Per-file (developer loop, not gated by CI)

- File compiles under `tsc --noEmit` with no errors.
- File passes lint with no warnings (`npx eslint path/to/file.ts`).
- No `any` introduced (audited by visual review during conversion).
- Wired-on methods used by the file are declared in `svgcanvas.augment.d.ts`.

### Per-area-commit (must pass before commit lands)

- `npx tsc --build` (root + `packages/svgcanvas` workspace via project references) — clean. `npx tsc --noEmit` alone is INSUFFICIENT: it only type-checks files matched by the root tsconfig's `include`, which excludes `packages/svgcanvas/**/*.ts`. Task 5 verification missed real `isolatedDeclarations` errors in `packages/svgcanvas/common/` until `tsc --build` was run.
- `npm run lint` — clean.
- `npx vitest run` — all pass; counts shouldn't change vs. branch-cut baseline (master HEAD baseline 2026-05-18: 564/564; re-measured at branch cut per plan Task 5 Step 1 and pinned into this section then).
- `npm run build` — both `packages/svgcanvas` build and root build complete; produces `dist/editor/` artifacts.
- `node scripts/run-e2e.mjs` — **all Playwright tests pass after every conversion commit** on Chromium + Firefox (master HEAD baseline 2026-05-18: 192 = 96 per browser; re-measured at branch cut). No manual smoke between commits — manual testing is reserved for post-migration validation.

### PR-merge gate (full bar before merging to master)

| Gate | Tool | Pass criterion |
|---|---|---|
| Type-check | `tsc --build` | Zero errors across root + workspace. Zero `any`-suppressions added vs. master baseline (count + diff). |
| Lint | `eslint .` | Zero errors, zero warnings. `--max-warnings 0`. |
| Unit tests | `vitest run` | All pass (master HEAD 2026-05-18 baseline: 564). Zero counts change vs. branch-cut baseline. |
| E2e tests | `node scripts/run-e2e.mjs` | All pass on Chromium + Firefox (master HEAD 2026-05-18 baseline: 192 = 96 per browser). |
| Build | `npm run build` | `dist/editor/` produced; file count and approximate sizes match master baseline ±5%. |
| `.d.ts` emission | `tsc --build packages/svgcanvas` | `packages/svgcanvas/dist/svgcanvas.d.ts` produced; covers the `SvgCanvas` interface fully. |
| Bundle smoke | Manual | Built `dist/` loads in Chrome 130, Firefox 135, Edge 130; default extensions all init; can draw rect, save SVG, reload, modify, save again. |
| `git log` review | Manual | 18 commits in cadence-defined order; no fixup/squash commits. Clean history. |
| `git diff master` review | Manual | Visual sweep of `package.json`, `package-lock.json`, `tsconfig*.json`, `eslint.config.js`, `svgcanvas.augment.d.ts`. No surprise dependency additions. |

### Regression-watch list (highest-risk conversion sites)

These are the conversion sites where TS's strict mode is most likely to surface real behavior changes (not just type errors). Watched especially carefully during conversion + e2e:

| Site | Why it's risky |
|---|---|
| `path.js:77 export let path = null` | Mutable export typed as `Path \| null` → consumers get null-narrowing requirements; first-pass typing might miss a callsite where `path` is dereferenced without check. |
| `path.js:644 export const convertPath` | Verify-then-delete ABORTED in Step 1; STILL EXISTS and uses `pathSegList` via `PathDataListShim`. Type `pathSegList: PathDataListShim` and `seg.pathSegType: number`, `seg.x`/`x1`/`x2`/`y`/`y1`/`y2: number \| undefined`. Likely re-uses `PathDataListShim` interface from `path-method.ts`. |
| `core/svg-exec.js` — `uniquifyElems` (1112, 1117), `convertGradients` (1278), `setUseData` (516) | Audit flagged real correctness gaps. Strict typing here will surface implicit-any issues in callbacks. (The Firefox bug 353575 + isWebkit workarounds previously here were dropped in Step 1.5; check current line numbers before typing.) |
| `core/path-actions.js` — `convertPath` (54) + method form at `1242` | Heavy use of `pathSegList` shim. Type interactions between `PathDataListShim` and `SVGPathElement.pathSegList` need clean interface. (Step 1 already dropped the `:887-899` Opera-bug commented block + `:1167-1170` `if (window.opera)` branch.) |
| `core/event.js` — `<a>` parent walk (951), browser-bug branches (957, 986) | Heavy event handling; lots of implicit `any` on event params today. |
| `core/recalculate.js` (~700 lines `recalculateDimensions`) | Single huge function; type-check pass will surface dozens of inference issues. Defer the file split (per Section 2) but type the existing structure carefully. |
| `core/select.js` `SelectModule` singleton | Singleton pattern + module mutation; type as-is per Section 2, but the `init()` pattern needs careful augment-file entry. |
| `src/editor/EditorStartup.js` `init()` (~590 lines) | Single huge function; same risk as recalculate.js. |
| `src/editor/Editor.js` (1393 lines) | Large class; lots of method bindings; some dynamic property access. |
| `core/event.js` `getrootSctm` callsites | Heavy use; mechanical rename in C13 must not miss a string-key access. |
| Extension `init()` patterns (12 extensions) | Each extension has a different `init()` shape. Type the `module:SVGEditor` parameter consistently across all 12. |

---

## 6. Risks, rollback, and follow-on work

### Top risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `tsc` finds dozens of latent null-misuse bugs that fixing requires real behavior decisions, not type changes | High | Stalls migration | Per Section 4: type the buggy line as-is (preserve behavior); log new finds to todo #10 correctness backlog; fix in dedicated PR after migration. Strict line: "no behavior changes in this PR." |
| Mechanical rename (C13) catches a string-key access that wasn't a real callsite — false-positive rename | Medium | Subtle runtime breakage | TS rename uses type info (works on identifier references only, not strings). Verify by `grep -r "controllPoint"` after the rename to confirm zero occurrences remain anywhere except renamed identifiers. |
| `svgcanvas.augment.d.ts` falls out of sync with what `core/*.ts init()` actually wires on | Medium | TS errors at consumer sites; runtime is fine | Caught immediately by usage failing to compile. Fix is to add the missing entry to the augment file. Quarterly review of augment file vs. actual `init()` content as part of post-migration hygiene. |
| `verbatimModuleSyntax` rejects existing import patterns Vite/Vitest depend on | Low | Build/test breakage | Settle this in C0 — convert all imports to `import type { ... }` for types from day one. If a specific bundler issue surfaces, fall back to dropping `verbatimModuleSyntax` (but try to preserve it). |
| `composite: true` + project references introduce a build-order issue that breaks `vite dev` | Low | Dev loop breaks | Vite handles `.ts` directly via esbuild and ignores tsc project references. If tsc-watch and vite-dev disagree on declaration emission, prefer Vite's reality (it's what ships). |
| Eslint v9 flat config + typescript-eslint v8 + Vite ecosystem peer-dep churn | Medium | One-day yak shave at C1 | C1 is the right time to absorb this. If a peer-dep mismatch surfaces, document and pin in `package.json`. |

### Rollback plan

Step 3 lands as a single PR with 18 ordered commits on `feat/ts-migration`:

- **Pre-merge rollback** (anytime before merge): `git checkout master && git branch -D feat/ts-migration`. Zero impact on master.
- **Post-merge rollback** (within 7 days of merge, if a real regression surfaces): `git revert -m 1 <merge-commit-sha>`. Recovers master fully. Lose ~4 days of work but no surprise — regression itself was the surprise.
- **Partial rollback** (if a single area-commit regresses): `git revert <area-commit-sha>` reverts just that area. The rest of the migration stays. Remediate that area in a follow-up commit; re-land.
- **Worst-case escape hatch**: tag `pre-ts-migration` placed at master HEAD before the merge. Walk-back is one tag-recovery away.

### Follow-on PRs queued (in order, post-migration)

1. **Tests → TS** — convert `tests/unit/*.test.js` and `tests/e2e/*.spec.js` to `.ts`; pick up typed `SvgCanvas`. Approximately 76 test files (all of `tests/`).
2. **Correctness backlog (todo #10)** — fix the 11 confirmed bugs + 16 correctness gaps from audit. TS migration may have surfaced more; consolidate into one PR or split by area.
3. **Architectural refactors (todo #2 deferred items)** — separate PRs for: EditorStartup `init()` split, Editor.js trifurcation, TopPanel.js per-element-type split, LeftPanel.js dispatch table, recalculate.js per-element split, `path.js` mutable-export refactor, `SelectModule` singleton refactor, `seZoom.js` inverted-guard, `convertToPath` cleanup. Bundle small ones (~3-4 PRs total).
4. **#3 elix→Lit** — separate brainstorm + design + plan. The TS migration unblocks this by giving Lit-rewritten components proper types from day one.
5. **#6 dep upgrade tail** — `jspdf` 4.0.0→4.2.1, `@rollup/rollup-linux-x64-gnu` 4.55.1→4.60.2, verify `svg2pdf.js` + `browser-fs-access` are current. (Pathseg drop already shipped in Step 2; this is the leftover dep-bump pass.)

### What this PR explicitly does NOT enable

- Public API stability for the embed surface (#4 work).
- Lit/web-component rewrites (#3 work).
- File-split refactors (deferred items above).
- Bug fixes (todo #10).
- Test type-checking (deferred to follow-on PR 1).

---

## Headline

This PR is **"~112 .js → .ts under strict, plus mechanical renames, with no behavior changes."** Smaller and more boring than the original "big-bang TS + elix→Lit + pathseg" framing — but boring is the point. Reviewable, bisectable, revertible, and unblocks all the higher-value follow-on work.
