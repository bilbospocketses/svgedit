# TODO #18: Fork path-data-polyfill into Codebase

**Date:** 2026-05-26
**Status:** Design approved, pending implementation plan
**Goal:** Replace the `path-data-polyfill` npm dependency with a local TypeScript module exporting standalone functions, and migrate all 65 consumer sites to the new API.

## Context

`path-data-polyfill` (v1.0.10, MIT, 958 lines ES5) implements the SVG 2 `getPathData()`/`setPathData()` spec plus a legacy `pathSegList` compatibility getter. No browser ships native support as of 2026-05 (Chrome behind flag, Firefox partial, Safari nothing). The polyfill is still necessary.

Currently installed as an npm dependency, imported as a side-effect (`import 'path-data-polyfill'`) that monkey-patches `SVGPathElement.prototype`. Forking eliminates the external dependency, enables TypeScript typing, and lets us drop the prototype-patching pattern.

Upstream repo: `jarek-foksa/path-data-polyfill.js` — v1.0.10 is current with the latest commit (2025-04-23). Includes Firefox 137 fix and native `setPathData()` SVGPathSegment workaround.

## New Module: `packages/svgcanvas/core/path-data.ts`

### Exports

```ts
export interface SVGPathDataCommand {
  type: string
  values: number[]
}

export interface SVGPathDataSettings {
  normalize?: boolean
}

export function getPathData (el: SVGPathElement, settings?: SVGPathDataSettings): SVGPathDataCommand[]
export function setPathData (el: SVGPathElement, data: SVGPathDataCommand[]): void
export function parsePathData (d: string): SVGPathDataCommand[]
export function serializePathData (data: SVGPathDataCommand[]): string
```

### Caching

The original polyfill caches parsed path data on the element using Symbol keys and invalidates by intercepting `setAttribute('d', ...)` via prototype patch. The fork uses a `WeakMap<SVGPathElement, CachedData>` for the cache and does NOT intercept `setAttribute`. Callers that modify `d` via `setAttribute` must call `getPathData()` again to get fresh data (the WeakMap entry is keyed on the element, not the `d` value — a `d`-change-aware invalidation can be added later if profiling shows it matters).

### No pathSegList

The `pathSegList` compatibility layer is NOT exported. All consumers migrate to `getPathData`/`setPathData` directly.

## Consumer Migration

65 call sites across 6 production files + 7 test files.

### Pattern A: `getPathData` / `setPathData` (22 sites, 4 files)

```ts
// Before:
import 'path-data-polyfill'
const data = elem.getPathData()

// After:
import { getPathData } from './path-data.js'
const data = getPathData(elem)
```

### Pattern B: `pathSegList` (43 sites, 6 files)

```ts
// Before:
const segList = elem.pathSegList
const seg = segList.getItem(i)     // { pathSegType: 2, x: 10, y: 20 }
const len = segList.numberOfItems

// After:
import { getPathData } from './path-data.js'
const data = getPathData(elem)
const seg = data[i]                // { type: 'M', values: [10, 20] }
const len = data.length
```

Property mapping: `seg.pathSegType` (numeric) → `seg.type` (string letter). Positional properties (`seg.x`, `seg.y`, `seg.x1`, `seg.y1`, etc.) → `seg.values[]` array indexing. The existing `TYPE_TO_CMD` / `CMD_TO_TYPE` constants in the codebase bridge the two representations where needed.

### coords.ts special case

`coords.ts` has a `supportsPathData` flag branching between the two APIs. The `pathSegList` branch is deleted entirely — we always use `getPathData` now.

## Files Touched

| Category | Files | Work |
|---|---|---|
| **Create** | `packages/svgcanvas/core/path-data.ts` | 958-line ES5 IIFE → ~600-line TS module |
| **Remove dep** | `package.json`, `package-lock.json` | Drop `path-data-polyfill` dependency |
| **Remove vendor** | `scripts/copy-static.ts` | Remove vendor copy entry |
| **Migrate** | `packages/svgcanvas/svgcanvas.ts` | Remove side-effect import, import new module |
| **Migrate** | `packages/svgcanvas/core/path-method.ts` (8 sites) | `.getPathData()` → `getPathData(elem)` |
| **Migrate** | `packages/svgcanvas/core/path-actions.ts` (~14 sites) | Both APIs → standalone functions |
| **Migrate** | `packages/svgcanvas/core/coords.ts` (~8 sites) | Delete `supportsPathData` branch |
| **Migrate** | `packages/svgcanvas/core/path.ts` (~4 sites) | `pathSegList` → `getPathData` |
| **Migrate** | `packages/svgcanvas/core/utilities.ts` (~4 sites) | `pathSegList` → `getPathData` |
| **Migrate** | 6 test files + `tests/unit/setup-vitest.ts` | Remove side-effect import, import new module |

## End-State Gate

- tsc clean + lint clean + vitest 701/701 + e2e 250/250
- `grep -r "path-data-polyfill" --include="*.ts" --include="*.json" src/ packages/ tests/` → zero hits (except CHANGELOG/docs)
- `grep -r "pathSegList" --include="*.ts" packages/` → zero hits
- `path-data-polyfill` absent from `node_modules/` after `npm install`

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Fork timing | Now (browsers still don't ship native) | Polyfill is still necessary; forking eliminates external dep |
| TS conversion | Yes, as part of fork | Codebase is fully typed after #19; leaving an untyped island defeats the purpose |
| API shape | Standalone functions | No prototype monkey-patching; explicit imports |
| pathSegList | Migrate all sites to getPathData | Drop the legacy SVG 1.1 translation layer; one API |
| Caching | WeakMap (no setAttribute interception) | Simpler than prototype patching; callers re-fetch after mutations |
| PR count | Single PR | Migration is mechanical; single rollback point |
