# M4 Phase 4 — Cursors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. The cursor batch is an **art-production checklist with visual acceptance**, NOT TDD red-green code-steps (per the M4 spec — asset phases are art, same as Phase 3). There is **no runtime code change** in this phase: the wiring already exists (`Editor.ts:478`); the entire change is swapping the contents of 6 `.svg` files.

**Goal:** Redraw the 6 shape-tool cursors (`circle`/`ellipse`/`rect`/`square`/`polygon`/`star`) in the new M4 style with a **theme-agnostic contrast outline** (dark core + white halo) so each reads on both the light and dark canvas — completing M4 and the M1–M4 UI-Modernization program.

**Architecture:** Each cursor SVG = a shared **pointer wedge** (filled dark arrow, tip at the `(0,0)` hotspot, white-haloed) + a per-tool **badge glyph** drawn as two stacked strokes (a fat white halo under a thin dark core) in the Lucide 2px idiom. `cursor: url()` cannot inherit a `--se-*` token (same limitation as `<img>`), so the dark/white literals are hardcoded **by design** — and the hex-guard does not scan `.svg`, so no markers are needed. Filenames, the `Editor.ts` wiring, and the `crosshair` fallback are all untouched.

**Tech Stack:** Hand-authored SVG; CSS `cursor: url()` (pre-existing, `Editor.ts:462-488`); Playwright (local `node_modules`, for the headed art harness + wiring assertion); Vitest/ESLint/`tsc` (existing CI gates).

