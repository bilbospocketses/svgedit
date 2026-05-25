# Step 12b: Editor + EditorStartup Class Unification

> **Date:** 2026-05-25
> **Status:** Approved
> **Scope:** Merge `EditorStartup` base class into `Editor`, eliminate `[key: string]: any` index signature, extract `init()` into standalone function

---

## Problem

`Editor.ts` extends `EditorStartup.ts`. The base class's `init()` method freely accesses properties and methods defined in the `Editor` subclass via `this` (e.g., `this.selectedChanged`, `this.updateCanvas`, `this.cutSelected`). TypeScript cannot resolve subclass members from a base class, so `EditorStartup` carries:

- 30 `declare` forward-declarations for Editor properties
- A `[key: string]: any` index signature (line 84) as an escape hatch for anything the `declare` list misses

This index signature is the last type-safety gap in the editor layer. Any typo in a property access inside `init()` compiles silently instead of producing a TS error.

## Solution

Merge the two classes into one `Editor` class (eliminating the inheritance), then extract `init()`'s body into a standalone function to keep the file size manageable.

## Commit sequence

### Commit 1: Merge EditorStartup into Editor

**Moves into `Editor.ts`:**
- 3 constructor properties: `extensionsAdded`, `messageQueue`, `$container` — add to Editor constructor
- 5 methods: `init()`, `extAndLocaleFunc()`, `modeListener()`, `setCursorStyle()`, `cancelTool()`

**Removes:**
- `EditorStartup.ts` — deleted entirely
- 30 `declare` lines in EditorStartup (forward-declaring Editor's own properties) — unnecessary in single class
- `[key: string]: any` index signature — the whole point
- `import EditorStartup from './EditorStartup.js'` and `extends EditorStartup` in Editor.ts
- `export default EditorStartup` from the deleted file

**Deduplicates:**
- Two `SvgCanvas` destructurings: `{ $id, $click, decode64 }` (Editor) + `{ $id, $click, convertUnit }` (EditorStartup) → single `{ $id, $click, decode64, convertUnit }`
- `Rulers` import moves from EditorStartup into Editor's import block

**Inlines at call site:**
- `readySignal()` (module-level function, 16 lines, called once at EditorStartup line 181) — inline the 6 meaningful lines at the call site
- `getWidth()` / `getHeight()` (18 lines total, each called once inside the resize handler) — inline into the resize handler

**Comment-only updates (no code change):**
- `locale.ts:103` — references EditorStartup in a comment; update to say Editor
- `seSpinInput.ts:25` — same

### Commit 2: Extract init() into standalone function

**Creates `editorInit.ts`:**
- `export async function initEditor(editor: Editor): Promise<void>` — receives the editor instance
- Body is the current `init()` method body with `this.` → `editor.`
- Local helpers that only `init()` uses move with it: `addListenerMulti`, `unfocus` closure, `centerCanvas` closure

**Modifies `Editor.ts`:**
- `init()` becomes: `async init() { await initEditor(this) }`
- Add `import { initEditor } from './editorInit.js'`

## What doesn't change

- No runtime behavior — same initialization sequence, same event wiring, same extension loading
- No changes outside `src/editor/` (no svgcanvas-layer, no tests, no build config)
- The file-level `eslint-disable` comment carries over (the pervasive `any` types are a separate concern — Step 14 scope)
- `super(div)` call in Editor constructor → plain `this.$container = (div ?? $id('svg_editor')) as HTMLElement` (was EditorStartup's constructor body)

## Resulting file structure

| Before | After |
|--------|-------|
| `EditorStartup.ts` (784 LOC) | deleted |
| `Editor.ts` (1,271 LOC) | `Editor.ts` (~1,350 LOC) |
| — | `editorInit.ts` (~650 LOC) |

## Verification gate

All four must pass before PR:

1. `npx tsc --build --force` — 0 errors
2. `npm run lint` — 0 errors, no new warnings beyond existing baseline
3. `npx vitest run` — 701/701
4. `npx tsx scripts/run-e2e.ts` — 250/250 (chromium + firefox)
5. `grep -r EditorStartup src/ packages/ tests/` — 0 hits in code (CHANGELOG historical refs are fine)

## Out of scope

- svgcanvas-layer type fixes (`curCommand: any`, `addSVGElementsFromJson` return type, `SVGPathSegment` casts) — Step 14
- `SelectModule` + wire-methods refactor — Step 14
- `tsc --build` in npm build script — Step 14
- Any behavioral changes to init() flow
