# svgedit pathseg drop implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `pathseg` polyfill — drop the runtime dep, refactor 8 `createSVGPathSeg*` sites in `path-actions.js` to native `setPathData`, swap the test environment to `path-data-polyfill` so jsdom has `getPathData`/`setPathData` (which then lets the existing `PathDataListShim` install `pathSegList` for un-refactored consumers).

**Architecture:** 3-commit phased PR. C1 swaps test environment (mechanical). C2 does the production refactor + drops the runtime polyfill import. C3 cleans up `package.json` + `copy-static.mjs`. Each commit gate-tested independently so any regression is bisect-clean.

**Tech Stack:** Vitest 4 (jsdom), Playwright 1.57 (Chromium + Firefox), Vite 7, `standard` linter, `path-data-polyfill` (new devDep — SVG 2 spec polyfill).

**Spec:** `docs/superpowers/specs/2026-05-16-svgedit-pathseg-drop-design.md`

**Prerequisites:** branch `feat/pathseg-drop` already cut off master (`c70dda94`) with spec committed at `27bb95ba`.

---

## File structure

| Operation | File | Commit |
|---|---|---|
| Modify | `tests/unit/path.test.js` line 2 | C1 |
| Modify | `tests/unit/path-actions.test.js` line 1 | C1 |
| Modify | `tests/unit/text-actions.test.js` line 1 | C1 |
| Modify | `tests/unit/draw.test.js` line 1 | C1 |
| Modify | `tests/unit/utilities-bbox.test.js` line 2 | C1 |
| Modify | `tests/unit/utilities-performance.test.js` line 2 | C1 |
| Modify | `package.json` add `path-data-polyfill` to `devDependencies` | C1 |
| Modify | `packages/svgcanvas/core/path-actions.js` 8 sites (close-path block, next-point block, link-close-path block, fixEnd block) | C2 |
| Modify | `packages/svgcanvas/svgcanvas.js` line 10 (drop `import 'pathseg'`) | C2 |
| Modify | `package.json` remove `pathseg` from `dependencies` | C3 |
| Modify | `scripts/copy-static.mjs` remove pathseg copy line | C3 |
| Modify | `CHANGELOG.md` add `[Unreleased]` entry | C3 |

---

## Per-commit verification gate

Run after every commit's edits, BEFORE `git commit`:

```bash
npm run lint
npx vitest run
node scripts/run-e2e.mjs
npm run build
```

Expected baselines (Step 1.5 + Enter/Escape baseline):
- Lint: clean
- Vitest: 564 passing, 41 files
- E2e: 192 passed, 0 skipped (Chromium 96 + Firefox 96)
- Build: clean

If a gate fails, fix before committing — never commit broken state.

---

## Task 1 (C1): Test environment swap

**Files:**
- Modify: `tests/unit/path.test.js`, `tests/unit/path-actions.test.js`, `tests/unit/text-actions.test.js`, `tests/unit/draw.test.js`, `tests/unit/utilities-bbox.test.js`, `tests/unit/utilities-performance.test.js`
- Modify: `package.json`

### Step 1: Add `path-data-polyfill` to devDependencies

```bash
npm install --save-dev path-data-polyfill
```

Expected: `package.json` `devDependencies` gains `"path-data-polyfill": "^x.y.z"`, `package-lock.json` regenerates.

### Step 2: Verify the package installed

```bash
ls node_modules/path-data-polyfill/
```

Expected: directory exists with `package.json`, the polyfill file.

### Step 3: Swap import in `tests/unit/path.test.js`

Read the file. Current line 2: `import 'pathseg'`. Replace with `import 'path-data-polyfill'`. Note: the line 1 `/* globals SVGPathSeg */` should ALSO be reviewed — `SVGPathSeg` global was provided by the pathseg polyfill; check if any test code in the file references it. If not used, drop the eslint comment too. If used, keep the comment but the test code itself may need to be updated in this commit OR flagged for follow-up.

```bash
grep -n "SVGPathSeg" tests/unit/path.test.js
```

If `SVGPathSeg` is grep-found in test assertions (not just the `/* globals */` comment), STOP and report — the test depends on pathseg's global, not just its side effect. The refactor scope may need to expand. If only the comment hits, drop the comment too.

Edit (illustrative — adjust based on grep result):

```js
// Before (line 1-2):
/* globals SVGPathSeg */
import 'pathseg'

// After (assuming SVGPathSeg not used):
import 'path-data-polyfill'

// After (if SVGPathSeg IS used — STOP and report first):
// (handle case-by-case)
```

