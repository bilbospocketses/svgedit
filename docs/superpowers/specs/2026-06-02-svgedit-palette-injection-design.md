# svgedit Configurable Palette (host injection) — Design

## Status

- **2026-06-02:** Designed via brainstorming session.
- Extends the embed API v1 (`docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md`,
  shipped 2026-05-21) with one new host capability: **swatch-palette injection**.
- Closes the deferred `sePalette` configurable-palette item tracked under todo #10 / #16, and the
  original in-code `// Todo: Make into configuration item?` marker (`sePalette.ts:9`).

## Context

The embed API v1 lets a host drop svgedit into an iframe and drive it (methods, events, chrome,
theme, dialogs, security). One thread from todo #4's scope was **not** in v1: letting a host inject
its own **brand swatch colors** into the editor's color palette strip (e.g. Control Menu pushing its
palette so users draw with on-brand colors).

Today the palette is a hardcoded 42-color array in `src/editor/components/sePalette.ts` (a Lit
`se-palette` element). v1's `chrome` controls only show/hide the palette strip — it cannot change the
*colors*. This design adds color configurability, modeled on the existing `setTheme`/`setChrome`
embed patterns, while also making the palette a first-class editor setting (so it is not an
embed-only side channel).

**Scope (locked during brainstorming, 2026-06-02):**

- **Swatches only.** UI accent / brand *theming* (chrome colors via CSS variables) is a separate,
  out-of-scope future item. This design touches only the `se-palette` swatch strip.
- **Delivery: both** a URL param (initial state, no flash) **and** a runtime method (live changes) —
  consistent with how `chrome` and `theme` already work (v1 Decision Q5).
- **Merge mode: replace.** Injected colors become the whole palette; `DEFAULT_PALETTE` is exported so
  a host that wants append-behavior writes `setPalette([...DEFAULT_PALETTE, ...brand])` itself.
- **Architecture: configurable core + thin embed drivers** — the palette source-of-truth is a core
  editor module, driven by the embed layer; this closes the general-config TODO, not just the embed
  need.
- **One-way (host → editor).** The user cannot re-author the palette inside the editor (they only
  pick from it), so there is no editor→host `palette-changed` event and no two-way sync (unlike
  theme).

## Goals

1. A host can replace the editor's swatch palette via `?palette=` (initial) and
   `editor.setPalette(colors)` (runtime).
2. The palette becomes a real editor setting (`Editor.setCustomPalette`), usable standalone too — not
   an embed-only hook. Closes `// Todo: Make into configuration item?`.
3. Zero regression to standalone use: with no palette injected, the editor shows the same 42 colors as
   today.
4. The `no-color` (`'none'`) swatch is always available regardless of what a host injects.
5. Consistent with v1: mirrors `setTheme`/`setChrome` (URL param + `__`-prefixed runtime method +
   `capabilities` feature-detect + `error`-event sourcing).

## Non-goals

- **UI accent / brand theming** (chrome colors, CSS custom properties) — separate future item.
- **Palette persistence** — an injected palette is per-session; the host re-injects on each load.
- **Per-call append mode** — replace-only; append is achievable host-side via the exported
  `DEFAULT_PALETTE`.
- **Standalone palette-editing UI** — `Editor.setCustomPalette` exists as the seam, but no settings
  screen is built here.
- **`palette-changed` editor→host event** — palette is host-controlled and one-way.
- **`protocolVersion` bump** — palette is a new `__`-prefixed method + a new `capabilities` entry;
  the envelope shape is unchanged, so the protocol major stays at 1 (v1's versioning model: method
  names live on the side and do not bump the protocol).

## Architecture

A new core leaf module owns palette state, independent of the embed layer:

