# M4 Phase 3 — Hand-Drawn Special Glyphs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The glyph batches are **per-batch checklists with visual acceptance**, not TDD red-green code-steps (per the M4 spec — asset phases are art production). The code task (Task 6 cleanup) IS test-first.

**Goal:** Redraw the **31 live** svg-editor "special" glyphs (stroke caps/joins, path-node editing, markers, text anchor/spacing, property icons, connector) from old heterogeneous multi-color art into one uniform **Lucide-grid monochrome** family (24×24, 2px, round, `fill="none" stroke="currentColor"`) so the whole toolbar reads as one set under the Phase-1 mask pipeline — then fold in the carried a11y + token cleanup and delete **22 verified-dead** icon files.

**Architecture:** The Phase-1 `.se-icon` mask render already ships and is unchanged here; for every glyph the *entire* runtime change is swapping the SVG file's **contents** (filenames + panel templates untouched). Each glyph is hand-drawn to Lucide's grid so it is indistinguishable from the Phase-2 adopted glyphs. Visual acceptance is per-batch via the existing `scripts/icon-contact-sheet.mjs` inline-render harness (headless chromium cannot paint `url()` masks — see Conventions).

**Tech Stack:** Hand-authored SVG (Lucide design spec), CSS `mask` (shipped Phase 1), Playwright (local `node_modules` — contact-sheet rendering), Vitest/ESLint (existing gates).

