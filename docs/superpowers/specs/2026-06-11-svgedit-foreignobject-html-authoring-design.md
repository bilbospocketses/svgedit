# #9 — foreignObject HTML Authoring (rich-text-in-SVG) (design spec)

- **Date:** 2026-06-11
- **Status:** Approved (brainstorm) → ready for implementation plan
- **Backlog item:** todo_svgedit #9 (HTML-in-foreignObject authoring interface).
- **Builds on:** M1 design tokens, M2 theming, M3 `SePromptDialog` (the dialog template + the `sePrompt` helper this feature reuses for link URLs), M4 icon/mask pipeline (for the new tool glyph).

## 1. Context & problem

svgedit already **imports** HTML-in-`foreignObject`: `sanitize.ts` whitelists `foreignObject` plus 16 block-level HTML tags (`div p li pre ol ul span hr br h1–h6`), and the canvas treats a `foreignObject` as a first-class **selectable/resizable** element (sized like a `rect` in `event.ts`, present in `visElems`). But there is **no authoring UI** — a user cannot create or edit foreignObject HTML content from inside the editor; it is import-only.

This feature adds a **rich-text authoring dialog** so users can place a box of formatted HTML (headings, lists, bold/italic/underline/strikethrough, links, color, alignment, font size) onto the drawing alongside vector shapes — for annotations, callouts, and formatted labels in diagrams.