| File | Role |
|---|---|
| `src/embed/palette-defaults.ts` *(new)* | Pure-data leaf in the embed layer: `export const DEFAULT_PALETTE` (the 42 colors, moved out of `sePalette.ts`). Lives under `src/embed/` so the embed entry can re-export it to hosts without violating `tsconfig.embed.json`'s `rootDir: "src/embed"` (an `src/editor/` source cannot be re-exported from the embed bundle). |
| `src/editor/components/palette-store.ts` *(new)* | Source of truth **and the single validation site**. Imports `DEFAULT_PALETTE` from `../../embed/palette-defaults.js`; exposes `getPalette()`, `setPalette(colors): { applied, dropped }` (normalize — validate, drop invalid, ensure `'none'`, empty → `DEFAULT_PALETTE` — then notify subscribers and return what was dropped), and `subscribePalette(fn)`. Imports only the defaults leaf, so both `sePalette` and `Editor` can depend on it with no cycle. |
| `src/editor/components/sePalette.ts` | Consumer. Reads `getPalette()`; subscribes in `connectedCallback` → `requestUpdate()`; unsubscribes in `disconnectedCallback`. Renders from the store instead of a module-level const. |
| `src/editor/Editor.ts` | Public core API `setCustomPalette(colors)`: calls `palette-store.setPalette` and, when the returned `dropped` is non-empty, emits the `error` event via `this._embedServer?.emit('error', { source: 'invalid-palette-color' })` — the same pattern `setIcon` uses for `'missing-icon'` (`Editor.ts:1032`). It does not re-validate; the store owns normalization. |
| `src/embed/url-params.ts` | Adds `palette` to `parseEmbedURLParams` (comma-separated, URL-decoded). |
| `src/embed/server.ts` | URL param applied in the constructor (`if (params.palette) editor.setCustomPalette(params.palette)` — early, before `se-palette` mounts → no flash). New `__setPalette` special in `handleCall` → `editor.setCustomPalette(args[0])` → reply `null`. |
| `src/embed/client.ts` | New host method `setPalette(colors): Promise<void>` → `call('__setPalette', [colors])`. |
| `src/embed/index.ts` | Re-exports `DEFAULT_PALETTE` from `./palette-defaults.js` so hosts import it from `svgedit/embed`. |
| `src/embed/protocol.ts` | No code change — `capabilities` is an open `string[]`; the `'palette'` capability is added to `server.ts` `ready()`'s default list. No envelope change, so `protocolVersion` stays 1. |

**Data flow:**

```
host: ?palette=...  OR  editor.setPalette([...])      (embed driver)
            │                      │
            ▼                      ▼
   EmbedServer (URL param /  __setPalette handler)
            │
            ▼
   Editor.setCustomPalette(colors)                    (core public API)
            │  validate → drop invalid → maybe emit 'error'
            ▼
   palette-store.setPalette(normalized)               (source of truth)
            │  notify subscribers
            ▼
   se-palette  re-renders swatch strip                (consumer)
```

The capability default in `server.ts` `ready()` grows from `['chrome', 'theme', 'dialog-hooks']` to
include `'palette'`; the single call site `editorInit.ts:614` (`_embedServer?.ready()`) needs no
change.

## Host surface

**URL param** (initial state, applied before first paint):

```
?embed=1&palette=%23ff0000,%23223344,%2300a3e0,none
```

- Comma-separated CSS color strings; URL-encoded by the host. `'none'` is permitted explicitly and is
  always ensured present even if omitted.

**Runtime method** (host side):

```ts
import { SvgEditEmbed, DEFAULT_PALETTE } from 'svgedit/embed'

await editor.setPalette(['#ff0000', '#223344', '#00a3e0'])      // replace
await editor.setPalette([...DEFAULT_PALETTE, '#00a3e0'])        // append, host-composed
```

- Returns `Promise<void>`; resolves once applied.
- `'palette'` appears in the `ready` payload `capabilities` array for feature detection.

**Standalone** (no embed): `Editor.setCustomPalette(colors)` is directly callable, satisfying the
general-config TODO.

## Validation & errors

- Normalization lives in `palette-store.setPalette` (the single validation site); `setCustomPalette`
  and `sePalette` never re-validate.
- A valid entry is `'none'` or a parseable CSS color (`value === 'none' || CSS.supports('color', value)`).
- Invalid entries are **dropped** (non-fatal); valid colors still apply. `setPalette` returns the
  dropped list so the caller can surface it.
- When `dropped` is non-empty, `Editor.setCustomPalette` emits `error`
  `{ message, source: 'invalid-palette-color' }` (mirrors `'missing-icon'` / `'dialog-handler-timeout'`
  sourcing). The event only emits when an embed server is present, so standalone callers get the drop
  behavior silently.
- **URL-param-time drops are silent:** `?palette=` is applied in the `EmbedServer` constructor, before
  `this._embedServer` is assigned and before the host is listening, so the `?.emit` is a no-op for
  bad URL colors — they are dropped without an event (consistent with other best-effort URL-param
  failures). Runtime `setPalette` calls do surface the event.
- If the normalized result has **zero** real colors (all dropped / empty), the store falls back to
  `DEFAULT_PALETTE`.
- `'none'` is prepended if the host's array omits it, so no-fill/no-stroke is never lost.

## Component refactor (`sePalette.ts`)

