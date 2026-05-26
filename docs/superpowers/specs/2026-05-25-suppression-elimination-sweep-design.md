# TODO #19: Full Suppression-Elimination Sweep

**Date:** 2026-05-25
**Status:** Design approved, pending implementation plan
**Goal:** Eliminate every `@ts-expect-error`, file-level `eslint-disable` banner, and `as any` cast across the entire svgedit codebase.

## Baseline (measured 2026-05-25, post-Step 14f + PR-5)

| Category | `src/editor/` | `packages/svgcanvas/` | Total |
|---|---|---|---|
| `@ts-expect-error` | 6 (5 HTML-import, 1 comment) | 16 (intentional switch fallthroughs) | **22** |
| File-level `eslint-disable` | 31 banners / 30 files | 20 banners / 19 files | **51 files** |
| `as any` casts | 123 / 15 files | 42 / 10 files | **165** |

## End-State Gate

Grep the entire codebase for `as any`, `@ts-expect-error`, and file-level `eslint-disable` in `.ts` files — all return zero hits. tsc clean + lint clean + vitest 701/701 + e2e 250/250.

## Architecture: 5-PR Layer Sweep

PR-1 lands first (infrastructure dependency). PRs 2-5 are independent after that.

### Infrastructure (lands in PR-1, consumed by all subsequent PRs)

**`svgEditorInstance.ts` — accessor module replacing `window.svgEditor` global:**
- Exports `getSvgEditor(): Editor` and `setSvgEditor(editor: Editor): void`
- `Editor.ts` calls `setSvgEditor(this)` at construction instead of `window.svgEditor = this`
- All 34 consumer files switch from `declare const svgEditor: any` to `import { getSvgEditor } from '../svgEditorInstance.js'`
- `globals.d.ts` deleted entirely (completes the deferred PR-5 work)

**`vite-shims.d.ts` — ambient module declaration for HTML-as-string imports:**
```ts
declare module '*.html' {
  const value: string
  export default value
}
```
Eliminates all 5 `@ts-expect-error` HTML-import directives in the editor layer.

**`typed-events.ts` — generic addEventListener overloads for custom elements:**
- Each Lit component declares its custom event detail types
- Module augmentation on `HTMLElementEventMap` makes `addEventListener` type-aware per custom element tag
- Primary consumer: TopPanel.ts (eliminates ~50 of its 68 `as any` casts mechanically)
- Secondary consumers: BottomPanel, editorInit, dialogs, extensions

### PR-1: Editor Core (6 files + infrastructure)

**Files:** `Editor.ts`, `editorInit.ts`, `ConfigObj.ts`, `MainMenu.ts`, `Rulers.ts`, `contextmenu.ts`

- Remove all file-level `eslint-disable` banners from 6 files
- Replace `as any` casts with real types (~20 casts)
- `Editor.ts`: type `configObj`, `i18next`, panel fields with actual classes/interfaces
- `editorInit.ts` (~14 casts): `(evt as any).detail.value` → typed event map; `svgEditor` → accessor module
- `ConfigObj.ts`: narrow `pref()` return type
- `Rulers.ts`: type `getTypeMap()` return properly
- Wire accessor module: `setSvgEditor(this)` in Editor, imports in all consumers

**Gate:** 6 files zero eslint-disable, tsc clean, lint clean.

### PR-2: Panels (4 files, ~90 casts)

**Files:** `TopPanel.ts`, `BottomPanel.ts`, `LayersPanel.ts`, `LeftPanel.ts`

- **TopPanel.ts (68 casts):** ~50 from `(evt as any).detail.value` (typed event map), ~10 from `(el as any).pressed` (narrow interfaces for custom buttons), ~8 misc svgCanvas calls (ISvgCanvas covers).
- **BottomPanel.ts (15 casts):** `evt.detail` pattern + color/paint handling.
- **LayersPanel.ts (5 casts):** `(evt.currentTarget as any).textContent/parentNode` → proper `HTMLElement` narrowing.
- **LeftPanel.ts (2 casts):** `(btnEl as any).pressed` → typed custom button interface.

**Gate:** 4 files zero eslint-disable, tsc clean, lint clean.

### PR-3: Components + Dialogs (~20 casts, 13 files)

