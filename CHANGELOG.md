# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (post-parity ruleset tightening — 2026-05-19)
- Pure API-state changes (no source commits) — pushes svgedit ahead of peer parity on three dimensions.
- **Branch ruleset `16565370`:**
  - `pull_request.allowed_merge_methods`: `["merge","squash","rebase"]` → `["squash","merge"]`. Hardware-enforces the CLAUDE.md "squash, never rebase" SOP — the "Rebase and merge" button no longer renders in the GitHub UI. Eliminates the accidental-unsigned-commit class that left old `verified:false` commits in ws-scrcpy-web's pre-lockdown history. (`gh api -X PUT /repos/.../rulesets/16565370 --input ...` — full GET → mutate → PUT script in `feedback_*` memory.)
  - `required_status_checks`: added `Analyze (javascript-typescript)` + `Analyze (actions)` alongside the existing `build-and-test`. CodeQL findings now block merge. Demonstrated need: PR #8's first push had 2 new high-severity polynomial-redos alerts that were technically mergeable under the old config; the new config would have blocked.
- **Tag ruleset `16565201`:** added `required_signatures` to the rules array (was `[deletion, non_fast_forward]`, now `[deletion, non_fast_forward, required_signatures]`). Tags pushed without `git tag -s` (or with mis-configured SSH signing) now fail at push.
- **`secret_scanning_non_provider_patterns` + `secret_scanning_validity_checks` BLOCKED:** both require GitHub Advanced Security (GHAS, $49/active-committer/month for orgs). `PATCH /repos/.../security_and_analysis` returns 200 OK silently without applying state changes on free public repos. Deferred indefinitely; will be revisited if GitHub expands free coverage. Lesson captured: GHAS-gated security features fail silently on the free tier — not with an error.

### Fixed (CodeQL alert triage — 2026-05-19)
- **All 8 open CodeQL alerts cleared on `master`** (4 fixed + 2 dismissed earlier as auto-resolution + 2 fixed in this PR). Final state: 0 open CodeQL alerts, parity with control-menu / ws-scrcpy-web.
- **`packages/svgcanvas/core/utilities.js` — 2× `js/polynomial-redos` (high) — FIXED**
  - **`dropXMLInternalSubset`**: replaced regex with `String.indexOf` walk. First attempt at deterministic regex (`/(<!DOCTYPE[^[]*\[)[\s\S]*?(\?]>)/`) still tripped CodeQL because unanchored regex matching is O(N²) at the engine level (N positions × N work per attempt). String-operation walk is strictly O(N).
  - **`dataURLToObjectURL`**: same — replaced `prefix.match(/:(.*?);/)` with paired `indexOf(':')` + `indexOf(';', colonIdx+1)` + `slice`. Equivalent MIME extraction semantics, strictly O(N).
- **`packages/svgcanvas/core/svgroot.js` — 4× `js/html-constructed-from-input` (medium) — FIXED**
  - `svgRootElement` rewritten from template-literal XML construction + `text2xml` parse + `importNode` round-trip → direct `createElementNS` + `setAttribute` element building. Eliminates the entire "construct HTML string from library input" class of vulnerability that CodeQL flagged. Same DOM tree produced (svg/defs/filter/feGaussianBlur/feOffset/feMerge/feMergeNode). Dimensions explicitly stringified via `String()` before `setAttribute`. `text2xml` import removed (no longer needed). Net +24 lines for the more explicit construction.
- **`_reference/embed-api-v6/embedapi.js` — 2× `js/unvalidated-dynamic-method-call` (high) — DISMISSED**
  - Both alerts dismissed via API with rationale: preserved V6-era reference code (per `project_svgedit.md` and README §Embedding), retained as design input for the future V7+ embed API but never imported/executed at runtime. Original source already carried `// lgtm [js/unvalidated-dynamic-method-call]` suppression comments + documented rationale (callbackID checked numeric AND `t.callbacks[callbackID]` existence checked AND calls limited to allowedOrigins). Will be re-evaluated when V7 embed API is implemented. Mirrors ws-scrcpy-web's §28 "dismissed with rationale" pattern.

### Fixed (Dependabot vulnerability cleanup — 2026-05-19)
- Cleared **all 31** open Dependabot alerts surfaced by the 2026-05-18 master lockdown (1 critical, 13 high, 17 moderate). Final state: 0 open alerts, `npm audit` reports 0 vulnerabilities.
- **Direct-dep bumps:**
  - `jspdf 4.0.0 -> 4.2.1` — closes 9 alerts (HTML injection, PDF object injection in FreeText/AcroForm/addJS, DoS via GIF/BMP, XMP metadata injection, race condition).
  - `vite ^7.3.1 -> ^7.3.2` — closes 3 alerts (`server.fs.deny` bypass via queries, WebSocket arbitrary file read, optimized-deps `.map` path traversal). Lockfile resolves to 7.3.3.
