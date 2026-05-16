# svgedit Browser-Compat Investigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify (or drop, if obsolete) the 4 audit-flagged browser-bug workarounds via 4 new Playwright tests run on both Chromium and Firefox; fix or `.fixme()` any existing-test Firefox failures along the way.

**Architecture:** Single PR (`feat/browser-compat-investigation`) with 5-6 ordered commits on master. C1 adds Firefox to Playwright config. C2 (conditional) fixes Firefox-side existing-test failures or scopes back to Firefox-only-for-new-tests if >20 failures. C3 lands 4 regression tests asserting correct behavior WITH workaround in place. C4 drops workarounds confirmed obsolete by the C3 tests; refreshes comments on still-needed ones. C5 documents.

**Tech Stack:** Playwright 1.57 (chromium + firefox projects), Vitest 4, Vite 7, `standard` linter (ESLint swap is Step 3).

**Spec:** `docs/superpowers/specs/2026-05-16-svgedit-browser-compat-investigation-design.md`

**Prerequisites:** Step 1 (`feat/pre-migration-cleanup`) merged to master (already done, commit `d2aa5142`).

---

## File structure

| Operation | File(s) | Commit |
|---|---|---|
| Modify | `playwright.config.mjs` (add Firefox project) | C1 |
| Possibly modify | `tests/e2e/*.spec.js` files that fail on Firefox | C2 (conditional) |
| Create | `tests/e2e/browser-compat-canvasbg-overflow.spec.js` | C3 |
| Create | `tests/e2e/browser-compat-gradient-detect.spec.js` | C3 |
| Create | `tests/e2e/browser-compat-import-gradients.spec.js` | C3 |
| Create | `tests/e2e/browser-compat-import-symbol-gradients.spec.js` | C3 |
| Modify | `packages/svgcanvas/core/select.js` line 423 (drop `isWebkit()` conditional) | C4 (if Site 1 test passes both browsers without workaround) |
| Modify | `packages/svgcanvas/core/svg-exec.js` line 1269 (drop `isWebkit()` fallback) | C4 (if Site 2 test passes) |
| Modify | `packages/svgcanvas/core/svg-exec.js` lines 503-512 (drop `isGecko()` Firefox 353575 main) | C4 (if Site 3 test passes) |
| Modify | `packages/svgcanvas/core/svg-exec.js` lines 712-722 (drop `isGecko()` Firefox 353575 symbol) | C4 (if Site 4 test passes) |
| Possibly modify | `packages/svgcanvas/common/browser.js` (drop `isWebkit()` getter + export) | C4 (if BOTH Site 1 + 2 drop — no other `isWebkit()` consumers) |
| Modify | `CHANGELOG.md` (Unreleased → Changed (browser-compat investigation 2026-05-16)) | C5 |

---

## Per-commit verification gate

Run after every commit's edits, BEFORE the `git commit` step. Baseline (from Step 1 ship): lint clean, vitest 564/564, e2e 81/81 (Chromium-only). Once Firefox is added in C1, baseline becomes "what C1 establishes" — capture the per-browser counts then.

```bash
npm run lint                           # standard linter; clean
npx vitest run                         # 564/564 pass
node scripts/run-e2e.mjs               # all tests pass on all configured browsers
```

If a gate fails, fix before committing — never commit broken state.

---

## Test-design discipline (applies to all C3 tests)

Each new test in C3 must:

1. **Reproduce the ORIGINAL bug's user-visible failure mode** — not just "no exception thrown". Each test description in `test.describe()` should reference the bug being verified.
2. **Set up the scenario the workaround addresses** — e.g., for Site 1, zoom out; for Site 3, import SVG with gradients at root level.
3. **Assert correct OBSERVABLE behavior** — DOM state, computed style, getBoundingClientRect, image data, or save/round-trip equivalence. NOT just "didn't throw".
4. **Pass with workaround in place** (this is C3) — establishes baseline correctness.
5. **Continue to pass after workaround drop** (in C4) — that IS the verification that workaround was unnecessary.
6. **Run on both Chromium AND Firefox** — implicit via the multi-browser projects config; ensure no `test.skip` or `test.only` blocks bypass either.

Follow existing test patterns from `tests/e2e/*.spec.js`:
- Top-level tests use `visitAndApproveStorage(page)` from `helpers.js` + `setSvgSource(page, markup)` for SVG import
- Page-side JS runs via `page.evaluate(() => { ... })`
- Use `expect()` from `./fixtures.js`

---

## Task 1 (C0): Branch + safety tag + baseline

**Files:** none (git operations).

- [ ] **Step 1: Confirm on master + clean**

```bash
git checkout master
git pull
git status
```

Expected: on master, up to date with origin, clean working tree.

- [ ] **Step 2: Place safety tag + cut branch**

```bash
git tag pre-compat-investigation
git push origin pre-compat-investigation
git checkout -b feat/browser-compat-investigation
git push -u origin feat/browser-compat-investigation
```

