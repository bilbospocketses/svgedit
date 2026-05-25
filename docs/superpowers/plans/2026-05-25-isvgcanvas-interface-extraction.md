# ISvgCanvas Interface Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract an `ISvgCanvas` interface to eliminate all `svgCanvas: any` typing across 24 files, replacing it with compile-time-checked types.

**Architecture:** New type-only file `packages/svgcanvas/core/svgcanvas-types.ts` defines `ISvgCanvas`. The SvgCanvas class adds `implements ISvgCanvas`. All 20 core files and 4 editor files replace `any` with `ISvgCanvas`. Per-file mini-interfaces (`JsonCanvasContext`, `CoordsCanvasContext`, `TouchCanvasContext`) are deleted in favor of the single interface.

**Tech Stack:** TypeScript 5.x, `import type` for cycle-free type references.

---

### Task 1: Create branch

**Files:**
- None (git only)

- [ ] **Step 1: Create feature branch from master**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" switch -c step14/isvgcanvas-interface master
```

---

### Task 2: Create `svgcanvas-types.ts` with the ISvgCanvas interface

**Files:**
- Create: `packages/svgcanvas/core/svgcanvas-types.ts`

This is the largest task. The interface has ~200 members derived from three sources in `svgcanvas.ts`:

1. **Explicit field declarations** (lines 126–183)
2. **`declare` fields** (lines 190–268)
3. **Class methods** (lines 463–1476)

**Type import strategy:** Use `import type` from sibling core modules. These are type-only imports that don't create runtime cycles. The key imports needed:

```typescript
import type { BatchCommand, Command, UndoManager } from './history.js'
import type { Drawing, Layer } from './draw.js'
import type { SelectorManager, Selector } from './select.js'
import type Paint from './paint.js'
import type { SVGElementJSON, BBoxObject } from './utilities.js'
import type * as pathModule from './path.js'
import type * as history from './history.js'
import type { NS } from './namespaces.js'
```

For `declare` fields that use `typeof importedFunction`, mirror the pattern:

```typescript
import type { addSVGElementsFromJson } from './json.js'
import type { getJsonFromSvgElements } from './json.js'
// ... etc for each imported function
```

Then in the interface:

```typescript
addSVGElementsFromJson: typeof addSVGElementsFromJson
getJsonFromSvgElements: typeof getJsonFromSvgElements
```

- [ ] **Step 1: Create the interface file**

Read `svgcanvas.ts` lines 124–286 (fields + declare blocks) and lines 463–1476 (methods). For every public member, add a corresponding interface member. The file structure is:

```typescript
// packages/svgcanvas/core/svgcanvas-types.ts

import type { BatchCommand, UndoManager } from './history.js'
import type * as history from './history.js'
import type * as draw from './draw.js'
import type * as pathModule from './path.js'
import type { SVGElementJSON, BBoxObject } from './utilities.js'
import type { Selector } from './select.js'
import type { getSelectorManager } from './select.js'
import type { NS } from './namespaces.js'
import type Paint from './paint.js'
import type dataStorage from './dataStorage.js'
// ... import type for each function used in declare blocks:
import type { getJsonFromSvgElements, addSVGElementsFromJson } from './json.js'
import type { clearSvgContentElementInit } from './clear.js'
import type { textActionsMethod } from './text-actions.js'
import type { getStrokedBBoxDefaultVisible, getVisibleElements, /* ... all utilities exports */ } from './utilities.js'
import type { changeSelectedAttributeNoUndoMethod, changeSelectedAttributeMethod } from './undo.js'
import type { setBlurNoUndo, setBlurOffsets, setBlur } from './blur-event.js'
import type { pasteElementsMethod } from './paste-elem.js'
import type { getTypeMap, convertToNum, convertUnit } from './units.js'
import type { matrixMultiply, hasMatrixTransform, transformListToTransform } from './math.js'
import type { getClosest, getParents, mergeDeep } from '../common/util.js'

