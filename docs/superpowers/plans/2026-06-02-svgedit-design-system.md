# M1 — svgedit Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a two-layer CSS-custom-property design-token system (light + dark) and migrate the entire svgedit editor chrome to consume it, replacing ad-hoc greys + Win9x bevels with a flat "neutral pro-tool" teal look.

**Architecture:** `tokens.css` defines **primitives** (raw grey/teal/status palette) and **semantic** tokens (`--se-surface`, `--se-text`, `--se-accent`, …). Semantics are defined on `:root` (light) and re-mapped under `html[data-theme="dark"]`. CSS custom properties inherit through shadow DOM, so Lit components theme automatically. A tiny `theme.ts` sets the initial theme from `prefers-color-scheme`. All hardcoded color/bevel CSS migrates to semantic tokens; a hex-guard script prevents regressions.

**Tech Stack:** TypeScript, Lit 3, Vite, Vitest (unit), Playwright (e2e), ESLint. Node ESM scripts.

**Spec:** `docs/superpowers/specs/2026-06-02-svgedit-design-system-design.md`

---

## Branching & PR mapping

- The **spec + this plan** live on branch `docs/m1-design-system` → ship as the **spec/plan PR** (PR-0, `docs:`).
- Implementation ships as a chain of `feat:` PRs, each branched from latest master, each green:
  - **PR-1** = Tasks 1–5 (foundation: tokens, theme mechanism, `:root`/base migration, hex-guard in warn mode, theming tests)
  - **PR-2** = Task 6 (full `svgedit.css` chrome migration)
  - **PR-3** = Tasks 7–11 (Lit component/dialog `static styles` migration)
  - **PR-4** = Tasks 12–13 (extensions migration + exclusion audit + flip hex-guard to error)
- Merge via `gh pr merge --squash --delete-branch` (signed-repo rule). Each PR keeps **727 unit / 262 e2e** green + `npm run build` green.

## Verification commands (used throughout)

- Lint: `npm run lint`
- Unit (all): `npx vitest run` · single file: `npx vitest run tests/unit/<file>.test.ts`
- E2E: `npm test` runs lint + vitest + Playwright via `scripts/run-e2e.ts` (e2e server on port 9000)
- Build: `npm run build`
- Hex-guard: `node scripts/check-no-raw-hex.mjs` (added in Task 4)

## Shared migration mapping (Tasks 6–13)

Migration is mechanical but **role-based** — map each hardcoded value to the semantic token matching its *role*, never to a primitive or raw hex:

| Current pattern | Replace with |
|---|---|
| app/page backdrop greys (`#72797A`) | `var(--se-bg)` |
| toolbar / panel / menu / dialog surface (`#E8E8E8`, `#CCC`, white panels) | `var(--se-surface)` |
| input / inset / secondary surface (`#eee`, `#F5F7F7`) | `var(--se-surface-2)` |
| workarea/canvas backdrop (`#A0A0A0`, `#B2B2B2`) | `var(--se-canvas)` |
| hairline/divider borders (`#808080`) | `var(--se-border)` |
| input / control borders | `var(--se-border-strong)` |
| primary text (`#000`) | `var(--se-text)` |
| secondary/label text (`#666`) | `var(--se-text-muted)` |
| placeholder/disabled (`#ccc` on dark text) | `var(--se-text-subtle)` |
| links / active accent (`#19c`, `#f9bc01` orange, `#2B3C45`) | `var(--se-accent)` / `var(--se-accent-subtle)` for active-tool bg |
| destructive (reds) | `var(--se-danger)` |
| tooltip yellow (`#FFC`) | `var(--se-surface-2)` bg + `var(--se-border)` |
| **bevels** — `outset`/`inset` + light(`#FFF`)/dark(`#5a6162`) border pairs | a single flat `1px solid var(--se-border)` (delete the bevel pair) |
| `box-shadow` (incl. `-moz-`/`-webkit-` prefixed) | `var(--se-shadow-sm)` (raised control) or `var(--se-shadow-overlay)` (dialog/popover); drop vendor prefixes |
| `font-family: Verdana,…` | `var(--se-font-sans)` |
| `font-size: 8pt` / other `pt` | nearest px scale token (`--se-text-base 13px`, etc.) |
| radius literals | `--se-radius-sm/md/lg` |

