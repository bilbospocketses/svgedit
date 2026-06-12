# svgedit — 0a Server Skeleton Design

**Date:** 2026-06-12
**Status:** Approved (design) — pending implementation plan
**Roadmap item:** #7 foundation step **0a** (production server bundle + stable entrypoint), pulled forward to resolve the #5 port collision properly.

## Context & motivation

svgedit today has no server. `npm start` is `vite dev --host --port 8000 --strictPort` and `start:iife` is `vite preview` on the same port. Vite is a build tool plus a dev server, not an application server:

- `vite dev` — development only (source transform + HMR).
- `vite preview` — a static smoke-test server (sirv under the hood); the vite docs state it is **not** a production server.
- `vite build` — emits static assets, no server artifact. Vite's own guidance for anything beyond static serving is "bring your own Node server and use vite as middleware."

The near-term roadmap is server-shaped and currently has nowhere to live:

- **#5** — Control Menu launches svgedit as a supervisable sidecar (stable entrypoint + health).
- **#7** — Velopack `--mainExe` / launcher must spawn `node <server>`; servy/systemd `ExecStart` must point at a real entrypoint. 0a is defined as "a production server bundle + a stable, self-contained server entrypoint."
- **#27** — service install wraps the installed server; needs a `0755` entrypoint and a `SVGEDIT_WEB_PORT` reconnect override.

The **port collision** (svgedit fights ws-scrcpy-web for 8000) is the first feature that genuinely wants a server. Rather than bolt port logic into `vite.config.mjs` as a throwaway workaround, we stand up the **0a server skeleton now** and own port resolution inside it — mirroring the working sibling `ws-scrcpy-web`.

The editor remains 100% client-side; the Node server is the **host + backend layer** around it. The static build still exists, so svgedit could *also* ship as a pure static site later — the server is additive, no lock-in.

## Goals