export interface ISvgCanvas {
  // ── Fields (from lines 126–183) ──
  saveOptions: { round_digits: number; apply?: boolean; images?: string }
  importIds: Record<string, any>
  extensions: Record<string, any>
  removedElements: Record<string, Element>
  started: boolean
  startTransform: string | null
  currentMode: string
  currentResizeMode: string
  justSelected: Element | null
  rubberBox: Element | null
  curBBoxes: any[]
  lastClickPoint: { x: number; y: number } | null
  events: Record<string, (...args: any[]) => any>
  rootSctm: SVGMatrix | null
  drawnPath: SVGPathElement | null
  freehand: { minx: number | null; miny: number | null; maxx: number | null; maxy: number | null }
  dAttr: string | null
  startX: number | null
  startY: number | null
  rStartX: number | null
  rStartY: number | null
  initBbox: Record<string, number>
  sumDistance: number
  controlPoint2: { x: number; y: number }
  controlPoint1: { x: number; y: number }
  start: { x: number; y: number }
  end: { x: number; y: number }
  bSpline: { x: number; y: number }
  nextPos: { x: number; y: number }
  idPrefix: string
  encodableImages: Record<string, string | false>
  curConfig: Record<string, any>
  lastGoodImgUrl: string
  svgdoc: HTMLDocument
  container: HTMLElement
  svgroot: SVGSVGElement
  svgContent: SVGSVGElement
  currentDrawing: InstanceType<typeof draw.Drawing>
  zoom: number
  currentGroup: Element | null
  curText: Record<string, any>
  curShape: Record<string, any>
  curProperties: Record<string, any>
  selectedElements: (Element | null)[]
  nsMap: Record<string, string>
  selectorManager: ReturnType<typeof getSelectorManager>
  pathActions: typeof pathModule.pathActions
  uiStrings: Record<string, string>
  opacAni: SVGAnimateElement
  linkControlPoints: typeof pathModule.pathActions.linkControlPoints
  curCommand: BatchCommand | null
  filter: any
  filterHidden: boolean
  modeEvent: CustomEvent | null
  contentW: number
  contentH: number
  parameter?: any
  nextParameter?: any

  // ── Declare fields (from lines 190–268) ──
  clearSelection: (noCall?: boolean) => void
  addToSelection: (elemsToAdd: Element[], showGrips?: boolean) => void
  undoMgr: UndoManager
  getResolution: () => { w: number; h: number; zoom: number }
  mouseDownEvent: (evt: MouseEvent) => void
  mouseMoveEvent: (evt: MouseEvent) => void
  dblClickEvent: (evt: MouseEvent) => void
  mouseUpEvent: (evt: MouseEvent) => void
  mouseOutEvent: (evt: MouseEvent) => void
  DOMMouseScrollEvent: (e: WheelEvent) => void
  getTitle: (...args: unknown[]) => unknown
  setPaint: (...args: unknown[]) => unknown
  svgCanvasToString: () => string
  copySelectedElements: () => void
  deleteSelectedElements: () => void
  getJsonFromSvgElements: typeof getJsonFromSvgElements
  addSVGElementsFromJson: typeof addSVGElementsFromJson
  clearSvgContentElement: typeof clearSvgContentElementInit
  textActions: typeof textActionsMethod
  getStrokedBBox: typeof getStrokedBBoxDefaultVisible
  getVisibleElements: typeof getVisibleElements
  // ... continue for ALL declare fields (lines 215–268)