- **`overrides` block** added to `package.json` to force transitive resolutions onto fixed versions:
  - `dompurify ^3.4.0` — closes 9 alerts (FORBID_TAGS bypass, SAFE_FOR_TEMPLATES bypass, prototype pollution, ADD_TAGS / ADD_ATTR predicate bypasses, USE_PROFILES prototype pollution, mutation-XSS, CUSTOM_ELEMENT_HANDLING fallback XSS). Lockfile resolves to 3.4.5.
  - `flatted ^3.4.2` — closes 1 alert (prototype pollution via `parse()`).
  - `postcss ^8.5.10` — closes 1 alert (XSS via unescaped `</style>` in CSS stringify output). Lockfile resolves to 8.5.14.
  - `rollup ^4.59.0` — closes 1 alert (arbitrary file write via path traversal). Lockfile resolves to 4.60.4.
  - `glob ^10.5.0` — closes 1 alert (CLI command injection via `-c`/`--cmd`).
- **`npm audit fix --package-lock-only`** resolved the remaining 6 transitive alerts in the eslint / istanbul / brace-expansion / ajv / ws / minimatch (9.x) / picomatch (4.x) / js-yaml (4.x) chains — all semver-compatible.
- Tracks `todo_svgedit.md` item #14 (the surfacing entry from the lockdown pass); item closes when this PR lands.

### Added (repo hygiene + security baseline — 2026-05-19)
- `LICENSE` (GPL-3.0-only) added at repo root. Matches Control Menu / ws-scrcpy-web. Inherited upstream code retains its original licenses; `LICENSE-MIT.txt` preserved at root for upstream attribution.
- `SECURITY.md` — private vulnerability reporting flow via GitHub Security Advisories with 72h acknowledgement SLA. Scope: svgedit web app + build pipeline + extension loader + embed entry points + export modules. Out-of-scope: upstream dep vulns (report upstream), browser-engine bugs, self-XSS.
- `CONTRIBUTING.md` — solo-fork posture documented; prerequisites (Node ≥ 20), setup, dev workflow, code-style notes covering the JS → TS migration split between master and `feat/ts-migration`, commit/PR conventions, master is PR-gated as of 2026-05-18, signed commits required, `build-and-test` CI gate.
- `.github/dependabot.yml` — version-update coverage for `npm` (main package + `packages/svgcanvas` workspace) and `github-actions` (CI workflow SHA pins), weekly cadence, 5 open-PR limit. Pairs with the security-update auto-handling already enabled in repo Settings.
- `.github/workflows/ci.yml` — `build-and-test` workflow on `master` (push + PR). SHA-pinned `actions/checkout@v6.0.2` + `actions/setup-node@v6.4.0`, node 24. Steps: `npm ci` → `npm run lint` → `npm run build` → `npx vitest run` → `npx playwright install --with-deps chromium firefox` → `node scripts/run-e2e.mjs`. No `tsc --build` step on master (no TypeScript yet); `feat/ts-migration`'s richer workflow supersedes this on merge.
- `package.json` license field changed from the upstream compound SPDX expression to `GPL-3.0-only`.