- A real, minimal Node HTTP server that serves the built editor (`dist/editor`).
- Port resolution done properly: `SVGEDIT_WEB_PORT` override → persisted/default → auto-shift, mirroring ws-scrcpy-web's `reconcileWebPort()`.
- A request-handler **seam** so future server features (#27 service API, embed APIs, server-side SVG work) slot in without rework.
- Graceful shutdown and a `/healthz` endpoint (for #5 supervision).
- The dev loop (`vite dev` + HMR) stays intact, moved off port 8000.

## Non-goals (explicitly deferred — keeps this a skeleton)

- **0b** Rust launcher / Velopack `--mainExe`.
- **0c** release + version-sync harness.
- **#27** service endpoints, servy/systemd wiring.
- Velopack `UpdateService`.
- Single-file server **bundling** (esbuild). A #7 packaging concern; this skeleton tsc-compiles to a `dist/server/` directory and runs with `node_modules` present.
- Server-side application features (SVG rasterization, disk save/load, plugin backends).
- Moving the e2e harness onto the node server (stays on `vite preview :9000` for now; consolidation is a flagged follow-up).

## Architecture

Mirrors `ws-scrcpy-web/src/server/`, slimmed of all adb/scan/dependency machinery svgedit does not need.

```
src/server/
  index.ts          # entrypoint: resolveWebPort() → createServer() → listen → SIGINT/SIGTERM graceful close
  PortPicker.ts     # tryPort / webPortOverride / findAvailablePort  (ported ~verbatim from the sibling — pure `net`)
  resolveWebPort.ts # resolveWebPort() orchestration + DEFAULT_WEB_PORT  (extracted from index for unit-testability)
  httpServer.ts     # createServer({ staticDir, apiHandlers }): handler chain → /healthz → static fallback; graceful close
  Config.ts         # resolveDataRoot(env, platform) + readConfig()/persistWebPort() → <dataRoot>/config.json
tests/unit/server/  # vitest include is tests/**, so server tests live here (not src/server/__tests__/)
  PortPicker.test.ts
  config.test.ts
  resolveWebPort.test.ts
```

The sibling reference files are the working template:
`ws-scrcpy-web/src/server/PortPicker.ts`, `src/server/index.ts` (`reconcileWebPort`), `src/server/services/HttpServer.ts`, `src/server/Config.ts`, `src/server/StaticFileServer.ts`.

### Request flow

```
incoming request
  → for each apiHandler in apiHandlers: if handler.handle(req,res) === true, stop   (empty list at skeleton stage)
  → GET /healthz → 200 {"status":"ok"}
  → static handler (sirv over dist/editor)
  → 404
errors anywhere → 500 {"error": message}
```

The `apiHandlers: ApiHandler[]` array is empty in the skeleton but present as the seam. `ApiHandler = (req, res) => Promise<boolean>` (returns `true` if it handled the request), matching the sibling's `HttpServer.addApiHandler` contract so #27 / embed APIs port directly.

## Port handling (the core — 1:1 with `reconcileWebPort`)

`PortPicker.ts` is ported from the sibling essentially verbatim (it is pure `net`, zero coupling):

- `tryPort(port): Promise<boolean>` — bind-test a single port, close immediately on success.
- `webPortOverride(env: string | undefined): number | null` — parse to a valid port (`Number.isInteger && >0 && <65536`) or null.
- `findAvailablePort(start: number, end: number): Promise<number | null>` — walk `[start, end]` inclusive, first free or null.

`resolveWebPort()` (its own module `src/server/resolveWebPort.ts`, imported by `index.ts` — extracted for unit-testability) mirrors `reconcileWebPort()`:

```
const DEFAULT_WEB_PORT = 8100

async function resolveWebPort(): Promise<number> {
  const override  = webPortOverride(process.env.SVGEDIT_WEB_PORT)   // exact forced port (Control Menu / #27)
  const persisted = readConfig().webPort                            // sticky port from a prior run
  const desired   = override ?? persisted ?? DEFAULT_WEB_PORT
  const end       = override !== null ? desired : desired + 99      // override forces exact; else auto-shift band
  const found     = await findAvailablePort(desired, end)
  if (found === null) throw new Error(`No free port in ${desired}..${end}`)
  if (found !== persisted) persistWebPort(found)                    // persist the bound port
  return found
}
```

**Default port 8100** clears ws-scrcpy-web's `8000–8099` shift band and the svgedit e2e `9000`. The auto-shift band is `8100–8199`.

`PortPicker.ts` and this resolver transfer verbatim into 0a's real server when the rest of #7 lands — nothing here is throwaway.

## Config / data-root / persist

`Config.ts` is a slim version of the sibling's resolver pattern (no adb/scan/deps fields):

```
interface FlatConfig { webPort?: number }

function resolveDataRoot(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  if (env.SVGEDIT_DATA_ROOT) return env.SVGEDIT_DATA_ROOT       // override set by #7 install / #27 service
  // dev fallback: <repo>/.svgedit-data  (entry is dist/server/index.js → repo root is two levels up)
  // #7 extends this with the real install layout (win32 %PROGRAMDATA%\SvgEdit; linux XDG / /var/opt).
  return path.resolve(serverDir, '..', '..', '.svgedit-data')
}
```

- `readConfig()` reads `<dataRoot>/config.json`, tolerating a missing/invalid file (returns `{}`).
- `persistWebPort(port)` merges `{ webPort }` into `config.json` and writes it (creating `<dataRoot>` if needed).
- The persisted port gives a **sticky port across restarts** in dev. Its eventual *readers* (tray / Control Menu / service re-reading the port) arrive in #5/#27; until then it only stabilises the local URL.
- `resolveDataRoot` is a **pure function** — the exact seam #7 extends with platform install paths; the dev fallback is the only part #7 replaces.

The server is ESM (`package.json` has `"type": "module"`), so `serverDir` is derived via `path.dirname(fileURLToPath(import.meta.url))`, not the CJS `__dirname` the sibling uses.

## Static serving

Use **sirv** (`dependencies`) — tiny, battle-tested, and the same library `vite preview` already uses, so production serving matches today's preview behavior (etag, range, content-type). svgedit's build is an MPA, so `single: false`.

`staticDir = path.resolve(serverDir, '..', 'editor')` (`dist/server` → `dist/editor`). Vite `base` is `'./'` (relative asset paths), so the built HTML works served from the server root.

(Alternative considered: port the sibling's hand-rolled `StaticFileServer` for zero new runtime dependency. Rejected for the skeleton — sirv is less code and lower risk. `sirv` is a pure-JS npm package bundled in `node_modules`; it is not a binary dependency, so the Local-Dependencies-Only rule does not apply.)

## Dev vs prod serve model + scripts

- `npm start` — **unchanged role** (`vite dev`, HMR), but moved off 8000 → **8100** and honoring `SVGEDIT_WEB_PORT`. This is the inner dev loop.
- `npm run serve` — **new**: `npm run build && node dist/server/index.js`. The canonical "serve the build" path; what packaging / services / Control Menu will point at.
- `start:iife` (vite preview) — **retired**; the node server supersedes it.
- `start:e2e` (`vite preview --port 9000 --strictPort`) — **unchanged**; the e2e harness stays as-is for now.

`vite.config.mjs` `server` and `preview` blocks: port `8000` → `8100`, reading `Number(process.env.SVGEDIT_WEB_PORT) || 8100`, `strictPort` retained. (The full `findAvailablePort` auto-shift lives in the node server; the vite dev server keeps vite's own `strictPort` semantics plus the env override — proportionate for a dev loop.)

## Build + entrypoint

- New `tsconfig.server.json` (mirrors the existing `tsconfig.embed.json`): compiles `src/server/**` → `dist/server/`, ESM output, ES2022 target.
- `package.json`:
  - `dependencies`: add `sirv`.
  - `"build:server": "tsc --project tsconfig.server.json"`, folded into `build` (`... && npm run build:server`).
  - `"serve": "npm run build && node dist/server/index.js"`.
  - remove `start:iife`.
- Run: `node dist/server/index.js`. Single-file bundling (esbuild) is deferred to #7 packaging.

## Host binding & shutdown

- **Host:** default `0.0.0.0` (preserves today's `npm start --host` LAN/device-testing behavior). A `SVGEDIT_HOST` override is a possible later addition, not in this skeleton.
- **Graceful shutdown:** `SIGINT`/`SIGTERM` → `server.close()` + `server.closeAllConnections()` (Node ≥18.2; `engines.node >= 20`), mirroring the sibling's `release()` so browser keepalive sockets don't block exit.

## Files touched

- **New:** `src/server/{index,PortPicker,resolveWebPort,httpServer,Config}.ts`, `tests/unit/server/{PortPicker,config,resolveWebPort}.test.ts`, `tsconfig.server.json`.
- **Edit:** `package.json` (dep `sirv`; scripts `build:server`, fold into `build`, `serve`; drop `start:iife`), `vite.config.mjs` (dev/preview port `8100` + `SVGEDIT_WEB_PORT`), `.gitignore` (`.svgedit-data/`), docs (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `STYLE.md` — port + serve commands), `CHANGELOG.md` (`## [Unreleased]` entry).

## Testing strategy

- **Unit (vitest, pure):**
  - `webPortOverride` — valid parse; null on undefined/empty/`0`/`70000`/`abc`.
  - `findAvailablePort` — returns `start` when free; walks past a held port; null when the whole band is busy.
  - `resolveWebPort` — override forces exact; busy default auto-shifts within band; persists the bound port; throws when band exhausted.
  - `resolveDataRoot` — honors `SVGEDIT_DATA_ROOT`; dev fallback otherwise. `readConfig`/`persistWebPort` round-trip; tolerates missing/garbage file.
- **Integration:** boot the server → `GET /` returns editor HTML; `GET /healthz` → 200; hold the default port → server binds the shifted port.
- **Regression:** existing `npm run lint`, unit, and e2e suites stay green; `npm run typecheck:editor` clean; the new server is type-checked separately via `npm run typecheck:server` (`tsc --noEmit -p tsconfig.server.json`).

## Release / changelog

Per the repo's `## [Unreleased]`-only convention (auto-release cuts the version bump), this work adds an `## [Unreleased]` entry only — no hand-written version section. Label the PR per the established workflow.

## Relationship to roadmap (for future sessions)

- **#5** consumes this server as the Control Menu sidecar (health endpoint + `SVGEDIT_WEB_PORT` for dynamic assignment).
- **#7** extends `resolveDataRoot` with install layouts, adds 0b (launcher) + 0c (release harness) + server bundling, and points Velopack at this entrypoint.
- **#27** adds the service API handlers to the `apiHandlers` seam and the systemd/servy wiring around this entrypoint.