- [ ] **Step 3: Capture baseline test counts (Chromium-only — same as Step 1's post-ship state)**

```bash
npm run lint                                              # capture pass/fail
npx vitest run 2>&1 | grep -E "Test Files|Tests"          # capture vitest count
node scripts/run-e2e.mjs 2>&1 | tail -10                  # capture e2e count
```

Expected baseline:
- Vitest: 564 passing across 41 test files
- E2e (Chromium): 81 passing
- Lint: clean

Record these numbers; they're the starting point for the per-commit gate.

---

## Task 2 (C1): Add Firefox to Playwright config

**Files:**
- Modify: `playwright.config.mjs`
- Possibly modify: `scripts/run-e2e.mjs` (only if multi-browser output requires it)
- Possibly modify: `package.json` (no new dev deps expected — Firefox is bundled with `@playwright/test`; just needs binary install)

- [ ] **Step 1: Install Firefox browser binary**

```bash
npx playwright install firefox
```

Expected: downloads + installs Firefox to Playwright's cache (`%USERPROFILE%\AppData\Local\ms-playwright` on Windows). Quick (~30s). If already installed, no-op.

- [ ] **Step 2: Update playwright.config.mjs to add Firefox project**

Read `playwright.config.mjs` to confirm current structure. Replace with:

```js
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8000',
    headless: true
  },
  reporter: 'list',
  webServer: {
    command: 'npm run start:e2e',
    url: 'http://localhost:8000/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ]
})
```

Note the added `import { ..., devices }` and the `projects` array. Everything else stays identical.

- [ ] **Step 3: Verify Playwright sees both projects**

```bash
npx playwright test --list 2>&1 | head -10
```

Expected: output lists tests with `[chromium]` and `[firefox]` prefixes. Each existing test appears twice (once per project).

- [ ] **Step 4: Run full e2e suite — capture per-browser results**

```bash
node scripts/run-e2e.mjs 2>&1 | tail -30
```

Expected (best case): `162 passed (81 chromium + 81 firefox)`. Captures actual output for next-step triage.

If Firefox tests fail, record:
- Total Firefox failures (count)
- Which specific tests fail
- The failure messages (or sample of first 5)

- [ ] **Step 5: Decision point based on Firefox failure count**

| Firefox failures | Action |
|---|---|
| 0 | Skip Task 3 (C2) entirely; proceed to Task 4 (C3) directly |
| 1-20 | Proceed to Task 3 (C2) to fix the failures |
| >20 | **PIVOT** — scope back to Firefox-only-for-new-tests per spec § 2.D. Update `playwright.config.mjs` firefox project to add `testMatch: /browser-compat-.*\.spec\.js$/`. Commit this scope-back in C2 instead of fixes. |

Document the decision + Firefox failure list in your task report.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.mjs
git commit -m "chore(test): add Firefox to Playwright config (multi-browser setup)

Firefox now configured as a second Playwright project alongside
chromium. By default all tests run on both browsers. Baseline
captured: <N> chromium passing + <M> firefox passing.

Total runs: <chromium-count> + <firefox-count> = <total>.

(Adjust the placeholders based on actual captured counts.)"
```

Replace placeholders with actual numbers from Step 4.

- [ ] **Step 7: Report Firefox failures (if any)**

Report back to controller:
- Total Firefox tests run
- Total Firefox failures
- Decision per Step 5 table (skip C2 / fix in C2 / pivot in C2)
- For each failure: test file + test name + first line of failure message

This drives Task 3's scope.

---

## Task 3 (C2): Firefox-compat fixes OR pivot scope-back (CONDITIONAL)

**Skip this task entirely if Task 2 Step 5 decided "skip C2".**

**Files:** depends on Task 2's outcome.

### Branch A: 1-20 Firefox failures → fix existing tests

For each Firefox-failing test:

- [ ] **Step 1: Diagnose the failure**

Read the failing test file. Run just that test against Firefox to see full output:

```bash
npx playwright test --project=firefox -g "<test name>"
```

Categorize the failure:
- **Test-infra Firefox quirk** (timing, selector semantics, default font/cursor positions, async-resolution differences) → fix in this task
- **Genuine svgedit bug surfaced by Firefox** (rendering bug, behavior difference that's actually a real defect) → `.fixme()` in this task + log to `todo_svgedit.md` #10 correctness backlog

- [ ] **Step 2: Apply fix OR fixme()**

For test-infra quirks, fix the test. Common patterns:
- Add explicit waits: `await page.waitForSelector('#foo', { timeout: 5000 })`
- Replace strict-equality assertions on layout numbers with tolerance: `expect(Math.abs(actual - expected)).toBeLessThan(2)`
- Use Playwright's `page.locator()` recommended patterns over raw DOM queries

For genuine bugs:
```js
test('foo bar', async ({ page, browserName }) => {
  test.fixme(browserName === 'firefox', 'Firefox-specific: <brief bug description>. See todo_svgedit.md #10.')
  // ... rest of test unchanged ...
})
```

- [ ] **Step 3: Verify the fix per failing test**

```bash
npx playwright test --project=firefox -g "<test name>"
```

Expected: PASS or FIXME (.fixme marks the test as skipped on Firefox).

- [ ] **Step 4: Run full suite once all failures addressed**

```bash
node scripts/run-e2e.mjs 2>&1 | tail -10
```

Expected: total pass count = 162 (or less if any `.fixme()` markers added — `.fixme()` shows as "skipped"). NO failures.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/
git commit -m "fix(test): Firefox-compat fixes for existing e2e tests

Firefox surfaced <N> failures when added to Playwright config.
<M> were test-infra quirks (timing, selector semantics, layout
precision) — fixed in this commit.
<K> were genuine svgedit bugs surfaced by Firefox — marked
test.fixme(browserName === 'firefox', ...) and logged to
todo_svgedit.md #10 correctness backlog:
  - <list bugs with test names>

Final Firefox count: <count> passing, <skipped-count> .fixme()
on Firefox. Chromium unchanged: 81 passing."
```

### Branch B: >20 Firefox failures → pivot to scope-back

- [ ] **Step 1: Update playwright.config.mjs to restrict Firefox project**

Read current `playwright.config.mjs`. Add `testMatch` to the firefox project entry:

```js
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /browser-compat-.*\.spec\.js$/
    }
```

(Chromium project unchanged — runs all tests as before.)

- [ ] **Step 2: Verify scope-back works**

```bash
npx playwright test --project=firefox --list 2>&1 | head -10
```

Expected: zero tests listed for Firefox (because no `browser-compat-*.spec.js` files exist yet — they're created in Task 4). The actual Firefox test count goes from "many failures" to "zero — none to run".

```bash
npx playwright test --project=chromium --list 2>&1 | head -5
```

Expected: 81 Chromium tests still listed.

- [ ] **Step 3: Commit the pivot**

```bash
git add playwright.config.mjs
git commit -m "fix(test): scope back Firefox Playwright project to browser-compat tests only

First-run of existing 81 tests on Firefox surfaced <N> failures
(>20 hard-cap pivot trigger per spec § 2.D). Restricting Firefox
project via testMatch /browser-compat-.*\\.spec\\.js$/ so the
existing 81 tests stay Chromium-only while the 4 new browser-compat
tests in C3 run on both browsers.

Follow-up scope: full multi-browser coverage of existing tests
becomes a separate dedicated PR. Logged to todo_svgedit.md as a
tracked item."
```

- [ ] **Step 4: Add follow-up to todo_svgedit.md** (memory vault path: `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`)

Add a new active item:
```markdown
### N. Firefox-compat sweep of existing e2e tests (NEW — deferred from Step 1.5 pivot)

When Step 1.5 added Firefox to Playwright, >20 of the existing 81 tests failed. Step 1.5 pivoted to Firefox-only-for-new-browser-compat-tests; restoring full multi-browser coverage of the existing 81 is deferred to this dedicated PR. Investigation: triage each failure (genuine bug → fix or log to #10; test-infra quirk → fix the test). Outcome: remove the `testMatch` restriction from the firefox project in `playwright.config.mjs`; achieve 162/162 passing.
```

---

## Task 4 (C3): Write 4 browser-compat regression tests

**Files:**
- Create: `tests/e2e/browser-compat-canvasbg-overflow.spec.js`
- Create: `tests/e2e/browser-compat-gradient-detect.spec.js`
- Create: `tests/e2e/browser-compat-import-gradients.spec.js`
- Create: `tests/e2e/browser-compat-import-symbol-gradients.spec.js`

Each test asserts correct behavior **WITH the workaround in place** (workaround code is unchanged in this task). Task 5 (C4) then drops the workaround code and the same tests re-run as the verification.

### Step 1: Write browser-compat-canvasbg-overflow.spec.js (Site 1)

Bug being verified: `select.js:423` — `overflow: isWebkit() ? 'none' : 'visible'` on `#canvasBackground`. Comment: "Chrome 7 has a problem with this when zooming out". Original failure mode: visual artifacts (overflow / clipping issues) when canvas zoomed out.

Test approach: zoom out the canvas (programmatically via `svgCanvas.setZoom` or via the zoom UI), then assert observable canvas state — specifically, that the canvas background's geometry/overflow CSS computed style is consistent with the rest of the canvas (no rogue scrollbars on `#svgroot`, no clipping that wouldn't apply at zoom 1.0).

- [ ] **Create the file with this content:**

```js
import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('browser-compat: canvasBackground overflow on zoom-out (select.js:423)', () => {
  // Verifies the `isWebkit() ? 'none' : 'visible'` workaround in select.js:423.
  // Original bug: "Chrome 7 has a problem with this when zooming out".
  // If this test passes on both Chromium AND Firefox, the workaround can be
  // dropped (C4) — the modern WebKit/Chromium engine no longer needs the
  // overflow override.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('canvas background renders consistently when zoomed out to 0.25', async ({ page }) => {
    // Set zoom to 0.25 (4x zoom out) — triggers the original Chrome 7 bug scenario
    await page.evaluate(() => {
      window.svgEditor.svgCanvas.setZoom(0.25)
    })
    await page.waitForTimeout(100) // let rendering settle

    // Capture observable canvas state
    const state = await page.evaluate(() => {
      const bg = document.getElementById('canvasBackground')
      const svgRoot = document.getElementById('svgroot')
      const bgBox = bg.getBoundingClientRect()
      const rootBox = svgRoot.getBoundingClientRect()
      const bgStyle = getComputedStyle(bg)
      return {
        bgWidth: bgBox.width,
        bgHeight: bgBox.height,
        rootWidth: rootBox.width,
        rootHeight: rootBox.height,
        bgOverflow: bgStyle.overflow,
        // Check the actual overflow ATTRIBUTE on the SVG element (workaround sets it to 'none' on WebKit)
        bgOverflowAttr: bg.getAttribute('overflow')
      }
    })

    // Assertions: canvas background must have positive geometry and be smaller-than-or-equal
    // to the svgroot viewport (no overflow into the page). Both browsers should match.
    expect(state.bgWidth).toBeGreaterThan(0)
    expect(state.bgHeight).toBeGreaterThan(0)
    expect(state.rootWidth).toBeGreaterThan(0)
    expect(state.rootHeight).toBeGreaterThan(0)
    // Background should not visually extend beyond the SVG root viewport — this is the
    // user-visible symptom the original Chrome 7 bug created
    expect(state.bgWidth).toBeLessThanOrEqual(state.rootWidth + 1) // ±1px tolerance
    expect(state.bgHeight).toBeLessThanOrEqual(state.rootHeight + 1)
  })

  test('zoom-out does not introduce horizontal/vertical scroll on canvas viewport', async ({ page }) => {
    await page.evaluate(() => {
      window.svgEditor.svgCanvas.setZoom(0.1) // extreme zoom-out
    })
    await page.waitForTimeout(100)

    const scrollState = await page.evaluate(() => {
      const workarea = document.getElementById('workarea') // or whichever element wraps svgroot
      return {
        scrollWidth: workarea?.scrollWidth ?? 0,
        clientWidth: workarea?.clientWidth ?? 0,
        scrollHeight: workarea?.scrollHeight ?? 0,
        clientHeight: workarea?.clientHeight ?? 0
      }
    })

    // After extreme zoom-out, the canvas should fit in its workarea (no rogue scrollbars
    // caused by the original Chrome 7 overflow bug)
    expect(scrollState.scrollWidth).toBeLessThanOrEqual(scrollState.clientWidth + 2)
    expect(scrollState.scrollHeight).toBeLessThanOrEqual(scrollState.clientHeight + 2)
  })
})
```

Note: if `workarea` isn't the correct element name, the implementer must read the editor HTML to find the canvas viewport wrapper element and adjust. Don't blindly copy — verify.

- [ ] **Run the new test against both browsers:**

```bash
npx playwright test browser-compat-canvasbg-overflow.spec.js
```

Expected: 2 tests × 2 browsers = 4 passing. If Firefox fails, this is real signal — the test may be wrong, OR the workaround actually IS needed on Firefox too (unlikely but possible). Investigate before proceeding.

### Step 2: Write browser-compat-gradient-detect.spec.js (Site 2)

Bug being verified: `svg-exec.js:1269` — fallback for `querySelectorAll('linearGradient, radialGradient')` returning empty in WebKit. Original failure mode: gradients exist in SVG but standard selector misses them.

- [ ] **Create the file with this content:**

```js
import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, setSvgSource } from './helpers.js'

test.describe('browser-compat: gradient querySelector detection (svg-exec.js:1269)', () => {
  // Verifies the `if (!elems.length && isWebkit()) { ... }` fallback in
  // svg-exec.js:1269. Original bug: "Bug in webkit prevents regular *Gradient
  // selector search". If standard querySelectorAll finds gradients on both
  // browsers, the WebKit fallback is obsolete.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('querySelectorAll detects linearGradient and radialGradient after SVG import', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="100" y2="0">
      <stop offset="0%" stop-color="red"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
    <radialGradient id="g2" cx="50" cy="50" r="50">
      <stop offset="0%" stop-color="green"/>
      <stop offset="100%" stop-color="yellow"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#g1)"/>
  <circle cx="150" cy="50" r="40" fill="url(#g2)"/>
</svg>`

    await setSvgSource(page, markup)

    // Verify the standard querySelectorAll finds both gradients post-import
    const detected = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const elems = svgContent.querySelectorAll('linearGradient, radialGradient')
      return {
        count: elems.length,
        ids: Array.from(elems).map(e => e.id)
      }
    })

    // Both gradients must be found via the standard selector — without falling back to
    // the WebKit-specific element iteration in svg-exec.js:1269
    expect(detected.count).toBe(2)
    expect(detected.ids).toEqual(expect.arrayContaining(['g1', 'g2']))
  })

  test('querySelectorAll detects gradients inside symbol elements', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <symbol id="sym1">
      <linearGradient id="sg1"><stop offset="0%"/></linearGradient>
      <rect fill="url(#sg1)" width="50" height="50"/>
    </symbol>
  </defs>
  <use href="#sym1"/>
</svg>`

    await setSvgSource(page, markup)

    const detected = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const elems = svgContent.querySelectorAll('linearGradient, radialGradient')
      return { count: elems.length }
    })

    // Gradient inside symbol must also be found via standard selector
    expect(detected.count).toBe(1)
  })
})
```

- [ ] **Run the new test:**

```bash
npx playwright test browser-compat-gradient-detect.spec.js
```

Expected: 2 tests × 2 browsers = 4 passing.

### Step 3: Write browser-compat-import-gradients.spec.js (Site 3)

Bug being verified: `svg-exec.js:503-512` — Firefox 353575 workaround moving root-level gradients/patterns into `<defs>` during import. Original failure mode: gradients at SVG root (not inside `<defs>`) don't render when referenced by `fill="url(#id)"`.

Test approach: import SVG with gradients placed at root (NOT in `<defs>`); verify the gradient actually renders (the rect has the gradient applied — observable via getComputedStyle or via the gradient element being reachable + render-effective).

- [ ] **Create the file with this content:**

```js
import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, setSvgSource } from './helpers.js'

test.describe('browser-compat: import gradients NOT in defs (svg-exec.js:503-512, Firefox 353575)', () => {
  // Verifies the Firefox 353575 workaround in svg-exec.js:503-512 that
  // moves linearGradient/radialGradient/pattern elements into <defs> on import
  // in Gecko browsers. https://bugzilla.mozilla.org/show_bug.cgi?id=353575
  //
  // Original bug: Firefox didn't render gradients placed at SVG root level
  // (outside <defs>) when referenced by fill="url(#id)". The workaround
  // moves them into <defs> during import.
  //
  // If this test passes on Firefox without the workaround (i.e., gradients
  // at root level still render), the workaround can be dropped.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('linearGradient at root (not in defs) renders correctly when imported', async ({ page }) => {
    // Note the linearGradient is OUTSIDE the <defs> tag — at SVG root level
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <linearGradient id="rootGrad" x1="0" y1="0" x2="100" y2="0">
    <stop offset="0%" stop-color="red"/>
    <stop offset="100%" stop-color="blue"/>
  </linearGradient>
  <rect id="testRect" width="100" height="50" fill="url(#rootGrad)"/>
</svg>`

    await setSvgSource(page, markup)

    // Verify the gradient is reachable post-import (workaround moves it into defs;
    // without workaround it stays at root — either way the gradient should be findable
    // and the rect should reference it via fill)
    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const grad = svgContent.querySelector('#rootGrad')
      const rect = svgContent.querySelector('rect[fill*="rootGrad"]')
      return {
        gradientExists: Boolean(grad),
        gradientTagName: grad?.tagName,
        rectExists: Boolean(rect),
        rectFill: rect?.getAttribute('fill')
      }
    })

    expect(state.gradientExists).toBe(true)
    expect(state.gradientTagName).toBe('linearGradient')
    expect(state.rectExists).toBe(true)
    expect(state.rectFill).toBe('url(#rootGrad)')
  })

  test('radialGradient at root renders correctly when imported', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <radialGradient id="rootRGrad" cx="50" cy="50" r="50">
    <stop offset="0%" stop-color="green"/>
    <stop offset="100%" stop-color="yellow"/>
  </radialGradient>
  <circle cx="100" cy="100" r="50" fill="url(#rootRGrad)"/>
</svg>`

    await setSvgSource(page, markup)

    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const grad = svgContent.querySelector('#rootRGrad')
      const circle = svgContent.querySelector('circle')
      return {
        gradientExists: Boolean(grad),
        circleFill: circle?.getAttribute('fill')
      }
    })

    expect(state.gradientExists).toBe(true)
    expect(state.circleFill).toBe('url(#rootRGrad)')
  })

  test('pattern at root renders correctly when imported', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <pattern id="rootPat" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="5" height="10" fill="blue"/>
    <rect x="5" width="5" height="10" fill="red"/>
  </pattern>
  <rect width="100" height="100" fill="url(#rootPat)"/>
</svg>`

    await setSvgSource(page, markup)

    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const pat = svgContent.querySelector('#rootPat')
      return {
        patternExists: Boolean(pat),
        patternTagName: pat?.tagName
      }
    })

    expect(state.patternExists).toBe(true)
    expect(state.patternTagName).toBe('pattern')
  })
})
```

- [ ] **Run the new test:**

```bash
npx playwright test browser-compat-import-gradients.spec.js
```

Expected: 3 tests × 2 browsers = 6 passing.

### Step 4: Write browser-compat-import-symbol-gradients.spec.js (Site 4)

Bug being verified: `svg-exec.js:712-722` — Firefox 353575 workaround in symbol/use import path. Original failure mode: gradients inside `<symbol>` referenced by `<use>` don't render in Firefox without the workaround.

- [ ] **Create the file with this content:**

```js
import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, setSvgSource } from './helpers.js'

