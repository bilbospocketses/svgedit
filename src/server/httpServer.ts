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
