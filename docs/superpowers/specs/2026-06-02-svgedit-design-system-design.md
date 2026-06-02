# M1 — svgedit Design System (design spec)

- **Date:** 2026-06-02
- **Status:** Approved (brainstorm) → ready for implementation plan
- **Author:** brainstormed with the maintainer (visual companion)
- **Program:** UI Modernization (M1 design system → M2 theme toggle → M3 modals/#13 → M4 icons). This spec covers **M1 only**.

## 1. Context & problem

svgedit's UI is an early-2000s utilitarian look: grey-on-grey chrome (`--main-bg-color #72797A`, canvas `#A0A0A0`–`#B2B2B2`), Win9x beveled toolbars (white top-left / `#5a6162` bottom-right insets), 8pt Verdana, vendor-prefixed shadows, and **colors hardcoded as scattered hex literals** — only ~12 ad-hoc CSS custom properties exist (in `src/editor/svgedit.css`), and there is **no dark-mode support**.

This blocks the broader modernization program: a theme toggle (M2), modal restyle (M3), and icon overhaul (M4) all need a shared, themeable visual language first. M1 establishes that foundation.

## 2. Goals / non-goals

**Goals**
- A token-driven visual system (light + dark) expressed as CSS custom properties.
- Replace the ad-hoc greys + bevels with a flat, modern "neutral pro-tool" look.
- Make the entire editor **chrome** themeable, including Lit shadow-DOM components, with zero per-component theme wiring.
- Migrate **all** hardcoded color/bevel CSS to tokens ("everything now" scope) and add a guard preventing regressions.

**Non-goals (handled by later items)**
- User-facing theme **toggle**, persistence, and embed theme wiring → **M2**.
- The `SePromptDialog` build + native-dialog elimination → **M3** (#13).
- Icon / button-**image** overhaul → **M4**.
- Restyling user **artwork** — the SVG canvas content is user data and is never themed.

## 3. Locked decisions (from brainstorm)

1. **Aesthetic:** Neutral pro-tool (restrained, content-first; VS Code / Figma / Linear family).
2. **Accent:** Teal (`#0D9488` light / `#14B8A6` dark).
3. **Light mode:** "Slate" darkness level — dim grey chrome (`--se-surface #D3D9D9`, `--se-canvas #B7BFBF`), still dark-text light mode; closer to svgedit's heritage mid-grey but flat/clean.
4. **Dark mode:** deep teal-tinted neutrals (`--se-surface #161E1D`).
5. **Token architecture:** two-layer — **primitives → semantic**. Components use semantic tokens only.
6. **M1 scope:** migrate **everything** now (all chrome + component CSS), not just a reference subset.

## 4. Architecture

### 4.1 Token layers
- **Primitives** (theme-independent raw palette): grey ramp, teal ramp, status hues. Raw hex lives **only** here.
- **Semantic** (role-based, theme-dependent): map to primitives; re-mapped per theme. This is the only layer components reference.

### 4.2 File layout
- **New:** `src/editor/styles/tokens.css` — primitives, semantic light (`:root`), semantic dark (`html[data-theme="dark"]`), and scale tokens. Loaded **before** all other styles.
- **New:** `src/editor/styles/theme.ts` — `applyInitialTheme()`: sets `data-theme` from `prefers-color-scheme` at startup (no persistence/toggle — that's M2).
- **Migrate:** `src/editor/svgedit.css` (the `:root` block + base layout/typography/chrome) and every Lit component's `static styles` and per-extension CSS to consume semantic tokens.

### 4.3 Theme mechanism
- A single attribute `html[data-theme="light"|"dark"]` swaps the semantic token values. One flip re-themes the whole app.
- **CSS custom properties inherit through shadow boundaries**, so Lit components using `var(--se-*)` theme automatically — no constructable-stylesheet plumbing or per-component theme props required.
- `color-scheme: light` / `dark` is set per theme so native scrollbars, `<dialog>`, and form controls render correctly.
- **First paint:** `applyInitialTheme()` reads `prefers-color-scheme`. M2 later layers the explicit toggle + `localStorage` persistence (via existing `ConfigObj`/`ext-storage`) + embed `__setTheme` / `?theme=` over this default.

## 5. Token catalog

### 5.1 Primitives (raw — source values)
- **Grey ramp** (cool, slightly teal-tinted), spanning light→dark surfaces: `#F2F4F4, #E6EAEA, #D3D9D9, #C6CCCC, #C1C8C8, #B7BFBF, #A9B3B3, #94A0A0, #6B7A77, #44514E, #3A4845, #293432, #1C2625, #161E1D, #0E1413, #0A0F0E`.
- **Teal ramp** (Tailwind teal): `50 #f0fdfa · 100 #ccfbf1 · 200 #99f6e4 · 300 #5eead4 · 400 #2dd4bf · 500 #14b8a6 · 600 #0d9488 · 700 #0f766e · 800 #115e59 · 900 #134e4a`.
- **Status hues:** red `#DC2626/#F87171`, amber `#D97706/#FBBF24`, green `#16A34A/#4ADE80`, sky `#0EA5E9/#38BDF8`.

> The **semantic table below is the validated source of truth** (each value was reviewed in the visual companion). Implementation maps each semantic token to a primitive (or a tint); exact ramp indexing is an implementation detail and must not change the validated semantic values.

### 5.2 Semantic tokens

| Token | Light | Dark | Role |
|---|---|---|---|
| `--se-bg` | `#C6CCCC` | `#0E1413` | app backdrop |
| `--se-surface` | `#D3D9D9` | `#161E1D` | toolbars, panels, dialogs |
| `--se-surface-2` | `#C1C8C8` | `#1C2625` | inputs, insets |
| `--se-canvas` | `#B7BFBF` | `#0A0F0E` | workarea backdrop (chrome only — NOT artwork) |
| `--se-border` | `#A9B3B3` | `#293432` | hairlines, dividers |
| `--se-border-strong` | `#94A0A0` | `#3A4845` | input borders, stronger separation |
| `--se-text` | `#131C1B` | `#E6ECE9` | primary text |
| `--se-text-muted` | `#44514E` | `#9AABA8` | labels, secondary |
| `--se-text-subtle` | `#6B7A77` | `#6F817E` | placeholders, disabled |
| `--se-accent` | `#0D9488` | `#14B8A6` | primary action, selection, focus |
| `--se-accent-hover` | `#0F766E` | `#2DD4BF` | hover state |
| `--se-accent-active` | `#115E59` | `#5EEAD4` | pressed state |
| `--se-accent-subtle` | `#B6E4DD` | `rgba(45,212,191,.16)` | active tool bg, selected row |
| `--se-on-accent` | `#FFFFFF` | `#04211D` | text/icon on accent fill |
| `--se-danger` | `#DC2626` | `#F87171` | destructive |
| `--se-warn` | `#D97706` | `#FBBF24` | warning |
| `--se-success` | `#16A34A` | `#4ADE80` | success |
| `--se-info` | `#0EA5E9` | `#38BDF8` | info |
| `--se-focus-ring` | `color-mix(in srgb, var(--se-accent) 55%, transparent)` | same | keyboard focus outline |
| `--se-scrim` | `rgba(15,25,23,.45)` | `rgba(0,0,0,.6)` | modal backdrop |
| `--se-shadow-overlay` | `0 10px 26px rgba(10,22,20,.3)` | `0 12px 32px rgba(0,0,0,.55)` | dialogs/popovers |
| `--se-shadow-sm` | `0 1px 2px rgba(10,22,20,.18)` | `0 1px 2px rgba(0,0,0,.5)` | raised controls |

### 5.3 Scale tokens
- **Type:** `--se-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Sizes `--se-text-xs 11px · -sm 12 · -base 13 · -md 15 · -lg 18`. Weights `--se-fw-normal 400 · -medium 500 · -semibold 600`. Line-heights `--se-lh-tight 1.25 · -normal 1.5`.
- **Space** (4px base): `--se-space-1 4 · -2 6 · -3 8 · -4 11 · -5 14 · -6 18 · -7 24`.
- **Radius:** `--se-radius-sm 6 · -md 8 · -lg 10 · -pill 999px`.
- **Density (control metrics):** `--se-control-h 28px · --se-tool-size 26px · --se-toolbar-h 36px`.

## 6. Migration plan ("everything now")

Executed as a chain of small, green PRs (each: vitest 727 + e2e 262 + lint + build pass):

- **PR-0 (this branch, `docs:`):** this spec + the implementation plan.
- **PR-1 (`feat:`):** `tokens.css` (primitives + semantic + scales) + `theme.ts` (`applyInitialTheme`) + `color-scheme` wiring; migrate `svgedit.css` `:root` + base typography (8pt Verdana → 13px system). Add the hex-guard lint in **warn** mode.
- **PR-2 (`feat:`):** migrate core chrome — toolbar, tool rail, side panels, menus, buttons, inputs, rulers; remove Win9x bevels.
- **PR-3 (`feat:`):** migrate Lit component `static styles` (dialogs incl. `SePlainAlertDialog`, panels, pickers). *This tokenizes existing modals — so M3's visual half largely folds into M1.*
- **PR-4 (`feat:`):** migrate per-extension CSS; flip the hex-guard to **error** (enforced).

### 6.1 Completeness guard
After migration, raw `#hex` is permitted **only** in `tokens.css`. Enforced by a stylelint rule (preferred) or a CI grep over CSS + Lit `static styles`:
`grep -rEn "#[0-9a-fA-F]{3,8}\b"` across `src/**/*.css` and component style blocks must return nothing outside `tokens.css`.
**Excluded from the guard:** raw SVG icon assets and any user-content/canvas paths (icon hex → `currentColor` is **M4**, not M1).

## 7. Edge cases

- **User artwork is never themed.** Only chrome + `--se-canvas` (workarea backdrop) are tokenized. The `#svgcanvas` SVG content is user data. Test: a drawn shape's computed fill is identical under `data-theme=light` and `dark`.
- **Export / print:** exported SVG and print output must not embed theme tokens or change with theme. Verify export bytes unaffected.
- **Embed / iframe:** tokens cascade normally; the iframe respects `prefers-color-scheme` on first paint. Host-driven theming (`__setTheme` / `?theme=`) is M2.
- **Windows forced-colors / high-contrast:** out of M1 scope, but the token layer makes a future high-contrast theme tractable (noted for M2/a11y).

## 8. Testing

- **Unit (vitest):** parse `tokens.css`; assert every semantic token is defined in both `:root` and `html[data-theme="dark"]`; assert no semantic token resolves to `inherit`/empty.
- **E2E (Playwright):** load the editor in light and dark (set `data-theme`); assert key chrome elements have the expected themed computed styles; capture light + dark screenshots. Assert the artwork-not-themed invariant (§7).
- **Lint guard:** the hex-guard (§6.1).
- **Regression:** existing **727 unit / 262 e2e** stay green; `npm run build` green.

## 9. Boundary & relationship to the program

- **In M1:** tokens, theme mechanism, `prefers-color-scheme` default, migrate-all chrome + component CSS, hex-guard, tests.
- **M2 (next):** toggle control, persistence (`ConfigObj`/`ext-storage` → localStorage), embed `__setTheme` / `?theme=`, override of the system default.
- **M3 (#13):** `SePromptDialog` + `sePrompt()`, swap the 9 native `alert`/`prompt` sites, wire the embed prompt handler, document the `beforeunload` limitation. *Visual half mostly absorbed by M1 PR-3.*
- **M4:** icon + button-image overhaul; migrate icon hex → `currentColor` so icons follow the theme.

## 10. Open items for the plan (not blocking)
- Choose stylelint rule vs CI grep for the hex-guard (both viable; decide in plan).
- Confirm the single global load point for `tokens.css` (where `svgedit.css` is currently imported) during PR-1.