### Changed (pathseg polyfill drop — Step 2 of 5, 2026-05-16)
- `refactor(path): drop pathseg polyfill (Step 2 of 5)` — 3-commit PR (`feat/pathseg-drop`). Removes the legacy `pathseg` polyfill from runtime deps and replaces it with `path-data-polyfill` (the SVG 2 spec polyfill). Refactors **10 sites** across 2 files (`packages/svgcanvas/core/path-actions.js` 8 sites + `packages/svgcanvas/core/path-method.js` 2 sites in `Path.addSeg`) from `createSVGPathSeg*` constructors + `seglist.appendItem(seg)`/`insertItemBefore(seg, i)` to `getPathData()` + `data.push/splice({type, values})` + `setPathData(data)`. The audit originally undercounted at "8 sites in path-actions.js"; the 2 path-method.js sites were caught by manual smoke when Clone Node silently failed post-pathseg-drop (the addSeg `createSVGPathSeg*` calls became undefined). Lesson captured: **always grep the whole codebase before swapping/deprecating any API**, never trust upstream audit counts without re-verifying. `PathDataListShim` (already in `core/path-method.js`) continues to handle remaining `pathSegList` consumers via delegation to native/polyfilled `getPathData`/`setPathData`. Test env switched to `path-data-polyfill` in 6 vitest unit-test files; `path.test.js` gained a small local `SVGPathSeg` const for 2 numeric constants previously provided as pathseg globals. C3 additionally: swaps the vendored polyfill in `src/editor/tests/unit-harness.html` from `./vendor/pathseg/pathseg.js` to `./vendor/path-data-polyfill/path-data-polyfill.js` (Playwright browser-unit harness), updates `scripts/copy-static.mjs` to vendor `path-data-polyfill` instead of `pathseg` into `dist/editor/tests/vendor/`, and removes `pathseg` from `package.json` dependencies. Bonus cleanup: removed a redundant `setPathData(newPathData)` call in `coords.js` after `setAttribute('d', dstr)` that was destructively re-serializing the d attribute; dead `newPathData` array + push calls dropped too. Verified: lint clean, vitest 564/564 unchanged, e2e 192 passed both browsers, build clean, manual cross-browser smoke clean (draw/save/reload, line↔curve toggle, clone-node + delete-node, mixed-syntax import via Source dialog).

### Added (path tool keys 2026-05-16)
- `feat(path): Enter completes path open, Escape cancels` — `document` keydown handler in `path-actions.js init()` filtered by mode + active drawing + input-focus. `finishPath()` requires ≥ 2 points; `cancelPath()` delegates to existing `clear()`. Existing double-click completion (two mousedowns at same point) unchanged. README gains `## Path tool keys` section. 4 new e2e tests (×2 browsers = 8 runs).

### Fixed (i18n facade deep-merge 2026-05-16)
- `fix(locale): deep-merge in addResourceBundle facade (preserves base translation bundle)` — Surfaced during post-smoke re-verification: storage prefs dialog suddenly showed raw i18n keys (`notification.editorPreferencesMsg`, `common.ok`, `tools.remember_this_choice`, etc.) instead of resolved text. **Pre-existing bug** dating back to `e53209fe` (2026-04-30 English-only i18n strip): the `locale.js` i18next compatibility facade's `addResourceBundle` was doing flat overwrite (`bundles[ns] = dict`) instead of deep-merge. When ANY extension using `loadExtensionTranslation` (ext-opensave, ext-connector, ext-eyedropper, ext-shapes, ext-grid, ext-layer_view, ext-markers, ext-overview_window, ext-panning, ext-polystar) called `i18next.addResourceBundle(lang, 'translation', { extName: {...} }, true, true)`, the facade clobbered the entire `translation` bundle (`common`, `notification`, `tools`, `properties`, all extension namespaces) with just the calling extension's small dict. The bug was a race — if the storage dialog populated BEFORE any extension's bundle load, text was correct; if AFTER, raw keys leaked. Module reordering from this session's title-sweep commit (0edf763b) shifted the IIFE bundle's load order and surfaced the race in the visible direction.
- Fix: `locale.js` `addResourceBundle` now deep-merges (`bundles[ns] = deepMerge(bundles[ns] || {}, dict)`) — matches the semantics extensions expect when they pass `deep=true, overwrite=true`. Sibling namespaces (`common`, `opensave`, `connector`, etc.) coexist in the bundle as intended.
- Verified: lint clean, vitest 564/564 unchanged, e2e 184 passed both browsers, manual cross-browser smoke confirmed dialog text restored.

### Fixed (post-smoke follow-ups 2026-05-16)
- `fix(opensave): call markSaved before handle.name access (handle is null on Firefox)` — Follow-up to the earlier Editor.markSaved fix (947fb64c). That commit called `svgEditor.markSaved()` AFTER `svgEditor.topPanel.updateTitle(handle.name)` inside the try block. `browser-fs-access` returns `null` on Firefox's download fallback (no File System Access API support), so `handle.name` threw TypeError — caught by the surrounding try/catch, swallowed to `console.error`, and `markSaved()` was never reached. Edge worked because the FileSystemFileHandle API path returns a real handle. Fix: reorder so `markSaved()` runs first (save succeeded either way), then guard the handle-dependent calls under `if (handle)`. Title still doesn't update on Firefox download flow (no file handle returned by the library) — pre-existing UX gap, separate concern. Surfaced by manual smoke after 947fb64c shipped.
- `chore(brand): sweep "SVG-edit" lowercase in HTML titles` — Follow-up to b772d46d's brand sweep. Original sweep used case-sensitive `SVG[- ]Edit` grep and missed 3 HTML `<title>` tags using lowercase 'e' (`index.html`, `iife-index.html`, `xdomain-index.html`). Tabs now show "svgedit" / "svgedit (IIFE)" / "svgedit (xdomain)". Out of scope: `tests/visual/rotation-recalc-demo.html` "SVG-Edit Bug" prose (internal test fixture, no user impact).
- Verified: lint clean, vitest 564/564 unchanged, e2e 184 passed + 0 skipped both browsers.

