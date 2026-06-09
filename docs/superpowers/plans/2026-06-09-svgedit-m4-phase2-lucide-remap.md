# M4 Phase 2 — Bulk Lucide Icon Remap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The asset batches are **per-batch checklists with visual acceptance**, not TDD red-green code-steps (per the M4 spec — asset phases are art production).

**Goal:** Replace svgedit's direct-remappable toolbar glyphs (~78 of the 142 `src/editor/images/*.svg`) with adapted **Lucide** equivalents at **identical filenames**, so the whole common-tool set becomes one uniform 2px-line monochrome family that the Phase-1 mask pipeline already paints theme-aware.

**Architecture:** Filenames and panel templates are untouched; only each SVG's **contents** change. Phase 1 already shipped the `.se-icon` mask render in `seButton.ts` (paints `var(--se-icon)` through `mask-image:url(<imgPath>/<file>.svg)`), so swapping a file's bytes is the *entire* runtime change — no component, template, or token edits in Phase 2. Raw Lucide SVGs are vendored once into `vendor/lucide/` (pinned snapshot, ISC notice), then copied + lightly adapted into the svgedit filenames.

**Tech Stack:** Lucide SVG source (ISC), CSS `mask` (shipped Phase 1), Playwright (local `node_modules` — contact-sheet rendering), Vitest/ESLint (existing gates).

