# Path-Data-Polyfill Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `path-data-polyfill` npm dependency with a local TypeScript module (`path-data.ts`), migrate all 65 consumer sites to standalone functions, and eliminate the `pathSegList` wrapper.

**Architecture:** The 958-line ES5 IIFE polyfill becomes a proper TS module exporting `getPathData()`, `setPathData()`, `parsePathData()`, `serializePathData()`. The existing `PathDataListShim` in `path-method.ts` is removed; its `_entryToSeg()` conversion becomes a public `toPathSeg()` utility for consumers that need named properties. Consumer files switch from `elem.getPathData()` / `elem.pathSegList` to `getPathData(elem)` / `getPathData(elem).map(toPathSeg)`.

**Tech Stack:** TypeScript, SVG Path Data spec, WeakMap caching

**Repo:** `C:\Users\jscha\source\repos\svgedit`

**Git discipline:** `git -C "C:\Users\jscha\source\repos\svgedit"` for ALL git commands. Branch from `origin/master`. Merge via `gh pr checks --watch` then `gh pr merge --squash --delete-branch`.

---

## Task 1: Create `packages/svgcanvas/core/path-data.ts`

**Files:**
- Create: `packages/svgcanvas/core/path-data.ts`

Convert the polyfill from `node_modules/path-data-polyfill/path-data-polyfill.js` (958 lines ES5 IIFE) to a TypeScript module.

- [ ] **Step 1: Read the full polyfill source**

Read `node_modules/path-data-polyfill/path-data-polyfill.js` end to end. Identify the internal functions:
- `clonePathData(pathData)` — deep-clone path data array
- `absolutizePathData(pathData)` — convert relative commands to absolute
- `reducePathData(pathData)` — normalize to M/L/C/Z subset
- `Source` class — path string tokenizer/parser
- `parsePathDataString(string)` — parse `d` attribute string → path data array

And the prototype patches (which become standalone exports):
- `SVGPathElement.prototype.getPathData(settings?)` → `getPathData(el, settings?)`
- `SVGPathElement.prototype.setPathData(pathData)` → `setPathData(el, pathData)`

And the caching layer using Symbol keys → WeakMap.

- [ ] **Step 2: Create the TypeScript module**

Create `packages/svgcanvas/core/path-data.ts` with:

```ts
// Type definitions
export interface SVGPathDataCommand {
  type: string
  values: number[]
}

export interface SVGPathDataSettings {
  normalize?: boolean
}

// Public API
export function getPathData (el: SVGPathElement, settings?: SVGPathDataSettings): SVGPathDataCommand[]
export function setPathData (el: SVGPathElement, data: SVGPathDataCommand[]): void
export function parsePathData (d: string): SVGPathDataCommand[]
export function serializePathData (data: SVGPathDataCommand[]): string
```

Conversion rules:
- Remove the IIFE wrapper `(function() { ... })()` — module scope replaces it
- Convert `var` → `const`/`let`
- Add type annotations to all functions and variables
- Replace `SVGPathElement.prototype.getPathData = function(settings) { ... }` with standalone `export function getPathData(el: SVGPathElement, settings?: SVGPathDataSettings)`
- Replace `SVGPathElement.prototype.setPathData = function(pathData) { ... }` with standalone `export function setPathData(el: SVGPathElement, data: SVGPathDataCommand[])`
- Replace Symbol-based caching (`this[$cachedPathData]`) with `WeakMap<SVGPathElement, ...>`
- Remove the `setAttribute`/`setAttributeNS`/`removeAttribute`/`removeAttributeNS` prototype interceptors — callers will re-fetch via `getPathData()` after mutations
- Export `parsePathData` (currently `parsePathDataString`) and `serializePathData` (build from the `setPathData` serialization logic)
- The `Source` class and helper functions (`absolutizePathData`, `reducePathData`, `clonePathData`) become module-private (no `export`)

**Important:** Preserve ALL the polyfill's parsing logic exactly. This is a format conversion (ES5 → TS module), not a rewrite of parsing behavior. The arc-to-cubic conversion, the source tokenizer, the absolutization — all stay as-is with only syntactic modernization.

- [ ] **Step 3: Verify the module compiles**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force
```

Expected: clean (the new module compiles, nothing imports it yet so no consumer errors)

- [ ] **Step 4: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" add packages/svgcanvas/core/path-data.ts
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "feat: add path-data.ts — forked path-data-polyfill as TS module"
```

---

## Task 2: Refactor `path-method.ts` — extract `toPathSeg()`, remove `PathDataListShim`

**Files:**
- Modify: `packages/svgcanvas/core/path-method.ts`

The `PathDataListShim` class currently bridges `getPathData()`→`pathSegList` API. Extract the useful conversion functions as public utilities, then remove the shim class.