The **central technical problem** is the sanitizer. The current `sanitize.ts` is built for SVG: for HTML elements it (a) whitelists only block tags — no inline formatting tags (`strong/em/u/s`) — and (b) strips inline CSS entirely (it rewrites `style` into XML presentation attributes from each element's attr-allowlist, and HTML elements have none of `color`/`font-size`/`text-align` there). So today, any rich styling on foreignObject content is silently destroyed on the save→load round-trip. Supporting a rich editor **requires a deliberate, security-reviewed sanitizer extension**, co-designed with the editor so the two agree exactly.

## 2. Goals / non-goals

**Goals (v1)**
- A new left-panel **"Insert HTML"** tool that creates a `foreignObject` by drag-to-draw, then opens a themed modal editor.
- A **`SeForeignHtmlDialog`** Lit component (modal, native `<dialog>`, `--se-*` tokens) with a hand-rolled `contenteditable` WYSIWYG surface + a `</>` **HTML source** toggle.
- v1 toolbar: **Normal/H1/H2/H3**, **bold/italic/underline/strikethrough**, **bulleted & numbered lists**, **link**, **text color**, **alignment (L/C/R)**, **font-size presets (S/M/L/XL)**, **clear formatting**.
- A **namespace-branched HTML sanitizer extension** with an exported allowlist shared with the editor (co-design), plus link/security hardening.
- **Double-click to edit** an existing foreignObject; **undo/redo** via svgedit history; **save→reload round-trip** preserved.
- Unit + e2e coverage; passes eslint + hex-guard.

**Non-goals (deferred to phase 2+ / out of scope)**
- **Tables**, **text highlight / background-color**, **font-family**, **embedded images** inside the HTML (svgedit already has an image tool). The sanitizer/editor are structured so these slot in later without rework.
- **In-place (on-canvas) editing** — explicitly rejected in brainstorm (fights svgedit's selection/zoom/transform; buggy caret in transformed SVG). The modal is the editor.
- **Embed-host control** of the dialog (the `#4`/`#5` embed surface) — v1 works in the standalone editor only.
- **i18n** — English hardcoded, matching M3 (`seConfirm`/`SePromptDialog` precedent).
- **Validation framework** in the editor beyond sanitize — sanitize is the contract.

## 3. Locked decisions (from brainstorm)

1. **Scope = rich word-processor**, delivered against the v1 toolbar above; tables/highlight/font-family/images deferred.
2. **Interaction = modal Lit dialog** (M3 `SePromptDialog` pattern), not in-place.
3. **Build = hand-rolled `contenteditable` + thin command layer + source toggle; zero new dependencies.** Owning the emitted HTML is what makes the sanitizer co-design tractable — a 3rd-party RTE would put an uncontrolled markup generator on the wrong side of the sanitize boundary.
4. **Sanitizer = namespace-branched HTML allowlist** (tags + filtered CSS properties); the SVG path is left **byte-for-byte unchanged**; the allowlist is **exported** and imported by the editor's serialize layer (single source of truth).
5. **Placement = drag-to-draw → dialog** (zero/tiny drag = default **240×120**); **Cancel on a new box removes it**; **empty-on-OK deletes the box**.
6. **Sizing = keep drawn width, auto-fit height on author**, then freely resizable via existing handles.
7. **Paste = text-only** — intercept `paste`, insert `clipboardData` plain text only; all pasted markup is stripped.
8. **Links** — schemes limited to `http/https/#fragment/relative` (**no `mailto:`**); every link forced `target="_blank" rel="noopener noreferrer"`.
9. **Undo/redo** via svgedit history commands; **element mutation + history live in `svgcanvas`**, editor side is orchestration-only.

## 4. Architecture

### 4.1 `SeForeignHtmlDialog` — new Lit component (`src/editor/dialogs/SeForeignHtmlDialog.ts`, element `se-foreign-html-dialog`)

Mirrors `SePromptDialog`'s shape — native `<dialog>`, open shadow DOM, `static styles = css\`\``, imperative open/`whenClosed` API, `<form method="dialog">` body — adapted for a rich editor.

**Public/imperative API (consumed by the `seForeignHtml` helper):**
```
@property() accessor value = ''     // initial HTML for edit mode ('' = new/empty)
get opened(): boolean
open(): void                        // append-if-disconnected → showModal → focus the editor
close(): void
whenClosed(): Promise<{ html: string | null }>   // serialized XHTML string on OK, null on Cancel/Esc
```

**Render structure:** title (`Insert / Edit HTML`) → **toolbar** (buttons + the `</>` source toggle) → **`contenteditable` region** (the WYSIWYG surface) → hidden **source `<textarea>`** (shown when toggled) → footer with `Cancel`/`OK` submit buttons. The component holds UI state only (which mode is showing, current toolbar state) and delegates all HTML logic to `foreign-html-commands.ts` / `foreign-html-serialize.ts`.

**Close semantics:** OK (`value="ok"`) → resolve `{ html: serialize(editorRoot) }`; Cancel/Esc → `{ html: null }`. On OK, if the serialized content is empty (no text, no meaningful elements), resolve `{ html: '' }` — the controller treats `''` as "delete the box" (§5). Source-mode: on OK or on toggling back to WYSIWYG, parse + sanitize the textarea; if non-empty input sanitizes to empty, **`seAlert` a warning and keep the dialog open** (never silently discard).

**Paste:** an `@paste` handler on the `contenteditable` calls `preventDefault()` and inserts `event.clipboardData.getData('text/plain')` at the caret (text-only, decision §3.7).

**Styling (tokens only; passes hex-guard):** dialog/`::backdrop` reuse the `SePromptDialog` rules; toolbar buttons and the editor surface use `--se-surface*`, `--se-border*`, `--se-text`, `--se-radius-sm`, `--se-font-sans`, `:focus-visible { outline: 2px solid var(--se-focus-ring) }`. The **color picker presets** are content values (the colors the user can apply), not chrome — they live in a TS constant consumed at render, kept out of the hex-guard's CSS scope (plan-time: confirm the guard only scans `.css`/`css\`\`` and not this TS array; if needed, route presets so the guard does not flag them). `::part` hooks (`part="toolbar"`, `part="editor"`, `part="button"`) for embed-theming parity.

**Lit conventions** (`docs/superpowers/conventions/lit-component-conventions.md`): `@customElement` + `@property() accessor` (the `accessor` keyword is required — bare fields → TS1240/1270); open shadow DOM; `static styles = css\`\``; class-field-arrow event handlers (avoids `unbound-method`); file-per-component `PascalCase.ts` in `src/editor/dialogs/`. English hardcoded (no in-component `t()`).

### 4.2 `foreign-html-commands.ts` — pure command layer (`src/editor/dialogs/foreign-html-commands.ts`)

Pure functions operating on a root `Element` (the contenteditable) via the `Selection`/`Range` API, **emitting only allowlisted markup**. No canvas/Lit deps → unit-testable in jsdom.

```
toggleInline(root, tag)            // 'strong' | 'em' | 'u' | 's' — wrap/unwrap the selection
setBlock(root, tag)                // 'p' | 'h1' | 'h2' | 'h3' — retag the selected block(s)
toggleList(root, kind)             // 'ul' | 'ol'
insertLink(root, url)              // wrap selection in <a href target=_blank rel="noopener noreferrer">; url pre-validated
setColor(root, cssColor)           // wrap selection span style="color:…"
setAlign(root, value)              // 'left'|'center'|'right' → block style="text-align:…"
setFontSize(root, preset)          // 'S'|'M'|'L'|'XL' → span style="font-size:…px"  (M = remove/inherit)
clearFormatting(root)              // unwrap inline tags + strip style on the selection
```

Deliberately **not** blind `document.execCommand` — execCommand emits browser-specific, non-allowlisted markup (`<font>`, `<b>`, inline `style` soup). We wrap the selection ourselves so output is predictable and sanitizer-clean. (Where execCommand's *behavior* is convenient and its output is allowlisted, e.g. list toggling, it may be used then normalized — a plan-time call per command.)

**Font-size presets:** `S=12px, M=inherit (no span), L=24px, XL=36px` (tunable; M = "remove explicit size").

### 4.3 `foreign-html-serialize.ts` — pure DOM↔string (`src/editor/dialogs/foreign-html-serialize.ts`)

```
serialize(root: Element): string   // editor DOM → '<div xmlns="http://www.w3.org/1999/xhtml" class="se-fo-root">…</div>'
deserialize(html: string): DocumentFragment   // existing foreignObject child → editor DOM for edit mode
```

`serialize` wraps content in the **XHTML-namespaced root** (so it renders in the foreignObject **and** lands in the HTML sanitize branch on reload) and runs the **shared allowlist** (imported from `sanitize.ts`, §4.4) as a pre-injection filter — belt-and-suspenders with the canvas-side sanitize backstop. Imports the tag + CSS-property allowlists from `sanitize.ts` so editor output and sanitizer can never drift.

### 4.4 `sanitize.ts` extension (`packages/svgcanvas/core/sanitize.ts`)

**Detection:** at the top of `sanitizeSvg(elem)`, branch on `elem.namespaceURI === NS.HTML` → run `sanitizeForeignHtml(elem)`; otherwise the **existing SVG code runs unchanged** (the high-stakes path is untouched; this also resolves the `a`/`title`/`style` shared-tag-name ambiguity, since those differ only by namespace). Text-node cleanup stays shared.

**`sanitizeForeignHtml` rules (exported constants drive both this and the editor):**
- **`FOREIGN_HTML_TAGS`** (v1): `div span p h1 h2 h3 h4 h5 h6 ul ol li pre hr br strong em u s b i sub sup a blockquote`. Unknown tag → unwrap (promote children), same as the SVG-side behavior.
- **`FOREIGN_HTML_ATTRS`**: `class`, `id`, `style` (filtered); `a` additionally `href`, `target`, `rel`. Everything else removed — `on*` handlers fall out here (with an explicit test asserting it).
- **`FOREIGN_STYLE_PROPS`** (filtered inline `style`, **preserved** rather than mapped to attrs) v1: `color text-align font-size font-weight font-style text-decoration list-style-type`. Phase 2 adds `background-color font-family`. Any other property dropped; any value containing `url(` or `expression(` (case-insensitive) dropped.
- **Link hardening:** validate `href` scheme — allow `http:`/`https:`/`#fragment`/relative (no scheme); reject `javascript:`/`data:`/`vbscript:`/`mailto:` (strip the attr / unwrap). Force `target="_blank"` and `rel="noopener noreferrer"` on every surviving `<a>`.

**Idempotence:** toolbar-authored content already conforms, so it passes sanitize unchanged and round-trips byte-stable; sanitize is the backstop for pasted/source/imported content.

### 4.5 `svgcanvas.ts` + `event.ts` — canvas integration

- **`svgcanvas.ts`** new method **`setForeignContent(elem, htmlString)`**: replaces the foreignObject's child with the (already-sanitized) XHTML root, **auto-fits height** (measure rendered content at the element's width, set `height`), and wraps the mutation in a history **`BatchCommand`** (`ChangeElementCommand`/`InsertElementCommand`) so undo/redo and save/embed see a normal element. Plus the `foreign` mode element creation (mousedown → create empty `foreignObject` with a namespaced empty root, like `rect`).
- **`event.ts`**: finish the dormant `foreign` mode — mousedown creates + mousemove sizes the box (the `foreignObject` cases at ~419 & ~833 already size like `rect`); **mouseup → invoke the controller** (open dialog for the new box). Add **double-click on a `foreignObject`** (select mode) → controller opens the dialog preloaded with current content.

### 4.6 Editor glue (`globalDialogs.ts`, `LeftPanel.*`, controller)

- **`globalDialogs.ts`**: add `seForeignHtml(initialHtml = ''): Promise<string | null>` (mirrors `sePrompt`) + `window.seForeignHtml` decl + `import './SeForeignHtmlDialog.js'` (the `@customElement` side-effect registers the element). Add the ambient decl to `src/editor/global-dialogs.d.ts`.
- **`LeftPanel.html`**: new `tool_foreign` button with a text-box glyph (per the **M4 icon/mask pipeline**). **`LeftPanel.ts`**: `clickForeign()` → `updateLeftPanel('tool_foreign')` → `svgCanvas.setMode('foreign')`; wire in `init()`.
- **Controller** (thin method on `src/editor/Editor.ts`, or a small `src/editor/foreignHtml.ts` registered at init): orchestrates **mode-complete / dbl-click → `seForeignHtml(html?)` → `sanitizeSvg` backstop → `svgCanvas.setForeignContent` (or delete on empty/cancel)**. The only place the UI and canvas meet; keeps both sides thin.

The new link command reuses **`sePrompt`** (M3) to ask for the URL, then validates the scheme before `insertLink`.

## 5. Data flow

- **Insert:** click `tool_foreign` → `setMode('foreign')` → drag (event.ts creates+sizes the `foreignObject`; click → default 240×120) → mouseup → `seForeignHtml('')` → author (commands mutate the contenteditable; or source mode) → **OK** → `serialize()` → XHTML string → `sanitizeSvg` backstop → `setForeignContent(elem, html)` (+height auto-fit +history). **Empty on OK** → controller deletes the box. **Cancel** → controller removes the empty box.
- **Edit:** dbl-click `foreignObject` → `deserialize(child.innerHTML)` into the editor → `seForeignHtml(currentHtml)` → **OK** → sanitize → `setForeignContent` (ChangeElement command). **Cancel** → unchanged.
- **Round-trip (the load path):** save → SVG source (XHTML-namespaced child) → reload/`setSvgString` → parse → `prepareSvg` → **`sanitizeSvg`** (HTML branch) → identical content (co-design guarantees idempotence). This is the critical integration invariant.

## 6. Testing strategy

Repo split: **e2e (Playwright, both browsers) is authoritative for modal + canvas interaction** (jsdom `<dialog>.showModal()` is unreliable); unit tests cover pure logic.

- **Unit (vitest/jsdom):**
  - **`sanitize` HTML branch** — round-trip idempotence (authored HTML in → identical out); tag allowlist (`strong` survives, `<script>`/unknown unwrapped); CSS-property filter (`color`/`text-align`/`font-size` kept, others dropped; `url()`/`expression()` screened); **security** (`javascript:`/`data:`/`mailto:` href rejected; `onclick` stripped; `target="_blank" rel="noopener noreferrer"` forced); **regression tests proving the SVG path is unchanged** (a representative SVG sanitizes identically pre/post change).
  - **`foreign-html-commands`** — each command emits correct allowlisted markup on a jsdom root; toggle on/off; partial-selection; clearFormatting.
  - **`foreign-html-serialize`** — DOM→string→DOM round-trip; XHTML namespace present on the root; allowlist pre-filter applied.
- **e2e (`tests/e2e/`):** insert flow (tool → drag → dialog → author bold/heading/list/link/color → OK → foreignObject present with expected content); edit flow (dbl-click → preloaded → change → OK); **cancel removes empty box**; source toggle; undo/redo (insert→Ctrl+Z removes; edit→undo restores); and **the critical `author → save → reload → content identical` round-trip**.
- **Lint:** `npm run lint` — new files pass `lint:hex` (tokens only) + `tests/unit/design-tokens.test.ts`; markdownlint for this spec / CHANGELOG.

## 7. Files touched

**New**
- `src/editor/dialogs/SeForeignHtmlDialog.ts` — Lit dialog (`se-foreign-html-dialog`)
- `src/editor/dialogs/foreign-html-commands.ts` — pure command layer
- `src/editor/dialogs/foreign-html-serialize.ts` — pure DOM↔string + namespace + allowlist prefilter
- Toolbar icon — a new text-box glyph added per the M4 icon/mask pipeline (asset location + wiring per that pipeline)
- `tests/unit/` — `sanitize` HTML-branch, `foreign-html-commands`, `foreign-html-serialize` tests
- `tests/e2e/foreign-html.spec.ts` — insert/edit/cancel/source/undo/round-trip

**Modified**
- `packages/svgcanvas/core/sanitize.ts` — `NS.HTML` branch + `sanitizeForeignHtml` + exported `FOREIGN_HTML_TAGS`/`FOREIGN_HTML_ATTRS`/`FOREIGN_STYLE_PROPS` + link hardening
- `packages/svgcanvas/svgcanvas.ts` — `setForeignContent` (+height auto-fit +history); `foreign` mode element creation; export the new method on the canvas surface
- `packages/svgcanvas/core/event.ts` — finish `foreign` mode (mousedown create / mouseup → controller) + `foreignObject` double-click → edit
- `src/editor/panels/LeftPanel.html` — `tool_foreign` button
- `src/editor/panels/LeftPanel.ts` — `clickForeign()` → `setMode('foreign')`; wire in `init()`
- `src/editor/dialogs/globalDialogs.ts` — `+seForeignHtml`, `+import`, `+Window` decl
- `src/editor/global-dialogs.d.ts` — `+declare function seForeignHtml`
- `src/editor/Editor.ts` (or new `src/editor/foreignHtml.ts`) — the controller wiring
- `CHANGELOG.md` — `[Unreleased]` entry (CHANGELOG SOP)

## 8. Risks / plan-time checks

- **Parse namespace (highest-risk assumption):** confirm that an XHTML-namespaced `foreignObject` child, serialized then reparsed by `setSvgString`'s parser, retains `NS.HTML` on its descendants (so the sanitize branch and rendering both work). Add a round-trip test **first** (phase A) to lock this; if the parser collapses namespaces, the serialize wrapper / parse path needs adjustment before anything else is built.
- **`contenteditable` cross-browser quirks** (Chromium + WebKit, the two e2e browsers): selection/range wrapping, list nesting, caret after block retag. The command layer owns these; covered by unit + e2e. Keep commands small and normalized.
- **Height auto-fit measurement:** measuring rendered HTML height inside a `foreignObject` requires it to be laid out; confirm `getBBox`/`scrollHeight` timing (measure after insertion/`updateComplete`). Fallback: honor the drawn height if measurement is unavailable.
- **History granularity:** ensure insert (create + set content) is a single `BatchCommand` so one Ctrl+Z fully reverses it (no orphan empty box).
- **hex-guard vs color presets:** verify the guard's scope excludes the TS preset array (§4.1); adjust routing if it flags them.
- **foreignObject in export (known limitation, document — not a blocker):** foreignObject renders in svgedit's browser canvas but not in all raster/export paths or non-browser SVG renderers (librsvg). Verify svgedit's own export behavior and note the limitation in user-facing docs / CHANGELOG.
- **eslint floating-promises:** the controller's fire-and-forget `seForeignHtml` call — `void`-prefix if the rule is enabled (per M3 precedent).

## 9. References

- Backlog: `todo_svgedit` #9.
- Sibling/template: `src/editor/dialogs/SePromptDialog.ts` + `globalDialogs.ts` (M3); spec `2026-06-08-svgedit-m3-prompt-dialog-design.md`.
- Sanitizer: `packages/svgcanvas/core/sanitize.ts`; namespaces `packages/svgcanvas/core/namespaces.ts` (`NS.HTML`); load-path call `packages/svgcanvas/core/selection.ts` (`prepareSvg` → `sanitizeSvg`).
- Canvas: `packages/svgcanvas/core/event.ts` (foreignObject sizing cases), `packages/svgcanvas/svgcanvas.ts` (`visElems`, history).
- Tokens: `src/editor/styles/tokens.css` (M1); theming (M2); icon pipeline spec `2026-06-09-svgedit-m4-icon-overhaul-design.md` (M4).
- Conventions: `docs/superpowers/conventions/lit-component-conventions.md`.
