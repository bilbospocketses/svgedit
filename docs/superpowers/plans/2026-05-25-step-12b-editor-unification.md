# Step 12b: Editor + EditorStartup Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `EditorStartup` base class into `Editor`, eliminate the `[key: string]: any` index signature (last type-safety escape hatch in the editor layer), then extract `init()` into a standalone function.

**Architecture:** Two-commit refactor. Commit 1 collapses `EditorStartup` (784 LOC) into `Editor` (1,271 LOC), removing the inheritance + index signature + 30 `declare` forward-declarations. Commit 2 extracts the 640-line `init()` body into `editorInit.ts` as a standalone function to keep file size manageable. Zero behavior change.

**Tech Stack:** TypeScript, Vite, ESLint, Vitest, Playwright

**Repo:** `C:/Users/jscha/source/repos/svgedit`

**Spec:** `docs/superpowers/specs/2026-05-25-step-12b-editor-unification-design.md`

---

## File map

| Action | File | Purpose |
|--------|------|---------|
| Rewrite | `src/editor/Editor.ts` | Absorbs EditorStartup, becomes the single Editor class |
| Delete | `src/editor/EditorStartup.ts` | Base class eliminated |
| Create | `src/editor/editorInit.ts` | Extracted `initEditor()` function (init body + its local helpers) |
| Comment-only | `src/editor/locale.ts:103` | Update "EditorStartup.js" → "Editor.ts" in comment |
| Comment-only | `src/editor/components/seSpinInput.ts:25` | Remove "EditorStartup.ts" from comment |

---

## Task 1: Merge EditorStartup into Editor

**Files:**
- Modify: `src/editor/Editor.ts` (full rewrite of class definition + constructor + imports)
- Delete: `src/editor/EditorStartup.ts`
- Modify: `src/editor/locale.ts:103` (comment-only)
- Modify: `src/editor/components/seSpinInput.ts:25` (comment-only)

### Step 1: Rewrite Editor.ts imports

- [ ] Replace the import block (lines 1–41) with the merged version. Key changes:
  - Keep the eslint-disable line but add `@typescript-eslint/no-non-null-assertion` (from Editor) to the list
  - Remove `import EditorStartup from './EditorStartup.js'`
  - Add EditorStartup's imports: `putLocale` from `./locale.js`, `hasCustomHandler`/`getCustomHandler`/`injectExtendedContextMenuItemsIntoDom` from `./contextmenu.js`, `editorTemplate` from `./templates/editorTemplate.html` (with `@ts-expect-error`), `Rulers` from `./Rulers.js`
  - Merge the two SvgCanvas destructurings into one: `const { $id, $click, decode64, convertUnit } = SvgCanvas`
  - Keep all other existing Editor imports unchanged

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-non-null-assertion */
/**
 * The main module for the visual SVG this.
 *
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria
 * 2010 Pavol Rusnak
 * 2010 Jeff Schiller
 * 2010 Narendra Sisodiya
 * 2014 Brett Zamir
 * 2020 OptimistikSAS
 * @module SVGEditor
 */

import './components/index.js'
import './dialogs/index.js'
import { normalizeShortcut } from './common/shortcut.js'
import {
  putLocale
} from './locale.js'
import {
  hasCustomHandler, getCustomHandler, injectExtendedContextMenuItemsIntoDom
} from './contextmenu.js'
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration exists yet
import editorTemplate from './templates/editorTemplate.html'

import { isMac } from '@svgedit/svgcanvas/common/browser'

import SvgCanvas from '@svgedit/svgcanvas'
import ConfigObj from './ConfigObj.js'
import Rulers from './Rulers.js'
import LeftPanel from './panels/LeftPanel.js'
import TopPanel from './panels/TopPanel.js'
import BottomPanel from './panels/BottomPanel.js'
import LayersPanel from './panels/LayersPanel.js'
import MainMenu from './MainMenu.js'
import { getParentsUntil } from '@svgedit/svgcanvas/common/util.js'
import { EmbedServer } from '../embed/server.js'
const SVGEDIT_VERSION = '7.4.1'

/** Make window.svgEditor accessible */
declare global {
  interface Window {
    svgEditor: Editor
  }
}