**NEVER migrate (data, not chrome — leave the literal hex):**
- `src/embed/palette-defaults.ts` (swatch palette = user data)
- `src/editor/locale/lang.en.ts` (hex inside a translation string)
- `src/editor/ConfigObj.ts` default canvas/background colors (the default color of a *new document* is user artwork data, not chrome)
- Any SVG **artwork** / `#svgcanvas` content and **exported/printed** SVG
- Raw SVG **icon** asset fills (handled in M4)

---

## Task 1: Create the token stylesheet

**Files:**
- Create: `src/editor/styles/tokens.css`
- Test: `tests/unit/design-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/design-tokens.test.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../../src/editor/styles/tokens.css', import.meta.url)),
  'utf8'
)

const SEMANTIC = [
  '--se-bg', '--se-surface', '--se-surface-2', '--se-canvas',
  '--se-border', '--se-border-strong',
  '--se-text', '--se-text-muted', '--se-text-subtle',
  '--se-accent', '--se-accent-hover', '--se-accent-active', '--se-accent-subtle', '--se-on-accent',
  '--se-danger', '--se-warn', '--se-success', '--se-info',
  '--se-focus-ring', '--se-scrim', '--se-shadow-sm', '--se-shadow-overlay'
]

function block(selector: string): string {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 's')
  return css.match(re)?.[1] ?? ''
}

describe('design tokens', () => {
  const light = block(':root')
  const dark = block('html\\[data-theme="dark"\\]')

  it('defines every semantic token in light (:root)', () => {
    for (const t of SEMANTIC) expect(light, `missing ${t} in :root`).toContain(`${t}:`)
  })

  it('remaps the color semantic tokens in dark', () => {
    // focus-ring derives from --se-accent (which remaps), so dark need not redefine it
    const themeable = SEMANTIC.filter((t) => t !== '--se-focus-ring')
    for (const t of themeable) expect(dark, `missing ${t} in dark`).toContain(`${t}:`)
  })

  it('sets color-scheme for both themes', () => {
    expect(light).toContain('color-scheme: light')
    expect(dark).toContain('color-scheme: dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: FAIL — `ENOENT` (tokens.css does not exist yet).

- [ ] **Step 3: Create `tokens.css` with the full token system**

```css
/* src/editor/styles/tokens.css
 * svgedit design tokens — two layers: primitives (raw palette) → semantic (role-based).
 * Components use ONLY semantic tokens. Raw #hex is allowed in THIS FILE ONLY.
 */
:root {
  /* ===== Primitives (theme-independent) ===== */
  /* Cool grey ramp */
  --se-grey-25:#F2F4F4; --se-grey-50:#E6EAEA; --se-grey-100:#D3D9D9; --se-grey-150:#C6CCCC;
  --se-grey-200:#C1C8C8; --se-grey-250:#B7BFBF; --se-grey-300:#A9B3B3; --se-grey-400:#94A0A0;
  --se-grey-500:#6B7A77; --se-grey-600:#44514E; --se-grey-700:#3A4845; --se-grey-750:#293432;
  --se-grey-800:#1C2625; --se-grey-850:#161E1D; --se-grey-900:#0E1413; --se-grey-950:#0A0F0E;
  --se-ink:#131C1B;    /* light near-black text */
  --se-paper:#E6ECE9;  /* dark near-white text */
  --se-grey-450:#6F817E; /* dark subtle text */
  --se-grey-550:#9AABA8; /* dark muted text */
  /* Teal ramp */
  --se-teal-100:#CCFBF1; --se-teal-200:#99F6E4; --se-teal-300:#5EEAD4; --se-teal-400:#2DD4BF;
  --se-teal-500:#14B8A6; --se-teal-600:#0D9488; --se-teal-700:#0F766E; --se-teal-800:#115E59;
  --se-teal-subtle:#B6E4DD;
  /* Status */
  --se-red-600:#DC2626; --se-red-400:#F87171; --se-amber-600:#D97706; --se-amber-400:#FBBF24;
  --se-green-600:#16A34A; --se-green-400:#4ADE80; --se-sky-500:#0EA5E9; --se-sky-400:#38BDF8;

  /* ===== Semantic (light) ===== */
  color-scheme: light;
  --se-bg: var(--se-grey-150);
  --se-surface: var(--se-grey-100);
  --se-surface-2: var(--se-grey-200);
  --se-canvas: var(--se-grey-250);
  --se-border: var(--se-grey-300);
  --se-border-strong: var(--se-grey-400);
  --se-text: var(--se-ink);
  --se-text-muted: var(--se-grey-600);
  --se-text-subtle: var(--se-grey-500);
  --se-accent: var(--se-teal-600);
  --se-accent-hover: var(--se-teal-700);
  --se-accent-active: var(--se-teal-800);
  --se-accent-subtle: var(--se-teal-subtle);
  --se-on-accent: #FFFFFF;
  --se-danger: var(--se-red-600);
  --se-warn: var(--se-amber-600);
  --se-success: var(--se-green-600);
  --se-info: var(--se-sky-500);
  --se-focus-ring: color-mix(in srgb, var(--se-accent) 55%, transparent);
  --se-scrim: rgba(15,25,23,.45);
  --se-shadow-sm: 0 1px 2px rgba(10,22,20,.18);
  --se-shadow-overlay: 0 10px 26px rgba(10,22,20,.3);

  /* ===== Scales (theme-independent) ===== */
  --se-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --se-text-xs:11px; --se-text-sm:12px; --se-text-base:13px; --se-text-md:15px; --se-text-lg:18px;
  --se-fw-normal:400; --se-fw-medium:500; --se-fw-semibold:600;
  --se-lh-tight:1.25; --se-lh-normal:1.5;
  --se-space-1:4px; --se-space-2:6px; --se-space-3:8px; --se-space-4:11px;
  --se-space-5:14px; --se-space-6:18px; --se-space-7:24px;
  --se-radius-sm:6px; --se-radius-md:8px; --se-radius-lg:10px; --se-radius-pill:999px;
  --se-control-h:28px; --se-tool-size:26px; --se-toolbar-h:36px;
}

