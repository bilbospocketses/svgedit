# svgedit 12.D — Tutorial Docs Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, controller-direct per the spec's execution decision) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. This is docs-only — the "test" per doc is: markdownlint clean + a dead-pattern grep returns nothing + every referenced extension/file/event/config key verified present in the current tree.

**Goal:** Rewrite all 8 `docs/tutorials/*.md` to be accurate to the current fork and concise, convert dead JSDoc-link syntax to plain markdown, and bring `docs/tutorials/**` under markdownlint.

**Architecture:** Controller-direct prose rewrites (no subagents). Each claim verified against the current code. One implementation PR off master, preceded by the spec+plan PR (per the 12.A/B/C pattern). Docs-only — zero code changes.

**Tech Stack:** Markdown, markdownlint-cli2, the current svgedit tree (TypeScript, Lit, English-only, no jQuery, no jsdoc generator).

**Spec:** `docs/superpowers/specs/2026-06-02-svgedit-12d-tutorials-design.md`.

---

## File structure

| File | Responsibility after 12.D |
|---|---|
| `docs/tutorials/CanvasAPI.md` | Accurate short pointer to the canvas module + standalone use. |
| `docs/tutorials/EditorAPI.md` | Accurate short pointer to the editor entry point. |
| `docs/tutorials/Editor.md` | End-user usage tips (Paths + tips migrated from FAQ). |
| `docs/tutorials/FrequentlyAskedQuestions.md` | Genuine, current Q&A only. |
| `docs/tutorials/ConfigOptions.md` | Config/preferences reference, current. |
| `docs/tutorials/Events.md` | Event-system reference, current (no jQuery). |
| `docs/tutorials/ExtensionDocs.md` | Extension-authoring guide with a real current example. |
| `docs/tutorials/LocaleDocs.md` | English-only `locale.ts` mechanism. |
| `.markdownlint-cli2.jsonc` | Include `docs/tutorials/**` in lint globs. |

## Common reference — cross-cutting rules (apply in EVERY rewrite task)

1. `{@tutorial X}` → `[X](X.md)` (relative link to the sibling tutorial file).
2. `{@link module:Y}` → plain reference by name + source path; no generated API site. E.g. `{@link module:svgcanvas}` → "the canvas module (`packages/svgcanvas/svgcanvas.ts`)".
3. Remove jQuery usage/examples; show the current vanilla/Lit mechanism (verified against code).
4. Filename replacements: `svg-editor.js` → `src/editor/Editor.ts`; `svg-editor.html` → `src/editor/index.html`; `svgcanvas.js` → `packages/svgcanvas/svgcanvas.ts`.
5. Remove version-history cruft ("since v2.x/3.0" notes) and upstream external links (`svg-edit.github.io`, `visihow.com`).
6. Apply STYLE.md voice/format. Each statement must be verified true against the current tree.

**Per-doc commit message template:** `docs: 12.D — rewrite <Doc>.md accurate-concise (TODO #12.D)`

**Cwd-safe execution:** all git via `git -C "C:/Users/jscha/source/repos/svgedit"`; never `cd`; absolute paths; SSH-signed commits, no AI attribution.

---

## Task 1: Ship spec+plan PR, branch for implementation

**Files:** (this plan + the committed spec, already on `docs/12-d-tutorials-spec`)

- [ ] **Step 1: Commit this plan**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/plans/2026-06-02-svgedit-12d-tutorials.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: #12.D plan (tutorial docs rewrite — TODO #12.D)"
```

- [ ] **Step 2: Push + open spec/plan PR**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin docs/12-d-tutorials-spec
gh pr create --repo bilbospocketses/svgedit --base master --head docs/12-d-tutorials-spec --title "docs: #12.D spec + plan (tutorial docs rewrite)" --body "Adds the design spec + implementation plan for sub-project 12.D (the final piece of TODO #12). Rewrites all 8 docs/tutorials/*.md accurate-concise for the current fork. Docs-only. Refs: TODO #12.D."
```