  // ── Methods (from lines 463–1476) ──
  getSvgOption (): { round_digits: number; apply?: boolean; images?: string }
  setSvgOption (key: string, value: any): void
  getSelectedElements (): (Element | null)[]
  setSelectedElements (key: number, value: Element | null): void
  setEmptySelectedElements (): void
  getSvgRoot (): SVGSVGElement
  getDOMDocument (): HTMLDocument
  getDOMContainer (): HTMLElement
  getCurConfig (): Record<string, any>
  // ... continue for ALL class methods through modeChangeEvent()
}
```

The implementer MUST read the full class body in `svgcanvas.ts` and include EVERY public field, declare field, and method. The examples above show the pattern — the remaining ~150 members follow the same mechanical transcription. Do NOT skip any member; `implements ISvgCanvas` on the class will catch any mismatch.

- [ ] **Step 2: Verify the file compiles in isolation**

Run: `npx tsc --noEmit packages/svgcanvas/core/svgcanvas-types.ts` (or the full project check)

Expected: no errors in `svgcanvas-types.ts`

---

### Task 3: Add `implements ISvgCanvas` to SvgCanvas class

**Files:**
- Modify: `packages/svgcanvas/svgcanvas.ts`

- [ ] **Step 1: Add import and implements**

At the top of `svgcanvas.ts`, add:

```typescript
import type { ISvgCanvas } from './core/svgcanvas-types.js'
```

Change the class declaration from:

```typescript
class SvgCanvas {
```

to:

```typescript
class SvgCanvas implements ISvgCanvas {
```

- [ ] **Step 2: Compile-check**

Run: `npx tsc --noEmit`

Expected: If there are errors, they indicate members in the interface that don't match the class. Fix either the interface (if the type was wrong) or the class (if a member is missing). This is the enforcement point — iterate until clean. Pre-existing errors in `src/editor/` are expected and unrelated.

- [ ] **Step 3: Commit checkpoint**

```
git -C "C:/Users/jscha/source/repos/svgedit" add packages/svgcanvas/core/svgcanvas-types.ts packages/svgcanvas/svgcanvas.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor: add ISvgCanvas interface + implements on class"
```

---

### Task 4: Update all 20 core files

**Files:**
- Modify: all 20 files listed in the spec under "Core files"

The change pattern is identical for each file. For files with existing mini-interfaces (`JsonCanvasContext`, `CoordsCanvasContext`, `TouchCanvasContext`), delete the mini-interface and replace with `ISvgCanvas`.

**Pattern A — files with `let svgCanvas: any = null` + `init(canvas: any)`:**

Before:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any = null

export const init = (canvas: any): void => {
  svgCanvas = canvas
```

After:
```typescript
import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas: ISvgCanvas | null = null

export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
```

**Pattern B — files with `init(canvas: unknown)` (already stricter than `any`):**

Same change, replacing `unknown` with `ISvgCanvas`.

**Pattern C — files with per-file mini-interfaces (`json.ts`, `coords.ts`, `touch.ts`):**

Delete the `interface JsonCanvasContext { ... }` block (or equivalent), replace with ISvgCanvas import + usage as in Pattern A.

**Pattern D — `utilities.ts` has both module-level `svgCanvas` AND a function param:**

```typescript
// Module-level: same as Pattern A
import type { ISvgCanvas } from './svgcanvas-types.js'
let svgCanvas: ISvgCanvas | null = null

// convertToPath param at line 711:
export const convertToPath = (elem: Element, attrs: Record<string, unknown>, svgCanvas: ISvgCanvas): SVGPathElement | null => {
```

**Special case — `units.ts`:** Keep the `ElementContainer` interface (it's exported and used by tests). The `init` function takes `ElementContainer`, which is a subset of `ISvgCanvas`. No change needed here — `units.ts` doesn't have `let svgCanvas: any`.

**Special case — `touch.ts`:** Delete `TouchCanvasContext`, use `ISvgCanvas` for the init param. The module-level variable is named `svgCanvas` (not `canvas`), matches the pattern.

- [ ] **Step 1: Update each of the 20 core files**

Apply the appropriate pattern (A/B/C/D) to each file. The files and their patterns:

| File | Pattern | Notes |
|------|---------|-------|
| `blur-event.ts` | B (`unknown`) | |
| `clear.ts` | B (`unknown`) | |
| `coords.ts` | C (has `CoordsCanvasContext`) | Delete interface |
| `draw.ts` | B (`unknown`) | |
| `elem-get-set.ts` | A (`any`) | |
| `event.ts` | A (`any`) | |
| `json.ts` | C (has `JsonCanvasContext`) | Delete interface |
| `path-actions.ts` | B (`unknown`) | |
| `paste-elem.ts` | B (`unknown`) | |
| `path-method.ts` | B (`unknown`) | |
| `path.ts` | A (`any`) | |
| `recalculate.ts` | B (`unknown`) | |
| `select.ts` | A (`any`) | Also fix `#selectorManager: any` → `SelectorManager` |
| `selected-elem.ts` | A (`any`) | |
| `selection.ts` | A (`any`) | |
| `svg-exec.ts` | B (`unknown`) | |
| `text-actions.ts` | B (`unknown`) | |
| `touch.ts` | C (has `TouchCanvasContext`) | Delete interface |
| `undo.ts` | B (`unknown`) | |
| `utilities.ts` | D (module + param) | `convertToPath` param too |

- [ ] **Step 2: Compile-check**

Run: `npx tsc --noEmit`

Fix any type errors that surface — these indicate members the core files access that aren't on the interface (add them) or type mismatches (fix the interface member type).

- [ ] **Step 3: Commit checkpoint**

```
git -C "C:/Users/jscha/source/repos/svgedit" add packages/svgcanvas/core/*.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor: type all core/*.ts svgCanvas as ISvgCanvas"
```

---

### Task 5: Update 4 editor files

**Files:**
- Modify: `src/editor/Editor.ts`
- Modify: `src/editor/Rulers.ts`
- Modify: `src/editor/components/PaintBox.ts`
- Modify: `src/editor/components/se-paint-picker.ts`

Editor files can import from `packages/svgcanvas` (no circular dependency). They should import `ISvgCanvas` from the package's public exports.

- [ ] **Step 1: Check if ISvgCanvas is re-exported from the package**

Look at the end of `svgcanvas.ts` (lines 1499–1530) for the `export *` and explicit re-exports. If `ISvgCanvas` is not re-exported, add it:

```typescript
export type { ISvgCanvas } from './core/svgcanvas-types.js'
```

- [ ] **Step 2: Update Editor.ts**

Change:
```typescript
svgCanvas!: any
```
To:
```typescript
import type { ISvgCanvas } from '@anthropic/svgcanvas' // or the relative path used by other editor imports
// ...
svgCanvas!: ISvgCanvas
```

Check how other editor files import from svgcanvas (look at existing `import` lines in `Editor.ts`) and follow the same pattern for the `ISvgCanvas` import.

- [ ] **Step 3: Update Rulers.ts, PaintBox.ts, se-paint-picker.ts**

Same pattern — replace `svgCanvas: any` field/param types with `ISvgCanvas`.

- [ ] **Step 4: Compile-check and commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/Editor.ts src/editor/Rulers.ts src/editor/components/PaintBox.ts src/editor/components/se-paint-picker.ts packages/svgcanvas/svgcanvas.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor: type editor-layer svgCanvas as ISvgCanvas"
```

---

### Task 6: eslint-disable cleanup pass

**Files:**
- Modify: whichever core files can have their `eslint-disable` directives removed

- [ ] **Step 1: For each core file, try removing the file-level eslint-disable**

The pattern at the top of most core files is:
```typescript
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
```

These existed because `svgCanvas` was `any`. With `ISvgCanvas`, many files may compile clean without them.

Approach: remove the directive from each file, run `npm run lint`, see which files still need it (due to OTHER `any`-typed variables or patterns). Re-add only where needed.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

For each file that reports errors after directive removal, restore the directive (or narrow it to only the rules still needed).

- [ ] **Step 3: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add -u
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore: remove eslint-disable directives no longer needed after ISvgCanvas typing"
```

---

### Task 7: Full verification

- [ ] **Step 1: Lint**

```bash
cd "C:/Users/jscha/source/repos/svgedit" && npm run lint
```

Expected: 0 errors

- [ ] **Step 2: Vitest**

```bash
npx vitest run
```

Expected: 701/701

- [ ] **Step 3: E2e**

```bash
npx tsx scripts/run-e2e.ts
```

Expected: 250/250

- [ ] **Step 4: Final commit if any fixups were needed**

Squash any fixup commits or add a final commit.
