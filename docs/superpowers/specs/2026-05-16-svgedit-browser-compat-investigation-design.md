# svgedit browser-compat investigation — design spec

**Status:** Approved (brainstorm 2026-05-16). Feeds the implementation plan written by `superpowers:writing-plans`.

**Maps to:** Step 1.5 of the 5-step migration sequence. Verify (or drop) the 4 browser-bug workarounds the audit flagged for investigation.

**Inputs:** `docs/AUDIT_2026-05-16.md` § Decisions log (the `isWebkit()` + Firefox 353575 entries); `todo_svgedit.md` #10 Investigations subsection.

---

## 1. Migration sequence position

| Step | PR | Scope | Status |
|---|---|---|---|
| 1 | `feat/pre-migration-cleanup` | Mechanical deletions + brand + textual fixes + duplicate purges | **Shipped** (merge `d2aa5142`, tag `post-cleanup`, 2026-05-16) |
| 1.5 | `feat/browser-compat-investigation` | **THIS SPEC.** Verify the 4 audit-flagged browser workarounds via multi-browser Playwright | Designed (this doc) |
| 2 | `feat/pathseg-drop` | 8 `createSVGPathSeg*` refactors + polyfill removal | Audit doc has the plan; needs spec |
| 3 | `feat/ts-migration` | TS conversion under day-one strict | Spec + plan already on master |
| 4 | `feat/elix-to-lit` | Lit rewrite | Deferred to dedicated brainstorm |

Step 1.5 is small in scope but uncertain in effort (see § 5).

---

## 2. Scope

### In scope

**A. Playwright multi-browser setup**
- Add Firefox to `@playwright/test` browser pool (`npx playwright install firefox`)
- Update `playwright.config.mjs` with `projects: [chromium, firefox]`
- Update `scripts/run-e2e.mjs` if needed to handle multi-browser output (current script just spawns `npx playwright test` — likely no change needed)
- All 81 existing + 4 new tests run on both browsers (170 total runs by default)

**B. Four new regression tests** under `tests/e2e/browser-compat-*.spec.js`:

| File | Tests | Triggers workaround |
|---|---|---|
| `browser-compat-canvasbg-overflow.spec.js` | Zoom out the canvas; verify `#canvasBackground` viewport renders correctly without clipping or overflow artifacts. Pass on both browsers WITHOUT the `overflow: 'none'` workaround = `isWebkit()` check is obsolete. | `select.js:423` |
| `browser-compat-gradient-detect.spec.js` | Programmatically import an SVG with `<linearGradient>` and `<radialGradient>` elements (in defs, standard structure). Call into `convertGradients` (or trigger the code path that calls it). Verify the standard `querySelectorAll('linearGradient, radialGradient')` selector returns both gradients on both browsers. Pass = WebKit gradient-selector bug is obsolete. | `svg-exec.js:1269` |
| `browser-compat-import-gradients.spec.js` | Import an SVG where `<linearGradient>` / `<radialGradient>` / `<pattern>` elements are NOT inside `<defs>` (placed at SVG root level). Verify the gradients/patterns render correctly when applied via `fill="url(#id)"` references. Pass on Firefox = bug 353575 is fixed. | `svg-exec.js:503-512` |
| `browser-compat-import-symbol-gradients.spec.js` | Import an SVG where a `<symbol>` contains `<linearGradient>` and `<use>` elements reference the symbol. Verify the gradient renders inside the rendered symbol instance. Pass on Firefox = symbol-context manifestation of bug 353575 is also fixed. | `svg-exec.js:712-722` |

Each test should:
1. **Set up a scenario that reproduces the original bug shape** (not just "no error thrown" — actual observable correct rendering / detection)
2. **Run WITH the workaround in place** (C3 in cadence) to assert baseline correctness
3. **In C4**, run WITHOUT the workaround to verify the workaround was unnecessary; if pass, drop the workaround code; if fail, keep workaround and refresh its comment

**C. Workaround code drops (conditional on test results):**

- **If both `isWebkit()` sites pass without workaround:** drop the `isWebkit()` branches in `select.js:423` + `svg-exec.js:1269` AND drop the `isWebkit` getter + `export const isWebkit` from `packages/svgcanvas/common/browser.js` (no other consumers — verified by grep on 2026-05-16).
- **If both Firefox 353575 sites pass without workaround:** drop the `isGecko()` branches in `svg-exec.js:503-512` + `svg-exec.js:712-722` BUT keep `isGecko()` in `browser.js` (3 other consumers in `selected-elem.js:1124, 1143, 1174` + `undo.js:136, 225` — separate Firefox workarounds NOT in Step 1.5 scope).
- **If a site fails:** keep the workaround in place, refresh its comment to reflect current bug status, current browser versions tested, and the Bugzilla bug URL. The test from C3 stays as future-proof regression coverage.

**D. Fix existing-test Firefox failures (per brainstorm Q2 user choice — full multi-browser coverage)**

