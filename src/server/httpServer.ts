import type { IncomingMessage, ServerResponse } from 'node:http'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'

export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

export interface CreateServerOptions {
  staticDir?: string
  apiHandlers?: ApiHandler[]
  /**
   * Host-header allow-list (DNS-rebinding guard). Defaults to the loopback set;
   * pass `null` to disable the check when an operator has explicitly opted into a
   * non-loopback bind via {@link resolveBindHost} (LAN exposure is then their call).
   */
  allowedHosts?: Iterable<string> | null
}

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_STATIC_DIR = path.resolve(serverDir, '..', 'editor') // dist/server → dist/editor

// Loopback hostnames a locally-served editor may legitimately be reached at.
const DEFAULT_ALLOWED_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * The interface the server should bind. Loopback (127.0.0.1) by default so the
 * editor is not reachable from the LAN; an operator can opt into a wider bind
 * via `SVGEDIT_BIND_HOST` (e.g. `0.0.0.0`), taking responsibility for exposure.
 */
export function resolveBindHost (): string {
  const override = process.env.SVGEDIT_BIND_HOST
  return override !== undefined && override !== '' ? override : '127.0.0.1'
}

/** Whether a request's Host header is in the allow-list (port-insensitive). */
function hostAllowed (req: IncomingMessage, allowed: ReadonlySet<string>): boolean {
  const raw = req.headers.host
  if (raw === undefined || raw === '') return false
  const host = raw.replace(/:\d+$/, '').toLowerCase()
  return allowed.has(host)
}

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
  // Static serving is pinned to production semantics: `dev: false` keeps sirv on
  // its pre-indexed file map (no per-request `fs` reads, and that index skips
  // dotfiles), and `dotfiles: false` makes the dotfile exclusion explicit rather
  // than relying on sirv's implicit default — so a stray `.env`/`.git` never ships.
  const serveStatic = sirv(staticDir, { etag: true, single: false, dev: false, dotfiles: false })
  const allowedHosts: ReadonlySet<string> | null =
    options.allowedHosts === null ? null : new Set(options.allowedHosts ?? DEFAULT_ALLOWED_HOSTS)

  return http.createServer((req, res) => {
    void (async () => {
      try {
        if (allowedHosts !== null && !hostAllowed(req, allowedHosts)) {
          res.writeHead(403, { 'content-type': 'text/plain' })
          res.end('Forbidden')
          return
        }
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