html[data-theme="dark"] {
  color-scheme: dark;
  --se-bg: var(--se-grey-900);
  --se-surface: var(--se-grey-850);
  --se-surface-2: var(--se-grey-800);
  --se-canvas: var(--se-grey-950);
  --se-border: var(--se-grey-750);
  --se-border-strong: var(--se-grey-700);
  --se-text: var(--se-paper);
  --se-text-muted: var(--se-grey-550);
  --se-text-subtle: var(--se-grey-450);
  --se-accent: var(--se-teal-500);
  --se-accent-hover: var(--se-teal-400);
  --se-accent-active: var(--se-teal-300);
  --se-accent-subtle: rgba(45,212,191,.16);
  --se-on-accent: #04211D;
  --se-danger: var(--se-red-400);
  --se-warn: var(--se-amber-400);
  --se-success: var(--se-green-400);
  --se-info: var(--se-sky-400);
  --se-scrim: rgba(0,0,0,.6);
  --se-shadow-sm: 0 1px 2px rgba(0,0,0,.5);
  --se-shadow-overlay: 0 12px 32px rgba(0,0,0,.55);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/styles/tokens.css tests/unit/design-tokens.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M1 design tokens (primitives + semantic light/dark)"
```

---

## Task 2: Theme bootstrap (`theme.ts`) + load `tokens.css` first

**Files:**
- Create: `src/editor/styles/theme.ts`
- Test: `tests/unit/theme.test.ts`
- Modify: the editor entry that imports `svgedit.css` (confirm location in Step 3 — `src/editor/editorInit.ts` or `src/editor/index.*`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/theme.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSystemTheme, applyTheme, applyInitialTheme } from '../../src/editor/styles/theme'

function mockPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: dark && q.includes('dark'),
    media: q, addEventListener() {}, removeEventListener() {}
  }))
}

describe('theme bootstrap', () => {
  beforeEach(() => { document.documentElement.removeAttribute('data-theme') })

  it('reads the OS preference', () => {
    mockPrefersDark(true); expect(getSystemTheme()).toBe('dark')
    mockPrefersDark(false); expect(getSystemTheme()).toBe('light')
  })

  it('applyTheme sets the html data-theme attribute', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applyInitialTheme applies the OS preference', () => {
    mockPrefersDark(true); applyInitialTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/theme.test.ts`
Expected: FAIL — cannot resolve `../../src/editor/styles/theme`.

- [ ] **Step 3: Implement `theme.ts`**

```ts
// src/editor/styles/theme.ts
export type Theme = 'light' | 'dark'

/** OS-level color-scheme preference. */
export function getSystemTheme(): Theme {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Apply a theme by setting the document attribute the token sheet keys off. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/**
 * M1: set the initial theme from the OS preference.
 * M2 will layer an explicit toggle + persistence on top of this.
 */
export function applyInitialTheme(): void {
  applyTheme(getSystemTheme())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/theme.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire `tokens.css` + `applyInitialTheme()` into startup**

Find the editor entry that currently imports `./svgedit.css`:
Run: `grep -rn "svgedit.css" src/editor`
In that file, add the token import **before** the `svgedit.css` import so tokens cascade first:

```ts
import './styles/tokens.css'
import './svgedit.css'
```

In the editor startup (top of the init in `src/editor/editorInit.ts`, before the editor renders), import and call:

```ts
import { applyInitialTheme } from './styles/theme'
// …at the very start of editor startup:
applyInitialTheme()
```

- [ ] **Step 6: Verify build + full suite**

Run: `npm run build`  → Expected: success.
Run: `npm test` → Expected: lint clean, **727 unit + 2 new files** pass, **262 e2e** pass.

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/styles/theme.ts tests/unit/theme.test.ts src/editor/editorInit.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M1 theme bootstrap (prefers-color-scheme) + load tokens first"
```

---

## Task 3: Migrate `svgedit.css` `:root` + base typography to tokens

**Files:**
- Modify: `src/editor/svgedit.css:1-36` (the `:root` block and `.svg_editor` base rule)

- [ ] **Step 1: Replace the legacy `:root` block**

The current block (lines 1-14) defines 11 ad-hoc vars. Replace it so the **old variable names alias the new semantic tokens** (keeps existing `var(--main-bg-color)` references working until they're swept in Task 6):

```css
:root {
  /* Legacy aliases → semantic tokens (transitional; removed as references migrate in Task 6) */
  --main-bg-color: var(--se-bg);
  --text-color: var(--se-text);
  --border-color: var(--se-border);
  --canvas-bg-color: var(--se-canvas);
  --link-color: var(--se-accent);
  --ruler-color: var(--se-surface-2);
  --icon-bg-color: var(--se-surface);
  --icon-bg-color-hover: var(--se-accent-subtle);
  --input-color: var(--se-surface-2);
  --orange-color: var(--se-accent);
  --global-se-spin-input-width: 82px;
  --top-toolbar-min-height: var(--se-toolbar-h);
}
```

- [ ] **Step 2: Migrate the `.svg_editor` base rule typography**

In the `.svg_editor` rule (was lines 20-36) replace:
```css
  font-size: 8pt;
  font-family: Verdana, Helvetica, Arial;
```
with:
```css
  font-size: var(--se-text-base);
  font-family: var(--se-font-sans);
```
(Leave the grid layout, `background: var(--main-bg-color)`, `color: var(--text-color)` — those now resolve through the aliases.)

- [ ] **Step 3: Verify build + visual smoke (both themes)**

Run: `npm run build` → Expected: success.
Run: `npm start`, open `http://localhost:8000/src/editor/index.html`; in devtools console run `document.documentElement.setAttribute('data-theme','dark')` then `'light'`. Expected: chrome background/text/borders follow the Slate light + dark token values; no layout breakage; **text is 13px system font, not 8pt Verdana**.

- [ ] **Step 4: Run full suite**

Run: `npm test` → Expected: 727 unit + 262 e2e green (computed colors changed, but these suites assert behavior/layout, not color values; if any e2e asserts a legacy color, update it to the token value and note it in the commit).

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/svgedit.css
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M1 migrate svgedit.css :root + base typography to tokens"
```

---

## Task 4: Hex-guard script + light/dark + artwork-not-themed tests

**Files:**
- Create: `scripts/check-no-raw-hex.mjs`
- Create: `tests/e2e/theme-chrome.spec.ts`
- Modify: `package.json` (add `lint:hex` script; chain into `lint`)

- [ ] **Step 1: Write the hex-guard script (warn mode default)**

```js
// scripts/check-no-raw-hex.mjs
// Fails (or warns) if a raw #hex color appears in chrome CSS / Lit `static styles`
// outside the allowlist. Run: node scripts/check-no-raw-hex.mjs [--error]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SRC = join(ROOT, 'src')
const ERROR = process.argv.includes('--error')

// Files that legitimately contain raw hex (data, not chrome).
const ALLOW = [
  'src/editor/styles/tokens.css',
  'src/embed/palette-defaults.ts',
  'src/editor/locale/lang.en.ts',
  'src/editor/ConfigObj.ts'
].map((p) => p.replace(/\//g, require('node:path').sep))

const HEX = /#[0-9a-fA-F]{3,8}\b/

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(css|ts)$/.test(e)) out.push(p)
  }
  return out
}

const violations = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (ALLOW.some((a) => rel.endsWith(a))) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    // ignore hex inside obvious data contexts: SVG path/asset strings handled by extension; here flag CSS/style hex
    if (HEX.test(line)) violations.push(`${rel}:${i + 1}: ${line.trim()}`)
  })
}