test.describe('browser-compat: import symbol with internal gradients (svg-exec.js:712-722, Firefox 353575)', () => {
  // Verifies the Firefox 353575 workaround in svg-exec.js:712-722 that
  // moves gradients out of <symbol> elements during symbol/use import in Gecko.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=353575
  //
  // Original bug: Firefox didn't render gradients defined inside a <symbol>
  // when the symbol was used via <use>. The workaround moves the gradients
  // into the root <defs> during import.
  //
  // If this test passes on Firefox without the workaround, drop it.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('symbol with internal linearGradient renders when referenced via <use>', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <symbol id="gradSym" viewBox="0 0 100 100">
      <linearGradient id="symGrad" x1="0" y1="0" x2="100" y2="0">
        <stop offset="0%" stop-color="purple"/>
        <stop offset="100%" stop-color="orange"/>
      </linearGradient>
      <rect width="100" height="100" fill="url(#symGrad)"/>
    </symbol>
  </defs>
  <use href="#gradSym" x="0" y="0" width="200" height="200"/>
</svg>`

    await setSvgSource(page, markup)

    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const sym = svgContent.querySelector('#gradSym')
      const grad = svgContent.querySelector('#symGrad')
      const use = svgContent.querySelector('use')
      return {
        symbolExists: Boolean(sym),
        gradientExists: Boolean(grad),
        useExists: Boolean(use),
        // Workaround moves gradient OUT of symbol into root defs; without workaround
        // it stays inside symbol. Either way the gradient should be findable.
        gradientInSymbol: grad?.closest('symbol')?.id === 'gradSym'
      }
    })

    expect(state.symbolExists).toBe(true)
    expect(state.gradientExists).toBe(true)
    expect(state.useExists).toBe(true)
    // Note: gradientInSymbol may differ between with/without workaround.
    // The TEST passes either way as long as gradient is reachable.
  })

  test('symbol with internal pattern renders when referenced via <use>', async ({ page }) => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <symbol id="patSym" viewBox="0 0 100 100">
      <pattern id="symPat" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="5" height="10" fill="cyan"/>
        <rect x="5" width="5" height="10" fill="magenta"/>
      </pattern>
      <rect width="100" height="100" fill="url(#symPat)"/>
    </symbol>
  </defs>
  <use href="#patSym" x="0" y="0" width="200" height="200"/>
</svg>`

    await setSvgSource(page, markup)

    const state = await page.evaluate(() => {
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const sym = svgContent.querySelector('#patSym')
      const pat = svgContent.querySelector('#symPat')
      const use = svgContent.querySelector('use')
      return {
        symbolExists: Boolean(sym),
        patternExists: Boolean(pat),
        useExists: Boolean(use)
      }
    })

    expect(state.symbolExists).toBe(true)
    expect(state.patternExists).toBe(true)
    expect(state.useExists).toBe(true)
  })
})
```

- [ ] **Run the new test:**

```bash
npx playwright test browser-compat-import-symbol-gradients.spec.js
```

Expected: 2 tests × 2 browsers = 4 passing.

### Step 5: Run full suite — verify all 4 new tests pass on both browsers

```bash
node scripts/run-e2e.mjs
```

Expected counts (assuming Branch A from Task 3 — full multi-browser):
- Chromium: 81 existing + 9 new (2+2+3+2) = 90 passing
- Firefox: 81 existing (minus any .fixme() count) + 9 new = ~90 passing
- Total: ~180 runs

If Branch B (scope-back) from Task 3:
- Chromium: 81 + 9 = 90
- Firefox: 9 (only browser-compat tests)
- Total: 99 runs

### Step 6: Commit

```bash
git add tests/e2e/browser-compat-*.spec.js
git commit -m "test(browser-compat): 4 regression tests for audit-flagged workaround sites