**Spec:** `docs/superpowers/specs/2026-06-09-svgedit-m4-icon-overhaul-design.md`
**Prior phase:** Phase 1 plan `docs/superpowers/plans/2026-06-09-svgedit-m4-icon-overhaul.md` (mask/token pipeline, shipped PR #105, master `3a946377`; docs PR #106 merged → master `fc9267ef`).

---

## Decisions locked for this phase (confirmed with user 2026-06-09)

| Decision | Choice | Consequence |
| --- | --- | --- |
| Lucide sourcing | **Vendored snapshot, no dependency** | Download the needed Lucide SVGs once into `vendor/lucide/icons/` at a pinned tag + ISC notice. **No `package.json` change.** Batches copy from the local snapshot (offline, reproducible). |
| Visual acceptance | **Per-batch contact sheets** | After each batch swaps its files, render a light+dark × 24px+14px contact sheet; **human approves before the next batch runs.** |
| Phase-2 vs Phase-3 split | **Finalized here** (~78 / ~55, see table) | More icons are genuine svgedit specials than the spec's first estimate (~110/25). Net M4 scope unchanged; the extra ~35 move to the Phase-3 hand-drawn bucket. **Ratified at Task 1's approval gate.** |

## Conventions (this environment)

- **Repo:** `C:/Users/jscha/source/repos/svgedit` — multi-session host; **every git command is `-C`-scoped**, all file paths absolute.
- **Images dir:** `C:/Users/jscha/source/repos/svgedit/src/editor/images/` — the swap target. `imgPath` resolves here (`seButton.ts:105`).
- **Vendor snapshot:** `C:/Users/jscha/source/repos/svgedit/vendor/lucide/` (new; committed).
- **Contact sheets:** rendered to a scratch dir (NOT committed) — `<ClaudeScratch>/svgedit-m4p2/` (resolve/confirm the real ClaudeScratch path at execution; see `feedback_scratch_files_use_claudescratch`). The final approved sheet may be attached to the PR.
- **Lint:** `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint` (eslint + markdownlint + hex-guard; `.svg` files are outside hex-guard's scope, so new colors in vendored SVGs do not trip it — mask ignores their color anyway).
- **Playwright (local):** invoke the repo's own binary — `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/playwright.cmd" …` — never a global. Chromium is its bundled browser under `node_modules`. (Build/test tooling, not an app-runtime binary — Local-Deps-Only satisfied: resolves inside the app folder.)
- Commits are SSH-signed automatically. **No AI attribution** in commit messages.
- Branch off `master`: `feat/m4-phase2-lucide-remap`.
- Merge: **squash auto-merge** on this signed repo — `gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto` (never `--rebase`).

---

## Adaptation rule (raw Lucide → svgedit icon)

Raw Lucide icon (e.g. `vendor/lucide/icons/square.svg`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
```

To produce `src/editor/images/<target>.svg`, copy verbatim and make exactly these edits:

1. **Strip the `class="lucide lucide-*"` attribute** (inert in a mask context; removing it avoids implying a Lucide CSS dependency).
2. Leave everything else intact: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap`/`stroke-linejoin`, geometry. (`stroke="currentColor"` renders **opaque** in an isolated mask render → the 2px outline becomes the alpha stencil → painted by `--se-icon`. Confirmed by the Phase-1 pipeline + the Task-1 pilot.)

Do **not** run an SVG optimizer in this phase (keeps the diff to "Lucide-source minus class attr" — auditable against the vendor snapshot). Optimization, if wanted, is a separate later pass.

---

## File structure

- **Create** `vendor/lucide/icons/*.svg` — the pinned raw Lucide source for every mapped icon (Task 1).
- **Create** `vendor/lucide/README.md` — Lucide version tag + commit SHA + source URL (provenance).
- **Create / append** `THIRD-PARTY-NOTICES.md` (repo root) — Lucide ISC license text + attribution.
- **Create** `scripts/icon-contact-sheet.mjs` — reusable Playwright harness: given a comma-list of filenames, render a light/dark × 24px/14px grid of masked `.se-icon` spans and screenshot it (Task 1; reused every batch).
- **Modify** `src/editor/images/<name>.svg` — the ~78 in-scope files, batch by batch (Tasks 2–N). **Contents only; filenames unchanged.**
- **No changes** to `seButton.ts`, panel `*.html`, `tokens.css`, or any test (the shipped icon-theming e2e is art-agnostic and must stay green).

---

## Proposed mapping table (RATIFIED at Task 1)

Legend — **Disposition:** `P2` = direct Lucide remap this phase · `P3` = hand-drawn special (Phase 3) · `EXCL` = branding/sample, never touched.
**Flag:** `✓` confident · `⚠` verify exact Lucide name exists in snapshot, else nearest · `❓` borderline disposition — confirm at the gate.

Purposes are from each button's `title=` i18n key (`tools.*` / `properties.* / layers.*`) in the panel templates.

### Batch 1 — PILOT (3) · de-risks line-glyph masking before any bulk work

| File | Purpose (i18n) | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `select.svg` | tools.mode_select | P2 | `mouse-pointer-2` | ✓ |
| `rect.svg` | tools.mode_rect | P2 | `rectangle-horizontal` | ✓ |
| `undo.svg` | tools.undo | P2 | `undo-2` | ✓ |

### Batch 2 — Core tools (12)

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `zoom.svg` | tools.mode_zoom / zoom widget | P2 | `zoom-in` | ⚠ |
| `pencil.svg` | tools.mode_fhpath (freehand) | P2 | `pencil` | ✓ |
| `pen.svg` | tools.mode_line (straight line) | P2 | `pen-tool` | ❓ semantics (line vs bezier) |
| `path.svg` | tools.mode_path (bezier path) | P2 | `spline` | ❓ |
| `square.svg` | tools.mode_square | P2 | `square` | ✓ |
| `circle.svg` | tools.mode_circle | P2 | `circle` | ✓ |
| `text.svg` | tools.mode_text / layer rename | P2 | `type` | ✓ |
| `image.svg` | tools.mode_image | P2 | `image` | ✓ |
| `source.svg` | tools.tool_source (edit SVG src) | P2 | `code-xml` | ⚠ |
| `wireframe.svg` | tools.wireframe_mode | P2 | `frame` | ❓ |
| `panning.svg` | pan canvas | P2 | `hand` | ✓ |
| `fill.svg` | properties.fill_color | P2 | `paint-bucket` | ✓ |

### Batch 3 — History / clipboard / arrange (8)

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `redo.svg` | tools.redo | P2 | `redo-2` | ✓ |
| `clone.svg` | tools.clone | P2 | `copy` | ✓ |
| `delete.svg` | tools.del / layers.del | P2 | `trash-2` | ✓ |
| `move_top.svg` | tools.move_top (to front) | P2 | `bring-to-front` | ⚠ |
| `move_bottom.svg` | tools.move_bottom (to back) | P2 | `send-to-back` | ⚠ |
| `group_elements.svg` | tools.group_elements | P2 | `group` | ✓ |
| `ungroup.svg` | tools.ungroup | P2 | `ungroup` | ✓ |
| `rotate.svg` | rotation | P2 | `rotate-cw` | ✓ |

### Batch 4 — Transform / link / arrows (13)

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `flip_horizontal.svg` | tools.flip_horizontal | P2 | `flip-horizontal-2` | ⚠ |
| `flip_vertical.svg` | tools.flip_vertical | P2 | `flip-vertical-2` | ⚠ |
| `globe_link.svg` | tools.make_link (hyperlink) | P2 | `link` | ❓ (globe vs chain) |
| `go_up.svg` | layers.move_up | P2 | `chevron-up` | ✓ |
| `go_down.svg` | layers.move_down | P2 | `chevron-down` | ✓ |
| `leftarrow.svg` | nav / decrement | P2 | `arrow-left` | ✓ |
| `rightarrow.svg` | nav / increment | P2 | `arrow-right` | ✓ |
| `arrow_down.svg` | nav / dropdown | P2 | `arrow-down` | ✓ |
| `arrow_right.svg` | nav | P2 | `arrow-right` | ⚠ dup of rightarrow |
| `arrow_right_big.svg` | nav (large) | P2 | `arrow-right` | ⚠ |
| `leftarrow_o.svg` | nav (outline variant) | P2 | `arrow-left` | ⚠ |
| `rightarrow_o.svg` | nav (outline variant) | P2 | `arrow-right` | ⚠ |
| `context_menu.svg` | common.more_opts | P2 | `ellipsis-vertical` | ✓ |

### Batch 5 — Alignment family (9) · whole family reviewed together for consistency

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `align_left.svg` | tools.align_left | P2 | `align-start-vertical` | ⚠ family |
| `align_center.svg` | tools.align_center | P2 | `align-center-vertical` | ⚠ |
| `align_right.svg` | tools.align_right | P2 | `align-end-vertical` | ⚠ |
| `align_top.svg` | tools.align_top | P2 | `align-start-horizontal` | ⚠ |
| `align_middle.svg` | tools.align_middle | P2 | `align-center-horizontal` | ⚠ |
| `align_bottom.svg` | tools.align_bottom | P2 | `align-end-horizontal` | ⚠ |
| `align_distrib_horiz.svg` | tools.align_distrib_horiz | P2 | `align-horizontal-distribute-center` | ⚠ |
| `align_distrib_verti.svg` | tools.align_distrib_verti | P2 | `align-vertical-distribute-center` | ⚠ |
| `align.svg` | tools.align_to_page (list label) | P2 | `align-center-horizontal` | ❓ may be unused |

### Batch 6 — Text formatting (5)

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `bold.svg` | properties.bold | P2 | `bold` | ✓ |
| `italic.svg` | properties.italic | P2 | `italic` | ✓ |
| `text_decoration_underline.svg` | underline | P2 | `underline` | ✓ |
| `text_decoration_linethrough.svg` | strikethrough | P2 | `strikethrough` | ✓ |
| `fontsize.svg` | font size | P2 | `a-large-small` | ⚠ |

### Batch 7 — File / document ops (11)

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `new.svg` | layers.new / new doc | P2 | `plus` | ❓ (plus vs file-plus) |
| `open.svg` | open document | P2 | `folder-open` | ✓ |
| `save.svg` | save | P2 | `save` | ✓ |
| `saveImg.svg` | save image | P2 | `image-down` | ⚠ |
| `import.svg` | import | P2 | `file-input` | ⚠ |
| `importImg.svg` | import image | P2 | `image-plus` | ⚠ |
| `export.svg` | export | P2 | `file-output` | ⚠ |
| `config.svg` | settings | P2 | `settings` | ✓ |
| `editPref.svg` | preferences | P2 | `sliders-horizontal` | ⚠ |
| `docprop.svg` | document properties | P2 | `file-text` | ⚠ |
| `docprops.svg` | document properties | P2 | `file-cog` | ⚠ dup variant |

### Batch 8 — View / status / library (13)

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `eye.svg` | layer visibility | P2 | `eye` | ✓ |
| `eye_dropper.svg` | color pick | P2 | `pipette` | ✓ |
| `grid.svg` | toggle grid | P2 | `grid-3x3` | ⚠ |
| `layer_view.svg` | layers | P2 | `layers` | ✓ |
| `library.svg` | library | P2 | `library` | ✓ |
| `imagelib.svg` | image library | P2 | `images` | ⚠ |
| `tool_imagelib.svg` | image library | P2 | `images` | ⚠ dup |
| `shapelib.svg` | shape library | P2 | `shapes` | ⚠ |
| `warning.svg` | warning | P2 | `triangle-alert` | ⚠ |
| `cancel.svg` | cancel/close | P2 | `x` | ✓ |
| `xmark.svg` | close | P2 | `x` | ⚠ dup of cancel |
| `ok.svg` | confirm | P2 | `check` | ✓ |
| `config.svg` | (already Batch 7) | — | — | — |

### Batch 9 — Shapes / extras (8)

| File | Purpose | Disposition | Lucide | Flag |
| --- | --- | --- | --- | --- |
| `star.svg` | star shape | P2 | `star` | ✓ |
| `star_o.svg` | star (outline) | P2 | `star` | ⚠ (Lucide star is already outline) |
| `triangle.svg` | triangle shape | P2 | `triangle` | ✓ |
| `triangle_o.svg` | triangle (outline) | P2 | `triangle` | ⚠ |
| `polygon.svg` | polygon shape | P2 | `hexagon` | ❓ (hexagon/pentagon/octagon) |
| `box.svg` | box | P2 | `square` | ❓ |
| `box_o.svg` | box (outline) | P2 | `square` | ❓ |
| `tool_placemark.svg` | placemark | P2 | `map-pin` | ⚠ |

### Phase 3 specials — NOT touched this phase (~55) · listed for completeness so they are visibly out-of-scope

`add_subpath` · `tool_add_subpath` · `anchor_start` · `anchor_middle` · `anchor_end` · `c_radius` · `close_path` · `closepath_icons` · `open_path` · `tool_openclose_path` · `conn` · `edit_foreign` · `tool_foreign` · `fh_ellipse` · `fh_rect` · `ellipse` *(no Lucide ellipse — defer)* · `handle` · `letter_spacing` · `word_spacing` · `text_length` · `text_decoration_overline` · `linecap_butt` · `linecap_round` · `linecap_square` · `linejoin_bevel` · `linejoin_miter` · `linejoin_round` · `mcircle` · `mcircle_o` · `mkr_markers_dimension` · `mkr_markers_label` · `mkr_markers_off` · `nomarker` · `textmarker` · `textmarker_bottom` · `textmarker_top` · `no_color` · `node_clone` · `node_delete` · `select_node` · `tool_node_clone` · `tool_node_delete` · `tool_node_link` · `to_path` · `reorient` · `link_controls` · `unlink_use` *(borderline — could be Lucide `unlink`; confirm at gate)* · `forwardslash` · `reverseslash` · `verticalslash` · `stroke` · `opacity` · `blur` · `angle` · `width` · `height`

### Excluded — branding / sample art (5)

`logo` · `svg-edit-home` · `netlify-dark` · `hello_world` · `webappfind`

---

## Task 1: Vendor snapshot + ISC notice + contact-sheet harness + mapping ratification + PILOT

**Files:** Create `vendor/lucide/icons/*.svg`, `vendor/lucide/README.md`, `THIRD-PARTY-NOTICES.md`, `scripts/icon-contact-sheet.mjs`; modify the 3 pilot icons.

- [ ] **Step 1 — Reference audit (catch orphans).** For every file in the mapping table, grep the repo for its filename to confirm it is actually wired (panel/extension/JS) before swapping. Note any file referenced **nowhere** — it gets swapped anyway (harmless) but is flagged in the PR as a possible dead asset for a later cleanup TODO. Command:

```powershell
$img = "C:/Users/jscha/source/repos/svgedit/src/editor/images"
Get-ChildItem $img -Filter *.svg -File | ForEach-Object {
  $n = $_.Name
  $hits = (Select-String -Path (Get-ChildItem "C:/Users/jscha/source/repos/svgedit/src" -Recurse -Include *.html,*.js,*.ts).FullName -Pattern ([regex]::Escape($n)) -List).Count
  "{0}`t{1}" -f $n, $hits
}
```

- [ ] **Step 2 — Pin + vendor the Lucide snapshot.** Pick the latest stable Lucide release tag; record it. Download the raw SVGs for **every `P2` Lucide name in the ratified table** into `vendor/lucide/icons/`. Source pattern (pinned tag, not `main`): `https://raw.githubusercontent.com/lucide-icons/lucide/<TAG>/icons/<name>.svg`. Write `vendor/lucide/README.md` with: the exact tag, the commit SHA, the source URL pattern, and a one-line "raw upstream snapshot; adapted copies live in `src/editor/images/`". **Verify each mapped name resolved (HTTP 200 + non-empty SVG); for any 404, pick the nearest existing Lucide name and update the table + note it.**

- [ ] **Step 3 — ISC notice.** Create `THIRD-PARTY-NOTICES.md` at repo root with Lucide's attribution + full ISC license text (from `vendor/lucide/<TAG>/LICENSE`). Link it from `README.md`'s credits/license section.

- [ ] **Step 4 — Build the contact-sheet harness** `scripts/icon-contact-sheet.mjs`. Behavior: accept `--icons a.svg,b.svg,…` and `--out <dir>`; build an HTML page that, for each icon, renders a `<span class="se-icon">` masked element (reusing the **exact** Phase-1 CSS: `background-color:var(--se-icon); mask:url(../src/editor/images/<file>) center/contain no-repeat`) at **24px and 14px**, laid out in two columns — left `data-theme="light"`, right `data-theme="dark"` — pulling the real token values from `src/editor/styles/tokens.css`. Launch the **local** Playwright chromium, screenshot to `<out>/<label>.png`. (Invoke via `node` + the repo's local `@playwright/test`; no global browser.) Include each icon's filename as a caption under its cell so review is unambiguous.

- [ ] **Step 5 — PILOT swap (3 icons).** Adapt `select.svg`→`mouse-pointer-2`, `rect.svg`→`rectangle-horizontal`, `undo.svg`→`undo-2` per the Adaptation rule. Run the harness for these three.

- [ ] **Step 6 — PILOT acceptance gate (HUMAN).** Present the contact sheet. **Acceptance criteria:** (a) all three glyphs render as crisp 2px-line icons in both themes; (b) they are clearly legible at **14px** (`size="small"`) — the stroke is not mushy/illegible; (c) light vs dark ink differs (theming intact). **If 14px is too soft**, decide here: accept, or adjust the global approach (e.g. heavier stroke for the set) before any bulk batch. **Also ratify the full mapping table** (resolve every `❓`/`⚠`, confirm the P2/P3 split). Do not proceed to Task 2 without sign-off.

- [ ] **Step 7 — Commit.**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add vendor/lucide THIRD-PARTY-NOTICES.md README.md scripts/icon-contact-sheet.mjs src/editor/images/select.svg src/editor/images/rect.svg src/editor/images/undo.svg
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): vendor Lucide snapshot + ISC notice + contact-sheet harness; pilot 3 icons"
```

---

## Tasks 2–9: Batch swaps (one task per batch, identical shape)

Each batch task follows this checklist (substitute the batch's files + Lucide names from the **ratified** table):

- [ ] **Step 1 — Adapt each file** in the batch: copy `vendor/lucide/icons/<lucide>.svg` → `src/editor/images/<target>.svg`, strip the `class="lucide …"` attribute (Adaptation rule). Nothing else.
- [ ] **Step 2 — Structural validity check** on the batch's swapped files:

```powershell
$files = @( <batch target filenames> ) | ForEach-Object { "C:/Users/jscha/source/repos/svgedit/src/editor/images/$_" }
foreach ($f in $files) {
  try { [xml](Get-Content $f -Raw) | Out-Null; if ((Get-Content $f -Raw) -notmatch 'viewBox="0 0 24 24"') { "WARN no 24 viewBox: $f" } }
  catch { "INVALID XML: $f — $_" }
}
"OK: $($files.Count) files parsed"
```

Expected: all parse as XML, all keep the 24 viewBox, no `class="lucide"` remains.
- [ ] **Step 3 — Render the contact sheet** for the batch: `node scripts/icon-contact-sheet.mjs --icons <comma-list> --out <ClaudeScratch>/svgedit-m4p2/batch-N`.
- [ ] **Step 4 — Acceptance gate (HUMAN):** present the sheet; confirm every glyph is the right symbol, crisp at 24px + 14px, themes correctly. Fix any miss (re-map → re-adapt → re-render) before committing.
- [ ] **Step 5 — Commit** the batch:

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/images
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): remap <batch name> icons to Lucide (batch N)"
```

**Batch roster** (files per batch are the table sections above):
- **Task 2** → Batch 2 (Core tools, 12)
- **Task 3** → Batch 3 (History/clipboard/arrange, 8)
- **Task 4** → Batch 4 (Transform/link/arrows, 13)
- **Task 5** → Batch 5 (Alignment family, 9)
- **Task 6** → Batch 6 (Text formatting, 5)
- **Task 7** → Batch 7 (File/doc ops, 11)
- **Task 8** → Batch 8 (View/status/library, 13)
- **Task 9** → Batch 9 (Shapes/extras, 8)

---

## Task 10: Full gate + PR

- [ ] **Step 1 — Lint** (hex-guard must stay green; `.svg` is out of its scope but confirm no `.css`/`.ts` drift):

```powershell
npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint
```

- [ ] **Step 2 — Unit + e2e both browsers.** The shipped icon-theming e2e (`tests/e2e/theme-chrome.spec.ts`) is art-agnostic and must still pass on Chromium **and** Firefox (re-themes + active=accent across the new art). Run the project's full `npm test` flow / rely on the PR CI gate (both browsers).
- [ ] **Step 3 — Final full-toolbar contact sheet** (all ~78 swapped icons, light+dark, 24+14px) for a last whole-set consistency look; attach to the PR body.
- [ ] **Step 4 — Push + PR (squash auto-merge).**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/m4-phase2-lucide-remap
gh pr create -R bilbospocketses/svgedit --base master --head feat/m4-phase2-lucide-remap --title "feat(m4): bulk Lucide icon remap (phase 2)" --body "<summary + final contact sheet + orphan notes + finalized P2/P3 split>"
gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto
```

Expected: CI green both browsers; auto-merge completes.

**Phase 2 acceptance:** every direct-remappable toolbar button shows a uniform Lucide 2px-line glyph at stable filenames; all mask-render crisply at 24px and small (~14px); icon-theming e2e green both browsers; `hex-guard` green; Lucide ISC notice present. Phase-3 specials + cursors + component cleanup remain.

---

## Self-Review

- **Spec coverage:** bulk Lucide remap at stable filenames ✅ (Tasks 2–9); ISC notice ✅ (T1.S3); "validate before bulk" ✅ (T1 pilot de-risks line-glyph masking + small-size legibility — the spec's open risk #2); theming preserved ✅ (T10.S2 art-agnostic e2e); finalized P2/P3 split ✅ (table + T1 gate, satisfying spec risk #4 "count drift finalized during phase 2 mapping"). Specials/cursors/components explicitly deferred to Phases 3–5.
- **Placeholder scan:** the only `<…>` placeholders are PR-body text (filled at PR time), the Lucide `<TAG>`/SHA (pinned at vendor time — flagged, not a gap), and the per-batch file substitutions (the ratified table is the single source — intentional DRY, not a placeholder). Lucide names flagged `⚠`/`❓` are real proposals verified/resolved at the T1 gate, not TBDs.
- **Type/name consistency:** `.se-icon` class, `--se-icon`/`--se-icon-hover`/`--se-accent` tokens, and the `imgPath + '/' + src` resolution all match the shipped `seButton.ts`. Filenames in the table match the live `src/editor/images/` inventory (verified 2026-06-09).
- **Local-Deps-Only check:** Playwright invoked from the repo's own `node_modules/.bin`; no global/PATH binary; vendored SVGs are committed source, not a runtime binary. ✅