const { $id, $click, decode64, convertUnit } = SvgCanvas
```

### Step 2: Rewrite class declaration and property list

- [ ] Replace `class Editor extends EditorStartup {` with `class Editor {`
- [ ] Merge the property declarations from both classes. The merged class body needs ALL properties from:
  - Editor's existing class body (lines 47–60): `langChanged`, `showSaveWarning`, `storagePromptState`, `title`, `$click`, `customExportImage`, `customExportPDF`, `callbacks`, `curContext`, `exportWindowName`, `docprops`, `shortcuts`, `_embedServer`
  - EditorStartup's own properties (lines 47–49): `extensionsAdded`, `messageQueue`, `$container`
  - EditorStartup's `declare` properties that AREN'T already in Editor (lines 52–80): `configObj`, `svgCanvas`, `i18next`, `$svgEditor`, `workarea`, `leftPanel`, `bottomPanel`, `topPanel`, `layersPanel`, `mainMenu`, `rulers`, `canvMenu`, `exportWindow`, `defaultImageURL`, `uiContext`, `selectedElement`, `multiselected`, `enableToolCancel`, `modeEvent`, `exportWindowCt`, `goodLangs`, `storage`, `isReady`, `setPanning`
  - `setConfig` — assigned in Editor constructor line 89 but never declared (today goes through index signature). Needs explicit declaration.

```typescript
class Editor {
  // --- Properties from original Editor class body ---
  langChanged: boolean
  showSaveWarning: boolean
  storagePromptState: 'ignore' | 'waiting' | 'closed'
  title: string
  $click: typeof $click
  customExportImage: boolean
  customExportPDF: boolean
  callbacks: any[]
  curContext: string | null
  exportWindowName: string | null
  docprops: boolean
  shortcuts: any[]
  public readonly _embedServer!: EmbedServer

  // --- Properties from EditorStartup (own) ---
  extensionsAdded: boolean
  messageQueue: any[]
  $container: HTMLElement

  // --- Properties from EditorStartup (formerly `declare`, now real) ---
  configObj: any
  svgCanvas: any
  i18next: any
  $svgEditor!: HTMLElement
  workarea!: HTMLElement
  leftPanel: any
  bottomPanel: any
  topPanel: any
  layersPanel: any
  mainMenu: any
  rulers!: Rulers
  canvMenu: HTMLElement | null
  exportWindow: Window | null
  defaultImageURL!: string
  uiContext!: string
  selectedElement: Element | null
  multiselected: boolean
  enableToolCancel!: boolean
  modeEvent: any
  exportWindowCt!: number
  goodLangs: string[]
  storage: Storage | null
  isReady: boolean
  setPanning!: (active: boolean) => void
  setConfig: any
```

**Note on `!` assertions:** Properties assigned in `init()` (not the constructor) need the definite-assignment assertion (`!`) since TS can't prove they're assigned before use. Properties assigned in the constructor don't need it.

### Step 3: Rewrite the constructor

- [ ] Replace `super(div)` with the 3 property assignments from EditorStartup's constructor. Keep all existing Editor constructor code after that.

Replace:
```typescript
  constructor (div: HTMLElement | null = null) {
    super(div)
```

With:
```typescript
  constructor (div: HTMLElement | null = null) {
    // Formerly EditorStartup constructor
    this.extensionsAdded = false
    this.messageQueue = []
    this.$container = (div ?? $id('svg_editor')) as HTMLElement
```

Everything from line 69 onward (`this.langChanged = false` through end of constructor at line 339) stays exactly the same.

### Step 4: Move the 5 methods from EditorStartup into Editor

- [ ] Copy the following methods from `EditorStartup.ts` into `Editor.ts`, placing them AFTER the constructor and BEFORE the existing `loadSvgString` method (currently line 348). No changes to method bodies — they already use `this.` which now resolves to the same class.

Methods to move (in order, preserving EditorStartup's ordering):

1. **`async init()`** (EditorStartup lines 99–738) — the massive startup method. Copy verbatim.

2. **`async extAndLocaleFunc()`** (EditorStartup lines 747–810) — extension + locale loader. Copy verbatim.

3. **`modeListener()`** (EditorStartup lines 816–820) — mode-change event listener. Copy verbatim.

4. **`setCursorStyle()`** (EditorStartup lines 826–852) — cursor styling per mode. Copy verbatim.

5. **`cancelTool()`** (EditorStartup lines 857–864) — Esc key handler. Copy verbatim.

### Step 5: Inline readySignal() at its call site

- [ ] In the moved `init()` method, find the call to `readySignal()` (was EditorStartup line 181, now somewhere inside `init()`). Replace it with the inlined body:

Replace:
```typescript
    // For external openers
    readySignal()
```

With:
```typescript
    // For external openers — let the opener/parent know svgedit is ready
    const w = window.opener || window.parent
    if (w) {
      try {
        w.document.documentElement.dispatchEvent(
          new w.CustomEvent('svgEditorReady', { bubbles: true, cancelable: true })
        )
      } catch { /* cross-origin — ignore */ }
    }
```

The module-level `readySignal` function definition is NOT copied from EditorStartup — it's eliminated entirely.

### Step 6: Inline getWidth()/getHeight() at their call site

- [ ] In `init()`, find the `getWidth()`/`getHeight()` definitions and their single consumer (the `winWh` object + resize handler). Replace with inlined versions:

Replace:
```typescript
    // ref: https://stackoverflow.com/a/1038781
    function getWidth () {
      return Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.offsetWidth,
        document.documentElement.clientWidth
      )
    }

    function getHeight () {
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      )
    }
    const winWh = {
      width: getWidth(),
      height: getHeight()
    }
```

With:
```typescript
    const getMaxDimension = (prop: 'Width' | 'Height') =>
      Math.max(
        (document.body as any)[`scroll${prop}`],
        (document.documentElement as any)[`scroll${prop}`],
        (document.body as any)[`offset${prop}`],
        (document.documentElement as any)[`offset${prop}`],
        (document.documentElement as any)[`client${prop}`]
      ) as number
    const winWh = {
      width: getMaxDimension('Width'),
      height: getMaxDimension('Height')
    }
```

### Step 7: Delete EditorStartup.ts

- [ ] Delete the file `src/editor/EditorStartup.ts`.

### Step 8: Update comment references

- [ ] In `src/editor/locale.ts:103`, change:
```
 * signature so `EditorStartup.js` and friends don't need to change.
```
To:
```
 * signature so `Editor.ts` and friends don't need to change.
```

- [ ] In `src/editor/components/seSpinInput.ts:25`, change:
```
 *     (Editor.ts, EditorStartup.ts, TopPanel.ts, ext-polystar.ts) — backed by
```
To:
```
 *     (Editor.ts, TopPanel.ts, ext-polystar.ts) — backed by
```

### Step 9: Verify commit 1

- [ ] Run all four verification gates. ALL must pass before committing.

```powershell
npx tsc --build --force --prefix "C:/Users/jscha/source/repos/svgedit"
```
Expected: 0 errors

```powershell
npm run lint --prefix "C:/Users/jscha/source/repos/svgedit"
```
Expected: 0 errors, 0 warnings (matches current baseline)

```powershell
npx vitest run --prefix "C:/Users/jscha/source/repos/svgedit"
```
Expected: 701/701 pass

```powershell
npx tsx scripts/run-e2e.ts --prefix "C:/Users/jscha/source/repos/svgedit"
```
Expected: 250/250 pass (chromium + firefox)

- [ ] Verify no stale references:
```powershell
git -C "C:/Users/jscha/source/repos/svgedit" grep "EditorStartup" -- "src/" "packages/" "tests/" ":!*CHANGELOG*"
```
Expected: 0 hits (CHANGELOG historical refs excluded)

### Step 10: Commit

- [ ] Stage and commit:
```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/Editor.ts src/editor/locale.ts src/editor/components/seSpinInput.ts
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/EditorStartup.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor: merge EditorStartup into Editor, eliminate [key: string]: any index signature"
```

---

## Task 2: Extract init() into standalone function

**Files:**
- Create: `src/editor/editorInit.ts`
- Modify: `src/editor/Editor.ts` (slim init down to one-liner)

### Step 1: Create editorInit.ts

- [ ] Create `src/editor/editorInit.ts`. This file receives the entire body of `init()` as a standalone function, plus the local helpers that only `init()` uses (`addListenerMulti`, `unfocus` closure, `centerCanvas` closure).

The file structure:

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import {
  putLocale
} from './locale.js'
import {
  hasCustomHandler, getCustomHandler, injectExtendedContextMenuItemsIntoDom
} from './contextmenu.js'
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration exists yet
import editorTemplate from './templates/editorTemplate.html'
import SvgCanvas from '@svgedit/svgcanvas'
import Rulers from './Rulers.js'
import type Editor from './Editor.js'

const { $id, $click, convertUnit } = SvgCanvas

/**
 * Initializes the editor: sets up the DOM, creates the SvgCanvas, binds
 * events, loads extensions, and signals readiness.
 *
 * Extracted from Editor.init() to keep Editor.ts focused on the class
 * definition and action methods.
 */
export async function initEditor (editor: Editor): Promise<void> {
  // --- entire body of init(), with `this.` replaced by `editor.` ---
  // (copy verbatim from the init() method in Editor.ts, making the
  //  mechanical this. → editor. replacement throughout)
  //
  // The following local helpers stay here (not on Editor) because they're
  // only used within this function:
  //   - addListenerMulti (line ~296 in current EditorStartup)
  //   - unfocus closure (line ~427-429)
  //   - centerCanvas closure (line ~510-513)
  //   - getMaxDimension (inlined getWidth/getHeight from Task 1 Step 6)
  //   - winWh object + resize handler
}
```

**Mechanical replacement rules for the body:**
- Every `this.` → `editor.`
- Every `this.svgCanvas` → `editor.svgCanvas`
- The `readySignal` inline from Task 1 Step 5 uses no `this` — stays as-is
- `seAlert(...)` and `seConfirm(...)` are globals — stays as-is
- The `addListenerMulti` function stays as a local function inside `initEditor`
- The `unfocus` and `centerCanvas` closures stay as local closures inside `initEditor`

**Imports needed by editorInit.ts (moved from Editor.ts since only init uses them):**
- `putLocale` from `./locale.js`
- `hasCustomHandler`, `getCustomHandler`, `injectExtendedContextMenuItemsIntoDom` from `./contextmenu.js`
- `editorTemplate` from `./templates/editorTemplate.html`
- `Rulers` from `./Rulers.js`
- `SvgCanvas` (for `$id`, `$click`, `convertUnit` — only `$id` and `convertUnit` are used in init; `$click` is used for the `aLink` handler)

**Type-only import:** `import type Editor from './Editor.js'` — avoids circular dependency at runtime (editorInit needs the Editor type for the parameter, Editor imports editorInit for the function).

### Step 2: Slim down Editor.init() to a one-liner

- [ ] In `Editor.ts`, replace the full `init()` method body with:

```typescript
  async init () {
    await initEditor(this)
  }
```

- [ ] Add import at the top of Editor.ts:
```typescript
import { initEditor } from './editorInit.js'
```

- [ ] Remove imports from Editor.ts that are now only used in editorInit.ts:
  - `putLocale` from `./locale.js`
  - `hasCustomHandler`, `getCustomHandler`, `injectExtendedContextMenuItemsIntoDom` from `./contextmenu.js`
  - `editorTemplate` from `./templates/editorTemplate.html`
  - `Rulers` from `./Rulers.js`

  Keep `Rulers` as a **type import** in Editor.ts (`import type Rulers from './Rulers.js'`) because the `rulers` property declaration needs the type.

- [ ] The `$id` and `$click` destructuring in Editor.ts stays (used by constructor + action methods). Remove `convertUnit` from Editor.ts's destructuring (only used in init → now in editorInit.ts).

Editor.ts destructuring becomes:
```typescript
const { $id, $click, decode64 } = SvgCanvas
```

### Step 3: Verify commit 2

- [ ] Run all four verification gates (same commands as Task 1 Step 9). ALL must pass.

Expected: tsc 0 errors, lint 0e/0w, vitest 701/701, e2e 250/250.

### Step 4: Commit

- [ ] Stage and commit:
```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/Editor.ts src/editor/editorInit.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor: extract init() body into standalone initEditor() function"
```

---

## Task 3: Final verification + cleanup

### Step 1: Full test suite

- [ ] Run the complete test suite one final time to confirm both commits together are clean:

```powershell
npm test --prefix "C:/Users/jscha/source/repos/svgedit"
```
Expected: lint 0e/0w, vitest 701/701, e2e 250/250.

### Step 2: Grep audit

- [ ] Confirm no stale `EditorStartup` references in code:
```powershell
git -C "C:/Users/jscha/source/repos/svgedit" grep "EditorStartup" -- "src/" "packages/" "tests/" ":!*CHANGELOG*"
```
Expected: 0 hits.

### Step 3: Verify file structure

- [ ] Confirm the expected file layout:
```powershell
Test-Path "C:/Users/jscha/source/repos/svgedit/src/editor/EditorStartup.ts"
```
Expected: `False`

```powershell
Test-Path "C:/Users/jscha/source/repos/svgedit/src/editor/editorInit.ts"
```
Expected: `True`

---

## Summary of all changes

| File | Change |
|------|--------|
| `src/editor/Editor.ts` | Absorbs EditorStartup; class no longer extends; `[key: string]: any` removed; `init()` delegates to `initEditor()` |
| `src/editor/EditorStartup.ts` | Deleted |
| `src/editor/editorInit.ts` | New — `initEditor(editor)` function with init body + local helpers |
| `src/editor/locale.ts` | Comment: "EditorStartup.js" → "Editor.ts" |
| `src/editor/components/seSpinInput.ts` | Comment: remove "EditorStartup.ts" from list |