When all 81 existing e2e tests run on Firefox for the first time, some may fail. Per-failure triage:
- **Genuine svgedit bug surfaced by Firefox** → log entry to `todo_svgedit.md` #10 correctness backlog; mark the test `test.fixme(browserName === 'firefox', '<bug description + todo ref>')` so it doesn't gate this PR; DO NOT fix the underlying bug in Step 1.5 (out of scope)
- **Test-infra Firefox quirk** (timing, selector semantics, etc.) → fix the test in C2 so it passes on both browsers
- **Hard cap pivot trigger:** if more than 20 existing tests fail on Firefox, pause and ask user to triage. The user can opt to pivot to brainstorm Q2's option-1 scope (Firefox only for the 4 new tests; existing 81 stay Chromium-only) by scoping back the `playwright.config.mjs` `projects` array with `testMatch` filtering.

**E. CHANGELOG entry** documenting:
- Multi-browser Playwright setup with browser versions tested
- 4 new browser-compat regression tests + per-site results (pass/fail per browser)
- Which workarounds dropped, which kept and why (with refreshed comments)
- Any Firefox-specific fixes applied to existing tests
- Any `.fixme()` markers added (with todo #10 references)
- New e2e baseline (e.g., "Chromium 85 + Firefox 85 = 170 runs" or whatever ends up the actual count)

### Out of scope

- **Other `isGecko()` consumers** in `selected-elem.js:1124, 1143, 1174` + `undo.js:136, 225` — separate Firefox workarounds NOT flagged by audit; not investigated here
- **Other browser-detection consumers:** `isChrome()` in `svg-exec.js:1003` + `MainMenu.js:138`; `supportsGoodTextCharPos()` in `text-actions.js:585`; `isMac()` in `Editor.js:76` — not in audit
- **Safari testing** — no Mac in test inventory; Playwright's `webkit` project on Windows/Linux doesn't accurately reproduce Safari proper
- **CI matrix expansion** — `npm test` already runs everything; no separate CI workflow added in this PR
- **Fixing svgedit bugs surfaced by Firefox testing** — `.fixme()` and route to todo #10; the actual fixes are separate PRs

---

## 3. Commit cadence

**Branch:** `feat/browser-compat-investigation` (cut from master HEAD `d2aa5142`).

**5 commits** (with C2 conditional):

```
C0   chore: tag `pre-compat-investigation` safety point on master before branching
C1   chore(test): add Firefox to Playwright config (multi-browser setup)
     [touches: playwright.config.mjs, possibly scripts/run-e2e.mjs, package.json devDeps if any Firefox-specific dep needed]
     [verification: all 81 existing tests now attempt to run on both browsers; capture per-browser pass/fail]
C2   fix(test): Firefox-compat fixes for existing e2e tests (CONDITIONAL — only if needed)
     [touches: whatever existing tests need Firefox-side adjustments]
     [if hard-cap pivot triggered (>20 Firefox failures): instead, scope back the projects array per brainstorm Q2 option-1 and document in commit message]
C3   test(browser-compat): 4 regression tests for audit-flagged workaround sites
     [touches: 4 new tests/e2e/browser-compat-*.spec.js files; tests assert correct behavior WITH workaround in place]
C4   refactor: drop confirmed-obsolete workarounds; refresh comments on still-needed ones
     [touches: select.js + svg-exec.js (4 sites) + possibly browser.js (if isWebkit fully dropable)]
     [tests from C3 still pass after the drops — that IS the verification]
C5   docs(changelog): document Step 1.5 browser-compat investigation
```

### Why this cadence

- **C1 first** establishes Firefox baseline before adding any new tests — separates "Firefox infrastructure works" from "workaround verification"
- **C2 isolates** Firefox-compat existing-test fixes from the actual workaround investigation
- **C3 lands tests BEFORE the workaround drops** so tests assert correct behavior with workaround in place; then C4 drops workarounds and the same tests assert correct behavior without — clear cause-and-effect, single-variable change in C4
- **If C4 surfaces a regression** on either browser: revert just C4 (drop), keep C3 (tests) as future-proof regression coverage; refresh workaround comments in a follow-up commit

### Conditional behavior per commit

- C2 is **skipped entirely** if 81 existing tests pass clean on Firefox first try
- C2 becomes the **"scope back" commit** if >20 existing tests fail on Firefox — instead of fixing, restrict Firefox project to new browser-compat tests only
- C4 may **drop fewer than 4 workarounds** if some sites still need them — commit message reflects exactly which dropped and which stayed

---

## 4. Verification gates

### Per-commit gates (must pass before commit lands)

- `npm run lint` — clean (standard linter; ESLint swap is Step 3)
- `npx vitest run` — 564/564 pass (no count change — Step 1.5 doesn't touch vitest)
- `node scripts/run-e2e.mjs` (or `npx playwright test` directly) — all expected tests pass on all configured browsers; capture pass/fail counts per browser

### PR-merge gate

- All per-commit gates green
- `npm run build` succeeds; `dist/editor/` produced
- E2E baseline documented per browser (count varies depending on Q2 path)
- **Manual smoke** (DOES make sense here, unlike Step 1's all-mechanical work): load dev server in Chrome AND Firefox, verify editor loads + draws rect/circle/path + saves SVG + reloads + modifies + saves again; check console for errors specific to each browser

### Regression-watch list

| Site | Why risky | Mitigation |
|---|---|---|
| C3 tests reproducing the original bug | If tests assert too loosely (e.g., "no error thrown") they may pass even when workaround removal causes a real regression — tests need to assert OBSERVABLE correct behavior, not just absence of exceptions | Each test description must include the original bug's user-visible failure mode; tests assert against that specific manifestation |
| `isWebkit()` removal from `browser.js` | If any unflagged consumer exists (despite grep showing only 2 sites), removing the export breaks runtime | Final grep before removal: `git grep "isWebkit\\|\\bisWebkit\\b"` should yield only the 2 dropped consumers + the definition + the docs |
| Firefox 353575 partially fixed | Bug may be fixed in some scenarios but not others (e.g., gradients yes, patterns no) | Test each element type separately in C3; C4 drops per-site, not all-or-nothing |
| Adding Firefox doubles e2e runtime (~25s → ~50s on this Windows box) | Slower dev loop | Accept — durable cross-browser coverage is worth it; for fast iteration, devs can use `--project chromium` flag locally |
| `.fixme()` markers accumulate as tech debt | Reviewable in Step 1.5 PR but easy to forget | Each `.fixme()` MUST include a todo #10 entry reference; CHANGELOG entry must enumerate all `.fixme()` markers added |

---

## 5. Estimated effort

Genuinely uncertain because of the existing-tests-on-Firefox unknown. Three scenarios:

| Scenario | Effort | Outcome |
|---|---|---|
| **Best case** | ~2-3 hours | All 81 existing tests pass on Firefox first try (C2 skipped). All 4 new tests (C3) pass without workarounds in C4. All 4 workarounds drop + `isWebkit()` removed from `browser.js`. 4-commit PR (C0, C1, C3, C4, C5). |
| **Realistic** | ~half day | A handful of existing tests need Firefox-compat tweaks in C2. 2 of 4 workarounds drop, 2 stay (e.g., Firefox 353575 partially still needed). Mixed C4 — some drops, some comment refreshes. 5-commit PR. |
| **Worst case** | ~1-2 days | 10-20 existing tests fail on Firefox — significant C2 triage work. Some workarounds drop, some stay. Possibly hits the >20 pivot trigger and scopes back to Firefox-only-for-new-tests. Multiple `.fixme()` markers added with todo #10 entries. |

The hard-cap pivot trigger (>20 Firefox failures → scope back to brainstorm Q2 option-1) caps worst-case scope. Without that trigger, worst case could balloon to many days.

---

## 6. Risks + rollback

### Top risks (beyond regression-watch list above)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Test-design weakness — C3 tests assert wrong behavior, so workaround drops in C4 pass tests but ship a real regression | Medium | User-visible bug post-merge | Tests must replicate ORIGINAL bug's user-visible failure mode. Reviewer (in subagent-driven execution) verifies each test description + assertion target against the bug it's reproducing. |
| Adding Firefox to Playwright triggers cascading Firefox-only weirdness in existing tests (timing, default font rendering, default cursor positions, etc.) | Medium-high | Big C2 scope | Hard cap + pivot trigger documented in C2 |
| `isWebkit()` removal breaks an unflagged consumer | Low (grep verified) | Runtime breakage | Final grep before removal in C4 |
| Bug 353575 might be FIXED in modern Firefox for some inputs but the test SVG happens to fall in a still-broken case | Low | Test fails on Firefox in C3 even though workaround SHOULD be droppable | Use multiple test SVGs covering the variants the workaround addresses; if any pass without workaround, document the variant and the limitation in C4's comment refresh |

### Rollback

- Pre-merge: `git branch -D feat/browser-compat-investigation`. Zero impact.
- Post-merge: `git revert -m 1 <merge-sha>`. Recovers master fully.
- Per-commit revert: especially C4 — if a workaround drop causes a regression caught later, revert just C4; C3 tests stay as documentation.
- Safety tag: `pre-compat-investigation` placed on master HEAD in C0.

---

## Headline

This PR is **"verify 4 audit-flagged browser-bug workarounds via 4 new Playwright tests on Chromium + Firefox; drop the workarounds that are confirmed obsolete; refresh comments on the ones still needed; fix or `.fixme()` any existing-test Firefox failures along the way."** Scope is small in lines-of-code but uncertain in effort because the existing 81 tests' behavior in Firefox is an unknown. Hard-cap pivot trigger (>20 failures) caps the worst case.