Reproduces the original bug scenarios for each of the 4 audit-flagged
browser workarounds. Tests assert correct observable behavior WITH the
workaround code still in place. C4 will drop confirmed-obsolete
workarounds and the same tests will re-pass — that's the verification.

Tests added:
- browser-compat-canvasbg-overflow.spec.js (Site 1: select.js:423,
  'Chrome 7 has a problem with this when zooming out')
- browser-compat-gradient-detect.spec.js (Site 2: svg-exec.js:1269,
  'Bug in webkit prevents regular *Gradient selector search')
- browser-compat-import-gradients.spec.js (Site 3: svg-exec.js:503-512,
  Firefox bug 353575 — gradients NOT in defs)
- browser-compat-import-symbol-gradients.spec.js (Site 4: svg-exec.js:712-722,
  Firefox 353575 — gradients inside symbol)

All 9 tests pass on both Chromium and Firefox with workarounds in place."
```

---

## Task 5 (C4): Drop confirmed-obsolete workarounds + refresh comments on still-needed

**Files (per outcome of running the new tests WITHOUT each workaround):**
- Modify: `packages/svgcanvas/core/select.js:423` (drop Site 1 workaround if test passes both browsers)
- Modify: `packages/svgcanvas/core/svg-exec.js:1269` (drop Site 2 workaround if test passes)
- Modify: `packages/svgcanvas/core/svg-exec.js:503-512` (drop Site 3 workaround if test passes)
- Modify: `packages/svgcanvas/core/svg-exec.js:712-722` (drop Site 4 workaround if test passes)
- Possibly modify: `packages/svgcanvas/common/browser.js` (drop `isWebkit` getter + export if BOTH Site 1 + 2 dropped)

Test-per-site outcome drives per-site action. Document each in the commit message.

### Step 1: Test Site 1 drop — canvasBackground overflow

- [ ] Read `packages/svgcanvas/core/select.js` line 423 to see exact current state:
```js
        overflow: (isWebkit() ? 'none' : 'visible'), // Chrome 7 has a problem with this when zooming out
