# Theming and design tokens

How svgedit's look is themed: a two-layer CSS custom-property token system, a runtime light/dark
toggle, and the lint guard that keeps colors token-only. Read this before touching chrome styles
or adding UI.

The token source is `src/editor/styles/tokens.css`, the runtime theme module is
`src/editor/styles/theme.ts`, and the lint guard is `scripts/check-no-raw-hex.mjs`.

## The token system

Tokens live in `src/editor/styles/tokens.css` in two layers:

- **Primitives** — the raw palette: cool-grey and teal ramps (`--se-grey-25` … `--se-grey-950`,
  `--se-teal-100` … `--se-teal-800`), near-black/near-white ink (`--se-ink`, `--se-paper`), and
  status hues (`--se-red-*`, `--se-amber-*`, `--se-green-*`, `--se-sky-*`). Theme-independent.
- **Semantic** — role-based tokens mapped onto primitives: `--se-bg`, `--se-surface`,
  `--se-surface-2`, `--se-canvas`, `--se-border`, `--se-border-strong`, `--se-text`,
  `--se-text-muted`, `--se-text-subtle`, `--se-icon` (+ `-hover`),
  `--se-accent` (+ `-hover` / `-active` / `-subtle`), `--se-on-accent`, `--se-danger`,
  `--se-warn`, `--se-success`, `--se-info`, `--se-focus-ring`, `--se-scrim`, and `--se-shadow-*`.

**Components consume semantic tokens only.** Theming works by remapping the semantic layer:
`:root` holds the light values, and `html[data-theme="dark"]` re-points the *same* semantic
tokens at darker primitives. Primitives are never overridden per-theme.

Non-color scales sit alongside the tokens and are also theme-independent: the font stack
(`--se-font-sans`), type sizes (`--se-text-xs` … `--se-text-lg`), weights (`--se-fw-*`), line
heights (`--se-lh-*`), spacing (`--se-space-1` … `--se-space-7`), radii
(`--se-radius-sm`/`md`/`lg`/`pill`), and control sizes (`--se-control-h`, `--se-tool-size`,
`--se-toolbar-h`).

## How theming works at runtime

The active theme is the `data-theme` attribute on `<html>`: `:root` holds the light values and
`html[data-theme="dark"]` activates the dark set. `src/editor/styles/theme.ts` owns the
transitions:

- `applyTheme(theme)` sets `html[data-theme]` and dispatches a `svgedit-themechange` `CustomEvent`
  (`detail: { theme }`).
- `toggleTheme()` flips light↔dark and applies it — it does **not** persist; the caller does.
- `resolveInitialTheme(stored)` returns a stored `'light'`/`'dark'`, else the OS
  `prefers-color-scheme`; `applyInitialTheme(stored)` applies it.
- `getCurrentTheme()` / `getSystemTheme()` read the current and OS themes.

**Startup precedence** (`editorInit.ts`): `?theme=` URL param > stored pref > system. The URL
value is a per-load override and is not persisted.

**The toggle** `se-theme-toggle` (`src/editor/components/seThemeToggle.ts`) calls `toggleTheme()`
on click and emits a `toggle-theme` event; `MainMenu.ts` listens and persists the choice via
`ConfigObj.pref('theme')` (subject to the editor's storage opt-in, like any pref). The toggle
re-syncs its own sun/moon icon by listening for `svgedit-themechange`.

**Re-theming non-CSS surfaces.** Anything painted outside CSS must re-read its colors on
`svgedit-themechange`. The Rulers (Canvas 2D) are the worked example — `Rulers.ts` redraws on the
event so tick ink follows `--se-text`:

```js
document.addEventListener('svgedit-themechange', () => this.updateRulers())
```

The embed bundle mirrors this contract (`html[data-theme]` + `svgedit-themechange`); hosts drive
it via `?theme=` and `__setTheme`. See `EMBED_API.md`.

## Using and adding tokens

In component styles (including Lit `static styles`), reference semantic tokens — never raw color:

```css
button {
  background: var(--se-surface);
  color: var(--se-text);
  border: 1px solid var(--se-border);
  border-radius: var(--se-radius-sm);
}
```

To add a token: add (or reuse) a **primitive** in `tokens.css`, then add a **semantic** token in
both the `:root` block and the `html[data-theme="dark"]` block. Components reference only the
semantic name, so one addition themes automatically.

## The hex-guard

`scripts/check-no-raw-hex.mjs` enforces the tokens-only rule. It runs in `npm run lint` (as
`npm run lint:hex`, with `--error`) and fails the build on a raw color found anywhere under
`src/` in:

- any line of a `.css` file, or
- any line inside a `css` tagged-template literal in a `.ts` file (Lit `static styles`).

It flags hex (`#rgb` … `#rrggbbaa`), color functions (`rgb()`, `rgba()`, `hsl()`, `hsla()`), and a
set of CSS color keywords used as values (`color: black`, etc.). It does **not** flag
`transparent`, `currentColor`, `inherit`, `initial`, `unset`, `none`, or `var(--…)`. Only
`src/editor/styles/tokens.css` is allowlisted. Markdown and non-`css` TypeScript are out of scope,
so prose examples like this doc's are never flagged.

**Escape hatch.** A line containing the comment marker `hex-guard-allow` is skipped. Reserve it
for color that is intentionally not a theme token — user/functional color the editor renders
literally:

```css
.swatch-none { background: #fff; } /* hex-guard-allow: user palette swatch, not chrome */
```

Intentionally exempt today: color pickers and gradient editors, palette swatches, and
contrast-critical selection handles — these carry user/functional color, not themeable chrome.