**Files:** `PaintBox.ts`, `se-paint-picker.ts`, `seMenu.ts`, `sePalette.ts`, `seList.ts`, `seExplorerButton.ts`, `jPickerShim.ts`, `se-gradient-editor.ts`, `cmenuDialog.ts`, `cmenuLayersDialog.ts`, `editorPreferencesDialog.ts`, `globalDialogs.ts`, `imagePropertiesDialog.ts`

- Components: svgEditor global → accessor module, `paint: any` → `Paint` interface
- jgraduate stack: `PaintOptions` interface for untyped paint objects in shim + gradient editor
- Dialogs: `evt.detail` typed event map pattern, dialog element method typing for `globalDialogs.ts`

**Gate:** 13 files zero eslint-disable, tsc clean, lint clean.

### PR-4: Extensions (~30 casts, 11 files)

**Files:** All 10 `ext-*.ts` files + `dragmove.ts`

Common mechanical fix across all: `import { getSvgEditor }`, type editor as `Editor`, canvas as `ISvgCanvas`, remove eslint-disable banners.

Per-extension extras:
- `ext-connector.ts`: refactor `this` aliases to arrow functions/bind (kills `no-this-alias` suppress)
- `ext-opensave.ts`: type file reader results as `string | ArrayBuffer`
- `ext-storage.ts`: type `JSON.parse` returns
- `ext-markers.ts`: fix unnecessary async, template literal types
- Several extensions: delete dead variables (kills `no-unused-vars` suppress)

**Gate:** 11 files zero eslint-disable, tsc clean, lint clean.

### PR-5: svgcanvas Core (~60 casts + 16 fallthrough restructures, ~18 files)

**5a. Fallthrough restructuring (16 sites, 3 files):**
- `path-actions.ts` (7): SVG path command uppercase/lowercase paired switches — extract shared coordinate logic into helpers, each case calls helper + `break`
- `path.ts` (6): same pattern
- `event.ts` (3): mouse event mode switch fallthroughs — extract shared cleanup into helpers

**5b. `svgcanvas.ts` (21 casts):**
- Constructor dynamic method wiring, canvas setup, `this` context narrowing
- Proper element types and `as ISvgCanvas` for self-reference

**5c. Remaining core files (~20 casts, 14 files):**
- DOM element casts: `as any` → `as SVGElement`, `as SVGPathElement`, etc.
- `utilities.ts` (4): geometry helpers with untyped SVG element access
- `svgcanvas-types.ts`: remove `no-explicit-any` banner; type `paint: any` params with `Paint` interface (shared with PR-3)

**Gate:** zero `eslint-disable`, zero `@ts-expect-error`, zero `as any` across entire `packages/svgcanvas/`. tsc clean, lint clean, vitest 701/701, e2e 250/250.

## Shared Type Definitions

Types introduced by this sweep that are consumed across multiple PRs:

- **`Paint` interface** — used by PR-3 (jgraduate, PaintBox) and PR-5 (svgcanvas-types). Define in `packages/svgcanvas/core/` and export from `@svgedit/svgcanvas`.
- **Custom element event maps** — defined in `typed-events.ts` (PR-1), consumed by PR-2 (panels), PR-3 (dialogs), PR-4 (extensions).
- **`svgEditorInstance.ts` accessor** — defined in PR-1, consumed by PR-2/3/4.

## Dependency Chain

```
PR-1 (editor core + infrastructure)
  ├── PR-2 (panels) — independent
  ├── PR-3 (components + dialogs) — independent  
  ├── PR-4 (extensions) — independent
  └── PR-5 (svgcanvas core) — independent (shares Paint type with PR-3)
```

PR-1 must merge first. PRs 2-5 can land in any order after that. If PR-3 and PR-5 both need the `Paint` type, whichever lands first defines it; the other imports it.

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Switch fallthroughs | Restructure all 16 | Fallthroughs mask inaccurate code; readers can't distinguish intentional from accidental |
| HTML-import `@ts-expect-error` | `*.html` ambient declaration in `globals.d.ts` → `vite-shims.d.ts` (since globals.d.ts deletes) | One declaration kills 5 directives |
| svgEditor global → module | Fold into PR-1 | PR-1 already touches those files; accessor module is prerequisite for cast elimination |
| TopPanel 68 casts | Generic addEventListener overloads | Eliminates cast pattern codebase-wide, not just TopPanel |
| Extensions grouping | One PR for all 10 | Same repetitive pattern; one review pass |
