# svgedit Substrate — SWC for TS Transform

## Status

- **2026-05-21:** Designed via `superpowers:brainstorming` session. Implementation pending — next step: implementation plan via `superpowers:writing-plans`.
- Probe validated end-to-end at `%TEMP%/svgedit-swc-probe` worktree (no commits): tsc 0 / lint 0e/140w / vitest 637/637 / `npm run build` succeeds / Vite dev serves SWC-compiled output / `<se-text>` and `<se-input>` Lit components render in Chrome with `:host([id="layersLabel"])` CSS firing correctly.

## Context

svgedit's TS substrate has three transformers each handling decorators differently:

| Tool | Role | TC39 standard decorators | `accessor` keyword |
|---|---|---|---|
| **tsc** (TypeScript 6.x) | type-check only (`noEmit: true`) | ✅ full | ✅ full |
| **esbuild** (via Vite dev) | `.ts` → JS on every dev-server request | ⚠️ partial / passes-through | ⚠️ passes-through |
| **Rollup** (via Vite build) | bundling for `npm run build` | ❌ parser hard-rejects | ❌ rejects |

tsc accepts both decorator styles cleanly. esbuild's TC39 decorator handling is incomplete — instead of compiling `@property() accessor x = ''` down to ES2022 helper calls, it passes the raw syntax through, leaving the browser to parse it. Rollup's parser (acorn fork inside Vite 7) does not recognize the `accessor` keyword at all and rejects the file with `Unexpected token`.