- [ ] **Step 1: Export `toPathSeg()` and `fromPathSeg()` as public functions**

Extract `_entryToSeg()` → public `toPathSeg(cmd: SVGPathDataCommand): PathSeg`
Extract `_segToEntry()` → public `fromPathSeg(seg: PathSeg): SVGPathDataCommand`

These are the existing conversion functions from `PathDataListShim`, just made standalone. Import `SVGPathDataCommand` from `./path-data.js`.

```ts
import { type SVGPathDataCommand } from './path-data.js'

export function toPathSeg (cmd: SVGPathDataCommand): PathSeg {
  // existing _entryToSeg logic
}

export function fromPathSeg (seg: PathSeg): SVGPathDataCommand {
  // existing _segToEntry logic (type + values array)
}
```

- [ ] **Step 2: Replace `PathDataListShim` usage inside `path-method.ts`**

The `Path` class in `path-method.ts` uses `this.elem.pathSegList` (which is a `PathDataListShim`). Replace with:

```ts
import { getPathData, setPathData } from './path-data.js'

// Before (inside Path class):
const data = this.elem.getPathData()
// After:
const data = getPathData(this.elem)

// Before:
this.elem.setPathData(data)
// After:
setPathData(this.elem, data)
```

- [ ] **Step 3: Remove `PathDataListShim` class and the `declare global` pathSegList augmentation**

Delete:
- The `PathDataListShim` class
- The `declare global { interface SVGPathElement { readonly pathSegList: PathDataListShim } }` block
- Any remaining `pathSegList` references in `path-method.ts`

Keep:
- `PathSeg` interface (used by consumers)
- `TYPE_TO_CMD` and `CMD_TO_TYPE` constants (used by `toPathSeg`/`fromPathSeg`)
- `toPathSeg()` and `fromPathSeg()` functions

- [ ] **Step 4: Verify**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force
```

This will show errors in files that still reference `pathSegList` — that's expected. Only `path-method.ts` itself should be clean.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" add packages/svgcanvas/core/path-method.ts
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "refactor: extract toPathSeg/fromPathSeg, remove PathDataListShim"
```

---

## Task 3: Migrate `path-actions.ts` (~14 sites)

**Files:**
- Modify: `packages/svgcanvas/core/path-actions.ts`

This file has the most `pathSegList` references (12) plus `getPathData` calls (4).

- [ ] **Step 1: Add imports**

```ts
import { getPathData, setPathData } from './path-data.js'
import { toPathSeg } from './path-method.js'
```

- [ ] **Step 2: Replace all `elem.pathSegList` references**

Pattern for indexed access:
```ts
// Before:
const seglist = drawnPath.pathSegList
const seg = seglist.getItem(i)
const len = seglist.numberOfItems

// After:
const data = getPathData(drawnPath)
const seg = toPathSeg(data[i]!)
const len = data.length
```

Pattern for direct `getPathData`:
```ts
// Before:
const data = drawnPath.getPathData()
// After:
const data = getPathData(drawnPath)
```

Apply to all ~14 sites. Read each call site carefully — some access `seg.x`, `seg.y` (need `toPathSeg`), others just need `data.length` (no conversion needed).

- [ ] **Step 3: Verify + commit**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force
git -C "C:\Users\jscha\source\repos\svgedit" add packages/svgcanvas/core/path-actions.ts
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "refactor: migrate path-actions.ts from pathSegList to standalone getPathData"
```

---

## Task 4: Migrate `coords.ts` (~8 sites)

**Files:**
- Modify: `packages/svgcanvas/core/coords.ts`

This file has the `supportsPathData` branching pattern. Delete the entire `pathSegList` branch — we always use `getPathData` now.

- [ ] **Step 1: Add import and delete the `supportsPathData` branch**

```ts
import { getPathData } from './path-data.js'
```

Delete the `supportsPathData` flag, the `segList` variable, and the entire `else` branch that uses `segList.getItem(i)`. Keep only the `getPathData` branch (already written at lines 347-392).

Replace `selectedPath.getPathData()` with `getPathData(selectedPath)`.

- [ ] **Step 2: Verify + commit**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force
git -C "C:\Users\jscha\source\repos\svgedit" add packages/svgcanvas/core/coords.ts
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "refactor: migrate coords.ts to standalone getPathData, delete pathSegList branch"
```

---

## Task 5: Migrate `path.ts` + `utilities.ts` (~7 sites)

**Files:**
- Modify: `packages/svgcanvas/core/path.ts` (~4 pathSegList sites)
- Modify: `packages/svgcanvas/core/utilities.ts` (~3 pathSegList sites)

- [ ] **Step 1: Migrate `path.ts`**

```ts
import { getPathData } from './path-data.js'
import { toPathSeg } from './path-method.js'

// Before:
const list = pathElem.pathSegList
// After:
const data = getPathData(pathElem)

// Before:
const seg = list.getItem(i)
// After:
const seg = toPathSeg(data[i]!)
```