### Step 4: Swap imports in the other 5 test files

```bash
grep -l "import 'pathseg'" tests/unit/
```

Expected: `tests/unit/{path-actions,text-actions,draw,utilities-bbox,utilities-performance}.test.js` (path.test.js already done).

For each: read the file, replace `import 'pathseg'` with `import 'path-data-polyfill'`. If a `/* globals SVGPathSeg */` line is present and unused (grep confirms no SVGPathSeg references in the file), drop it too.

### Step 5: Run vitest

```bash
npx vitest run 2>&1 | grep -E "Test Files|Tests"
```

Expected: `Tests 564 passed (564)`. Same count as before — the swap is import-only.

If any test fails: investigate per-test. Likely root cause: the test uses a pathseg API NOT covered by `path-data-polyfill`'s SVG 2 API + the `PathDataListShim`'s old-API delegation. Report which test + the failure for re-design.

### Step 6: Run lint

```bash
npm run lint 2>&1 | tail -3
```

Expected: clean.

### Step 7: Commit C1

```bash
git -C C:/Users/jscha/source/repos/svgedit add -A
git -C C:/Users/jscha/source/repos/svgedit commit -m "chore(test): swap pathseg polyfill for path-data-polyfill (C1 of 3)

Test env swap. 6 unit-test files updated from \`import 'pathseg'\` to
\`import 'path-data-polyfill'\` so jsdom gets the SVG 2 getPathData/
setPathData APIs (which then lets PathDataListShim auto-install
pathSegList for un-refactored consumers in path-actions.js).

\`path-data-polyfill\` added to devDependencies. \`pathseg\` runtime
dep still present — dropped in C3 after C2's production refactor.

Verified: lint clean, vitest 564/564 unchanged."
```

---

## Task 2 (C2): Production refactor + drop runtime polyfill import

**Files:**
- Modify: `packages/svgcanvas/core/path-actions.js` — 8 sites in 4 blocks
- Modify: `packages/svgcanvas/svgcanvas.js` line 10

### Step 1: Refactor close-path block (Sites 1, 2, 3)

Read `path-actions.js` around lines 425-440 to confirm current state. Expected:

```js
if (i <= 1 && len >= 2) {
  // Create end segment
  const absX = seglist.getItem(0).x
  const absY = seglist.getItem(0).y

  sSeg = stretchy.pathSegList.getItem(1)
  newseg = sSeg.pathSegType === 4
    ? drawnPath.createSVGPathSegLinetoAbs(absX, absY)
    : drawnPath.createSVGPathSegCurvetoCubicAbs(absX, absY, sSeg.x1 / zoom, sSeg.y1 / zoom, absX, absY)

  const endseg = drawnPath.createSVGPathSegClosePath()
  seglist.appendItem(newseg)
  seglist.appendItem(endseg)
}
```

Replace with:

```js
if (i <= 1 && len >= 2) {
  // Create end segment
  const absX = seglist.getItem(0).x
  const absY = seglist.getItem(0).y

  sSeg = stretchy.pathSegList.getItem(1)
  const newEntry = sSeg.pathSegType === 4
    ? { type: 'L', values: [absX, absY] }
    : { type: 'C', values: [absX, absY, sSeg.x1 / zoom, sSeg.y1 / zoom, absX, absY] }

  const data = drawnPath.getPathData()
  data.push(newEntry, { type: 'Z', values: [] })
  drawnPath.setPathData(data)
}
```

Note: dropped the now-unused `newseg` / `endseg` variables; new code uses `newEntry`. The outer `let newseg` / `let sSeg` declarations a few lines above still need a check — see Step 5 final cleanup.

### Step 2: Refactor next-point block (Sites 4, 5)

Read `path-actions.js` around lines 485-510 to confirm current state. Expected:

```js
// Use the segment defined by stretchy
sSeg = stretchy.pathSegList.getItem(1)
newseg = sSeg.pathSegType === 4
  ? drawnPath.createSVGPathSegLinetoAbs(svgCanvas.round(x), svgCanvas.round(y))
  : drawnPath.createSVGPathSegCurvetoCubicAbs(
      svgCanvas.round(x),
      svgCanvas.round(y),
      sSeg.x1 / zoom,
      sSeg.y1 / zoom,
      svgCanvas.round(x),
      svgCanvas.round(y)
    )
seglist.appendItem(newseg)
```

Replace with:

