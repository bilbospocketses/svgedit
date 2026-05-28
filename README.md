# svgedit (personal fork)

A personal hard fork of [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit) v7.4.1, shaped
toward standalone desktop distribution and iframe-embeddable use inside
[Control Menu](https://github.com/bilbospocketses/control-menu) and other host applications.

> **No upstream tracking.** This fork was taken as a one-time starter base. Upstream changes are not
> merged. Issues, PRs, and contributions go to the upstream repo, not here.

## Status

Active redevelopment. The fork is being shaped per a locked scope directive:

- **Standalone distribution** — Velopack installers (Windows + Linux) and a Docker image
- **Iframe-embeddable** — clean drop-in for Control Menu and other hosts, with a documented
  `EMBED_API.md` (postMessage RPC, two-way theme sync)
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
| --- | --- |
| `src/editor/` | Editor shell — top-level UI, menus, panels, dialogs, extensions, locale shim |
| `packages/svgcanvas/` | Core SVG canvas engine (the engine the editor sits on top of) |
| `tests/unit/` | Vitest unit tests (jsdom) |
| `tests/e2e/` | Playwright end-to-end tests (Chromium) |
| `scripts/` | Build / test runner scripts |
| `_reference/embed-api-v6/` | Preserved V6-era embed API code, kept as design input for the upcoming V7+ embed API |
| `docs/tutorials/` | Editor / Canvas / API / Events / FAQ tutorials (rewrite pending — see TODO #12.D) |
| `CHANGELOG.md` | Keep a Changelog format; live source of what's changed |

## Path tool keys

- `Enter` — complete the path open (≥ 2 points)
- `Esc` — cancel the path
- Double-click — completes the path open
- Click on first point — close the path

## Embedding

svgedit can be embedded in any host application via an iframe. See [EMBED_API.md](EMBED_API.md) for
the full contract.

Quickstart:

```html
<iframe id="svge" src="https://your-svgedit-host/index.html?embed=1&chrome=minimal&theme=dark"></iframe>
<script type="module">
  import { SvgEditEmbed } from 'svgedit/embed'
  const editor = new SvgEditEmbed(document.getElementById('svge'), { allowedOrigins: ['https://your-svgedit-host'] })
  await editor.ready
  await editor.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
  editor.on('save', ({ svgString }) => console.log('saved:', svgString))
</script>
```

## Credits

Original `svgedit` is the work of a long line of contributors over 15+ years — see `AUTHORS`. This
fork stands on top of all of that work; the rebuild is shaping the editor for a different
distribution and integration model, not replacing the underlying engine.

## License

This fork is licensed under **GPL-3.0-only** (see `LICENSE`).

Inherited upstream code retains its original licenses (MIT, Apache-2.0, ISC, LGPL-3.0-or-later,
X11) — see `LICENSE-MIT.txt` and the per-file headers in the codebase.
