# M2 — svgedit Theme Toggle + Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-click top-bar sun/moon toggle that switches light↔dark, persists the choice (survives reload), drives host-embed theming through M1's tokens, and re-themes the canvas-drawn rulers.

**Architecture:** Extend M1's `src/editor/styles/theme.ts` (pure DOM theme ops + a `svgedit-themechange` CustomEvent). Persist via the existing `ConfigObj.pref('theme')` → `ext-storage` → localStorage. A new `se-theme-toggle` Lit component lives in the top bar. The embed `__setTheme`/`?theme=` path is rerouted from the legacy class-based `src/embed/theme.ts` to M1's `html[data-theme]` mechanism. `Rulers` (Canvas 2D) subscribes to the event and redraws with a token-resolved ink color.

**Tech Stack:** TypeScript, Lit 3, Vite, Vitest, Playwright. Builds on M1 (master `e44dcf8f`).

**Spec:** `docs/superpowers/specs/2026-06-02-svgedit-theme-toggle-design.md`

---

## Branching & PR mapping
- **Spec + this plan** on `docs/m2-theme-toggle` → **docs PR** (`docs:`).
- Implementation: ONE `feat:` PR (`feat/m2-theme-toggle` from master) with the 5 task-commits below (M2 is a single cohesive feature — no need to split like M1).
- Merge via `gh pr merge --squash --delete-branch`. Keep vitest + e2e + `npm run lint` (incl. enforcing hex-guard) green.

## Verification commands
- Unit (one file): `npx vitest run tests/unit/<f>.test.ts` · all: `npx vitest run`
- Lint (incl. hex-guard): `npm run lint`
- Build: `npm run build`
- E2E: `npm test` (lint + vitest + Playwright on port 9000)

---

## Task 1: Extend `theme.ts` (toggle/current/event/resolve)

**Files:**
- Modify: `src/editor/styles/theme.ts`
- Test: `tests/unit/theme.test.ts` (extend existing)

- [ ] **Step 1: Add failing tests** — append inside the existing `describe('theme bootstrap', …)` in `tests/unit/theme.test.ts`:

```ts
  it('getCurrentTheme reads the html attribute (defaults light)', () => {
    document.documentElement.removeAttribute('data-theme')
    expect(getCurrentTheme()).toBe('light')
    applyTheme('dark')
    expect(getCurrentTheme()).toBe('dark')
  })

  it('applyTheme dispatches svgedit-themechange with the theme', () => {
    let got: string | null = null
    const h = (e: Event) => { got = (e as CustomEvent).detail.theme }
    document.addEventListener('svgedit-themechange', h)
    applyTheme('dark')
    document.removeEventListener('svgedit-themechange', h)
    expect(got).toBe('dark')
  })

  it('toggleTheme flips and returns the new theme', () => {
    applyTheme('light')
    expect(toggleTheme()).toBe('dark')
    expect(getCurrentTheme()).toBe('dark')
    expect(toggleTheme()).toBe('light')
  })

  it('resolveInitialTheme: stored wins, else system', () => {
    expect(resolveInitialTheme('dark')).toBe('dark')
    expect(resolveInitialTheme('light')).toBe('light')
    mockPrefersDark(true); expect(resolveInitialTheme('')).toBe('dark')
    mockPrefersDark(false); expect(resolveInitialTheme(null)).toBe('light')
    mockPrefersDark(true); expect(resolveInitialTheme('bogus')).toBe('dark')
  })
```
Also update the import line to include the new exports:
`import { getSystemTheme, applyTheme, applyInitialTheme, getCurrentTheme, toggleTheme, resolveInitialTheme } from '../../src/editor/styles/theme'`

- [ ] **Step 2: Run — expect FAIL** (`getCurrentTheme`/`toggleTheme`/`resolveInitialTheme` not exported).
Run: `npx vitest run tests/unit/theme.test.ts` → FAIL.

- [ ] **Step 3: Rewrite `src/editor/styles/theme.ts`** to:

```ts
// src/editor/styles/theme.ts
export type Theme = 'light' | 'dark'

/** OS-level color-scheme preference. */
export function getSystemTheme (): Theme {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The currently-applied theme (reads the document attribute; defaults light). */
export function getCurrentTheme (): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/** Apply a theme (sets html[data-theme]) and announce it via a CustomEvent. */
export function applyTheme (theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  document.dispatchEvent(new CustomEvent('svgedit-themechange', { detail: { theme } }))
}

/** Flip light<->dark; returns the new theme. (Does NOT persist — caller persists.) */
export function toggleTheme (): Theme {
  const next: Theme = getCurrentTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

/** A stored explicit 'light'/'dark' wins; anything else falls back to the OS preference. */
export function resolveInitialTheme (stored?: string | null): Theme {
  return stored === 'light' || stored === 'dark' ? stored : getSystemTheme()
}

/** Apply the initial theme: stored choice if present, else OS preference. */
export function applyInitialTheme (stored?: string | null): void {
  applyTheme(resolveInitialTheme(stored))
}
```

- [ ] **Step 4: Run — expect PASS** (all theme tests green).
Run: `npx vitest run tests/unit/theme.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/styles/theme.ts tests/unit/theme.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M2 extend theme.ts (current/toggle/resolve + themechange event)"
```

---

## Task 2: `theme` pref + startup precedence

**Files:**
- Modify: `src/editor/ConfigObj.ts` (`defaultPrefs`)
- Modify: `src/editor/editorInit.ts` (startup theme application)

- [ ] **Step 1: Add the pref.** In `src/editor/ConfigObj.ts` `defaultPrefs` (the object starting ~line 103), add a `theme` key:
```ts
      export_notice_done: false,
      // THEME (M2): '' = no explicit choice → follow OS (prefers-color-scheme)
      theme: ''
```
(Add a comma after the previous last entry as needed.)

- [ ] **Step 2: Apply the persisted/initial theme after config loads (no FOUC, stored wins).**
In `src/editor/editorInit.ts`, M1 currently calls `applyInitialTheme()` as the first line of `initEditor()` (before `configObj.load()`). Change it so it runs **after** `editor.configObj.load()` and passes the stored pref. Update the import to `import { applyInitialTheme } from './styles/theme.js'` (already present) and:
  - Remove the bare `applyInitialTheme()` call at the top of `initEditor()`.
  - Immediately AFTER `editor.configObj.load()`, add:
    ```ts
    applyInitialTheme(editor.configObj.pref('theme') as string)
    ```
  This is still before the editor renders its components (the `await import('./components/index.js')` and panel construction happen later), so there is no flash; and a stored `'light'`/`'dark'` now wins over the OS default.

- [ ] **Step 3: Verify build + suite + reload-persistence assumption.**
Run: `npm run build` → green. `npx vitest run` → all green (734 + the 4 new theme tests = 738).
(If `configObj.load()` does not synchronously populate `pref('theme')` from ext-storage in time — verified by the Task 3 reload e2e — fall back to reading the persisted value directly: add `getStoredTheme()` to theme.ts that reads the ext-storage localStorage key, and pass it to `applyInitialTheme`. Note: ext-storage namespaces keys by `canvasName`; confirm the exact key in `src/editor/extensions/ext-storage/ext-storage.ts` if needed.)

- [ ] **Step 4: Commit**
```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/ConfigObj.ts src/editor/editorInit.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M2 theme pref + apply persisted theme at startup"
```

---

## Task 3: `se-theme-toggle` component + placement + persistence wiring

**Files:**
- Create: `src/editor/components/seThemeToggle.ts`
- Modify: `src/editor/components/index.ts` (register the component — confirm the registration pattern by reading the file)
- Modify: `src/editor/MainMenu.ts` (`init()` — add the toggle to the top bar + wire persistence)
- Test: `tests/e2e/theme-toggle.spec.ts`

- [ ] **Step 1: Create the Lit component** `src/editor/components/seThemeToggle.ts`:

```ts
import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { getCurrentTheme, toggleTheme, type Theme } from '../styles/theme.js'

/**
 * A one-click light/dark theme toggle (sun/moon). Emits `toggle-theme`
 * (detail = the new theme) so the host editor can persist the choice.
 */
@customElement('se-theme-toggle')
export default class SeThemeToggle extends LitElement {
  static styles = css`
    button {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--se-tool-size, 26px); height: var(--se-tool-size, 26px);
      padding: 0; border: 1px solid transparent; border-radius: var(--se-radius-sm, 6px);
      background: transparent; color: var(--se-text); cursor: pointer;
    }
    button:hover { background: var(--se-accent-subtle); }
    button:focus-visible { outline: 2px solid var(--se-focus-ring); outline-offset: 1px; }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }
  `

  @state() accessor _theme: Theme = getCurrentTheme()

  connectedCallback (): void {
    super.connectedCallback()
    document.addEventListener('svgedit-themechange', this._onThemeChange)
  }

  disconnectedCallback (): void {
    document.removeEventListener('svgedit-themechange', this._onThemeChange)
    super.disconnectedCallback()
  }

  private _onThemeChange = (e: Event): void => {
    this._theme = (e as CustomEvent).detail.theme
  }

  private _onClick = (): void => {
    const next = toggleTheme()
    this.dispatchEvent(new CustomEvent('toggle-theme', { detail: { theme: next }, bubbles: true, composed: true }))
  }

  render () {
    // Moon when light (→ click for dark); sun when dark (→ click for light).
    const moon = html`<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>`
    const sun = html`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>`
    return html`
      <button type="button" title="Toggle light/dark theme" aria-label="Toggle light/dark theme" @click=${this._onClick}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${this._theme === 'dark' ? sun : moon}</svg>
      </button>`
  }
}
```

- [ ] **Step 2: Register the component.** Read `src/editor/components/index.ts` to see how siblings (e.g. `seMenu`, `seZoom`) are registered, then add `seThemeToggle` the same way (an import that triggers `@customElement` registration).

- [ ] **Step 3: Place it in the top bar + wire persistence.** In `src/editor/MainMenu.ts` `init()` (the method that injects `<se-menu id="main_button" …>` into `this.editor.$svgEditor` ~line 229-236), add `<se-theme-toggle id="theme_toggle"></se-theme-toggle>` to the injected top-bar markup (adjacent to `main_button`). After injection, wire persistence:
```ts
$id('theme_toggle')?.addEventListener('toggle-theme', (e) => {
  this.editor.configObj.pref('theme', (e as CustomEvent).detail.theme)
})
```
(Match the existing `$id`/`$click` helper usage in this file. The component already applies the theme via `toggleTheme()`; this just persists it.)

- [ ] **Step 4: E2E** `tests/e2e/theme-toggle.spec.ts` (follow the harness pattern from `tests/e2e/theme-chrome.spec.ts` — `./fixtures.js` + `visitAndApproveStorage`):

```ts
import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('M2 theme toggle', () => {
  test('toggles html[data-theme] and persists across reload', async ({ page }) => {
    await visitAndApproveStorage(page)
    await page.waitForSelector('#theme_toggle')
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    const start = await theme()
    // click the toggle (button is in the component's shadow root)
    await page.locator('#theme_toggle').evaluate((el: any) => el.shadowRoot.querySelector('button').click())
    const flipped = await theme()
    expect(flipped).not.toBe(start)
    await page.reload()
    await page.waitForSelector('#theme_toggle')
    expect(await theme()).toBe(flipped) // persisted
  })
})
```

- [ ] **Step 5: Verify + commit.** `npm run build` green; run the new e2e spec green; `npm run lint` green (toggle chrome uses tokens; SVG uses currentColor — hex-guard clean).
```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/seThemeToggle.ts src/editor/components/index.ts src/editor/MainMenu.ts tests/e2e/theme-toggle.spec.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M2 se-theme-toggle component (top-bar sun/moon) + persistence"
```

---

## Task 4: Embed reconciliation (route host theming through M1 tokens)

**Files:**
- Modify: `src/embed/server.ts` (lines ~7, ~113, ~158)
- Possibly remove: `src/embed/theme.ts` + its test (if unused after rerouting)
- Test: `tests/unit/embed-server.test.ts` (update theme assertions)

