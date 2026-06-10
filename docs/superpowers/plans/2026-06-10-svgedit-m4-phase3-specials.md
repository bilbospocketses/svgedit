# M4 Phase 3 — Hand-Drawn Special Glyphs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The glyph batches are **per-batch checklists with visual acceptance**, not TDD red-green code-steps (per the M4 spec — asset phases are art production). The code tasks (Task 8 cleanup) ARE test-first.

**Goal:** Redraw the remaining ~48 live svg-editor "special" glyphs (path-node editing, markers, stroke caps/joins, anchors, text spacing, property icons, connector/foreign) from their old heterogeneous multi-color art into one uniform **Lucide-grid monochrome** family (24×24, 2px, round, `fill="none" stroke="currentColor"`) so the whole toolbar finally reads as one set under the Phase-1 mask pipeline — then fold in the carried a11y + token-modernization cleanup and remove dead path-asset cruft.

**Architecture:** The Phase-1 `.se-icon` mask render already ships and is unchanged here; for every glyph the *entire* runtime change is swapping the SVG file's **contents** (filenames + panel templates untouched). Each glyph is hand-drawn to Lucide's published grid so it is indistinguishable from the Phase-2 adopted glyphs. Visual acceptance is per-batch via the existing `scripts/icon-contact-sheet.mjs` inline-render harness (headless chromium cannot paint `url()` masks — see Conventions). Two non-mask cases (`no_color`, `handle`) and the carried component cleanup are handled in a dedicated code task.

**Tech Stack:** Hand-authored SVG (Lucide design spec), CSS `mask` (shipped Phase 1), Playwright (local `node_modules` — contact-sheet rendering), Vitest/ESLint (existing gates).

