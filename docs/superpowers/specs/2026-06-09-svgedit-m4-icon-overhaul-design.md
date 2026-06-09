# svgedit M4 — Icon + Button-Image Overhaul (Design)

**Date:** 2026-06-09
**Status:** Design approved (brainstorm); awaiting implementation plan.
**Milestone:** M4 — the final item of the UI-Modernization program (M1 design system ✅, M2 theming ✅, M3 native-dialog replacement ✅). Todo item #23.

## Motivation

The toolbar/tool icons are the last un-modernized surface. Today there are **148 `.svg` files + 1 `.png`** in `src/editor/images/`, and they are:

- **Heterogeneous & hardcoded** — a grab-bag of styles with baked-in colors (e.g. `rect.svg` has an amber stroke `#f9ba00`; `tool_foreign.svg` is a multi-color illustration: blue `#0000CC` body + grey `#444` drop-shadow layers).
- **Not theme-aware** — every icon renders as `<img src="images/<name>.svg">` via `SeButton` (and siblings). An `<img>`-loaded SVG is a sealed document, so CSS `color`/`currentColor` cannot reach inside it. In dark mode the icons do not follow the theme.

M4 makes the icon set **consistent** and **theme-aware**, completing the program. (This is also the home for the icon-color work explicitly excluded from M1's `hex-guard`, which only scans `.css`/`.ts`, never `.svg`.)

## Goals

1. One **consistent** icon set — uniform grid, stroke weight, and visual language.
2. Icons **follow the light/dark theme** automatically via design tokens.
3. Minimal code churn and minimal regression risk.

## Non-goals

- Branding / sample art is left untouched: `logo.svg`, `svg-edit-home.svg`, `netlify-dark.svg`, `hello_world.svg`, `webappfind.svg` (illustrations, not monochrome UI glyphs).
- No change to the embed API, the panel templates, or icon **filenames** (see below).

## Locked decisions (from the brainstorm)

| Decision | Choice |
| --- | --- |
| Visual ambition | **A — new uniform set** (redraw to one style) |
| Coloring mechanism | **CSS `mask`** (`background-color` token + `mask-image`), not inline-SVG/`currentColor` |
| Sourcing | **Adopt-and-adapt** an open-source family + hand-fill svg-editor specials |
| Family | **Lucide** (ISC license — GPL-3.0-compatible), 24px grid / 2px stroke |
| Style | **Medium line (2px)** — the pro-tool weight (Figma/Excalidraw/VS Code class) |
| Active state | accent-colored (reuse `--se-accent`) |
| Scope | ~140 UI icons + `openpath.png`→SVG + the `cursors/` set |

## Architecture

### Filename-stable swap (keeps churn small)

Icon **filenames stay identical** (`rect.svg`, `select.svg`, `go_up.svg`, …). The panel templates (`<se-button src="rect.svg">` in `LeftPanel.html`, `TopPanel.html`, `LayersPanel.html`, `BottomPanel.html`) **do not change**. We only:

1. swap each file's **contents** for a new Lucide-style monochrome glyph, and
2. change **how** `SeButton` & siblings paint it (mask instead of `<img>`).

Blast radius = the render methods + the SVG files + the tokens. Wiring is untouched.

### Rendering: CSS mask

`SeButton.render()` (and the icon-rendering siblings) stop emitting `<img src=…>` and emit a masked element instead:

```css
.se-icon {
  display: block;
  width: 100%; height: 100%;
  background-color: var(--se-icon);
  -webkit-mask: url("<imgPath>/rect.svg") center / contain no-repeat;
          mask: url("<imgPath>/rect.svg") center / contain no-repeat;
}
```

- The glyph's own colors are irrelevant — `mask` uses the SVG's alpha/shape as a stencil and CSS paints it from a token → **theme-aware for free** (the token re-points under `html[data-theme="dark"]`).
- The mask `url()` resolves through the same `configObj.curConfig.imgPath` the current `<img>` uses, so embed/host path resolution is preserved.
- Include both `-webkit-mask` and `mask` for Chromium + Firefox (svgedit's matrix); both ship unprefixed support, prefix retained as belt-and-suspenders.

### Tokens & states

Add a semantic icon pair to `src/editor/styles/tokens.css` (light `:root` + dark `html[data-theme="dark"]`):

- `--se-icon` — default glyph ink (a strong but slightly-muted ink; candidate: light `var(--se-grey-600)` region / dark `var(--se-grey-550)` — tuned during phase 1).
- `--se-icon-hover` — resolves toward full `--se-text` on hover.
- **Active/selected** tool reuses `--se-accent` (teal), wired through `SeButton`'s existing `pressed` property: `.pressed .se-icon { background-color: var(--se-accent) }` (the `.pressed` class already drives the button background today, so no new state plumbing).
- **Disabled** stays opacity-based (the `.disabled { opacity: 0.3 }` rule already on the buttons from M1).

Hover/pressed **button backgrounds** already exist (M1) — those components currently reference pre-M1 names (`--icon-bg-color`, `--icon-bg-color-hover`, `--main-bg-color`); modernize them to `--se-*` as part of touching the component (see below).

### The icon set (Lucide adopt-and-adapt)

- **Direct remap (~110-120):** map svgedit's common tools to Lucide equivalents at matching filenames (select, rect/square, ellipse/circle, triangle, star, text, image, zoom, undo, redo, save, open, export, delete, clone/copy, group/ungroup, align-\*, distribute-\*, flip-h/v, rotate, layers, eye, grid, settings, …).
- **Hand-drawn specials (~20-30):** glyphs no general set has — path-node clone/delete, marker types (`mkr_markers_*`, `textmarker*`, `nomarker`), `linecap_*`, `linejoin_*`, `anchor_*`, segment/`conn`, `open_path`/`close_path`/`tool_openclose_path`, `add_subpath`, `to_path`, `reorient`, `unlink_use`, `node_*`. Drawn to **Lucide's published grid/stroke rules** so they are indistinguishable from the adopted glyphs.
- `openpath.png` (the lone raster) → redrawn as an SVG glyph in the set.
- **License:** carry Lucide's short ISC notice in the repo (e.g. `THIRD-PARTY-NOTICES` / licenses doc) alongside the icons.

### Components touched

`src/editor/components/`: `seButton.ts`, `seExplorerButton.ts`, `seFlyingButton.ts`, `seMenuItem.ts`, `seZoom.ts`.

- Switch icon render from `<img>` → masked element.
- Modernize their **stale `--*-color` tokens → `--se-*`** (these predate M1).
- ⚠️ **`seExplorerButton` is special** — it *generates* icons dynamically (shape library / explorer). It does not consume a static file `src`, so it needs individual handling rather than a blind mask swap; verify its generated markup themes correctly (this is the M1 "seExplorerButton generated icon colors → M4" follow-up).

### Cursors

Redraw the `cursors/` set in the new style. **Constraint:** CSS `cursor: url(…)` cannot inherit a token color (same `<img>`-like limitation). So instead of maintaining light/dark cursor pairs, make each cursor **theme-agnostic** via a contrast outline — a light halo around a dark core (the convention system crosshairs use) so it reads on both the light and dark canvas.

## Verification

- Extend `tests/e2e/theme-chrome.spec.ts` (or a new `icon-theming` spec) to assert a toolbar icon **actually re-themes** — e.g. a `se-button`'s `.se-icon` computed `background-color` differs between light and `data-theme="dark"`, and the active-tool icon resolves to the accent.
- `hex-guard` stays green — component CSS remains tokens-only; the new `.svg` files are outside its scope (mask ignores their color anyway).
- Standard gate: `npm run lint` + `vitest` + e2e **both browsers** before each merge (per the M2 lesson on icon/asset-touching changes).

## Suggested phasing (each its own squash PR)

1. **Pipeline** — mask render in `SeButton` + `--se-icon*` tokens, proven on a handful of icons; e2e theming assertion. *Validates the mechanism end-to-end before any bulk work.*
2. **Bulk remap** — the ~110-120 Lucide swaps at stable filenames.
3. **Specials** — the ~20-30 hand-drawn svg-editor glyphs + `openpath` SVG + ISC notice.
4. **Cursors** — redraw + contrast-outline.
5. **Components + cleanup** — remaining siblings (`seExplorerButton` special-case, `seFlyingButton`, `seMenuItem`, `seZoom`), `--*-color`→`--se-*` modernization, final e2e.

## Risks / open questions

- **`seExplorerButton` dynamic icons** — confirm its generated-icon path can be themed (may need inline `currentColor` there specifically, diverging from the mask approach used elsewhere).
- **Mask fidelity at small sizes** — `size="small"` buttons render at ~14px; confirm Lucide 2px glyphs stay legible when mask-scaled down (phase 1 check).
- **Cursor hotspots** — redrawn cursors must preserve correct hotspot coordinates (`cursor: url(x.svg) <hotx> <hoty>, fallback`).
- **Icon count drift** — exact direct-remap vs hand-fill split is an estimate; finalized during phase 2 mapping.

## References

- Tokens: `src/editor/styles/tokens.css` (M1 two-layer primitive→semantic system).
- Prior milestones: `docs/superpowers/specs/2026-06-02-svgedit-design-system-design.md` (M1), `…-theme-toggle-design.md` (M2), `2026-06-08-svgedit-m3-prompt-dialog-design.md` (M3).
- Conventions: `docs/superpowers/conventions/lit-component-conventions.md` (bullet #4 — the `--se-*` token policy, refreshed 2026-06-09).
- Lucide: https://lucide.dev (ISC). Hand-filled specials follow Lucide's icon design guidelines.
