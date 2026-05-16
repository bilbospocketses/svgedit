# svgedit JS → TS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert ~112 svgedit production `.js`/`.mjs` files to TypeScript under day-one strict mode, with no behavior changes.

**Architecture:** Single PR (`feat/ts-migration`) with 18 ordered commits. Bottom-up by audit area (`common/` → `core/` → `svgcanvas` barrel → editor → scripts). Wired-on `SvgCanvas` methods declared via central `.d.ts` augmentation; runtime structure preserved. Tests stay JS for this PR (deferred to follow-up). File splits, mutable-export refactors, and bug fixes all deferred.

**Tech Stack:** TypeScript 5.x, ESLint v9 + `@typescript-eslint/parser` v8 + `@typescript-eslint/eslint-plugin` v8 (flat config), Vite 7 (handles `.ts` natively via esbuild), Vitest 4, Playwright 1.57.

**Spec:** `docs/superpowers/specs/2026-05-16-svgedit-ts-migration-design.md`

**Prerequisites (NOT this PR's job):**
- Step 1 (`feat/pre-migration-cleanup`) merged to master.
- Step 2 (`feat/pathseg-drop`) merged to master.
- Tag `pre-ts-migration` placed on master HEAD before this PR's branch is cut.

---

## Per-file conversion playbook

Apply uniformly to every `.js` file converted in tasks 5–16. Steps are typically 2–10 minutes per file; complex files (`recalculate.js`, `EditorStartup.js`, `Editor.js`) can run 30–60 minutes due to type-error volume.

For each file `path/to/file.js`:

1. `git mv path/to/file.js path/to/file.ts`
2. Run `npx tsc --noEmit` — capture errors for this file.
3. Resolve errors top-down:
   - Add type annotations to function parameters where `noImplicitAny` complains.
   - Add return types where inference is non-obvious.
   - Resolve `null`/`undefined` narrowing where `strictNullChecks` complains. **DO NOT change runtime behavior** — if a callsite is missing a null-check that would change behavior, type the variable as `T | null` and add `if (x) { ... }` only if no behavior change OR add `// @ts-expect-error: pre-existing null-misuse, see todo #10` with a tracking comment.
   - Resolve `unknown` in catch where `useUnknownInCatchVariables` complains: `catch (err) { if (err instanceof Error) { ... } else { throw err } }`.
   - For wired-on `svgCanvas` methods, ensure the method appears in `packages/svgcanvas/svgcanvas.augment.d.ts`.
4. For genuinely-untyped third-party shapes — declare a local `interface`. Never `any` unless flagged with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and a comment explaining why.
5. Run `npx eslint path/to/file.ts` — clean.
6. Move to next file in the same task's batch.

Once all files in a task are converted, run the full verification gate (see below).

## Per-task verification gate (run after each conversion task, before commit)

```bash
npx tsc --noEmit                # type-check ALL files in project
npm run lint                    # eslint clean, --max-warnings 0
npm run build                   # both packages/svgcanvas and root build
npx vitest run                  # all unit tests pass
node scripts/run-e2e.mjs        # all 81 Playwright tests pass
```

If ANY gate fails, fix before committing. Do not commit broken intermediate state.

## Naming-consistency renames (deferred to Task 17)

These renames piggyback after all conversion is done so we can use TS rename refactor (identifier-aware) instead of text search-and-replace. Listed here for reference:

- `controllPoint1` / `controllPoint2` → `controlPoint1` / `controlPoint2` (8 sites in `svgcanvas.ts` + `event.ts`)
- `getrootSctm` → `getRootSctm` (heavy use in `event.ts`)
- `getrefAttrs` → `getRefAttrs` (`svgcanvas.ts` + `svg-exec.ts`)
- `gettingSelectorManager` → `getSelectorManager` (`svgcanvas.ts:761` + `selected-elem.ts` 3 sites)
- `idprefix` → `idPrefix`
- `getbSpline` / `setbSpline` → `getBSpline` / `setBSpline`
- `current_drawing_` → `currentDrawing` (drop trailing underscore + snake_case)
- Trailing-underscore pseudo-privates throughout `core/` → `#` private fields (`historyrecording.ts`, `layer.ts`, `draw.ts Drawing class`, `undo.ts handler_`, `recalculate.ts`)

---

## Task 1 (C0): Add tsconfig.json scaffolding

**Files:**
- Create: `tsconfig.json` (root)
- Create: `packages/svgcanvas/tsconfig.json`

- [ ] **Step 1: Verify branch and clean state**

```bash
git checkout -b feat/ts-migration
git status                      # clean working tree
git tag pre-ts-migration        # safety tag for worst-case rollback
```

- [ ] **Step 2: Install TypeScript**

```bash
npm install --save-dev typescript@^5.7.0
```

- [ ] **Step 3: Create root tsconfig.json**

Create file `tsconfig.json` at repo root:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
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
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
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

- [ ] **Step 4: Create workspace tsconfig.json**

Create file `packages/svgcanvas/tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./",
    "noEmit": false
  },
  "include": ["**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 5: Verify tsc runs (expect zero errors since no .ts files exist yet except svgcanvas.d.ts)**

```bash
npx tsc --noEmit
```

Expected: zero errors. (If errors, the existing `svgcanvas.d.ts` shim has a problem — fix in this task.)

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json packages/svgcanvas/tsconfig.json package.json package-lock.json
git commit -m "chore(ts): add tsconfig.json + packages/svgcanvas/tsconfig.json (strict)"
```

---

## Task 2 (C1): Swap standard for ESLint v9 + typescript-eslint

**Files:**
- Modify: `package.json` (drop `standard`, add eslint deps; rewrite `lint` script)
- Create: `eslint.config.js` (root)
- Delete: `.standardrc` if present (none expected)

- [ ] **Step 1: Drop standard, install ESLint v9 + typescript-eslint v8**

```bash
npm uninstall standard
npm install --save-dev eslint@^9.18.0 @typescript-eslint/parser@^8.20.0 @typescript-eslint/eslint-plugin@^8.20.0 globals@^15.14.0 typescript-eslint@^8.20.0
```

- [ ] **Step 2: Create flat-config eslint.config.js**

Create file `eslint.config.js` at repo root:

```js
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '_reference/**',
      'tests/vendor/**',
      'src/editor/extensions/ext-shapes/shapelib/**'
    ]
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // Project-specific overrides; tighten over time.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['tests/**/*.js', '*.config.{js,mjs,ts}'],
    extends: [tseslint.configs.disableTypeChecked]
  }
)
```

- [ ] **Step 3: Update lint script in package.json**

Edit `package.json` `scripts`:

```jsonc
{
  "scripts": {
    "lint": "eslint .",
    // remove the "pretest" -> "npm run lint" hook is fine to keep
    // ...
  }
}
```

Also remove the `"standard"` config block from `package.json` entirely (delete keys: `standard.ignore`, `standard.globals`, `standard.env`).

- [ ] **Step 4: Verify lint runs against existing .js files (will report no .ts files exist yet)**

```bash
npm run lint
```

Expected: clean (or at most a few warnings if existing .js files violate the new rules). If failures: investigate. If new rule complaints from existing JS files, lower the offending rule severity to `warn` and add to backlog — don't fix existing JS lint issues during scaffolding.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json eslint.config.js
git commit -m "chore(lint): swap standard for eslint v9 + typescript-eslint flat config"
```

---

## Task 3 (C2): Replace svgcanvas.d.ts shim with svgcanvas.augment.d.ts

**Files:**
- Create: `packages/svgcanvas/svgcanvas.augment.d.ts`
- Modify: `packages/svgcanvas/svgcanvas.d.ts` (will eventually be deleted in Task 18; for now, keep but mark as legacy)

This file declares the methods that `core/*.ts init()` calls attach to `svgCanvas` at runtime. The list comes from grepping `core/` for `svgCanvas\.[a-zA-Z]+\s*=` patterns and from the existing `svgcanvas.d.ts` shim.

- [ ] **Step 1: Enumerate wired-on methods**

```bash
grep -rn 'svgCanvas\.[a-zA-Z_]\+\s*=' packages/svgcanvas/core/ | grep -v '//' | sort -u
```

Capture output. Expect ~40 entries across `clear.js`, `svg-exec.js`, `select.js`, `selected-elem.js`, `selection.js`, `event.js`, `path.js`, `path-actions.js`, `recalculate.js`, `text-actions.js`, `paint.js`, `copy-elem.js`, `paste-elem.js`, `elem-get-set.js`, `draw.js`, `undo.js`.

- [ ] **Step 2: Create the augment file**

Create `packages/svgcanvas/svgcanvas.augment.d.ts`:

```ts
// Module augmentation declaring methods that core/*.ts init() functions
// attach to the SvgCanvas instance at runtime. Hand-maintained.
// Drift is caught immediately by usage failing to compile — when adding
// a new wired-on method in core/*.ts, add the matching declaration here.

import type { SvgCanvas } from './svgcanvas'

declare module './svgcanvas' {
  interface SvgCanvas {
    // From core/clear.ts (init wires these on)
    clearSelection: (noCall?: boolean) => void
    addToSelection: (elemsToAdd: Element[], showGrips?: boolean) => void
    // ...
    // From core/svg-exec.ts
    setSvgString: (xmlString: string, preventUndo?: boolean) => boolean
    // ...
    // (Continue for every wired-on method enumerated in Step 1.)
    // Use `unknown` for arg types you can't determine cleanly during scaffolding;
    // tighten in the per-file conversion task that owns the source method.
  }
}
```

For the initial scaffold, declare each method with a minimal signature like `(...args: unknown[]) => unknown` — this is intentionally loose so the scaffold compiles. Each subsequent conversion task tightens its file's wired-on method signatures by editing this augment file.

- [ ] **Step 3: Verify tsc accepts the augmentation**

```bash
npx tsc --noEmit
```

Expected: zero errors. The augment file references `./svgcanvas` which currently points at the existing `svgcanvas.d.ts` shim — that's fine, the augmentation merges into whatever `SvgCanvas` interface exists.

- [ ] **Step 4: Commit**

```bash
git add packages/svgcanvas/svgcanvas.augment.d.ts
git commit -m "chore(ts): add svgcanvas.augment.d.ts for wired-on SvgCanvas methods"
```

---

## Task 4 (C3): Drop vite-plugin-istanbul + e2e fixtures coverage scaffolding

This is todo #8 work — bundled here per the spec to avoid touching `vite.config.mjs` twice.

**Files:**
- Modify: `vite.config.mjs` (drop istanbul plugin import + usage)
- Modify: `tests/e2e/fixtures.js` (strip `__coverage__` collection — simplify to plain test/expect re-export)
- Modify: `scripts/copy-static.mjs` (drop COVERAGE block + `istanbul-lib-instrument` import)
- Modify: `package.json` (drop `vite-plugin-istanbul` devDep)

- [ ] **Step 1: Drop the istanbul plugin from vite.config.mjs**

Remove lines:
```js
import istanbul from 'vite-plugin-istanbul'
const coverageEnabled = process.env.COVERAGE === 'true' || process.env.NODE_ENV === 'test'
```
And remove `istanbul({...})` from the `plugins:` array.

- [ ] **Step 2: Strip coverage from tests/e2e/fixtures.js**

Read the file first to see the structure, then replace the coverage-collection logic with a plain `test`/`expect` re-export from `@playwright/test`.

- [ ] **Step 3: Strip COVERAGE block from scripts/copy-static.mjs**

Remove:
- The `import { createInstrumenter } from 'istanbul-lib-instrument'` import
- The entire `if (process.env.COVERAGE === 'true')` block (lines 33-57 per audit)

- [ ] **Step 4: Drop vite-plugin-istanbul devDep**

```bash
npm uninstall vite-plugin-istanbul
```

- [ ] **Step 5: Verify build + e2e still work**

```bash
npm run build
node scripts/run-e2e.mjs
```

Expected: 81/81 e2e pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add vite.config.mjs tests/e2e/fixtures.js scripts/copy-static.mjs package.json package-lock.json
git commit -m "chore(scripts): drop vite-plugin-istanbul + e2e fixtures coverage scaffolding (todo #8)"
```

---

## Task 5 (C4): Convert packages/svgcanvas/common/ to TS

**Files (3):**
- Modify: `packages/svgcanvas/common/browser.js` → `.ts`
- Modify: `packages/svgcanvas/common/logger.js` → `.ts`
- Modify: `packages/svgcanvas/common/util.js` → `.ts`

These are dependency leaves. Apply the per-file playbook to each.

- [ ] **Step 1: Capture pre-conversion baseline**

```bash
npx tsc --noEmit                         # zero errors expected (only .d.ts files exist)
npm run lint                             # clean
npx vitest run 2>&1 | tail -5            # capture pass count
node scripts/run-e2e.mjs 2>&1 | tail -5  # capture pass count
```

Record current vitest + e2e counts (baseline for this PR).

- [ ] **Step 2: Convert browser.js**

```bash
git mv packages/svgcanvas/common/browser.js packages/svgcanvas/common/browser.ts
npx tsc --noEmit
```

Apply playbook to resolve errors. browser.js exports browser-detection booleans (`isWebkit`, `isGecko`, `isChrome`, etc.) — types should be `boolean` for each export.

- [ ] **Step 3: Convert logger.js**

```bash
git mv packages/svgcanvas/common/logger.js packages/svgcanvas/common/logger.ts
npx tsc --noEmit
```

Apply playbook. Logger likely wraps `console.*`; type the exported functions with `(msg: string, ...args: unknown[]) => void` signatures.

- [ ] **Step 4: Convert util.js**

```bash
git mv packages/svgcanvas/common/util.js packages/svgcanvas/common/util.ts
npx tsc --noEmit
```

Apply playbook. util.js exports `getParents`, `getParentsUntil`, `getClosest`, etc. — DOM utility functions. Types: `(elem: Element, selector?: string | Element | Document) => Element[]`.

- [ ] **Step 5: Run full verification gate**

```bash
npx tsc --noEmit
npm run lint
npm run build
npx vitest run
node scripts/run-e2e.mjs
```

All must pass. Test counts unchanged from baseline.

- [ ] **Step 6: Commit**

```bash
git add packages/svgcanvas/common/
git commit -m "refactor(svgcanvas/common): convert to TS [3 files]"
```

---

## Task 6 (C5a): Convert core/ utility leaves

**Files (8):** `namespaces`, `math`, `json`, `dataStorage`, `units`, `touch`, `utilities`, `coords` — all `.js` → `.ts`.

These have no inter-`core/` dependencies. Apply per-file playbook to each.

- [ ] **Step 1: Convert namespaces.js**

```bash
git mv packages/svgcanvas/core/namespaces.js packages/svgcanvas/core/namespaces.ts
npx tsc --noEmit
```

`NS` is a const enum-like object; export type for it: `export const NS = { ... } as const; export type NSKey = keyof typeof NS`.

- [ ] **Step 2: Convert math.js**

```bash
git mv packages/svgcanvas/core/math.js packages/svgcanvas/core/math.ts
npx tsc --noEmit
```

Math functions on numbers/matrices. Types: `(a: number, b: number) => number` etc.; SVG matrix operations need `SVGMatrix` or DOMMatrix types.

- [ ] **Step 3: Convert json.js**

```bash
git mv packages/svgcanvas/core/json.js packages/svgcanvas/core/json.ts
npx tsc --noEmit
```

JSON utilities on element-shape objects. Define a local `interface ElementJson { type: string; attr?: Record<string, string>; children?: ElementJson[] }` and use throughout.

- [ ] **Step 4: Convert dataStorage.js**

```bash
git mv packages/svgcanvas/core/dataStorage.js packages/svgcanvas/core/dataStorage.ts
npx tsc --noEmit
```

WeakMap-backed key-value storage on DOM elements. Types: `<T>(elem: Element, key: string, value?: T) => T | undefined`.

- [ ] **Step 5: Convert units.js**

```bash
git mv packages/svgcanvas/core/units.js packages/svgcanvas/core/units.ts
npx tsc --noEmit
```

Unit conversion functions. Define a `Unit` type as a string union: `type Unit = 'px' | 'pt' | 'em' | 'pc' | 'mm' | 'cm' | 'in' | '%'`.

- [ ] **Step 6: Convert touch.js**

```bash
git mv packages/svgcanvas/core/touch.js packages/svgcanvas/core/touch.ts
npx tsc --noEmit
```

Touch event handling. Use `TouchEvent`, `Touch` DOM types from lib.dom.

- [ ] **Step 7: Convert utilities.js**

```bash
git mv packages/svgcanvas/core/utilities.js packages/svgcanvas/core/utilities.ts
npx tsc --noEmit
```

Mixed utilities (~1100 lines). Watch for the audit-flagged sites:
- `:755-756` `getExtraAttributesForConvertToPath` missing attrs (preserve behavior; flag in todo #10).
- `:941-942` rotated-groups bbox cross-browser (preserve behavior).
- `:1015-1017` circle bbox-optim exclusion (preserve behavior).
- `:1057-1059` stroke-width single-horizontal-line bbox overrun (preserve behavior).
- `:1126-1129` `getStrokedBBox` min/max asymmetry (preserve behavior).

This is a long file; type-check pass will surface 50+ errors. Resolve uniformly using playbook.

- [ ] **Step 8: Convert coords.js**

```bash
git mv packages/svgcanvas/core/coords.js packages/svgcanvas/core/coords.ts
npx tsc --noEmit
```

Coordinate math; depends on `math.ts` and `namespaces.ts`. Types similar to math.

- [ ] **Step 9: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

All pass. Test counts unchanged.

- [ ] **Step 10: Commit**

```bash
git add packages/svgcanvas/core/
git commit -m "refactor(svgcanvas/core): convert utility leaves to TS [8 files: namespaces, math, json, dataStorage, units, touch, utilities, coords]"
```

---

## Task 7 (C5b): Convert core/ history + drawing layer

**Files (8):** `sanitize`, `history`, `historyrecording`, `undo`, `layer`, `draw`, `clear`, `copy-elem` — all `.js` → `.ts`.

These depend on Task 6's leaves. Apply per-file playbook.

- [ ] **Step 1: Convert sanitize.js**

```bash
git mv packages/svgcanvas/core/sanitize.js packages/svgcanvas/core/sanitize.ts
npx tsc --noEmit
```

SVG sanitization — element/attribute allowlists. Allowlist is a `Record<string, readonly string[]>`.

- [ ] **Step 2: Convert history.js**

```bash
git mv packages/svgcanvas/core/history.js packages/svgcanvas/core/history.ts
npx tsc --noEmit
```

Undo/redo command history. `HistoryCommand` is a class hierarchy — convert with proper `class` syntax. Audit-flagged: `:442-444` + `:609-612` typing-undo compression (preserve behavior); `:611-612` history stack size (preserve, no cap).

- [ ] **Step 3: Convert historyrecording.js**

```bash
git mv packages/svgcanvas/core/historyrecording.js packages/svgcanvas/core/historyrecording.ts
npx tsc --noEmit
```

Trailing-underscore pseudo-privates here — type as-is for now; renames happen in Task 17.

- [ ] **Step 4: Convert undo.js**

```bash
git mv packages/svgcanvas/core/undo.js packages/svgcanvas/core/undo.ts
npx tsc --noEmit
```

Undo manager. `handler_` field — type as-is.

- [ ] **Step 5: Convert layer.js**

```bash
git mv packages/svgcanvas/core/layer.js packages/svgcanvas/core/layer.ts
npx tsc --noEmit
```

Layer class. Trailing-underscore pseudo-privates — type as-is.

- [ ] **Step 6: Convert draw.js**

```bash
git mv packages/svgcanvas/core/draw.js packages/svgcanvas/core/draw.ts
npx tsc --noEmit
```

`Drawing` class with many fields. `current_drawing_` — type as-is for now (renamed Task 17).

- [ ] **Step 7: Convert clear.js**

```bash
git mv packages/svgcanvas/core/clear.js packages/svgcanvas/core/clear.ts
npx tsc --noEmit
```

`init(canvas)` wires `clearSelection`, `addToSelection`, etc. onto `svgCanvas`. Verify all wired methods are declared in `svgcanvas.augment.d.ts`; tighten signatures from `(...args: unknown[]) => unknown` to actual types.

- [ ] **Step 8: Convert copy-elem.js**

```bash
git mv packages/svgcanvas/core/copy-elem.js packages/svgcanvas/core/copy-elem.ts
npx tsc --noEmit
```

Element-copy logic. Apply playbook.

- [ ] **Step 9: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 10: Commit**

```bash
git add packages/svgcanvas/core/ packages/svgcanvas/svgcanvas.augment.d.ts
git commit -m "refactor(svgcanvas/core): convert history + drawing layer to TS [8 files: sanitize, history, historyrecording, undo, layer, draw, clear, copy-elem]"
```

---

## Task 8 (C5c): Convert core/ elem ops + select

**Files (8):** `elem-get-set`, `paste-elem`, `paint`, `blur-event`, `text-actions`, `select`, `selected-elem`, `selection` — all `.js` → `.ts`.

- [ ] **Step 1: Convert elem-get-set.js**

```bash
git mv packages/svgcanvas/core/elem-get-set.js packages/svgcanvas/core/elem-get-set.ts
npx tsc --noEmit
```

Element get/set helpers — many wired-on methods. Update `svgcanvas.augment.d.ts`.

- [ ] **Step 2: Convert paste-elem.js**

```bash
git mv packages/svgcanvas/core/paste-elem.js packages/svgcanvas/core/paste-elem.ts
npx tsc --noEmit
```

- [ ] **Step 3: Convert paint.js**

```bash
git mv packages/svgcanvas/core/paint.js packages/svgcanvas/core/paint.ts
npx tsc --noEmit
```

Paint class (fill/stroke). Apply playbook.

- [ ] **Step 4: Convert blur-event.js**

```bash
git mv packages/svgcanvas/core/blur-event.js packages/svgcanvas/core/blur-event.ts
npx tsc --noEmit
```

Audit-flagged: `:123` blur-algorithm TODO — preserve.

- [ ] **Step 5: Convert text-actions.js**

```bash
git mv packages/svgcanvas/core/text-actions.js packages/svgcanvas/core/text-actions.ts
npx tsc --noEmit
```

Text editing actions. Apply playbook.

- [ ] **Step 6: Convert select.js**

```bash
git mv packages/svgcanvas/core/select.js packages/svgcanvas/core/select.ts
npx tsc --noEmit
```

`SelectModule` singleton class — convert as-is. Audit-flagged: `:423` `isWebkit()` Chrome-7 workaround (preserve, todo #10).

- [ ] **Step 7: Convert selected-elem.js**

```bash
git mv packages/svgcanvas/core/selected-elem.js packages/svgcanvas/core/selected-elem.ts
npx tsc --noEmit
```

Many wired-on methods. Update augment file. Audit-flagged: `:823` fill/stroke ungroup pushdown (preserve); `:1111` uniquifyElems hasMore bug (preserve).

- [ ] **Step 8: Convert selection.js**

```bash
git mv packages/svgcanvas/core/selection.js packages/svgcanvas/core/selection.ts
npx tsc --noEmit
```

Audit-flagged: `:215-216` runExtensions @todo (preserve, embed-API design input).

- [ ] **Step 9: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 10: Commit**

```bash
git add packages/svgcanvas/core/ packages/svgcanvas/svgcanvas.augment.d.ts
git commit -m "refactor(svgcanvas/core): convert elem ops + select to TS [8 files: elem-get-set, paste-elem, paint, blur-event, text-actions, select, selected-elem, selection]"
```

---

## Task 9 (C5d): Convert core/ event + path + compose

**Files (7):** `event`, `path`, `path-actions`, `path-method`, `recalculate`, `svg-exec`, `svgroot` — all `.js` → `.ts`.

This is the heaviest task — `event.ts`, `recalculate.ts`, `svg-exec.ts`, `path-actions.ts` are all huge. Budget ~half a day.

- [ ] **Step 1: Convert event.js**

```bash
git mv packages/svgcanvas/core/event.js packages/svgcanvas/core/event.ts
npx tsc --noEmit
```

Heavy event handling. Audit-flagged: `:951` `<a>` parent walk TODO; `:957`, `:986` browser-bug comments — preserve. Many wired methods to add to augment file. `getrootSctm` rename happens in Task 17, NOT here.

- [ ] **Step 2: Convert path.js**

```bash
git mv packages/svgcanvas/core/path.js packages/svgcanvas/core/path.ts
npx tsc --noEmit
```

Audit-flagged: `:77 export let path = null` — type as `Path | null`. Consumers will need null-narrowing; if a callsite was missing a null-check, type as-is + `// @ts-expect-error: pre-existing null-misuse — see todo #10`. NO behavior changes.

- [ ] **Step 3: Convert path-actions.js**

```bash
git mv packages/svgcanvas/core/path-actions.js packages/svgcanvas/core/path-actions.ts
npx tsc --noEmit
```

Heavy path operations. Audit-flagged: `:41-209` convertPath (preserve), `:887-899` Opera-bug commented (already noise — leave commented for cleanup follow-up), `:1167-1170` `if (window.opera)` (preserve, dropped in Step 1 cleanup theoretically — verify it's gone before this task).

- [ ] **Step 4: Convert path-method.js**

```bash
git mv packages/svgcanvas/core/path-method.js packages/svgcanvas/core/path-method.ts
npx tsc --noEmit
```

`PathDataListShim` class is the bridge for `pathSegList` API. After Step 2 (pathseg drop), the `createSVGPathSeg*` polyfill is gone — `PathDataListShim` is the canonical implementation. Type carefully so consumers see the shim's interface as fully `pathSegList`-compatible.

- [ ] **Step 5: Convert recalculate.js**

```bash
git mv packages/svgcanvas/core/recalculate.js packages/svgcanvas/core/recalculate.ts
npx tsc --noEmit
```

`recalculateDimensions` is ~700 lines in a single function. Type-check pass will surface dozens of inference issues. Resolve top-down. **DO NOT split the function** (deferred per spec). If a section becomes unreadable due to type annotations, extract local `interface` declarations at the top of the file.

- [ ] **Step 6: Convert svg-exec.js**

```bash
git mv packages/svgcanvas/core/svg-exec.js packages/svgcanvas/core/svg-exec.ts
npx tsc --noEmit
```

Audit-flagged sites:
- `:252` `_moz-math-font-style` — preserve
- `:503-512`, `:712-722` Firefox bug 353575 workarounds — preserve
- `:516` setUseData on undo/redo — preserve
- `:633-639`, `:763-766` importSvgString edge cases — preserve
- `:985` console.error vs error() — preserve
- `:1112`, `:1117` uniquifyElems bugs — preserve
- `:1269` isWebkit workaround — preserve
- `:1278` multi-element gradient duplication — preserve

Many wired methods; update augment file.

- [ ] **Step 7: Convert svgroot.js**

```bash
git mv packages/svgcanvas/core/svgroot.js packages/svgcanvas/core/svgroot.ts
npx tsc --noEmit
```

Root SVG element handling. Apply playbook.

- [ ] **Step 8: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

If e2e fails: investigate immediately. core/ conversions are the highest-risk surface for runtime regression.

- [ ] **Step 9: Commit**

```bash
git add packages/svgcanvas/core/ packages/svgcanvas/svgcanvas.augment.d.ts
git commit -m "refactor(svgcanvas/core): convert event + path + compose to TS [7 files: event, path, path-actions, path-method, recalculate, svg-exec, svgroot]"
```

---

## Task 10 (C6): Convert svgcanvas.js barrel + replace shim

**Files:**
- Modify: `packages/svgcanvas/svgcanvas.js` → `.ts` (becomes the canonical `SvgCanvas` class file)
- Delete: `packages/svgcanvas/svgcanvas.d.ts` (the hand-written shim — replaced by tsc-emitted .d.ts + augment file)

- [ ] **Step 1: Convert svgcanvas.js**

```bash
git mv packages/svgcanvas/svgcanvas.js packages/svgcanvas/svgcanvas.ts
npx tsc --noEmit
```

This file IS the `SvgCanvas` class. Convert with proper `class SvgCanvas` syntax. Methods and fields that are explicitly defined on the class (not wired-on by `core/*.ts init()`) should be declared as class members — those that ARE wired on get declared in the augment file.

After conversion, the file's exported `SvgCanvas` class + interface should match the augment file's shape.

- [ ] **Step 2: Delete the legacy hand-written shim**

```bash
git rm packages/svgcanvas/svgcanvas.d.ts
```

The tsc compiler now emits `.d.ts` from `svgcanvas.ts` to `dist/svgcanvas.d.ts` (per packages/svgcanvas/tsconfig.json `declaration: true`).

- [ ] **Step 3: Verify the package builds + emits .d.ts**

```bash
npx tsc --build packages/svgcanvas
ls packages/svgcanvas/dist/svgcanvas.d.ts
```

Expected: file exists, contains the `SvgCanvas` interface + augmented methods.

- [ ] **Step 4: Update package.json export paths if needed**

Check `packages/svgcanvas/package.json` for `"types": "..."` field. Update from `svgcanvas.d.ts` (legacy shim path) to `dist/svgcanvas.d.ts` (tsc-emitted).

- [ ] **Step 5: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 6: Commit**

```bash
git add packages/svgcanvas/svgcanvas.ts packages/svgcanvas/package.json
git rm packages/svgcanvas/svgcanvas.d.ts
git commit -m "refactor(svgcanvas): convert svgcanvas.ts barrel + remove legacy .d.ts shim"
```

---

## Task 11 (C7): Convert src/editor/ top-level + locale/

**Files (9):** `ConfigObj`, `EditorStartup`, `MainMenu`, `Rulers`, `contextmenu`, `typedefs`, `locale`, `Editor`, `locale/lang.en.js` — all `.js` → `.ts`.

(`browser-not-supported.js` already deleted in Step 1.)

- [ ] **Step 1: Convert ConfigObj.js**

```bash
git mv src/editor/ConfigObj.js src/editor/ConfigObj.ts
npx tsc --noEmit
```

Configuration object. `defaultPrefs`, `curConfig`, etc. — define interface for config shape.

- [ ] **Step 2: Convert typedefs.js (no code, just JSDoc — likely DELETE)**

```bash
cat src/editor/typedefs.js
```

If it's purely JSDoc typedefs with no runtime code, the file becomes obsolete with TS. Replace with `src/editor/typedefs.ts` containing actual TypeScript type definitions, OR delete entirely if all types should colocate with their producers.

- [ ] **Step 3: Convert contextmenu.js**

```bash
git mv src/editor/contextmenu.js src/editor/contextmenu.ts
npx tsc --noEmit
```

Audit-flagged: `:81-84` `appendChild('<li class=...>')` bug (preserve, todo #10).

- [ ] **Step 4: Convert locale.js**

```bash
git mv src/editor/locale.js src/editor/locale.ts
npx tsc --noEmit
```

70-line shim. Define `t(key: string, vars?: Record<string, string>): string` properly.

- [ ] **Step 5: Convert locale/lang.en.js**

```bash
git mv src/editor/locale/lang.en.js src/editor/locale/lang.en.ts
npx tsc --noEmit
```

Language strings. Type as `Record<string, Record<string, string>>` or define a discriminated union for namespaces.

- [ ] **Step 6: Convert MainMenu.js**

```bash
git mv src/editor/MainMenu.js src/editor/MainMenu.ts
npx tsc --noEmit
```

Apply playbook.

- [ ] **Step 7: Convert Rulers.js**

```bash
git mv src/editor/Rulers.js src/editor/Rulers.ts
npx tsc --noEmit
```

Canvas-rendering. Audit-flagged: `:77` IE9 comment (preserve), `:95-96` red fillStyle (preserve, todo #10 — verify intentional).

- [ ] **Step 8: Convert EditorStartup.js**

```bash
git mv src/editor/EditorStartup.js src/editor/EditorStartup.ts
npx tsc --noEmit
```

590-line `init()` function — heavy. Audit-flagged: `:683`, `:706`, `:742` console.error extension errors (preserve). DO NOT split init() (deferred per spec).

- [ ] **Step 9: Convert Editor.js**

```bash
git mv src/editor/Editor.js src/editor/Editor.ts
npx tsc --noEmit
```

1393 lines, large class. Audit-flagged: `:494` notification..noteTheseIssues double-dot (preserve, todo #10), `:905` setIcon investigation (preserve), `:410-412` setAll shortcut normalization (preserve). DO NOT trifurcate (deferred per spec).

(`Editor.js:439-456 getParents` was deleted in Step 1.)

- [ ] **Step 10: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 11: Commit**

```bash
git add src/editor/
git commit -m "refactor(editor): convert top-level src/editor/ + locale/ to TS [9 files]"
```

---

## Task 12 (C8): Convert src/editor/components/ to TS

**Files (23):** All under `src/editor/components/` — see `git ls-files src/editor/components/*.js`.

Components include: `seButton`, `seColorPicker`, `seDropdown`, `seExplorerButton`, `seFlyingButton`, `seInput`, `seList`, `seListItem`, `seMenu`, `seMenuItem`, `sePalette`, `sePlainBorderButton`, `sePlainMenuButton`, `seSelect`, `seSpinInput`, `seText`, `seZoom`, `PaintBox`, `index`, `jgraduate/ColorValuePicker`, `jgraduate/Slider`, `jgraduate/jQuery.jGraduate`, `jgraduate/jQuery.jPicker`.

- [ ] **Step 1: List the files**

```bash
git ls-files 'src/editor/components/*.js' 'src/editor/components/jgraduate/*.js'
```

- [ ] **Step 2: Convert each component (apply playbook)**

For each file, run:
```bash
git mv src/editor/components/<name>.js src/editor/components/<name>.ts
npx tsc --noEmit
```

Resolve errors per playbook.

**Notes per file from audit:**
- `seExplorerButton.ts:26` dead `XMLHttpRequest` — preserve (todo #10)
- `seExplorerButton.ts:134` `class="image-lib""` HTML syntax error — preserve (todo #10)
- `seZoom.ts:78-79` missing semicolon after `position:fixed` — preserve (todo #10)
- `seZoom.ts:211-222` inverted-guard `attributeChangedCallback` — preserve
- `seMenu.ts:46`, `seMenuItem.ts:31-32`, `seSpinInput.ts:106, 108, 217-229` shadowDOM-piercing — preserve as-is; replaced when #3 (elix→Lit) lands
- `jQuery.jPicker.ts:1292, 1596` jQuery-on-DOM bugs — preserve (todo #10)
- `jQuery.jPicker.ts:645, 1063-1067, 1085-1093, 1097-1101` IE6 — should already be deleted in Step 1; verify gone
- `jQuery.jGraduate.ts:114` isGecko local — preserve (drop in code-quality follow-up)
- `jQuery.jGraduate.ts:195` native alert() — preserve (todo #10 prompt/alert wrapper work)

For elix-bound components (extending elix `WrappedStandardElement` or similar), TS may need to declare elix's types via `declare module 'elix/...' { ... }` if upstream types aren't sufficient. If that's needed, add to `packages/svgcanvas/svgcanvas.augment.d.ts` or create `src/editor/elix.d.ts`.

- [ ] **Step 3: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 4: Commit**

```bash
git add src/editor/components/
git commit -m "refactor(editor/components): convert components/ to TS [23 files]"
```

---

## Task 13 (C9): Convert src/editor/dialogs/ to TS

**Files (15):** All under `src/editor/dialogs/` (including `se-elix/` vendored files).

- [ ] **Step 1: List the files**

```bash
git ls-files 'src/editor/dialogs/*.js' 'src/editor/dialogs/se-elix/**/*.js'
```

- [ ] **Step 2: Convert each (apply playbook)**

For each file:
```bash
git mv src/editor/dialogs/<name>.js src/editor/dialogs/<name>.ts
npx tsc --noEmit
```

**Notes per file from audit:**
- `cmenuDialog.ts:204-205` uses `screen.*` instead of `window.inner*` — preserve (todo #10)
- `cmenuDialog.ts:139`, `cmenuLayersDialog.ts:77`, `exportDialog.ts:76` — `super.attributeChangedCallback()` is correctly commented-out; preserve
- `svgSourceDialog.ts:100`, `imagePropertiesDialog.ts:174`, `editorPreferencesDialog.ts:182` — `super.attributeChangedCallback()` problem sites; preserve as-is (will fail at runtime if reached, but currently unreachable; fix in todo #10)
- `sePromptDialog.ts` — misnamed (status-display, not prompt). Preserve name; rename in dedicated cleanup follow-up.
- `se-elix/` vendored files — preserve elix internal types as-is.

- [ ] **Step 3: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 4: Commit**

```bash
git add src/editor/dialogs/
git commit -m "refactor(editor/dialogs): convert dialogs/ to TS [15 files]"
```

---

## Task 14 (C10): Convert src/editor/extensions/ to TS

**Files (~23):** 11 extensions × (main `.js` + `locale/en.js`) = 22 files, plus `ext-overview_window/dragmove/dragmove.js` and `ext-storage/storageDialog.js` = ~24 files.

(`ext-helloworld/` already deleted in Step 1.)

- [ ] **Step 1: List the files**

```bash
git ls-files 'src/editor/extensions/**/*.js'
```

- [ ] **Step 2: Convert each extension's main + locale (apply playbook)**

For each extension folder:
```bash
git mv src/editor/extensions/<ext>/<ext>.js src/editor/extensions/<ext>/<ext>.ts
git mv src/editor/extensions/<ext>/locale/en.js src/editor/extensions/<ext>/locale/en.ts
npx tsc --noEmit
```

**Notes per extension from audit:**
- `ext-connector.ts:46-70` monkey-patches `groupSelectedElements` + `moveSelectedElements` — preserve (defer to #4 embed-API design)
- `ext-connector.ts:240` typo "startss" → "starts" — preserve (cleanup follow-up; renames PR or todo #10)
- `ext-overview_window/ext-overview_window.ts:122-123` `evt.originalEvent.layerX` — preserve (currently disabled; fix when reviving per todo #3)
- `ext-overview_window/dragmove/dragmove.js` — convert as utility; no special notes
- `ext-storage/storageDialog.js` — convert as dialog; matches dialogs/ patterns
- `ext-storage/ext-storage.ts:208` `window.widget` branch — already deleted in Step 1; verify gone

Each extension `init()` function has a different shape. Type the `module:SVGEditor` parameter consistently — declare an `EditorContext` interface in `src/editor/typedefs.ts` and import it in every `init()`.

- [ ] **Step 3: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 4: Commit**

```bash
git add src/editor/extensions/
git commit -m "refactor(editor/extensions): convert extensions/ to TS [11 extensions, ~23 files]"
```

---

## Task 15 (C11): Convert src/editor/panels/ to TS

**Files (4):** `BottomPanel`, `LayersPanel`, `LeftPanel`, `TopPanel` — all `.js` → `.ts`.

- [ ] **Step 1: Convert BottomPanel.js**

```bash
git mv src/editor/panels/BottomPanel.js src/editor/panels/BottomPanel.ts
npx tsc --noEmit
```

- [ ] **Step 2: Convert LayersPanel.js**

```bash
git mv src/editor/panels/LayersPanel.js src/editor/panels/LayersPanel.ts
npx tsc --noEmit
```

Audit-flagged: `:263-264` duplicate `_eye.style.width` bug — preserve (todo #10). `:281, 294` duplicate `mouseup` listener bug — preserve (todo #10). `:95, 138, 193` native `prompt()`, `:103, 146, 201` native `alert()` — preserve (todo #10).

- [ ] **Step 3: Convert LeftPanel.js**

```bash
git mv src/editor/panels/LeftPanel.js src/editor/panels/LeftPanel.ts
npx tsc --noEmit
```

~15 click handlers — preserve as-is (dispatch-table refactor deferred per spec).

- [ ] **Step 4: Convert TopPanel.js**

```bash
git mv src/editor/panels/TopPanel.js src/editor/panels/TopPanel.ts
npx tsc --noEmit
```

Audit-flagged: `:169, 696` native `prompt()`, `:623` native `alert()` — preserve. `:318-328` panels lookup missing polyline/polygon/path — preserve. `:399` IE9 setTimeout — preserve. DO NOT split per-element-type (deferred per spec).

- [ ] **Step 5: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 6: Commit**

```bash
git add src/editor/panels/
git commit -m "refactor(editor/panels): convert panels/ to TS [4 files]"
```

---

## Task 16 (C12): Convert scripts/ to TS

**Files (3):** `build-extensions.mjs`, `copy-static.mjs`, `run-e2e.mjs` — all `.mjs` → `.ts`.

These are Node ESM build scripts. Vite invokes them via `node` directly; we need to either:
- Run them via `tsx` or `node --loader ts-node/esm`, OR
- Compile to `.mjs` via tsc first

Decision: run via `tsx` for dev simplicity (zero-config TS execution).

- [ ] **Step 1: Install tsx**

```bash
npm install --save-dev tsx@^4.19.0
```

- [ ] **Step 2: Update package.json scripts to use tsx for the conversion targets**

```jsonc
{
  "scripts": {
    "build": "vite build packages/svgcanvas && vite build",
    "postbuild": "tsx scripts/copy-static.ts && tsx scripts/build-extensions.ts",
    // ... other scripts unchanged
  }
}
```

(Don't change `vite build` — Vite handles `.ts` natively.)

- [ ] **Step 3: Convert build-extensions.mjs**

```bash
git mv scripts/build-extensions.mjs scripts/build-extensions.ts
npx tsc --noEmit
```

Apply playbook. Node fs/promises types via `@types/node` if not already pulled in transitively.

- [ ] **Step 4: Convert copy-static.mjs**

```bash
git mv scripts/copy-static.mjs scripts/copy-static.ts
npx tsc --noEmit
```

(Coverage block already removed in Task 4.)

- [ ] **Step 5: Convert run-e2e.mjs**

```bash
git mv scripts/run-e2e.mjs scripts/run-e2e.ts
npx tsc --noEmit
```

- [ ] **Step 6: Update tsconfig.json includes**

If `scripts/**/*.ts` is already in root `tsconfig.json` `include`, no change needed. Verify.

- [ ] **Step 7: Update e2e runner invocation**

If anywhere invokes `node scripts/run-e2e.mjs` directly (e.g., npm test), change to `tsx scripts/run-e2e.ts`. Update package.json `test` script:

```jsonc
{
  "scripts": {
    "test": "vitest run --coverage && tsx scripts/run-e2e.ts"
  }
}
```

- [ ] **Step 8: Install @types/node if not already**

```bash
npm install --save-dev @types/node@^22.10.0
```

- [ ] **Step 9: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && tsx scripts/run-e2e.ts
```

(Note: e2e invocation changed from `node scripts/run-e2e.mjs` to `tsx scripts/run-e2e.ts` everywhere.)

- [ ] **Step 10: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "refactor(scripts): convert scripts/ to TS via tsx [3 files: build-extensions, copy-static, run-e2e]"
```

---

## Task 17 (C13): Mechanical naming-consistency renames

Use TS rename refactor (identifier-aware). VS Code: F2 on identifier; or `tsserver` programmatic refactor via your editor of choice.

**Renames:**

| From | To | Where |
|---|---|---|
| `controllPoint1` | `controlPoint1` | `svgcanvas.ts` + `event.ts` (~4 sites) |
| `controllPoint2` | `controlPoint2` | `svgcanvas.ts` + `event.ts` (~4 sites) |
| `getrootSctm` | `getRootSctm` | `svgcanvas.ts` + heavy use in `event.ts` |
| `getrefAttrs` | `getRefAttrs` | `svgcanvas.ts` + `svg-exec.ts` |
| `gettingSelectorManager` | `getSelectorManager` | `svgcanvas.ts:761` + `selected-elem.ts` (3 sites) |
| `idprefix` | `idPrefix` | wherever defined |
| `getbSpline` | `getBSpline` | wherever defined |
| `setbSpline` | `setBSpline` | wherever defined |
| `current_drawing_` | `currentDrawing` | `draw.ts` `Drawing` class |
| `handler_` | `#handler` (or `_handler`) | `undo.ts` |
| Other trailing-underscore pseudo-privates | `#` private fields | `historyrecording.ts`, `layer.ts`, `recalculate.ts` |

- [ ] **Step 1: Run rename for each identifier (TS-aware)**

For each rename, use editor's "Rename Symbol" feature (F2 in VS Code). This updates every typed reference. After each rename, run:

```bash
npx tsc --noEmit
```

If errors appear (e.g., a missed reference because it was a string-key access), investigate. Don't bulk-rename via sed.

- [ ] **Step 2: Verify no straggler occurrences via text search**

After all renames done:

```bash
grep -rn "controllPoint" packages src    # should be zero
grep -rn "getrootSctm" packages src      # should be zero
grep -rn "getrefAttrs" packages src      # should be zero
grep -rn "gettingSelectorManager" packages src  # should be zero
grep -rn "idprefix" packages src         # should be zero (verify case-sensitively)
grep -rn "getbSpline\|setbSpline" packages src  # should be zero
grep -rn "current_drawing_" packages src # should be zero
```

If any matches: those are likely string-key accesses or comments. Update by hand.

- [ ] **Step 3: Run full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run build && npx vitest run && tsx scripts/run-e2e.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: mechanical naming-consistency renames (TS-aware) [controllPoint -> controlPoint, getrootSctm -> getRootSctm, etc.]"
```

---

## Task 18 (C14): Final verification + cleanup

- [ ] **Step 1: Confirm no .js or .mjs remain in production scope**

```bash
find packages/svgcanvas src/editor scripts -name "*.js" -o -name "*.mjs" 2>/dev/null
```

Expected: zero output (all converted to .ts).

If any remain: investigate. Either (a) a file was missed in tasks 5-16, or (b) it's a config file deliberately left as `.mjs` (e.g., `vite.config.mjs`, `eslint.config.js`). Document any exceptions.

- [ ] **Step 2: Confirm no straggler `any` was introduced**

```bash
grep -rn ": any\| as any\|<any>" packages/svgcanvas src/editor scripts | grep -v 'eslint-disable'
```

Expected: zero output. Each surviving `any` MUST have a matching `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a tracking comment.

- [ ] **Step 3: Confirm svgcanvas.augment.d.ts is in sync**

```bash
grep -rn 'svgCanvas\.[a-zA-Z_]\+\s*=' packages/svgcanvas/core/ | wc -l
grep -c 'interface SvgCanvas' packages/svgcanvas/svgcanvas.augment.d.ts
```

Visual review: every wired-on method in `core/*.ts init()` must appear in `svgcanvas.augment.d.ts` with a tightened signature (no `(...args: unknown[]) => unknown` placeholders left).

- [ ] **Step 4: Run full PR-merge gate**

```bash
npx tsc --noEmit                           # zero errors
npm run lint                               # zero errors, zero warnings
npm run build                              # success
npx tsc --build packages/svgcanvas         # emits .d.ts
ls packages/svgcanvas/dist/svgcanvas.d.ts  # exists
npx vitest run                             # all pass
tsx scripts/run-e2e.ts                     # 81/81 pass
```

- [ ] **Step 5: Bundle smoke (manual)**

```bash
npm run build
npm run start:e2e &
# Wait for vite preview to come up
# Open http://localhost:8000/iife-index.html in Chrome 130, Firefox 135, Edge 130
# Verify: editor loads, all default extensions init (no console errors),
#         can draw rect, save SVG, reload, modify, save again
# Kill the preview process when done
```

- [ ] **Step 6: Git log review**

```bash
git log --oneline master..HEAD
```

Expected: 18 commits in the cadence-defined order. No fixup/squash commits. Each commit has a clear single-area scope.

- [ ] **Step 7: Final commit (cleanup)**

```bash
# If any final touch-ups needed (e.g., README mentions of standard linter, package.json description tweaks):
git add -A
git commit -m "chore: final TS migration cleanup — package.json polish, README mentions"
```

(Skip this commit if nothing to clean up.)

- [ ] **Step 8: Update CHANGELOG.md**

Edit `CHANGELOG.md` under `## [Unreleased]`, add a `### Changed (TS migration 2026-XX-XX)` section documenting the migration.

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): document TS migration"
```

- [ ] **Step 9: Push branch**

```bash
git push -u origin feat/ts-migration
```

- [ ] **Step 10: Open PR for review**

Open a PR from `feat/ts-migration` → `master` titled "feat(ts): migrate svgedit to TypeScript under day-one strict". Body should reference:
- The spec doc (`docs/superpowers/specs/2026-05-16-svgedit-ts-migration-design.md`)
- This plan doc
- The "regression-watch list" from spec Section 5
- The PR-merge gate checklist

---

## After this PR lands

Update `todo_svgedit.md`:
- Move #2 (JS→TS migration) to Shipped section.
- Open follow-up TODOs for the deferred items (file splits, mutable-export refactor, singleton refactor, test conversion to TS, todo #10 bug fixes).
- Update breadcrumb to point at next priority (#3 elix→Lit brainstorm, OR todo #10 bug fixes, depending on user direction).

Tag master:
```bash
git checkout master
git pull
git tag post-ts-migration
git push origin post-ts-migration
```

The `pre-ts-migration` tag remains as the worst-case rollback point.
