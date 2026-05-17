# svgedit pathseg drop — design spec

**Status:** Approved (brainstorm 2026-05-16). Step 2 of the 5-PR migration sequence.

**Inputs:** `docs/AUDIT_2026-05-16.md` § pathseg-drop transition plan; `todo_svgedit.md` #6; `PathDataListShim` in `packages/svgcanvas/core/path-method.js:45-200`; Step 1.5 work proving modern browser native `getPathData`/`setPathData` support.

---

## Migration position

| Step | Status |
|---|---|
| 1 — pre-migration cleanup | ✓ shipped (merge `d2aa5142`) |
| 1.5 — browser-compat investigation | ✓ shipped (merge `911e3a23`) |
| post-Step-1.5 cleanup wave | ✓ shipped (merges `e2496ba2` → `c70dda94`) |
| **2 — pathseg drop** | **THIS SPEC** |
| 3 — TS migration | spec + plan already on master, awaiting Step 2 |
| 4 — elix → Lit | needs spec |

---

## Scope

**Drop** the `pathseg` polyfill (runtime dep + 1 import in production + 6 imports in tests + 1 copy-static line).

**Refactor** 8 sites in `packages/svgcanvas/core/path-actions.js` from `drawnPath.createSVGPathSeg*(...)` + `seglist.appendItem(seg)` → `data = drawnPath.getPathData(); data.push({type, values}); drawnPath.setPathData(data)`.

**Swap** test env to `path-data-polyfill` (SVG 2 spec polyfill) so jsdom has `getPathData`/`setPathData` and the existing `PathDataListShim` auto-installs `pathSegList` for un-refactored consumers.

**Branch:** `feat/pathseg-drop` off master (`c70dda94`).

### In scope

- 8 `createSVGPathSeg*` call sites in `path-actions.js` (lines 419, 420, 422, 474, 475, 1028, 1030, 1235)
- `import 'pathseg'` in `packages/svgcanvas/svgcanvas.js:10`
- 6 test files with `import 'pathseg'`: `tests/unit/{path,path-actions,text-actions,draw,utilities-bbox,utilities-performance}.test.js`
- `package.json` `dependencies.pathseg` → removed
- `package.json` `devDependencies.path-data-polyfill` → added
- `scripts/copy-static.mjs` polyfill copy line → removed
- 1 CHANGELOG entry under `[Unreleased]`

### Out of scope

- Other dep bumps from todo #6 (`jspdf`, rollup-linux-gnu, etc.) — separate work
- TS migration — Step 3
- elix → Lit — Step 4
- `path.js:633-786 convertPath` deletion — already verified NOT a duplicate during Step 1 execution; keep both implementations

---

## 3-commit sequence

**C1 — Test env swap**
- 6 test files: `import 'pathseg'` → `import 'path-data-polyfill'`
- `package.json`: add `path-data-polyfill` to `devDependencies`
- `npm install`
- Verify: `npm run lint` + `npx vitest run` (564/564)

**C2 — Production refactor + drop runtime import**
- 8 sites in `path-actions.js` rewritten to `setPathData`-style direct array writes
- Drop `import 'pathseg'` from `svgcanvas.js:10`
- Verify: `npm run lint` + `npx vitest run` (564/564) + `node scripts/run-e2e.mjs` (192 passed) + `npm run build`

**C3 — Runtime dep + copy-static cleanup**
- `package.json`: remove `dependencies.pathseg`
- `scripts/copy-static.mjs`: remove polyfill copy line (find by content `'node_modules/pathseg/pathseg.js'`, not line number — may have shifted)
- `npm install` to update lock file
- Verify: full gates again

---

## Verification gates

Run after every commit:

- `npm run lint` clean
- `npx vitest run` → 564/564 (no test content changes; import swap only)
- `node scripts/run-e2e.mjs` → 192 passed both browsers, 0 skipped
- `npm run build` clean

### Manual cross-browser smoke (after C3, before merge)

Per audit's path-edit checklist (Edge + Firefox):

1. Draw a 3+ point path → save → reload → re-open the saved SVG
2. Toggle a path segment between line ↔ curve
3. Add a node to an existing path; delete a node
4. Open a path with absolute + relative segments + closepath via Source dialog paste

---

## Risks

| Risk | Mitigation |
|---|---|
| `path-data-polyfill` API contract differs subtly from `pathseg` | Polyfill is SVG 2 spec-conformant + narrow scope; only `pathSegList` consumers go through the shim, and the shim's contract is fixed |
| Refactored `path-actions.js` site has a `setPathData` semantic difference vs the old `createSVGPathSeg*` flow | E2e suite includes 9 path-related browser-compat tests + 4 svgcore-remap/recalculate-extra tests; manual smoke verifies user-visible paths |
| Modern Chromium (Edge) lacks native `getPathData`/`setPathData` | Step 1.5 proved Firefox + Playwright Chromium have it; Edge tracks Chromium so should match. Verify in manual smoke step |

---

## Rollback

- Pre-merge: `git branch -D feat/pathseg-drop` (zero impact)
- Post-merge: `git revert -m 1 <merge-sha>` recovers fully
- Per-commit revert: each of C1/C2/C3 is independently revertable

---

## Effort

~1-1.5 hours. Most time in C2 (8-site refactor + verify between commits).