**Spec:** `docs/superpowers/specs/2026-06-09-svgedit-m4-icon-overhaul-design.md` (§Cursors + §Risks "Cursor hotspots").
**Prior phase:** Phase 3 plan `docs/superpowers/plans/2026-06-10-svgedit-m4-phase3-specials.md` (shipped PR #112, master `52ea107b`).

---

## Conventions (this environment)

- **Repo:** `C:/Users/jscha/source/repos/svgedit` — multi-session host; **every git command is `-C`-scoped, all file paths absolute, no `cd`.** Branch: `feat/m4-phase4-cursors` (already created off `origin/master` `9785fe59`).
- **Swap target:** `C:/Users/jscha/source/repos/svgedit/src/editor/images/cursors/` — edit `src/`, **NEVER** the `dist/` build mirror (the build regenerates it).
- **Scratch (NOT committed):** `%LOCALAPPDATA%/ClaudeScratch/svgedit-m4p4/` → `C:/Users/jscha/AppData/Local/ClaudeScratch/svgedit-m4p4/`. The art harness HTML + screenshots live here.
- **Playwright:** the repo's own `node_modules` chromium — never a global (Local-Deps-Only satisfied).
- Commits are SSH-signed automatically. **No AI attribution** in commit messages.
- Merge: **squash auto-merge** on this signed repo — `gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto` (never `--rebase`).

---

## Draw Rule (every cursor)

Author each `src/editor/images/cursors/<mode>_cursor.svg` as flat geometry on a 20×20 canvas:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <!-- pointer wedge (shared, identical in all 6) -->
  <path d="M0,0 L0,8.5 L2.3,6.4 L4,9.8 L5.3,9.1 L3.7,5.8 L6.7,5.6 Z"
        fill="#2b3c45" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/>
  <!-- badge halo (white, fat) then badge core (dark, thin) — per-tool geometry -->
  <... fill="none" stroke="#ffffff" stroke-width="3"   stroke-linejoin="round" stroke-linecap="round"/>
  <... fill="none" stroke="#2b3c45" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
```

Hard requirements (checked structurally each file):
1. `viewBox="0 0 20 20"`, `width="20" height="20"`. Drop the legacy `<?xml?>` prolog, `xmlns:svg`, `<g class="layer">` wrappers, and **all `<title>` elements** (this also kills the copy-paste `<title>circle_cursor</title>` bug present in all 6 today — a cursor image is decorative, not announced, so no `<title>` is needed).
2. **Hotspot stays `(0,0)`.** `Editor.ts:478` references the cursor with no explicit hotspot, so the browser uses top-left `(0,0)`. The wedge's sharp tip is the first path vertex `M0,0` — keep it exactly there. Do not pad the top-left.
3. **Colors are exactly two literals:** core `#2b3c45` (the established cursor dark), halo `#ffffff`. No tokens (can't inherit), no other colors.
4. **Halo construction for the badge:** the same shape drawn twice — white `stroke-width="3"` first (the halo), then dark `stroke-width="1.6"` on top (the core), both `fill="none"`, round joins/caps. The ~0.7px white rim that shows on each side is what makes the dark glyph read on a dark canvas; the dark core is what reads on a light canvas.
5. Badge sits **lower-right** of the wedge (clear of the wedge's `x:0–6.7, y:0–9.8` footprint), optically centered around `(13,13)`, within the 20×20 with ≥2px edge padding.

---

## Per-cursor badge geometry

The wedge is identical in all 6. Only the badge differs:

| Cursor | Badge element(s) — drawn twice (halo `#ffffff` sw3, then core `#2b3c45` sw1.6) |
| --- | --- |
| `circle_cursor` (PILOT) | `<circle cx="13" cy="13" r="4.3"/>` |
| `ellipse_cursor` | `<ellipse cx="12.6" cy="13.4" rx="5.4" ry="3.5"/>` |
| `rect_cursor` | `<rect x="7.8" y="10.4" width="10" height="6.4" rx="0.6"/>` |
| `square_cursor` | `<rect x="9" y="9" width="8" height="8" rx="0.6"/>` |
| `polygon_cursor` | pentagon `<path d="M13,8 L17.76,11.46 L15.94,17.05 L10.06,17.05 L8.24,11.46 Z"/>` |
| `star_cursor` | 5-point star (outer R5.5 / inner r2.2, center `(13,12.8)`) — use halo sw2.5 / core **sw1.4** (finer so the points stay distinct): `<path d="M13,7.3 L14.29,11.02 L18.23,11.1 L15.09,13.48 L16.23,17.25 L13,15 L9.77,17.25 L10.91,13.48 L7.77,11.1 L11.71,11.02 Z"/>` |

These coordinates are the starting design; the headed art harness is the acceptance gate — nudge geometry if a glyph looks unbalanced (this is art, visual review governs).

---

## Verification strategy

Two checks. Cursors are `cursor: url()` images, **not** CSS masks, so:
- The **mask contact-sheet harness does NOT apply** (it inlines `currentColor` masks — irrelevant here).
- The **OS renders the live cursor**, so Playwright cannot screenshot it on hover. Instead, verify the **art** by rendering each SVG as an `<img>` over split light/dark panels (an `<img>` of an SVG renders in-DOM and IS screenshottable), and verify the **wiring** by asserting the computed `cursor` value per tool.

### Art harness (visual acceptance — the gate)
A throwaway `cursors.html` in scratch: a 6×2 grid — each cursor SVG as `<img width=20>` shown once on a `#ffffff` panel and once on a `#1e1e1e` panel (the dark-canvas color). Screenshot it (Playwright, headed). **Accept only if** every cursor's wedge AND badge read clearly on BOTH panels (dark core visible on white; white halo visible on dark).

### Wiring smoke (regression guard)
Confirm `Editor.ts` still maps each shape mode to its cursor url. A quick Playwright assertion: load the editor, for each of `circle/ellipse/rect/square/star/polygon` activate the tool, assert `getComputedStyle(workarea).cursor` contains `cursors/<mode>_cursor.svg`. (Editor.ts is untouched, so this should pass as-is — it guards the contract, not new code.)

---

## Tasks

### Task 1: Pilot — `circle_cursor.svg` + art harness

**Files:**
- Modify: `src/editor/images/cursors/circle_cursor.svg` (replace entire contents)
- Create (scratch, not committed): `C:/Users/jscha/AppData/Local/ClaudeScratch/svgedit-m4p4/cursors.html`

- [ ] **Step 1: Replace `circle_cursor.svg` with the pilot art**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <path d="M0,0 L0,8.5 L2.3,6.4 L4,9.8 L5.3,9.1 L3.7,5.8 L6.7,5.6 Z" fill="#2b3c45" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="13" cy="13" r="4.3" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="13" cy="13" r="4.3" fill="none" stroke="#2b3c45" stroke-width="1.6" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2: Build the scratch art harness** (`cursors.html`) — a 6×2 grid of `<img src="...cursors/<mode>_cursor.svg" width="20">`, each over a white panel and a `#1e1e1e` panel. (Only `circle` is redrawn yet; the other 5 still show old art — that's the visual before/after baseline.)

- [ ] **Step 3: Render headed + eyeball the pilot.** Screenshot `cursors.html` via Playwright (headed). Confirm the circle cursor's wedge tip is crisp at top-left and the haloed ring reads on BOTH panels. Adjust coordinates if unbalanced.

- [ ] **Step 4: Commit the pilot**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/images/cursors/circle_cursor.svg
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): redraw circle cursor (phase 4 pilot) - contrast-outline style"
```

### Task 2: Remaining 5 cursors

**Files (replace entire contents of each):**
- `src/editor/images/cursors/ellipse_cursor.svg`
- `src/editor/images/cursors/rect_cursor.svg`
- `src/editor/images/cursors/square_cursor.svg`
- `src/editor/images/cursors/polygon_cursor.svg`
- `src/editor/images/cursors/star_cursor.svg`

- [ ] **Step 1: Author each** using the shared wedge (verbatim from the Draw Rule) + its badge from the Per-cursor table. Full skeleton (swap the badge element + the `star` stroke-width exception):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <path d="M0,0 L0,8.5 L2.3,6.4 L4,9.8 L5.3,9.1 L3.7,5.8 L6.7,5.6 Z" fill="#2b3c45" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/>
  <BADGE fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
  <BADGE fill="none" stroke="#2b3c45" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Re-render the full harness headed + eyeball all 6.** Screenshot `cursors.html`. Accept only if all 6 wedges + badges read on both panels and the set looks uniform (consistent wedge, consistent badge weight). Nudge geometry as needed.

- [ ] **Step 3: Commit the set**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/images/cursors/
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): redraw ellipse/rect/square/polygon/star cursors (phase 4)"
```

### Task 3: Wiring smoke + lint + build

- [ ] **Step 1: Wiring assertion (headed Playwright).** Load the editor; for each of `circle/ellipse/rect/square/star/polygon`, click the tool and assert `getComputedStyle(workarea).cursor` contains `cursors/<mode>_cursor.svg`. Expected: all 6 pass (wiring untouched).
- [ ] **Step 2: Lint.** Run: `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint`. Expected: eslint clean, markdownlint 0 errors (this plan `.md` included), `[check-no-raw-hex] clean` (svg not scanned).
- [ ] **Step 3: Build/typecheck.** Run: `npm --prefix "C:/Users/jscha/source/repos/svgedit" run build`. Expected: typecheck + vite build succeed; postbuild copies the new cursors into `dist/`.

### Task 4: PR + auto-merge

- [ ] **Step 1: Commit this plan** (if not already in an earlier commit) and push the branch.

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/plans/2026-06-11-svgedit-m4-phase4-cursors.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(m4): phase 4 cursor plan"
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/m4-phase4-cursors
```

- [ ] **Step 2: Open PR + enable squash auto-merge.**

```bash
gh pr create -R bilbospocketses/svgedit --base master --head feat/m4-phase4-cursors --title "feat(m4): phase 4 - contrast-outline cursors (completes M4)" --body "<summary>"
gh pr merge --squash --auto --delete-branch -R bilbospocketses/svgedit <N>
```

- [ ] **Step 3: Watch CI to green** (build-and-unit + e2e ×2 + CodeQL + Scorecard), confirm merge, return to master. Attach the final art-harness screenshot to the PR.

---

## Self-Review (against the spec)

- **Spec §Cursors "redraw in the new style"** → Tasks 1–2 redraw all 6. ✓
- **Spec §Cursors "theme-agnostic via contrast outline — light halo around a dark core"** → dark `#2b3c45` core + white `#ffffff` halo on both wedge and badge; art harness verifies both-theme legibility. ✓
- **Spec §Risks "redrawn cursors must preserve correct hotspot coordinates"** → Draw Rule req #2 pins the wedge tip at `(0,0)`, matching the implicit hotspot in `Editor.ts:478`. ✓
- **Breadcrumb "verify with a HEADED smoke"** → art harness + wiring smoke both headed. ✓
- **Breadcrumb minor tidy "stale title"** → Draw Rule req #1 drops all `<title>` (resolves the copy-paste bug). ✓
- **Type consistency** → the 6 mode names match the `switch` cases in `Editor.ts:472-477` exactly. ✓
- **No placeholders** → pilot is complete SVG; every badge has exact geometry; the only `<BADGE>` token is a clearly-marked swap-in with its source in the per-cursor table. ✓

## Execution Handoff

This is 6 small art files with no code change. **Inline execution** (this session, `superpowers:executing-plans`) is the right call — subagent-per-task dispatch is overkill for a single art batch with one visual gate. Proceeding inline.