- [ ] **Step 3: Watch CI (ScheduleWakeup/background poll), squash-merge once green**

```pwsh
gh pr merge <PR> --repo bilbospocketses/svgedit --squash --delete-branch
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
```

- [ ] **Step 4: Branch for implementation**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feature/12-d-tutorials origin/master
```

Expected: clean branch off the spec/plan-merged master.

---

## Task 2: Establish fork-reality facts (run once; answers feed Tasks 3-9)

**Files:** none (read-only verification).

- [ ] **Step 1: Surviving extensions** (for ExtensionDocs example + Events table)

```pwsh
Get-ChildItem "C:/Users/jscha/source/repos/svgedit/src/editor/extensions" -Directory | Select-Object -ExpandProperty Name
```

Expected: `ext-connector, ext-eyedropper, ext-grid, ext-layer_view, ext-markers, ext-opensave, ext-overview_window, ext-panning, ext-polystar, ext-shapes, ext-storage`. (Confirms `ext-helloworld`, `ext-arrows`, `ext-star`, `ext-polygon`, `ext-foreignObject`, `ext-webappfind`, `ext-server_opensave` are GONE.) Pick the simplest surviving extension as the ExtensionDocs example (default `ext-grid`).

- [ ] **Step 2: The `svgEditorReady` listen/dispatch mechanism** (replaces jQuery in Events.md)

```
grep -rn "svgEditorReady" C:/Users/jscha/source/repos/svgedit/src/editor
```

Record the real (non-jQuery) mechanism — how the event is dispatched and how a host listens (e.g. `addEventListener('svgEditorReady', …)` on the container document). Use it verbatim in Events.md.

- [ ] **Step 3: Config bootstrap filename** (for ConfigOptions.md + ExtensionDocs.md)

```pwsh
Test-Path "C:/Users/jscha/source/repos/svgedit/src/svgedit-config-iife.js"
```

Plus `grep -rn "svgedit-config-iife\|setConfig" C:/Users/jscha/source/repos/svgedit/src/editor` to confirm the current config entry mechanism + filename. Document what actually exists.

- [ ] **Step 4: Canvas event list** (for the Events.md table)

```
grep -rno "call('[a-zA-Z]*'" C:/Users/jscha/source/repos/svgedit/packages/svgcanvas C:/Users/jscha/source/repos/svgedit/src/editor
```

Build the set of events actually triggered. Drop any table row whose event no longer fires or whose only source was a removed extension (arrows/star/polygon/foreignObject/webappfind).

- [ ] **Step 5: Confirm jQuery is absent at runtime**

```
grep -rn "jquery" C:/Users/jscha/source/repos/svgedit/src C:/Users/jscha/source/repos/svgedit/packages
```

Expected: no runtime jQuery import. Confirms Events.md must not use `$(…)`.

No commit (read-only).

---

## Task 3: Rewrite CanvasAPI.md + EditorAPI.md (the two API pointers)

**Files:**
- Modify: `docs/tutorials/CanvasAPI.md`
- Modify: `docs/tutorials/EditorAPI.md`

- [ ] **Step 1: Rewrite `CanvasAPI.md`** — short, accurate pointer. State: the canvas lives in `packages/svgcanvas/` (entry `svgcanvas.ts`); it can run standalone or under the editor; extensions receive surfaced canvas methods via the object passed to their `init` (see `ExtensionDocs.md`); the in-code TypeScript types/JSDoc are the API reference (no generated site). Replace `{@tutorial EditorAPI}` → `[EditorAPI](EditorAPI.md)`, `{@tutorial Events}` → `[Events](Events.md)`, `{@tutorial ExtensionDocs}` → `[ExtensionDocs](ExtensionDocs.md)`; drop `{@link module:svgcanvas...}` → "the canvas module (`packages/svgcanvas/svgcanvas.ts`)".
- [ ] **Step 2: Rewrite `EditorAPI.md`** — short, accurate pointer. State: the editor entry is `src/editor/Editor.ts` (the `svgEditor` instance); user-facing usage is in `[Editor](Editor.md)`; canvas specifics in `[CanvasAPI](CanvasAPI.md)`. Convert all `{@link}`/`{@tutorial}` per the common rules.
- [ ] **Step 3: Verify** — `grep -n "{@link\|{@tutorial\|svg-editor\.\|svgcanvas\.js" docs/tutorials/CanvasAPI.md docs/tutorials/EditorAPI.md` returns nothing.
- [ ] **Step 4: Commit**

```pwsh
git -C "C:/Users/jscha/source/repos/svgedit" add docs/tutorials/CanvasAPI.md docs/tutorials/EditorAPI.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: 12.D — rewrite CanvasAPI.md + EditorAPI.md accurate-concise (TODO #12.D)"
```

---

## Task 4: Rewrite Editor.md (+ migrate FAQ user-tips)

**Files:**
- Modify: `docs/tutorials/Editor.md`

- [ ] **Step 1: Rewrite `Editor.md`** — end-user usage. Keep the Paths section (verify the path-edit double-click behavior still matches current `path-actions.ts` / TopPanel behavior). Add the valid user tips that belong here, migrated from FAQ (Task 5 removes them there): set stroke to none (shift-click the None swatch), select hidden/behind object (`Shift+O`/`Shift+P`, wireframe mode), edit grouped elements (double-click into group, `Escape` to exit), trace a raster image (Document Properties → Editor Background, or image-on-a-layer), copy style between objects. Drop the upstream "Feel free to file an issue" framing per STYLE.md. Convert the `{@tutorial FrequentlyAskedQuestions}` link to `[FAQ](FrequentlyAskedQuestions.md)`.
- [ ] **Step 2: Verify** — `grep -n "{@link\|{@tutorial\|file an issue" docs/tutorials/Editor.md` returns nothing; tips read accurately against the current UI.
- [ ] **Step 3: Commit** — `docs: 12.D — rewrite Editor.md + migrate FAQ user tips (TODO #12.D)`

---

## Task 5: Rewrite FrequentlyAskedQuestions.md (triage)

**Files:**
- Modify: `docs/tutorials/FrequentlyAskedQuestions.md`

- [ ] **Step 1: Rewrite** — remove the "may contain outdated content" banner once accurate. **Delete** obsolete Q&A: export/popup-blocker; PHP server-save (`ext-server_opensave` / `filesave.php` — verify gone via Task 2 ext list); "serve from my own server / download & unzip" + visihow.com link. **Migrate** the user-tip Q&A (stroke none, select hidden, edit grouped, trace raster, copy style) to `Editor.md` (Task 4) and remove them here. Keep only genuine FAQ-shaped entries that remain true; if none remain, reduce the file to a short pointer to `[Editor](Editor.md)` + repo issues. Convert `{@tutorial ConfigOptions}` → `[ConfigOptions](ConfigOptions.md)`.
- [ ] **Step 2: Verify** — `grep -n "{@link\|{@tutorial\|filesave\.php\|visihow\|svg-editor\." docs/tutorials/FrequentlyAskedQuestions.md` returns nothing.
- [ ] **Step 3: Commit** — `docs: 12.D — triage FrequentlyAskedQuestions.md (TODO #12.D)`

---

## Task 6: Rewrite ConfigOptions.md

**Files:**
- Modify: `docs/tutorials/ConfigOptions.md`

- [ ] **Step 1: Rewrite** — keep the genuinely-current material: config vs preferences, `svgEditor.setConfig(options)` + the `overwrite` / `allowInitialUserOverride` second-arg behavior (verify against `src/editor/ConfigObj.ts`), URL-param form, preloading (`loadFromString`/`loadFromDataURI`/`loadFromURL` + `?source=`/`?url=`, `noStorageOnLoad`), and `stylesheets` with `'@default'`. Use the **current config-file name** from Task 2 Step 3 (`svgedit-config-iife.js` if confirmed; correct the path). Strip every "(since v2.5/2.7/2.8/3.0)" note and the v2.8 `editor/config.js` / `custom.css` history. `svg-editor.html` → `src/editor/index.html`. Resolve the `<!-- Todo: still occurring? -->` data-URI-trailing-`=` note (verify against current import code; keep only if reproducible, else drop).
- [ ] **Step 2: Verify** — `grep -n "{@link\|{@tutorial\|svg-editor\.html\|since v" docs/tutorials/ConfigOptions.md` returns nothing; config keys exist in `ConfigObj.ts`.
- [ ] **Step 3: Commit** — `docs: 12.D — rewrite ConfigOptions.md accurate-concise (TODO #12.D)`

---

## Task 7: Rewrite Events.md

**Files:**
- Modify: `docs/tutorials/Events.md`

- [ ] **Step 1: Rewrite** — keep `setCustomHandlers` (save/open/exportImage), the `svgEditorReady` host event, within-frame `svgEditor.ready`, extension events, and canvas `bind`/`call`. **Replace the jQuery example** (`$(document).bind('svgEditorReady', …)` + `$('iframe.svgedit')[0]…`) with the real current mechanism from Task 2 Step 2 (verbatim). Filenames: `svgcanvas.js` → `svgcanvas.ts`, `svg-editor.js` → `Editor.ts`. **Prune the canvas-events table** to events confirmed in Task 2 Step 4; drop rows referencing removed extensions (arrows/star/polygon/foreignObject/webappfind) — either delete the row or remove just the dead "where called" note if the event itself still fires. Convert all `{@link}`/`{@tutorial}` per common rules.
- [ ] **Step 2: Verify** — `grep -n "{@link\|{@tutorial\|\\$(\|svgcanvas\.js\|svg-editor\.js\|ext-arrows\|ext-star\|ext-polygon\|ext-foreignObject\|ext-webappfind" docs/tutorials/Events.md` returns nothing.
- [ ] **Step 3: Commit** — `docs: 12.D — rewrite Events.md accurate-concise, drop jQuery (TODO #12.D)`

---

## Task 8: Rewrite ExtensionDocs.md

**Files:**
- Modify: `docs/tutorials/ExtensionDocs.md`

- [ ] **Step 1: Rewrite** — keep the structure: `export default { name, init }`, what `init` receives + may return, buttons (mode/context panels), SVG icons, context tools, helpers (`svgCanvas` methods + `svgEditor` via `this`). **Replace the deleted `ext-helloworld` example** with the chosen surviving extension from Task 2 Step 1 (default `ext-grid`): point to its real path `src/editor/extensions/ext-grid/ext-grid.ts` and summarize its actual shape (verify by reading it). Remove the dead `svg-edit.github.io/...helloworld` demo link. Fix build commands (`npm run build-by-config` → the current build, verify in `package.json` scripts). **Trim the i18n section** to the surviving `ext-locale` mechanism (verify `src/editor/extensions/ext-locale/` still exists; the fork is English-only so frame it as "the mechanism exists; the fork ships only `en`"). Convert all `{@link}`/`{@tutorial}`.
- [ ] **Step 2: Verify** — `grep -n "{@link\|{@tutorial\|helloworld\|svg-edit\.github\.io\|build-by-config" docs/tutorials/ExtensionDocs.md` returns nothing; referenced extension path exists.
- [ ] **Step 3: Commit** — `docs: 12.D — rewrite ExtensionDocs.md, current example (TODO #12.D)`

---

## Task 9: Rewrite LocaleDocs.md

**Files:**
- Modify: `docs/tutorials/LocaleDocs.md`

- [ ] **Step 1: Rewrite** — to current reality. The fork is **English-only**: `i18next` and the non-`en` locale files were removed; `src/editor/locale.ts` is a native shim exposing `t(key, vars)` with dotted/`ns:`-namespaced keys + `{{var}}` interpolation (verify against `src/editor/locale.ts`). Document: the locale-object format (object of strings / nested objects), where `en` lives, that extensions carry their own `en` under `ext-locale/<name>/` (verify path), and that multi-language authoring/`readLang` is no longer supported. Drop the "as of v3.0", Fluent.js, and "may move to JSON" upstream speculation. Convert `{@link}`/`{@tutorial}`.
- [ ] **Step 2: Verify** — `grep -n "{@link\|{@tutorial\|readLang\|as of v" docs/tutorials/LocaleDocs.md` returns nothing; `locale.ts` API matches.
- [ ] **Step 3: Commit** — `docs: 12.D — rewrite LocaleDocs.md (English-only reality) (TODO #12.D)`

---

## Task 10: Bring docs/tutorials under markdownlint

**Files:**
- Modify: `.markdownlint-cli2.jsonc`

- [ ] **Step 1: Read** `.markdownlint-cli2.jsonc`; remove `docs/tutorials/**` from the `ignores` list and add `docs/tutorials/**` (or `docs/tutorials/*.md`) to the lint `globs`. Remove the "12.D will add…" comment.
- [ ] **Step 2: Run markdownlint** — `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint:md`. Fix any MD-rule violations in the 8 rewritten docs (line length, list-marker style `-`, heading levels, fenced-code languages). Re-run until clean.
- [ ] **Step 3: Commit** — `docs: 12.D — include docs/tutorials in markdownlint (TODO #12.D)`

---

## Task 11: Final verification, PR, and 12.D / TODO #12 close-out

**Files:** `CHANGELOG.md`

- [ ] **Step 1: Dead-pattern sweep** across all tutorials (must return NOTHING):

```
grep -rn "{@link\|{@tutorial\|\\$(\|svg-editor\.js\|svg-editor\.html\|svgcanvas\.js\|helloworld\|filesave\.php\|svg-edit\.github\.io\|readLang" C:/Users/jscha/source/repos/svgedit/docs/tutorials
```

- [ ] **Step 2: Full gate** — `npm --prefix … run lint` (exit 0, now covering tutorials), `npm --prefix … run build` (success), `& "<repo>/node_modules/.bin/vitest.cmd" run --root "<repo>"` (701/701 — docs-only, must be unchanged).
- [ ] **Step 3: CHANGELOG** — add an `### Changed (Docs — tutorials rewrite -- 2026-MM-DD)` entry under `## [Unreleased]`: all 8 `docs/tutorials/*.md` rewritten accurate-concise for the current fork (dead JSDoc-link syntax → markdown, jQuery/old-filenames/version-cruft removed, English-only LocaleDocs, current ExtensionDocs example); `docs/tutorials/**` now linted. **Sub-project 12.D COMPLETE — TODO #12 fully closed.** Commit.
- [ ] **Step 4: Push + open PR-impl**, watch CI, squash-merge `--delete-branch`, sync master.
- [ ] **Step 5: Memory close-out** — `todo_svgedit.md`: add a `TODO #12.D SHIPPED` banner + flip the #12.D bullet to ✓ SHIPPED + note **TODO #12 fully closed (12.A–D)**; update the active-items line (drop #12.D; new master SHA). Update `project_index.md` svgedit one-liner. (Memory files — no repo commit.)

---

## Self-review (checklist run against the spec)

- [x] **Spec coverage:** all 8 docs → Tasks 3-9; markdownlint inclusion → Task 10; verification (lint/grep/gate) → Tasks per-doc + Task 11; PR-shape (spec+plan PR then impl PR) → Tasks 1 + 11. Cross-cutting rules → Common Reference block. All spec sections mapped.
- [x] **Placeholder scan:** no "TBD/implement later"; the `<PR>` and `2026-MM-DD` are execution-time fill-ins (PR number, merge date), not design gaps. The "verify against code" steps are the actual accuracy work, each with the exact grep to run.
- [x] **Consistency:** doc filenames, the surviving-extension list, and the filename-replacement map are identical across the Common Reference, Task 2, and the per-doc tasks. Example extension (`ext-grid`) consistent between spec and Task 8.
