# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (e2e preview server port 8000 → 9000 -- 2026-06-02)

- Moved the Playwright e2e preview server and `baseURL` from port 8000 to 9000
  (`package.json` `start:e2e`; `playwright.config.mjs` `webServer.url` + `use.baseURL`).
- Avoids a collision with other local dev servers on port 8000 (e.g. ws-scrcpy-web):
  Playwright's `reuseExistingServer` would otherwise latch onto a foreign server already
  listening on 8000 instead of starting svgedit, causing every e2e test to time out. The
  dev server (`npm start`) and IIFE preview (`start:iife`) intentionally remain on 8000.
  (TODO #20)

### Fixed (Text tool cursor stuck after editing -- 2026-06-02)

- Leaving text-edit mode (`textActions.toSelectMode`) now notifies the editor of the mode
  change, so the workarea cursor resets from the text I-beam back to the default instead of
  staying stuck as a text cursor after placing or editing a text element.
- Root cause: `toSelectMode` returned to `select` via the internal `setCurrentMode`, which
  (unlike the public `setMode`) never dispatched the `modeChange` event the editor's cursor
  styling listens for. Extracted the dispatch into a reusable `SvgCanvas.notifyModeChange()`
  (now shared with `setMode`) and called it on text exit. Regression test added in
  `tests/unit/text-actions.test.ts`. (TODO #10)

### Changed (Deprecated DOM/JS API cleanup -- 2026-06-02)

- Replaced deprecated `SVGMatrix.scaleNonUniform(x, y)` with `DOMMatrix.scale(x, y)` in
  `selected-elem.ts` (flip transform).
- Replaced all 11 deprecated `String.prototype.substr()` calls with `.slice()` across
  `svg-exec.ts`, `units.ts`, `PaintBox.ts`, `BottomPanel.ts`, and `ext-markers.ts` (per-site,
  accounting for length-vs-end semantics and negative indices).
- Replaced the deprecated `escape`/`unescape` UTF-8 idiom in `utilities.ts`
  (`encodeUTF8`/`decodeUTF8`) with `TextEncoder`/`TextDecoder`, preserving exact byte behaviour
  including BOM handling and throw-on-malformed input; byte-exact characterization tests added.
  Clears the TS6385/6387 deprecation warnings. (TODO #10)

### Changed (Docs — tutorials rewrite -- 2026-06-02)

- Rewrote all 8 `docs/tutorials/*.md` accurate-concise for the current fork: dead
  `{@tutorial}`/`{@link}` JSDoc-link syntax → markdown links; jQuery, old
  filenames, and version cruft removed; `Events` documents the real
  `svgEditorReady` CustomEvent; `ConfigOptions` drops the removed `stylesheets`
  and config-file mechanisms; `ExtensionDocs` uses a current example (`ext-grid`)
  and the per-extension locale mechanism; `LocaleDocs` documents the English-only
  `locale.ts` shim.
- Brought `docs/tutorials/**` under markdownlint (`npm run lint`).
- Sub-project 12.D COMPLETE — TODO #12 (document review) fully closed (12.A–D).

### Changed (JSDoc conversion — editor dialogs + panels + extensions -- 2026-06-02)

- Applied STYLE.md § 4 targeted-JSDoc rule across `src/editor/dialogs/`, `src/editor/panels/`, and
  `src/editor/extensions/`. Stripped type-only `@param`/`@returns`; kept semantic-info lines with
  `{type}` dropped; backfilled summaries; deleted empty JSDoc blocks.
- Comment-only — no code, signature, or import changes. **Sub-project 12.C COMPLETE** — PR-A
  (svgcanvas), PR-B (editor shell/components), and PR-C (dialogs/panels/extensions) all merged.
  12.D (publish-quality tutorials) now unblocked.

### Changed (JSDoc conversion — editor shell + components -- 2026-06-02)

- Applied STYLE.md § 4 targeted-JSDoc rule across `src/editor/` shell files (`Editor.ts`, `ConfigObj`,
  `contextmenu`, `editorInit`, `locale`, `MainMenu`, `Rulers`, `svgEditorInstance`, `common/shortcut`)
  and `src/editor/components/` (including `jgraduate/`).
- Stripped type-only `@param`/`@returns`; kept semantic-info lines with `{type}` dropped; backfilled
  1-line summaries on exported declarations + Lit `@customElement` classes; deleted empty JSDoc blocks.
- Comment-only — no code, signature, or import changes. Sub-project 12.C PR-B of 3.

### Changed (JSDoc conversion — packages/svgcanvas/ -- 2026-06-02)

- Applied STYLE.md § 4 targeted-JSDoc rule across all 37 `.ts` files in `packages/svgcanvas/`.
  Stripped type-only `@param`/`@returns` lines; kept semantic-info lines (allowed values, units,
  ranges, null-handling, side effects) with `{type}` annotations dropped.
- Backfilled 1-line summaries on exported declarations (and public class methods) that lacked them;
  deleted JSDoc blocks left empty after stripping.
- `@throws`/`@deprecated`/`@example`/`@see`/`@module`/`@license`/`@fires`/`@function` preserved
  untouched. Comment-only — no code, signature, or import changes.
- Sub-project 12.C PR-A of 3 (8 chunks). PRs B (editor shell + components) and C (dialogs + panels +
  extensions) follow.

### Changed (Brand hygiene sweep — upstream attribution strip -- 2026-05-28)

- Stripped upstream `@copyright` / `@author` JSDoc lines from 36 TypeScript source files (24 in
  `packages/svgcanvas/`, 12 in `src/editor/`). Fork lineage is in git history; per-file `@license`
  tags kept.
- Surgical edit pattern: only the `@copyright` and `@author` lines were removed. JSDoc blocks that
  became empty after the strip were deleted in full. File descriptions, `@module`, `@example`,
  `@license`, and other tags preserved.
- `Editor.ts` had a multi-line `@copyright` value (five untagged continuation lines listing
  additional authors). Those continuation lines were stripped alongside the tag header — they
  are the tag's value, not separate JSDoc content.

### Changed (Brand hygiene sweep — docs framing -- 2026-05-28)

- `AGENTS.md` (new) at repo root anchors STYLE.md's agent-context references — multi-session
  conventions, no AI attribution, verify against current code.
- `CONTRIBUTING.md` refreshed: drops upstream-PR-routing, drops outdated `feat/ts-migration`
  "active branch" + `standard` linter framing, adopts open-issues / case-by-case-PRs posture.
- `README.md` `docs/tutorials/` row points at TODO #12.D as the home for tutorial rewrites.
- `.markdownlint-cli2.jsonc` globs expanded to `STYLE.md`, `README.md`, `CONTRIBUTING.md`,
  `AGENTS.md`, `CHANGELOG.md`. `docs/tutorials/**` stays ignored pending 12.D rewrites.
- `npm run lint` now chains `markdownlint-cli2` after `eslint`. Standalone `npm run lint:md`
  retained.

### Added (House style guide -- 2026-05-28)

- `STYLE.md` at repo root codifies doc, JSDoc, code-comment, commit-message, and PR-description
  conventions. Calibrated-terse, contributor-doc framing, mixed voice by context.

- `.markdownlint.jsonc` + `.markdownlint-cli2.jsonc` companion configs. New `npm run lint:md` script
  — scoped to `STYLE.md` initially; sub-project 12.B will expand to other docs.

- `CONTRIBUTING.md` links to the new style guide; duplicated commit-message rules removed from
  CONTRIBUTING (now redirects to `STYLE.md § 6`).

### Changed (Brand sweep + dep audit -- 2026-05-28)

- Removed upstream attribution comments (`<!-- Created with SVG-edit -
  https://github.com/SVG-Edit/svgedit-->`) from 10 SVG icons in `src/editor/images/` (anchor_*,
  bold, hello_world, italic, rotate, text_decoration_*).

- Dep audit: `jspdf` already on target 4.2.1; `svg2pdf.js` (2.7.0) and `browser-fs-access` (0.38.0)
  verified on latest; Babel confirmed absent from direct deps (transitive only via node_modules).

### Changed (CI Playwright Docker container -- 2026-05-28)

- e2e jobs (`e2e-chromium`, `e2e-firefox`) now run inside the official Playwright Docker container
  (`mcr.microsoft.com/playwright:v1.57.0-noble`) with browsers pre-installed. Eliminates the
  `playwright install --with-deps` step entirely, which had been hanging on GitHub-hosted runners
  after the browser download reached 100% (caused 60-min timeouts on PR #70 e2e-firefox and PR #68
  e2e-chromium + e2e-firefox).

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` set for all `npm ci` steps to skip the @playwright/test
  postinstall browser download (browsers come from the container image).

### Changed (CI e2e sharding -- 2026-05-27)

- CI workflow split into 3 parallel jobs: `build-and-unit`, `e2e-chromium`, `e2e-firefox` for ~50%
  faster e2e wall time

- Playwright workers explicitly set to 1 in CI for stability (was implicit default)
- All CI jobs now have 60-minute timeout (was unbounded 6-hour GitHub default)
- Build artifact passed between jobs via `upload-artifact`/`download-artifact` (1-day retention)

### Changed (CI — 2026-05-27)

- Bumped Playwright per-test timeout from 60s to 120s in `playwright.config.mjs` — GitHub Actions
  runners intermittently 6x slower than normal, causing 86/250 e2e tests to timeout despite all
  passing locally

### Changed (TODO #18 — fork path-data-polyfill into codebase — 2026-05-26)

- Forked `path-data-polyfill` v1.0.10 (958-line ES5 IIFE) → `packages/svgcanvas/core/path-data.ts`
  (987-line TypeScript module)

- Standalone functions (`getPathData`, `setPathData`, `parsePathData`, `serializePathData`) replace
  prototype monkey-patching

- WeakMap caching replaces Symbol-keyed element caching + setAttribute interception
- Migrated all 65 consumer sites: 22 `getPathData`/`setPathData` → standalone, 43 `pathSegList` →
  `getPathData` + `toPathSeg`

- Deleted `PathDataListShim` class; extracted `toPathSeg()`/`fromPathSeg()` as public utilities
- Deleted `supportsPathData` dual-branch in `coords.ts` — always uses `getPathData` now
- Removed `path-data-polyfill` npm dependency + test vendor copy
- Zero `pathSegList` references remaining in `packages/`

**Test counts (verified 2026-05-26):** vitest 701/701.

### Changed (TODO #19 PR-5 — svgcanvas core type-safety sweep — 2026-05-26)

- Restructured all 16 switch fallthroughs in `path-actions.ts` (7), `path.ts` (6), `event.ts` (3) —
  extracted helpers / inlined shared logic, zero `@ts-expect-error` remaining

- Removed all file-level `eslint-disable` blanket banners from 19 svgcanvas files
- Eliminated all 42 `as any` casts — replaced with `SVGPathElement`, `SVGGraphicsElement`,
  `ISvgCanvas`, `Path`, proper DOM element types

- 16 targeted `eslint-disable-next-line` / per-file directives remain (non-null assertions on DOM
  APIs, ISvgCanvas `any`-typed member flow-through), all with explanatory comments

- Typed path module variable, `pathData` record, re-exports via `typeof`

**Test counts (verified 2026-05-26):** vitest 701/701, lint 0 errors + 0 warnings.

### Changed (TODO #19 PR-4 — extensions type-safety sweep — 2026-05-26)

- Removed all `eslint-disable` banners + all `as any` casts from 12 extension files
- Typed extension init callbacks, event handlers, dataStorage returns, dynamic import modules
- Fixed `RemoveElementCommand` constructor call, `setAttribute` number→string coercion
- Converted ext-markers `async init()` → sync (no await needed)
- Added eslint config override for `no-non-null-assertion` in extensions (heavy `$id()` usage)

**Test counts (verified 2026-05-26):** vitest 701/701, lint 0 errors + 0 warnings.

### Changed (TODO #19 PR-3 — components + dialogs type-safety sweep — 2026-05-26)

- Removed all `eslint-disable` banners + all `as any` casts from 10 component/dialog files + 8 stale
  inline directives from prior PRs

- Typed `Paint` class properly across PaintBox, se-paint-picker, se-gradient-editor
- Typed jPickerShim internals (`ValProxy`, `JPickerOptions` interfaces)
- Typed globalDialogs.ts dialog element access (7 casts eliminated)
- Typed dialog `init()` i18next parameter as `{ t: (key: string) => string }`

**Test counts (verified 2026-05-26):** vitest 701/701, lint 0 errors + 0 warnings.

### Changed (TODO #19 PR-2 — panels type-safety sweep — 2026-05-26)

- Removed all `eslint-disable` banners + all 90 `as any` casts from `TopPanel.ts` (68),
  `BottomPanel.ts` (15), `LayersPanel.ts` (5), `LeftPanel.ts` (2)

- `typedDetail<SeChangeDetail>(evt)` replaces `(evt as any).detail.value` pattern (~50 sites in
  TopPanel alone)

- Added typed element interfaces (`SeButtonElement`, `SeValueElement`, `SePaintPickerElement`,
  `PathActionsLike`) to `typed-events.ts`

- Fixed 22 type errors surfaced by cast removal: null-safety on `selectedElements`, `getAttribute`
  returns, `convertUnit` args; `fill`/`stroke` literal narrowing; boolean-to-string coercion on
  setAttribute

**Test counts (verified 2026-05-26):** vitest 701/701.

### Changed (TODO #19 PR-1 — editor core type-safety sweep — 2026-05-25)

**Infrastructure:**

- New `svgEditorInstance.ts` accessor module (`getSvgEditor()`/`setSvgEditor()`) replaces
  `window.svgEditor` global — 34 consumer files converted to explicit imports

- New `vite-shims.d.ts` with `declare module '*.html'` — eliminates 5 `@ts-expect-error` HTML-import
  directives

- New `typed-events.ts` with per-custom-element event detail interfaces + `typedDetail<T>()` helper
  — eliminates `(evt as any).detail` cast pattern

- Deleted `globals.d.ts` (formerly `elix.d.ts`) — superseded by accessor module

**Editor core sweep (6 files, zero suppressions remaining):**

- Removed all file-level `eslint-disable` banners from `Editor.ts`, `editorInit.ts`, `ConfigObj.ts`,
  `MainMenu.ts`, `Rulers.ts`

- Typed all `any` fields on Editor class: `configObj` → `ConfigObj`, `i18next` → `I18nextFacade`,
  panel fields → actual class types

- Replaced ~20 `as any` casts with real types via ISvgCanvas, typed events, and accessor module
- Extension `init(this: any)` pattern → `init()` + `getSvgEditor()` across all 10 extensions

**Test counts (verified 2026-05-26):** vitest 701/701, e2e 250/250. Fixed 4 pre-existing
group-transforms e2e failures (arrow-key shortcuts never registered in e2e because extension loading
is fire-and-forget; `Ctrl+Shift+G` was never a real ungroup shortcut).

### Changed (Step 14f — editor type-safety sweep + d.ts cleanup — 2026-05-25)

- **`svgCanvas: any` → `ISvgCanvas`** in 4 editor-layer files (`Editor.ts`, `Rulers.ts`,
  `PaintBox.ts`, `se-paint-picker.ts`) — all member access now type-checked

- **`isValidUnit` signature fixed** — `selectedElement` made optional (only used for `attr ===
  'id'`); removed 4 `@ts-expect-error` directives from `imagePropertiesDialog.ts` and `MainMenu.ts`

- **Deleted `svgcanvas.augment.d.ts`** (149 LOC) — all augmented members already covered by
  `declare` fields in class body + `ISvgCanvas` interface (Step 14d)

- **3 real bugs the `any` type was hiding (fixed):**
  - `editorInit.ts` — `setZoom()` called with phantom second arg that implementation ignores
    (removed)

  - `editorInit.ts` — `getDocumentTitle()` returns `string | undefined`; `setAttribute()` received
    undefined (added `?? ''` fallback)

  - `Editor.ts` — `selectorManager.requestSelector()` returns `Selector | null`; `.resize()` called
    without null guard (added `?.`)

- Removed unnecessary `as number` cast on `getZoom()` return in `Rulers.ts`
- Removed unused `@typescript-eslint/no-unsafe-argument` suppress from `se-paint-picker.ts`
- Narrowed `PaintBox.update()` and `PaintBox.getPaint()` param from `any` to `ISvgCanvas`
- Narrowed `SePaintPicker.updatePaint()` `selectedElement` param from `any` to `Element | null`
- Narrowed `setBBoxZoom().bbox` from `unknown` to `{ x, y, width, height }` in
  `Editor.zoomChanged()`

**Test counts (verified 2026-05-25):** vitest 701/701, e2e 250/250 (3 flaky Firefox embed retries).

### Changed (Step 14 — svgcanvas type-safety pass — 2026-05-25)

**Step 14a** (PR #53): `curCommand: any` → `history.BatchCommand | null` on field, getter, setter.

**Step 14b** (PR #54): `addSVGElementsFromJson` converted from arrow to function declaration with
overload signatures; `as Element` and `as any` casts removed; `createSVGElement` param narrowed
`any` → `SVGElementJSON`.

**Step 14c** (PR #56): `SVGPathSegment` cast elimination — `TYPE_TO_CMD` narrowed to
`SVGPathDataCommand`; `_segToEntry` return typed as `SVGPathSegment`; 5 casts + 5 TODO comments
removed from path-method.ts and path-actions.ts.

**Step 14d** (PR #57): ISvgCanvas interface extraction — the major refactor:

- New `packages/svgcanvas/core/svgcanvas-types.ts` with ~200-member ISvgCanvas interface
- `SvgCanvas implements ISvgCanvas` with compiler-enforced contract
- All 20 `core/*.ts` files: `let svgCanvas: any` → `ISvgCanvas`; 3 per-file mini-interfaces deleted
- 89 dynamically-wired methods audited from `(...args: unknown[]) => unknown` → real signatures
- ~260 pre-existing type errors (null-safety, Element/Node mismatches, optional params) fixed
- `filter: any` → `Element | null` (field + getter + setter)
- 22 unnecessary type assertions + 21 unused eslint-disable directives cleaned up
- `SelectModule.#selectorManager: any` → `SelectorManager | null`

**Step 14e** (PR #58): Added `typecheck` script (`tsc --build packages/svgcanvas`) and wired it as
the first step of `npm run build` — type errors now fail the build before vite runs.

### Changed (Step 12b — Editor + EditorStartup class unification — 2026-05-25)

**Commit 1 (`ae711453`): merge EditorStartup into Editor.**

- Collapsed `EditorStartup` base class (784 LOC) into `Editor`, eliminating the two-class
  inheritance

- Removed the `[key: string]: any` index signature — the last type-safety escape hatch in the editor
  layer

- Removed 30 `declare` forward-declarations (now real property declarations on the single class)
- Merged imports, deduplicated SvgCanvas destructuring (`$id`, `$click`, `decode64`, `convertUnit`)
- Inlined `readySignal()` at its single call site (6-line body, module-level function eliminated)
- Inlined `getWidth()`/`getHeight()` as unified `getMaxDimension()` helper

**4 real bugs the index signature was hiding (fixed in same commit):**

- `this.changeZoom(0.1)` → `this.bottomPanel.changeZoom(0.1)` (wrong receiver — method lives on
  BottomPanel)

- `this.localStorage` → `this.storage` (wrong property name — actual property is `storage`)
- `this.setTitles()` → removed (dead code — method never existed; call was silently a no-op)
- `EmbedServer` constructor — added necessary cast now that index signature no longer satisfies type
  constraint

**Commit 2 (`f71292af`): extract init() into standalone function.**

- Created `editorInit.ts` (591 LOC) with `initEditor(editor: Editor)` function
- `Editor.init()` reduced to one-liner: `await initEditor(this)`
- Init-only imports moved to `editorInit.ts`; `Rulers` changed to type-only import in `Editor.ts`
- Type-only import of `Editor` in `editorInit.ts` avoids circular runtime dependency

**Resulting file structure:** `Editor.ts` (1,430 LOC) + `editorInit.ts` (591 LOC).
`EditorStartup.ts` deleted.

**Verification:** tsc 0 / lint 0e+0w / vitest 701/701 / e2e 250/250.

### Fixed (Step 10 + 10b — UI/UX correctness — 2026-05-25)

Four fixes across two PRs:

- `event.ts` — parent walk after click now traverses `<a>` alongside `<g>` (links already
  implemented; stale TODO removed)

- `TopPanel.ts` — added `polyline`/`polygon` to panels lookup (contextual tools now show when
  selected)

- `svgcanvas.ts` — removed dead `canDeleteNodes = true` assignment (getter already returns correct
  value dynamically)

- `svgcanvas.ts` — `setCurrentMode()` now dispatches `modeChange` event (fixes stale cursor after
  text creation — root cause was `setCursorStyle` never firing on internal mode transitions)

**Verification:** tsc 0 / lint 0e+0w / vitest 701/701 / e2e 250/250.

### Fixed (Step 9b — SVG correctness design fixes — 2026-05-25)

Five design-level fixes (companion to Step 9's mechanical fixes):

- `convertGradients` — clone gradient per-element when multiple shapes share a userSpaceOnUse
  gradient (each clone converted relative to its element's bbox)

- `uniquifyElems` — add `<a>` and `<image>` to refElems for internal href update on ID rename
- `setUseData` on undo/redo — remove `tagName === 'use'` guard so nested `<use>` inside groups get
  dataStorage refs re-established

- `pushGroupProperty` — push group `fill`/`stroke` to children on ungroup when child has no explicit
  attribute

- `importSvgString` — clear stale `importIds` cache entry when cached symbol is no longer in the DOM

**Verification:** tsc 0 / lint 0e+0w / vitest 701/701 / e2e 250/250.

### Fixed (Step 9 — SVG import/export + element correctness — 2026-05-25)

Three mechanical fixes:

- `uniquifyElems` symbol-not-removed — query `<use>` by specific symbol href, not all `<use>`
  globally (unused symbols now correctly removed)

- `convertToPath` attribute handling — use element's own fill/stroke/opacity with curShape as
  fallback (converted paths now preserve the original element's appearance)

- `importSvgString` viewBox non-zero origin — apply `translate(-minX,-minY)` for imported SVGs with
  `viewBox="100 100 ..."` (correct positioning)

**Verification:** tsc 0 / lint 0e+0w / vitest 701/701 / e2e 250/250.

### Fixed (Step 8 — geometry/bbox bug bundle — 2026-05-25)

Four correctness fixes in `packages/svgcanvas/core/utilities.ts`:

- `getExtraAttributesForConvertToPath` — added `transform`, `fill-rule`, `clip-rule` to preserved
  attributes (were silently dropped on convert-to-path)

- `getStrokeOffsetForBBox` — `parseFloat()` the stroke-width string instead of implicit coercion
  (removed `@ts-expect-error`)

- `getStrokedBBox` — apply `nodeType === 1` filter symmetrically to both min and max (asymmetric
  filtering caused skewed bounding boxes)

- `getBBoxWithTransform` — added `'circle'` to bbox-optimization element list (rotated circles now
  get path-based bbox like ellipses)

**Deferred:** Rotated-groups bbox cross-browser (Issue #339) — requires algorithmic investigation.

**Verification:** tsc 0 / lint 0e+0w / vitest 701/701 / e2e 250/250.

### Changed (Step 7 — history/undo compression + stack limit — 2026-05-25)

**Typing-undo compression:** Consecutive text-editing keystrokes now collapse into a single undo
entry. Previously every keystroke pushed a separate command with the full `textContent`. A single
undo now reverts to the text before the typing session began.

**Stack size limit:** Undo history is capped at `maxUndoHistory` (default 100, configurable via
`Config.maxUndoHistory`). Oldest entries are trimmed when the cap is exceeded. Prevents unbounded
memory growth in long sessions.

**Verification:** tsc 0 / lint 0e+0w / vitest 701/701 / e2e 250/250.

### Changed (PR-6 — triage sweep + mechanical fixes — 2026-05-25)

Backlog-clearing PR: correctness fixes, dead code removal, i18n completeness, and code-quality
improvements from todo #10 and #2 TS migration follow-ups.

**Correctness fixes (2):**

- `cmenuDialog.ts` — `screen.width/height` replaced with `window.innerWidth/Height` (context menu
  viewport positioning)

- `contextmenu.ts` — `appendChild(string)` replaced with `insertAdjacentHTML` (extension menu items
  were silently failing to render)

**Dead code removal (1):**

- `NS.MATH` namespace definition + sole consumer in `selection.ts` removed (no MathML authoring
  support)

**i18n (1):**

- 12 missing ext-markers tooltip keys added to `lang.en.ts` (`tools.mkr_*` +
  `tools.*_marker_list_opts`)

**Code quality (4):**

- `path.ts` mutable export refactored to `getPath()`/`setPath()` accessors
- `locale.ts` compound conditional split into two clear early returns
- `seAlert`/`seConfirm`/`seSelect` consolidated from 3 files + 5 scattered `declare function` sites
  into `globalDialogs.ts` + one ambient `.d.ts`

- Two pre-existing un-awaited `seConfirm` calls fixed (`Editor.ts` cancelOverlays +
  `EditorStartup.ts` layer-move confirmation)

**Closed as moot/intentional (4):** jQuery.jPicker DOM bugs (file deleted),
`super.attributeChangedCallback()` (correct in Lit), `getVersion()` (doesn't exist),
`document.getElementById` inline scripts (intentional).

**Deferred to PR-12 (2):** EditorStartup `[key: string]: any` (SelectModule refactor),
SVGPathSegment cast sites (type unification design).

**Verification:** tsc 0 / lint 0e+0w / vitest 695/695 / e2e 250/250.

### Changed (#3 PR-5 — jamilih dependency removed — 2026-05-25)

Final sub-PR under todo item #3 (elix → Lit migration). Removes the `jamilih` devDependency (0.63.1)
from package.json. All jamilih usage was already eliminated during earlier PRs (TS migration + Lit
component conversions replaced jamilih's declarative-DOM role with Lit's `html\`\`` template
literals). This was the last third-party dependency from the original elix/jQuery/jamilih stack.

**Verification:** tsc 0 / lint 0e+0w / vitest 695/695.

### Changed (#3 PR-4b — se-gradient-editor + se-paint-picker complete jQuery elimination — 2026-05-25)

Second and final sub-PR under todo item #3 PR-4 (jGraduate + jPicker Lit-rewrite). Replaces the
jQuery-based gradient editor and wires everything into the editor.

**New files (3):**

- **se-gradient-stop.ts** — individual draggable gradient stop marker with Pointer Events, SVG
  teardrop shape, stop-select/move/edit/delete events

- **se-gradient-editor.ts** (931 LOC) — full gradient editor: 3-tab interface (solid/linear/radial),
  live SVG gradient preview (256x256), draggable coordinate markers, stop track with
  add/delete/reorder, inline se-color-picker for stop color editing, parameter sliders
  (radius/ellipticity/angle/opacity), spread method selection, Paint construction on Ok

- **se-paint-picker.ts** — top-level host registered as `<se-colorpicker>` (same tag name, zero
  consumer HTML changes). Wraps se-gradient-editor with trigger/popup pattern. `update()` renamed to
  `updatePaint()` to avoid LitElement lifecycle collision.

**Consumer rewiring (3 files):**

- `BottomPanel.ts` — `jGraduate.Paint` → `SvgCanvas.Paint` (4 sites), `.update()` → `.updatePaint()`
  (2 sites)

- `PaintBox.ts` — `jGraduate.Paint` → `SvgCanvas.Paint`
- `components/index.ts` — import path updated

**Deleted (7 files, ~2,312 LOC removed):**

- jQuery.jGraduate.ts (1,290 LOC), seColorPicker.ts (843 LOC), jPickerShim.ts (transitional from
  PR-4a)

- 4 image assets: rangearrows2.gif, NoColor.png, mappoint_c.png, mappoint_f.png

**Combined PR-4 totals (4a + 4b):** ~4,953 LOC deleted, ~2,100 LOC added. **jQuery fully
eliminated** from the editor component tree. **ESLint: 23 warnings → 0.**

**Verification:** tsc 0 / lint 0e+0w / vitest 695/695.

### Changed (#3 PR-4a — se-color-picker replaces jQuery.jPicker — 2026-05-24)

First of 2 sub-PRs under todo item #3 PR-4 (jGraduate + jPicker Lit-rewrite). Replaces the
jQuery-based Photoshop-style color picker with a Lit component using Canvas 2D rendering.

**New files (4):**

- **ColorModel.ts** — standalone color data model (r/g/b/h/s/v/a) extending EventTarget with
  bidirectional HSV↔RGB sync, typed change events, and pure conversion functions (hsvToRgb,
  rgbToHsv, hexToRgba, rgbaToHex, validateHex). 44 unit tests.

- **se-color-slider.ts** — generic 2D/1D drag surface using Pointer Events + setPointerCapture
  (replaces Slider.ts mouse-event approach). rAF-throttled. Reusable by both color picker and
  gradient editor.

- **se-color-picker.ts** — full 7-mode color picker (H/S/V/R/G/B/A) with Canvas 2D per-pixel
  rendering for the 256×256 map and 20×256 bar. Text inputs with arrow-key increment. Preview
  swatches with CSS checker-pattern alpha. Ok/Cancel/live events. 11 unit tests.

- **jPickerShim.ts** — transitional adapter bridging jGraduate's internal `jPickerMethod` calls to
  the new `se-color-picker` component. Wraps `ColorModel` in a `.val(name)` proxy matching the
  legacy API. Deleted in PR-4b.

**Deleted (14 files, ~2,641 LOC removed):**

- jQuery.jPicker.ts (1,837 LOC), ColorValuePicker.ts, Slider.ts
- 9 image assets: Maps.png (61KB sprite sheet), Bars.png, AlphaBar.png, bar-opacity.png,
  map-opacity.png, preview-opacity.png, mappoint.gif, rangearrows.gif, picker.gif — all replaced by
  Canvas 2D rendering + CSS arrows/checker patterns

**Design decisions:** Canvas 2D chosen over image sprites (professional standard — Adobe/Chrome
DevTools approach; exact HSV math for all 7 modes; eliminates 62KB of precomputed sprites). Pointer
Events chosen over mouse events (uniform mouse/touch/pen; setPointerCapture scopes drag to element;
no window listener leaks). Standalone ColorModel class chosen over Lit-absorbed state (testable,
decoupled, shared between picker and gradient editor).

**Verification:** tsc 0 / lint 0e+1w (pre-existing jGraduate.ts warning) / vitest 695/695 / e2e
deferred to PR-4b (shim preserves full jGraduate compatibility).

### Changed (#3 PR-3c — 5 elix-dialog HTML-bound dialogs Lit-converted + elix dependency removed — 2026-05-24)

Third and final sub-PR under todo item #3 PR-3. **ZERO elix imports remain across `src/`; `elix` npm
dependency removed from `package.json`.**

**Conversions (5 dialogs, native HTML5 `<dialog>` + inline HTML):** exportDialog (159 LOC, pilot),
svgSourceDialog (230 LOC), imagePropertiesDialog (374 LOC), editorPreferencesDialog (406 LOC),
storageDialog (155 LOC). Each inlines its HTML template into Lit's `render()` method, replaces
`<elix-dialog>` with native `<dialog>`, and uses `@property({ reflect: true }) + updated()` for the
dialog open/close lifecycle.

**Deleted (8 files, ~845 LOC):** 5 HTML template files (content inlined), 3 vendored se-elix
overrides (`se-elix/define/NumberSpinBox.ts` + `se-elix/src/base/NumberSpinBox.ts` +
`se-elix/src/plain/PlainNumberSpinBox.ts`).

**Infrastructure:** `scripts/build-extensions.ts` gains the SWC plugin (TC39 decorator support for
extension bundles — storageDialog lives in ext-storage/). Test helper `tests/e2e/helpers.js` updated
for native-dialog visibility timing (waitFor visible + fallback dispatchEvent).

**Verification:** tsc 0 / lint 0e+23w / vitest 640/640 / e2e 250/250.

### Changed (#3 PR-3b — 2 plain-alert/status dialogs Lit-converted + sePromptDialog → seStatusDialog rename — 2026-05-24)

Second of 3 sub-PRs under todo item #3 PR-3 (5-PR elix → Lit migration). Closes audit input #4
(misnamed dialog — `sePromptDialog` was misleading since it's a cancel-only status display, not a
prompt-with-input).

**Conversions (2):**

- **SePlainAlertDialog** (92 → 155 LOC): native HTML5 `<dialog>` element + `<slot>` for textContent
  \+ dynamic choice buttons via `map` directive. Preserved full imperative API surface
  (`.choices`, `.open()`, `.close()`, `.opened`, `.whenClosed()`, `.keyChoice`) for the 3
  `window.seAlert/seConfirm/seSelect` wrapper consumers. Tag renamed `<se-elix-alert-dialog>` →
  `<se-plain-alert-dialog>` (elix prefix misleading post-conversion; class name preserved — 4
  consumers use it as the constructor). `dialog.close(label)` + `dialog.returnValue` leverage
  native dialog API for the choice-passing mechanism.

- **sePromptDialog → seStatusDialog** (103 → 110 LOC): file renamed `sePromptDialog.ts` →
  `seStatusDialog.ts`; class renamed `SePromptDialog` → `SeStatusDialog`; tag renamed
  `<se-prompt-dialog>` → `<se-status-dialog>`. Inlined as standalone native `<dialog>` (drops the
  `new SePlainAlertDialog() as any` composition). Preserved the `close` attribute
  toggle-on-any-value semantics verbatim (latent quirk that ext-opensave relies on; logged to todo
  #10 as investigation follow-up).

**5 callsite updates:** `dialogs/index.ts` (import path), `EditorStartup.ts` (createElement +
setAttribute id), `ext-opensave.ts` (5 `$id()` sites), `Editor.ts` (comment refresh preserving
historical name for traceability), `tests/e2e/dialogs-extra.spec.js` (test description + selectors
for both renames).

**After PR-3b:** `dialogs/` is mostly elix-free. Only the 5 elix-dialog-coupled HTML-bound dialogs
remain for PR-3c + 3 vendored se-elix overrides + `import 'elix/define/Dialog.js'` in
`dialogs/index.ts`. Native HTML5 `<dialog>` pattern established (first use in svgedit; reusable for
all PR-3c dialogs).

**Patterns applied:** native `<dialog>` + `.showModal()` / `.close()` (new for PR-3b), `<button
type="button">` inside dialog context (avoids form-submit default), `void
this.updateComplete.then(...)` for no-floating-promises compliance, class-field-arrow handlers,
`@state()` for internal reactive state, `dialog::backdrop` for modal overlay.

**Lessons:** (1) `dialog.close(returnValue)` + `dialog.returnValue` is the native mechanism for
passing structured close-results — no custom event or property gymnastics needed. (2) Hybrid
LitElement + manual `attributeChangedCallback` override works cleanly when consumers expect exactly
the original attribute-driven behavior (title → open with text, close → toggle); Lit's
`super.attributeChangedCallback()` handles its own property-sync internally.

**Verification:** tsc 0 errors / lint 0 errors + 23 warnings (jgraduate-deferred baseline unchanged)
/ vitest 640/640 / e2e 250/250 chromium + firefox.

### Fixed (todo #10 small-fix bundle — 2026-05-24)

Four surgical fixes from the todo #10 correctness backlog. Pre-existing bugs preserved-verbatim
through previous migrations now repaired:

- **`Editor.ts:519`** — i18n key `'notification..noteTheseIssues'` (double-dot) →
  `'notification.noteTheseIssues'`. Without the fix, the user sees the raw key text in the
  issues-encountered notification path instead of the translated message ("Also note the following
  issues: …").

- **`Editor.ts:1208`** — i18n key `'notification.common.layer'` (wrong namespace path) →
  `'layers.layer'`. The original lookup pointed at a non-existent path; the correct key is at
  `layers.layer` ('Layer'). Affects the new-layer-name default ("Layer 1") when language changes via
  runtime locale switch.

- **`LayersPanel.ts:266`** — duplicate `_eye.style.width = '14px'` (second assignment) →
  `_eye.style.height = '14px'`. Without the fix, the layer-visibility eye icon renders distorted
  (width set twice, height never set, falls back to image's natural height — typically wrong aspect
  ratio).

- **`LayersPanel.ts:294`** — duplicate `'mouseup'` listener on layer-name cells → `'mouseover'`.
  Without the fix, the layer-highlight-on-hover behavior fires on click instead of hover (functional
  bug — hover-highlight was meant to preview which layer a row belongs to before the user clicks).

- **`lang.en.ts:142-143`** — added `tools.align_distrib_horiz: 'Distribute Horizontally'` +
  `tools.align_distrib_verti: 'Distribute Vertically'`. Both keys consumed by TopPanel's
  align-distribute buttons (rendered as tooltips) but never defined in the locale; tooltips were
  showing raw key text.

**Verification:** tsc 0 errors / lint 0 errors + 23 warnings (jgraduate-deferred baseline unchanged)
/ vitest 640/640 / e2e 250/250 chromium + firefox.

**Closes the corresponding todo #10 line items.** Three other items in #10 (3
`super.attributeChangedCallback()` sites, ext-markers `tools.mkr_*` family, etc.) remain deferred —
the 3 dialog-attributeChanged sites fix naturally during PR-3c conversion; ext-markers has 21 keys
to add and is a separate bundle.

### Changed (PR #32 — unify shortcut normalization + sweep document.getElementById → $id — 2026-05-24)

Two cross-cutting refactors addressing long-standing drift surfaced during the PR-3a code review.

**1. Shortcut-key normalization unified.** Extract `normalizeShortcut(e)` + `matchShortcut(e,
shortcut)` to a new `src/editor/common/shortcut.ts`. Canonical format:
`alt+shift+meta+ctrl+UPPERCASE_KEY` (modifier order fixed, key always uppercased via
`toUpperCase()`). Closes the "Shortcut key normalization unified" line item in todo #10 (correctness
backlog).

- Replaces 3 drifted normalization shapes that diverged in original svgedit (preserved verbatim
  through Step 3 TS migration + PR-2 + PR-3a per "preserve verbatim" spec discipline):
  `seButton.ts:123` (meta+ctrl+UPPER), `seMenuItem.ts:80` (meta+ctrl+shift+UPPER),
  `Editor.ts:setAll:454-456` (alt+shift+meta+ctrl+lower).

- Editor.ts `this.shortcuts` array entries updated to canonical UPPERCASE (~30 entries).
- **Latent broken shortcut fixed:** `ctrl+shift+arrowleft/right` reordered to canonical
  `shift+ctrl+ARROWLEFT/RIGHT` — these never fired before because Editor.ts's normalizer used
  `alt+shift+meta+ctrl` order so user keypresses produced `shift+ctrl+arrowleft` ≠ array entry
  `ctrl+shift+arrowleft`. Verified firing in manual smoke (chromium).

- TopPanel.html `Ctrl+Shift+]` / `Ctrl+Shift+[` updated to canonical lowercase modifiers + uppercase
  key.

- `matchShortcut(e, shortcut)` adds `/` alternative parsing (e.g., `DELETE/BACKSPACE`) — the
  seButton handler now supports the same alternative shape that Editor.ts already did.

**2. seButton disconnect-leak fixed.** Same pattern PR-3a applied to seMenuItem — keydown listener
now paired via `connectedCallback` / `disconnectedCallback` class-field arrow per PR-2 pattern #5.
Closes the reviewer-flagged cross-component disconnect-leak from the PR-3a code review.

**3. `document.getElementById` → `$id()` sweep across editor TS sources.** Brings 21 lingering sites
into the established `$id()` convention (335 existing vs 25 lingering → 4 remaining: 3
HTML-inline-script files which can't import the helper + 1 reference in a comment). Files touched:
Rulers.ts, seExplorerButton.ts, contextmenu.ts (preserves the `appendChild(string)` bug at lines
76/81 per todo #10), cmenuDialog.ts, cmenuLayersDialog.ts, exportDialog.ts, ext-connector.ts,
ext-polystar.ts, ext-shapes.ts, ext-storage.ts, TopPanel.ts, Editor.ts.

### Fixed (PR #32 follow-up — seMenu aria-label i18n restore — 2026-05-24)

`seMenu.ts` `aria-label` restored to `${t('tools.main_menu')}` after an earlier incorrect revert.
Initial PR-3a polish correctly wrapped the literal `"Main Menu"` in `t('tools.main_menu')`; a
subsequent revert dropped the wrap based on a too-literal grep for `'tools.main_menu'` that missed
the nested structure (`tools: { main_menu: 'Main Menu' }`) at `lang.en.ts:122-123`. Key exists;
restored. Lesson: when grepping i18n keys, use the rightmost-portion-only pattern (e.g.,
`main_menu`) rather than the dotted form.

### Verification (PR #32 + follow-up)

tsc 0 errors / lint 0 errors + 23 warnings (jgraduate-deferred baseline unchanged) / vitest 640/640
/ e2e 250/250 passing both browsers (chromium + firefox). Manual cross-browser smoke (chromium via
Playwright MCP) verified: top-menu open/close + Escape (with focus return) + click-outside; tool
shortcuts (Q/L/T/R/P + ctrl+Z + shift+ctrl+] + shift+D); spin inputs (stroke_width 5→12 + opacity
100→50); zoom dropdown + toolbar dropdowns rendered.

### Audit findings logged for future work (PR #32 session)

Recorded in todo #10 / #13 follow-ups:

- `ext-layer_view.ts:81` shortcut bug — `shortcut="${name}:buttons.0.key"` uses the literal i18n key
  as the shortcut value rather than `t(...)`-resolving it. Pre-existing — fix needs design (the
  locale value `'Ctrl+Shift+L'` is display-ergonomic; canonical-format `'shift+ctrl+L'` would
  degrade the button-title display).

- `TopPanel.html` + `LeftPanel.html` display-only shortcut labels (`Delete/Backspace`, `Z / Alt +
  wheels`) — keep display-only by design; actual key handling is via Editor.ts shortcut array.
  Consider HTML comment OR drop the `shortcut` attribute entirely.

- 3 HTML inline-script files (`iife-index.html`, `index.html`, `xdomain-index.html`) still use
  `document.getElementById('container')` — intentional bootstrap pattern; inline scripts can't
  import module helpers.

### Changed (#3 PR-3a — 4 elix-bound user-facing components Lit-converted + 2 dead files deleted — 2026-05-24)

First of 3 sub-PRs under todo item #3 PR-3 of the 5-PR elix → Lit migration. Converts 4
elix-internals-bound user-facing components in `src/editor/components/` to Lit; deletes 2
internal-only files made orphan by the conversion. After this PR: `components/` is mostly elix-free
(`PaintBox.ts` + `seColorPicker.ts` remain — jGraduate-bound, PR-4 scope).

**Sub-PR scope decisions locked at planning time**
(docs/superpowers/plans/2026-05-24-svgedit-elix-to-lit-pr-3a-plan.md § "Decisions locked"):

- Sub-PR split: 3 sub-PRs (PR-3a / PR-3b / PR-3c) by strategic axis (vs 1 big PR or 2)
- `<elix-dialog>` replacement (PR-3c scope, not this PR): native HTML5 `<dialog>` element
- `sePromptDialog` rename target (PR-3b scope, not this PR): `seStatusDialog`
- `storageDialog` inclusion: yes, added to PR-3c

**Conversions (4):**

- **`seSpinInput` (PILOT)** — 244 → 143 LOC. Native `<input type="number">` + `<button>` arrows. All
  8 attributes preserved (`value`, `label`, `src`, `size`, `min`, `max`, `step`, `title`). 3
  shadowDOM-piercing sites at original lines 106 / 108 / 217-229 resolved naturally.
  `svgEditor.$click` swapped to declarative `@click=` per PR-2 touchend-double-fire cascade.
  Pre-existing test selectors at `tests/e2e/issues.spec.js:29,48,75` +
  `tests/e2e/group-transforms.spec.js:69,132` that pierced `elix-number-spin-box` updated to target
  `input` (consumer-audit refinement of [[feedback_consumer_audit_grep_test_files]] — the original
  audit grepped `<se-spin-input>` but missed elix-internal selectors in test files).

<!-- markdownlint-disable MD013 MD038 -->
- **`seMenu`** — 125 → 167 LOC (over plan's 50-70 target due to popup-lifecycle infrastructure: open/close + document-level click + Escape listeners with full `disconnectedCallback` cleanup per PR-2 pattern #5; popup conditionally rendered via `${this._open ? html\`...\` : nothing}` after a firefox-only e2e regression surfaced during main-session gate verification — the always-mounted `position: absolute` popup with `display: none` caused intermittent layout-coordinate drift in firefox under sustained parallel-test load). Native `<button type="button">` for the menu trigger (replacing the original `<div role="button">` which was keyboard-inaccessible regression vs elix-menu-button — fixed in same PR). `aria-haspopup` + `aria-expanded` + `aria-label` + `:focus-visible` outline. Double shadowDOM-piercing at original line 54 (`(this.$menu).shadowRoot.querySelector('#popupToggle').shadowRoot`) eliminated naturally. `imgPath` read at render-time (matches seButton / seSpinInput pattern).
<!-- markdownlint-enable MD013 MD038 -->

- **`seMenuItem`** — 132 → 88 LOC. Native `<button role="menuitem">`. Single `_onDocumentKeydown`
  class-field arrow handler (per convention bullet 8 — original used `_keydownHandler` field
  assigned imperatively inside `_attachKeydown`, refactored in same PR to align with sibling
  reference shapes). Reads `shortcut` attribute at fire time. Shortcut normalization preserved
  verbatim (shared `normalizeShortcut(e)` helper deferred to todo #10 — cross-file refactor scope).
  The shadowDOM-piercing site at original lines 31-32 (elix `#checkmark` hide) resolves naturally
  (no checkmark rendered).

- **`seDropdown`** — 186 → 164 LOC. **Class rename `Dropdown` → `SeDropdown`** per PR-2 cascade
  (consistent with `ToolButton → SeButton`, `SEPalette → SePalette`, `FlyingButton →
  SeFlyingButton`, `ExplorerButton → SeExplorerButton`, `SeCMenuLayerDialog → SeCMenuLayersDialog`,
  `SeCMenuDialog → SeCMenuCanvasDialog`). Native `<button>` toggle + popup `<div>` with `<slot>` for
  slotted options. Dispatches `new CustomEvent('change', { detail: { value }, bubbles: true,
  composed: true })` preserving the `{detail:{value}}` shape on option click via `composedPath()`
  walk. **Component has ZERO external consumers** (verified via repo-wide grep: no HTML markup, no
  dynamic creation, no class imports). Registration preserved per task brief. Decorative `<input
  readonly>` + the original `stepZoom` TODO comment block (referring to a typed-input code path that
  never existed) DROPPED to match the doc-comment's own simplification claim. `role="listbox"`
  dropped (was misleading — slotted children have no `role="option"`); `aria-haspopup="listbox"` +
  `aria-expanded` added to the toggle for honest open/closed signal.

**Deletes (2 dead-on-arrival):**

- **`src/editor/components/sePlainMenuButton.ts`** (23 LOC) — sole registration of
  `<elix-menu-button>` (`customElements.define('elix-menu-button', ElixMenuButton)` line 23). Only
  consumer was `seMenu`'s template. Made dead by seMenu Lit conversion (which owns its popup button
  face directly).

- **`src/editor/components/sePlainBorderButton.ts`** (34 LOC) — default-exported
  `SePlainBorderButton` class composed via `sourcePartType: sePlainBorderButton` inside
  `sePlainMenuButton` (only consumer). Transitively dead after sePlainMenuButton deletion.

**Cumulative LOC delta** vs master (`12f6a70e`): **−238 LOC** across 6 files (+496 / -677 / -57
deleted).

**PR-2 patterns applied:**

1. **Full `disconnectedCallback` lifecycle** for external-DOM-listener cleanup — seMenu
document-level click + Escape listeners; seMenuItem keyboard-shortcut listener (original was leaky);
seDropdown document-level click + Escape listeners. Always paired via `attach()` / `detach()`
helpers OR class-field-arrow handlers + add/removeEventListener.
2. **`classMap` directive** for class-toggle patterns (seMenu's `open` state until refactored to
conditional rendering for the firefox-fix; seDropdown's popup-toggle state).
3. **`ifDefined` directive** for optional empty-string-default attributes (seSpinInput's
`size`/`min`/`max`/`step`; seMenuItem's `src`).
4. **Touchend double-fire bug fix at all `svgEditor.$click` sites** — swapped to declarative
`@click=` in templates. The `$click` helper at `packages/svgcanvas/core/utilities.ts:1273` registers
both `click` AND `touchend`; modern browsers synthesize `click` from touch taps natively, causing
handlers to fire twice per tap. Native `@click=` fires once.

**Not in scope (deferred per plan's locked decisions):**

- 3 vendored se-elix overrides under `src/editor/dialogs/se-elix/` (register
  `<elix-number-spin-box>`; `exportDialog.html:51` still uses this tag — deferred to PR-3c).

- `PaintBox.ts` + `seColorPicker.ts` (jGraduate-bound, PR-4 scope).
- Plain alert/status dialogs (`SePlainAlertDialog`, `sePromptDialog` → `seStatusDialog` rename + 5
  callsite updates) — PR-3b scope.

- Elix-dialog HTML-bound dialogs (`svgSourceDialog`, `imagePropertiesDialog`,
  `editorPreferencesDialog`, `exportDialog`, `storageDialog`) — PR-3c scope.

- Shared `normalizeShortcut(e)` helper extraction across `seButton.ts:234` / `seMenuItem.ts` /
  `Editor.ts:setAll:410-412` — cross-file refactor logged to todo #10.

**Verification:**

- `npx tsc --build --force`: 0 errors
- `npm run lint`: 0 errors, 23 warnings (jgraduate-deferred baseline from PR #23 Tier B unchanged)
- `npx vitest run`: 640 / 640 passing (49 test files)
- `npx tsx scripts/run-e2e.ts`: 250 / 250 passing both browsers (chromium + firefox)
- `npm run build`: clean (11 extensions bundled)

**Lessons captured (worth pasting into PR-3b / PR-3c dispatch packets):**

1. **Consumer audits for elix-bound component rewrites MUST grep for elix-internal tags in test
files**, not just `<se-*>` tags. Tests pierce shadow DOM via the elix-internal element selectors
(`elix-number-spin-box`, `elix-menu-button`, etc.) — those selectors break when the component owns
its own markup directly. Refines [[feedback_consumer_audit_grep_test_files]] for PR-3 scope.
2. **Parallel-batch dispatch has port-8000 contention.** Vite preview uses port 8000 with
`reuseExistingServer: true` + `--strictPort`; the first agent captures the port and siblings risk
running tests against the WRONG `dist/`. Mitigation: agents detecting contention should run their
own preview on a different port (e.g., 8431) with a custom playwright config. Affects PR-3b / PR-3c
if any parallel batch is dispatched.
3. **Firefox-only layout regression under parallel-test load.** The seMenu's always-mounted
`position: absolute` popup (with `display: none` toggle) caused intermittent right-click coordinate
drift in firefox e2e tests — paste position offset by exactly one SVG viewport. Could not be
deterministically reproduced in isolation but was reliably reproducible under the full parallel-test
suite. Defensive fix: conditional rendering of the popup (`${this._open ? html\`...\` : nothing}`)
eliminated the issue. Worth a CSS-discipline note for future popup-style components: prefer
conditional rendering over always-mounted-with-display-none for absolute-positioned overlays.
4. **`<div role="button">` is keyboard-inaccessible** — Tab navigation can't reach it; Enter / Space
don't activate it without explicit `@keydown` handling. Always use `<button type="button">` for
click triggers. Pre-existing in original seMenu (which wrapped elix-menu-button which DID wrap a
real `<button>` internally); regression on first Lit conversion; fixed in same PR.

### Fixed (#18 — pre-existing semantic issues surfaced by #17 audit — 2026-05-22)

Cleanup of the 6 items the PR #24 audit revealed as pre-existing semantic issues hidden by `any`
typing. **One runtime bug** + **5 type-precision improvements**.

- **`src/editor/extensions/ext-connector/ext-connector.ts:118` — runtime bug FIXED.** `getOffset`
  was computing connector-marker offsets via `line.getAttribute('stroke-width') * 5` — arithmetic on
  the raw string value of `stroke-width`. Browsers commonly return `"2px"` etc., producing `NaN`-ish
  marker offsets. Replaced with `parseFloat(line.getAttribute('stroke-width') ?? '0') * 5`, which
  correctly parses numeric prefixes from both `"2"` and `"2px"`. Also tightened `line: any` → `line:
  Element`.

- **`src/editor/ConfigObj.ts` `pref()` return type — INVESTIGATED, NO CHANGE.** The current
  `unknown` annotation is correct: `Prefs` has an index signature `[key: string]: unknown`, so
  `pref()`'s getter path returns `unknown`. The JSDoc claim of `string | void` (which PR #24 tried
  to apply) was incomplete. Marked closed by analysis.

- **`src/editor/extensions/ext-connector/ext-connector.ts:156` — `setPoint elem: any` → `elem:
  SVGPolylineElement`.** The function calls `elem.points`, `pts.replaceItem`, `pts.numberOfItems`,
  `pts.getItem` — all SVGPolylineElement-specific. Verified callsites pass connector polylines.

- **`src/editor/extensions/ext-opensave/ext-opensave.ts:45` — `importImage e: any` → `e: Event` with
  narrowing.** Multi-source handler (file-input `change` + drop-zone `drop`). Used targeted casts:
  `e.target as HTMLInputElement | null` for the input-element path; `e as DragEvent` for
  `dataTransfer` access.

- **`src/editor/panels/LeftPanel.ts:33` — `updateLeftPanel button: any` → `button: string`.** All 19
  callsites pass string ids (`'tool_select'`, `'tool_fhpath'`, etc.). The prior `if
  (button.disabled) return false` was dead — `.disabled` on a string is always `undefined`. Fixed by
  looking up the actual DOM button: `const btnEl = $id(button) as HTMLButtonElement | null; if
  (btnEl?.disabled) return false`. Preserves the intent (skip when the toolbar button is disabled).

- **`src/editor/panels/TopPanel.ts:65` — `setStrokeOpt opt: any` → `opt: HTMLElement` with null
  guard.** Prior code did `opt.parentNode.children` unguarded; `parentNode` is `Node | null` and
  `Node` lacks `.children` (it's on `ParentNode`). Switched to `opt.parentElement` (returns
  `HTMLElement | null`, has `.children`) with explicit `if (!parent) return` guard. Two callsites at
  TopPanel.ts:135 + :141 updated to capture `$id()` result in a local before the null-check (TS
  doesn't narrow across two separate invocations).

- **Net diff:** 4 files changed, +29 / -16 lines (net +13 lines).
- **Verification:** `npx tsc --build --force` 0 errors; `npm run lint` 0 errors / 23 warnings
  (jgraduate-deferred unchanged); `npx vitest run` 640/640 unchanged; `npx tsx scripts/run-e2e.ts`
  250/250 chromium + firefox unchanged; `npm run build` success (11 extensions bundled).

### Changed (#17 Tier B follow-up — signature tightening from sample audit — 2026-05-22)

Follow-up to the Tier B sweep. A 200-sample audit of the 1,513 stripped JSDoc `{Type}` tokens
flagged 5 cases (~2.5% rate; ~38 extrapolated across the project) where the TS signature was
`any`/`unknown` and the JSDoc had concrete type info — meaning the strip lost the only type
information for those params/returns. This PR tightens 15 of those signatures using the
JSDoc-suggested type as the new TS annotation, restoring (and now compiler-enforcing) the lost type
info.

- **DOM Event handlers (4)** — JSDoc said `{Event}` but code accesses `e.detail` (a `CustomEvent`
  property), so the correct TS type is `CustomEvent`: `Editor.ts` `saveSourceEditor` +
  `cancelOverlays`; `MainMenu.ts` `saveDocProperties` + `savePreferences`.

- **Element params (4)** in `src/editor/extensions/ext-markers/ext-markers.ts`: `getLinked`,
  `convertline`, `colorChanged`, `updateReferences` — `elem` / `el` now typed `Element`.

- **Other primitive types (7)** in `src/editor/panels/TopPanel.ts`: `setStrokeOpt` `changeElem?:
  boolean`; `updateValue` `id: string` + `newValue: number`; `showSourceEditor` `forSaving?:
  boolean`; `clickAlign` `pos: string`; `setImageURL` `url: string`. Plus
  `src/editor/extensions/ext-polystar/ext-polystar.ts` `setAttr` `val: string | number`.

- **6 proposals REVERTED** when tightening surfaced pre-existing semantic issues — the JSDoc was
  either misleading or the code is genuinely loose. These remain `any`/`unknown` and are logged for
  separate follow-up:

  - `ConfigObj.ts` `pref()` return — stays `unknown` (implementation returns more than `string |
    void`).

  - `ext-connector.ts` `setPoint` `elem` — stays `any` (code accesses `.points` which lives on
    `SVGPolylineElement`, not `Element`).

  - `ext-connector.ts` `getOffset` `line` — stays `any` (code does
    `line.getAttribute('stroke-width') * 5` — pre-existing arithmetic-on-string; fixing requires a
    separate bug-fix scope).

  - `ext-opensave.ts` `importImage` `e` — stays `any` (multi-event handler receives `Event` +
    `DragEvent`).

  - `LeftPanel.ts` `updateLeftPanel` `button` — stays `any` (code does `.disabled` which isn't on
    plain `Element`).

  - `TopPanel.ts` `setStrokeOpt` `opt` — stays `any` (code does `.parentNode` without null guard).
- **Net diff:** 5 files changed, +14 / -14 lines.
- **Verification:** tsc --build --force 0 errors; lint 0 errors / 23 warnings (jgraduate-deferred
  unchanged); vitest 640/640 unchanged; e2e 250/250 chromium + firefox unchanged; build success (11
  extensions).

### Changed (#17 Tier B — JSDoc-as-types strip — 2026-05-22)

Stripped 1,513 `@param {Type}` / `@returns {Type}` / `@type {Type}` JSDoc type annotations from
non-jgraduate `.ts` files; deleted 9 `@typedef` blocks that were documentation-only (not referenced
as TS types). The TypeScript signature annotations on each function/variable are now the single
source of truth; JSDoc retains the param-name + description form for documentation richness.

- **TS80004 sweep (1,513 patterns).** `@param {Type} name - description` → `@param name -
  description` (831 lines preserved with description); `@type {Type}` lines and orphan `@param
  {Type}` (no name) lines dropped entirely (682 lines removed). Mechanical script
  (`%TEMP%/svgedit-strip-jsdoc-types.js`) does brace-balanced scan to handle nested types like
  `{Array<{x:number,y:number}>}` correctly.

- **TS80009 sweep (9 typedef blocks deleted).** All 9 were JSDoc-only doc constructs not referenced
  as TS types:

  - `src/editor/Editor.ts` — `module:SVGthis.BBoxObjectWithFactor`
  - `src/editor/EditorStartup.ts` — `module:SVGthis.ExtensionObject` (x2; both occurrences in
    standard + user extension loaders)

  - `packages/svgcanvas/core/path.ts` — `module:path.uiStrings`, `module:path.SVGElementJSON`,
    `Point` (redundant with the adjacent `interface XYPoint`)

  - `packages/svgcanvas/core/utilities.ts` — `module:utilities.BBoxObject`,
    `module:utilities.PathSegmentArray` (redundant with the adjacent `type PathSegment`), `BBox`

  - Deleting them removes IDE TS80009 noise without affecting any TS code path. If consumers need
    richer typing, the TS type system is the place for that.

- **Net diff:** 72 files changed, +831 / -1585 lines (net **-754 lines**). Pure documentation
  cleanup; no runtime behavior change.

- **Verification:** `npx tsc --build --force` 0 errors; `npm run lint` 0 errors / 23 warnings (still
  all jgraduate-deferred); `npx vitest run` 640/640 unchanged; `npx tsx scripts/run-e2e.ts` 250/250
  chromium + firefox unchanged; `npm run build` success (11 extensions bundled).

- **Out of scope:** TS6385/TS6387 deprecation hints noticed during this sweep
  (`EditorStartup.ts:666` `event.returnValue` deprecated; `utilities.ts:113,116` global
  `escape`/`unescape` deprecated). These are TypeScript-deprecation warnings, not JSDoc-style —
  separate follow-up if desired.

### Changed (#17 Tier A — ESLint warning sweep — 2026-05-22)

Cleared 117 of 140 ESLint warnings on master (the 23 remaining are all in
`src/editor/components/jgraduate/`, deferred to #3 PR-4's full jGraduate + jPicker Lit-rewrite).
Tier A of the rescoped item #17 (originally drafted as "JSDoc → TS types doc-pass" but the actual
lint composition turned out to be code-quality directives, NOT JSDoc-as-types — the
TS80004/TS80009/TS8024 hints I'd seen are IDE-only and don't appear in `npm run lint`; those are
Tier B's scope).

- **105 unused `eslint-disable` directives deleted or trimmed.** Stale `// eslint-disable-next-line
  @typescript-eslint/no-unsafe-*` / `no-explicit-any` line-level comments and file-level `/*
  eslint-disable */` block directives whose underlying rules no longer trigger (most accumulated
  during the JS → TS migration as strict-mode type narrowing changed what flagged). For file-level
  blocks with mixed used+unused rules, the directive is trimmed to keep only the still-used rules;
  for line-level directives covered by a file-level block, the line is deleted entirely.

- **34 `@typescript-eslint/no-unused-vars` fixes.** 31 of the 34 were `catch (e)` in test files
  where `e` is unused — replaced with bindingless `catch { ... }` (ES2019+ syntax, supported by the
  project's ES2025 target). The other 3 were unused callback parameters in `coords.test.js` (`(elem,
  key)` → `(_elem, _key)` matching the `/^_/u` exemption).

- **1 `@typescript-eslint/no-unused-expressions` fix** at `tests/unit/elem-get-set.test.js:174` —
  `this.onerror && this.onerror(new Error('load failed'))` short-circuit → optional-call
  `this.onerror?.(new Error('load failed'))`.

- 28 files changed, +53 / -97 lines net.
- Verification: `npx tsc --build --force` 0 errors; `npm run lint` 0 errors / **23 warnings** (all
  `src/editor/components/jgraduate/` — deferred); `npx vitest run` 640/640 unchanged; `npx tsx
  scripts/run-e2e.ts` 250/250 unchanged across chromium + firefox; `npm run build` success.

### Added (#3 elix → Lit migration — PR-2: 10 pure custom elements/dialogs Lit-converted — 2026-05-23)

PR-2 of the 5-PR elix → Lit migration (spec at
`docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md`). Converted 10 pure
(non-elix-coupled) custom elements/dialogs from hand-rolled `HTMLElement` + `observedAttributes`
boilerplate to LitElement with `@customElement` + `@property() accessor` decorators, per the
conventions locked in `docs/superpowers/conventions/lit-component-conventions.md`. Implementation
via `superpowers:subagent-driven-development` — pilot (seListItem) → 3 fan-out batches (5 + 3 + 1
conversions) with per-task spec + code-quality reviewer subagents and sequential merge with full
gate re-verification after each. External API surface preserved verbatim per spec § Risks #2; CSS
custom-property names preserved (`--*-color` series unchanged); audit-flagged bugs preserved as-is
per spec § Risks #2 (todo #10 covers their later fix).

**Components converted (7):**

- `src/editor/components/seListItem.ts` — 158 → 72 LOC (PILOT)
- `src/editor/components/seSelect.ts` — 197 → 84 LOC
- `src/editor/components/seList.ts` — 263 → 205 LOC
- `src/editor/components/seButton.ts` — 237 → 131 LOC (also class rename `ToolButton` → `SeButton`)
- `src/editor/components/sePalette.ts` — 248 → 188 LOC (also class rename `SEPalette` → `SePalette`)
- `src/editor/components/seFlyingButton.ts` — 316 → 220 LOC (also class rename `FlyingButton` →
  `SeFlyingButton`); **also fixes latent touchend double-fire bug** by dropping `svgEditor.$click`
  (which registered both `click` AND `touchend`; modern browsers synthesize `click` from touch taps
  natively, so `touchend` caused handlers to fire twice per tap). Touchend-drop applied to all
  subsequent `$click` sites in this PR.

- `src/editor/components/seExplorerButton.ts` — 347 → 273 LOC (also class rename `ExplorerButton` →
  `SeExplorerButton`); uses `unsafeHTML` for innerHTML-style shape-library button generation
  (JSON-fed, internal config data); adds `disconnectedCallback` for workarea-listener cleanup
  (original constructor-registered listener leaked on unmount)

- `src/editor/components/seZoom.ts` — 411 → 353 LOC; preserves audit-flagged inverted-guard
  `attributeChangedCallback` via explicit override + `super.attributeChangedCallback()` call;
  press-and-hold setTimeout chain preserved verbatim (500ms initial / 50ms repeat); document-level
  click listener moved from leaky constructor to `connectedCallback` / `disconnectedCallback` pair

**Dialogs converted (3):**

- `src/editor/dialogs/cmenuLayersDialog.ts` — 169 TS + 71 HTML → 190 TS, **HTML file deleted** (net
  −54 LOC across both files); also class rename `SeCMenuLayerDialog` → `SeCMenuLayersDialog` (with
  missing `s`); HTML import via `vite-plugin-string` replaced by inline `static styles` + `render()`
  template; full `disconnectedCallback` lifecycle for workarea + `#sidepanels` listeners;
  detach-before-resolve in `updated()` for dynamic `value`-change re-binding

- `src/editor/dialogs/cmenuDialog.ts` — 266 TS + 118 HTML → 244 TS, **HTML file deleted** (net −140
  LOC across both files); also class rename `SeCMenuDialog` → `SeCMenuCanvasDialog` (matches
  `<se-cmenu_canvas-dialog>` tag's `_canvas` segment); 11 `$click` sites → declarative `@click=`
  bindings funneled through shared `_dispatchMenuChange` helper; `classMap` for `li.disabled`
  toggling (replacing imperative `classList.add/remove` from `attributeChangedCallback`)

**Patterns established (referenced inline in conventions doc):**

- **`boolAttr` module-local converter constant** — for Lit boolean properties needing `reflect:
  true` with `'true'` string reflection (matches consumer tests using `toHaveAttribute('attr',
  /./)`). Default `{ type: Boolean }` reflects `true` as `''` which fails the regex.

- **`classMap` directive** over JS template interpolation for `class="base ${conditional}"` patterns
  (more efficient than full re-render).

- **`styleMap` directive** for replacing imperative `style.display = '...'` / `style.top = '...'` /
  `style.left = '...'` mutations (drives from reactive `@state()` accessors).

- **`unsafeHTML` directive** for dynamically-constructed innerHTML scenarios where the data is from
  internal config files (NOT user-controlled). Avoid for any user-controlled data.

- **Full `disconnectedCallback` lifecycle** for components that look up external DOM nodes
  (`document.getElementById(...)`) and attach listeners — factor `_attachXxxListeners()` /
  `_detachXxxListeners()` helpers + call detach from both `updated()` (when target changes) AND
  `disconnectedCallback()`.

- **Touchend double-fire bug fix** — every `svgEditor.$click(...)` call site eliminated. Declarative
  `@click=` for in-template clicks; `this.addEventListener('click', ...)` in `connectedCallback()`
  for bubbled slot clicks.

- **`Se`-prefix class name convention** — pre-existing names like `ToolButton` / `SEPalette` /
  `FlyingButton` / `ExplorerButton` / `SeCMenuLayerDialog` (missing `s`) standardized during
  conversion.

**Spec amendments (sePromptDialog + 3 elix-dialogs deferred to PR-3, total 4 deferrals from original
PR-2 list of 14):**

- `sePromptDialog.ts` — deferred at plan-write time. Found to live at
  `src/editor/dialogs/sePromptDialog.ts` (not `components/` as spec table said) AND internally
  instantiates `new SePlainAlertDialog()` (an elix-bound class queued for PR-3). Audit input #4 (the
  misnamed-dialog rename) shifts to PR-3.

- `svgSourceDialog.ts`, `imagePropertiesDialog.ts`, `editorPreferencesDialog.ts` — deferred at Batch
  4 dispatch time. Each uses `<elix-dialog>` in its HTML template (registered via `import
  'elix/define/Dialog.js'` in `src/editor/dialogs/index.ts`) and calls the elix `.open()` /
  `.close()` API on `$dialog`. The original `AUDIT_2026-05-16.md` enumeration missed the HTML-side
  elix dependency. Per spec discipline ("PR-2 = pure custom elements without elix dependency"),
  these 3 move to PR-3 alongside `SePlainAlertDialog`. Will be revisited as part of the PR-3 spec
  scope, where the conversion approach (native `<dialog>` swap vs. Lit `<se-dialog>` primitive vs.
  preserve-as-elix during this PR) can be decided in the context of the rest of the elix-bound work.

**Cumulative net LOC reduction across the 10 conversions:** −705 LOC across 10 source files + 2
deleted HTML files (cmenuLayersDialog.html + cmenuDialog.html). Average ~30-50% LOC reduction per
file.

**Verification:** `npx tsc --build --force` 0 errors; `npm run lint` 0 errors / 23 warnings
(jgraduate-deferred baseline — PR-4 clears); `npx vitest run` 640/640; `npx tsx scripts/run-e2e.ts`
250/250 chromium + firefox.

### Added (#3 elix → Lit migration — PR-1: Lit infrastructure + 2 reference components — 2026-05-21)

PR-1 of the 5-PR elix → Lit migration (spec at
`docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md`). Lit-conventions lock gate — once
this lands, PR-2's agent-team dispatch has a concrete pattern to point at. Substrate-compat verified
(Vite HMR + ESLint v9 / TC39 decorators).

- Added `lit@^3` to `dependencies`.
- Converted `src/editor/components/seText.ts` → LitElement (simple reference component; 132 LOC →
  ~30 LOC). External API preserved per consumer audit: `<se-text text="..." title="..."
  value="...">`. Host's `id` mirrored onto inner shadow `<div>` via `ifDefined(this.id ||
  undefined)` — preserves both the `#layersLabel` CSS rule for LayersPanel.html:5 AND the
  `div#sidepanel_handle` selector in layers-panel.spec.js:20,46 (caught at gate-verification;
  original audit grepped CSS + HTML but not test files — see commit `c3a7cc67` for the diagnostic).
  `<se-zoom>`'s child-`value` read is preserved via `@property() accessor value`. Dropped: `style`
  attribute observation (no consumer) and the `@ts-expect-error: pre-existing null-misuse` line that
  wrote `.value` to a div.

- Converted `src/editor/components/seInput.ts` → LitElement (complex reference component; 209 LOC →
  ~60 LOC). External API preserved: `<se-input value="..." label="..." src="..." size="..."
  title="...">` + `change` event semantics (`new Event('change', {bubbles, composed})` —
  consumer-verified equivalent for TopPanel.ts's `attrChanger` at TopPanel.ts:624). Drops `import
  'elix/define/Input.js'` — 1 of the 12 elix-bound deps killed upfront (later #3 PRs close the
  remaining 11). Adds `::part('input')`, `::part('label')`, `::part('icon')` styling hooks for
  downstream callers.

- Added `tests/unit/seInput.test.js` — 3 form-control contract tests (value reflection, label
  rendering, programmatic value setter). Lean coverage per spec § "Non-goals" (no
  `@open-wc/testing-helpers`).

- Added `docs/superpowers/conventions/lit-component-conventions.md` — 12-bullet conventions
  checklist that PR-2 / PR-3 dispatch packets paste verbatim.

- Substrate verifications passed: ESLint v9 + standard TC39 decorators (lint stays under baseline);
  Vite HMR + Lit decorators via the SWC pipeline (manual smoke: seText edit-reload through the dev
  server confirmed — `[HMR] Panel` marker appeared and reverted cleanly).

- Verification: `tsc --build --force` 0 errors; `npm run lint` 0 errors / 140 warnings (5 BELOW the
  145 baseline — Lit-native TS components dropped JSDoc-as-types warnings); `npx vitest run` 640/640
  (was 637 post-substrate, +3 new from seInput contract); `npx tsx scripts/run-e2e.ts` 250/250
  across chromium + firefox (external APIs preserved → no regression).

### Substrate (SWC for TS transform — 2026-05-21)

Switch the TS-transform layer of Vite's pipeline from esbuild to SWC via `unplugin-swc`. Required to
support TC39 standard decorators + the `accessor` keyword for the upcoming elix → Lit migration
(todo #3, PR-1 onwards). esbuild's TC39 decorator support is incomplete — it passes the raw syntax
through, leaving the browser to parse it. Rollup's parser hard-rejects the `accessor` keyword. SWC
compiles stage-3 decorators to ES2022 helper-function calls that every modern browser parses
cleanly.

- Adds `unplugin-swc@^1.5` + `@swc/core@^1.15` as `devDependencies`.
- `vite.config.mjs` registers `swc.vite({ jsc: { parser: { decorators: true }, transform: {
  decoratorVersion: '2022-03' }, target: 'es2022', keepClassNames: true }, tsconfigFile: false,
  sourceMaps: true })` as the first plugin in the array. Inline options only — no `.swcrc` (single
  source of truth).

- `tsconfigFile: false` works around SWC's tsconfig reader not recognizing `target: "ES2025"`. tsc
  continues type-checking against ES2025 unchanged.

- Verification: tsc 0 errors / lint 0e/145w / vitest 637/637 / `npm run build` success (25 modules,
  11 extensions bundled) / e2e 250/250 across chromium + firefox / no source files modified.

- Spec: `docs/superpowers/specs/2026-05-21-svgedit-swc-substrate-design.md`. Probe artifacts (not
  committed) at `%TEMP%/svgedit-swc-probe` validated end-to-end with real Lit components.

- Unblocks: PR-1 of the elix → Lit migration (todo #3) and every subsequent per-component
  conversion.

### Changed (audit input #1 closure — ext-connector refactor + embed events 8→12 — 2026-05-21)

Closes the last remaining audit-input traceability item from the embed-API design (#1 ext-connector
monkey-patching). With this PR landed, **12 of 12 audit inputs closed**. PR-B per the 2026-05-21
audit-cleanup sweep.

- **`packages/svgcanvas/core/selected-elem.ts` — fires 4 new svgCanvas bus events:**
  `before-group` + `after-group` at the entry/exit of `groupSelectedElements`; `before-move` +
  `after-move` at the entry/exit of `moveSelectedElements`. `after-move` fires in both the
  command-produced and empty-result paths so subscribers always get the signal.

- **`src/editor/extensions/ext-connector/ext-connector.ts` — dropped the monkey-patches** of
  `svgCanvas.groupSelectedElements` and `svgCanvas.moveSelectedElements` (`:47-73` previously).
  Behavior preserved via `svgCanvas.bind('before-group', ...)` to remove connectors from selection
  pre-group, and `svgCanvas.bind('after-move', ...)` to refresh connector geometry post-move.
  Chain-to-previous pattern applied so future binders can stack.

- **`src/embed/protocol.ts` — `EmbedEventName` extended 8 → 12** with `before-group` / `after-group`
  / `before-move` / `after-move`. Allowlist serves both internal extension subscriptions (via
  `svgCanvas.bind`) and external host subscriptions (via `embed.on`).

- **`src/editor/EditorStartup.ts` — bridges the 4 new bus events to the embed channel.** Each new
  bind uses the chain-to-previous pattern so ext-connector's `before-group` + `after-move` handlers
  still fire alongside the embed emit.

- **`EMBED_API.md` — events table updated** to 12 rows with documentation for the 4 new events;
  added a paragraph noting that the group/move events are dual-channel (svgCanvas bus + embed
  channel).

- **`tests/e2e/fixtures/embed-host.html` — fixture forwards the 4 new events** to the test log.
- **`tests/e2e/embed-events.spec.js` — 3 new tests added** (6 across chromium + firefox):
  `before-group` + `after-group` fire around `groupSelectedElements`; `before-move` + `after-move`
  fire around `moveSelectedElements` (call's return-value Promise is `.catch()`-swallowed because
  `BatchCommand` instances can't structured-clone across `postMessage` — pre-existing serializer gap
  flagged as a separate follow-up; the bus events still fire); `after-move` fires even when
  selection produces no command.

- **`tests/unit/selected-elem.test.js` — 3 new unit tests added** verifying firing order at the
  svgCanvas-bus level: `groupSelectedElements` fires `before-group` then `after-group`;
  `moveSelectedElements` fires `before-move` then `after-move` with a selection AND with empty
  selection.

- **`docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md` — Audit input traceability table
  marks #1 closed** (12 of 12); Events allowlist table extended to 12 rows; Follow-up items list
  updated.

- **No host-side breaking changes.** `EmbedEventName` union grows in v1.x; existing host code
  unaffected. Method-shape contracts unchanged.

- **Verification:** `npx tsc --build --force` 0 errors; `npm run lint` 0 errors / 145 warnings
  (baseline maintained); `npx vitest run` 637/637 (was 634, +3 new); `npx tsx scripts/run-e2e.ts`
  250/250 across chromium + firefox (was 244, +6 new).

### Changed (audit-input cleanup sweep — 2026-05-21)

Bundles audit inputs #2, #4, #6, #7, #12 — 5 of the 6 follow-ups left after #4 embed API v1 shipped
earlier today. Closes 11 of 12 audit-input items total; only #1 (ext-connector monkey-patching
refactor + events allowlist 8→12) remains, queued as PR-B.

- **Audit input #6 (`Editor.ts:945-949` silent missing-icon warn):** `setIcon` now emits an `error`
  event with `source: 'missing-icon'` via `this._embedServer?.emit(...)` alongside the
  standalone-mode `console.warn`. Hosts can subscribe + show a localized error UI; standalone
  callers see no behavior change.

- **Audit input #2 (`selection.ts:178-181` `runExtensions` @todos):** Refactored to typed options
  object — formerly `runExtensions(action: string, vars?: unknown, returnArray?: boolean)` returning
  either `false`, the last-extension result, or an aggregated array; now `runExtensions({action:
  string, vars?: unknown}): unknown[]` that always aggregates. `runExtensionsMethod` impl
  simplified; `RunExtensionsOpts` interface exported; `svgcanvas.augment.d.ts` typed to the new
  shape (was `(...args: unknown[]) => unknown`).

- **All 20 `runExtensions` callsites migrated to the new shape:**
  - `packages/svgcanvas/core/event.ts` × 3 (`mouseMove`, `mouseUp`, `mouseDown` — dropped `true`
    3rd-arg at the 2 result-capturing sites)

  - `packages/svgcanvas/core/elem-get-set.ts` × 1 (`zoomChanged`)
  - `packages/svgcanvas/core/paste-elem.ts` × 1 (`IDsUpdated` — dropped `true` 3rd-arg, kept
    `.forEach` chain)

  - `packages/svgcanvas/core/selected-elem.ts` × 1 (`canvasUpdated`)
  - `src/editor/panels/LayersPanel.ts` × 3 (`layersChanged` × 2, `layerVisChanged`)
  - `src/editor/panels/BottomPanel.ts` × 1 (`toolButtonStateUpdate`)
  - `src/editor/extensions/ext-opensave/ext-opensave.ts` × 2 (`onOpenedDocument`, `onSavedDocument`)
  - `src/editor/Editor.ts` × 8 (`selectedChanged`, `elementTransition`, `elementChanged`,
    `elementRenamed`, `afterClear`, `beforeClear`, `zoomChanged`, `langChanged`)

  - Test mocks at `tests/unit/event.test.js:143-145` already returned `[]` so no test changes
    needed; `tests/unit/elem-get-set.test.js:37` mock returns `undefined` (caller doesn't capture).

- **Audit input #4 (`sePromptDialog` misnamed):** Closes during svgedit todo #3 (elix → Lit
  migration) — the rename ships as part of the Lit conversion of dialog components, not a separate
  follow-up. Spec doc updated to reflect.

- **Audit inputs #7 + #12 (multi-iframe tab-sync):** Re-classified from "follow-up" to **non-goal**
  in the spec doc. Multi-tab works today via `window.storage`; multi-iframe isn't on the project
  roadmap. If a real multi-iframe host emerges later, reopen as a new design item — not as a
  residual audit follow-up.

- **Spec doc `docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md` updated:** Status block
  adds 2026-05-21 v1 ship + v1.1 sweep notes; Non-goals section absorbs #7/#12 with rationale;
  Follow-up items section updated with ✓ / ✓-doc / ▢ status legend; Audit input traceability table
  shows 11 of 12 closed.

- **Verification:** `npx tsc --build --force` clean (0 errors); `npm run lint` 0 errors / 145
  warnings (baseline maintained, JSDoc-may-be-converted hints only); `npx vitest run` 634/634
  passing.

### Added (#4 embed API v1 — 2026-05-21)

- New `src/embed/` module — editor-side `EmbedServer` + host-side `SvgEditEmbed` proxy library +
  shared protocol/origin/url-params/chrome/theme helpers (8 TypeScript modules).

- New `EMBED_API.md` (472 lines) — canonical host-facing contract documenting URL params,
  postMessage envelope shape, 8-event allowlist, dialog hooks, chrome control, theme sync, security
  model, versioning, error codes, raw-protocol reference for non-JS hosts, recommended iframe
  sandbox attributes.

- `src/editor/Editor.ts` wire-in at line ~333 (after `window.svgEditor = this`) — instantiates
  `EmbedServer` with version + default dialog handlers wrapping existing `window.seAlert` /
  `window.seConfirm`; prompt returns default until #13 lands a real prompt-with-input component.

- `src/editor/EditorStartup.ts` — fires `_embedServer.ready()` immediately after the `svgedit:ready`
  DOM event; bridges svgCanvas events `changed` + `sourcechanged` (debounced 200ms) → embed
  `change`, and `selected` → embed `selection-changed`.

- `packages/svgcanvas/svgcanvas.ts` — added `getElem(id)` + extended `getId([elem])` to support
  host-side element-handle round-trip (Task 22 element-handles e2e suite requirement).

- 7 unit-test suites (vitest + jsdom): protocol (5), origin (8), url-params (9), chrome (7), theme
  (5), server (20), client (16). Total 70 new unit tests.

- 9 e2e suites (Playwright × 2 browsers): init handshake (6), methods round-trip (8), events (10),
  element-handles (4), chrome control (8), theme sync (6), dialog hooks (4), security (4),
  versioning (2). Total 52 new e2e tests.

- `tsconfig.embed.json` + `npm run build:embed` step — emits
  `dist/embed/{client,protocol,origin,url-params,chrome,theme,server,index}.{js,d.ts}` for host
  consumption.

- `package.json` `exports` field maps `svgedit/embed` to `dist/embed/index.js`.
- `tsconfig.json` `include` array extended with `src/embed/**/*.ts` so ESLint's type-aware lint
  covers the new module.

- `scripts/copy-static.ts` — copies the e2e fixture + dist/embed/ artifacts into vite-preview's
  served root so e2e suites can load the embed library + parent-page fixture.

- Closes svgedit todo item #4. Closes 6 of 12 audit-input items (#3 dialog hooks, #5 extension-error
  event, #8 ready wire-up, #9 load-API doc, #10 read-API doc, #11 extension-injection doc); 6
  remaining items tracked as follow-ups in the spec doc.

### Changed (fork-network detach — 2026-05-20)

- Detached `bilbospocketses/svgedit` from the `SVG-Edit/svgedit` fork network (GitHub Settings →
  Danger Zone → Leave fork network). `gh repo view` confirms post-detach state: `isFork: false`,
  `parent: null`. The "forked from SVG-Edit/svgedit" badge on GitHub no longer shows; the repo is
  now standalone in GitHub's repository graph.

- **Why:** Reflects the locked scope directive ("no upstream tracking, no PRs upstream",
  `project_svgedit.md`) at the repo-metadata level. Fork-network membership was vestigial signal —
  search-result inclusion in the 1,733-repo network, child-fork-aware rule logic,
  organisational-affinity behaviour — none of which applied to a repository whose declared lineage
  is one-way + one-time.

- **Eligibility verified pre-detach:** size 113 MB (< 1 GB GitHub cap), public, 0 child forks, 0
  stars, 0 watchers, 0 open issues, 0 open PRs (PR #1 — the TS migration — was the original blocker;
  it merged earlier today as `1fdceac8` and consumed the wait condition).

- **No runtime / source-code changes.** Pure GitHub-metadata operation. `README.md` /
  `CONTRIBUTING.md` / `SECURITY.md` framing intact — the code lineage is still factually a fork from
  `SVG-Edit/svgedit v7.4.1` (forked 2026-04-23 per `## Fork point` below); only the GitHub-managed
  fork-network membership was severed.

- Closes `todo_svgedit.md` item #16 (surfaced 2026-05-19, sequenced after PR #1 land per the
  original spec).

### Changed (Step 3 — JS → TS migration COMPLETE — 2026-05-19 → 2026-05-20)

The bulk of the codebase converted from JavaScript to TypeScript under day-one strict mode (`strict:
true`). 113 commits on `feat/ts-migration`, squash-merged into one master commit at PR #1.

**Conversion totals (~115 production files):**

- `packages/svgcanvas/common/` — 3 files (Task 5)
- `packages/svgcanvas/core/` — 24 files in 4 sub-tasks (Tasks 6/7/8/9)
- `packages/svgcanvas/svgcanvas.ts` barrel — 1 file (Task 10)
- `src/editor/` top-level + locale — 9 files (Task 11)
- `src/editor/components/` (including jgraduate/) — 23 files (Task 12)
- `src/editor/dialogs/` (including vendored se-elix/) — 15 files (Task 13)
- `src/editor/extensions/` (11 extensions × main+locale + 2 helpers) — 23 files (Task 14)
- `src/editor/panels/` — 4 files (Task 15)
- `scripts/` (build-extensions, copy-static, run-e2e) — 3 files via `tsx` (Task 16)
- `src/editor/typedefs.js` — DELETED (pure JSDoc, no runtime exports)
- **Total: ~115 production files converted, ~5,000 type annotations added, 0 behavior changes.**

**Day-one strict mode flags:**

- `strict: true` (all sub-flags including `strictNullChecks`, `noImplicitAny`,
  `useUnknownInCatchVariables`)

- `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `verbatimModuleSyntax`, `isolatedModules`

**New tooling and infrastructure:**

- TypeScript 6.x + ESLint v9 (flat config) + `@typescript-eslint/parser` v8 +
  `@typescript-eslint/eslint-plugin` v8

- Vite 7 handles `.ts` natively via esbuild (no Babel)
- Vitest 4 + Playwright 1.57 (unchanged frameworks; test files stayed JS for this PR)
- `tsx@^4.22` + `@types/node@^22.19` devDeps added (Task 16)
- `"type": "module"` added to `package.json` (Task 16, required for `tsx` ESM script execution)
- New TS infrastructure files: `tsconfig.json` (root) + `packages/svgcanvas/tsconfig.json`
  (workspace project reference) + `packages/svgcanvas/svgcanvas.augment.d.ts` (wired-on `SvgCanvas`
  method declarations) + `src/editor/elix.d.ts` (narrow ambient declarations for the `svgEditor`
  global + minimal elix module shapes)

**Naming-consistency renames** (Task 17 — TS-aware identifier renames, 9 commits):

- `controllPoint1/2` (+ `getControllPoint1/2` + `setControllPoint1/2`) → `controlPoint1/2`
- `getrootSctm` → `getRootSctm`
- `getrefAttrs` → `getRefAttrs`
- `gettingSelectorManager` → `getSelectorManager`
- `idprefix` → `idPrefix`
- `getbSpline` / `setbSpline` → `getBSpline` / `setBSpline`
- `current_drawing_` → `currentDrawing`
- `handler_` → `_handler`

**Deferred to follow-up PRs (NOT in this migration's scope):**

- File splits (`EditorStartup.init()` 590-line, `Editor.ts` 1393-line, `TopPanel.ts`
  per-element-type, `recalculate.ts` per-element helpers)

- Mutable-export refactor (`path.ts:77` `export let path = null`)
- `SelectModule` + wire-methods-onto-svgCanvas singleton refactor (proper class methods OR
  per-module interface augmentation)

- Other trailing-underscore pseudo-privates → `#` true private fields (`historyrecording.ts`,
  `layer.ts`, `recalculate.ts`)

- Test file conversion to TS (vitest unit tests + Playwright e2e tests stay JS for this PR)
- Audit-flagged correctness bugs (LayersPanel `_eye.style.width` duplicate, contextmenu
  `appendChild` bug, etc.) — all preserved verbatim with `// TODO: see todo #10` comments

- elix → Lit migration (#3 in todo) — file-level `eslint-disable` blocks on 11 elix-extending
  components flagged with cleanup-deferred-to-#3 comments

- Native dialog → modal replacement (#13 in todo)

**Verification at branch HEAD (post-rebase onto master `715e7fc9`, 113 commits squashed at merge):**

- `npx tsc --build --force`: 0 errors (workspace + root, day-one strict)
- `npm run lint`: 0 errors + 145 informational warnings (mostly JSDoc-may-be-converted-to-TS-types
  hints, deferred to a doc-pass follow-up)

- `npm run build`: success + `Bundled 11 extensions`
- `npx vitest run`: 564/564 passed
- `npx tsx scripts/run-e2e.ts`: 192/192 passed (Chromium + Firefox, 1 known firefox layers-panel
  flake passes 3/3 in isolation)

**Lessons captured during migration (in svgedit's session memories — see todo #2 for full list):**

- Subagent gate-claim verification: implementer subagents reporting "gate clean" or "lint unchanged"
  must be RE-VERIFIED by running the gate command directly. Multiple incidents during Tasks
  11/12/14/15 where subagent reports diverged from actual state.

- `tsc --build` exits 0 from cached `tsbuildinfo` even when errors print — always use `--force` for
  verification.

- IDE diagnostics are stale during long-running edit sessions — verify only via direct command
  output, never the IDE pane.

- `npm run build` can exit 0 with empty extension subscript output ("No extension entries found") if
  a build-script globs for `.js` after files convert to `.ts`. Watch for the `Bundled N extensions`
  line specifically.

- `tsx` ESM script execution requires `"type": "module"` in `package.json` when scripts are `.ts`
  (not `.mts`).

- `as unknown as Foo` double-casts are sometimes necessary (e.g., `createElementNS(...)` →
  `SVGSVGElement`) — suppress the `no-unnecessary-type-assertion` rule with a per-line comment
  explaining why.

### Added (OpenSSF Scorecard supply-chain visibility — 2026-05-19)

- Closes audit finding: `svgedit missing scorecard.yml — supply-chain visibility gap`. Cross-repo
  parity with control-menu (which shipped Scorecard in CM PR #14 + the SHA-pin hot-fix in #15).

- **New `.github/workflows/scorecard.yml`** — weekly cron `0 13 * * 1` (Mon 13:00 UTC) + `push:
  master` + `pull_request: master` + `branch_protection_rule` triggers. Runs the OSSF Scorecard
  check suite (Branch-Protection, Pinned-Dependencies, Dangerous-Workflow, Token-Permissions, SAST,
  Signed-Releases, etc.), uploads SARIF to the Security tab alongside CodeQL alerts, and publishes
  the public score to `api.securityscorecards.dev` (badge URL
  `https://scorecard.dev/viewer/?uri=github.com/bilbospocketses/svgedit`). `publish_results` gated
  to `github.event_name == 'push'` so PR runs skip publishing (a PR-HEAD SHA isn't on master yet —
  OpenSSF webapp's commit-graph verifier rejects with "imposter commit" 400, same failure mode as
  the annotated-tag-object SHA we documented in `feedback_action_sha_pin_commit_not_tag_object.md`).

- **Top-level `permissions: read-all`** + job-level scoped grants (`security-events: write` for
  SARIF upload, `id-token: write` for OIDC publish, `contents: read`, `actions: read`). Tight
  job-level permissions satisfy Scorecard's own Token-Permissions check.

- **All 4 actions SHA-pinned to commit SHAs (not tag-object SHAs)** with precise `# vX.Y.Z` comments
  — applies both standing repo lessons inline:

  - `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2` (already in `ci.yml`, same
    pin)

  - `ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a # v2.4.3` (NEW — added to
    `patterns_allowed` in same PR)

  - `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1` (NEW; github-owned,
    covered by `github_owned_allowed=true`)

  - `github/codeql-action/upload-sarif@9e0d7b8d25671d64c341c19c0152d693099fb5ba # v4.35.5` (NEW;
    github-owned)

- **Allowed-actions config** — added `ossf/scorecard-action@*` to
  `actions_permissions.selected_actions.patterns_allowed`. Pre-change svgedit had no third-party
  patterns (only `github_owned_allowed=true` + `sha_pinning_required=true`); this is the first
  non-github-owned third-party action allowlisted.

- **Master branch ruleset `16565370`** — `required_status_checks` extended with a 4th context
  `Scorecard analysis` alongside the existing `build-and-test` + `Analyze (javascript-typescript)` +
  `Analyze (actions)`. Hard-gates merges on Scorecard findings; PR trigger in the workflow is what
  makes this satisfiable (without firing on PRs, the required check would never report and merges
  would block forever).

- Cross-repo state at landing: ws-scrcpy-web shipped its own Scorecard workflow earlier the same day
  via wssw PR [#31](https://github.com/bilbospocketses/ws-scrcpy-web/pull/31) (`976d764`);
  control-menu via CM PRs #14 + #15. All three repos are at OpenSSF Scorecard parity post-merge.
  (Original PR #10 body claimed wssw "still lacks `scorecard.yml`" — fact-check miss before PR
  draft; corrected here.)

### Changed (post-parity ruleset tightening — 2026-05-19)

- Pure API-state changes (no source commits) — pushes svgedit ahead of peer parity on three
  dimensions.

- **Branch ruleset `16565370`:**
  - `pull_request.allowed_merge_methods`: `["merge","squash","rebase"]` → `["squash","merge"]`.
    Hardware-enforces the CLAUDE.md "squash, never rebase" SOP — the "Rebase and merge" button no
    longer renders in the GitHub UI. Eliminates the accidental-unsigned-commit class that left old
    `verified:false` commits in ws-scrcpy-web's pre-lockdown history. (`gh api -X PUT
    /repos/.../rulesets/16565370 --input ...` — full GET → mutate → PUT script in `feedback_*`
    memory.)

  - `required_status_checks`: added `Analyze (javascript-typescript)` + `Analyze (actions)`
    alongside the existing `build-and-test`. CodeQL findings now block merge. Demonstrated need: PR
    #8's first push had 2 new high-severity polynomial-redos alerts that were technically mergeable
    under the old config; the new config would have blocked.

- **Tag ruleset `16565201`:** added `required_signatures` to the rules array (was `[deletion,
  non_fast_forward]`, now `[deletion, non_fast_forward, required_signatures]`). Tags pushed without
  `git tag -s` (or with mis-configured SSH signing) now fail at push.

- **`secret_scanning_non_provider_patterns` + `secret_scanning_validity_checks` BLOCKED:** both
  require GitHub Advanced Security (GHAS, $49/active-committer/month for orgs). `PATCH
  /repos/.../security_and_analysis` returns 200 OK silently without applying state changes on free
  public repos. Deferred indefinitely; will be revisited if GitHub expands free coverage. Lesson
  captured: GHAS-gated security features fail silently on the free tier — not with an error.

### Fixed (CodeQL alert triage — 2026-05-19)

- **All 8 open CodeQL alerts cleared on `master`** (4 fixed + 2 dismissed earlier as
  auto-resolution + 2 fixed in this PR). Final state: 0 open CodeQL alerts, parity with
  control-menu / ws-scrcpy-web.

- **`packages/svgcanvas/core/utilities.js` — 2× `js/polynomial-redos` (high) — FIXED**
  - **`dropXMLInternalSubset`**: replaced regex with `String.indexOf` walk. First attempt at
    deterministic regex (`/(<!DOCTYPE[^[]*\[)[\s\S]*?(\?]>)/`) still tripped CodeQL because
    unanchored regex matching is O(N²) at the engine level (N positions × N work per attempt).
    String-operation walk is strictly O(N).

  - **`dataURLToObjectURL`**: same — replaced `prefix.match(/:(.*?);/)` with paired `indexOf(':')` +
    `indexOf(';', colonIdx+1)` + `slice`. Equivalent MIME extraction semantics, strictly O(N).

- **`packages/svgcanvas/core/svgroot.js` — 4× `js/html-constructed-from-input` (medium) — FIXED**
  - `svgRootElement` rewritten from template-literal XML construction + `text2xml` parse +
    `importNode` round-trip → direct `createElementNS` + `setAttribute` element building. Eliminates
    the entire "construct HTML string from library input" class of vulnerability that CodeQL
    flagged. Same DOM tree produced (svg/defs/filter/feGaussianBlur/feOffset/feMerge/feMergeNode).
    Dimensions explicitly stringified via `String()` before `setAttribute`. `text2xml` import
    removed (no longer needed). Net +24 lines for the more explicit construction.

- **`_reference/embed-api-v6/embedapi.js` — 2× `js/unvalidated-dynamic-method-call` (high) —
  DISMISSED**

  - Both alerts dismissed via API with rationale: preserved V6-era reference code (per
    `project_svgedit.md` and README §Embedding), retained as design input for the future V7+ embed
    API but never imported/executed at runtime. Original source already carried `// lgtm
    [js/unvalidated-dynamic-method-call]` suppression comments + documented rationale (callbackID
    checked numeric AND `t.callbacks[callbackID]` existence checked AND calls limited to
    allowedOrigins). Will be re-evaluated when V7 embed API is implemented. Mirrors ws-scrcpy-web's
    §28 "dismissed with rationale" pattern.

### Fixed (Dependabot vulnerability cleanup — 2026-05-19)

- Cleared **all 31** open Dependabot alerts surfaced by the 2026-05-18 master lockdown (1 critical,
  13 high, 17 moderate). Final state: 0 open alerts, `npm audit` reports 0 vulnerabilities.

- **Direct-dep bumps:**
  - `jspdf 4.0.0 -> 4.2.1` — closes 9 alerts (HTML injection, PDF object injection in
    FreeText/AcroForm/addJS, DoS via GIF/BMP, XMP metadata injection, race condition).

  - `vite ^7.3.1 -> ^7.3.2` — closes 3 alerts (`server.fs.deny` bypass via queries, WebSocket
    arbitrary file read, optimized-deps `.map` path traversal). Lockfile resolves to 7.3.3.

- **`overrides` block** added to `package.json` to force transitive resolutions onto fixed versions:
  - `dompurify ^3.4.0` — closes 9 alerts (FORBID_TAGS bypass, SAFE_FOR_TEMPLATES bypass, prototype
    pollution, ADD_TAGS / ADD_ATTR predicate bypasses, USE_PROFILES prototype pollution,
    mutation-XSS, CUSTOM_ELEMENT_HANDLING fallback XSS). Lockfile resolves to 3.4.5.

  - `flatted ^3.4.2` — closes 1 alert (prototype pollution via `parse()`).
  - `postcss ^8.5.10` — closes 1 alert (XSS via unescaped `</style>` in CSS stringify output).
    Lockfile resolves to 8.5.14.

  - `rollup ^4.59.0` — closes 1 alert (arbitrary file write via path traversal). Lockfile resolves
    to 4.60.4.

  - `glob ^10.5.0` — closes 1 alert (CLI command injection via `-c`/`--cmd`).
- **`npm audit fix --package-lock-only`** resolved the remaining 6 transitive alerts in the eslint /
  istanbul / brace-expansion / ajv / ws / minimatch (9.x) / picomatch (4.x) / js-yaml (4.x) chains —
  all semver-compatible.

- Tracks `todo_svgedit.md` item #14 (the surfacing entry from the lockdown pass); item closes when
  this PR lands.

### Added (repo hygiene + security baseline — 2026-05-19)

- `LICENSE` (GPL-3.0-only) added at repo root. Matches Control Menu / ws-scrcpy-web. Inherited
  upstream code retains its original licenses; `LICENSE-MIT.txt` preserved at root for upstream
  attribution.

- `SECURITY.md` — private vulnerability reporting flow via GitHub Security Advisories with 72h
  acknowledgement SLA. Scope: svgedit web app + build pipeline + extension loader + embed entry
  points + export modules. Out-of-scope: upstream dep vulns (report upstream), browser-engine bugs,
  self-XSS.

- `CONTRIBUTING.md` — solo-fork posture documented; prerequisites (Node ≥ 20), setup, dev workflow,
  code-style notes covering the JS → TS migration split between master and `feat/ts-migration`,
  commit/PR conventions, master is PR-gated as of 2026-05-18, signed commits required,
  `build-and-test` CI gate.

- `.github/dependabot.yml` — version-update coverage for `npm` (main package + `packages/svgcanvas`
  workspace) and `github-actions` (CI workflow SHA pins), weekly cadence, 5 open-PR limit. Pairs
  with the security-update auto-handling already enabled in repo Settings.

- `.github/workflows/ci.yml` — `build-and-test` workflow on `master` (push + PR). SHA-pinned
  `actions/checkout@v6.0.2` + `actions/setup-node@v6.4.0`, node 24. Steps: `npm ci` → `npm run lint`
  → `npm run build` → `npx vitest run` → `npx playwright install --with-deps chromium firefox` →
  `node scripts/run-e2e.mjs`. No `tsc --build` step on master (no TypeScript yet);
  `feat/ts-migration`'s richer workflow supersedes this on merge.

- `package.json` license field changed from the upstream compound SPDX expression to `GPL-3.0-only`.

### Added (CI workflow + GitHub repo lockdown — 2026-05-18)

- `ci: add minimal build-and-test workflow (SHA-pinned actions)` (`f2b44139`) — new
  `.github/workflows/ci.yml` with a single `build-and-test` job on `ubuntu-latest`. Triggers on
  `push` to `master` + `pull_request` targeting `master`. Steps:
  `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2` →
  `actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0` (node 24 + npm cache) →
  `npm ci` → `npm run lint` → `npx tsc --build` → `npm run build` → `npx vitest run` → `npx
  playwright install --with-deps chromium firefox` → `node scripts/run-e2e.mjs`. All actions
  SHA-pinned per the repo's new `sha_pinning_required` enforcement. `permissions: contents: read`.
  First run [#26070417526](https://github.com/bilbospocketses/svgedit/actions/runs/26070417526)
  passed in 3m31s with no test failures (only pre-existing lint warnings as advisory annotations).

- **GitHub repo lockdown (API-only, no source change) — mirrors control-menu's Tier 3 hardening
  baseline:**

  - **Branch ruleset on `refs/heads/master`** (id `16565370`, name "Protect master branch",
    enforcement active): rules = `deletion` (block delete) + `non_fast_forward` (block force-push) +
    `required_linear_history` + `required_signatures` (commits must be signed) + `pull_request` (0
    approvals required, all merge methods allowed) + `required_status_checks` (context
    `build-and-test`, `strict: false`, `do_not_enforce_on_create: false`). `bypass_actors: []`,
    `current_user_can_bypass: never`. Mirrors control-menu's ruleset 1:1.

  - **Tag ruleset on `refs/tags/*`** (id `16565201`, name "Protect all tags", enforcement active):
    rules = `deletion` + `non_fast_forward`. Scope broader than control-menu's `refs/tags/v*` to
    cover svgedit's existing `pre-*`/`post-*` safety + milestone tags AND future `v*` release tags.

  - **Actions permissions tightened:** `allowed_actions: "selected"` +
    `sha_pinning_required: true` + `github_owned_allowed: true` + `verified_allowed: false` +
    zero third-party patterns (extend the patterns list when the first 3rd-party action is
    genuinely needed; today only `actions/checkout` and `actions/setup-node` are in use, both
    `github_owned`).

  - **Dependabot security updates enabled** + vulnerability alerts enabled (the latter is a
    prerequisite for the former; GitHub returned `422 Vulnerability alerts must be enabled to
    configure automated security fixes` on the first attempt — fixed by `PUT
    /repos/.../vulnerability-alerts` then re-issuing the `PUT /repos/.../automated-security-fixes`).

  - **Secret scanning + push protection already on** from prior GitHub default config; no change
    needed.

  - **Behavior changes going forward:** all changes to `master` MUST go through a PR (no direct
    pushes); commits must be signed with the SSH signing key (per
    `reference_ssh_signing_windows.md`); `build-and-test` CI must pass before any merge; tags
    (including existing `pre-cleanup`, `post-cleanup`, `pre-compat-investigation`,
    `post-compat-investigation`, `pre-ts-migration`, `post-pathseg-drop`) cannot be deleted or
    force-overwritten; any new workflow files must SHA-pin actions + use only `github_owned` or
    future allowlisted patterns.

  - **Draft PR [#1](https://github.com/bilbospocketses/svgedit/pull/1)** opened from
    `feat/ts-migration` → `master` to drive the first CI run AND serve as the eventual merge vehicle
    once Step 3 (Tasks 11–18) ships.

- **Lockdown items deferred (not done this pass):** CodeQL workflow; `dependabot.yml` for version
  updates (only security updates auto-enabled); attestations / `actions/attest-build-provenance`;
  third-party actions allowlist patterns (currently `github_owned` only). *(Superseded 2026-05-19:
  CodeQL default setup enabled; `dependabot.yml` for version updates added in the hygiene baseline
  PR.)*

### Changed (TS migration Tasks 9a + 9b + 10 — Step 3 in progress, 2026-05-18)

- `refactor(svgcanvas/core): convert event + path + svgroot to TS [3 files] (Task 9a of 9)`
  (`fdc579cb`) — first half of plan Task 9 (C5d). Converts the 3 heaviest event/path/dom-root files
  under day-one `strict` + `isolatedDeclarations: true`. **event.ts** (1530 lines): file-level
  `eslint-disable` for the 5 unsafe-* rules + `no-non-null-assertion`; all event handlers typed
  `(evt: MouseEvent): void` or `(e: WheelEvent): void`; B-spline matrix typed as `readonly [readonly
  [number, number, number, number], ...]` tuple-of-tuples for `noUncheckedIndexedAccess` compliance;
  3 `@ts-expect-error` directives on intentional switch fallthroughs (TS 6.x removed `// falls
  through` comment recognition — pure flow analysis only); 12 `!` non-null assertions covering
  pre-existing null-unsafe sites. **path.ts** (828 lines): `export let path: any = null` (Path class
  lived in path-method.js, still .js at this point); local `PathSeg`/`PathSegList` minimal
  interfaces consumed at `recalcRotatedPath` and `convertPath` cast sites; wildcard `import * as` +
  `as any` for path-method.js / path-actions.js (still .js); 6 `@ts-expect-error` in `convertPath`
  for the H/h, V/v, abs-arc→rel, C/c, Q/q, S/s fallthroughs; `convertPath` itself preserved as-is
  with the inline TODO block from Step 1 explaining why it can't be consolidated with
  `path-actions.js:convertPath`. **svgroot.ts** (36 lines): `svgRootElement(svgdoc: Document,
  dimensions: [number, number]): SVGSVGElement` with `as unknown as SVGSVGElement` double-cast on
  `importNode` result. **svgcanvas.augment.d.ts:** tightened 10 path.ts wired-on signatures
  (`removePath_`, `getPath_`, `setLinkControlPoints`, `reorientGrads`, `recalcRotatedPath`,
  `getSegData`, `getUIStrings`, `setPathObj`, `getPathFuncs`, `getLinkControlPts`) + 6 event.ts
  handlers from `(...args: unknown[]) => unknown` to real signatures. All audit-flagged sites
  preserved (event.ts `<a>` parent walk TODO, browser-bug comments at :957/:986, path.ts mutable
  export, `convertPath` inline TODO). Verified: tsc --build 0 errors, lint clean, build clean,
  vitest 564/564. e2e NOT runnable from 9a's commit (revealed the systemic vendoring gap, fixed in
  `21f559d3` immediately after).

- `chore(scripts): transpile .ts -> .js when vendoring svgcanvas for unit-harness` (`21f559d3`) —
  **fixes a SYSTEMIC vendoring gap** introduced silently in Tasks 5–8 and exposed by 9a's manual e2e
  attempt. `scripts/copy-static.mjs` recursively copied `packages/svgcanvas/` to
  `dist/editor/tests/vendor/svgcanvas/` verbatim, including the new `.ts` files.
  `src/editor/tests/unit-harness.html` imports vendored sources with literal `.js` paths (e.g.
  `import * as util from './vendor/svgcanvas/common/util.js'`). `vite preview` (used by `start:e2e`)
  serves static files literally — no `.ts` on-the-fly transpilation — so the harness's `.js` imports
  404'd. 28 unit-style tests × 2 browsers × cascade = 86 e2e failures. Fix: `copy-static.mjs` now
  walks `packages/svgcanvas/` recursively, transpiles each `.ts` file to `.js` via
  `esbuild.transform({ loader: 'ts', format: 'esm', target: 'es2022', sourcemap: false })` (esbuild
  is a transitive dep via Vite — no new install), skips `.d.ts` files, excludes the
  `packages/svgcanvas/dist/` subdirectory, and copies all other files verbatim. After the fix:
  vendor dir has zero `.ts`/`.d.ts` files; e2e restored to 192/192 (96 Chromium + 96 Firefox).

- `refactor(svgcanvas/core): convert path-actions + path-method + recalculate + svg-exec to TS [4
  files] (Task 9b of 9)` (`b74075c0`) — second and heaviest half of plan Task 9 (C5d).
  **path-method.ts** (~1290 lines): `PathDataListShim`, `Segment`, `Path` converted to proper TS
  classes; `PathSeg` interface exported with `[key: string]: number | boolean | string | undefined`
  index signature for the dynamic property access at `ptObjToArrMethod` / `replacePathSegMethod` /
  `getControlPointsMethod` / `Segment.setLinked`; `Path` class uses `[key: string]: any` (escape
  hatch for ad-hoc `oldbbox` / `last_d` / `dragctrl` / `cur_pt` / `dragging` properties — flagged
  for Task 17 narrowing); **global `declare global { interface SVGPathElement { pathSegList:
  PathDataListShim } }` block** added at file top (post-Step-2 `path-data-polyfill` already declares
  `getPathData`/`setPathData` globally via its own `types.d.ts`, so the augment is trimmed to only
  `pathSegList`). **path-actions.ts** (~1200 lines): `PathActions` class + standalone `convertPath`
  (numeric-letter dispatch variant — distinct from `path.ts:convertPath`); 7 `@ts-expect-error` for
  intentional switch fallthroughs; `canDeleteNodes` getter preserved as-is. **recalculate.ts** (~850
  lines): single huge `recalculateDimensions` function kept intact per spec (no split);
  `tlistMaybe` + `tlist` reassignment pattern handles `SVGTransformList | null` narrowing;
  `changes`/`initial`
  typed `Record<string, unknown>` with final cast to `Record<string, string | null>` for
  `ChangeElementCommand`. **svg-exec.ts** (~1300 lines): all 8 audit-flagged correctness gaps
  preserved (`_moz-math-font-style`, `setUseData` undo/redo, `importSvgString` interop,
  `console.error` inconsistency, `uniquifyElems` symbol-not-removed bug, `uniquifyElems` image/a
  internal refs, multi-element gradient duplication); `doc.output()` cast via `(doc.output as
  any)()` for jsPDF overload restrictions. **path.ts cleanup:** wildcard `* as ... as any` imports
  replaced with named imports; local `PathSeg`/`PathSegList` interfaces dropped (now global via
  SVGPathElement augmentation); cast sites simplified from `(pth as unknown as { pathSegList:
  PathSegList }).pathSegList` to direct `pth.pathSegList`; `export let path: any` → `export let
  path: Path | null`; redundant `getBBox as utilsGetBBox` alias dropped; `@ts-ignore` removed (no
  longer needed). **augment.d.ts:** 9 svg-exec wired methods tightened; `dragStartTransforms?:
  Map<Element, string>` and `hasDragStartTransform?: boolean` made optional (matches the `addedNew?`
  pattern — never initialized in `init()`). **utilities.ts** + **selected-elem.ts** ripple-edits:
  `getPathBBox` local pathSegList type override updated for `getItem(): PathSeg | null`; one
  `recalculateDimensions(n as Element)` cast where `n: Node`. Verified: tsc --build 0 errors, lint
  clean, build clean, vitest 564/564, e2e 192/192 both browsers.

- `refactor(svgcanvas): convert svgcanvas.ts barrel + delete legacy shim (Task 10 of 18)`
  (`b8149c3e`) — converts `packages/svgcanvas/svgcanvas.js` → `.ts` (~1544 lines, canonical `class
  SvgCanvas`) under day-one strict + `isolatedDeclarations: true`. ~40 explicit instance fields +
  ~20 `declare` fields for wired-on methods called from inside the class body (suppresses TS2339
  under `strict`). **Deletes legacy `packages/svgcanvas/svgcanvas.d.ts`** (226-line hand-maintained
  shim) after auditing every declaration: class methods → svgcanvas.ts class members; wired methods
  → augment file; 7 ghosts dropped (`undo`, `redo`, `unbind`, `getPrivateMethods`, `getNumLayers`,
  `getLayer`, `getCurrentLayerName` — verified zero consumers via grep across `src/editor/` and
  `packages/svgcanvas/core/`). **augment.d.ts +14 entries** (clearSelection, getResolution,
  setResolution, moveSelectedElements, deleteSelectedElements, copySelectedElements,
  groupSelectedElements, ungroupSelectedElement, moveToTopSelectedElement,
  moveToBottomSelectedElement, moveUpDownSelected, undoMgr, setSvgString, embedImage). The shim's
  `embedImage(dataURI: string): Promise<Element>` was wrong; new entry matches implementation:
  `(src: string): Promise<string | false>`. **`packages/svgcanvas/package.json` `types` field:**
  `"svgcanvas.d.ts"` → `"dist/svgcanvas.d.ts"` (tsc-emitted location). **Polish item (a):**
  `recalculate.ts:145` `typeof BatchCommand.prototype | null` → `InstanceType<typeof BatchCommand> |
  null` (idiomatic TS form). **Polish item (b):** `path-actions.ts:22` adds `import type { PathSeg,
  Segment } from './path-method.js'` at top; 2 inline `import('./path-method.js').Segment`
  annotations at use sites simplified to bare `Segment`. **Polish item (c):** `declare global {
  SVGPathElement }` block in path-method.ts trimmed to declare only `pathSegList` (removed
  `getPathData`/`setPathData` — duplicates of `path-data-polyfill/types.d.ts`'s existing globals).
  Centralization to a separate `svgcanvas.global.d.ts` attempted but abandoned (an ambient `.d.ts`
  becoming a module when it has any `import` would mean `declare global` only applies when the
  module is imported — different constraint than initially diagnosed as "circular friction").

- `chore(svgcanvas): delete legacy svgcanvas.js + track SVGPathSegment cast collateral (Task 10
  followup)` (`eff97dc7`) — deletes the 1374-line stale `packages/svgcanvas/svgcanvas.js` that was
  inadvertently left on disk in `b8149c3e` (parallel copy of the new `.ts`). 5 vitest unit tests
  import `./svgcanvas.js` directly; Vite's `moduleResolution: bundler` resolves those to `.ts`
  transparently — vitest 564/564 confirms no test-file modifications needed. Also adds `//
  TODO(post-migration #10): SVGPathSegment type unification` comments at 5 `as SVGPathSegment` cast
  sites that became collateral when Task 10 trimmed the `declare global` block (path-actions.ts:419,
  :471 + path-method.ts:87, :1015, :1018). The casts widen internal `{ type: string; values:
  number[] }` to path-data-polyfill's `SVGPathDataCommand` union; proper unification is deferred to
  a future cleanup pass.

- `chore(types): tighten addToSelection augment signature to match impl (Task 10 cleanup)`
  (`f232fa64`) — code-quality reviewer flagged `addToSelection: (...args: unknown[]) => unknown` in
  the augment file while the class body declared `(elemsToAdd: Element[], showGrips?: boolean) =>
  void`. Interface declaration merging silently accepted the divergence, but external consumers
  would have seen the loose augment signature. Augment tightened to match the class — call sites now
  get the right type.

### Deferred (code-quality reviewer findings for Tasks 9-10 — track for Task 11+ or Task 17)

- **No `tsc --build` step in `npm run build`:** vite-only build pipeline doesn't emit
  `dist/svgcanvas.d.ts`; the workspace `tsconfig.json` `declaration: true` only fires when `tsc
  --build` runs manually. `packages/svgcanvas/package.json` `"types": "dist/svgcanvas.d.ts"` is
  orphan on clean build. Not a runtime issue (internal workspace consumers use TS project references
  against source `.ts` directly); matters if/when svgedit is consumed as a published npm package.
  Fix direction: `postbuild` hook running `tsc --build` after `vite build packages/svgcanvas`.

- **`declare global { SVGPathElement }` placement** in `path-method.ts` is functional but a future
  hygiene item — could move to a dedicated `svgcanvas.global.d.ts` (ambient, no `import` statements)
  if the `PathDataListShim` shim ever moves out of `path-method.ts`.

- **`curCommand: any` and `filter: any`** in `svgcanvas.ts:175-176` lack inline `//
  TODO(post-migration)` tracking comments. Inconsistent with the rest of the migration's "zero new
  `any` without a tracking comment" discipline.

- **`initializeSvgCanvasMethods()` repetition:** ~60 `this.X = importedFunction` assignments mirror
  the `declare X` field block — any new utility requires 3-place updates (import, declare, assign).
  `Object.assign(this, { ... })` consolidation is a future ergonomic refactor.

- **`addSVGElementsFromJson as any` cast** at `svgcanvas.ts:1375` has no TODO; `json.ts`'s return
  type (`Element | Text | null`) doesn't match `utilities.ts`'s `AddSVGElementsFromJsonFn` type
  (`(data: SVGElementJSON) => Element`).

- **`SVGPathSegment` cast unification** (5 sites tagged with TODOs in `eff97dc7`) — proper fix is to
  change `PathDataListShim._getData()`'s return type to `Array<{ type: SVGPathDataCommand; values:
  number[] }>` and propagate through the call chain.

### Changed (pathseg polyfill drop — Step 2 of 5, 2026-05-16)

- `refactor(path): drop pathseg polyfill (Step 2 of 5)` — 3-commit PR (`feat/pathseg-drop`). Removes
  the legacy `pathseg` polyfill from runtime deps and replaces it with `path-data-polyfill` (the SVG
  2 spec polyfill). Refactors **10 sites** across 2 files (`packages/svgcanvas/core/path-actions.js`
  8 sites + `packages/svgcanvas/core/path-method.js` 2 sites in `Path.addSeg`) from
  `createSVGPathSeg*` constructors + `seglist.appendItem(seg)`/`insertItemBefore(seg, i)` to
  `getPathData()` + `data.push/splice({type, values})` + `setPathData(data)`. The audit originally
  undercounted at "8 sites in path-actions.js"; the 2 path-method.js sites were caught by manual
  smoke when Clone Node silently failed post-pathseg-drop (the addSeg `createSVGPathSeg*` calls
  became undefined). Lesson captured: **always grep the whole codebase before swapping/deprecating
  any API**, never trust upstream audit counts without re-verifying. `PathDataListShim` (already in
  `core/path-method.js`) continues to handle remaining `pathSegList` consumers via delegation to
  native/polyfilled `getPathData`/`setPathData`. Test env switched to `path-data-polyfill` in 6
  vitest unit-test files; `path.test.js` gained a small local `SVGPathSeg` const for 2 numeric
  constants previously provided as pathseg globals. C3 additionally: swaps the vendored polyfill in
  `src/editor/tests/unit-harness.html` from `./vendor/pathseg/pathseg.js` to
  `./vendor/path-data-polyfill/path-data-polyfill.js` (Playwright browser-unit harness), updates
  `scripts/copy-static.mjs` to vendor `path-data-polyfill` instead of `pathseg` into
  `dist/editor/tests/vendor/`, and removes `pathseg` from `package.json` dependencies. Bonus
  cleanup: removed a redundant `setPathData(newPathData)` call in `coords.js` after
  `setAttribute('d', dstr)` that was destructively re-serializing the d attribute; dead
  `newPathData` array + push calls dropped too. Verified: lint clean, vitest 564/564 unchanged, e2e
  192 passed both browsers, build clean, manual cross-browser smoke clean (draw/save/reload,
  line↔curve toggle, clone-node + delete-node, mixed-syntax import via Source dialog).

### Added (path tool keys 2026-05-16)

- `feat(path): Enter completes path open, Escape cancels` — `document` keydown handler in
  `path-actions.js init()` filtered by mode + active drawing + input-focus. `finishPath()` requires
  ≥ 2 points; `cancelPath()` delegates to existing `clear()`. Existing double-click completion (two
  mousedowns at same point) unchanged. README gains `## Path tool keys` section. 4 new e2e tests (×2
  browsers = 8 runs).

### Fixed (i18n facade deep-merge 2026-05-16)

- `fix(locale): deep-merge in addResourceBundle facade (preserves base translation bundle)` —
  Surfaced during post-smoke re-verification: storage prefs dialog suddenly showed raw i18n keys
  (`notification.editorPreferencesMsg`, `common.ok`, `tools.remember_this_choice`, etc.) instead of
  resolved text. **Pre-existing bug** dating back to `e53209fe` (2026-04-30 English-only i18n
  strip): the `locale.js` i18next compatibility facade's `addResourceBundle` was doing flat
  overwrite (`bundles[ns] = dict`) instead of deep-merge. When ANY extension using
  `loadExtensionTranslation` (ext-opensave, ext-connector, ext-eyedropper, ext-shapes, ext-grid,
  ext-layer_view, ext-markers, ext-overview_window, ext-panning, ext-polystar) called
  `i18next.addResourceBundle(lang, 'translation', { extName: {...} }, true, true)`, the facade
  clobbered the entire `translation` bundle (`common`, `notification`, `tools`, `properties`, all
  extension namespaces) with just the calling extension's small dict. The bug was a race — if the
  storage dialog populated BEFORE any extension's bundle load, text was correct; if AFTER, raw keys
  leaked. Module reordering from this session's title-sweep commit (0edf763b) shifted the IIFE
  bundle's load order and surfaced the race in the visible direction.

- Fix: `locale.js` `addResourceBundle` now deep-merges (`bundles[ns] = deepMerge(bundles[ns] || {},
  dict)`) — matches the semantics extensions expect when they pass `deep=true, overwrite=true`.
  Sibling namespaces (`common`, `opensave`, `connector`, etc.) coexist in the bundle as intended.

- Verified: lint clean, vitest 564/564 unchanged, e2e 184 passed both browsers, manual cross-browser
  smoke confirmed dialog text restored.

### Fixed (post-smoke follow-ups 2026-05-16)

- `fix(opensave): call markSaved before handle.name access (handle is null on Firefox)` — Follow-up
  to the earlier Editor.markSaved fix (947fb64c). That commit called `svgEditor.markSaved()` AFTER
  `svgEditor.topPanel.updateTitle(handle.name)` inside the try block. `browser-fs-access` returns
  `null` on Firefox's download fallback (no File System Access API support), so `handle.name` threw
  TypeError — caught by the surrounding try/catch, swallowed to `console.error`, and `markSaved()`
  was never reached. Edge worked because the FileSystemFileHandle API path returns a real handle.
  Fix: reorder so `markSaved()` runs first (save succeeded either way), then guard the
  handle-dependent calls under `if (handle)`. Title still doesn't update on Firefox download flow
  (no file handle returned by the library) — pre-existing UX gap, separate concern. Surfaced by
  manual smoke after 947fb64c shipped.

- `chore(brand): sweep "SVG-edit" lowercase in HTML titles` — Follow-up to b772d46d's brand sweep.
  Original sweep used case-sensitive `SVG[- ]Edit` grep and missed 3 HTML `<title>` tags using
  lowercase 'e' (`index.html`, `iife-index.html`, `xdomain-index.html`). Tabs now show "svgedit" /
  "svgedit (IIFE)" / "svgedit (xdomain)". Out of scope: `tests/visual/rotation-recalc-demo.html`
  "SVG-Edit Bug" prose (internal test fixture, no user impact).

- Verified: lint clean, vitest 564/564 unchanged, e2e 184 passed + 0 skipped both browsers.

### Fixed (Firefox dirty-state on save 2026-05-16)

- `fix(editor): clear showSaveWarning on successful save (Editor.markSaved())` — Fixes the
  Firefox-surfaced "unsaved changes" beforeunload warning that appeared after a successful save
  (todo #10). Root cause: the `showSaveWarning` dirty flag was **never reset** after save — the
  comment at `EditorStartup.js:622` claiming otherwise was stale from upstream. The flag was only
  being set (`true` in `Editor.elementChanged` on every edit) but never cleared. Both Chrome and
  Firefox technically had the bug; modern Chromium browsers suppress the beforeunload prompt
  aggressively (post-2020 security change), masking it visually — Firefox honors `e.returnValue`
  strictly, so only Firefox showed the warning. Fix:

  - **`Editor.markSaved()`** — new accessor on the Editor instance that sets `showSaveWarning =
    false`. Centralized seam so save extensions can clear the dirty flag without reaching into
    internal state.

  - **`ext-opensave.js`** — calls `svgEditor.markSaved()` after `fileSave` resolves successfully
    (before `runExtensions('onSavedDocument', ...)`). Both `'save'` and `'saveas'` paths go through
    the same code, so both flows clear the flag. Save-cancellation (AbortError) doesn't clear the
    flag — dirty state is preserved as expected.

  - **`saveSourceEditor` NOT touched** — that's the in-memory Source-dialog flow (saving the
    textarea back to canvas), not a disk save; dirty state should remain.

  - **`EditorStartup.js:622` comment refreshed** — replaces the stale claim with an accurate
    description pointing at `markSaved()`.

- **Regression test:** new `tests/e2e/firefox-dirty-state-on-save.spec.js` with 2 tests verifying
  the dirty-flag lifecycle (force-dirty → markSaved → assert clean → force-dirty again → assert
  dirty) and idempotency. Both pass on Chromium + Firefox.

- Final e2e baseline: **184 passed, 0 skipped** (180 prior + 4 new). Vitest 564/564 unchanged. Lint
  clean.

### Fixed (coords.js Firefox closepath 2026-05-16)

- `fix(coords): handle uppercase 'Z' closepath + emit closepath in newPathData` — Fixes the
  Firefox-only crash logged as `test.fixme` during Step 1.5 (todo #10). Two independent bugs in
  `packages/svgcanvas/core/coords.js`:

  - **Read side (line 314):** `pathMap.indexOf(seg.type)` returned -1 for Firefox's native
    `getPathData()` segments with `seg.type === 'Z'` (literal source-case letter), because `pathMap`
    only contained lowercase `'z'`. The `continue` left a hole in `changes.d[]`, causing `seg is
    undefined` at line 384. Fix: normalize `'Z'` → `'z'` before the indexOf lookup (SVG spec treats
    Z and z as equivalent for closepath — no operands, no absolute/relative distinction).

  - **Write side (switch at line 439):** the switch building `newPathData` had no `case 1` for
    closepath, so closepath segments were silently dropped from `newPathData`. On Chromium this was
    harmless (no `setPathData` support → only `setAttribute('d', dstr)` runs and `dstr` correctly
    has `z`). On Firefox, `setPathData(newPathData)` re-serializes the d attribute and dropped the
    closepath, producing visually broken open paths from previously-closed shapes. Fix: add `case 1:
    newPathData.push({ type: letter, values: [] })`.

- **Test side cleanup:** removed the 2 `test.fixme(browserName === 'firefox', ...)` markers from
  `tests/e2e/unit/svgcore-{remap,recalculate}-extra.spec.js`. Also made path-d assertions in those
  tests format-tolerant — Firefox's native `setPathData` re-serializes with space separators (`M 3
  -1 L 8 ...`) while Chromium preserves the comma/concise format svgedit writes (`M3,-1 L8,-1 ...`).
  Both are valid SVG path data syntax; tests now normalize to a canonical form before asserting key
  segments.

- Final e2e baseline: **180 passed, 0 skipped** on 180 attempted (Chromium 90 + Firefox 90). Vitest
  564/564 unchanged. Lint clean.

### Changed (brand sweep 2026-05-16)

- `chore(brand): sweep remaining "SVG-Edit"/"SVG Edit" → "svgedit"` — Step 1's brand pass caught the
  MainMenu label + URLs + `clear.js` generator string. Manual cross-browser smoke against Step 1.5
  surfaced the storage preferences dialog still using the old name. Single-commit follow-up sweep
  across 16 active sites:

  - **4 user-visible strings:** storage prefs dialog body (2 occurrences in
    `ext-storage/locale/en.js` + duplicate in `locale/lang.en.js` `editorPreferencesMsg`), Help-menu
    homepage label (`editor_homepage`), storage dialog `aria-label`.

  - **11 code / JSDoc comments:** triplicate `// only track keyboard shortcuts for the body
    containing the SVG-Editor` (`Editor.js`, `seButton.js`, `seMenuItem.js`); extension header
    comments (`ext-storage.js`, `ext-panning.js`); JSDoc in `ConfigObj.js` + `svgcanvas.js`;
    `EditorStartup.js` opener-signal comment; `unit-harness.html` `<title>`.

  - **`svg-exec.js:78` reworded** (not just renamed): `// Keep SVG-Edit comment on top` → `// Keep
    generator comment on top`. The literal generator string in `clear.js:51` is "svgedit" since Step
    1; the comment was identifying which comment-text to hoist on save — now tracks current
    behavior.

  - **Out of scope:** 10 `src/editor/images/*.svg` XML attribution comments (defensible historical
    attribution; tracked under `todo_svgedit.md` #10).

  - Verified: lint clean, vitest 564/564 unchanged, e2e 178 passed + 2 skipped on both browsers,
    build clean. No code logic touched.

### Changed (browser-compat investigation 2026-05-16)

- `feat(test): browser-compat investigation (Step 1.5 of 5)` — Multi-browser Playwright setup + 4
  regression tests verifying the 4 audit-flagged browser-bug workarounds; 5-commit PR
  (`feat/browser-compat-investigation`) on safety tag `pre-compat-investigation`.

  - **Multi-browser Playwright:** Added Firefox project to `playwright.config.mjs` alongside
    Chromium. By default all e2e tests run on both browsers (162 → 180 attempted runs after the new
    tests land). `scripts/run-e2e.mjs ensureBrowser()` extended to auto-install Firefox to the
    project-local cache via a new version-prefix-agnostic `isBrowserInstalled(prefix)` helper.

  - **Existing-test Firefox failures:** 4 surfaced when Firefox was first added. 2 fixed as
    test-infra quirks (`tests/e2e/unit/svgcore-touch.spec.js` — added `test.use({ hasTouch: true })`
    so Firefox desktop exposes `TouchEvent`/`Touch` constructors in `page.evaluate`). 2 marked
    `test.fixme(browserName === 'firefox', ...)` for a confirmed source bug:
    `packages/svgcanvas/core/coords.js` `getPathData()` branch skips uppercase `'Z'` segments
    because `pathMap` only contains lowercase `'z'`, leaving holes in `changes.d[]` that crash at
    coords.js:384. Chrome avoids it via the pathSegList polyfill (numeric segment types). Logged to
    `todo_svgedit.md` #10 as a follow-up correctness fix.

  - **4 new browser-compat tests** in `tests/e2e/browser-compat-*.spec.js` (9 tests total, all pass
    on both browsers WITH and WITHOUT the workarounds in place — that's the verification):

    - `canvasbg-overflow` (Site 1: `select.js:423` — Chrome 7 zoom-out overflow bug)
    - `gradient-detect` (Site 2: `svg-exec.js` `convertGradientsMethod` — WebKit `*Gradient`
      selector fallback)

    - `import-gradients` (Site 3: `svg-exec.js:503-512` — Firefox 353575 root-level
      gradients/patterns)

    - `import-symbol-gradients` (Site 4: `svg-exec.js:712-722` — Firefox 353575 inside `<symbol>`)
  - **Workaround outcomes (per site):**
    - Site 1: **DROPPED** — `overflow: 'visible'` hardcoded; 4/4 tests pass on Chromium + Firefox
      without the `isWebkit()` ternary.

    - Site 2: **DROPPED** — `querySelectorAll('linearGradient, radialGradient')` works directly on
      both browsers; the WebKit `*Gradient` tagName fallback is no longer needed.

    - Site 3: **DROPPED** — Firefox 353575 no longer reproduces; root-level
      gradients/patterns/radialGradients render correctly without being moved into `<defs>`.

    - Site 4: **DROPPED** — same as Site 3 for the symbol/use import path. Orphaned `const defs =
      findDefs()` local removed alongside the deleted block.

  - **`isWebkit()` in `packages/svgcanvas/common/browser.js`: DROPPED entirely** — getter + export
    both removed; grep confirms zero remaining consumers in active code. Dead `isWebkit` import
    dropped from `select.js`.

  - **`isGecko()` KEPT** — 3 unrelated consumers in `selected-elem.js` + `undo.js` (separate Firefox
    workarounds NOT in Step 1.5 scope). Dead `isGecko` import dropped from `svg-exec.js` (both
    353575 sites in that file are now gone).

  - **Net source change:** -49 lines across `select.js`, `svg-exec.js`, `common/browser.js` (4
    workaround drops + helper removal + orphan-local cleanup + import tidy).

  - Final e2e baseline: Chromium 90 + Firefox 88 passing + 2 fixme skipped = 180 attempted, 178
    passed, 0 failed. Vitest 564/564 unchanged. Lint clean.

### Changed (pre-migration cleanup 2026-05-16)

- `chore: pre-migration cleanup (Step 1 of 5)` — Mechanical execution of `docs/AUDIT_2026-05-16.md`
  § "Pre-migration deletions" + § "Brand / attribution updates" + two verify-then-delete duplicate
  purges, plus three textual fixes folded from todo #10. 8 commits across one PR
  (`feat/pre-migration-cleanup`).

  - **Deletions:** `src/editor/browser-not-supported.{js,html}` (dead universal-SVG-support check);
    `src/editor/extensions/ext-helloworld/` extension (tutorial/demo, no product value);
    `window.widget` KaiOS/Apple-Dashboard branches in `ConfigObj.js` + `ext-storage.js`; IE6
    detection + filters in `jQuery.jPicker.js`; commented-out jQuery effects in `jQuery.jPicker.js`;
    Opera-bug commented block + `if (window.opera)` branch in `path-actions.js`; MathML allowlist
    (31 entries) + Optimistik `oi:` namespace handling in `sanitize.js`; dead `XMLHttpRequest` in
    `seExplorerButton.js`; commented-out namespaces (SODIPODI/INKSCAPE/RDF/OSB/CC/DC) in
    `namespaces.js`.

  - **Brand updates:** SVG-creator comment URL in `clear.js`; `homePage` constant + main menu label
    in `MainMenu.js`; workspace `packages/svgcanvas/package.json` repository URLs + author +
    contributors (audit-of-audit follow-up — the earlier brand-update commits `cc52a542` +
    `9ffd9f5c` missed the workspace package.json; all → `bilbospocketses/svgedit`).

  - **Textual fixes (folded from todo #10):** `seExplorerButton.js:134` HTML syntax error
    (`class="image-lib""` → `class="image-lib"`); `seZoom.js:78` missing CSS semicolon
    (`position:fixed` → `position:fixed;`); `ext-connector.js:240` comment typo (`startss` →
    `starts`).

  - **Verify-then-delete duplicates:** `Editor.js:438-456 getParents` (dead — no external callers;
    deleted). `path.js:633-786 convertPath` deletion **ABORTED**: Step 1 execution discovered the
    audit's B4a "duplicate" finding was wrong. The two `convertPath` implementations have
    incompatible APIs (numeric `pathSegType` + `pathMap` vs. `pathSegTypeAsLetter` letter strings)
    and `tests/unit/path.test.js` imports BOTH for equivalence validation. Audit doc corrected;
    clarifying note added to `path.js` to prevent re-audit cycles.

  - **MathML support dropped** alongside the allowlist removal — `tests/unit/test1.test.js`'s "Test
    import math elements inside a foreignObject" test removed (asserts obsolete behavior). New
    vitest baseline: **564 passing** (was 565).

  - **Known follow-up dead code** (NOT in this PR; will be caught by Step 3 TS migration
    `noUnusedLocals` or a dedicated code-quality PR): `NS.MATH` in
    `packages/svgcanvas/core/namespaces.js` line 15, and `NS.MATH` usage in
    `packages/svgcanvas/core/selection.js:161`.

  - Verified: 564/564 vitest + 81/81 e2e + `standard` lint clean at every commit.

### Added (pre-migration audit 2026-05-16)

- `docs(audit): comprehensive pre-migration codebase audit` — Big-bang exhaustive walk through 102
  files across 9 areas (canvas core, editor UI, web components, extensions, scripts, packages,
  tests, vendored libs, build/config). Per user directive: "no quick fixes, as thorough as we can be
  to make sure we get it all on the first run, regardless of how long that takes." Output
  `docs/AUDIT_2026-05-16.md` captures: per-area verdicts (99 KEEP / 2 DELETE / 1 REVIVE), 11 real
  bugs surfaced (cmenuDialog `screen.*` typo, three missing `super.attributeChangedCallback`,
  contextmenu `appendChild(string)`, Editor.js i18n typo, two LayersPanel UI bugs, two
  jQuery.jPicker jQuery-on-DOM misuses, seExplorerButton HTML syntax + dead XMLHttpRequest, seZoom
  stray CSS semicolon, ext-overview_window `evt.originalEvent`), migration architectural decisions
  (PathDataListShim already covers `pathSegList`; 8 `createSVGPathSeg*` direct calls in
  `path-actions.js` need refactor to `setPathData` before `pathseg` can be dropped; jgraduate stack
  disposition deferred to elix→Lit brainstorming; multi-unit mode dropped as out-of-scope;
  HTML-in-foreignObject promoted to new authoring feature; MathML/Optimistik dropped), embed-API
  design inputs (12 candidate surfaces), naming consistency cleanup list, full decisions log. 99
  KEEP / 2 DELETE (`browser-not-supported`, `ext-helloworld`) / 1 REVIVE (`ext-overview_window`).
  Drives the JS→TS migration brainstorm (#2 in backlog) and the elix→Lit migration brainstorm (#3).

### Fixed (audit-of-audit corrections 2026-05-16)

- `docs(audit): re-audit corrections — fix counts, citations, framing` — Read-only verification pass
  on `docs/AUDIT_2026-05-16.md` against the actual codebase surfaced 12 issues, all resolved in this
  edit:

  - **Pathseg site count + enumeration** — audit text said "8 sites" but listed only 7 line numbers;
    actual is 8. Added missing site at `path-actions.js:1235` (inside the `fixEnd` block adjacent to
    the `// Can this be done better?` comment) to both audit doc and `todo_svgedit.md` #6.

  - **MathML allowlist count** — `sanitize.js:83-114`: corrected 28 → 31 entries (line range was
    right; count was wrong).

  - **`Editor.js:439-456 getParents` framing** — was characterized as a "name collision with
    `common/util.js:getParents`"; verified `Editor.js` does NOT import the util `getParents` (only
    `getParentsUntil`), so there's no lexical scope shadow. Reframed in todo as "verify-then-delete
    duplicate; likely dead code (no external `editor.getParents()` callers found)".

  - **Native `prompt()`/`alert()` site count** — claim of "8 sites" undercount. Actual: 9 sites in
    panels alone (TopPanel.js: 169, 623, 696; LayersPanel.js: 95, 103, 138, 146, 193, 201) plus
    `jQuery.jGraduate.js:195` and `ext-helloworld.js:77` (latter moot once extension is deleted).
    Updated audit doc + todo to enumerate sites explicitly.

  - **Off-by-one line citations corrected** in 6 places across audit + todo:
    `jQuery.jPicker.js:1296` → `:1292` (`.prev()` location); `seZoom.js:79` → `:78` (missing
    semicolon belongs at end of `position:fixed` line, not the next line); `svgcanvas.js:432` →
    `:433` (`canDeleteNodes` assignment, line 432 is the `// TODO: Correct this:` comment);
    `ext-connector.js:241` → `:240` (`startss` typo); `EditorStartup.js:682, 705, 741` → `:683, 706,
    742` (the `console.error` calls; cited lines were the preceding `// Todo` comments).

  - **TopPanel.js panels-lookup investigation** — todo entry said "missing polyline/polygon";
    updated to also note `path` is missing (likely intentional since path-edit is a separate mode,
    but verify).

  - **`super.attributeChangedCallback()` bug entry annotation** — added context that the same call
    is correctly commented-out in 4 sibling dialogs (`cmenuDialog.js:139`,
    `cmenuLayersDialog.js:77`, `storageDialog.js:105`, `exportDialog.js:76`); the fix for the 3
    problem sites is to comment-out or delete the same way.

  - **Open decisions section added to audit's Decisions log** — captures decisions surfaced by the
    audit but deferred to brainstorming: TS strict-mode level, linter swap, wire-methods resolution,
    `path.js` mutable export, `SelectModule` singleton, jgraduate stack disposition, plus the two
    duplicate-code verify-then-delete items. Gives #2/#3 brainstorms a clean kickoff checklist.

  - **Pre-migration deletion ordering note** added to pathseg-drop step —
    `scripts/copy-static.mjs:22` shifts to line 20 if the `browser-not-supported` deletions land
    first; find by content not line number.

  - **Area G "Files" column note** — clarified that 12 reflects extension *units* (one per folder),
    not raw `.js` files (which is higher when locale shims, `dragmove/` subfolder, and
    `storageDialog.js` are counted individually). Total 102 sums consistently against this
    convention.

  - **Rulers.js cleanup citation** — full path `src/editor/Rulers.js` used in the cleanup checklist
    (file is at top-level `src/editor/`, not `src/editor/panels/`; preventing search confusion).

  - **EditorStartup.js extension-error embed-API input** — line numbers updated and clarified as the
    `console.error` lines (the preceding `// Todo` comments are at 682, 705, 741).

- No code changes. Documentation-only pass. Breadcrumb at top of `todo_svgedit.md` updated to
  reflect that re-audit is complete and #2 brainstorming is starting.

### Added

- `CHANGELOG.md` (this file).
- `_reference/embed-api-v6/` — preserved V6-era embed API source as design input for the upcoming
  V7+ embed API.

### Changed (audit follow-up 2026-04-30)

- `chore: post-housekeeping audit follow-ups` — Three flags surfaced by an outside-eyes audit pass:
  - `package.json` `repository.url`, `bugs.url`, and `homepage` updated from `SVG-Edit/svgedit` to
    `bilbospocketses/svgedit` so npm-derived "report bug" / "view repo" links land on the fork
    rather than upstream.

  - `.gitignore` adds `.claude` so per-repo Claude Code session settings don't show up as untracked.
  - `docs/` half-strip cleaned up: deleted `Accessibility.md` (upstream a11y test setup),
    `Acknowledgements.md` (overlaps with README credits and references deps already removed),
    `Contributing.md` (upstream commit-prefix conventions for upstream PR pipeline; fork takes no
    PRs), `Development.md` (upstream submodule + GH Pages deploy flow), `ReleaseInstructions.md`
    (referenced deleted `npm run version-bump` and `CHANGES.md`), and
    `docs/versions/{3,4,5,6}.0.0.md` (upstream historical version notes; fork started at v7.4.1).
    README repo-layout table updated to reflect surviving `docs/tutorials/`.
    `FrequentlyAskedQuestions.md` "How can I help?" Q&A removed (linked to deleted `Testing.md` +
    `ReleaseInstructions.md`).

- `chore(package): set author to fork owner; drop upstream contributors list` — `package.json`
  `author` updated from "Narendra Sisodiya" (upstream creator) to `Jamie Chapman
  <jamie@boxtechs.com>` (fork owner). `contributors` array dropped entirely — the README credits
  section already preserves upstream attribution; npm `contributors` is for active package
  contributors, not historical inheritance, and a personal fork accepting no PRs has none. Inherited
  multi-license string preserved unchanged.

### Changed (README)

- `docs(README): rewrite for fork — drop upstream branding` — Per scope directive §1. Replaced
  upstream README content (Netlify deploy links, npm publish flow, CodeQL/Snyk badges,
  `svg-edit.github.io` logo, "we want contributors" sections, Sample-React-extension instructions)
  with fork-appropriate content: status banner ("personal fork, no upstream tracking"),
  scope-directive bullet list, run commands, repo layout table, embedding-planned section pointing
  at `_reference/embed-api-v6/`, credits + inherited license note. Aimed at someone landing on this
  repo cold and needing to know "what is this fork doing differently and how do I run it."

### Changed

- Enforced LF line endings repo-wide via `.gitattributes` (commit `838716ea`).
- `.gitignore` rewritten — dropped dead entries (Cypress, react-extensions react-test path, NYC,
  instrumented, `ignore`), added `.vs/`.

- `package.json` slimmed: dropped `react-test` workspace, JSDoc generator pipeline, npm-publish
  scripts, remark markdown linter, `nyc`, `rimraf`, `open-cli`, `npm-run-all`.

### Removed

- `archive/` directory (V6 examples, old wiki content, screencasts, untested extensions). V6
  embed-api preserved in `_reference/`.

- Upstream-deploy artifacts: `composer.json`, `netlify.toml`, `lgtm.yml`, `licenseInfo.json`,
  `CHANGES.md` (67KB upstream history), `publish.md`, root `FUNDING.yml`.

- `.github/` directory in full (FUNDING, ISSUE_TEMPLATE, pull_request_template, comment-template,
  workflows including codeql, npmpublish, on-push, on-PR). Will be re-added with our own CI when
  needed.

- `scripts/publish.mjs`, `scripts/version-bump.mjs` — no npm publishing for this fork.
- `packages/react-test/` — no React in this project.
- JSDoc generator pipeline (`docs/jsdoc-config.js`, `docs/layout.tmpl`, `jsdoc` devDep, `build-docs`
  / `open-docs` / `test-build` scripts). Public API will be documented via hand-written
  `EMBED_API.md`.

- `nyc.config.js` — orphaned after `nyc` devDep removal.

### Fixed

- `fix(scripts): rewrite scripts/run-e2e.mjs without nyc/rimraf` — housekeeping pass removed both
  deps but left them as live calls in the e2e runner. Replaced with native `node:fs/promises`;
  dropped vestigial `seedNycFromVitest` and `npx nyc report` steps; dropped `COVERAGE` env /
  `__coverage__` rebuild check (vitest's v8 coverage is the live coverage path). Also fixed
  pre-existing Windows incompatibility — `spawn('npx', …, { shell: false })` failed with `ENOENT`
  because `npx`/`npm` are `.cmd` shims; now `shell: process.platform === 'win32'`. Verified
  end-to-end: 81/81 e2e tests pass in 25.5s on Windows.

### Added (locale shim)

- `feat(locale): English-only — drop i18next, replace locale.js with native shim` — Per scope
  directive (§5: strip localization). New `src/editor/locale.js` (70 lines) provides a tiny `t(key,
  vars)` runtime supporting dotted keys (`'foo.bar'`), namespace lookups (`'ns:foo.bar'`), and
  `{{var}}` interpolation. Exposes an `i18next`-compatible facade with `.t()` and
  `.addResourceBundle()` so all 195 existing callsites across `src/editor/` and the 11 default
  extensions stay unchanged. `putLocale()` simplified to a no-op returning `{ langParam: 'en',
  i18next: facade }`.

- `tests/locale.test.js` rewritten — 7 tests covering the shim contract (dotted lookup, namespace,
  interpolation, missing-key key-fallback, defensive non-string handling, post-`addResourceBundle`
  namespace lookup).

### Changed (locale shim)

- `Editor.js` — `goodLangs` array trimmed from 23 entries to `['en']`. `EditorStartup.js` callsite
  unchanged (the new `putLocale` ignores its args).

### Removed (locale shim)

- `i18next` runtime dependency (was 25.7.4).
- 57 root locale files
  (`src/editor/locale/lang.{af,ar,az,be,bg,ca,cs,cy,da,de,el,es,et,fa,fi,fr,fy,ga,gl,...}.js`) —
  only `lang.en.js` retained.

- 46 extension locale files across 10 extension dirs
  (`ext-{connector,eyedropper,grid,helloworld,layer_view,markers,opensave,panning,polystar,shapes}`)
  — only each extension's `en.js` retained.

## Fork point

Forked 2026-04-23 from [SVG-Edit/svgedit v7.4.1](https://github.com/SVG-Edit/svgedit) via
`bilbospocketses/svgedit`. No upstream tracking; this is a one-time starter base.
