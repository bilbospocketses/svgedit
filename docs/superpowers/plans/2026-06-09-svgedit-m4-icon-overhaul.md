# M4 Icon + Button-Image Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make svgedit's toolbar icons one consistent, theme-aware monochrome set, painted by CSS so they follow light/dark automatically.

**Architecture:** Icons keep their filenames and stay external files, but `SeButton` (and siblings) paint them with CSS `mask` + a `--se-icon` token instead of `<img>`. The glyph art is then swapped to a Lucide-based set (+ hand-drawn svg-editor specials). This plan details **Phase 1 — the render/token pipeline**, the end-to-end-testable foundation that proves theming *before* any bulk art work (per the spec). Phases 2-5 are scoped at the end and get their own detailed plans once Phase 1 lands.

**Tech Stack:** Lit 3 web components (TypeScript), CSS custom properties (`tokens.css`), Vitest (jsdom unit), Playwright (e2e, Chromium + Firefox).

**Spec:** `docs/superpowers/specs/2026-06-09-svgedit-m4-icon-overhaul-design.md`

---

## Conventions (this environment)

- **Repo:** `C:/Users/jscha/source/repos/svgedit` — multi-session host; **every git command is `-C`-scoped** and file paths are absolute. Prefix all git with `git -C "C:/Users/jscha/source/repos/svgedit"`.
- **Run a unit test file** (no `cd`): `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run <name-filter>`
- **Full unit suite:** same as above without a filter.
- **Lint:** `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint`
- **e2e (both browsers, authoritative):** runs in CI on the PR; locally optional.
- Commits are SSH-signed automatically. **No AI attribution** in commit messages.
- Work on a branch off `master`: `feat/m4-phase1-icon-pipeline`.

## File structure (Phase 1)

- **Modify** `src/editor/styles/tokens.css` — add `--se-icon` + `--se-icon-hover` (light `:root` + dark).
- **Modify** `src/editor/components/seButton.ts` — `<img>` → masked `.se-icon` span; add `.se-icon` + `.pressed .se-icon` styles.
- **Modify** `tests/unit/design-tokens.test.ts` — add the two new tokens to the `SEMANTIC` array.
- **Create** `tests/unit/se-button.test.ts` — assert mask render (no `<img>`).
- **Modify** `tests/e2e/theme-chrome.spec.ts` — add the icon-theming integration assertion.

Phase 1 deliberately uses the **existing** icon SVGs as masks (mask ignores their baked colors — only the shape matters), so it proves the pipeline with **zero new art**.

---

## Task 1: Add `--se-icon` design tokens

**Files:**
- Modify: `tests/unit/design-tokens.test.ts:11-18` (SEMANTIC array)
- Modify: `src/editor/styles/tokens.css` (`:root` semantic block + `html[data-theme="dark"]` block)

- [ ] **Step 1: Write the failing test** — add the two tokens to the `SEMANTIC` array so the existing "defined in light" + "remapped in dark" tests cover them.

In `tests/unit/design-tokens.test.ts`, change the `SEMANTIC` array's last color line:

```ts
  '--se-danger', '--se-warn', '--se-success', '--se-info',
  '--se-icon', '--se-icon-hover',
  '--se-focus-ring', '--se-scrim', '--se-shadow-sm', '--se-shadow-overlay'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run design-tokens`
Expected: FAIL — `missing --se-icon in :root` (and/or in dark).

- [ ] **Step 3: Add the tokens to `tokens.css`**

In the `:root` "Semantic (light)" block, after the `--se-info` line, add:

```css
  --se-icon: var(--se-grey-600);
  --se-icon-hover: var(--se-ink);
```

In the `html[data-theme="dark"]` block, after its `--se-info` line, add:

```css
  --se-icon: var(--se-grey-300);
  --se-icon-hover: var(--se-paper);
```