- [ ] **Step 2: Migrate `utilities.ts`**

Same pattern. `utilities.ts` has ~3 `pathSegList` references in the `getBBox`/`convertToPath` area.

- [ ] **Step 3: Verify + commit**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force
git -C "C:\Users\jscha\source\repos\svgedit" add packages/svgcanvas/core/path.ts packages/svgcanvas/core/utilities.ts
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "refactor: migrate path.ts + utilities.ts to standalone getPathData"
```

---

## Task 6: Migrate `svgcanvas.ts` + test files, drop npm dependency

**Files:**
- Modify: `packages/svgcanvas/svgcanvas.ts`
- Modify: `tests/unit/setup-vitest.ts`
- Modify: `tests/unit/draw.test.ts`
- Modify: `tests/unit/path-actions.test.ts`
- Modify: `tests/unit/path.test.ts`
- Modify: `tests/unit/text-actions.test.ts`
- Modify: `tests/unit/utilities-bbox.test.ts`
- Modify: `tests/unit/utilities-performance.test.ts`
- Modify: `scripts/copy-static.ts`
- Modify: `package.json`

- [ ] **Step 1: Replace side-effect import in `svgcanvas.ts`**

```ts
// Before:
import 'path-data-polyfill'
// After:
import './core/path-data.js'  // initialize polyfill (registers nothing — just ensures module is loaded for tree-shaking)
```

Actually, with standalone functions, no side-effect import is needed at all. The module is imported by the files that use it (`path-method.ts`, `path-actions.ts`, `coords.ts`, etc.). Remove the `import 'path-data-polyfill'` line entirely.

- [ ] **Step 2: Update test files**

Remove `import 'path-data-polyfill'` from all 6 test files:
- `tests/unit/draw.test.ts`
- `tests/unit/path-actions.test.ts`
- `tests/unit/path.test.ts`
- `tests/unit/text-actions.test.ts`
- `tests/unit/utilities-bbox.test.ts`
- `tests/unit/utilities-performance.test.ts`

In `tests/unit/setup-vitest.ts`, remove:
- The comment about `path-data-polyfill` loading order
- The `await import('path-data-polyfill')` line
- Any SVGPathElement prototype setup that was only needed for the polyfill

Tests should work because the production code (`path-method.ts`, etc.) imports `path-data.ts` directly — the polyfill logic runs when those modules load.

- [ ] **Step 3: Remove vendor copy from `scripts/copy-static.ts`**

Remove the line:
```ts
['node_modules/path-data-polyfill/path-data-polyfill.js', 'tests/vendor/path-data-polyfill/path-data-polyfill.js'],
```

Delete `tests/vendor/path-data-polyfill/` directory if it exists.

- [ ] **Step 4: Remove npm dependency**

```
cd "C:\Users\jscha\source\repos\svgedit" && npm uninstall path-data-polyfill
```

- [ ] **Step 5: Verify full gate**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force
cd "C:\Users\jscha\source\repos\svgedit" && npm run lint
cd "C:\Users\jscha\source\repos\svgedit" && npx vitest run
```

Expected: tsc clean, lint clean, vitest 701/701.

- [ ] **Step 6: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" add -A
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "chore: remove path-data-polyfill npm dependency, update test imports"
```

---

## Task 7: Gate verification + CHANGELOG + PR

- [ ] **Step 1: Run e2e**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsx scripts/run-e2e.ts
```

Expected: 250/250.

- [ ] **Step 2: Verify zero references to old polyfill**

```
grep -rn "path-data-polyfill" --include="*.ts" --include="*.json" src/ packages/ tests/ scripts/
grep -rn "pathSegList" --include="*.ts" packages/
```

Expected: zero hits for both (except CHANGELOG/docs).

- [ ] **Step 3: Update CHANGELOG.md**

Add a `### Changed (TODO #18 — fork path-data-polyfill — 2026-05-26)` section.

- [ ] **Step 4: Commit CHANGELOG, push, create PR**

```
git -C "C:\Users\jscha\source\repos\svgedit" add CHANGELOG.md
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "docs: CHANGELOG for #18 path-data-polyfill fork"
git -C "C:\Users\jscha\source\repos\svgedit" push origin <branch-name> -u
gh pr create --repo bilbospocketses/svgedit --base master --head <branch-name> ...
```

- [ ] **Step 5: Wait for checks, merge**

```
gh pr checks <N> --repo bilbospocketses/svgedit --watch
gh pr merge <N> --repo bilbospocketses/svgedit --squash --delete-branch
```

- [ ] **Step 6: Update TODO #18 in memory**

Mark as SHIPPED in `todo_svgedit.md`. Update active count and project_index.md.