if (violations.length) {
  const head = `[check-no-raw-hex] ${violations.length} raw hex outside tokens.css:`
  console[ERROR ? 'error' : 'warn'](head + '\n' + violations.join('\n'))
  if (ERROR) process.exit(1)
} else {
  console.log('[check-no-raw-hex] clean')
}
```

(Note: the `require('node:path').sep` inline is avoided in ESM — replace with importing `sep`:)

```js
import { sep } from 'node:path'
// …then in ALLOW mapping use: .map((p) => p.split('/').join(sep))
```

- [ ] **Step 2: Add npm scripts**

In `package.json` scripts, add:
```json
"lint:hex": "node scripts/check-no-raw-hex.mjs"
```
Chain it (warn mode) into the existing `lint` so it runs but does not fail yet (PR-1):
```json
"lint": "eslint . && npm run lint:hex"
```

- [ ] **Step 3: Run the guard — expect MANY warnings (not failure)**

Run: `node scripts/check-no-raw-hex.mjs`
Expected: warns with the full backlog (svgedit.css + ~24 component files). Exit code 0 (warn mode). This baseline is what Tasks 6–13 drive to zero.

- [ ] **Step 4: Write the theme e2e (light/dark chrome + artwork-not-themed)**

```ts
// tests/e2e/theme-chrome.spec.ts
import { test, expect } from '@playwright/test'