```js
// Use the segment defined by stretchy
sSeg = stretchy.pathSegList.getItem(1)
const rx = svgCanvas.round(x)
const ry = svgCanvas.round(y)
const nextEntry = sSeg.pathSegType === 4
  ? { type: 'L', values: [rx, ry] }
  : { type: 'C', values: [rx, ry, sSeg.x1 / zoom, sSeg.y1 / zoom, rx, ry] }
const data = drawnPath.getPathData()
data.push(nextEntry)
drawnPath.setPathData(data)
```

### Step 3: Refactor link-close-path block (Sites 6, 7)

Read `path-actions.js` around lines 1025-1040 to confirm current state. Expected:

```js
if (openPt !== false) {
  // Close this path

  // Create a line going to the previous "M"
  const newseg = elem.createSVGPathSegLinetoAbs(startItem.x, startItem.y)

  const closer = elem.createSVGPathSegClosePath()
  if (openPt === path.segs.length - 1) {
    list.appendItem(newseg)
    list.appendItem(closer)
  } else {
    list.insertItemBefore(closer, openPt)
    list.insertItemBefore(newseg, openPt)
  }

  path.init().selectPt(openPt + 1)
  return
}
```

Replace with:

```js
if (openPt !== false) {
  // Close this path
  const data = elem.getPathData()
  const lineEntry = { type: 'L', values: [startItem.x, startItem.y] }
  const closeEntry = { type: 'Z', values: [] }
  if (openPt === path.segs.length - 1) {
    data.push(lineEntry, closeEntry)
  } else {
    // Insert lineEntry then closeEntry at openPt (preserves original order)
    data.splice(openPt, 0, lineEntry, closeEntry)
  }
  elem.setPathData(data)

  path.init().selectPt(openPt + 1)
  return
}
```

Note: original used `list.insertItemBefore(closer, openPt)` then `list.insertItemBefore(newseg, openPt)`. The first insert puts `closer` at index `openPt`. The second insert puts `newseg` at index `openPt`, shifting `closer` to `openPt+1`. Final order at `openPt`/`openPt+1` is: `newseg` then `closer`. The refactored `data.splice(openPt, 0, lineEntry, closeEntry)` produces the same final order.

### Step 4: Refactor fixEnd block (Site 8)

Read `path-actions.js` around lines 1225-1240 to confirm current state. Expected:

```js
if (item.pathSegType === 1) { // 1 => Z segment type (close path)
  const prev = segList.getItem(i - 1)
  if (prev.x !== lastM.x || prev.y !== lastM.y) {
    // Add an L segment here
    const newseg = elem.createSVGPathSegLinetoAbs(lastM.x, lastM.y)
    segList.insertItemBefore(newseg, i)
    pathActionsMethod.fixEnd(elem)
    break
  }
}
```

Replace with:

```js
if (item.pathSegType === 1) { // 1 => Z segment type (close path)
  const prev = segList.getItem(i - 1)
  if (prev.x !== lastM.x || prev.y !== lastM.y) {
    // Add an L segment here
    const data = elem.getPathData()
    data.splice(i, 0, { type: 'L', values: [lastM.x, lastM.y] })
    elem.setPathData(data)
    pathActionsMethod.fixEnd(elem)
    break
  }
}
```

### Step 5: Drop the unused `let newseg` declarations in the function scope

After Steps 1-2, the original `let newseg` (declared somewhere above the close-path block, used by both Site 1 and Site 4 blocks) becomes unused. Read the function to find the declaration; if no remaining use, drop it. Same check for `let sSeg` — still used in Steps 1-2 reads (`sSeg = stretchy.pathSegList.getItem(1)`), so keep that one.

```bash
grep -n "let newseg\|newseg " packages/svgcanvas/core/path-actions.js
```

If only the declaration line + no remaining references in the same function, remove the declaration. If used elsewhere, leave alone.

### Step 6: Drop the runtime polyfill import

Read `packages/svgcanvas/svgcanvas.js` line 10. Expected:

```js
import 'pathseg' // SVGPathSeg Polyfill (see https://github.com/progers/pathseg)
```

Replace with: delete the line entirely. Also delete the `/* globals SVGPathSeg */` declaration on line 1 if present and now unused (grep `SVGPathSeg` in `svgcanvas.js` to confirm).

### Step 7: Run lint

```bash
npm run lint 2>&1 | tail -3
```

Expected: clean.

### Step 8: Run vitest

```bash
npx vitest run 2>&1 | grep -E "Test Files|Tests"
```

Expected: `Tests 564 passed (564)`. The unit tests don't run the production save path through the editor UI; they exercise individual modules. If a test exercises the refactored `path-actions.js` code paths, those paths now use `setPathData` which jsdom + path-data-polyfill (added in C1) supports.