**Context:** `src/embed/theme.ts` is a legacy CLASS-based system (`body.theme-<name>`) — it does NOT activate M1's `html[data-theme]` tokens. `server.ts` uses it for `params.theme` (line 113) and `__setTheme` (line 158). Reroute both to M1's `src/editor/styles/theme.ts` `applyTheme` (sets `html[data-theme]`).

- [ ] **Step 1: Reroute.** In `src/embed/server.ts`:
  - Change the import (line 7) from `import { applyTheme } from './theme.js'` to `import { applyTheme, resolveInitialTheme } from '../editor/styles/theme.js'`.
  - Line ~113: `if (params.theme) applyTheme(document.body, params.theme)` → `if (params.theme) applyTheme(resolveInitialTheme(params.theme as string))` (resolveInitialTheme normalizes to `'light'`/`'dark'`).
  - Line ~158: `applyTheme(document.body, env.args[0] as string)` → `applyTheme(resolveInitialTheme(env.args[0] as string))`.
  - If `getCurrentTheme` from the embed theme.ts is used elsewhere in server.ts, switch it to M1's `getCurrentTheme()` too.

- [ ] **Step 2: Remove the dead legacy module if unused.** Run `git -C "C:/Users/jscha/source/repos/svgedit" grep -n "embed/theme\|from './theme'" -- src tests` to find remaining importers of `src/embed/theme.ts`. If none remain (besides its own test), delete `src/embed/theme.ts` and its dedicated test file. If something still needs the class-based behavior, leave it but add a comment that token theming goes through `editor/styles/theme.ts`.

- [ ] **Step 3: Update embed tests.** In `tests/unit/embed-server.test.ts`, any assertion that `__setTheme`/`params.theme` adds a `theme-*` class to `body` must change to assert `document.documentElement.getAttribute('data-theme')` equals `'light'`/`'dark'`. Read the current assertions and update them.

- [ ] **Step 4: Standalone `?theme=` — verify it already works.** Because Task 2 added `theme` to `defaultPrefs`, the editor's existing URL→`urldata`→`setConfig`→`pref` path makes `?theme=dark` set `pref('theme')`, which `applyInitialTheme` then applies. Add a quick check (manual or e2e) that loading `…/index.html?theme=dark` starts in dark. (No new code expected; if `setConfig` filters it, confirm `theme` is an allowed pref.)

- [ ] **Step 5: Verify + commit.** `npx vitest run` green (embed-server tests updated); `npm run build` green; `npm run lint` green.
```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/server.ts tests/unit/embed-server.test.ts
# include `git rm src/embed/theme.ts tests/unit/<embed-theme-test>` if removed
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M2 route embed __setTheme/?theme= through M1 html[data-theme] tokens"
```

---

## Task 5: Rulers (canvas chrome) re-theme on change

**Files:**
- Modify: `src/editor/Rulers.ts` (`strokeStyle` at ~line 226; add a `svgedit-themechange` listener)
- Test: `tests/e2e/theme-toggle.spec.ts` (extend)

- [ ] **Step 1: Resolve the ink color from the token instead of hardcoded black.** In `src/editor/Rulers.ts`, replace `ctx.strokeStyle = '#000'` (~line 226) with a token-resolved color. Add a small helper in the class:
```ts
  private _inkColor (): string {
    // Canvas 2D cannot take a CSS var(); resolve --se-text to a concrete color.
    const probe = getComputedStyle(document.documentElement).getPropertyValue('--se-text').trim()
    return probe || '#000'
  }
```
and use `ctx.strokeStyle = this._inkColor()`. (If `getPropertyValue('--se-text')` returns a `var(...)` chain rather than a resolved color in the test browser, instead read a resolved `color`: create/keep a hidden element styled `color: var(--se-text)` and read `getComputedStyle(el).color` — verify which resolves in the e2e.)
Leave the pre-existing `ctx.fillStyle = 'rgb(200,0,0)'` clear-hack (line ~106) as-is (audit-flagged, non-visible — out of scope).

