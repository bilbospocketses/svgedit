# Suppression-Elimination Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every `@ts-expect-error`, file-level `eslint-disable` banner, and `as any` cast across the svgedit codebase (~300 sites, ~50 files).

**Architecture:** 5-PR layer sweep. PR-1 lands infrastructure + editor core. PRs 2-5 are independent after PR-1 merges. Each PR removes ALL suppressions from its layer and passes the gate (tsc clean + lint clean + vitest 701/701).

**Tech Stack:** TypeScript 5.x strict mode, ESLint typescript-eslint, Lit 3 custom elements, Vite 7

**Repo:** `C:\Users\jscha\source\repos\svgedit` (remote: `origin` = `bilbospocketses/svgedit`)

**Git discipline:** `git -C "C:\Users\jscha\source\repos\svgedit"` for ALL git commands (multi-session cwd rule). Branch from `origin/master`. PR via `gh pr create --squash`. Merge via `gh pr checks --watch` then `gh pr merge --squash --delete-branch` after all checks green.

---

## PR-1: Infrastructure + Editor Core

### Task 1: Create `vite-shims.d.ts` for HTML-as-string imports

**Files:**
- Create: `src/editor/vite-shims.d.ts`

- [ ] **Step 1: Create the ambient module declaration**

```ts
// src/editor/vite-shims.d.ts
declare module '*.html' {
  const value: string
  export default value
}
```

- [ ] **Step 2: Remove all 5 `@ts-expect-error` HTML-import directives**

Files to edit (remove the `// @ts-expect-error: *.html imported...` line above each HTML import):
- `src/editor/editorInit.ts:18`
- `src/editor/Rulers.ts:2`
- `src/editor/panels/TopPanel.ts:5`
- `src/editor/panels/LeftPanel.ts:4`
- `src/editor/panels/LayersPanel.ts:4`
- `src/editor/panels/BottomPanel.ts:4`

- [ ] **Step 3: Verify**

Run: `cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force`
Expected: clean (no output)

- [ ] **Step 4: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" add src/editor/vite-shims.d.ts src/editor/editorInit.ts src/editor/Rulers.ts src/editor/panels/TopPanel.ts src/editor/panels/LeftPanel.ts src/editor/panels/LayersPanel.ts src/editor/panels/BottomPanel.ts
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "chore: add vite-shims.d.ts, remove 5 @ts-expect-error HTML-import directives"
```

---

### Task 2: Create `svgEditorInstance.ts` accessor module

**Files:**
- Create: `src/editor/svgEditorInstance.ts`
- Modify: `src/editor/Editor.ts`
- Delete: `src/editor/globals.d.ts`

- [ ] **Step 1: Create the accessor module**

```ts
// src/editor/svgEditorInstance.ts
import type Editor from './Editor.js'

let _instance: Editor | null = null

export function getSvgEditor (): Editor {
  if (!_instance) throw new Error('svgEditor not initialized')
  return _instance
}

