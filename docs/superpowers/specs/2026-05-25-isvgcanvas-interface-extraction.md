# ISvgCanvas Interface Extraction — Step 14d

## Problem

Every `core/*.ts` module receives the `SvgCanvas` instance via an `init(canvas)` function and stores it as `let svgCanvas: any`. The `any` exists because `svgcanvas.ts` imports from `core/*.ts`, so `core/*.ts` cannot import `SvgCanvas` back without a circular dependency. This forces 20 core files + 4 editor files to lose all type safety on the ~256-member `SvgCanvas` API surface.

## Solution

Extract a type-only `ISvgCanvas` interface into a new file that both `svgcanvas.ts` and `core/*.ts` can import without creating a cycle.

## Architecture

```
core/svgcanvas-types.ts  (NEW — pure types, zero runtime code)
    ↑ import type        ↑ import type
    |                    |
svgcanvas.ts             core/*.ts (20 files)
(implements ISvgCanvas)  (let svgCanvas: ISvgCanvas | null)
```

- `core/svgcanvas-types.ts` imports types from other core modules (`history.ts`, `utilities.ts`, `paint.ts`, `draw.ts`, `math.ts`, `units.ts`, `select.ts`, `namespaces.ts`, `path.ts`) — all type-only, no runtime cycle.
- `svgcanvas.ts` adds `class SvgCanvas implements ISvgCanvas` — compiler-enforced contract.
- All 20 `core/*.ts` files change `let svgCanvas: any` → `let svgCanvas: ISvgCanvas | null` and `init(canvas: any)` → `init(canvas: ISvgCanvas)`.
- 4 editor-layer files (`Editor.ts`, `Rulers.ts`, `PaintBox.ts`, `se-paint-picker.ts`) also change their `svgCanvas: any` fields/params to `ISvgCanvas`.

## Files in scope

### New file
- `packages/svgcanvas/core/svgcanvas-types.ts` — `ISvgCanvas` interface (~256 members mirroring the SvgCanvas class public surface)

### Core files (circular dependency — MUST use interface)
1. `blur-event.ts`
2. `clear.ts`
3. `coords.ts`
4. `draw.ts`
5. `elem-get-set.ts`
6. `event.ts`
7. `json.ts`
8. `path-actions.ts`
9. `paste-elem.ts`
10. `path-method.ts`
11. `path.ts`
12. `recalculate.ts`
13. `select.ts`
14. `selected-elem.ts`
15. `selection.ts`
16. `svg-exec.ts`
17. `text-actions.ts`
18. `undo.ts`
19. `utilities.ts` (module-level `svgCanvas` + `convertToPath` param)

### Editor files (no circular dependency, but currently `any`)
20. `src/editor/Editor.ts` — `svgCanvas!: any` field
21. `src/editor/Rulers.ts` — `svgCanvas: any` field
22. `src/editor/components/PaintBox.ts` — `svgCanvas: any` method param
23. `src/editor/components/se-paint-picker.ts` — `svgCanvas: any` method param

### Class declaration
24. `packages/svgcanvas/svgcanvas.ts` — add `implements ISvgCanvas`

### Bonus fix (same PR)
- `select.ts:26` — `#selectorManager: any` → `SelectorManager` (the class is in the same file)

## Interface derivation strategy

The interface members come from three sources in `svgcanvas.ts`, all already typed:

1. **Explicit field declarations** (lines 125–183) — e.g., `started: boolean`, `zoom: number`
2. **`declare` fields** (lines 189–268) — e.g., `declare undoMgr: import('./core/history.js').UndoManager`
3. **Class methods** (the rest of the class body) — e.g., `getZoom(): number`, `setCurCommand(value: BatchCommand | null): void`

The interface mirrors these signatures. Type imports from core modules (`BatchCommand`, `UndoManager`, `SVGElementJSON`, `Drawing`, `SelectorManager`, `Paint`, etc.) are safe because `svgcanvas-types.ts` → `core/*.ts` is not a cycle — the cycle was `svgcanvas.ts` → `core/*.ts` → `svgcanvas.ts`.

## eslint-disable cleanup

Each core file has a file-level `/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */` that exists solely because `svgCanvas` was `any`. Once typed, these directives should be removable. However, some files may have OTHER `any`-typed variables (e.g., extension callbacks, DOM APIs). Per-file assessment during implementation — remove only if the entire file compiles clean without the directive.

## Constraints

- Zero behavior change. No runtime code changes except the `#selectorManager` type narrowing.
- vitest 701/701, e2e 250/250 must pass.
- The interface is an INTERNAL contract — not exported from the package's public API.
- The `initializeSvgCanvasMethods()` wiring pattern stays as-is.

## Verification

- `npm run lint` — 0 errors
- `npx tsc --noEmit` — no new errors in `packages/svgcanvas/`
- `npx vitest run` — 701/701
- `npx tsx scripts/run-e2e.ts` — 250/250