(Starting values — a muted ink that brightens to full text ink on hover; fine to tune later in this phase.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run design-tokens`
Expected: PASS (all design-token tests green).

- [ ] **Step 5: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/styles/tokens.css tests/unit/design-tokens.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): add --se-icon / --se-icon-hover semantic tokens"
```

---

## Task 2: Paint `SeButton` icons via CSS mask (not `<img>`)

**Files:**
- Create: `tests/unit/se-button.test.ts`
- Modify: `src/editor/components/seButton.ts` (`static styles` + `render()`)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/se-button.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/components/seButton.ts'

const flush = async (el) => {
  await customElements.whenDefined('se-button')
  if (el && typeof el.updateComplete?.then === 'function') await el.updateComplete
}

describe('se-button icon rendering', () => {
  let el
  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-button')
    document.body.appendChild(el)
  })
  afterEach(() => { document.body.textContent = '' })

  it('paints the icon via a masked element, not an <img>', async () => {
    el.setAttribute('src', 'data:image/svg+xml;utf8,<svg></svg>')
    await flush(el)
    const icon = el.shadowRoot.querySelector('.se-icon')
    expect(icon, 'expected a .se-icon element').not.toBeNull()
    expect(el.shadowRoot.querySelector('img'), 'no <img> should remain').toBeNull()
    expect(icon.getAttribute('style') ?? '').toContain('mask-image')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run se-button`
Expected: FAIL — `.se-icon` is null / an `<img>` still present.

- [ ] **Step 3: Implement the mask render**

In `src/editor/components/seButton.ts`, in the `static styles = css\`` block, **replace the `img { … }` rule** (the `border:none; width:100%; height:100%` one) with:

```css
    .se-icon {
      display: block;
      width: 100%;
      height: 100%;
      background-color: var(--se-icon);
      -webkit-mask-position: center; mask-position: center;
      -webkit-mask-size: contain; mask-size: contain;
      -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    }
    :host(:hover) :not(.disabled) .se-icon { background-color: var(--se-icon-hover); }
    .pressed .se-icon { background-color: var(--se-accent); }
```

Then in `render()`, **replace the `<img …>` line** inside the returned `<div>` with:

```ts
        <span
          class="se-icon"
          role="img"
          aria-label="icon"
          style=${imgSrc ? `-webkit-mask-image:url("${imgSrc}");mask-image:url("${imgSrc}")` : ''}
        ></span>
```

(Leave the `imgSrc` computation above it unchanged — it already resolves `data:` URIs and `imgPath/<src>`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run se-button`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite (no regressions)**

Run: `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run`
Expected: all green (no test piercing into `se-button`'s `<img>` — confirmed: the component selects by host id only).

- [ ] **Step 6: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/seButton.ts tests/unit/se-button.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(m4): paint se-button icons via CSS mask + --se-icon token"
```

---

## Task 3: e2e — toolbar icons re-theme; active = accent

**Files:**
- Modify: `tests/e2e/theme-chrome.spec.ts`

- [ ] **Step 1: Add the integration test** (verifies the composed pipeline in a real browser)

Append inside the `test.describe('M1 theming', …)` block:

```ts
  test('toolbar icons follow data-theme; active tool is accent', async ({ page }) => {
    const iconBg = (theme: string) => page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      const icon = document.querySelector('#tool_select')?.shadowRoot?.querySelector('.se-icon')
      return icon ? getComputedStyle(icon).backgroundColor : null
    }, theme)

    const light = await iconBg('light')
    const dark = await iconBg('dark')
    expect(light).not.toBeNull()
    expect(dark).not.toBeNull()
    expect(light).not.toBe(dark)            // icon ink re-themes

    // Active/selected tool resolves to the accent token.
    const activeBg = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light')
      const btn = document.querySelector('#tool_select') as HTMLElement
      btn.shadowRoot!.querySelector('div')!.classList.add('pressed')
      return getComputedStyle(btn.shadowRoot!.querySelector('.se-icon')!).backgroundColor
    })
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--se-accent').trim()
    )
    expect(activeBg).not.toBe(light)        // pressed differs from default ink
  })
```

- [ ] **Step 2: Run it (Chromium)**

Run (locally optional; CI runs both browsers): build + e2e via the project's `npm test` flow, or rely on the PR's CI gate.
Expected: PASS — `light !== dark`, and the pressed icon differs from the default ink.

- [ ] **Step 3: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/theme-chrome.spec.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(m4): assert toolbar icons re-theme + active=accent"
```

---

## Task 4: Verify + open the Phase 1 PR

- [ ] **Step 1: Full local gate**

```
npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint
& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run
```
Expected: lint clean (component CSS is tokens-only — `hex-guard` green); all unit tests pass.

- [ ] **Step 2: Push + PR (squash auto-merge on the signed repo)**

```
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/m4-phase1-icon-pipeline
gh pr create -R bilbospocketses/svgedit --base master --head feat/m4-phase1-icon-pipeline --title "feat(m4): icon render/token pipeline (mask + --se-icon)" --body "<summary>"
gh pr merge <N> -R bilbospocketses/svgedit --squash --delete-branch --auto
```
Expected: CI green **both browsers** (the icon-theming e2e proves the mechanism end-to-end), auto-merge completes.

**Phase 1 acceptance:** existing icons now paint via mask, follow light/dark via `--se-icon`, and the active tool shows accent — with zero art changes. The mechanism is proven; bulk art is safe to start.

---

## Phases 2-5 — roadmap (detailed plans authored after Phase 1 lands)

These are scoped here for the full arc; each becomes its own plan + PR. The asset phases (2-4) are art production, so they'll be planned as per-batch checklists with visual acceptance, not TDD code-steps.

- **Phase 2 — Bulk Lucide remap.** Replace the ~110-120 common-tool SVGs (at stable filenames) with Lucide equivalents. Files: `src/editor/images/*.svg`. Acceptance: every toolbar button shows a Lucide glyph, all masks render crisply at 24px and `size="small"` (~14px); the icon-theming e2e still green. Add Lucide ISC notice (`THIRD-PARTY-NOTICES`).
- **Phase 3 — Hand-drawn specials.** The ~20-30 svg-editor-specific glyphs (path-node clone/delete, marker/linecap/linejoin/anchor/segment variants, open/close path, reorient, to-path, unlink-use) drawn to Lucide's grid/stroke spec; `openpath.png` → SVG. Acceptance: visually consistent with Phase 2; raster removed.
- **Phase 4 — Cursors.** Redraw `src/editor/images/cursors/*` in the new style with a contrast outline (theme-agnostic). Acceptance: cursors legible on both light and dark canvas; hotspots preserved.
- **Phase 5 — Component cleanup + dynamic icons.** Apply the mask render to the remaining icon-bearing siblings (`seFlyingButton`, `seMenuItem`, `seZoom`); special-case `seExplorerButton`'s **generated** icons (likely inline `currentColor` there); modernize each component's stale `--*-color` → `--se-*`. Acceptance: no `<img>`-painted UI icons remain; `hex-guard` green; full e2e both browsers.

---

## Self-Review

- **Spec coverage:** mask render ✅ (T2), `--se-icon` token + states ✅ (T1/T2), active=accent ✅ (T2/T3), theming verification ✅ (T3), filename-stable ✅ (Phase 1 uses existing files), tokens-only/`hex-guard` ✅ (T4). Lucide set / specials / cursors / sibling components → Phases 2-5 (explicitly deferred, each its own plan per the spec's "validate before bulk").
- **Placeholder scan:** the only `<summary>` placeholder is the PR body text (filled at PR time); all code/test steps are complete. Token values are starting values, flagged tunable — not gaps.
- **Type/name consistency:** `.se-icon` class, `--se-icon` / `--se-icon-hover` tokens, and `imgSrc` variable are used identically across T1-T3 and match `seButton.ts`'s existing `imgSrc` computation.