**Spec:** `docs/superpowers/specs/2026-06-09-svgedit-m4-icon-overhaul-design.md`
**Prior phase:** Phase 2 plan `docs/superpowers/plans/2026-06-09-svgedit-m4-phase2-lucide-remap.md` (bulk Lucide remap, shipped PR #107, master `318ea9e6`); pipeline Phase 1 PR #105 (`3a946377`); component mask migration PRs #108/#109.

---

## Decisions locked for this phase

| Decision | Choice | Consequence |
| --- | --- | --- |
| Glyph production | **Hand-drawn to Lucide's grid** (no vendor source — these have no Lucide equivalent) | Each glyph authored from scratch to the Draw Rule below; the Phase-2 hand-drawn set (`ellipse`, `fh_rect`, `fh_ellipse`, line tool) is the style exemplar. |
| Visual acceptance | **Per-batch contact sheets** (reuse `scripts/icon-contact-sheet.mjs`) | After each batch, render light+dark × 24px+14px; **human approves before the next batch.** |
| Scope vs spec | **Reconciled by reference audit (below)** — ~48 live, not the spec's "~20-30" nor P2's "~55" | Dead assets are **deleted, not redrawn** (Task 9). The spec line "convert `openpath.png`→SVG" targets a **dead** raster → **DECISION NEEDED** (recommend delete; ratified at Task 1). |
| Non-mask glyphs | `no_color` + `handle` handled separately (Task 8) | Both render via `<img>`/`background-image`, NOT the `.se-icon` mask, so `currentColor` won't theme them — they need a mask-conversion-or-theme-agnostic decision, not a blind redraw. |
| Carried cleanup | **Folded in as Task 8** (a11y + token modernization) | Breadcrumb allows "fold into Phase 3 or a small PR"; folded here to close M4. Can be split to its own PR at the Task-1 gate if preferred. |

## Conventions (this environment)

- **Repo:** `C:/Users/jscha/source/repos/svgedit` — multi-session host; **every git command is `-C`-scoped, all file paths absolute** (no `cd`).
- **Images dir:** `C:/Users/jscha/source/repos/svgedit/src/editor/images/` — the swap target. Edit `src/`, NEVER the `dist/` build mirror. `imgPath` resolves here (`seButton.ts`).
- **Contact sheets:** rendered to a scratch dir (NOT committed) — `<ClaudeScratch>/svgedit-m4p3/batch-<X>/` (resolve the real ClaudeScratch path at execution; see `feedback_scratch_files_use_claudescratch`). The final approved sheet may be attached to the PR.
- **Harness:** `scripts/icon-contact-sheet.mjs` (exists, from Phase 2). **At Task 1, read it to confirm its exact flags** before relying on the `--icons a.svg,b.svg --out <dir>` interface cited here.
- **Playwright (local):** invoke the repo's own binary — `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/playwright.cmd"` / `node` against the repo's `@playwright/test` — never a global. Chromium is its bundled browser under `node_modules`. (Build/test tooling, resolves inside the app folder — Local-Deps-Only satisfied.)
- **Lint:** `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint` (eslint + markdownlint + `lint:hex` hex-guard). `.svg` files are outside hex-guard's scope, but the Draw Rule forbids hardcoded hex anyway (use `currentColor`).
- Commits are SSH-signed automatically. **No AI attribution** in commit messages.
- Branch off `master` via the verified script: `pwsh C:/Users/jscha/.claude/scripts/git-new-branch.ps1 -Repo C:/Users/jscha/source/repos/svgedit -Branch feat/m4-phase3-specials`.
- Merge: **squash auto-merge** on this signed repo — `gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto` (never `--rebase`).

---

## Draw Rule (every hand-drawn glyph)

Author each `src/editor/images/<name>.svg` as a single-line SVG matching the Phase-2 exemplar `ellipse.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!-- geometry --></svg>
```

Hard requirements (checked structurally each batch):
1. `viewBox="0 0 24 24"` (24px grid). Drop the legacy `51.04×49.47` / `300×300` / no-viewBox canvases entirely — redraw, don't rescale.
2. `fill="none"` + `stroke="currentColor"` at the root; **no hardcoded hex** anywhere (`#f9ba00`, `#0000ff`, `#fff`, etc. are the old art — gone). In a mask context the stroke alpha is the stencil; `currentColor` keeps the file honest and future-proof.
3. `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"` (Lucide weight/terminals). Per-element overrides only where the glyph's meaning demands it (e.g. a deliberately flat cap in `linecap_butt`).
4. Content within the **central ~20×20** (≥2px padding from the edge), optically centered, corner radius ~2 for rounded boxes — Lucide's grid conventions, so these sit beside the Phase-2 glyphs seamlessly.
5. No `id`/`class`/`<style>`/`<defs>`/`<title>` cruft, no `data-name`, no nested `<svg>`. Flat geometry only.

Filled accents are allowed **only** where the symbol's meaning requires a solid (e.g. a selected path node shown as a filled dot) — use `fill="currentColor"` on that one element, never a hardcoded color.

---

## Scope reconciliation (reference audit — verified 2026-06-10)

Starting set = the Phase-2 plan's deferred "~55 specials" list, minus the 3 already hand-drawn in Phase 2 (`ellipse`, `fh_rect`, `fh_ellipse`). Then classified by grepping each filename for live wiring across `src/` (panels + extensions):

**LIVE — redraw as mask art (Tasks 1–7), grouped by visual family:**

| Batch | Files | Wired in |
| --- | --- | --- |
| **A · Stroke caps & joins (6)** — PILOT | `linecap_butt` `linecap_round` `linecap_square` `linejoin_miter` `linejoin_round` `linejoin_bevel` | BottomPanel (stroke props) |
| **B · Path-node editing (~8)** | `node_clone` `node_delete` `select_node` `tool_node_clone` `tool_node_delete` `tool_node_link` `add_subpath` `tool_add_subpath` `link_controls` `unlink_use` *(dup pairs resolved at Task 1)* | TopPanel |
| **C · Path ops (3)** | `tool_openclose_path` `to_path` `reorient` | TopPanel |
| **D · Markers (9)** | `nomarker` `mkr_markers_off` `mkr_markers_dimension` `mkr_markers_label` `mcircle` `mcircle_o` `textmarker` `textmarker_top` `textmarker_bottom` | ext-markers |
| **E · Text anchor & spacing (7)** | `anchor_start` `anchor_middle` `anchor_end` `letter_spacing` `word_spacing` `text_length` `text_decoration_overline` | TopPanel |
| **F · Property icons (7)** | `stroke` `opacity` `blur` `angle` `width` `height` `c_radius` | BottomPanel |
| **G · Connector / foreign (3 + slashes pending)** | `conn` `edit_foreign` `tool_foreign` · `forwardslash` `reverseslash` `verticalslash` *(audit at Task 1: if unwired → dead)* | ext-connector / TopPanel |

**NON-MASK — separate handling (Task 8):**
- `no_color` — rendered via `<img>` in `sePalette` (intentionally kept `<img>` during component migration). `currentColor` won't theme it. Decide: keep theme-agnostic (white swatch + red diagonal + border that reads on both themes) **or** convert `sePalette` to a masked element.
- `handle` — `background-image: var(--handle-bg-url)` on `seFlyingButton`/`seExplorerButton` (the flyout-corner indicator). Own colors render literally (currently white → invisible in light mode). Decide: convert to a masked `.se-icon` element **or** make theme-agnostic. Couples with the `--handle-bg-url`→`--se-*` token modernization.

**DEAD — delete, do NOT redraw (Task 9), pending Task-1 ratification:**
- `open_path.svg`, `close_path.svg` — referenced only in a **commented-out** dynamic-swap line (`TopPanel.ts:298`).
- `closepath_icons.svg` — multi-glyph sprite (`#tool_closepath`/`#tool_openpath`), **zero live references**.
- `openpath.png` — **zero live references** (the spec assumed conversion; audit says delete — **DECISION NEEDED**).
- Any of `forwardslash`/`reverseslash`/`verticalslash` confirmed unwired at Task 1.

**EXCLUDED — branding/sample (never touched):** `logo` `svg-edit-home` `netlify-dark` `hello_world` `webappfind`.

---

## Per-glyph design intent

Concrete depiction per glyph (the executor draws the geometry; the gate judges fidelity). All obey the Draw Rule.

### Batch A — Stroke caps & joins (PILOT)
A 2px "stroke sample" segment whose terminal/corner shows the style, with a small **node dot** at the relevant point to anchor the meaning. Family must be mutually consistent.
- `linecap_butt` — horizontal sample stroke ending **flush** (`stroke-linecap="butt"`) at a node dot at its right end.
- `linecap_round` — same sample with a **rounded** cap (`stroke-linecap="round"`) past the node.
- `linecap_square` — same sample with a **square projecting** cap (`stroke-linecap="square"`) past the node.
- `linejoin_miter` — two sample segments meeting at a **sharp pointed** right-angle corner (node dot at the vertex).
- `linejoin_round` — same corner **rounded**.
- `linejoin_bevel` — same corner **chamfered** (flattened).

> **PILOT GATE risk:** at 14px the cap/join distinction via a single 2px line + node may read too subtly. If so, the gate ratifies an alternative depiction for the *whole* family (e.g. a thicker filled "stroke chip" showing the terminal) before any other batch — exactly the Phase-2 pilot rationale (de-risk the hardest family first).

### Batch B — Path-node editing
- `node_clone` — two overlapping small node-circles + a small `+` → duplicate a path node.
- `node_delete` — a node-circle + a small `×` (or minus) → delete a path node.
- `select_node` — a short bezier/segment with three nodes, the middle one **filled** (`fill="currentColor"`) → node-select mode.
- `tool_node_clone` / `tool_node_delete` / `tool_node_link` — flyout-trigger variants. **Task 1 resolves**: if identical-purpose to the bare names, draw once and copy the bytes to both filenames (keep both files — templates reference them); if `tool_node_link` is distinct, draw two nodes joined by a control line (link nodes).
- `add_subpath` / `tool_add_subpath` — an existing open path + a small **detached** new segment marked `+` → add subpath. Resolve dup as above.
- `link_controls` — one bezier node with two **mirrored** control handles joined through the node (symmetric/linked handles).
- `unlink_use` — a broken chain-link (two link halves pulled apart) → unlink a `<use>`/symbol instance. (Lucide `unlink` silhouette, hand-drawn.)

### Batch C — Path ops
- `tool_openclose_path` — a polyline whose two endpoints **almost meet**, with a short **dashed** closing segment bridging them (conveys the open↔close toggle).
- `to_path` — a square on the left, a short arrow, a node-path (square outline with corner node dots) on the right → convert shape to path.
- `reorient` — a path segment with a **curved arrow** sweeping around its start node → reorient/reset path orientation.

### Batch D — Markers
Shared baseline: a horizontal 2px reference line; the **right endpoint** carries the marker decoration (family consistency).
- `nomarker` / `mkr_markers_off` — reference line with an **empty** endpoint and a small slash/`×` over the marker position → no marker. (Task 1: if `nomarker` and `mkr_markers_off` are the same purpose, draw once → both files.)
- `mkr_markers_dimension` — a line with **arrowheads at both ends** (dimension line).
- `mkr_markers_label` — a line ending in a small **tag/label** rectangle.
- `mcircle` — line ending in a **filled** circle marker (`fill="currentColor"`).
- `mcircle_o` — line ending in an **outline** circle marker.
- `textmarker` — line ending in a **"T"** glyph (text marker), centered on the line.
- `textmarker_top` — the "T" sitting **above** the line.
- `textmarker_bottom` — the "T" sitting **below** the line.

### Batch E — Text anchor & spacing
- `anchor_start` — text baseline with an **anchor tick at the left** end, two glyph strokes flowing right (left-aligned).
- `anchor_middle` — anchor tick **centered**, glyph strokes balanced both sides.
- `anchor_end` — anchor tick at the **right**, glyph strokes flowing left.
- `letter_spacing` — an `A`/`V` glyph pair with a **horizontal double-arrow** between them (letter tracking).
- `word_spacing` — two small block "words" with a **double-arrow gap** between them.
- `text_length` — a text baseline with a **width double-arrow** spanning underneath (total advance).
- `text_decoration_overline` — a "T"/text stroke with a **line above** it (the over-line; underline & strikethrough shipped as Lucide in P2 — match their weight/position).

### Batch F — Property icons
- `stroke` — a rounded square outline with a **deliberately heavier ring** emphasis → stroke width/style.
- `opacity` — a circle split into a **solid** half and a **dashed/lighter** half → opacity. (Avoid a literal checkerboard — too noisy at 14px.)
- `blur` — a circle with **concentric softening rings** (a solid inner, a dashed outer) → gaussian blur.
- `angle` — two rays from a shared vertex with a small **arc** between them → rotation angle.
- `width` — two vertical end-bars with a **horizontal double-arrow** between → width.
- `height` — two horizontal end-bars with a **vertical double-arrow** between → height.
- `c_radius` — a square with **one rounded corner** emphasized + a small radius arc → corner radius.

### Batch G — Connector / foreign (+ slashes pending audit)
- `conn` — two small boxes joined by an **elbow connector** line with endpoint dots → connect shapes.
- `tool_foreign` — a frame/box containing **`</>`** (or stacked text lines) → insert foreignObject (currently a blue/grey multi-color illustration — replace entirely).
- `edit_foreign` — the same frame/box with a small **pencil** overlay → edit foreign content.
- `forwardslash` / `reverseslash` / `verticalslash` — **PENDING Task-1 audit.** If wired (e.g. as none/divider indicators): draw as a single clean 2px diagonal `/`, diagonal `\`, vertical `|` respectively, centered. If unwired → move to Task 9 deletion.

---

## Task 1: Reference audit + roster ratification + PILOT (Batch A)

**Files:** create the branch; modify the 6 Batch-A files; no new infra (harness already exists).

- [ ] **Step 1 — Branch.** `pwsh C:/Users/jscha/.claude/scripts/git-new-branch.ps1 -Repo C:/Users/jscha/source/repos/svgedit -Branch feat/m4-phase3-specials` (asserts base == latest `origin/master`).
- [ ] **Step 2 — Confirm the harness interface.** Read `scripts/icon-contact-sheet.mjs`; confirm the `--icons`/`--out` flags and the token source it reads. If the flags differ from this plan, use the file's actual interface (the file is authoritative).
- [ ] **Step 3 — Full reference audit.** For every candidate filename in the roster, grep `src/` (excluding `images/`) for live wiring and classify **live / dead / dup**:

```powershell
$root = "C:/Users/jscha/source/repos/svgedit"
$src  = Get-ChildItem "$root/src" -Recurse -Include *.html,*.ts,*.js | Where-Object { $_.FullName -notmatch '\\images\\' }
$candidates = @(
  'linecap_butt','linecap_round','linecap_square','linejoin_miter','linejoin_round','linejoin_bevel',
  'node_clone','node_delete','select_node','tool_node_clone','tool_node_delete','tool_node_link','add_subpath','tool_add_subpath','link_controls','unlink_use',
  'tool_openclose_path','to_path','reorient',
  'nomarker','mkr_markers_off','mkr_markers_dimension','mkr_markers_label','mcircle','mcircle_o','textmarker','textmarker_top','textmarker_bottom',
  'anchor_start','anchor_middle','anchor_end','letter_spacing','word_spacing','text_length','text_decoration_overline',
  'stroke','opacity','blur','angle','width','height','c_radius',
  'conn','edit_foreign','tool_foreign','forwardslash','reverseslash','verticalslash',
  'no_color','handle',
  'open_path','close_path','closepath_icons','openpath'
)
foreach ($c in $candidates) {
  $hits = (Select-String -Path $src.FullName -Pattern ([regex]::Escape("$c.svg"),[regex]::Escape("$c.png"),"['""/]$([regex]::Escape($c))['""]" -join '|') -List).Path
  "{0,-22} {1}" -f $c, ($(if ($hits) { ($hits | ForEach-Object { Split-Path $_ -Leaf } | Select-Object -Unique) -join ', ' } else { 'NONE — dead candidate' }))
}
```

- [ ] **Step 4 — RATIFY (HUMAN gate).** Present the audit table. Confirm: (a) the dead-asset deletions (`open_path`, `close_path`, `closepath_icons`, `openpath.png`, any dead slash) — **including the spec deviation on `openpath.png` (delete vs convert)**; (b) every `tool_*` dup pair's disposition (draw-once-copy vs distinct); (c) the `no_color`/`handle` treatment (theme-agnostic vs mask-convert); (d) whether Task 8 cleanup ships in this PR or splits out. Lock the final roster + batch counts here.
- [ ] **Step 5 — PILOT draw (Batch A, 6 files).** Hand-draw `linecap_butt/round/square` + `linejoin_miter/round/bevel` per the Draw Rule + design intent.
- [ ] **Step 6 — Structural validity check** (the standard batch check, see Task 2 Step 2) on the 6 files.
- [ ] **Step 7 — Contact sheet.** `node scripts/icon-contact-sheet.mjs --icons linecap_butt.svg,linecap_round.svg,linecap_square.svg,linejoin_miter.svg,linejoin_round.svg,linejoin_bevel.svg --out <ClaudeScratch>/svgedit-m4p3/batch-A`
- [ ] **Step 8 — PILOT acceptance gate (HUMAN).** Criteria: (a) all six crisp 2px glyphs in both themes; (b) **legible at 14px** — the cap/join distinction is readable; (c) light vs dark ink differs (theming intact). **If the 14px distinction fails, ratify the alternative family depiction here before Task 2.**
- [ ] **Step 9 — Commit.**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/images/linecap_butt.svg src/editor/images/linecap_round.svg src/editor/images/linecap_square.svg src/editor/images/linejoin_miter.svg src/editor/images/linejoin_round.svg src/editor/images/linejoin_bevel.svg
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): redraw stroke cap/join glyphs to Lucide grid (phase 3 pilot)"
```

---

## Tasks 2–7: Batch draws (one task per batch B–G, identical shape)

Each batch task follows this checklist (substitute the batch's files + design intent from the roster):

- [ ] **Step 1 — Draw each glyph** in the batch per the Draw Rule + its design-intent line. Before drawing each, read the current `src/editor/images/<name>.svg` to confirm it is still old-style art (not already redrawn); skip any already in new style.
- [ ] **Step 2 — Structural validity check** on the batch's files:

```powershell
$files = @( <batch target filenames> ) | ForEach-Object { "C:/Users/jscha/source/repos/svgedit/src/editor/images/$_" }
foreach ($f in $files) {
  $raw = Get-Content $f -Raw
  try { [xml]$raw | Out-Null } catch { "INVALID XML: $f — $_"; continue }
  if ($raw -notmatch 'viewBox="0 0 24 24"')      { "WARN no 24 viewBox: $f" }
  if ($raw -notmatch 'stroke="currentColor"')    { "WARN no currentColor: $f" }
  if ($raw -match '#[0-9a-fA-F]{3,6}')            { "WARN hardcoded hex: $f" }
  if ($raw -match '<style|class=|data-name|<title') { "WARN cruft: $f" }
}
"OK: $($files.Count) files checked"
```

Expected: all parse, all 24 viewBox, all `currentColor`, **no hardcoded hex**, no cruft.
- [ ] **Step 3 — Contact sheet:** `node scripts/icon-contact-sheet.mjs --icons <comma-list> --out <ClaudeScratch>/svgedit-m4p3/batch-<X>`
- [ ] **Step 4 — Acceptance gate (HUMAN):** every glyph is the right symbol, crisp at 24px + 14px, themes correctly, and is family-consistent with Batch A + the Phase-2 set. Fix any miss (redraw → re-check → re-render) before committing.
- [ ] **Step 5 — Commit:**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/images
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): redraw <batch name> glyphs to Lucide grid (phase 3)"
```

**Batch roster:**
- **Task 2** → Batch B (Path-node editing) — final file list per Task-1 dup resolution.
- **Task 3** → Batch C (Path ops, 3): `tool_openclose_path` `to_path` `reorient`.
- **Task 4** → Batch D (Markers, ~9): `nomarker` `mkr_markers_off` `mkr_markers_dimension` `mkr_markers_label` `mcircle` `mcircle_o` `textmarker` `textmarker_top` `textmarker_bottom`.
- **Task 5** → Batch E (Text anchor & spacing, 7): `anchor_start` `anchor_middle` `anchor_end` `letter_spacing` `word_spacing` `text_length` `text_decoration_overline`.
- **Task 6** → Batch F (Property icons, 7): `stroke` `opacity` `blur` `angle` `width` `height` `c_radius`.
- **Task 7** → Batch G (Connector/foreign + live slashes): `conn` `edit_foreign` `tool_foreign` (+ any slash confirmed live at Task 1).

---

## Task 8: Non-mask glyphs + carried cleanup (CODE — test-first)

**Files:**
- Modify: `src/editor/images/no_color.svg`, `src/editor/images/handle.svg` (per Task-1 decision).
- Modify components for a11y + tokens: `src/editor/components/seButton.ts`, `seFlyingButton.ts`, `seMenuItem.ts`, `seZoom.ts`, `seExplorerButton.ts`, `seListItem.ts`, `seSpinInput.ts`, `seList.ts`, `seInput.ts`, `seDropdown.ts`, `jgraduate/*paint*`/`se-paint-picker`.
- Test: `tests/e2e/m4-icon-components.spec.ts` (extend).

- [ ] **Step 1 — Write failing a11y assertion.** Extend `tests/e2e/m4-icon-components.spec.ts`: assert every `.se-icon` span has `aria-hidden="true"` and **no** `role="img"`/`aria-label="icon"`.

```ts
test('icon spans are aria-hidden (decorative; button title is the name)', async ({ page }) => {
  await page.goto(EDITOR_URL);
  const icons = page.locator('.se-icon');
  await expect(icons.first()).toBeVisible();
  const count = await icons.count();
  for (let i = 0; i < count; i++) {
    await expect(icons.nth(i)).toHaveAttribute('aria-hidden', 'true');
    await expect(icons.nth(i)).not.toHaveAttribute('role', 'img');
  }
});
```

- [ ] **Step 2 — Run it, verify it FAILS** (current spans are `role="img" aria-label="icon"`). Run: `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/playwright.cmd" test m4-icon-components --project=chromium`. Expected: FAIL on the first icon's `aria-hidden`.
- [ ] **Step 3 — Implement a11y fix.** In each component's `.se-icon` markup, replace `role="img" aria-label="icon"` with `aria-hidden="true"` (the button `title` is the accessible name). Grep to confirm none remain: `Select-String -Path (Get-ChildItem "$root/src/editor/components" -Recurse -Filter *.ts).FullName -Pattern 'aria-label="icon"'` → no hits.
- [ ] **Step 4 — Run it, verify it PASSES.**
- [ ] **Step 5 — Token modernization.** Replace the stale tokens in those components with `--se-*` equivalents: `--icon-bg-color`/`--icon-bg-color-hover` → `--se-icon`/`--se-icon-hover`; `--main-bg-color` → the M1 `--se-*` surface token; `--handle-bg-url` → keep the var name OR fold into the `handle` decision. Confirm zero stale refs: `Select-String -Path (Get-ChildItem "$root/src/editor/components" -Recurse -Filter *.ts).FullName -Pattern '--icon-bg-color|--main-bg-color'` → no hits.
- [ ] **Step 6 — `no_color` + `handle`** per Task-1 decision (theme-agnostic redraw, or convert the consumer to a masked element). If mask-converting `handle`: emit a `.se-icon`-style masked span in `seFlyingButton`/`seExplorerButton` instead of `background-image`, and extend the no-`<img>`/theming guard to cover it.
- [ ] **Step 7 — Full lint + both-browser e2e** (`npm --prefix … run lint`; e2e chromium + firefox). Expected: green.
- [ ] **Step 8 — Commit.**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components tests/e2e/m4-icon-components.spec.ts src/editor/images/no_color.svg src/editor/images/handle.svg
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor(m4): icon a11y (aria-hidden) + --se-* token modernization + no_color/handle"
```

---

## Task 9: Delete dead path assets (after Task-1 ratification)

**Files:** delete `src/editor/images/{open_path,close_path,closepath_icons}.svg`, `src/editor/images/openpath.png` (+ any dead slash); clean the dead comment at `TopPanel.ts:298`.

- [ ] **Step 1 — Final re-confirm** each deletion target has zero live references (re-run the Task-1 grep for just these names). Abort any with a live hit and reclassify.
- [ ] **Step 2 — Delete** the confirmed-dead files via `git -C … rm`.
- [ ] **Step 3 — Remove the dead swap comment** at `TopPanel.ts:298` (`// setIcon('#tool_openclose_path', …)`) so no reference implies these files should exist.
- [ ] **Step 4 — Lint + build** to confirm nothing referenced them: `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint` and a `npm run build` (the postbuild copy-static must not error on a missing asset).
- [ ] **Step 5 — Commit.**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/images/open_path.svg src/editor/images/close_path.svg src/editor/images/closepath_icons.svg src/editor/images/openpath.png
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore(m4): remove dead open/close-path assets + sprite + raster"
```

---

## Task 10: Full gate + PR (squash auto-merge)

- [ ] **Step 1 — Lint** (hex-guard green; confirm no `.css`/`.ts` drift): `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint`.
- [ ] **Step 2 — Unit + e2e both browsers.** `theme-chrome.spec.ts` + `m4-icon-components.spec.ts` must pass on Chromium **and** Firefox (re-themes + active=accent + no-`<img>` leak + aria-hidden across all new art). Rely on the PR CI gate (both browsers).
- [ ] **Step 3 — Final full contact sheet** (every redrawn glyph + a sampling of the Phase-2 set, light+dark, 24+14px) for a last whole-set consistency look; attach to the PR body.
- [ ] **Step 4 — CHANGELOG** entry (Keep a Changelog format) for Phase 3.
- [ ] **Step 5 — Push + PR.**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/m4-phase3-specials
gh pr create -R bilbospocketses/svgedit --base master --head feat/m4-phase3-specials --title "feat(m4): hand-drawn special glyphs (phase 3)" --body "<summary + final contact sheet + audit table + dead-asset deletions + a11y/token cleanup>"
gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto
```

Expected: CI green both browsers; auto-merge completes.

**Phase 3 acceptance:** every live special glyph renders as a uniform Lucide 2px-line monochrome icon at its stable filename, crisp at 24px + 14px, theming via the mask; `no_color`/`handle` theme correctly (or are deliberately theme-agnostic); a11y spans are `aria-hidden`; component tokens are `--se-*`; dead path assets removed; e2e green both browsers; hex-guard green. **Only Phase 4 (cursors) remains in M4.**

---

## Self-Review

- **Spec coverage:** hand-drawn specials at stable filenames ✅ (Tasks 1–7); ISC/Lucide-grid fidelity ✅ (Draw Rule); `openpath.png` ✅ *addressed* — audit found it dead → delete (Task 9) with the spec deviation flagged for ratification (Task 1 Step 4), not silently dropped; component cleanup (`--*-color`→`--se-*`, a11y) ✅ (Task 8); `seExplorerButton` handled in Task 8's component list. Cursors explicitly deferred to Phase 4.
- **Placeholder scan:** the only `<…>` placeholders are (a) PR-body text (filled at PR time), (b) per-batch file/icon-list substitutions (the roster table is the single source — intentional DRY, resolved at each task), and (c) the Batch-B final file list + slash disposition, which are **genuine Task-1 audit outputs**, not lazy TBDs — the audit command that resolves them is spelled out in Task 1 Step 3. No "add error handling"/"write tests"-style gaps.
- **Type/name consistency:** `.se-icon` class, `--se-icon`/`--se-icon-hover`/`--se-accent` tokens, `imgPath` resolution, and filenames all match the shipped `seButton.ts` + the live `src/editor/images/` inventory (verified 2026-06-10). The a11y test extends the existing `m4-icon-components.spec.ts` (not a new file).
- **Local-Deps-Only check:** Playwright invoked from the repo's own `node_modules/.bin`; no global/PATH binary; hand-authored SVGs are committed source, not a runtime binary. ✅
- **Scoping discipline:** dead assets are deleted, not redrawn (no wasted art); the spec/audit conflict on `openpath.png` is surfaced for the user, not self-resolved (Binding Decisions rule).
