# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (brand sweep 2026-05-16)
- `chore(brand): sweep remaining "SVG-Edit"/"SVG Edit" → "svgedit"` — Step 1's brand pass caught the MainMenu label + URLs + `clear.js` generator string. Manual cross-browser smoke against Step 1.5 surfaced the storage preferences dialog still using the old name. Single-commit follow-up sweep across 16 active sites:
  - **4 user-visible strings:** storage prefs dialog body (2 occurrences in `ext-storage/locale/en.js` + duplicate in `locale/lang.en.js` `editorPreferencesMsg`), Help-menu homepage label (`editor_homepage`), storage dialog `aria-label`.
  - **11 code / JSDoc comments:** triplicate `// only track keyboard shortcuts for the body containing the SVG-Editor` (`Editor.js`, `seButton.js`, `seMenuItem.js`); extension header comments (`ext-storage.js`, `ext-panning.js`); JSDoc in `ConfigObj.js` + `svgcanvas.js`; `EditorStartup.js` opener-signal comment; `unit-harness.html` `<title>`.
  - **`svg-exec.js:78` reworded** (not just renamed): `// Keep SVG-Edit comment on top` → `// Keep generator comment on top`. The literal generator string in `clear.js:51` is "svgedit" since Step 1; the comment was identifying which comment-text to hoist on save — now tracks current behavior.
  - **Out of scope:** 10 `src/editor/images/*.svg` XML attribution comments (defensible historical attribution; tracked under `todo_svgedit.md` #10).
  - Verified: lint clean, vitest 564/564 unchanged, e2e 178 passed + 2 skipped on both browsers, build clean. No code logic touched.

### Changed (browser-compat investigation 2026-05-16)
- `feat(test): browser-compat investigation (Step 1.5 of 5)` — Multi-browser Playwright setup + 4 regression tests verifying the 4 audit-flagged browser-bug workarounds; 5-commit PR (`feat/browser-compat-investigation`) on safety tag `pre-compat-investigation`.
  - **Multi-browser Playwright:** Added Firefox project to `playwright.config.mjs` alongside Chromium. By default all e2e tests run on both browsers (162 → 180 attempted runs after the new tests land). `scripts/run-e2e.mjs ensureBrowser()` extended to auto-install Firefox to the project-local cache via a new version-prefix-agnostic `isBrowserInstalled(prefix)` helper.
  - **Existing-test Firefox failures:** 4 surfaced when Firefox was first added. 2 fixed as test-infra quirks (`tests/e2e/unit/svgcore-touch.spec.js` — added `test.use({ hasTouch: true })` so Firefox desktop exposes `TouchEvent`/`Touch` constructors in `page.evaluate`). 2 marked `test.fixme(browserName === 'firefox', ...)` for a confirmed source bug: `packages/svgcanvas/core/coords.js` `getPathData()` branch skips uppercase `'Z'` segments because `pathMap` only contains lowercase `'z'`, leaving holes in `changes.d[]` that crash at coords.js:384. Chrome avoids it via the pathSegList polyfill (numeric segment types). Logged to `todo_svgedit.md` #10 as a follow-up correctness fix.
  - **4 new browser-compat tests** in `tests/e2e/browser-compat-*.spec.js` (9 tests total, all pass on both browsers WITH and WITHOUT the workarounds in place — that's the verification):
    - `canvasbg-overflow` (Site 1: `select.js:423` — Chrome 7 zoom-out overflow bug)
    - `gradient-detect` (Site 2: `svg-exec.js` `convertGradientsMethod` — WebKit `*Gradient` selector fallback)
    - `import-gradients` (Site 3: `svg-exec.js:503-512` — Firefox 353575 root-level gradients/patterns)
    - `import-symbol-gradients` (Site 4: `svg-exec.js:712-722` — Firefox 353575 inside `<symbol>`)
  - **Workaround outcomes (per site):**
    - Site 1: **DROPPED** — `overflow: 'visible'` hardcoded; 4/4 tests pass on Chromium + Firefox without the `isWebkit()` ternary.
    - Site 2: **DROPPED** — `querySelectorAll('linearGradient, radialGradient')` works directly on both browsers; the WebKit `*Gradient` tagName fallback is no longer needed.
    - Site 3: **DROPPED** — Firefox 353575 no longer reproduces; root-level gradients/patterns/radialGradients render correctly without being moved into `<defs>`.
    - Site 4: **DROPPED** — same as Site 3 for the symbol/use import path. Orphaned `const defs = findDefs()` local removed alongside the deleted block.
  - **`isWebkit()` in `packages/svgcanvas/common/browser.js`: DROPPED entirely** — getter + export both removed; grep confirms zero remaining consumers in active code. Dead `isWebkit` import dropped from `select.js`.
  - **`isGecko()` KEPT** — 3 unrelated consumers in `selected-elem.js` + `undo.js` (separate Firefox workarounds NOT in Step 1.5 scope). Dead `isGecko` import dropped from `svg-exec.js` (both 353575 sites in that file are now gone).
  - **Net source change:** -49 lines across `select.js`, `svg-exec.js`, `common/browser.js` (4 workaround drops + helper removal + orphan-local cleanup + import tidy).
  - Final e2e baseline: Chromium 90 + Firefox 88 passing + 2 fixme skipped = 180 attempted, 178 passed, 0 failed. Vitest 564/564 unchanged. Lint clean.

### Changed (pre-migration cleanup 2026-05-16)
- `chore: pre-migration cleanup (Step 1 of 5)` — Mechanical execution of `docs/AUDIT_2026-05-16.md` § "Pre-migration deletions" + § "Brand / attribution updates" + two verify-then-delete duplicate purges, plus three textual fixes folded from todo #10. 8 commits across one PR (`feat/pre-migration-cleanup`).
  - **Deletions:** `src/editor/browser-not-supported.{js,html}` (dead universal-SVG-support check); `src/editor/extensions/ext-helloworld/` extension (tutorial/demo, no product value); `window.widget` KaiOS/Apple-Dashboard branches in `ConfigObj.js` + `ext-storage.js`; IE6 detection + filters in `jQuery.jPicker.js`; commented-out jQuery effects in `jQuery.jPicker.js`; Opera-bug commented block + `if (window.opera)` branch in `path-actions.js`; MathML allowlist (31 entries) + Optimistik `oi:` namespace handling in `sanitize.js`; dead `XMLHttpRequest` in `seExplorerButton.js`; commented-out namespaces (SODIPODI/INKSCAPE/RDF/OSB/CC/DC) in `namespaces.js`.
  - **Brand updates:** SVG-creator comment URL in `clear.js`; `homePage` constant + main menu label in `MainMenu.js`; workspace `packages/svgcanvas/package.json` repository URLs + author + contributors (audit-of-audit follow-up — the earlier brand-update commits `cc52a542` + `9ffd9f5c` missed the workspace package.json; all → `bilbospocketses/svgedit`).
  - **Textual fixes (folded from todo #10):** `seExplorerButton.js:134` HTML syntax error (`class="image-lib""` → `class="image-lib"`); `seZoom.js:78` missing CSS semicolon (`position:fixed` → `position:fixed;`); `ext-connector.js:240` comment typo (`startss` → `starts`).
  - **Verify-then-delete duplicates:** `Editor.js:438-456 getParents` (dead — no external callers; deleted). `path.js:633-786 convertPath` deletion **ABORTED**: Step 1 execution discovered the audit's B4a "duplicate" finding was wrong. The two `convertPath` implementations have incompatible APIs (numeric `pathSegType` + `pathMap` vs. `pathSegTypeAsLetter` letter strings) and `tests/unit/path.test.js` imports BOTH for equivalence validation. Audit doc corrected; clarifying note added to `path.js` to prevent re-audit cycles.
  - **MathML support dropped** alongside the allowlist removal — `tests/unit/test1.test.js`'s "Test import math elements inside a foreignObject" test removed (asserts obsolete behavior). New vitest baseline: **564 passing** (was 565).
  - **Known follow-up dead code** (NOT in this PR; will be caught by Step 3 TS migration `noUnusedLocals` or a dedicated code-quality PR): `NS.MATH` in `packages/svgcanvas/core/namespaces.js` line 15, and `NS.MATH` usage in `packages/svgcanvas/core/selection.js:161`.
  - Verified: 564/564 vitest + 81/81 e2e + `standard` lint clean at every commit.

### Added (pre-migration audit 2026-05-16)
- `docs(audit): comprehensive pre-migration codebase audit` — Big-bang exhaustive walk through 102 files across 9 areas (canvas core, editor UI, web components, extensions, scripts, packages, tests, vendored libs, build/config). Per user directive: "no quick fixes, as thorough as we can be to make sure we get it all on the first run, regardless of how long that takes." Output `docs/AUDIT_2026-05-16.md` captures: per-area verdicts (99 KEEP / 2 DELETE / 1 REVIVE), 11 real bugs surfaced (cmenuDialog `screen.*` typo, three missing `super.attributeChangedCallback`, contextmenu `appendChild(string)`, Editor.js i18n typo, two LayersPanel UI bugs, two jQuery.jPicker jQuery-on-DOM misuses, seExplorerButton HTML syntax + dead XMLHttpRequest, seZoom stray CSS semicolon, ext-overview_window `evt.originalEvent`), migration architectural decisions (PathDataListShim already covers `pathSegList`; 8 `createSVGPathSeg*` direct calls in `path-actions.js` need refactor to `setPathData` before `pathseg` can be dropped; jgraduate stack disposition deferred to elix→Lit brainstorming; multi-unit mode dropped as out-of-scope; HTML-in-foreignObject promoted to new authoring feature; MathML/Optimistik dropped), embed-API design inputs (12 candidate surfaces), naming consistency cleanup list, full decisions log. 99 KEEP / 2 DELETE (`browser-not-supported`, `ext-helloworld`) / 1 REVIVE (`ext-overview_window`). Drives the JS→TS migration brainstorm (#2 in backlog) and the elix→Lit migration brainstorm (#3).

### Fixed (audit-of-audit corrections 2026-05-16)
- `docs(audit): re-audit corrections — fix counts, citations, framing` — Read-only verification pass on `docs/AUDIT_2026-05-16.md` against the actual codebase surfaced 12 issues, all resolved in this edit:
  - **Pathseg site count + enumeration** — audit text said "8 sites" but listed only 7 line numbers; actual is 8. Added missing site at `path-actions.js:1235` (inside the `fixEnd` block adjacent to the `// Can this be done better?` comment) to both audit doc and `todo_svgedit.md` #6.
  - **MathML allowlist count** — `sanitize.js:83-114`: corrected 28 → 31 entries (line range was right; count was wrong).
  - **`Editor.js:439-456 getParents` framing** — was characterized as a "name collision with `common/util.js:getParents`"; verified `Editor.js` does NOT import the util `getParents` (only `getParentsUntil`), so there's no lexical scope shadow. Reframed in todo as "verify-then-delete duplicate; likely dead code (no external `editor.getParents()` callers found)".
  - **Native `prompt()`/`alert()` site count** — claim of "8 sites" undercount. Actual: 9 sites in panels alone (TopPanel.js: 169, 623, 696; LayersPanel.js: 95, 103, 138, 146, 193, 201) plus `jQuery.jGraduate.js:195` and `ext-helloworld.js:77` (latter moot once extension is deleted). Updated audit doc + todo to enumerate sites explicitly.
  - **Off-by-one line citations corrected** in 6 places across audit + todo: `jQuery.jPicker.js:1296` → `:1292` (`.prev()` location); `seZoom.js:79` → `:78` (missing semicolon belongs at end of `position:fixed` line, not the next line); `svgcanvas.js:432` → `:433` (`canDeleteNodes` assignment, line 432 is the `// TODO: Correct this:` comment); `ext-connector.js:241` → `:240` (`startss` typo); `EditorStartup.js:682, 705, 741` → `:683, 706, 742` (the `console.error` calls; cited lines were the preceding `// Todo` comments).
  - **TopPanel.js panels-lookup investigation** — todo entry said "missing polyline/polygon"; updated to also note `path` is missing (likely intentional since path-edit is a separate mode, but verify).
  - **`super.attributeChangedCallback()` bug entry annotation** — added context that the same call is correctly commented-out in 4 sibling dialogs (`cmenuDialog.js:139`, `cmenuLayersDialog.js:77`, `storageDialog.js:105`, `exportDialog.js:76`); the fix for the 3 problem sites is to comment-out or delete the same way.
  - **Open decisions section added to audit's Decisions log** — captures decisions surfaced by the audit but deferred to brainstorming: TS strict-mode level, linter swap, wire-methods resolution, `path.js` mutable export, `SelectModule` singleton, jgraduate stack disposition, plus the two duplicate-code verify-then-delete items. Gives #2/#3 brainstorms a clean kickoff checklist.
  - **Pre-migration deletion ordering note** added to pathseg-drop step — `scripts/copy-static.mjs:22` shifts to line 20 if the `browser-not-supported` deletions land first; find by content not line number.
  - **Area G "Files" column note** — clarified that 12 reflects extension *units* (one per folder), not raw `.js` files (which is higher when locale shims, `dragmove/` subfolder, and `storageDialog.js` are counted individually). Total 102 sums consistently against this convention.
  - **Rulers.js cleanup citation** — full path `src/editor/Rulers.js` used in the cleanup checklist (file is at top-level `src/editor/`, not `src/editor/panels/`; preventing search confusion).
  - **EditorStartup.js extension-error embed-API input** — line numbers updated and clarified as the `console.error` lines (the preceding `// Todo` comments are at 682, 705, 741).
- No code changes. Documentation-only pass. Breadcrumb at top of `todo_svgedit.md` updated to reflect that re-audit is complete and #2 brainstorming is starting.

### Added
- `CHANGELOG.md` (this file).
- `_reference/embed-api-v6/` — preserved V6-era embed API source as design input for the upcoming V7+ embed API.

### Changed (audit follow-up 2026-04-30)
- `chore: post-housekeeping audit follow-ups` — Three flags surfaced by an outside-eyes audit pass:
  - `package.json` `repository.url`, `bugs.url`, and `homepage` updated from `SVG-Edit/svgedit` to `bilbospocketses/svgedit` so npm-derived "report bug" / "view repo" links land on the fork rather than upstream.
  - `.gitignore` adds `.claude` so per-repo Claude Code session settings don't show up as untracked.
  - `docs/` half-strip cleaned up: deleted `Accessibility.md` (upstream a11y test setup), `Acknowledgements.md` (overlaps with README credits and references deps already removed), `Contributing.md` (upstream commit-prefix conventions for upstream PR pipeline; fork takes no PRs), `Development.md` (upstream submodule + GH Pages deploy flow), `ReleaseInstructions.md` (referenced deleted `npm run version-bump` and `CHANGES.md`), and `docs/versions/{3,4,5,6}.0.0.md` (upstream historical version notes; fork started at v7.4.1). README repo-layout table updated to reflect surviving `docs/tutorials/`. `FrequentlyAskedQuestions.md` "How can I help?" Q&A removed (linked to deleted `Testing.md` + `ReleaseInstructions.md`).
- `chore(package): set author to fork owner; drop upstream contributors list` — `package.json` `author` updated from "Narendra Sisodiya" (upstream creator) to `Jamie Chapman <jamie@boxtechs.com>` (fork owner). `contributors` array dropped entirely — the README credits section already preserves upstream attribution; npm `contributors` is for active package contributors, not historical inheritance, and a personal fork accepting no PRs has none. Inherited multi-license string preserved unchanged.

### Changed (README)
- `docs(README): rewrite for fork — drop upstream branding` — Per scope directive §1. Replaced upstream README content (Netlify deploy links, npm publish flow, CodeQL/Snyk badges, `svg-edit.github.io` logo, "we want contributors" sections, Sample-React-extension instructions) with fork-appropriate content: status banner ("personal fork, no upstream tracking"), scope-directive bullet list, run commands, repo layout table, embedding-planned section pointing at `_reference/embed-api-v6/`, credits + inherited license note. Aimed at someone landing on this repo cold and needing to know "what is this fork doing differently and how do I run it."

### Changed
- Enforced LF line endings repo-wide via `.gitattributes` (commit `838716ea`).
- `.gitignore` rewritten — dropped dead entries (Cypress, react-extensions react-test path, NYC, instrumented, `ignore`), added `.vs/`.
- `package.json` slimmed: dropped `react-test` workspace, JSDoc generator pipeline, npm-publish scripts, remark markdown linter, `nyc`, `rimraf`, `open-cli`, `npm-run-all`.

### Removed
- `archive/` directory (V6 examples, old wiki content, screencasts, untested extensions). V6 embed-api preserved in `_reference/`.
- Upstream-deploy artifacts: `composer.json`, `netlify.toml`, `lgtm.yml`, `licenseInfo.json`, `CHANGES.md` (67KB upstream history), `publish.md`, root `FUNDING.yml`.
- `.github/` directory in full (FUNDING, ISSUE_TEMPLATE, pull_request_template, comment-template, workflows including codeql, npmpublish, on-push, on-PR). Will be re-added with our own CI when needed.
- `scripts/publish.mjs`, `scripts/version-bump.mjs` — no npm publishing for this fork.
- `packages/react-test/` — no React in this project.
- JSDoc generator pipeline (`docs/jsdoc-config.js`, `docs/layout.tmpl`, `jsdoc` devDep, `build-docs` / `open-docs` / `test-build` scripts). Public API will be documented via hand-written `EMBED_API.md`.
- `nyc.config.js` — orphaned after `nyc` devDep removal.

### Fixed
- `fix(scripts): rewrite scripts/run-e2e.mjs without nyc/rimraf` — housekeeping pass removed both deps but left them as live calls in the e2e runner. Replaced with native `node:fs/promises`; dropped vestigial `seedNycFromVitest` and `npx nyc report` steps; dropped `COVERAGE` env / `__coverage__` rebuild check (vitest's v8 coverage is the live coverage path). Also fixed pre-existing Windows incompatibility — `spawn('npx', …, { shell: false })` failed with `ENOENT` because `npx`/`npm` are `.cmd` shims; now `shell: process.platform === 'win32'`. Verified end-to-end: 81/81 e2e tests pass in 25.5s on Windows.

### Added (locale shim)
- `feat(locale): English-only — drop i18next, replace locale.js with native shim` — Per scope directive (§5: strip localization). New `src/editor/locale.js` (70 lines) provides a tiny `t(key, vars)` runtime supporting dotted keys (`'foo.bar'`), namespace lookups (`'ns:foo.bar'`), and `{{var}}` interpolation. Exposes an `i18next`-compatible facade with `.t()` and `.addResourceBundle()` so all 195 existing callsites across `src/editor/` and the 11 default extensions stay unchanged. `putLocale()` simplified to a no-op returning `{ langParam: 'en', i18next: facade }`.
- `tests/locale.test.js` rewritten — 7 tests covering the shim contract (dotted lookup, namespace, interpolation, missing-key key-fallback, defensive non-string handling, post-`addResourceBundle` namespace lookup).

### Changed (locale shim)
- `Editor.js` — `goodLangs` array trimmed from 23 entries to `['en']`. `EditorStartup.js` callsite unchanged (the new `putLocale` ignores its args).

### Removed (locale shim)
- `i18next` runtime dependency (was 25.7.4).
- 57 root locale files (`src/editor/locale/lang.{af,ar,az,be,bg,ca,cs,cy,da,de,el,es,et,fa,fi,fr,fy,ga,gl,...}.js`) — only `lang.en.js` retained.
- 46 extension locale files across 10 extension dirs (`ext-{connector,eyedropper,grid,helloworld,layer_view,markers,opensave,panning,polystar,shapes}`) — only each extension's `en.js` retained.

## Fork point

Forked 2026-04-23 from [SVG-Edit/svgedit v7.4.1](https://github.com/SVG-Edit/svgedit) via `bilbospocketses/svgedit`. No upstream tracking; this is a one-time starter base.
