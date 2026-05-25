# svgedit elix → Lit PR-3c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Third and final sub-PR under todo item #3 PR-3. Convert 5 elix-dialog HTML-bound dialogs to Lit with native `<dialog>`; delete 5 HTML template files (inlined into Lit `render()`); delete 3 vendored se-elix overrides; drop `import 'elix/define/Dialog.js'` from `dialogs/index.ts`; remove `elix` npm dependency. After PR-3c: **ZERO elix imports** across `src/`.

**Architecture:** One pilot (exportDialog, smallest, drops the last se-elix import) then 4 parallel conversions (svgSourceDialog, imagePropertiesDialog, editorPreferencesDialog, storageDialog). Each per-dialog agent gets worktree isolation + the verbatim TS source + the verbatim HTML template + the native-`<dialog>` recipe from PR-3b + the HTML-inlining pattern from PR-2 (cmenuDialog reference). Parallel agents run tsc + lint + vitest ONLY (no e2e — avoids port-8000 contention per PR-3a lesson #2); main session runs full gate (including e2e) after all merges. Cleanup task deletes the dead files after all 5 conversions land.

**Tech Stack:** Lit 3.x, TypeScript 6.x (TC39 standard decorators + `accessor` keyword), Native HTML5 `<dialog>`, Vite 7 + SWC, ESLint v9, Vitest 4, Playwright 1.57.

---

## Decisions locked (2026-05-24 PR-3c planning session)

| # | Decision | Locked value | Rationale |
|---|---|---|---|
| 1 | `<elix-dialog>` replacement | **Native HTML5 `<dialog>`** | Locked at PR-3a planning; used in PR-3b. Pattern: `dialog` attr = 'open' -> `.showModal()`, else -> `.close()`. |
| 2 | HTML template handling | **Inline into Lit `render()`; delete .html file** | PR-2 established for cmenuDialog + cmenuLayersDialog. |
| 3 | `init(i18next)` pattern | **Set `@state()` fields directly; Lit re-renders** | Replaces setAttribute -> attributeChangedCallback -> imperative DOM chain. |
| 4 | `svgEditor.$click()` swap | **`@click=${handler}` declarative binding** | PR-2 touchend cascade. |
| 5 | se-elix vendored files | **Delete in cleanup task** | Dead after exportDialog drops last import. |
| 6 | elix npm dep removal | **`npm uninstall elix` in cleanup task** | Zero imports remain after all conversions. |
| 7 | Parallel agent gate | **tsc + lint + vitest only (no e2e)** | Port-8000 contention avoidance. |
| 8 | Plan-doc PR shape | **Inline in impl PR** | PR-3a/3b precedent. |

---

## File structure

### Files CONVERTED (5 dialog TS files rewritten as Lit)

| File | TS LOC | HTML LOC | Target | Notes |
|---|---|---|---|---|
| `src/editor/dialogs/exportDialog.ts` | 159 | 67 | ~130-160 | Drops se-elix import; dead CSS selector removed |
| `src/editor/dialogs/svgSourceDialog.ts` | 230 | 93 | ~180-220 | Textarea + save/cancel flow |
| `src/editor/dialogs/imagePropertiesDialog.ts` | 374 | 113 | ~300-360 | Canvas props + resolution + image embed |
| `src/editor/dialogs/editorPreferencesDialog.ts` | 406 | 241 | ~400-500 | Largest: lang, bg, grid, rulers, units |
| `src/editor/extensions/ext-storage/storageDialog.ts` | 155 | 65 | ~120-150 | Lives in ext-storage/ |

### Files DELETED (5 HTML + 3 se-elix + total 8 files, ~845 LOC)

| File | LOC |
|---|---|
| `src/editor/dialogs/exportDialog.html` | 67 |
| `src/editor/dialogs/svgSourceDialog.html` | 93 |
| `src/editor/dialogs/imagePropertiesDialog.html` | 113 |
| `src/editor/dialogs/editorPreferencesDialog.html` | 241 |
| `src/editor/extensions/ext-storage/storageDialog.html` | 65 |
| `src/editor/dialogs/se-elix/define/NumberSpinBox.ts` | 11 |
| `src/editor/dialogs/se-elix/src/base/NumberSpinBox.ts` | 245 |
| `src/editor/dialogs/se-elix/src/plain/PlainNumberSpinBox.ts` | 10 |

### Files MODIFIED (cleanup)

| File | Change |
|---|---|
| `src/editor/dialogs/index.ts` | Delete line 1: `import 'elix/define/Dialog.js'` |
| `package.json` | Remove `elix` from dependencies |
| `package-lock.json` | Regenerated via `npm uninstall elix` |

---

## Shared conversion pattern

All 5 dialogs follow the same transformation. The current code:
1. Imports HTML as string via vite-plugin-string
2. Creates a `<template>` element, sets its content from the string
3. In constructor: `attachShadow` + `template.content.cloneNode(true)`
4. Queries `<elix-dialog>` as `$dialog`
5. `attributeChangedCallback` with `case 'dialog'`: calls `$dialog.open()` or `$dialog.close()`
6. `init(i18next)` sets i18n attributes which trigger attributeChangedCallback for DOM updates
7. `connectedCallback` wires click handlers via `svgEditor.$click()`

The Lit replacement:
1. HTML content inlined into `render()` method (minus `<elix-dialog>` wrapper + `<style>` block)
2. `<elix-dialog>` replaced with native `<dialog>`
3. CSS from HTML `<style>` block moved to `static styles = css`
4. `init(i18next)` directly sets `@state()` fields (Lit re-renders)
5. `dialog` attribute open/close handled via `attributeChangedCallback` override + `showModal()`/`close()`
6. Button handlers via `@click=${this._handler}` (class-field arrows)
7. `<div class="overlay">` deleted (native backdrop replaces it)
8. `<button>` becomes `<button type="button">` (form-submit prevention)
9. All `eslint-disable` directives + `@ts-expect-error` + `as any` casts eliminated

---

## Tasks

### Task 0: Branch + baseline gate

- [ ] Verify master at `855b949b`
- [ ] Create `feat/elix-to-lit-pr-3c`, commit plan-doc
- [ ] Run baseline gate: tsc 0 / lint 0e+23w / vitest 640/640 / e2e 250/250

---

### Task 1: PILOT — exportDialog (sequential)

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/exportDialog.ts`
- Delete: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/exportDialog.html`

**External-API contract:**
- Tag: `se-export-dialog` (PRESERVED)
- Class: `SeExportDialog` (PRESERVED)
- `init(i18next: any): void` — sets ok/cancel/export-label text
- `dialog` attribute: `'open'` shows modal, else closes
- `value: number` property — quality (0-100), defaults 100
- Dispatches: `CustomEvent('change', { detail: { trigger: 'ok'|'cancel', imgType: string, quality: number } })`
- Consumer creates via `document.createElement('se-export-dialog')` + `init(i18next)` in EditorStartup.ts

**Special notes:**
- Drop dead `import './se-elix/define/NumberSpinBox.js'` (line 3)
- Drop dead CSS rule `elix-number-spin-box { margin-left: 15px }` from the inlined styles
- `<se-spin-input id="se-quality">` in the template is an already-converted Lit component (PR-3a); just include it in `render()` as `<se-spin-input ...></se-spin-input>`
- `<se-select>` in the template is an already-converted Lit component (PR-2); same treatment
- The `$input` change listener + `svgEditor.$click(this.$input, ...)` BOTH update `this.value` from the spin-input — in Lit, wire a single `@change` on `<se-spin-input>` that reads `e.target.value`

**Dispatch:** Subagent with worktree isolation. Full gate (tsc + lint + vitest + e2e) since this is the pilot.

**Commit:** `"feat(#3 PR-3c): convert exportDialog to Lit + inline HTML + drop se-elix NumberSpinBox import"`

---

### Tasks 2-5: 4 parallel conversions

Dispatch ALL 4 in a single Agent message (parallel). Each with worktree isolation. Gate: tsc + lint + vitest ONLY (no e2e).

#### Task 2: svgSourceDialog

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/svgSourceDialog.ts`
- Delete: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/svgSourceDialog.html`

**External-API contract:**
- Tag: `se-svg-source-editor-dialog` (PRESERVED)
- Class: `SeSvgSourceEditorDialog` (PRESERVED)
- `init(i18next)` — save/cancel/note/done labels
- `dialog` attribute: open/close
- `value` attribute: gets/sets `<textarea>` content (SVG source string)
- `applysec` attribute: `'false'` hides apply section, shows copy section; else shows apply
- `copysec` attribute: `'false'` hides copy section
- Dispatches: `CustomEvent('change', { detail: { trigger: 'save'|'cancel'|'copy', value: string, dynamic: boolean } })`
- `$toggleDynamic.checked` reads `svgEditor.configObj.curConfig.dynamicOutput` at construction time

**Commit:** `"feat(#3 PR-3c): convert svgSourceDialog to Lit + inline HTML"`

#### Task 3: storageDialog

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/extensions/ext-storage/storageDialog.ts`
- Delete: `C:/Users/jscha/source/repos/svgedit/src/editor/extensions/ext-storage/storageDialog.html`

**External-API contract:**
- Tag: `se-storage-dialog` (PRESERVED)
- Class: `SeStorageDialog` (PRESERVED)
- `init(i18next)` — ok/cancel/notification/preferences/remember labels
- `dialog` attribute: open/close
- `storage` attribute: `'true'` enables first `<option>`, else disables
- Dispatches: `CustomEvent('change', { detail: { trigger: 'ok'|'cancel', select: string, checkbox: boolean } })`

**Commit:** `"feat(#3 PR-3c): convert storageDialog to Lit + inline HTML"`

#### Task 4: imagePropertiesDialog

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/imagePropertiesDialog.ts`
- Delete: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/imagePropertiesDialog.html`

**External-API contract:**
- Tag: `se-img-prop-dialog` (PRESERVED)
- Class: `SeImgPropDialog` (PRESERVED)
- `init(i18next)` — many labels (ok, cancel, image_props, doc_title, doc_dims, width, height, ...)
- `dialog` attribute: open/close
- Many attributes for pre-populating values: `title`, `width`, `height`, `save`, `images`, `resolution`
- `eventlisten: boolean` — only wires event listeners on first `dialog='open'`
- Dispatches: `CustomEvent('change', { detail: { trigger, title, w, h, save } })`
- Uses `SvgCanvas.isValidUnit()` for input validation (import `SvgCanvas` from `@svgedit/svgcanvas`)

**Commit:** `"feat(#3 PR-3c): convert imagePropertiesDialog to Lit + inline HTML"`

#### Task 5: editorPreferencesDialog

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/editorPreferencesDialog.ts`
- Delete: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/editorPreferencesDialog.html`

**External-API contract:**
- Tag: `se-edit-prefs-dialog` (PRESERVED)
- Class: `SeEditPrefsDialog` (PRESERVED)
- `init(i18next)` — MANY labels (language, background, editor_img_url, grid, rulers, units, ...)
- `dialog` attribute: open/close
- Many attributes for pre-populating: `lang`, `canvasbg`, `bgurl`, `gridsnappingon`, `gridsnappingstep`, `gridcolor`, `showrulers`, `baseunit`
- `colorBlocks: string[]` = `['#FFF', '#888', '#000', 'chessboard']` — background color swatches
- `iconsize` attribute with options `s,m,l,xl` → icon size select
- Dispatches: `CustomEvent('change', { detail: { trigger, lang, bgcolor, bgurl, gridsnappingon, gridsnappingstep, gridcolor, showrulers, baseunit, iconsize } })`
- Dynamic language `<option>` population via i18next translated labels

**Commit:** `"feat(#3 PR-3c): convert editorPreferencesDialog to Lit + inline HTML"`

---

### Task 6: Cleanup — delete dead files + drop elix dep

**Prerequisites:** Tasks 1-5 all merged.

- [ ] **Step 1: Grep-verify zero elix references in src/**

```
Grep pattern: "from 'elix|import 'elix|elix-dialog|elix-number-spin-box"
path: C:/Users/jscha/source/repos/svgedit/src
```
Expected: ZERO matches.

- [ ] **Step 2: Delete se-elix directory**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" rm -r src/editor/dialogs/se-elix/
```

- [ ] **Step 3: Delete 5 HTML files** (if not already deleted by per-task agents)

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/dialogs/exportDialog.html src/editor/dialogs/svgSourceDialog.html src/editor/dialogs/imagePropertiesDialog.html src/editor/dialogs/editorPreferencesDialog.html src/editor/extensions/ext-storage/storageDialog.html
```

- [ ] **Step 4: Drop elix import from index.ts line 1**

Edit `src/editor/dialogs/index.ts`: delete `import 'elix/define/Dialog.js'`

- [ ] **Step 5: Remove elix npm dependency**

```powershell
Set-Location "C:/Users/jscha/source/repos/svgedit"
npm uninstall elix
```

- [ ] **Step 6: Full gate**

```powershell
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
```

- [ ] **Step 7: Commit**

`"chore(#3 PR-3c): delete se-elix vendored overrides + 5 HTML templates + remove elix dependency"`

---

### Task 7: Final gate + CHANGELOG

- [ ] Full gate from final branch HEAD
- [ ] Manual cross-browser smoke: open each of the 5 dialogs in chromium + firefox
  - Export dialog (File > Export as PNG/JPEG)
  - SVG Source editor (Edit > SVG Source)
  - Document Properties (Edit > Document Properties)
  - Editor Preferences (Edit > Editor Preferences)
  - Storage preferences (if localStorage prompt appears on fresh load)
- [ ] Append CHANGELOG entry
- [ ] Commit

---

### Task 8: Open PR-3c + spec amendment

- [ ] Push, create PR, wait for CI, squash-merge
- [ ] Spec amendment PR (mark PR-3c LANDED + "ZERO elix imports" milestone)
- [ ] Update todo_svgedit.md (memory write — requires codeword)
- [ ] Mark item #3 as SHIPPED in todo (all 5 PRs of the elix -> Lit migration complete: PR-1 substrate + references, PR-2 10 pure components, PR-3a 4 elix-bound components, PR-3b 2 dialogs + rename, PR-3c 5 HTML-bound dialogs + elix removal)

---

## Self-review

### Spec coverage

All PR-3c scope items accounted for (5 dialogs + 3 se-elix + index.ts import + elix dep removal). After PR-3c: zero elix across the project.

### Placeholder scan

No TBD/TODO patterns. Per-task specifics provide exact file paths + external-API contracts. The shared conversion pattern provides the code transformation shape.

### Type consistency

All 5 dialogs preserve: tag names, class names, `init(i18next)` signature, `dialog` attribute getter/setter, `CustomEvent('change', { detail })` dispatch shapes. Consumers unchanged.

### Gate baselines

tsc 0 / lint 0e+23w / vitest 640/640 / e2e 250/250. Lint count may drop below 23 after elix removal (if any jgraduate files had elix-related suppressions — unlikely but verify at Task 6 Step 6).