This blocks the elix → Lit migration (todo #3) from using TC39 standard decorators with Lit 3, which is the path the user has chosen for staying in "modern TS, no legacy constructs." Without a fix to this substrate, the only alternative is reverting to legacy decorators (`experimentalDecorators: true` + `useDefineForClassFields: false`), which contradicts the user's stated direction.

## Goals

1. **Replace the TS-transform layer of Vite's pipeline with SWC.** SWC (Rust-based, ships with mature stage-3 decorator support since 2023) handles both the `@customElement` class-level decorator and the `@property() accessor` field-level decorator. Its emitted output is plain ES2022 with a small runtime helper (`applyDecs2203RFactory`) — no decorator syntax escapes to the browser.
2. **Preserve all existing baselines unchanged.** Substrate-PR is non-feature-changing. tsc, lint, vitest, npm run build, and e2e all match master's current numbers.
3. **Unblock TC39 standard decorators going forward.** All future Lit-component conversions (PR-1, PR-2, PR-3, PR-4, PR-5 of the elix → Lit migration) compile cleanly through the new pipeline.

## Non-goals (substrate-PR scope)

- **No Lit migration code.** seText / seInput / conventions doc / contract tests are all in PR-1 of the elix → Lit migration, NOT this substrate-PR.
- **No tsconfig.json target change.** `target: "ES2025"` stays. SWC's tsconfig reader doesn't recognize ES2025 but the `tsconfigFile: false` flag makes it ignore tsconfig and use only the inline plugin options. tsc continues type-checking against ES2025 unchanged.
- **No README / CONTRIBUTING / docs/ rewrite.** Substrate is internal tooling; documenting it in CHANGELOG + this spec is sufficient.
- **No forward-looking smoke test.** The probe end-to-end (real Lit components in real Chrome) already validated SWC's decorator handling. A paired unit test in the substrate-PR would be ceremonial churn (per [[no-unnecessary-work]]). PR-1's seInput contract test provides the durable cross-suite signal once it lands.
- **No new ESLint configuration.** The existing `@typescript-eslint/*` rules already work with SWC-transpiled output; no rule changes needed.
- **No bundle-size mandate.** SWC's helper adds ~280 LOC of runtime; unlikely material, not measured.
- **No conventions-doc edits.** The Lit conventions doc lives in PR-1 of the elix → Lit migration; this PR predates it.

## Architecture

### Pipeline overview

**Before (master at `7fe35d84`):**

```
.ts source
  ├── tsc (type-check only, noEmit:true) ──→ ✅ type errors caught
  ├── esbuild (Vite dev transform)        ──→ ⚠️ raw decorators in served JS
  └── Rollup (Vite build parser)          ──→ ❌ rejects `accessor` keyword
```

**After (substrate-PR):**

```
.ts source
  ├── tsc (type-check only, noEmit:true)  ──→ ✅ type errors caught (unchanged)
  ├── SWC (via unplugin-swc, Vite dev)    ──→ ✅ ES2022 helper-function calls
  └── SWC (via unplugin-swc, Vite build)  ──→ ✅ ES2022 helper-function calls
                                          ──→ Rollup then bundles plain ES2022
```

The `unplugin-swc` package wraps SWC for the Vite ecosystem. It intercepts `.ts` files at the highest priority (registered first in the plugins array) and emits ES2022 JS, transparent to both Vite's dev-server pipeline and Rollup's build pipeline. esbuild remains in the loop for non-TS asset handling and dep-pre-bundling — only the TS-source-transform step changes.

### Dependency choice

- `unplugin-swc@^1.5` — universal SWC plugin (works for Vite/Rollup/Webpack via shared core). Version 1.5.9 verified compatible with Vite 7.3.3 in the probe.
- `@swc/core@^1.15` — the underlying Rust binary + JS bindings. Pulled in as a peer/direct dep of unplugin-swc. Version 1.15.33 verified working in the probe.

Both as `devDependencies` (build-time only; nothing ships to production runtime).

### Configuration

Inline in `vite.config.mjs`. No external `.swcrc` (single source of truth, simpler, proven in probe).

```js
import swc from 'unplugin-swc'

// ...existing imports unchanged...

plugins: [
  swc.vite({
    tsconfigFile: false,
    jsc: {
      parser: { syntax: 'typescript', decorators: true },
      transform: { decoratorVersion: '2022-03' },
      target: 'es2022',
      keepClassNames: true
    },
    sourceMaps: true
  }),
  // ...existing svgedit plugins unchanged (htmlStringPlugin, dynamicImportVars, etc.)...
]
```

Field-by-field:

| Field | Value | Why |
|---|---|---|
| `tsconfigFile` | `false` | SWC's tsconfig reader doesn't recognize `target: "ES2025"`. Disabling tsconfig auto-read forces SWC to use only the inline options. tsc continues to use the project's tsconfig.json unchanged. |
| `jsc.parser.syntax` | `'typescript'` | Required to parse `.ts` syntax (vs `'ecmascript'` for `.js`). |
| `jsc.parser.decorators` | `true` | Enables decorator syntax parsing. |
| `jsc.transform.decoratorVersion` | `'2022-03'` | Selects TC39 stage-3 standard decorators (vs `'2021-12'` legacy). The `'2022-03'` version is the spec we target. |
| `jsc.target` | `'es2022'` | Output JS targets ES2022. Matches the project's runtime browser baseline; modern enough to skip transpilation of class fields, top-level await, etc. |
| `jsc.keepClassNames` | `true` | Preserves `Class.name` at runtime — Lit's `@customElement` registry uses it for debug output. |
| `sourceMaps` | `true` | SWC emits source maps so dev-tools shows TS source. |

### Plugin order

`swc.vite()` is registered **first** in the `plugins` array. unplugin-swc handles the TS-file interception at the highest priority; existing svgedit-specific plugins (`htmlStringPlugin`, `dynamicImportVars`, the build-html-skip plugin) come after and operate on non-TS asset paths.

### Files modified by this PR

- `package.json` — adds `"unplugin-swc": "^1.5.0"` + `"@swc/core": "^1.15.0"` under `devDependencies`
- `package-lock.json` — auto-regenerated
- `vite.config.mjs` — adds `import swc from 'unplugin-swc'` + the plugin registration
- `CHANGELOG.md` — `[Unreleased]` entry

No source files modified. No tests modified. No tsconfig modified. No HTML files modified.

## Validation gate

Each gate must match master's baseline exactly. Substrate-PR is a no-regression change.

| Gate | Command | Expected |
|---|---|---|
| Type check | `npx tsc --build --force` | 0 errors |
| Lint | `npm run lint` | 0 errors / ≤145 warnings |
| Unit tests | `npx vitest run` | 637 passed (no change from master) |
| Build | `npm run build` | success — 25 modules transformed, 11 extensions bundled (matches master's count) |
| E2E | `npx tsx scripts/run-e2e.ts` | 250 passed across chromium + firefox |
| CI (post-push) | `build-and-test` + `Analyze (javascript-typescript)` + `Analyze (actions)` + `Scorecard analysis` | all green |

Manual sanity smoke (optional): start `npm start`, navigate browser to `http://localhost:8000/src/editor/index.html`, confirm editor renders identically to master.

## PR shape + sequencing

**Standalone PR.**

Title: `feat(substrate): SWC for TS transform (enables TC39 decorators + auto-accessor)`
Branch: `feat/swc-substrate` (created from master, contains spec + plan + implementation commits)
Merge method: `gh pr merge --squash --delete-branch` per the signed-repo squash SOP.

After substrate-PR merges to master:

1. **Probe cleanup:** `git worktree remove "C:/Users/jscha/AppData/Local/Temp/svgedit-swc-probe"`
2. **PR-1 rebase:** existing `feat/pr-1-lit-infra-and-references` branch (8 commits ahead of master at the time of writing) rebases onto new master. Expected conflict: `package.json` (substrate-PR adds devDeps; PR-1's lit-install commit adds a runtime dep — small mechanical text resolution). Other 7 commits should replay cleanly.
3. **PR-1 plan touch-up:** add a one-line Pre-flight item to the existing PR-1 plan doc: "Confirm SWC substrate is on master via `git log --oneline -5 master | grep substrate`." The rest of PR-1 proceeds as written.
4. **PR-1 execution resumes** at Task 5 (Vite HMR substrate smoke), which is no longer blocked.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | unplugin-swc + Vite 7.3.3 version drift in CI vs local | CI installs from lockfile; lockfile pinned at PR creation time |
| 2 | SWC emit differs subtly from esbuild for non-decorator code (e.g., class fields, top-level await) | Full vitest 637/637 + npm run build + e2e 250/250 validates no behavior change |
| 3 | `tsconfigFile: false` masks future tsconfig changes from SWC | Documented in spec; future ES2025 → ES2024 downgrade decision can revisit |
| 4 | SWC's runtime helper (`applyDecs2203RFactory`, ~280 LOC) adds bundle weight | Probe build produced 25 modules transformed + 11 extensions bundled (matches master's count). Helper is shared across all decorated files via Rollup's chunking, so the absolute cost is fixed-once not per-component. Specific size delta not measured; flagged for post-merge spot-check if it becomes a concern. |
| 5 | Future SWC version with breaking changes to `decoratorVersion: '2022-03'` API | Pin `@swc/core` at `^1.15` minor; bump deliberately when needed |

## Test plan

Substrate-PR has no new tests (per non-goals). The validation gate above IS the test plan — each command must match baseline.

PR-1 (separate, follow-on) brings the seInput contract test plus implicit coverage from converting actual Lit components.

## Open questions resolved at brainstorm

| Q | A |
|---|---|
| Bundle SWC into PR-1, or separate PR? | Separate PR (`feat/swc-substrate`). Discoverable record for future PR-2/PR-3/PR-4/PR-5 readers; cleaner history. |
| Inline config vs external `.swcrc`? | Inline in `vite.config.mjs` only. Probe confirmed inline is required for the build path; external `.swcrc` redundancy adds maintenance without benefit. |
| tsconfig target change to silence warnings? | No. Keep `target: "ES2025"`. The `tsconfigFile: false` flag is the workaround. esbuild's cosmetic "Unrecognized target environment ES2025" warning remains; doesn't block anything. |
| Forward-looking smoke test in substrate-PR? | No. Probe + PR-1's seInput contract test cover this; manufacturing extra tests violates [[no-unnecessary-work]]. |

## References

- **Probe results:** `%TEMP%/svgedit-swc-probe` (not committed; discarded after substrate-PR merges)
- **Migration spec:** `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md` (PR #17 / `83e70977`)
- **PR-1 plan:** `docs/superpowers/plans/2026-05-21-svgedit-elix-to-lit-pr-1-plan.md` (PR #18 / `7fe35d84`) — touched up post-merge of this substrate-PR
- **CLAUDE.md / Local-Dependencies-Only:** SWC's `@swc/core` Rust binary is bundled inside `node_modules/@swc/core-{platform}-{arch}` per the architecture — it's a node_modules-resident dep, not a system-PATH lookup. Complies with Local-Deps-Only by construction.
- **Lit 3 standard decorators docs:** https://lit.dev/docs/components/properties/#standard-decorators
- **SWC decoratorVersion spec:** https://swc.rs/docs/configuration/compilation#jsctransformdecoratorversion
- **unplugin-swc:** https://github.com/unplugin/unplugin-swc