// Mirrors existing specs in tests/e2e/ for editor bootstrap (baseURL → port 9000).
test.describe('M1 theming', () => {
  test('chrome surface follows data-theme; artwork does not', async ({ page }) => {
    await page.goto('/src/editor/index.html')
    await page.waitForSelector('.svg_editor')

    const surfaceLight = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light')
      return getComputedStyle(document.querySelector('.svg_editor')!).backgroundColor
    })
    const surfaceDark = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
      return getComputedStyle(document.querySelector('.svg_editor')!).backgroundColor
    })
    expect(surfaceLight).not.toBe(surfaceDark) // chrome re-themes

    // Draw a rect via the canvas API, capture its fill under both themes.
    const fillFor = async (theme: string) =>
      page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t)
        const c = window.svgCanvas ?? window.svgEditor?.svgCanvas
        const r = c.addSVGElementsFromJson({
          element: 'rect',
          attr: { x: 10, y: 10, width: 20, height: 20, fill: '#ff0000', id: 'm1_probe' }
        })
        return getComputedStyle(r).fill
      }, theme)
    const artLight = await fillFor('light')
    const artDark = await fillFor('dark')
    expect(artLight).toBe(artDark) // user artwork is NEVER themed
    expect(artLight).toContain('255, 0, 0')
  })
})
```

(If `window.svgCanvas` is not the harness's exposed handle, align with the accessor used by sibling specs in `tests/e2e/` — confirm via `grep -rn "svgCanvas" tests/e2e`.)

- [ ] **Step 5: Run e2e for the new spec**

Run: `npm test` (or the project's targeted e2e invocation for one spec).
Expected: the new spec passes; existing 262 still green (new total 263+).

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add scripts/check-no-raw-hex.mjs package.json tests/e2e/theme-chrome.spec.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M1 hex-guard (warn) + light/dark + artwork-not-themed e2e"
```

> **PR-1 ships here.** Open `feat:` PR with Tasks 1–4; merge squash once green.

---

## Task 6: Migrate the full `svgedit.css` chrome (PR-2)