**Changed:** the module-level `const palette` is removed; `DEFAULT_PALETTE` moves to `palette-store.ts`.
`render()` maps over `getPalette()`. A `subscribePalette` subscription is added in `connectedCallback`
(re-render on change) and torn down in `disconnectedCallback`, alongside the existing container-click
cleanup.

**Preserved exactly (verified contracts):**

- `se-palette` custom-element name.
- `change` CustomEvent with `bubbles: false` (consumed directly by `BottomPanel.ts` via
  `$id('palette').addEventListener`).
- `init(i18next)` signature (called from `BottomPanel.ts`).
- `NO_COLOR` data-URL sentinel rendering for the `'none'` square.
- `ui-palette_info` attribute reflection.

## Testing strategy

**Unit (vitest):**

- `palette-store` — replace semantics; `'none'` always ensured; invalid-color drop; empty/all-invalid
  → `DEFAULT_PALETTE` fallback; `subscribePalette` notify + unsubscribe.
- `url-params` — `palette` parse, URL-decode, empty/absent handling.
- `server` — `__setPalette` dispatches to `editor.setCustomPalette`; URL-param palette applied in
  constructor.
- `Editor.setCustomPalette` — emits `error` with `source: 'invalid-palette-color'` on dropped colors
  via a stub `_embedServer`.

**E2E (Playwright) — new `tests/e2e/embed-palette.spec.ts`:**

- URL-param initial palette renders the host's swatches (and not the defaults) — no flash.
- Runtime `setPalette` replaces the strip live.
- Replace semantics (defaults gone unless host re-includes them).
- Invalid color → `error` event with `source: 'invalid-palette-color'`; valid ones still applied.
- `'none'` square present even when omitted by the host.
- Picking a custom swatch sets fill (and stroke on shift/right-click) via `BottomPanel.handlePalette`.

**Docs:** new `## Palette` section in `EMBED_API.md` (URL param, method, replace semantics,
`DEFAULT_PALETTE`, `'none'` rule, validation/error); README capability list bumped to mention palette.

## Files touched

- `src/embed/palette-defaults.ts` *(new — `DEFAULT_PALETTE`)*
- `src/editor/components/palette-store.ts` *(new)*
- `src/editor/components/sePalette.ts`
- `src/editor/Editor.ts`
- `src/embed/url-params.ts`
- `src/embed/server.ts`
- `src/embed/client.ts`
- `src/embed/index.ts`
- `EMBED_API.md`
- `README.md`
- `tests/unit/embed-palette.test.ts` *(new — store + validation)*, plus additions to
  `embed-url-params.test.ts` / `embed-server.test.ts`
- `tests/e2e/embed-palette.spec.ts` *(new)*
- `CHANGELOG.md`

## Decisions log

| # | Decision | Chosen | Rationale |
|---|---|---|---|
| P1 | Injection scope | Swatch palette only | UI brand theming is a distinct feature; keep this focused on the concrete `sePalette` TODO. |
| P2 | Delivery | URL param + runtime method | Mirrors v1 `chrome`/`theme`; URL avoids first-paint flash, method allows live change. |
| P3 | Merge mode | Replace, `DEFAULT_PALETTE` exported | Predictable single semantic; append is host-composable. |
| P4 | Source of truth | Core `palette-store` leaf + `Editor.setCustomPalette` | Closes the general-config TODO; embed is a thin driver; testable in isolation. |
| P5 | Directionality | One-way (host → editor) | User can't re-author the palette in-editor; no `palette-changed` event needed. |
| P6 | Invalid colors | Drop + `error` event; default-fallback if empty | Non-fatal, consistent with v1 error sourcing; never leaves an unusable empty strip. |
| P7 | `'none'` sentinel | Always ensured present | No-fill/no-stroke must never disappear via injection. |

## Open questions

None at design-doc time. The CSS-color validator (`CSS.supports('color', …)`) is the chosen
mechanism; if a target browser or jsdom edge case needs a fallback, the implementation plan resolves
it without changing this contract.

## References

- **Embed v1 design:** `docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md`.
- **Embed v1 source:** `src/embed/{server,client,protocol,url-params,theme,chrome}.ts`.
- **Palette component:** `src/editor/components/sePalette.ts`; consumer `src/editor/panels/BottomPanel.ts`.
- **Error-event pattern to mirror:** `src/editor/Editor.ts:1032` (`setIcon` → `error` / `source: 'missing-icon'`).
- **Related todos:** `todo_svgedit.md` #4 (embed API — core shipped), #10 / #16 (`sePalette` deferred item this closes), #5 (Control Menu wiring — downstream consumer).