**Spec:** `docs/superpowers/specs/2026-06-09-svgedit-m4-icon-overhaul-design.md`
**Prior phase:** Phase 2 plan `docs/superpowers/plans/2026-06-09-svgedit-m4-phase2-lucide-remap.md` (bulk Lucide remap, shipped PR #107, master `318ea9e6`); pipeline Phase 1 PR #105 (`3a946377`); component mask migration PRs #108/#109.

---

## Decisions locked for this phase

| Decision | Choice | Consequence |
| --- | --- | --- |
| Glyph production | **Hand-drawn to Lucide's grid** (no vendor source — these have no Lucide equivalent) | Each glyph authored from scratch to the Draw Rule below; the Phase-2 hand-drawn set (`ellipse`, `fh_rect`, `fh_ellipse`) is the style exemplar. |
| Visual acceptance | **Per-batch contact sheets** (reuse `scripts/icon-contact-sheet.mjs`) | After each batch, render light+dark × 24px+14px; **human approves before the next batch.** |
| Scope | **31 live / 22 dead — verified by full-corpus reference audit 2026-06-10** | Live set redrawn (Tasks 1–5); dead set **deleted** this PR (Task 7), confirmed by the audit below — not redrawn (no wasted art). |
| Dead-asset handling | **Delete all 22 this PR** (user-ratified 2026-06-10) | Includes `tool_foreign`/`edit_foreign` (planned todo #9 will draw fresh glyphs) and `no_color` (palette uses an inline `<rect fill="none">`, not the file). |

## Conventions (this environment)

- **Repo:** `C:/Users/jscha/source/repos/svgedit` — multi-session host; **every git command is `-C`-scoped, all file paths absolute** (no `cd`). Branch: `feat/m4-phase3-specials` (already created off `d6aa3d50`; plan committed `a52b6224`).
- **Images dir:** `C:/Users/jscha/source/repos/svgedit/src/editor/images/` — the swap target. Edit `src/`, NEVER the `dist/` build mirror. `imgPath` resolves here (`seButton.ts`).
- **Contact sheets:** rendered to scratch (NOT committed) — real path `C:/Users/jscha/AppData/Local/ClaudeScratch/svgedit-m4p3/` (`%LOCALAPPDATA%/ClaudeScratch/…`). The final approved sheet may be attached to the PR.
- **Harness:** `scripts/icon-contact-sheet.mjs` — `node scripts/icon-contact-sheet.mjs --icons a.svg,b.svg --label <name> --out <dir>`. It **inlines** each SVG so `stroke="currentColor"` inherits `var(--se-icon)` (faithful for monochrome line art; sidesteps the headless-mask limitation). Writes `<label>-light.png` + `<label>-dark.png`.
- **Playwright (local):** the repo's own `node_modules` chromium — never a global. (Build/test tooling; Local-Deps-Only satisfied.)
- Commits are SSH-signed automatically. **No AI attribution** in commit messages.
- Merge: **squash auto-merge** on this signed repo — `gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto` (never `--rebase`).

---

## Draw Rule (every hand-drawn glyph)

Author each `src/editor/images/<name>.svg` as a single-line SVG matching the Phase-2 exemplar `ellipse.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!-- geometry --></svg>
```

Hard requirements (checked structurally each batch):
1. `viewBox="0 0 24 24"`. Drop the legacy `51.04×49.47` / `300×300` / no-viewBox canvases entirely — redraw, don't rescale.
2. `fill="none"` + `stroke="currentColor"` at the root; **no hardcoded hex** anywhere. Filled accents only where meaning requires (e.g. a selected node dot) → `fill="currentColor"` on that one element, never a literal color.
3. `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"` (per-element overrides only where the glyph's meaning demands, e.g. a flat cap in `linecap_butt`).
4. Content within the central ~20×20 (≥2px padding), optically centered, corner radius ~2 for rounded boxes — Lucide grid conventions.
5. No `id`/`class`/`<style>`/`<defs>`/`<title>`/`data-name`, no nested `<svg>`. Flat geometry only.

---

## Verified roster (reference audit 2026-06-10 — full `git ls-files` corpus, packages/ included, delimiter-bounded, marker-construction aware)

### ✅ LIVE — redraw (31), grouped into 5 batches

| Batch | Files | Consumer |
| --- | --- | --- |
| **A · Caps & joins (6)** — PILOT | `linecap_butt` `linecap_round` `linecap_square` `linejoin_miter` `linejoin_round` `linejoin_bevel` | `BottomPanel.html` `src=` |
| **B · Path editing (9)** | `tool_node_link` `select_node` `tool_node_clone` `tool_node_delete` `tool_add_subpath` `tool_openclose_path` `unlink_use` `to_path` `reorient` | `TopPanel.html` `src=` + `TopPanel.ts:851` (`select_node` dynamic) |
| **C · Markers & connector (4)** | `nomarker` `mcircle` `mcircle_o` `conn` | `ext-markers` picker (`src="${marker}.svg"`) + `ext-connector.ts` |
| **D · Text anchor & spacing (7)** | `anchor_start` `anchor_middle` `anchor_end` `letter_spacing` `word_spacing` `text_length` `text_decoration_overline` | `TopPanel.html` `src=` |
| **E · Property icons (5)** | `angle` `blur` `c_radius` `stroke` `opacity` | `TopPanel.html` (`angle`/`blur`/`c_radius`) + `BottomPanel.html` (`stroke`/`opacity`) |

*Markers note: `leftarrow`/`rightarrow`/`box` (+`_o`) marker previews were already remapped to Lucide in Phase 2; only `nomarker`/`mcircle`/`mcircle_o` remain. The marker SVGs are **picker-preview UI only** — canvas marker geometry is JS-defined inline in `ext-markers.ts`, so recoloring previews is safe.*

### 🗑️ DEAD — delete all 22 this PR (Task 7), each proven non-consuming

| Reason | Files |
| --- | --- |
| Fully orphaned (0 code mentions) | `edit_foreign` `tool_foreign` `link_controls` `mkr_markers_dimension` `mkr_markers_label` `mkr_markers_off` `textmarker_top` `textmarker_bottom` `closepath_icons` `openpath.png` `no_color` |
| Bare dupes — panel uses `tool_*`; the `tools.*` i18n title key STAYS | `node_clone` `node_delete` `add_subpath` |
| Commented-out only (`TopPanel.ts:298`) | `open_path` `close_path` |
| Stale `ext-markers` locale title, not in live `markerTypes` | `textmarker` `forwardslash` `reverseslash` `verticalslash` |
| Icon file unused — spin-inputs carry no `src` | `width` `height` |

### Excluded — branding/sample (never touched)
`logo` `svg-edit-home` `netlify-dark` `hello_world` `webappfind`

### Carried code cleanup (Task 6)
- **a11y:** `.se-icon` spans use `role="img" aria-label="icon"` → `aria-hidden="true"` across all converted components (the button `title` is the accessible name).
- **Token modernization:** components still referencing `--icon-bg-color` / `--icon-bg-color-hover` / `--main-bg-color` / `--handle-bg-url` → `--se-*`.
- **`handle` indicator:** `handle.svg` is a `background-image` on `seFlyingButton`/`seExplorerButton` (renders its own white fill → invisible in light theme). Modernize so it themes — convert that one indicator to a masked `.se-icon`-style element, or make it theme-agnostic. (Not a mask glyph, so not in the redraw batches.)

---

## Per-glyph design intent

All obey the Draw Rule. The executor draws the geometry; the contact-sheet gate judges fidelity.

### Batch A — Caps & joins (PILOT)
A 2px "stroke sample" whose terminal/corner shows the style, with a small **node dot** anchoring the meaning. Family must be mutually consistent.
- `linecap_butt` — horizontal sample ending **flush** (`stroke-linecap="butt"`) at an end node dot.
- `linecap_round` — same sample, **rounded** cap past the node.
- `linecap_square` — same sample, **square projecting** cap past the node.
- `linejoin_miter` — two segments meeting at a **sharp pointed** corner (node dot at vertex).
- `linejoin_round` — same corner **rounded**.
- `linejoin_bevel` — same corner **chamfered**.

> **PILOT GATE risk:** at 14px the cap/join distinction via a single 2px line + node may read too subtly. If so, the gate ratifies an alternative depiction for the *whole* family (e.g. a thicker filled "stroke chip") before any other batch.

### Batch B — Path editing
- `tool_node_link` — a bezier node with two **mirrored, linked** control handles (the default node-edit "link control points" mode; rendered `pressed` by default). The toggle partner of `select_node`.
- `select_node` — a path with three nodes, the middle **filled** (`fill="currentColor"`) → select-node mode (toggle partner above; consistent styling).
- `tool_node_clone` — two overlapping node-dots + a small `+` → clone node.
- `tool_node_delete` — a node-dot + a small `×` → delete node.
- `tool_add_subpath` — an open path + a **detached** new segment marked `+` → add subpath.
- `tool_openclose_path` — a polyline whose endpoints **almost meet**, with a short **dashed** closing segment bridging them (open↔close toggle).
- `unlink_use` — a broken chain-link (two halves pulled apart) → unlink a `<use>`/symbol.
- `to_path` — a square on the left, a short arrow, a node-path (square w/ corner node dots) on the right → convert to path.
- `reorient` — a path segment with a **curved arrow** sweeping around its start node → reorient path.

### Batch C — Markers & connector
Markers are 22px picker swatches; match the Phase-2 Lucide marker previews (`leftarrow`/`box`).
- `nomarker` — a horizontal reference line whose end carries a small **slashed/empty** marker (the "none" indicator).
- `mcircle` — a reference line ending in a **filled** circle marker.
- `mcircle_o` — a reference line ending in an **outline** circle marker.
- `conn` — two small boxes joined by an **elbow connector** line with endpoint dots → connect shapes.

### Batch D — Text anchor & spacing
- `anchor_start` — text baseline, **anchor tick at left**, glyph strokes flowing right.
- `anchor_middle` — anchor tick **centered**, balanced both sides.
- `anchor_end` — anchor tick at **right**, glyphs flowing left.
- `letter_spacing` — an `A`/`V` pair with a **horizontal double-arrow** between (tracking).
- `word_spacing` — two block "words" with a **double-arrow gap** between.
- `text_length` — a text baseline with a **width double-arrow** spanning underneath.
- `text_decoration_overline` — a "T"/text stroke with a **line above** (match P2's underline/strikethrough weight).

### Batch E — Property icons
- `angle` — two rays from a shared vertex with a small **arc** between → rotation angle.
- `blur` — a circle with **concentric softening rings** (solid inner, dashed outer) → gaussian blur.
- `c_radius` — a square with **one rounded corner** emphasized + a small radius arc → corner radius.
- `stroke` — a rounded square outline with a **heavier ring** emphasis → stroke width/style.
- `opacity` — a circle split into a **solid** half and a **dashed/lighter** half → opacity (avoid a literal checkerboard — noisy at 14px).

---

## Task 1: ✅ Audit + roster ratification (DONE) + PILOT (Batch A)

Audit + ratification completed 2026-06-10 (31 live / 22 dead, delete-all ratified). Remaining:

- [ ] **Step 1 — PILOT draw (Batch A, 6 files):** hand-draw `linecap_butt/round/square` + `linejoin_miter/round/bevel` per the Draw Rule + intent.
- [ ] **Step 2 — Structural validity check** (the standard batch check, see Task 2 Step 2).
- [ ] **Step 3 — Contact sheet:** `node scripts/icon-contact-sheet.mjs --icons linecap_butt.svg,linecap_round.svg,linecap_square.svg,linejoin_miter.svg,linejoin_round.svg,linejoin_bevel.svg --label p3-batchA --out C:/Users/jscha/AppData/Local/ClaudeScratch/svgedit-m4p3`
- [ ] **Step 4 — PILOT acceptance gate (HUMAN):** (a) all six crisp 2px glyphs both themes; (b) **legible at 14px** — cap/join distinction readable; (c) light vs dark ink differs. If 14px fails, ratify the alternative family depiction before Task 2.
- [ ] **Step 5 — Commit:** `git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/images/linecap_*.svg src/editor/images/linejoin_*.svg` then commit `feat(m4): redraw stroke cap/join glyphs to Lucide grid (phase 3 pilot)`.

---

## Tasks 2–5: Batch draws (one task per batch B–E, identical shape)

Each batch task:

- [ ] **Step 1 — Draw each glyph** per the Draw Rule + its design-intent line. Before drawing each, read the current `src/editor/images/<name>.svg` to confirm it is still old-style art; skip any already redrawn.
- [ ] **Step 2 — Structural validity check** on the batch's files:

```powershell
$files = @( <batch target filenames> ) | ForEach-Object { "C:/Users/jscha/source/repos/svgedit/src/editor/images/$_" }
foreach ($f in $files) {
  $raw = Get-Content $f -Raw
  try { [xml]$raw | Out-Null } catch { "INVALID XML: $f — $_"; continue }
  if ($raw -notmatch 'viewBox="0 0 24 24"')   { "WARN no 24 viewBox: $f" }
  if ($raw -notmatch 'stroke="currentColor"') { "WARN no currentColor: $f" }
  if ($raw -match '#[0-9a-fA-F]{3,6}')         { "WARN hardcoded hex: $f" }
  if ($raw -match '<style|class=|data-name|<title') { "WARN cruft: $f" }
}
"OK: $($files.Count) files checked"
```

- [ ] **Step 3 — Contact sheet:** `node scripts/icon-contact-sheet.mjs --icons <comma-list> --label p3-batch<X> --out C:/Users/jscha/AppData/Local/ClaudeScratch/svgedit-m4p3`
- [ ] **Step 4 — Acceptance gate (HUMAN):** every glyph is the right symbol, crisp at 24px + 14px, themes correctly, family-consistent with Batch A + the Phase-2 set. Fix any miss before committing.
- [ ] **Step 5 — Commit** `feat(m4): redraw <batch name> glyphs to Lucide grid (phase 3)`.

- **Task 2** → Batch B (Path editing, 9): `tool_node_link` `select_node` `tool_node_clone` `tool_node_delete` `tool_add_subpath` `tool_openclose_path` `unlink_use` `to_path` `reorient`
- **Task 3** → Batch C (Markers & connector, 4): `nomarker` `mcircle` `mcircle_o` `conn`
- **Task 4** → Batch D (Text anchor & spacing, 7): `anchor_start` `anchor_middle` `anchor_end` `letter_spacing` `word_spacing` `text_length` `text_decoration_overline`
- **Task 5** → Batch E (Property icons, 5): `angle` `blur` `c_radius` `stroke` `opacity`

---

## Task 6: a11y + token modernization + handle indicator (CODE — test-first)

**Files:** components `seButton.ts`, `seFlyingButton.ts`, `seMenuItem.ts`, `seZoom.ts`, `seExplorerButton.ts`, `seListItem.ts`, `seSpinInput.ts`, `seList.ts`, `seInput.ts`, `seDropdown.ts`, `jgraduate/se-paint-picker`; `src/editor/images/handle.svg`; test `tests/e2e/m4-icon-components.spec.ts`.

- [ ] **Step 1 — Write failing a11y assertion** in `m4-icon-components.spec.ts`: every `.se-icon` span has `aria-hidden="true"` and no `role="img"`/`aria-label="icon"`.

```ts
test('icon spans are aria-hidden (decorative; button title is the name)', async ({ page }) => {
  await page.goto(EDITOR_URL)
  const icons = page.locator('.se-icon')
  await expect(icons.first()).toBeVisible()
  const count = await icons.count()
  for (let i = 0; i < count; i++) {
    await expect(icons.nth(i)).toHaveAttribute('aria-hidden', 'true')
    await expect(icons.nth(i)).not.toHaveAttribute('role', 'img')
  }
})
```

- [ ] **Step 2 — Run, verify it FAILS:** `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/playwright.cmd" test m4-icon-components --project=chromium`.
- [ ] **Step 3 — a11y fix:** replace `role="img" aria-label="icon"` with `aria-hidden="true"` in each component's `.se-icon` markup. Confirm none remain: `Select-String -Path (Get-ChildItem "C:/Users/jscha/source/repos/svgedit/src/editor/components" -Recurse -Filter *.ts).FullName -Pattern 'aria-label="icon"'` → no hits.
- [ ] **Step 4 — Run, verify it PASSES.**
- [ ] **Step 5 — Token modernization:** `--icon-bg-color`/`--icon-bg-color-hover` → `--se-icon`/`--se-icon-hover`; `--main-bg-color` → the M1 `--se-*` surface token. Confirm zero stale refs in components.
- [ ] **Step 6 — handle indicator:** modernize the flyout/explorer corner indicator so it themes (mask the `handle.svg` element or make it theme-agnostic); extend the theming guard to cover it.
- [ ] **Step 7 — Full lint + both-browser e2e green.** Commit `refactor(m4): icon a11y (aria-hidden) + --se-* token modernization + themed handle`.

---

## Task 7: Delete the 22 verified-dead assets

**Files:** `git rm` the 22 listed in the DEAD table; tidy stale `ext-markers` locale; clean the dead comment.

- [ ] **Step 1 — Final re-confirm** zero live refs for the 22 (re-run the audit dump from ratification). Abort + reclassify any with a live hit.
- [ ] **Step 2 — `git rm`** the 22 dead files (20 `.svg` + `openpath.png` + … per the table).
- [ ] **Step 3 — Tidy stale locale:** remove the orphaned `textmarker`/`forwardslash`/`reverseslash`/`verticalslash` entries from `src/editor/extensions/ext-markers/locale/en.ts` (and any matching `lang.en.ts` `mkr_*` marker titles for the deleted previews). **Keep** `tools.node_clone`/`node_delete`/`add_subpath` (still used as `tool_*` button tooltips).
- [ ] **Step 4 — Remove the dead swap comment** at `TopPanel.ts:298`.
- [ ] **Step 5 — Lint + build** (the postbuild copy-static must not error on a missing asset): `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint` + `npm --prefix "C:/Users/jscha/source/repos/svgedit" run build`.
- [ ] **Step 6 — Commit** `chore(m4): remove 22 dead icon assets + stale marker locale`.

---

## Task 8: Full gate + PR (squash auto-merge)

- [ ] **Step 1 — Lint** (hex-guard green): `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint`.
- [ ] **Step 2 — Unit + e2e both browsers:** `theme-chrome.spec.ts` + `m4-icon-components.spec.ts` pass on Chromium **and** Firefox. Rely on the PR CI gate.
- [ ] **Step 3 — Final full contact sheet** (all 31 redrawn glyphs + a Phase-2 sampling, light+dark, 24+14px); attach to PR body.
- [ ] **Step 4 — CHANGELOG** entry (Keep a Changelog format).
- [ ] **Step 5 — Push + PR:**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/m4-phase3-specials
gh pr create -R bilbospocketses/svgedit --base master --head feat/m4-phase3-specials --title "feat(m4): hand-drawn special glyphs (phase 3)" --body "<summary + final contact sheet + audit table + 22 dead-asset deletions + a11y/token cleanup>"
gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto
```

**Phase 3 acceptance:** all 31 live special glyphs render as uniform Lucide 2px-line monochrome icons at their stable filenames, crisp at 24px + 14px, theming via the mask; a11y spans `aria-hidden`; component tokens `--se-*`; handle indicator themes; 22 dead assets removed; e2e green both browsers; hex-guard green. **Only Phase 4 (cursors) remains in M4.**

---

## Self-Review

- **Spec coverage:** hand-drawn specials at stable filenames ✅ (Tasks 1–5); Lucide-grid fidelity ✅ (Draw Rule); `openpath.png` ✅ — audit proved it dead → delete (Task 7), not convert (spec deviation ratified by user); marker specials ✅ (the live `nomarker`/`mcircle`/`mcircle_o`, not the dead `mkr_markers_*`/`textmarker*`); component a11y + `--*-color`→`--se-*` ✅ (Task 6); `seExplorerButton`/`seFlyingButton` handled (Task 6 handle indicator). Cursors deferred to Phase 4.
- **Placeholder scan:** the only `<…>` placeholders are PR-body text + per-batch file-list substitutions (the verified roster is the single source). No "add error handling"/"write tests"-style gaps.
- **Type/name consistency:** `.se-icon`, `--se-icon`/`--se-icon-hover`/`--se-accent`, `imgPath` resolution, and all filenames match the shipped `seButton.ts` + verified inventory (2026-06-10). The a11y test extends the existing `m4-icon-components.spec.ts`.
- **Local-Deps-Only:** Playwright from the repo's own `node_modules`; hand-authored SVGs are committed source. ✅
- **Scoping discipline:** dead assets deleted not redrawn; the spec/audit conflicts (`openpath.png`, marker list) surfaced and user-ratified, not self-resolved.