### Fixed (Firefox dirty-state on save 2026-05-16)
- `fix(editor): clear showSaveWarning on successful save (Editor.markSaved())` — Fixes the Firefox-surfaced "unsaved changes" beforeunload warning that appeared after a successful save (todo #10). Root cause: the `showSaveWarning` dirty flag was **never reset** after save — the comment at `EditorStartup.js:622` claiming otherwise was stale from upstream. The flag was only being set (`true` in `Editor.elementChanged` on every edit) but never cleared. Both Chrome and Firefox technically had the bug; modern Chromium browsers suppress the beforeunload prompt aggressively (post-2020 security change), masking it visually — Firefox honors `e.returnValue` strictly, so only Firefox showed the warning. Fix:
  - **`Editor.markSaved()`** — new accessor on the Editor instance that sets `showSaveWarning = false`. Centralized seam so save extensions can clear the dirty flag without reaching into internal state.
  - **`ext-opensave.js`** — calls `svgEditor.markSaved()` after `fileSave` resolves successfully (before `runExtensions('onSavedDocument', ...)`). Both `'save'` and `'saveas'` paths go through the same code, so both flows clear the flag. Save-cancellation (AbortError) doesn't clear the flag — dirty state is preserved as expected.
  - **`saveSourceEditor` NOT touched** — that's the in-memory Source-dialog flow (saving the textarea back to canvas), not a disk save; dirty state should remain.
  - **`EditorStartup.js:622` comment refreshed** — replaces the stale claim with an accurate description pointing at `markSaved()`.
- **Regression test:** new `tests/e2e/firefox-dirty-state-on-save.spec.js` with 2 tests verifying the dirty-flag lifecycle (force-dirty → markSaved → assert clean → force-dirty again → assert dirty) and idempotency. Both pass on Chromium + Firefox.
- Final e2e baseline: **184 passed, 0 skipped** (180 prior + 4 new). Vitest 564/564 unchanged. Lint clean.

### Fixed (coords.js Firefox closepath 2026-05-16)
- `fix(coords): handle uppercase 'Z' closepath + emit closepath in newPathData` — Fixes the Firefox-only crash logged as `test.fixme` during Step 1.5 (todo #10). Two independent bugs in `packages/svgcanvas/core/coords.js`:
  - **Read side (line 314):** `pathMap.indexOf(seg.type)` returned -1 for Firefox's native `getPathData()` segments with `seg.type === 'Z'` (literal source-case letter), because `pathMap` only contained lowercase `'z'`. The `continue` left a hole in `changes.d[]`, causing `seg is undefined` at line 384. Fix: normalize `'Z'` → `'z'` before the indexOf lookup (SVG spec treats Z and z as equivalent for closepath — no operands, no absolute/relative distinction).
  - **Write side (switch at line 439):** the switch building `newPathData` had no `case 1` for closepath, so closepath segments were silently dropped from `newPathData`. On Chromium this was harmless (no `setPathData` support → only `setAttribute('d', dstr)` runs and `dstr` correctly has `z`). On Firefox, `setPathData(newPathData)` re-serializes the d attribute and dropped the closepath, producing visually broken open paths from previously-closed shapes. Fix: add `case 1: newPathData.push({ type: letter, values: [] })`.
- **Test side cleanup:** removed the 2 `test.fixme(browserName === 'firefox', ...)` markers from `tests/e2e/unit/svgcore-{remap,recalculate}-extra.spec.js`. Also made path-d assertions in those tests format-tolerant — Firefox's native `setPathData` re-serializes with space separators (`M 3 -1 L 8 ...`) while Chromium preserves the comma/concise format svgedit writes (`M3,-1 L8,-1 ...`). Both are valid SVG path data syntax; tests now normalize to a canonical form before asserting key segments.
- Final e2e baseline: **180 passed, 0 skipped** on 180 attempted (Chromium 90 + Firefox 90). Vitest 564/564 unchanged. Lint clean.

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
