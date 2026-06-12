# svgedit 0a Server Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a minimal real Node HTTP server that serves the built editor (`dist/editor`) and owns port resolution (`SVGEDIT_WEB_PORT` override + auto-shift + persist), resolving the ws-scrcpy-web port collision properly.

**Architecture:** A small `src/server/` module set mirroring `ws-scrcpy-web/src/server/` (slimmed of all adb/scan/dependency machinery): pure port primitives (`PortPicker`), slim config/persist (`Config`), port-resolution orchestration (`resolveWebPort`), an HTTP server with an API-handler seam + `/healthz` + sirv static fallback (`httpServer`), and a thin boot/shutdown entrypoint (`index`). The editor stays 100% client-side; the server is the host layer. Compiled by a dedicated `tsconfig.server.json` to `dist/server/`, run with `node dist/server/index.js`.

**Tech Stack:** TypeScript (ESM, strict), Node ≥20 (`node:net`/`node:http`/`node:fs`), `sirv` for static serving, vitest for tests, tsc for the server build.

---

## Conventions for this plan

- **Repo root:** `C:/Users/jscha/source/repos/svgedit` (Windows). All `git` commands use `git -C "C:/Users/jscha/source/repos/svgedit" …`. Run `npm`/`npx` from the repo root.
- **Branch:** `feat/0a-server-skeleton` (already created off `origin/master`; the design spec is already committed there).
- **ESM import extensions:** server source imports siblings with a `.js` extension (e.g. `import { … } from './PortPicker.js'`) — required by Node ESM at runtime, and vite resolves `.js`→`.ts` for the tests.
- **Strict TS:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters` are on. Use `import type` for type-only imports; never assign `undefined` to an optional property.
- **Spec:** `docs/superpowers/specs/2026-06-12-svgedit-0a-server-skeleton-design.md`.
- **Sibling template (reference only, do not edit):** `C:/Users/jscha/source/repos/ws-scrcpy-web/src/server/{PortPicker.ts,index.ts,services/HttpServer.ts,Config.ts}`.

## File structure

```
src/server/
  PortPicker.ts       # tryPort / webPortOverride / findAvailablePort  (pure node:net)
  Config.ts           # FlatConfig, resolveDataRoot, readConfig, persistWebPort  (pure node:fs)
  resolveWebPort.ts   # resolveWebPort() orchestration + DEFAULT_WEB_PORT  (extracted from index for unit-testability)
  httpServer.ts       # ApiHandler, createServer(), closeServer()  (node:http + sirv)
  index.ts            # main(): resolveWebPort → createServer → listen → SIGINT/SIGTERM
tests/unit/server/
  PortPicker.test.ts
  config.test.ts
  resolveWebPort.test.ts
tsconfig.server.json  # mirrors tsconfig.embed.json; rootDir src/server → outDir dist/server
```

> **Reconciliation with the spec:** the spec sketched tests under `src/server/__tests__/` and `resolveWebPort` inside `index.ts`. This plan places tests in `tests/unit/server/` (the only location vitest's `include: ['tests/**']` picks up) and extracts `resolveWebPort` into its own module (so it unit-tests without importing the http server / sirv). The spec has been updated to match.

---

## Task 1: Port-availability primitives (`PortPicker`)

**Files:**
- Create: `src/server/PortPicker.ts`
- Test: `tests/unit/server/PortPicker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/PortPicker.test.ts`:

```ts
import * as net from 'node:net'
import { describe, expect, it } from 'vitest'
import { findAvailablePort, tryPort, webPortOverride } from '../../../src/server/PortPicker.js'

describe('webPortOverride', () => {
  it('parses a valid port', () => {
    expect(webPortOverride('8100')).toBe(8100)
  })
  it('returns null for invalid input', () => {
    expect(webPortOverride(undefined)).toBeNull()
    expect(webPortOverride('')).toBeNull()
    expect(webPortOverride('0')).toBeNull()
    expect(webPortOverride('70000')).toBeNull()
    expect(webPortOverride('abc')).toBeNull()
  })
})

