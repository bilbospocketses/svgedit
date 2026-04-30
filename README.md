# svgedit (personal fork)

A personal hard fork of [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit) v7.4.1, shaped toward standalone desktop distribution and iframe-embeddable use inside [Control Menu](https://github.com/bilbospocketses/control-menu) and other host applications.

> **No upstream tracking.** This fork was taken as a one-time starter base. Upstream changes are not merged. Issues, PRs, and contributions go to the upstream repo, not here.

## Status

Active redevelopment. The fork is being shaped per a locked scope directive:

- **Standalone distribution** — Velopack installers (Windows + Linux) and a Docker image
- **Iframe-embeddable** — clean drop-in for Control Menu and other hosts, with a documented `EMBED_API.md` (postMessage RPC, two-way theme sync)
- **Core JS → TypeScript** migration committed
- **`elix` → `Lit`** for UI components
- **English-only** — multi-language support stripped
- **Slim dependency surface** — every dependency justifies its weight

See `CHANGELOG.md` for what's shipped and the project's TODO file for what's next.

## Run locally

Requires Node ≥ 20.

```sh
npm install
npm start          # vite dev → http://localhost:8000/src/editor/index.html
npm run build      # build to dist/editor
npm run start:iife # build + preview the IIFE bundle
npm test           # lint + vitest unit suite + Playwright e2e
```

## Repository layout

| Path | What lives there |
|---|---|
| `src/editor/` | Editor shell — top-level UI, menus, panels, dialogs, extensions, locale shim |
| `packages/svgcanvas/` | Core SVG canvas engine (the engine the editor sits on top of) |
| `tests/unit/` | Vitest unit tests (jsdom) |
| `tests/e2e/` | Playwright end-to-end tests (Chromium) |
| `scripts/` | Build / test runner scripts |
| `_reference/embed-api-v6/` | Preserved V6-era embed API code, kept as design input for the upcoming V7+ embed API |
| `docs/tutorials/` | Editor / Canvas / API / Events / FAQ tutorials (legacy upstream content; revisit during TS migration) |
| `CHANGELOG.md` | Keep a Changelog format; live source of what's changed |

## Embedding (planned)

The editor will be embeddable as an iframe with a documented `EMBED_API.md` surface — URL params for chrome control, a `window.svgedit.*` programmatic API, and a postMessage protocol that includes two-way theme sync between host and editor. Design is in flight; see `_reference/embed-api-v6/` for the V6-era prototype that informs the new design.

## Credits

Original `svgedit` is the work of a long line of contributors over 15+ years — see `AUTHORS`. This fork stands on top of all of that work; the rebuild is shaping the editor for a different distribution and integration model, not replacing the underlying engine.

## License

Inherits the upstream multi-license (MIT, Apache-2.0, ISC, LGPL-3.0-or-later, X11). See `LICENSE-MIT.txt`.