export function setSvgEditor (editor: Editor): void {
  _instance = editor
}
```

- [ ] **Step 2: Wire `setSvgEditor` into `Editor.ts`**

In `src/editor/Editor.ts`:

Add import:
```ts
import { setSvgEditor } from './svgEditorInstance.js'
```

Replace `window.svgEditor = this` (line ~359) with:
```ts
setSvgEditor(this)
window.svgEditor = this  // keep for browser devtools access
```

- [ ] **Step 3: Convert all `declare const svgEditor` consumers**

Every file that has `declare const svgEditor: any` or `declare const svgEditor: SvgEditorGlobal` or `const svgEditor: any = this` switches to:

```ts
import { getSvgEditor } from '../svgEditorInstance.js'
// (adjust relative path per file depth)
```

Then replace `svgEditor.foo` usages with `getSvgEditor().foo`, OR assign locally:
```ts
const svgEditor = getSvgEditor()
```

**Files to convert** (grep `svgEditor` across `src/editor/`; these 34 files access the global):

Editor core (PR-1 scope — convert now):
- `src/editor/editorInit.ts`
- `src/editor/ConfigObj.ts`
- `src/editor/MainMenu.ts`
- `src/editor/Rulers.ts`
- `src/editor/locale.ts`

Components/dialogs (PR-3 scope — convert now so globals.d.ts can delete):
- `src/editor/components/se-paint-picker.ts`
- `src/editor/components/seButton.ts`
- `src/editor/components/seExplorerButton.ts`
- `src/editor/components/seFlyingButton.ts`
- `src/editor/components/seList.ts`
- `src/editor/components/seListItem.ts`
- `src/editor/components/seMenu.ts`
- `src/editor/components/seMenuItem.ts`
- `src/editor/components/sePalette.ts`
- `src/editor/components/seSpinInput.ts`
- `src/editor/components/seZoom.ts`
- `src/editor/dialogs/svgSourceDialog.ts`

Panels (PR-2 scope — convert now):
- `src/editor/panels/TopPanel.ts`
- `src/editor/panels/BottomPanel.ts`
- `src/editor/panels/LayersPanel.ts`
- `src/editor/panels/LeftPanel.ts`

Extensions (PR-4 scope — convert now):
- `src/editor/extensions/ext-connector/ext-connector.ts`
- `src/editor/extensions/ext-eyedropper/ext-eyedropper.ts`
- `src/editor/extensions/ext-grid/ext-grid.ts`
- `src/editor/extensions/ext-layer_view/ext-layer_view.ts`
- `src/editor/extensions/ext-markers/ext-markers.ts`
- `src/editor/extensions/ext-opensave/ext-opensave.ts`
- `src/editor/extensions/ext-overview_window/ext-overview_window.ts`
- `src/editor/extensions/ext-panning/ext-panning.ts`
- `src/editor/extensions/ext-polystar/ext-polystar.ts`
- `src/editor/extensions/ext-shapes/ext-shapes.ts`
- `src/editor/extensions/ext-storage/ext-storage.ts`

**Extension init pattern.** Every extension currently does:
```ts
async init (this: any) {
  const svgEditor: any = this
```
Replace with:
```ts
async init () {
  const svgEditor = getSvgEditor()
```
The extension init contract passes the editor as `this`, but since we now have the accessor module, we don't need the `this` binding. Verify by checking that `svgCanvas` is accessed via `svgEditor.svgCanvas` (not via a separate argument).

Similarly, `loadExtensionTranslation` functions that take `svgEditor: any` as a parameter should import the accessor directly:
```ts
const loadExtensionTranslation = async function (): Promise<void> {
  const svgEditor = getSvgEditor()
  // ...
}
```

- [ ] **Step 4: Delete `globals.d.ts`**

```
git -C "C:\Users\jscha\source\repos\svgedit" rm src/editor/globals.d.ts
```

Also remove the `declare global { interface Window { svgEditor: Editor } }` block from `Editor.ts` — the window assignment is now just for devtools convenience, not type infrastructure.

- [ ] **Step 5: Verify**

Run: `cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force && npm run lint`
Expected: both clean

Run: `cd "C:\Users\jscha\source\repos\svgedit" && npx vitest run`
Expected: 701/701

- [ ] **Step 6: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" add -A
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "refactor: replace svgEditor global with accessor module, delete globals.d.ts"
```

---

### Task 3: Create `typed-events.ts` custom element event map

**Files:**
- Create: `src/editor/typed-events.ts`

This task creates the generic addEventListener infrastructure that eliminates `(evt as any).detail.value` casts codebase-wide.

- [ ] **Step 1: Audit custom element event detail shapes**

Grep for `dispatchEvent(new CustomEvent` across `src/editor/components/` and `src/editor/dialogs/` to catalog every custom event and its detail type. Build a map of `{ tagName: { eventName: detailType } }`.

Key patterns to find:
- `se-input`, `se-spin-input`, `se-select`, `se-dropdown` → `change` event with `{ value: string }`
- `se-button`, `se-flyingbutton` → `click` event (no detail or `{ pressed: boolean }`)
- `se-colorpicker` → `change` event with `{ paint: Paint }`
- `se-list` → `change` event with `{ value: string }`
- `se-zoom` → `change` event with `{ value: string }`
- Dialog elements → `change` event with dialog-specific detail shapes

- [ ] **Step 2: Write the typed events module**

```ts
// src/editor/typed-events.ts

// -- Custom element event detail maps --
// Each key is the custom element tag name; value maps event names to detail types.

export interface SeInputChangeDetail { value: string }
export interface SeSpinInputChangeDetail { value: string }
export interface SeSelectChangeDetail { value: string }
export interface SeListChangeDetail { value: string }
export interface SeZoomChangeDetail { value: string }
export interface SePaintPickerChangeDetail { paint: unknown } // narrowed to Paint in PR-3/5
export interface SeButtonClickDetail { pressed: boolean }

// Map from custom-element tag → event → CustomEvent detail
interface CustomElementEventDetailMap {
  'se-input': { change: SeInputChangeDetail }
  'se-spin-input': { change: SeSpinInputChangeDetail }
  'se-select': { change: SeSelectChangeDetail }
  'se-dropdown': { change: SeSelectChangeDetail }
  'se-list': { change: SeListChangeDetail }
  'se-zoom': { change: SeZoomChangeDetail }
  'se-colorpicker': { change: SePaintPickerChangeDetail }
  'se-button': { click: SeButtonClickDetail }
  'se-flyingbutton': { click: SeButtonClickDetail }
}

// -- Helper to extract typed detail from events --

/**
 * Type-safe accessor for CustomEvent.detail on our custom elements.
 * Replaces `(evt as any).detail.value` with `typedDetail<SeInputChangeDetail>(evt).value`.
 */
export function typedDetail<T> (evt: Event): T {
  return (evt as CustomEvent<T>).detail
}

// -- HTMLElement augmentation for addEventListener --
// This lets `$id('some-se-input')!.addEventListener('change', (evt) => { evt.detail.value })`
// work without casts when the element is typed as a custom element.

type CustomElementTagMap = {
  [K in keyof CustomElementEventDetailMap]: HTMLElement & {
    addEventListener<E extends keyof CustomElementEventDetailMap[K]>(
      type: E,
      listener: (evt: CustomEvent<CustomElementEventDetailMap[K][E]>) => void,
      options?: boolean | AddEventListenerOptions
    ): void
  }
}

declare global {
  interface HTMLElementTagNameMap extends CustomElementTagMap {}
}

export type { CustomElementEventDetailMap }
```

**Note:** The exact detail interfaces will need adjustment during implementation based on the Step 1 audit. The shapes above are based on the most common patterns observed in TopPanel.ts and editorInit.ts. The implementer MUST grep `dispatchEvent` in each component to verify.

- [ ] **Step 3: Verify the module compiles**

Run: `cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force`
Expected: clean

- [ ] **Step 4: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" add src/editor/typed-events.ts
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "feat: add typed-events.ts custom element event map infrastructure"
```

---

### Task 4: Sweep editor core files — eliminate all suppressions

**Files:**
- Modify: `src/editor/Editor.ts`
- Modify: `src/editor/editorInit.ts`
- Modify: `src/editor/ConfigObj.ts`
- Modify: `src/editor/MainMenu.ts`
- Modify: `src/editor/Rulers.ts`
- Modify: `src/editor/contextmenu.ts`

- [ ] **Step 1: Remove file-level `eslint-disable` banners from all 6 files**

Delete the `/* eslint-disable ... */` line at the top of each file.

- [ ] **Step 2: Run lint to see what surfaces**

Run: `cd "C:\Users\jscha\source\repos\svgedit" && npm run lint 2>&1 | head -80`

This will show every suppressed error that was hiding. Fix each one:

**Common fix patterns:**

| eslint error | Fix |
|---|---|
| `@typescript-eslint/no-explicit-any` | Replace `: any` with the real type. For `svgCanvas` → `ISvgCanvas`. For `configObj` → `ConfigObj`. For event params → use `typedDetail<T>()` or proper `Event` types. |
| `@typescript-eslint/no-unsafe-call` | The callee is typed `any`. Type the object it's called on (usually `svgCanvas` or `svgEditor`, both now typed). |
| `@typescript-eslint/no-unsafe-member-access` | Same root — accessing a member on an `any`-typed object. Fix the object's type. |
| `@typescript-eslint/no-unsafe-assignment` | Assigning from an `any`-typed expression. Fix the source expression's type. |
| `@typescript-eslint/no-unsafe-argument` | Passing an `any`-typed value as a function argument. Fix the value's type. |
| `@typescript-eslint/no-non-null-assertion` | Replace `foo!` with a null check or use optional chaining `foo?.`. |

**Per-file specifics:**

**Editor.ts** — Type the remaining `any` fields:
```ts
configObj!: ConfigObj           // import ConfigObj from './ConfigObj.js'
i18next!: import('i18next').i18n  // or a narrow interface if circular
leftPanel!: LeftPanel
bottomPanel!: BottomPanel
topPanel!: TopPanel
layersPanel!: LayersPanel
mainMenu!: MainMenu
callbacks: Array<(...args: unknown[]) => void>
shortcuts: Array<{ key: string; fn: () => void }>
messageQueue: Array<{ title: string; message: string }>
```
The actual shapes of `callbacks`, `shortcuts`, `messageQueue` must be verified by grepping their usage. The types above are starting points — the implementer must read how each field is populated and consumed.

**editorInit.ts (~14 `as any` casts)** — Most are `(evt as any).detail.value`. Replace with:
```ts
import { typedDetail, type SeInputChangeDetail } from './typed-events.js'

// Before:
editor.svgCanvas.setFontFamily((evt as any).detail.value)
// After:
editor.svgCanvas.setFontFamily(typedDetail<SeInputChangeDetail>(evt).value)
```

**ConfigObj.ts** — Remove banner. The `pref()` method likely returns `string | boolean | number | undefined` — type it explicitly. Grep for all `pref()` call sites to verify the return type union.

**MainMenu.ts** — Remove banner. Most unsafe accesses are through `svgCanvas` (already ISvgCanvas) and `svgEditor` (now accessor module).

**Rulers.ts** — Remove banner. `getTypeMap()` returns `Record<string, number>` — type the destructured result. Remove `as any` on line assignments.

**contextmenu.ts** — Remove banner. Minimal casts expected.

- [ ] **Step 3: Run full gate**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force && npm run lint && npx vitest run
```
Expected: tsc clean, lint clean, vitest 701/701

- [ ] **Step 4: Verify zero suppressions in PR-1 files**

```
grep -r "eslint-disable" src/editor/Editor.ts src/editor/editorInit.ts src/editor/ConfigObj.ts src/editor/MainMenu.ts src/editor/Rulers.ts src/editor/contextmenu.ts
grep -r "as any" src/editor/Editor.ts src/editor/editorInit.ts src/editor/ConfigObj.ts src/editor/MainMenu.ts src/editor/Rulers.ts src/editor/contextmenu.ts
grep -r "@ts-expect-error" src/editor/Editor.ts src/editor/editorInit.ts src/editor/ConfigObj.ts src/editor/MainMenu.ts src/editor/Rulers.ts src/editor/contextmenu.ts
```
Expected: all return zero hits

- [ ] **Step 5: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" add -A
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "refactor: eliminate all type suppressions from editor core (6 files)"
```

---

### Task 5: PR-1 gate, push, and merge

- [ ] **Step 1: Run e2e tests**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsx scripts/run-e2e.ts
```
Expected: 250/250 (retry flaky Firefox if needed)

- [ ] **Step 2: Update CHANGELOG.md**

Add a `### Changed (TODO #19 PR-1 — editor core type-safety sweep — 2026-05-25)` section under `## [Unreleased]` documenting: accessor module, vite-shims, typed-events infrastructure, 6 files cleaned, globals.d.ts deleted.

- [ ] **Step 3: Commit CHANGELOG, push, create PR**

```
git -C "C:\Users\jscha\source\repos\svgedit" add CHANGELOG.md
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "docs: CHANGELOG for #19 PR-1"
git -C "C:\Users\jscha\source\repos\svgedit" push origin <branch-name> -u
gh pr create --repo bilbospocketses/svgedit --base master --head <branch-name> --title "#19 PR-1: editor core type-safety sweep + infrastructure" --body "..."
```

- [ ] **Step 4: Wait for checks, merge**

```
gh pr checks <N> --repo bilbospocketses/svgedit --watch
gh pr merge <N> --repo bilbospocketses/svgedit --squash --delete-branch
```

---

## PR-2: Panels

### Task 6: Sweep all 4 panel files

**Branch from:** `origin/master` (after PR-1 merges)

**Files:**
- Modify: `src/editor/panels/TopPanel.ts`
- Modify: `src/editor/panels/BottomPanel.ts`
- Modify: `src/editor/panels/LayersPanel.ts`
- Modify: `src/editor/panels/LeftPanel.ts`

- [ ] **Step 1: Remove all `eslint-disable` banners from 4 files**

- [ ] **Step 2: Fix TopPanel.ts (~68 casts)**

Three patterns to fix:

**Pattern A — `(evt as any).detail.value` (~50 sites):**
```ts
import { typedDetail, type SeInputChangeDetail } from '../typed-events.js'

// Before:
$id('tool_font_family')!.addEventListener('change', (evt: any) => {
  this.editor.svgCanvas.setFontFamily(evt.detail.value)
})
// After:
$id('tool_font_family')!.addEventListener('change', (evt) => {
  this.editor.svgCanvas.setFontFamily(typedDetail<SeInputChangeDetail>(evt).value)
})
```

**Pattern B — `(el as any).pressed` / `($id('x') as any).value` (~10 sites):**
```ts
// Before:
let value = ($id('tool_align_relative') as any).value
// After:
let value = ($id('tool_align_relative') as HTMLSelectElement)?.value ?? ''
```

For custom button `pressed` property:
```ts
// Before:
;(btnEl as any).pressed = true
// After:
;(btnEl as HTMLElement & { pressed: boolean }).pressed = true
```

Or define a `PressableButton` interface in `typed-events.ts` if the pattern repeats enough.

**Pattern C — method params typed `any` (~8 sites):**
```ts
// Before:
attrChanger (e: any): boolean | void {
// After:
attrChanger (e: Event): boolean | void {
  const target = e.target as HTMLInputElement
```

- [ ] **Step 3: Fix BottomPanel.ts (~15 casts)**

Same patterns as TopPanel. Additionally, color/paint handling with `svgCanvas.setPaint()` — the paint argument type should use the `SePaintPickerChangeDetail` or a `Paint` interface.

- [ ] **Step 4: Fix LayersPanel.ts (~5 casts)**

```ts
// Before:
;(evt.currentTarget as any).parentNode.classList.add('layersel')
// After:
;(evt.currentTarget as HTMLElement).parentNode!.classList.add('layersel')
```

- [ ] **Step 5: Fix LeftPanel.ts (~2 casts)**

```ts
// Before:
;(b as any).pressed = false
// After:
;(b as HTMLElement & { pressed: boolean }).pressed = false
```

- [ ] **Step 6: Run full gate**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force && npm run lint && npx vitest run
```
Expected: tsc clean, lint clean, vitest 701/701

- [ ] **Step 7: Verify zero suppressions in panel files**

Grep all 4 files for `eslint-disable`, `as any`, `@ts-expect-error` — all zero.

- [ ] **Step 8: CHANGELOG, commit, push, PR, watch checks, merge**

Same flow as Task 5.

---

## PR-3: Components + Dialogs

### Task 7: Sweep all 13 component + dialog files

**Branch from:** `origin/master` (after PR-1 merges)

**Files:**
- Modify: `src/editor/components/PaintBox.ts`
- Modify: `src/editor/components/se-paint-picker.ts`
- Modify: `src/editor/components/seMenu.ts`
- Modify: `src/editor/components/sePalette.ts`
- Modify: `src/editor/components/seList.ts`
- Modify: `src/editor/components/seExplorerButton.ts`
- Modify: `src/editor/components/jgraduate/jPickerShim.ts`
- Modify: `src/editor/components/jgraduate/se-gradient-editor.ts`
- Modify: `src/editor/dialogs/cmenuDialog.ts`
- Modify: `src/editor/dialogs/cmenuLayersDialog.ts`
- Modify: `src/editor/dialogs/editorPreferencesDialog.ts`
- Modify: `src/editor/dialogs/globalDialogs.ts`
- Modify: `src/editor/dialogs/imagePropertiesDialog.ts`
- Create: `packages/svgcanvas/core/paint.ts` (shared `Paint` interface)

- [ ] **Step 1: Define the `Paint` interface**

Grep for `paint` usage across PaintBox.ts, se-paint-picker.ts, jPickerShim.ts, se-gradient-editor.ts, and `svgcanvas.ts` to determine the shape. Create:

```ts
// packages/svgcanvas/core/paint.ts
export interface PaintOptions {
  alpha: number
  solidColor?: string
  linearGradient?: Element
  radialGradient?: Element
}
```

Export from `@svgedit/svgcanvas` barrel. Exact shape must be verified by reading `SvgCanvas.Paint` constructor and how PaintBox.getPaint builds the options object.

- [ ] **Step 2: Remove all `eslint-disable` banners from 13 files**

- [ ] **Step 3: Fix each file**

**Components:** replace `svgEditor` global access (already done in Task 2 accessor conversion), type `paint: any` fields as `PaintOptions`.

**jgraduate stack:** `jPickerShim.ts` and `se-gradient-editor.ts` — type the internal color/gradient state objects. These files have complex internal state; read each carefully.

**Dialogs:** `(evt as any).detail` → `typedDetail<T>(evt)`. `globalDialogs.ts` (7 casts) — type the dialog element method calls by asserting to the Lit component class types.

- [ ] **Step 4: Run full gate + verify zero suppressions**

Same pattern: tsc + lint + vitest + grep verification.

- [ ] **Step 5: CHANGELOG, commit, push, PR, watch checks, merge**

---

## PR-4: Extensions

### Task 8: Sweep all 11 extension files

**Branch from:** `origin/master` (after PR-1 merges)

**Files:**
- Modify: `src/editor/extensions/ext-connector/ext-connector.ts`
- Modify: `src/editor/extensions/ext-eyedropper/ext-eyedropper.ts`
- Modify: `src/editor/extensions/ext-grid/ext-grid.ts`
- Modify: `src/editor/extensions/ext-layer_view/ext-layer_view.ts`
- Modify: `src/editor/extensions/ext-markers/ext-markers.ts`
- Modify: `src/editor/extensions/ext-opensave/ext-opensave.ts`
- Modify: `src/editor/extensions/ext-overview_window/ext-overview_window.ts`
- Modify: `src/editor/extensions/ext-overview_window/dragmove/dragmove.ts`
- Modify: `src/editor/extensions/ext-panning/ext-panning.ts`
- Modify: `src/editor/extensions/ext-polystar/ext-polystar.ts`
- Modify: `src/editor/extensions/ext-shapes/ext-shapes.ts`
- Modify: `src/editor/extensions/ext-storage/ext-storage.ts`
- Modify: `src/editor/extensions/ext-storage/storageDialog.ts`

- [ ] **Step 1: Remove all `eslint-disable` banners from all files**

- [ ] **Step 2: Apply the mechanical extension pattern**

Every extension follows this pattern. Before:
```ts
/* eslint-disable @typescript-eslint/no-explicit-any, ... */
const loadExtensionTranslation = async function (svgEditor: any): Promise<void> {
  let translationModule
  const lang = svgEditor.configObj.pref('lang')
  // ...
  svgEditor.i18next.addResourceBundle(lang, name, translationModule.default)
}

export default {
  name,
  async init (this: any) {
    const svgEditor: any = this
    await loadExtensionTranslation(svgEditor)
    const { svgCanvas } = svgEditor
    // ...
  }
}
```

After:
```ts
import { getSvgEditor } from '../../svgEditorInstance.js'
import type { ISvgCanvas } from '@svgedit/svgcanvas'

const loadExtensionTranslation = async function (): Promise<void> {
  const svgEditor = getSvgEditor()
  let translationModule
  const lang = svgEditor.configObj.pref('lang')
  // ...
  svgEditor.i18next.addResourceBundle(lang, name, translationModule.default)
}

export default {
  name,
  async init () {
    const svgEditor = getSvgEditor()
    await loadExtensionTranslation()
    const svgCanvas: ISvgCanvas = svgEditor.svgCanvas
    // ...
  }
}
```

- [ ] **Step 3: Per-extension extras**

- **ext-connector.ts:** Replace `const self = this` (this-alias) with arrow functions or `.bind(this)`. Delete unused variables flagged by `no-unused-vars`.
- **ext-opensave.ts:** Type FileReader results: `reader.result as string`.
- **ext-storage.ts:** Type `JSON.parse()` returns with explicit type annotations.
- **ext-markers.ts:** Remove `async` from functions that don't `await`. Fix template literal expressions flagged by `restrict-template-expressions` (use `String()` wrapping).
- **ext-eyedropper, ext-grid, ext-layer_view, ext-polystar, ext-panning, ext-shapes:** Delete unused variables. Replace `this` aliases with arrow functions.
- **dragmove.ts:** Type event handler params as `MouseEvent` / `TouchEvent`.

- [ ] **Step 4: Run full gate + verify zero suppressions**

- [ ] **Step 5: CHANGELOG, commit, push, PR, watch checks, merge**

---

## PR-5: svgcanvas Core

### Task 9: Restructure switch fallthroughs (16 sites, 3 files)

**Branch from:** `origin/master` (after PR-1 merges)

**Files:**
- Modify: `packages/svgcanvas/core/path-actions.ts` (7 fallthroughs)
- Modify: `packages/svgcanvas/core/path.ts` (6 fallthroughs)
- Modify: `packages/svgcanvas/core/event.ts` (3 fallthroughs)

- [ ] **Step 1: Restructure path-actions.ts fallthroughs**

The pattern is uppercase SVG commands (absolute coords) adjusting values then falling through to lowercase (relative coords). Extract the shared logic:

Before (H/h example):
```ts
// @ts-expect-error: intentional fallthrough — H adjusts x then shares h path
case 'H':
  x -= curx
case 'h':
  if (toRel) {
    y = 0; curx += x; letter = 'l'
  } else {
    y = cury; x += curx; curx = x; letter = 'L'
  }
  d += pathDSegment(letter, [[x, y]])
  break
```

After:
```ts
case 'H':
  x -= curx
  // shared h logic
  if (toRel) {
    y = 0; curx += x; letter = 'l'
  } else {
    y = cury; x += curx; curx = x; letter = 'L'
  }
  d += pathDSegment(letter, [[x, y]])
  break
case 'h':
  if (toRel) {
    y = 0; curx += x; letter = 'l'
  } else {
    y = cury; x += curx; curx = x; letter = 'L'
  }
  d += pathDSegment(letter, [[x, y]])
  break
```

For short shared blocks (2-5 lines), inline duplication is clearer than a helper function. For longer blocks (the C/c, Q/q, A/a cases with 5+ lines), extract a local helper:

```ts
const applyRelCubic = () => {
  // shared cubic logic
}
case 'C':
  x -= curx; x1 -= curx; x2 -= curx
  y -= cury; y1 -= cury; y2 -= cury
  applyRelCubic()
  break
case 'c':
  applyRelCubic()
  break
```

Apply the same pattern to all 7 fallthrough sites in path-actions.ts. Read the full switch to understand each case's shared logic before restructuring.

- [ ] **Step 2: Restructure path.ts fallthroughs (6 sites)**

Same uppercase/lowercase SVG command pattern. Apply identical restructuring.

- [ ] **Step 3: Restructure event.ts fallthroughs (3 sites)**

These are mode-switch fallthroughs (fhrect→fhpath, multiselect→select, text→default). Read the full switch context; extract shared cleanup into local helpers if the shared block is 5+ lines.

- [ ] **Step 4: Verify**

Run: `cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force && npm run lint`
Expected: clean

- [ ] **Step 5: Commit**

```
git -C "C:\Users\jscha\source\repos\svgedit" commit -m "refactor: restructure 16 switch fallthroughs in path-actions, path, event"
```

---

### Task 10: Sweep svgcanvas.ts + remaining core files (~60 casts)

**Files:**
- Modify: `packages/svgcanvas/svgcanvas.ts` (21 casts)
- Modify: `packages/svgcanvas/core/event.ts` (6 casts)
- Modify: `packages/svgcanvas/core/utilities.ts` (4 casts)
- Modify: `packages/svgcanvas/core/svg-exec.ts` (2 casts)
- Modify: `packages/svgcanvas/core/recalculate.ts` (2 casts)
- Modify: `packages/svgcanvas/core/selected-elem.ts` (2 casts)
- Modify: `packages/svgcanvas/core/path-method.ts` (2 casts)
- Modify: `packages/svgcanvas/core/coords.ts` (1 cast)
- Modify: `packages/svgcanvas/core/math.ts` (1 cast)
- Modify: `packages/svgcanvas/core/paste-elem.ts` (1 cast)
- Modify: `packages/svgcanvas/core/svgcanvas-types.ts` (remove `no-explicit-any` banner, type `paint: any` → `PaintOptions`)
- Modify: All remaining core files with `eslint-disable` banners (draw.ts, elem-get-set.ts, select.ts, selection.ts, text-actions.ts, undo.ts, path-actions.ts, path.ts)

- [ ] **Step 1: Remove ALL `eslint-disable` banners from all svgcanvas .ts files**

- [ ] **Step 2: Fix `svgcanvas.ts` (21 casts)**

Most are in the constructor and static method wiring. Common fixes:
- `as any` on DOM element creation → `as SVGElement`, `as SVGGElement`, etc.
- `this as any` in method wiring → `this as ISvgCanvas` or remove if unnecessary
- `SvgCanvas.Paint` constructor — type the paint options parameter

- [ ] **Step 3: Fix remaining core files**

**Pattern:** most `as any` casts in core files are DOM element narrowing:
```ts
// Before:
const elem = getElement(id) as any
elem.setAttribute(...)
// After:
const elem = getElement(id) as SVGElement | null
elem?.setAttribute(...)
```

Per-file specifics that require reading the actual code:
- `event.ts` (6 casts): mouse event target narrowing, element type casts
- `utilities.ts` (4 casts): geometry helper DOM access
- `svg-exec.ts` (2 casts): SVG serialization element access
- `recalculate.ts` (2 casts): transform matrix element casts
- `selected-elem.ts` (2 casts): selection element casts
- `path-method.ts` (2 casts): path segment element access

- [ ] **Step 4: Type `paint: any` in svgcanvas-types.ts**

Import `PaintOptions` from `./paint.js` (defined in PR-3 Task 7, or define here if PR-5 lands first):
```ts
// Before:
setPaint (type: string, paint: any): void
// After:
setPaint (type: string, paint: PaintOptions): void
```

- [ ] **Step 5: Run full gate**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force && npm run lint && npx vitest run
```
Expected: tsc clean, lint clean, vitest 701/701

Run e2e:
```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsx scripts/run-e2e.ts
```
Expected: 250/250

- [ ] **Step 6: Verify zero suppressions in ALL svgcanvas files**

```
grep -r "eslint-disable" packages/svgcanvas/ --include="*.ts"
grep -r "as any" packages/svgcanvas/ --include="*.ts"
grep -r "@ts-expect-error" packages/svgcanvas/ --include="*.ts"
```
Expected: all zero

- [ ] **Step 7: CHANGELOG, commit, push, PR, watch checks, merge**

---

## Final Gate

### Task 11: End-state verification

After all 5 PRs have merged:

- [ ] **Step 1: Pull latest master**

```
git -C "C:\Users\jscha\source\repos\svgedit" fetch origin master
```

- [ ] **Step 2: Grep entire codebase for suppressions**

```
grep -r "as any" src/ packages/ --include="*.ts"
grep -r "@ts-expect-error" src/ packages/ --include="*.ts"
grep -r "eslint-disable" src/ packages/ --include="*.ts"
```

Expected: all three return zero hits.

- [ ] **Step 3: Full test suite**

```
cd "C:\Users\jscha\source\repos\svgedit" && npx tsc --build --force && npm run lint && npx vitest run && npx tsx scripts/run-e2e.ts
```

Expected: tsc clean, lint clean, vitest 701/701, e2e 250/250.

- [ ] **Step 4: Update TODO #19 in memory**

Mark TODO #19 as SHIPPED in `todo_svgedit.md`. Update active item count and project_index.md.
