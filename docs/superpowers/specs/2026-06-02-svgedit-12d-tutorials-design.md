# svgedit 12.D — Tutorial Docs Rewrite — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorming complete; implementation plan pending)
**Sub-project:** TODO #12.D of 4 — the final piece of TODO #12 (document review). 12.A (STYLE.md), 12.B (brand hygiene), 12.C (JSDoc → TS cleanup) all shipped.

## Context

`docs/tutorials/` holds 8 markdown docs inherited from upstream SVG-Edit. They have drifted badly from the current fork:

- **Dead doc-generator syntax:** every doc uses `{@tutorial X}` / `{@link module:Y}` JSDoc references, but the fork removed the jsdoc generator pipeline (housekeeping pass). These no longer resolve to links in plain markdown.
- **References to removed things:** jQuery (`$(document).bind(...)`); old filenames (`svg-editor.js` / `svg-editor.html`, `svgcanvas.js`); the deleted `ext-helloworld` extension (the central ExtensionDocs example), plus `ext-arrows` / `ext-star` / `ext-polygon` / `ext-foreignObject` / `ext-webappfind` / `ext-server_opensave`; version cruft (v2.4–3.0); `svg-edit.github.io` / visihow.com links.
- **i18n content moot:** the fork is English-only (i18next + 103 locale files removed), so `LocaleDocs` and the extension-i18n sections describe a capability that no longer exists.
- Three are near-empty stubs (`EditorAPI` 6 lines, `CanvasAPI` 12, `Editor` 16) that mostly point at the dead generator.

`docs/tutorials/**` is currently excluded from markdownlint (`.markdownlint-cli2.jsonc` comment: "Sub-project 12.D will add docs/tutorials/** once those files are rewritten").

Note: 12.C just cleaned the in-code JSDoc/TS types, so API-reference tutorials that merely forward to `{@link module:...}` are now largely redundant with in-code docs + IDE intellisense — informing the "concise" depth.

## Goal

Rewrite all 8 `docs/tutorials/*.md` to be **accurate** (every statement true for the current fork) and **concise** (reference-style; no expansion into long walkthroughs). Convert dead JSDoc-link syntax to plain markdown. Add `docs/tutorials/**` to markdownlint and ensure clean. Closes TODO #12 entirely.

## Decisions captured

| Decision | Choice |
|---|---|
| Scope | All 8 docs rewritten (full coverage). |
| Depth | Accurate & concise — fix all drift, reference-style; no new long tutorials/walkthroughs. |
| Linking | Plain markdown. `{@tutorial X}` → `[X](X.md)`; `{@link module:Y}` → name + source path (e.g. `packages/svgcanvas/svgcanvas.ts`). NOT restoring a doc generator. |
| Subject-changed docs | Rewrite to current reality (LocaleDocs = English-only `locale.ts` shim; ExtensionDocs example = a real surviving extension), not preserve obsolete capability. |
| Execution | Controller-direct — the lead rewrites all 8 (small total size; accuracy needs deep fork knowledge). No rewrite subagents. |
| Structure | Keep 8 separate files; no consolidation. README already links to them. |
| PR shape | One implementation PR off master, preceded by this spec + plan (per the 12.A/B/C pattern). |
| markdownlint | After rewrite, remove `docs/tutorials/**` from ignore + add to lint globs; all 8 must pass. |

## Per-doc disposition

| Doc | Disposition |
|-----|-------------|
| `Editor.md` (user) | Keep the Paths tip; fold in still-valid *user tips* migrated from FAQ. Drop upstream "file an issue" voice per STYLE.md. Concise. |
| `FrequentlyAskedQuestions.md` | Triage. **Keep** valid tips (stroke → none via shift-click, select hidden/behind, edit grouped, trace raster, copy style). **Delete** obsolete (PHP `ext-server_opensave` / `filesave.php`, "download & unzip", visihow link, popup-blocker export). Migrate user-tips to `Editor.md`; keep FAQ for genuine Q&A only. |
| `ConfigOptions.md` | Keep `setConfig` / URL params / preloading / stylesheets; verify each against `src/editor/ConfigObj.ts`; strip v2.x–3.0 version-history cruft; `svg-editor.html` → `index.html`. |
| `Events.md` | Fix jQuery (`$(document).bind` → current mechanism); `svgcanvas.js` → `svgcanvas.ts`, `svg-editor.js` → `Editor.ts`; prune the event table to events that exist (drop refs to removed exts: arrows/star/polygon/foreignObject/webappfind). |
| `ExtensionDocs.md` | Keep `export default { name, init }` structure; replace the deleted `ext-helloworld` example with a real surviving extension (default: `ext-grid`, or simplest available); fix build commands; trim i18n section to the surviving `ext-locale` mechanism. |
| `LocaleDocs.md` | Rewrite to current reality: the English-only `locale.ts` shim + `t()` + locale-object format; note multi-language authoring is no longer supported. |
| `CanvasAPI.md` | Accurate short pointer: what `packages/svgcanvas` / `svgcanvas.ts` is, standalone use, where extensions get surfaced methods. Markdown source-path references. |
| `EditorAPI.md` | Accurate short pointer: `src/editor/Editor.ts` / the `svgEditor` instance entry point. Markdown source-path references. |

## Cross-cutting edit rules (apply to every doc)

1. `{@tutorial X}` → `[X](X.md)` (relative markdown link to the sibling tutorial).
2. `{@link module:Y}` → plain reference by name + source path (no generated API site exists). E.g. `` `module:svgcanvas` `` → "the canvas module (`packages/svgcanvas/svgcanvas.ts`)".
3. Remove jQuery usage and examples; show the current (vanilla / Lit) mechanism instead, verified against code.
4. Replace old filenames: `svg-editor.js` → `src/editor/Editor.ts`; `svg-editor.html` → `src/editor/index.html`; `svgcanvas.js` → `packages/svgcanvas/svgcanvas.ts`.
5. Remove version-history cruft (v2.4–3.0 "since vX" notes) and upstream external links (`svg-edit.github.io`, visihow.com).
6. Apply STYLE.md voice/format/line-length. Verify every factual claim against the current tree (grep for referenced extensions, config keys, events, files).

## Verification

- `npm run lint` (markdownlint now covering `docs/tutorials/**`) → exit 0.
- Grep proving zero `{@link` / `{@tutorial`, zero jQuery (`$(`), zero old filenames (`svg-editor.js`, `svg-editor.html`, `svgcanvas.js`) remain under `docs/tutorials/`.
- Every referenced extension / config key / event / file verified present in the current tree.
- Docs-only — `vitest` 701/701 + `npm run build` unaffected; run the standard gate anyway.

## Out of scope

- Restoring a doc-generator / generated API site.
- New user walkthroughs, screenshots, or tutorial expansion beyond accurate-concise prose.
- The embed API docs (`EMBED_API.md`) — that is TODO #4.
- Any code changes — this sub-project is docs-only.

## Success criteria

- All 8 docs accurate to the current fork: no dead `{@link}`/`{@tutorial}`, no jQuery, no old filenames, no obsolete-version cruft.
- `ExtensionDocs` uses a real surviving extension as its example; `Events` table lists only existing events; `LocaleDocs` reflects English-only reality.
- `docs/tutorials/**` linted clean and included in `npm run lint`.
- TODO #12 fully closed (12.A–D all shipped).