describe('tryPort / findAvailablePort', () => {
  it('reports a held port busy and finds the next free one', async () => {
    const blocker = net.createServer()
    const port = await new Promise<number>((resolve) => {
      blocker.listen(0, () => {
        const addr = blocker.address()
        resolve(typeof addr === 'object' && addr !== null ? addr.port : 0)
      })
    })
    try {
      expect(await tryPort(port)).toBe(false)
      const found = await findAvailablePort(port, port + 50)
      expect(found).not.toBeNull()
      expect(found).toBeGreaterThan(port)
    } finally {
      blocker.close()
    }
  })

  it('returns null when the range is invalid', async () => {
    expect(await findAvailablePort(9000, 8000)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/server/PortPicker.test.ts`
Expected: FAIL — cannot resolve `../../../src/server/PortPicker.js` (module does not exist yet).

- [ ] **Step 3: Implement `PortPicker.ts`**

Create `src/server/PortPicker.ts`:

```ts
import * as net from 'node:net'

/** Bind-test a single port. Resolves true if free, false if busy. Closes the
 *  test server immediately on success so the port is reusable by the real listener. */
export function tryPort (port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer()
    let settled = false
    const done = (free: boolean): void => {
      if (settled) return
      settled = true
      try { server.close() } catch { /* ignore */ }
      resolve(free)
    }
    server.once('error', () => { done(false) })
    server.once('listening', () => {
      settled = true
      server.close(() => { resolve(true) })
    })
    server.listen(port)
  })
}

/** Parse the SVGEDIT_WEB_PORT override into a valid port, or null. */
export function webPortOverride (env: string | undefined): number | null {
  const n = Number(env)
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null
}

/** Walk [start, end] inclusive in order; return the first free port, or null. */
export async function findAvailablePort (start: number, end: number): Promise<number | null> {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return null
  for (let port = start; port <= end; port++) {
    // eslint-disable-next-line no-await-in-loop -- sequential probing is intentional
    const free = await tryPort(port)
    if (free) return port
  }
  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/server/PortPicker.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint the new file**

Run: `npx eslint src/server/PortPicker.ts tests/unit/server/PortPicker.test.ts`
Expected: clean. *If eslint reports the `no-await-in-loop` disable as unused, delete that comment line; if it instead reports an `no-await-in-loop` error, keep it.*

- [ ] **Step 6: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/server/PortPicker.ts tests/unit/server/PortPicker.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(server): port-availability primitives (PortPicker)"
```

---

## Task 2: Config + data-root + persist (`Config`)

**Files:**
- Create: `src/server/Config.ts`
- Test: `tests/unit/server/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/config.test.ts`:

```ts
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { persistWebPort, readConfig, resolveDataRoot } from '../../../src/server/Config.js'

const tmpDirs: string[] = []
function makeTmpRoot (): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgedit-cfg-'))
  tmpDirs.push(dir)
  return dir
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveDataRoot', () => {
  it('honors SVGEDIT_DATA_ROOT', () => {
    expect(resolveDataRoot({ SVGEDIT_DATA_ROOT: 'D:/data' }, '/whatever/dist/server')).toBe('D:/data')
  })
  it('falls back to <repo>/.svgedit-data (two levels up from the server dir)', () => {
    const got = resolveDataRoot({}, path.join('repo', 'dist', 'server'))
    expect(got).toBe(path.resolve('repo', '.svgedit-data'))
  })
})

describe('readConfig / persistWebPort', () => {
  it('returns {} for a missing or garbage file', () => {
    const root = makeTmpRoot()
    expect(readConfig(root)).toEqual({})
    fs.writeFileSync(path.join(root, 'config.json'), 'not json', 'utf8')
    expect(readConfig(root)).toEqual({})
  })
  it('round-trips the persisted webPort', () => {
    const root = makeTmpRoot()
    persistWebPort(8123, root)
    expect(readConfig(root)).toEqual({ webPort: 8123 })
  })
  it('creates the data root if it does not exist', () => {
    const root = path.join(makeTmpRoot(), 'nested', 'dir')
    persistWebPort(8100, root)
    expect(readConfig(root).webPort).toBe(8100)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/server/config.test.ts`
Expected: FAIL — cannot resolve `../../../src/server/Config.js`.

- [ ] **Step 3: Implement `Config.ts`**

Create `src/server/Config.ts`:

```ts
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface FlatConfig {
  webPort?: number
}

const serverDir = path.dirname(fileURLToPath(import.meta.url))

/** Resolve the writable-state root. `SVGEDIT_DATA_ROOT` wins; otherwise a dev
 *  fallback at `<repo>/.svgedit-data` (two levels up from `dist/server`).
 *  #7 extends this with the real install layout (%PROGRAMDATA% / /var/opt). */
export function resolveDataRoot (
  env: NodeJS.ProcessEnv = process.env,
  baseDir: string = serverDir
): string {
  const override = env['SVGEDIT_DATA_ROOT']
  if (override !== undefined && override !== '') return override
  return path.resolve(baseDir, '..', '..', '.svgedit-data')
}

function configPath (dataRoot: string): string {
  return path.join(dataRoot, 'config.json')
}

/** Read `<dataRoot>/config.json`, tolerating a missing or invalid file. */
export function readConfig (dataRoot: string = resolveDataRoot()): FlatConfig {
  try {
    const raw = fs.readFileSync(configPath(dataRoot), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && 'webPort' in parsed) {
      const wp = (parsed as { webPort: unknown }).webPort
      if (typeof wp === 'number' && Number.isInteger(wp)) return { webPort: wp }
    }
    return {}
  } catch {
    return {}
  }
}

/** Persist `{ webPort }` into `<dataRoot>/config.json`, merging existing keys. */
export function persistWebPort (port: number, dataRoot: string = resolveDataRoot()): void {
  fs.mkdirSync(dataRoot, { recursive: true })
  const merged: FlatConfig = { ...readConfig(dataRoot), webPort: port }
  fs.writeFileSync(configPath(dataRoot), `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/server/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/server/Config.ts tests/unit/server/config.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/server/Config.ts tests/unit/server/config.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(server): data-root resolution + webPort persist (Config)"
```

---

## Task 3: Port resolution orchestration (`resolveWebPort`)

**Files:**
- Create: `src/server/resolveWebPort.ts`
- Test: `tests/unit/server/resolveWebPort.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/resolveWebPort.test.ts`:

```ts
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readConfig } from '../../../src/server/Config.js'
import { DEFAULT_WEB_PORT, resolveWebPort } from '../../../src/server/resolveWebPort.js'

const tmpDirs: string[] = []
function makeTmpRoot (): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgedit-port-'))
  tmpDirs.push(dir)
  return dir
}
function listenOn (port: number): Promise<net.Server> {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.listen(port, () => { resolve(s) })
  })
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveWebPort', () => {
  it('honors the SVGEDIT_WEB_PORT override exactly and persists it', async () => {
    const root = makeTmpRoot()
    const free = await net.createServer().listen(0).address()
    const port = typeof free === 'object' && free !== null ? free.port : 0
    // free port chosen, listener already closed implicitly is NOT guaranteed; bind+close explicitly:
    const probe = await listenOn(0)
    const overridePort = (probe.address() as net.AddressInfo).port
    probe.close()
    const got = await resolveWebPort({ SVGEDIT_WEB_PORT: String(overridePort) }, root)
    expect(got).toBe(overridePort)
    expect(readConfig(root).webPort).toBe(overridePort)
    void port
  })

  it('auto-shifts within the band when the persisted port is busy, and persists the shift', async () => {
    const root = makeTmpRoot()
    const blocker = await listenOn(0)
    const busy = (blocker.address() as net.AddressInfo).port
    try {
      // Seed the persisted desired port to the busy one.
      const seeded = JSON.stringify({ webPort: busy })
      fs.writeFileSync(path.join(root, 'config.json'), seeded, 'utf8')
      const got = await resolveWebPort({}, root)
      expect(got).toBeGreaterThan(busy)
      expect(got).toBeLessThanOrEqual(busy + 99)
      expect(readConfig(root).webPort).toBe(got)
    } finally {
      blocker.close()
    }
  })

  it('defaults to DEFAULT_WEB_PORT when nothing is set and it is free', async () => {
    const root = makeTmpRoot()
    // Only assert the default constant value; binding 8100 may be unavailable on CI.
    expect(DEFAULT_WEB_PORT).toBe(8100)
    const got = await resolveWebPort({}, root)
    expect(got).toBeGreaterThanOrEqual(DEFAULT_WEB_PORT)
    expect(got).toBeLessThanOrEqual(DEFAULT_WEB_PORT + 99)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/server/resolveWebPort.test.ts`
Expected: FAIL — cannot resolve `../../../src/server/resolveWebPort.js`.

- [ ] **Step 3: Implement `resolveWebPort.ts`**

Create `src/server/resolveWebPort.ts`:

```ts
import { persistWebPort, readConfig, resolveDataRoot } from './Config.js'
import { findAvailablePort, webPortOverride } from './PortPicker.js'

export const DEFAULT_WEB_PORT = 8100
const SHIFT_RANGE = 99

/** Resolve the web port, mirroring ws-scrcpy-web's reconcileWebPort():
 *  SVGEDIT_WEB_PORT override (forces the exact free port) → persisted → default,
 *  auto-shifting within [desired, desired+99] when not overridden. Persists the
 *  bound port so it is sticky across restarts. */
export async function resolveWebPort (
  env: NodeJS.ProcessEnv = process.env,
  dataRoot: string = resolveDataRoot(env)
): Promise<number> {
  const override = webPortOverride(env['SVGEDIT_WEB_PORT'])
  const persisted = readConfig(dataRoot).webPort
  const desired = override ?? persisted ?? DEFAULT_WEB_PORT
  const end = override !== null ? desired : desired + SHIFT_RANGE
  const found = await findAvailablePort(desired, end)
  if (found === null) {
    throw new Error(`No free port available in range ${desired}..${end}`)
  }
  if (found !== persisted) persistWebPort(found, dataRoot)
  return found
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/server/resolveWebPort.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/server/resolveWebPort.ts tests/unit/server/resolveWebPort.test.ts`
Expected: clean. *Remove the `void port` / unused-variable scaffolding from the first test if eslint flags it — simplify that test to bind one ephemeral port, capture it, close it, then call resolveWebPort with the override.*

- [ ] **Step 6: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/server/resolveWebPort.ts tests/unit/server/resolveWebPort.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(server): SVGEDIT_WEB_PORT override + auto-shift resolution (resolveWebPort)"
```

---

## Task 4: HTTP server with `/healthz` + static fallback (`httpServer`)

**Files:**
- Modify: `package.json` (add `sirv` dependency)
- Create: `src/server/httpServer.ts`
- Test: `tests/unit/server/httpServer.test.ts`

- [ ] **Step 1: Install sirv**

Run: `npm install sirv` (from the repo root)
Expected: `sirv` added under `dependencies` in `package.json` + `package-lock.json` updated.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/server/httpServer.test.ts`:

```ts
import * as fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeServer, createServer } from '../../../src/server/httpServer.js'

const tmpDirs: string[] = []
function staticFixture (): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgedit-static-'))
  tmpDirs.push(dir)
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>hi</title>editor-root', 'utf8')
  return dir
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('createServer', () => {
  it('serves static index, answers /healthz, and 404s unknown paths', async () => {
    const server = createServer({ staticDir: staticFixture() })
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => { resolve((server.address() as AddressInfo).port) })
    })
    try {
      const root = await fetch(`http://127.0.0.1:${port}/`)
      expect(root.status).toBe(200)
      expect(await root.text()).toContain('editor-root')

      const health = await fetch(`http://127.0.0.1:${port}/healthz`)
      expect(health.status).toBe(200)
      expect(await health.json()).toEqual({ status: 'ok' })

      const missing = await fetch(`http://127.0.0.1:${port}/nope`)
      expect(missing.status).toBe(404)
    } finally {
      closeServer(server)
    }
  })

  it('lets an API handler short-circuit before static', async () => {
    const server = createServer({
      staticDir: staticFixture(),
      apiHandlers: [async (req, res) => {
        if (req.url === '/api/ping') {
          res.writeHead(200, { 'content-type': 'text/plain' })
          res.end('pong')
          return true
        }
        return false
      }]
    })
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => { resolve((server.address() as AddressInfo).port) })
    })
    try {
      const ping = await fetch(`http://127.0.0.1:${port}/api/ping`)
      expect(await ping.text()).toBe('pong')
    } finally {
      closeServer(server)
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/server/httpServer.test.ts`
Expected: FAIL — cannot resolve `../../../src/server/httpServer.js`.

- [ ] **Step 4: Implement `httpServer.ts`**

Create `src/server/httpServer.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'

export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

export interface CreateServerOptions {
  staticDir?: string
  apiHandlers?: ApiHandler[]
}

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_STATIC_DIR = path.resolve(serverDir, '..', 'editor') // dist/server → dist/editor

function healthz (req: IncomingMessage, res: ServerResponse): boolean {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"status":"ok"}')
    return true
  }
  return false
}

export function createServer (options: CreateServerOptions = {}): http.Server {
  const staticDir = options.staticDir ?? DEFAULT_STATIC_DIR
  const apiHandlers = options.apiHandlers ?? []
  const serveStatic = sirv(staticDir, { etag: true, single: false })

  return http.createServer((req, res) => {
    void (async () => {
      try {
        for (const handler of apiHandlers) {
          if (await handler(req, res)) return
        }
        if (healthz(req, res)) return
        serveStatic(req, res, () => {
          res.writeHead(404, { 'content-type': 'text/plain' })
          res.end('Not Found')
        })
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
      }
    })()
  })
}

/** Graceful close: stop accepting new connections + force-close lingering
 *  keepalive sockets (Node ≥18.2) so browser tabs don't block exit. */
export function closeServer (server: http.Server): void {
  server.close()
  server.closeAllConnections()
}
```

*If `import sirv from 'sirv'` is rejected under `verbatimModuleSyntax`, switch to `import { default as sirv } from 'sirv'`; the runtime semantics are identical.*

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/server/httpServer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Lint**

Run: `npx eslint src/server/httpServer.ts tests/unit/server/httpServer.test.ts`
Expected: clean.

- [ ] **Step 7: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add package.json package-lock.json src/server/httpServer.ts tests/unit/server/httpServer.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(server): HTTP server with /healthz + sirv static fallback (httpServer)"
```

---

## Task 5: Entrypoint + server build wiring (`index.ts`, `tsconfig.server.json`, scripts)

**Files:**
- Create: `src/server/index.ts`, `tsconfig.server.json`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create the entrypoint `src/server/index.ts`**

```ts
import { closeServer, createServer } from './httpServer.js'
import { resolveWebPort } from './resolveWebPort.js'

const HOST = '0.0.0.0'

async function main (): Promise<void> {
  const port = await resolveWebPort()
  const server = createServer()
  server.listen(port, HOST, () => {
    process.stdout.write(`svgedit server listening on http://localhost:${port}/\n`)
  })

  const shutdown = (): void => {
    process.stdout.write('\nsvgedit server shutting down\n')
    closeServer(server)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

main().catch((err: unknown) => {
  process.stderr.write(`svgedit server failed to start: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
```

- [ ] **Step 2: Create `tsconfig.server.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src/server",
    "outDir": "dist/server",
    "noEmit": false,
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "types": ["node"]
  },
  "include": ["src/server/**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.test.js"]
}
```

- [ ] **Step 3: Wire the scripts in `package.json`**

In `package.json` `scripts`, make these exact changes:

- Replace `"start": "vite dev --host --port 8000 --strictPort",` with `"start": "vite dev --host",`
- Replace `"prestart": "echo svgedit is available at http://localhost:8000/src/editor/index.html",` with `"prestart": "echo svgedit is available at http://localhost:8100/src/editor/index.html",`
- Delete the line `"start:iife": "npm run build && vite preview --host --port 8000 --strictPort --outDir dist/editor --open /iife-index.html",`
- Replace `"build": "npm run typecheck && vite build packages/svgcanvas && vite build && npm run build:embed",` with `"build": "npm run typecheck && vite build packages/svgcanvas && vite build && npm run build:embed && npm run build:server",`
- Add after the `build:embed` line: `"typecheck:server": "tsc --noEmit -p tsconfig.server.json",`
- Add after `build:embed`: `"build:server": "tsc -p tsconfig.server.json",`
- Add after `start:e2e`: `"serve": "npm run build && node dist/server/index.js"`

(Leave `start:e2e` on port 9000 unchanged.)

- [ ] **Step 4: Type-check the server**

Run: `npm run typecheck:server`
Expected: no errors. *Fix any strict-mode type errors surfaced here before proceeding.*

- [ ] **Step 5: Build the server and smoke-run it**

Run: `npm run build:server`
Expected: emits `dist/server/{PortPicker,Config,resolveWebPort,httpServer,index}.js`.

Run a manual smoke (PowerShell, from repo root):
```
node dist/server/index.js
```
Expected: prints `svgedit server listening on http://localhost:8100/` (or a shifted port if 8100 is busy). `Ctrl+C` prints the shutdown line and exits. *(Static `dist/editor` may not exist yet if `npm run build` hasn't run — `GET /` then 404s, which is fine; `/healthz` still returns 200. Verify with `curl http://localhost:8100/healthz`.)*

- [ ] **Step 6: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/server/index.ts tsconfig.server.json package.json
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(server): entrypoint + tsconfig.server.json + serve/build scripts"
```

---

## Task 6: Move the dev loop off 8000 (`vite.config.mjs`, `.gitignore`)

**Files:**
- Modify: `vite.config.mjs`, `.gitignore`

- [ ] **Step 1: Make the vite dev/preview port env-aware on 8100**

In `vite.config.mjs`, add this constant just above `export default defineConfig({` (after the `htmlStringPlugin.enforce = 'post'` line):

```js
const devPort = Number(process.env.SVGEDIT_WEB_PORT) || 8100
```

Then in the `server` block change `port: 8000,` to `port: devPort,`, and in the `preview` block change `port: 8000,` to `port: devPort,`. Leave both `strictPort: true` and `host: '0.0.0.0'` as-is.

- [ ] **Step 2: Ignore the dev data root**

Append to `.gitignore`:

```
# svgedit server dev data root (sticky webPort, etc.)
.svgedit-data/
```

- [ ] **Step 3: Verify the dev server starts on 8100**

Run: `npm start` (from repo root)
Expected: vite serves at `http://localhost:8100/src/editor/index.html`. Open it; the editor renders. `Ctrl+C` to stop.

Run the env override once to confirm: `($env:SVGEDIT_WEB_PORT=8222) ; npm start` → vite serves on 8222. Stop, then `Remove-Item Env:SVGEDIT_WEB_PORT`.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add vite.config.mjs .gitignore
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(server): move vite dev/preview off 8000 to env-aware 8100"
```

---

## Task 7: Docs + CHANGELOG

**Files:**
- Modify: `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `STYLE.md`, `CHANGELOG.md`

- [ ] **Step 1: Update the port + serve commands in docs**

In each of `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `STYLE.md`, replace `http://localhost:8000` with `http://localhost:8100` (the `npm start` URL). In `AGENTS.md`, also add, near the `npm start` line:

```
npm run serve       # build + node dist/server/index.js → production server on 8100 (auto-shifts; SVGEDIT_WEB_PORT to override)
npm run build:server # tsc -p tsconfig.server.json → dist/server
```

- [ ] **Step 2: Add a CHANGELOG entry**

Under the `## [Unreleased]` heading in `CHANGELOG.md`, add:

```markdown
### Added
- **0a server skeleton.** A minimal Node HTTP server (`src/server/`, run via `npm run serve`) now serves the built editor and owns port resolution — `SVGEDIT_WEB_PORT` override, auto-shift within a 99-port band, and a sticky persisted port — mirroring ws-scrcpy-web's `reconcileWebPort()`. Foundation for #5 (Control Menu sidecar), #7 (packaging entrypoint), and #27 (services).

### Changed
- The dev server (`npm start`) and the new production server default to **port 8100** (was 8000), clearing the ws-scrcpy-web collision. Both honor `SVGEDIT_WEB_PORT`. The `start:iife` script is retired in favor of `npm run serve`.
```

*(If a `## [Unreleased]` section does not exist, add it directly under the changelog's top title, above the most recent released version.)*

- [ ] **Step 3: Lint the markdown**

Run: `npm run lint:md`
Expected: clean. *Fix any markdownlint issues (heading spacing, list style) inline.*

- [ ] **Step 4: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add README.md CONTRIBUTING.md AGENTS.md STYLE.md CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(server): document 8100 + npm run serve; changelog 0a skeleton"
```

---

## Task 8: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck everything**

Run: `npm run typecheck:editor` then `npm run typecheck:server`
Expected: both clean.

- [ ] **Step 2: Full build (incl. the new server)**

Run: `npm run build`
Expected: succeeds; `dist/editor/` and `dist/server/` both populated.

- [ ] **Step 2b: End-to-end serve smoke**

Run: `npm run serve`, then in another shell `curl http://localhost:8100/` and `curl http://localhost:8100/healthz`.
Expected: `/` returns the editor HTML; `/healthz` returns `{"status":"ok"}`. Stop with `Ctrl+C`.

- [ ] **Step 3: Lint + unit + e2e**

Run: `npm test`
Expected: lint clean, all unit tests pass (including the new `tests/unit/server/*`), e2e green on both browsers. *The e2e harness still uses `vite preview` on 9000 — unchanged.*

- [ ] **Step 4: Confirm the working tree is clean and the branch history is tidy**

Run: `git -C "C:/Users/jscha/source/repos/svgedit" status --short` (expect empty) and `git -C "C:/Users/jscha/source/repos/svgedit" log --oneline origin/master..HEAD` (expect the spec commit + the 7 task commits).

---

## Self-review (completed by plan author)

**Spec coverage:** server module set (Tasks 1–5) ✓ · `SVGEDIT_WEB_PORT` override + auto-shift + persist (Task 3) ✓ · default 8100 (Task 3/6) ✓ · data-root seam (Task 2) ✓ · sirv static + `/healthz` + API-handler seam (Task 4) ✓ · graceful shutdown (Tasks 4/5) ✓ · `tsconfig.server.json` + `build:server` + `serve`, retire `start:iife` (Task 5) ✓ · vite dev off 8000 (Task 6) ✓ · `.gitignore` (Task 6) ✓ · docs + CHANGELOG Unreleased (Task 7) ✓ · testing strategy (Tasks 1–4, 8) ✓ · deferred items untouched ✓.

**Type consistency:** `FlatConfig.webPort`, `resolveDataRoot(env, baseDir)`, `readConfig(dataRoot)`, `persistWebPort(port, dataRoot)`, `webPortOverride`, `findAvailablePort(start, end)`, `resolveWebPort(env, dataRoot)`, `DEFAULT_WEB_PORT`, `ApiHandler`, `createServer(options)`, `closeServer(server)` are referenced identically across tasks.

**Placeholder scan:** no TBD/TODO; every code step carries complete code. The two italicized notes (eslint `no-await-in-loop`; sirv default-import interop) are contingency instructions, not missing code.