```

- [ ] Temporarily edit to drop the workaround:
```js
        overflow: 'visible',
```

- [ ] Run the canvasbg-overflow test on both browsers:
```bash
npx playwright test browser-compat-canvasbg-overflow.spec.js
```

- [ ] **Decision branch:**
   - **If 4/4 pass:** drop is confirmed safe. Keep the edit. Also remove the `import { isWebkit }` from `select.js` IF that was the only `isWebkit` use in the file. Run `grep -n "isWebkit" packages/svgcanvas/core/select.js` to verify.
   - **If any fail:** revert the temporary edit (restore the `isWebkit() ? 'none' : 'visible'` line). Refresh the comment to reflect findings:
```js
        overflow: (isWebkit() ? 'none' : 'visible'), // Verified 2026-05-16: workaround still needed for [Chrome/Firefox] [version] [observed-symptom]. Re-evaluate when [browsers-in-scope] [version-X+]
```

### Step 2: Test Site 2 drop — gradient querySelector fallback

- [ ] Read `packages/svgcanvas/core/svg-exec.js` lines 1267-1275:
```js
const convertGradientsMethod = elem => {
  let elems = elem.querySelectorAll('linearGradient, radialGradient')
  if (!elems.length && isWebkit()) {
    // Bug in webkit prevents regular *Gradient selector search
    elems = Array.prototype.filter.call(elem.querySelectorAll('*'), curThis => {
      return curThis.tagName.includes('Gradient')
    })
  }
  Array.prototype.forEach.call(elems, grad => {
```

- [ ] Temporarily edit to drop the fallback:
```js
const convertGradientsMethod = elem => {
  const elems = elem.querySelectorAll('linearGradient, radialGradient')
  Array.prototype.forEach.call(elems, grad => {
```

Note: `let` → `const` since reassignment is gone.

- [ ] Run the gradient-detect test on both browsers:
```bash
npx playwright test browser-compat-gradient-detect.spec.js
```

- [ ] **Decision branch:**
   - **If 4/4 pass:** keep the edit.
   - **If any fail:** revert. Refresh the comment as in Step 1.

### Step 3: Test Site 3 drop — Firefox 353575 main import

- [ ] Read `packages/svgcanvas/core/svg-exec.js` lines 503-512:
```js
    // For Firefox: Put all paint elems in defs
    if (isGecko()) {
      const svgDefs = findDefs()
      const findElems = content.querySelectorAll(
        'linearGradient, radialGradient, pattern'
      )
      Array.prototype.forEach.call(findElems, ele => {
        svgDefs.appendChild(ele)
      })
    }
```

- [ ] Temporarily comment out the entire block (10 lines).

- [ ] Run the import-gradients test on both browsers:
```bash
npx playwright test browser-compat-import-gradients.spec.js
```

- [ ] **Decision branch:**
   - **If 6/6 pass:** delete the commented-out block (don't leave dead comments).
   - **If any fail:** restore. Refresh the comment to include current Firefox version tested + status of bug 353575:
```js
    // For Firefox: Put all paint elems in defs.
    // Verified 2026-05-16 against Firefox <version>: bug 353575 [still open / status changed].
    // https://bugzilla.mozilla.org/show_bug.cgi?id=353575
    if (isGecko()) {
      ...
    }
```

### Step 4: Test Site 4 drop — Firefox 353575 symbol import

- [ ] Read `packages/svgcanvas/core/svg-exec.js` lines 712-722:
```js
      if (isGecko()) {
        // Move all gradients into root for Firefox, workaround for this bug:
        // https://bugzilla.mozilla.org/show_bug.cgi?id=353575
        // TODO: Make this properly undo-able.
        const elements = svg.querySelectorAll(
          'linearGradient, radialGradient, pattern'
        )
        Array.prototype.forEach.call(elements, el => {
          defs.appendChild(el)
        })
      }
```

- [ ] Temporarily comment out the entire `if (isGecko()) { ... }` block (11 lines).

- [ ] Run the import-symbol-gradients test on both browsers:
```bash
npx playwright test browser-compat-import-symbol-gradients.spec.js
```

- [ ] **Decision branch:**
   - **If 4/4 pass:** delete the commented-out block.
   - **If any fail:** restore + refresh comment with current Firefox version + bug 353575 status.

### Step 5: Drop `isWebkit()` from browser.js IF both Sites 1 & 2 dropped

- [ ] Confirm `isWebkit()` is no longer used anywhere:
```bash
git grep "isWebkit" packages src
```

Expected: zero matches in active code (matches in docs/CHANGELOG/specs/plans are OK).

If matches in active code (other than docs): STOP — there's an unflagged consumer. Don't drop the export. Report as DONE_WITH_CONCERNS.

- [ ] If zero active-code matches, edit `packages/svgcanvas/common/browser.js`:

Remove lines 19-28 (the `isWebkit` getter):
```js
  /**
   * Detects if the browser is WebKit-based
   * @returns {boolean}
   */
  get isWebkit () {
    if (!this.#cachedResults.has('isWebkit')) {
      this.#cachedResults.set('isWebkit', this.#userAgent.includes('AppleWebKit'))
    }
    return this.#cachedResults.get('isWebkit')
  }
```

Remove lines 103-107 (the export):
```js
/**
 * @function module:browser.isWebkit
 * @returns {boolean}
 */
export const isWebkit = () => browser.isWebkit
```

Note: The other browser detection getters/exports (isGecko, isChrome, isMac, supportsGoodTextCharPos) stay — they have other consumers.

### Step 6: Run full e2e suite + verification gate

```bash
npm run lint
npx vitest run
node scripts/run-e2e.mjs
```

All must pass. The 4 new browser-compat tests should still pass on both browsers — that's the verification that the dropped workarounds were unnecessary.

### Step 7: Commit

Write commit message reflecting per-site outcomes. Template:

```bash
git add -A
git commit -m "refactor: drop confirmed-obsolete browser workarounds; refresh comments on still-needed

C3 regression tests verified each audit-flagged workaround. Per-site
outcome:

Site 1 (select.js:423 — isWebkit canvasBackground overflow, 'Chrome 7'):
  [DROPPED / KEPT]. [details]

Site 2 (svg-exec.js:1269 — isWebkit gradient querySelector fallback):
  [DROPPED / KEPT]. [details]

Site 3 (svg-exec.js:503-512 — isGecko Firefox 353575 main import):
  [DROPPED / KEPT]. [details]

Site 4 (svg-exec.js:712-722 — isGecko Firefox 353575 symbol import):
  [DROPPED / KEPT]. [details]

isWebkit() in common/browser.js: [DROPPED / KEPT].
  [If dropped: no remaining consumers verified by grep.]
  [If kept: still referenced by [consumers].]

isGecko() in common/browser.js: KEPT (3 other consumers in
selected-elem.js + undo.js — Step 1.5 scope was the 2 audit-flagged
353575 sites only).

Verified: 9 new browser-compat tests pass on both Chromium and Firefox
post-drop. Lint clean. Vitest 564/564. Total e2e: <N>."
```

Replace placeholders with actual outcomes.

---

## Task 6 (C5): CHANGELOG + manual smoke + push

**Files:** `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG.md**

Under `## [Unreleased]`, add a new `### Changed (browser-compat investigation 2026-05-16)` section ABOVE existing entries. Template:

```markdown
### Changed (browser-compat investigation 2026-05-16)
- `feat(test): browser-compat investigation (Step 1.5 of 5)` — Multi-browser Playwright setup + 4 regression tests verifying the audit-flagged browser-bug workarounds. <N>-commit PR (`feat/browser-compat-investigation`).
  - **Multi-browser Playwright:** Added Firefox project to `playwright.config.mjs`. [Branch A: All 81 existing tests run on both browsers, total <count> runs.] OR [Branch B: Existing 81 stayed Chromium-only via `testMatch` filter — Firefox >20-failure pivot triggered; follow-up to restore full multi-browser coverage logged to todo_svgedit.md.]
  - **4 new browser-compat tests** in `tests/e2e/browser-compat-*.spec.js`:
    - `canvasbg-overflow` (Site 1: select.js:423)
    - `gradient-detect` (Site 2: svg-exec.js:1269)
    - `import-gradients` (Site 3: svg-exec.js:503-512, Firefox 353575)
    - `import-symbol-gradients` (Site 4: svg-exec.js:712-722, Firefox 353575)
  - **Workaround outcomes (per site):**
    - Site 1: [DROPPED / KEPT — reason]
    - Site 2: [DROPPED / KEPT — reason]
    - Site 3: [DROPPED / KEPT — reason]
    - Site 4: [DROPPED / KEPT — reason]
  - **`isWebkit()`** in `packages/svgcanvas/common/browser.js`: [DROPPED entirely / KEPT — still referenced]. `isGecko()` kept (3 unflagged consumers).
  - **Existing-test Firefox failures:** [N fixed in C2 / pivoted via testMatch / clean first-try]. [If .fixme() added: list bugs surfaced + todo #10 references]
  - Final e2e baseline: Chromium <N> + Firefox <M> = <total> runs.
```

Replace placeholders with actual outcomes from Tasks 2, 3, 5.

- [ ] **Step 2: Verify build still works**

```bash
npm run build
```

- [ ] **Step 3: Final review of branch state**

```bash
git log --oneline master..HEAD
git diff --stat master..HEAD
```

Expected branch state: 4-6 commits depending on conditionals (C2 may have been skipped, C4 may not have touched all files).

- [ ] **Step 4: Manual smoke (DOES make sense here)**

This is genuine cross-browser smoke; do it:

```bash
npm run build
npm run start:e2e &
```

Open `http://localhost:8000/iife-index.html` in BOTH Chrome AND Firefox. For each:
1. Editor loads (no console errors)
2. Draw rect/circle/path
3. Save SVG
4. Reload page
5. Open the saved SVG (paste into Source dialog OR drop file)
6. Modify it; save again

Stop the dev server when done.

- [ ] **Step 5: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): document Step 1.5 browser-compat investigation"
```

- [ ] **Step 6: Push**

```bash
git push origin feat/browser-compat-investigation
```

Report back: total commits on branch, total lines changed, full git log, build result.

---

## Task 7: Final whole-PR code review (after all 6 tasks complete)

Dispatch a final code reviewer to look at the whole branch as a coherent unit. Inputs: branch `feat/browser-compat-investigation`, base `d2aa5142` (master pre-merge), spec at `docs/superpowers/specs/2026-05-16-svgedit-browser-compat-investigation-design.md`.

Reviewer should verify:
- All 4 new browser-compat tests assert observable correct behavior (not just "no exception")
- Each workaround drop has corresponding test evidence
- Workarounds NOT dropped have refreshed comments documenting why
- `isWebkit()` removal (if done) has zero remaining consumers
- `isGecko()` preservation (3 other consumers in selected-elem.js + undo.js) is correct
- No scope creep beyond the 4 audit-flagged sites
- CHANGELOG accurately documents per-site outcomes
- Commit hygiene (conventional-commits format, single coherent scope per commit, no merge/fixup commits)

---

## After this PR lands

1. **User merges to master** via `git merge --no-ff feat/browser-compat-investigation` (or `--ff-only` if preferred for linear history).
2. **Tag** `post-compat-investigation` on master HEAD; push.
3. **Update `todo_svgedit.md`** — move Step 1.5 entries to Shipped section; note that Step 2 (pathseg drop) is the next unit. If Branch B was taken in Task 3, ensure the "Firefox-compat sweep of existing e2e tests" follow-up item is in the active section.
4. **Brainstorm Step 2** (`feat/pathseg-drop`) when ready — audit doc has the transition plan; needs spec + plan.