**Files:**
- Modify: `src/editor/svgedit.css` (all remaining hardcoded colors/bevels — 39 hex hits + bevel pairs + box-shadows)

- [ ] **Step 1: Inventory this file's literals**

Run: `node scripts/check-no-raw-hex.mjs 2>&1 | grep svgedit.css`
Also: `grep -nE "outset|inset|box-shadow|#[0-9a-fA-F]{3,8}" src/editor/svgedit.css`

- [ ] **Step 2: Apply the shared mapping** (see "Shared migration mapping" above)

For every reported line, replace the literal with the role-appropriate `var(--se-*)`. Specifically: `#A0A0A0`/`#B2B2B2` → `var(--se-canvas)`; `#E8E8E8`/white panels → `var(--se-surface)`; `#eee` → `var(--se-surface-2)`; `#808080` → `var(--se-border)`; `#000`→`var(--se-text)`; `#666`→`var(--se-text-muted)`; `#FFC` tooltip → `background: var(--se-surface-2); border:1px solid var(--se-border)`; the bevel pairs (`border-left/top:#FFF; border-right/bottom:#5a6162` + `outset`/`inset`) → delete and use flat `1px solid var(--se-border)`; `box-shadow: #555 1px 1px 4px` (+ `-moz-`/`-webkit-`) → `box-shadow: var(--se-shadow-sm)`. Also remove the now-unused **legacy aliases** from Task 3's `:root` once no `var(--main-bg-color)` etc. references remain (`grep -n "main-bg-color\|icon-bg-color\|orange-color\|canvas-bg-color\|input-color\|ruler-color\|link-color\|text-color\|border-color" src/editor/svgedit.css`).

- [ ] **Step 3: Verify guard + build + visual + suite**

Run: `node scripts/check-no-raw-hex.mjs 2>&1 | grep svgedit.css` → Expected: no lines (file clean).
Run: `npm run build` → success.
Visual smoke (both themes, per Task 3 Step 3): toolbar, rulers, workarea, side panels, menus render flat + themed; no bevels remain.
Run: `npm test` → 727 unit / 263 e2e green.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/svgedit.css
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M1 migrate svgedit.css chrome to tokens (flat, themeable)"
```

> **PR-2 ships here.**

---

## Tasks 7–11: Migrate Lit component `static styles` (PR-3)

Each task = migrate one file group's `css\`…\`` blocks per the **shared mapping**, then verify. **Per-task verification (identical for each):**
- `node scripts/check-no-raw-hex.mjs 2>&1 | grep <file>` → no lines.
- `npm run build` → success.
- Visual smoke of that component in light + dark.
- `npx vitest run` (unit) green; run `npm test` once at end of PR-3 for full e2e.
Commit after each task: `git -C "C:/Users/jscha/source/repos/svgedit" add <files> && git -C … commit -m "feat: M1 migrate <group> to tokens"`.

- [ ] **Task 7 — Dialogs (heavy): `src/editor/dialogs/editorPreferencesDialog.ts`** (41 hex — largest single file; do alone). Map per roles; watch for nested rule colors. Verify + commit.

- [ ] **Task 8 — Dialogs (rest):** `SePlainAlertDialog.ts` (the `#CCC`/`outset` Win9x box → flat `var(--se-surface)` + `var(--se-border)` + `var(--se-shadow-overlay)`; backdrop → `var(--se-scrim)`), `seStatusDialog.ts`, `cmenuDialog.ts`, `cmenuLayersDialog.ts`, `exportDialog.ts`, `imagePropertiesDialog.ts`, `svgSourceDialog.ts`. Verify + commit.

- [ ] **Task 9 — jgraduate color components:** `src/editor/components/jgraduate/se-gradient-editor.ts` (23), `se-color-picker.ts` (9), `se-color-slider.ts` (4), `se-gradient-stop.ts` (2). **Caution:** these render color *pickers* — distinguish *chrome* (panel/border/label → tokens) from *color-data swatches/gradients* (the user-selected colors — leave as dynamic values, do NOT tokenize). Verify + commit.

- [ ] **Task 10 — Other components:** `seDropdown.ts`, `seMenu.ts`, `seExplorerButton.ts`, `seZoom.ts`, `PaintBox.ts`, `sePalette.ts` (chrome only — the swatch colors are data), `seInput.ts`, `seSpinInput.ts`. Verify + commit.