- [ ] **Step 2: Redraw on theme change.** In the `Rulers` constructor (class starts ~line 17), subscribe:
```ts
    document.addEventListener('svgedit-themechange', () => this.updateRulers())
```
(`updateRulers()` with no args is already a valid call — see `MainMenu.ts:122`.) This redraws the rulers with the new ink color whenever the theme flips (toggle, startup, or embed).

- [ ] **Step 3: E2E — ruler ink follows theme.** Extend `tests/e2e/theme-toggle.spec.ts`:
```ts
  test('ruler ink color follows the theme', async ({ page }) => {
    await visitAndApproveStorage(page)
    await page.waitForSelector('#theme_toggle')
    const tickPixel = () => page.evaluate(() => {
      // sample the ruler canvas after forcing each theme; compare a drawn pixel
      const c = document.querySelector('#ruler_x canvas') as HTMLCanvasElement
      const ctx = c.getContext('2d')!
      const d = ctx.getImageData(0, 0, c.width, Math.min(c.height, 15)).data
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2]
      return sum
    })
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('svgedit-themechange', { detail: { theme: 'light' } })))
    // (use the real toggle/applyTheme in practice; confirm the ruler canvas selector in Rulers.ts)
  })
```
(Confirm the ruler canvas selector — `#ruler_x`/the canvas id — by reading `Rulers.ts`; adjust the test to assert the sampled ink differs between light and dark, or simply that `updateRulers` runs without error on the event and the canvas re-renders. Keep this test pragmatic — the core guarantee is "rulers redraw on themechange with a token-resolved color".)

- [ ] **Step 4: Verify + commit.** `npm run build` green; `npx vitest run` green; the e2e green; `npm run lint` green (no raw hex added — `#000` fallback is inside `_inkColor`, a `.ts` non-css-block line, but to stay guard-clean use `'currentColor'`-free fallback or mark with `hex-guard-allow` if the guard flags it; confirm guard clean).
```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/Rulers.ts tests/e2e/theme-toggle.spec.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: M2 re-theme ruler canvas chrome on themechange"
```

> **M2 impl PR ships here** (Tasks 1–5). Open `feat:` PR, CI gate, squash-merge.

---

## Self-review

**Spec coverage:** §4.1 theme.ts extension → Task 1 ✓ · §4.2 pref + startup precedence → Task 2 ✓ · §4.3 se-theme-toggle + placement → Task 3 ✓ · §4.4 embed reconciliation + `?theme=` → Task 4 ✓ · §4.5 Rulers redraw → Task 5 ✓ · §6 edge cases (invalid value → system in `resolveInitialTheme`; no-FOUC via after-load apply; artwork unaffected — existing theme-chrome e2e) ✓ · §7 testing → unit (Task 1) + e2e (Tasks 3,5) ✓.

**Placeholder scan:** No "TBD"/"handle X". Two flagged verification-dependent details (ext-storage timing fallback in Task 2 Step 3; the exact `getComputedStyle` resolution + ruler canvas selector in Task 5) are specified with a concrete primary approach + a named fallback + an e2e that decides — not blanks.

**Type/name consistency:** `Theme`, `getSystemTheme`, `getCurrentTheme`, `applyTheme`, `toggleTheme`, `resolveInitialTheme`, `applyInitialTheme` consistent across Task 1 (definition + tests), Task 2 (`applyInitialTheme(pref)`), Task 3 (`getCurrentTheme`/`toggleTheme`), Task 4 (`applyTheme`/`resolveInitialTheme`). Event name `svgedit-themechange` and the component event `toggle-theme` consistent across Tasks 1, 3, 5. Pref key `'theme'` consistent across Tasks 2, 3, 4.

---

## Notes for the executor
- One impl PR (`feat/m2-theme-toggle`) for Tasks 1–5. The hex-guard is enforcing now — the toggle's chrome must use `--se-*`; the sun/moon SVG uses `currentColor`/`none` (no literals).
- Verify the e2e harness selectors (`#theme_toggle` shadow button, ruler canvas id) against the real DOM during execution; adjust if needed.