If a test fails: read its assertion. Likely either (a) a test asserts old pathseg-specific behavior that's no longer exercised, or (b) the refactor introduced a real semantic bug. Investigate per-test.

### Step 9: Build

```bash
npm run build 2>&1 | tail -3
```

Expected: clean (`✓ built in NNNms` + `Bundled 11 extensions`).

### Step 10: Run full e2e

```bash
node scripts/run-e2e.mjs 2>&1 | tail -5
```

Expected: `192 passed (Nm)`. No skipped. Both browsers.

If e2e fails: the refactor changed real-browser path drawing behavior. Investigate the failing spec; isolate via `npx playwright test --project=<browser> path/to/spec.js`. The 9 browser-compat tests + 4 svgcore-remap/recalculate-extra tests are the most likely catchers since they exercise path data deeply.

### Step 11: Commit C2

```bash
git -C C:/Users/jscha/source/repos/svgedit add -A
git -C C:/Users/jscha/source/repos/svgedit commit -m "refactor(path-actions): drop createSVGPathSeg* for setPathData (C2 of 3)

Refactors 8 sites in path-actions.js from drawnPath.createSVGPathSeg*(...)
+ seglist.appendItem(seg) to data = drawnPath.getPathData(); data.push/
splice({type, values}); drawnPath.setPathData(data). Per audit's chosen
style (\`setPathData\` with plain objects, not fallback pattern).

Sites refactored:
- Close-path block (was lines ~431, 432, 434): L + Z append after click on first point
- Next-point block (was lines ~487, 491): L or C append per stretchy type
- Link-close-path block (was lines ~1028, 1030): L + Z insert/append
- fixEnd block (was line ~1232): L insert before Z when prev != lastM

Drops \`import 'pathseg'\` from svgcanvas.js. Runtime polyfill is no
longer needed; jsdom test env covered by path-data-polyfill from C1.

Verified: lint clean, vitest 564/564 unchanged, e2e 192 passed both
browsers, build clean."
```

---

## Task 3 (C3): Dep cleanup + CHANGELOG

**Files:**
- Modify: `package.json` (remove `pathseg` from `dependencies`)
- Modify: `scripts/copy-static.mjs` (remove polyfill copy line)
- Modify: `CHANGELOG.md` (add `[Unreleased]` entry)

### Step 1: Remove `pathseg` from `package.json` dependencies

```bash
npm uninstall pathseg
```

Expected: `pathseg` gone from `package.json` `dependencies`, `package-lock.json` updated.

### Step 2: Verify pathseg is gone

```bash
grep -n "pathseg" package.json
```