- [ ] **Task 11 — Panels + rulers:** `src/editor/panels/TopPanel.ts` (bevels/box-shadow → tokens), `src/editor/Rulers.ts` (1 hex → `var(--se-border)`/`var(--se-text-muted)` per role). Verify + commit. At end of PR-3 run full `npm test` (727 / 263 green).

> **PR-3 ships here** (Tasks 7–11 squashed or as one PR).

---

## Task 12: Migrate extensions + audit exclusions (PR-4)

**Files:**
- Modify: `src/editor/extensions/ext-storage/storageDialog.ts` (4), `src/editor/extensions/ext-overview_window/ext-overview_window.ts` (1)
- Audit (no change expected): `src/embed/palette-defaults.ts`, `src/editor/locale/lang.en.ts`, `src/editor/ConfigObj.ts`

- [ ] **Step 1: Migrate the two extension files** per the shared mapping (chrome only). Verify each: `node scripts/check-no-raw-hex.mjs 2>&1 | grep <file>` → no lines.

- [ ] **Step 2: Audit the data files** — confirm each remaining hex in `palette-defaults.ts`, `lang.en.ts`, `ConfigObj.ts` is genuinely *data/user-default*, not chrome. If any chrome color hides here, migrate it; otherwise they stay allowlisted in the guard.

- [ ] **Step 3: Verify**

Run: `node scripts/check-no-raw-hex.mjs` → Expected: only allowlisted files remain (script prints "clean" since allowlisted files are skipped).
Run: `npm run build` → success. `npm test` → 727 / 263 green.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/extensions
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M1 migrate extension CSS to tokens"
```

---

## Task 13: Flip the hex-guard to enforcing

**Files:**
- Modify: `src/editor/svgedit.css`? no — `package.json`

- [ ] **Step 1: Switch the guard to error mode**

In `package.json`, change the chained lint to fail on violations:
```json
"lint": "eslint . && node scripts/check-no-raw-hex.mjs --error"
```

- [ ] **Step 2: Verify it now enforces**

Run: `npm run lint` → Expected: passes (all chrome migrated; only allowlisted data files contain hex).
Temporarily add a `color:#123456` to any component to confirm the guard FAILS (exit 1), then revert.

- [ ] **Step 3: Full suite + commit**

Run: `npm test` → 727 / 263 green.
```bash
git -C "C:/Users/jscha/source/repos/svgedit" add package.json
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore: M1 enforce hex-guard (no raw hex outside tokens.css)"
```

> **PR-4 ships here. M1 complete** — token system live, whole chrome themeable in light + dark, regressions guarded. Next program item: **M2** (#22 — theme toggle + persistence).

---

## Self-review

**Spec coverage:**
- §4.1 two-layer tokens → Task 1 ✓ · §4.2 file layout (`tokens.css`, `theme.ts`, migrate `svgedit.css`) → Tasks 1–3 ✓ · §4.3 mechanism (`data-theme`, shadow-DOM cascade, `color-scheme`, `applyInitialTheme`) → Tasks 1,2 ✓
- §5 token catalog (semantic + primitives + scales) → Task 1 (full `tokens.css`) ✓
- §6 migration + chunked PRs → Tasks 3,6,7–11,12 ✓ · §6.1 hex-guard + exclusions → Tasks 4,12,13 ✓
- §7 edge cases (artwork/export not themed) → Task 4 e2e (artwork) ✓; export-unaffected → **covered by exclusion + artwork test**; add explicit export check if desired (low risk — export serializes the SVG DOM, which carries no chrome tokens).
- §8 testing (token presence, light/dark e2e, artwork invariant, regression, guard) → Tasks 1,4 ✓
- §9 boundary (M2/M3/M4 out) → respected; no toggle/persistence/prompt-modal/icons here ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Migration tasks reference a fully-specified deterministic mapping + per-file verification (not vague). One flagged inline note: the e2e canvas-handle accessor (`window.svgCanvas`) must be confirmed against sibling specs — instruction given, not a blank.

**Type/name consistency:** `applyInitialTheme`/`applyTheme`/`getSystemTheme`/`Theme` consistent across Task 2 and its test. Token names in Task 1 match the mapping table and the spec §5.2. Guard script + npm `lint:hex`/`lint` names consistent across Tasks 4 and 13.

---
