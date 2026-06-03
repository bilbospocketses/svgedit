# M2 — svgedit Theme Toggle + Persistence (design spec)

- **Date:** 2026-06-02
- **Status:** Approved (brainstorm) → ready for implementation plan
- **Program:** UI Modernization (M1 design system ✅ → **M2 theme toggle** → M3 modals/#13 → M4 icons). Builds on M1 (master `e44dcf8f`).

## 1. Context & problem

M1 shipped the token system: the editor chrome is light/dark themeable via `html[data-theme]`, and `src/editor/styles/theme.ts` applies `prefers-color-scheme` once at startup (`applyInitialTheme()`). But there is **no user-facing way to switch themes**, the choice **isn't persisted**, the **embed `__setTheme` path is broken** (sets `data-theme` on `<body>`, but tokens key off `html`), and **canvas-drawn chrome** (`Rulers` tick marks) doesn't follow the theme (M1 follow-up). M2 closes all four.

## 2. Goals / non-goals

**Goals**
- A one-click **top-bar sun/moon toggle** switching light↔dark.
- **Persist** the explicit choice (survives reload); a stored choice wins over the OS preference.
- **Fix host-embed theming** so `__setTheme` / `?theme=` actually flip M1's dark tokens.
- **Re-theme canvas-drawn chrome** (`Rulers`) on theme change (closes the M1 follow-up).

**Non-goals**
- A "System / follow-OS" mode + live `matchMedia` listener (2-way only — explicit light/dark).
- A duplicate theme control in the preferences dialog (top-bar icon only).
- M3 (modals) / M4 (icons). The toggle icon is an inline `currentColor` SVG (not the M4 icon overhaul).

## 3. Locked decisions (from brainstorm)

1. **2-way** Light/Dark (no system mode).
2. **Top-bar sun/moon icon** (one-click), near `se-menu#main_button`.
3. Theme changes propagate via a **`svgedit-themechange` CustomEvent** (chosen over a `MutationObserver` on `html[data-theme]` — explicit, cheap; `theme.ts` already owns the apply step).
4. Persistence via the **existing prefs system** (`ConfigObj.pref('theme')` → `ext-storage` → localStorage).

## 4. Architecture

### 4.1 `theme.ts` (extend M1's; stays pure / DOM-only, no persistence inside)
Existing: `getSystemTheme()`, `applyTheme(theme)`, `applyInitialTheme()`. Add/extend:
- `getCurrentTheme(): Theme` — reads `document.documentElement.getAttribute('data-theme')` (default `'light'`).
- `applyTheme(theme)` — sets `html[data-theme]` (existing) **and dispatches** `new CustomEvent('svgedit-themechange', { detail: { theme } })` on `document` after setting the attribute.
- `toggleTheme(): Theme` — `applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark')`; returns the new theme.
- `resolveInitialTheme(stored?: string): Theme` — returns `stored` if it is `'light'`/`'dark'`, else `getSystemTheme()`.

### 4.2 Persistence (editor level — has `configObj`)
- Add `theme: ''` to `ConfigObj.defaultPrefs` (empty = "no explicit choice; use system").
- **Startup** (`editorInit`): replace M1's bare `applyInitialTheme()` with `applyTheme(resolveInitialTheme(configObj.pref('theme') as string))`. (A stored `'light'`/`'dark'` wins; otherwise OS preference — applied before render, no FOUC.)
- **On toggle:** persist with `configObj.pref('theme', newTheme)` (ext-storage writes localStorage under the canvas-namespaced key).

### 4.3 Toggle control — `se-theme-toggle` (new Lit component)
- Renders a button with an inline sun/moon SVG (`fill: currentColor`; button chrome via `--se-*` tokens; `--se-focus-ring` on focus). Shows the icon for the action (e.g., moon in light mode = "switch to dark").
- On click: `toggleTheme()` then dispatch a `change` (or call a wired handler) so the editor persists via `configObj.pref('theme', …)`. Updates its own icon on `svgedit-themechange`.
- Placed in the top toolbar near `se-menu#main_button` (exact slot pinned in the plan). Single responsibility; testable in isolation.

### 4.4 Embed reconciliation
- `src/embed/server.ts:157` `__setTheme`: change `applyTheme(document.body, theme)` → the M1 `theme.ts` `applyTheme(theme)` (sets `html[data-theme]` on documentElement) so host-driven theming activates M1's dark tokens. (Validate/normalize the arg to `'light'`/`'dark'`.)
- **`?theme=light|dark` URL param:** read at startup (mirrors the `?palette=` precedent); if present and valid, it seeds the initial theme (host-iframe control). Precedence: explicit `?theme=` / `__setTheme` (host) > stored pref > system.

### 4.5 Canvas-chrome redraw (closes M1 #14)
- `Rulers` (and any Canvas-2D-drawn chrome) add a `document.addEventListener('svgedit-themechange', …)` handler → re-resolve the ink color (read a resolved `color` via `getComputedStyle` of an element styled with `var(--se-text)`, since Canvas 2D can't take `var()`) for `strokeStyle`/`fillStyle`, then redraw. Also resolve it on initial draw so dark-on-load is correct.

## 5. Data flow
- **Startup:** `editorInit` → `applyTheme(resolveInitialTheme(pref('theme')))` → `html[data-theme]` set + `svgedit-themechange` dispatched → Rulers draw with themed ink.
- **Toggle click:** `se-theme-toggle` → `toggleTheme()` → attr flipped + event dispatched; editor persists `pref('theme', new)`. Rulers + toggle icon update from the event.
- **Embed:** host `client.setTheme('dark')` → `__setTheme` → `applyTheme('dark')` → same event path. `?theme=` seeds at startup.

## 6. Edge cases
- **Invalid stored/param value:** `resolveInitialTheme` only accepts `'light'`/`'dark'`; anything else → `getSystemTheme()`.
- **No FOUC:** theme applied before first render (M1 already calls at top of `initEditor`); M2 keeps that ordering.
- **User artwork unaffected:** M2 only flips chrome tokens + canvas-chrome ink; the SVG content + export are untouched (M1 invariant preserved; covered by the existing `theme-chrome` e2e).
- **Event name namespaced** (`svgedit-themechange`) to avoid collisions.
- **Embed body vs html:** after the fix, both standalone and embed set `html[data-theme]` — single source of truth.

## 7. Testing
- **Unit (vitest):** `getSystemTheme`; `applyTheme` sets `html[data-theme]` + dispatches `svgedit-themechange`; `toggleTheme` flips + returns; `getCurrentTheme`; `resolveInitialTheme` (stored `'dark'` wins; invalid → system).
- **E2E (Playwright):** click `se-theme-toggle` → `html[data-theme]` flips + icon updates; reload → persisted choice restored; Rulers ink color differs light vs dark (resolved style); `__setTheme('dark')` via the embed path flips the dark tokens; artwork fill unchanged across themes (extends the M1 `theme-chrome` spec).
- Keep vitest + e2e green; `npm run lint` (incl. the enforcing hex-guard — the toggle's chrome must use tokens; the sun/moon SVG uses `currentColor`).

## 8. Boundary
- **In M2:** `se-theme-toggle`, `theme.ts` extension, `theme` pref + persistence, startup precedence, embed `__setTheme`/`?theme=` fix, Rulers (+canvas chrome) redraw.
- **Out:** system/follow-OS mode; prefs-dialog theme control; M3 modals; M4 icon overhaul.

## 9. Open items for the plan (not blocking)
- Exact top-bar insertion point for `se-theme-toggle` (confirm in `editorTemplate.html` / the top toolbar markup during the plan).
- Whether the toggle persists by dispatching an event the editor handles vs. receiving a `configObj` reference — pick the pattern that matches sibling components during the plan.