Expected: zero hits in `dependencies` / `devDependencies`. (If `path-data-polyfill` is the only line containing the string `path` near `pathseg`, that's fine — different package.)

### Step 3: Remove the copy-static line

Read `scripts/copy-static.mjs`. Find the line `['node_modules/pathseg/pathseg.js', 'tests/vendor/pathseg/pathseg.js']` (currently line 20). Delete it. Adjust trailing comma on the previous line if needed.

Before:
```js
  ['src/editor/tests', 'tests'],
  ['node_modules/pathseg/pathseg.js', 'tests/vendor/pathseg/pathseg.js']
]
```

After:
```js
  ['src/editor/tests', 'tests']
]
```

### Step 4: Run lint

```bash
npm run lint 2>&1 | tail -3
```

Expected: clean.

### Step 5: Run vitest

```bash
npx vitest run 2>&1 | grep -E "Test Files|Tests"
```

Expected: `Tests 564 passed (564)`.

### Step 6: Run build

```bash
npm run build 2>&1 | tail -3
```

Expected: clean. The build will no longer copy `pathseg.js` to `dist/editor/tests/vendor/pathseg/`. That's fine — production code doesn't import it (C2 dropped the import) and tests don't use the vendored copy (they import from node_modules in unit tests, which is npm devDep `path-data-polyfill` now).

### Step 7: Run full e2e

```bash
node scripts/run-e2e.mjs 2>&1 | tail -5
```

Expected: `192 passed`. The e2e harness runs in the built dist, so verify the dist works without the pathseg vendored copy.

### Step 8: Add CHANGELOG entry

Read `CHANGELOG.md`. Under `## [Unreleased]`, add a new entry at the top:

```markdown
### Changed (pathseg polyfill drop 2026-05-16)
- `refactor(path-actions): drop pathseg polyfill (Step 2 of 5)` — 3-commit PR (`feat/pathseg-drop`). Removes `pathseg` runtime dep + import. 8 sites in `packages/svgcanvas/core/path-actions.js` refactored from `createSVGPathSeg*` constructors + `seglist.appendItem(seg)` to native `getPathData()` + `data.push/splice({type, values})` + `setPathData(data)`. Test env swapped to `path-data-polyfill` (new devDep; SVG 2 spec polyfill) so jsdom keeps working — `PathDataListShim` continues to handle un-refactored `pathSegList` consumers via delegation. Modern browsers (Chromium 132+, Firefox) ship native `getPathData`/`setPathData` so no production polyfill needed; Step 1.5 work proved both browsers' implementations. Verified: lint clean, vitest 564/564 unchanged, e2e 192 passed both browsers, build clean.
```

### Step 9: Final verification gate

```bash
npm run lint
npx vitest run 2>&1 | grep -E "Test Files|Tests"
node scripts/run-e2e.mjs 2>&1 | tail -5
npm run build 2>&1 | tail -3
```

All must pass. The full gate set, one last time.

### Step 10: Commit C3

```bash
git -C C:/Users/jscha/source/repos/svgedit add -A
git -C C:/Users/jscha/source/repos/svgedit commit -m "chore(deps): remove pathseg + CHANGELOG (C3 of 3)

Final pathseg cleanup. \`pathseg\` removed from package.json
dependencies; copy-static.mjs no longer copies the vendored polyfill
to dist/editor/tests/vendor/pathseg/ (no consumers post C2).
CHANGELOG entry under [Unreleased] documents Step 2 ship.

Verified: lint clean, vitest 564/564, e2e 192 passed, build clean."
```

---

## Task 4: Manual cross-browser smoke

**Files:** none (interactive verification).

### Step 1: Build + start vite preview

```bash
npm run build
npx vite preview --host --port 8000 --strictPort --outDir dist/editor
```

(Run vite preview in background or separate terminal.)

### Step 2: User smoke (Edge + Firefox)

Per audit's path-edit checklist:

1. Draw a 3+ point path (path tool, click 3+ places, Enter to finish) → save SVG via Save → reload page → re-open the saved SVG via Source dialog paste OR Open
2. Toggle a path segment between line ↔ curve (path-edit mode, right-click node, select "Add line" / "Add curve" / similar context menu)
3. Add a node to an existing path (click on a path segment in path-edit mode); delete a node (right-click → delete or keyboard delete)
4. Open a path with absolute + relative segments + closepath via Source dialog paste — e.g., `M 10,10 L 50,10 l 0,40 z` — verify it imports cleanly and is editable

Verify both browsers show no console errors and visual rendering matches.

### Step 3: Stop dev server

```bash
# Kill the vite preview process started in Step 1
```

---

## Task 5: Push + merge

**Files:** none.

### Step 1: Push branch to origin

```bash
git -C C:/Users/jscha/source/repos/svgedit push -u origin feat/pathseg-drop
```

### Step 2: Review branch state

```bash
git -C C:/Users/jscha/source/repos/svgedit log --oneline master..HEAD
git -C C:/Users/jscha/source/repos/svgedit diff --stat master..HEAD
```

Expected: 4 commits (spec `27bb95ba` + C1 + C2 + C3). Stat: small net negative (drops more than adds).

### Step 3: Merge to master via --no-ff

```bash
git -C C:/Users/jscha/source/repos/svgedit checkout master
git -C C:/Users/jscha/source/repos/svgedit merge --no-ff feat/pathseg-drop -m "Merge branch 'feat/pathseg-drop' (Step 2 of 5)"
git -C C:/Users/jscha/source/repos/svgedit push origin master
```

### Step 4: Tag

```bash
git -C C:/Users/jscha/source/repos/svgedit tag post-pathseg-drop
git -C C:/Users/jscha/source/repos/svgedit push origin post-pathseg-drop
```

### Step 5: Report

Report: merge SHA, master HEAD, tag pushed, final test counts.

---

## After this PR lands

1. **Update `todo_svgedit.md`** — move #6 from active to Shipped (with reference to merge SHA + this plan). #6's "Other dep bumps" section becomes new follow-up or stays under #6's heading.
2. **Update `project_index.md`** — bump active count, last-updated.
3. **`do that thing` wrap-up** — claude-config CHANGELOG entry, memory sweep.
4. **Brainstorm Step 3** — TS migration. Spec + plan already on master from prior session; brainstorm picks up the open architectural decisions (TS strict-mode level, linter swap, wire-methods resolution, etc.) flagged in audit § Open decisions deferred to brainstorming.
