# Editor god-object decomposition — design spec

**Audit finding:** #108 — `Editor` god object (~40 `!` fields, `as unknown` casts) · `src/editor/Editor.ts`
**Chosen approach:** Event-driven (thorough) decomposition.
**Status:** Design for review. No implementation until approved.
**Date:** 2026-06-25

---

## 1. Goal

`src/editor/Editor.ts` is a 1452-line class that owns DOM references, the canvas engine, i18n, config, transient selection/UI state, document I/O, export, keyboard shortcuts, and the ready-callback lifecycle. The audit flagged it as a god object.

Decompose it into focused collaborators wired by a thin `Editor` orchestrator, and replace panels' direct reads of `editor.selectedElement` / `editor.multiselected` with subscriptions to an event-emitting selection store. Behaviour is preserved throughout; every step ships as an independently-verified PR.

Verified scope (not the audit's "~40"): **19** `!` definite-assignment fields and **3** `as unknown` casts.

## 2. Current state (grounded)

Responsibility clusters in `Editor`:

- **DOM/UI refs:** `$container`, `$svgEditor`, `workarea`, `canvMenu`.
- **Engine:** `svgCanvas`, `rulers`.
- **Panels/menu:** `leftPanel`, `bottomPanel`, `topPanel`, `layersPanel`, `mainMenu` (constructed in the constructor).
- **i18n/config:** `i18next`, `configObj` (already a separate class), `goodLangs`, `langChanged`.
- **Transient selection/UI state:** `selectedElement`, `multiselected`, `modeEvent`, `enableToolCancel`, `uiContext`.
- **Export/window:** `exportWindow`, `exportWindowCt`, `customExportImage`, `customExportPDF`.
- **Document/file:** `title`, `showSaveWarning`, `docprops`, `storage`, `storagePromptState`.
- **Lifecycle:** `extensionsAdded`, `messageQueue`, `isReady`, `callbacks`, `shortcuts` (a 135-line inline array).

**Selection coupling (the event-driven target), verified by grep:**

- `TopPanel` reads `editor.selectedElement` / `editor.multiselected` in ~30 places (via local getters `get selectedElement()` / `get multiselected()` plus direct `this.editor.*` reads) **and writes them** at `TopPanel.ts:851-853` (`this.editor.multiselected = false; this.editor.selectedElement = elems[0]`).
- `BottomPanel` reads them in ~6 places, also via getters (`BottomPanel.ts:30,34`).
- `LeftPanel` / `LayersPanel`: no direct selection reads.
- **Extensions** (`ext-connector`, `ext-markers`, `ext-polystar`, `ext-eyedropper`) read `opts.selectedElement` / `opts.multiselected` from the **extension-callback payload** — a separate mechanism, already decoupled from `editor.selectedElement`. Out of scope; unaffected.
- `Editor.selectedChanged` / `elementChanged` / `elementTransition` (svgCanvas event handlers) are where `selectedElement` / `multiselected` get their values, and where panels are imperatively poked (`topPanel.update…()`, `layersPanel.…`).

**The 3 `as unknown` casts:**

1. `Editor.ts:117` — `this.svgCanvas = null as unknown as ISvgCanvas` (definite-assignment placeholder; real value set async in `editorInit`).
2. `Editor.ts:358` — `(window as unknown as Record<string, unknown>).svgEditor = this` (ambient `Window` lacks `svgEditor`).
3. `Editor.ts:363` — `(this as { _embedServer }) … new EmbedServer(this as unknown as …)` (readonly field assigned in constructor; EmbedServer duck-types the not-yet-assigned `svgCanvas`).

## 3. Target architecture

`Editor` becomes a thin orchestrator that constructs and wires collaborators, owns the ready/callback lifecycle, and exposes a stable public surface (incl. backward-compat selection accessors for extensions/embed API). New collaborators:

- **`EditorSelection`** (new) — the selection source of truth + event emitter. Holds `selectedElement`, `multiselected`, `selectedElements`, current rotation angle. Subscribes to svgCanvas `selected` / `changed` / `transition` and updates its state, then emits a typed `selectionchange` event. Exposes `getSelectedElement()`, `isMultiselected()`, and `subscribe(listener)`. Absorbs the body of `Editor.selectedChanged` / `elementTransition` / the selection parts of `elementChanged`.
- **`UICoordinator`** — canvas lifecycle + layout + zoom + cursor + context panel. Absorbs `updateCanvas`, `updateWireFrame`, `setCursorStyle`, `zoomChanged`, `zoomDone`, `contextChanged`, `modeListener`. Subscribes to `EditorSelection` for selection-driven display (selector resize, context panel). Owns `workarea`, `rulers`, `modeEvent`, `uiContext`.
- **`DocumentIO`** — `loadSvgString`, `loadFromString`, `loadFromURL`, `loadFromDataURI`, `openPrep`. Stateless; depends on `{ svgCanvas, updateCanvas, ready, i18next }`.
- **`ExportManager`** — `exportHandler` + export window state (`exportWindow`, `exportWindowCt`, `customExport*`). Wired to the svgCanvas `exported` event.

**Stays in `Editor` (deliberately not extracted):** the keyboard `shortcuts` array + `setAll` / `getButtonData` (extracting needs 30+ injected handler bindings for little gain — the map rates this LOW viability), and the selection *actions* (`moveSelected`, `rotateSelected`, `copySelected`, `cutSelected`, `pasteInCenter`, `selectNext/Prev`, `cancelTool`) which are thin svgCanvas wrappers invoked by shortcuts; they read selection via `EditorSelection`. `configObj` is already separate — left as is (the thin wrappers `setBackground` / `setLang` / `randomizeIds` / `setCustomPalette` stay on `Editor`).

## 4. The selection event model (the key new mechanism)

```
svgCanvas ── 'selected'/'changed'/'transition' ──▶ EditorSelection
                                                      │  (updates state)
                                                      ▼
                                              emits 'selectionchange'
                                                      │
                  ┌───────────────────────────────────┼───────────────────────────────┐
                  ▼                                     ▼                               ▼
              TopPanel.onSelectionChange         BottomPanel.onSelectionChange    UICoordinator.onSelectionChange
              (updates props UI)                 (updates stroke/fill UI)         (selector resize, context panel)
```

- `EditorSelection` payload: `{ selectedElement: Element | null, multiselected: boolean, selectedElements: Element[] }`.
- Panels register `selection.subscribe(payload => this.onSelectionChange(payload))` in their `init()`, and read selection from the payload (or the store) instead of `this.editor.selectedElement`. The existing panel getters (`get selectedElement()`) are repointed to the store, so the bulk of TopPanel/BottomPanel internals need no change — only their *source* moves.
- `TopPanel`'s write at L851-853 becomes `this.editor.selection.setFromElements(elems)` (routes the mutation through the store, which emits).
- **Backward compatibility:** `Editor` keeps `get selectedElement()` / `get multiselected()` delegating to `EditorSelection`, so extensions/embed/legacy reads keep working unchanged. Extensions already use `opts.selectedElement` (unaffected).

## 5. Migration sequence (each an independently-shippable PR)

Ordered lowest-risk → highest, so value lands early and the riskiest change (panel re-wiring) comes after the store exists and is tested.

1. **PR-1 `DocumentIO`** — extract the stateless load/openPrep methods into a collaborator; `Editor` delegates (keeps public method names). Lowest risk; unit-testable via the `createSvgCanvasFixture` harness.
2. **PR-2 `ExportManager`** — extract export handler + window state; rewire the `exported` event binding in `editorInit`.
3. **PR-3 `EditorSelection` store (behind the existing surface)** — introduce the store; `Editor.selectedChanged`/`elementTransition` and the selection part of `elementChanged` delegate to it; `Editor.selectedElement`/`multiselected` become accessors over the store. **No panel changes yet** — behaviour identical. Unit tests for the store (emits on svgCanvas events; payload correctness).
4. **PR-4 Migrate panels to subscriptions** — repoint `TopPanel`/`BottomPanel` getters to the store and add `subscribe`; convert TopPanel's L851-853 write to `selection.setFromElements`. (Split PR-4a TopPanel / PR-4b BottomPanel if the diff is large.) This is the behaviour-sensitive step → characterization + e2e heavy.
5. **PR-5 `UICoordinator`** — extract canvas lifecycle/layout/zoom/context/cursor; subscribe it to `EditorSelection`; rewire the relevant `editorInit` event bindings.
6. **PR-6 Orchestrator slim + cast cleanup** — reduce `Editor` to construction/wiring/lifecycle; remove the 3 `as unknown` casts where the new seams make them unnecessary (esp. #1: the `svgCanvas` placeholder can move behind a typed lazy accessor); document any that are irreducible (the `window.svgEditor` global cast is likely irreducible without an ambient declaration — add a `declare global` instead).

Each PR: branch off fresh master → characterization/RED-first where behaviour can change → unit suite + `typecheck:editor` + CI e2e → squash-merge → next.

## 6. Testing strategy

- **DocumentIO / ExportManager:** characterization via a wired-canvas fixture (load a known SVG string → assert canvas content; export handler → assert notice/window state). Editor typecheck + e2e.
- **EditorSelection:** focused unit tests — feed it synthetic svgCanvas `selected`/`changed`/`transition` events, assert the emitted payload and state transitions (single select, multiselect, clear, rotation-angle tracking).
- **Panel migration (PR-4):** characterization tests that a `selectionchange` emission drives the expected TopPanel/BottomPanel DOM updates (extends the existing panel/editor test harness); e2e for select→props-panel and select→color-panel flows.
- **UICoordinator:** characterization for `updateCanvas` math where unit-feasible; e2e for zoom/scroll/context-panel.
- Regression guard: the full unit suite (957 today) must stay green at every step; editor typecheck clean; CI e2e (both browsers) green before each squash-merge.

## 7. Risks & mitigations

- **Selection update ordering** (panels updated in a different order than today) → the store emits synchronously in subscription order; preserve the current update order by subscribing collaborators in the same order Editor currently pokes them. Characterization + e2e.
- **Extensions reading `editor.selectedElement`** → kept working via the backward-compat accessor; extensions already use `opts.*` anyway.
- **Hidden write-coupling** (TopPanel mutating selection) → made explicit via `setFromElements`; covered by a characterization test.
- **Large blast radius of PR-4** → split per panel; the store (PR-3) is tested and live before any panel moves, so PR-4 is a pure consumer swap.
- **Irreducible casts** → if a cast can't be removed cleanly, replace with a narrow `declare global` / typed interface rather than leaving `as unknown`; document why.

## 8. Out of scope

- Keyboard shortcut extraction (`shortcuts` array + `setAll`) — stays in `Editor` (LOW viability; 30+ handler bindings).
- Selection *actions* as a separate class — stay as thin svgCanvas wrappers on `Editor`, reading state from `EditorSelection`.
- `configObj` changes beyond what #109 already did.
- Extension `opts`-based selection plumbing — already decoupled.

## 9. Done criteria

- `Editor.ts` reduced to an orchestrator (construction + wiring + lifecycle), with selection/UI/IO/export logic living in their collaborators.
- Panels consume selection via `EditorSelection` subscriptions, not direct `editor.selectedElement` reads.
- The 3 `as unknown` casts removed or replaced with documented, typed alternatives.
- Full unit suite + editor typecheck + e2e green; no behaviour change observable to users or extensions.
