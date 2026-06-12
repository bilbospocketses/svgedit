// @vitest-environment node
import * as fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
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
function listen (server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => { resolve((server.address() as AddressInfo).port) })
  })
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
    const port = await listen(server)
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
      apiHandlers: [async (req: IncomingMessage, res: ServerResponse) => {
        if (req.url === '/api/ping') {
          res.writeHead(200, { 'content-type': 'text/plain' })
          res.end('pong')
          return true
        }
        return false
      }]
    })
    const port = await listen(server)
    try {
      const ping = await fetch(`http://127.0.0.1:${port}/api/ping`)
      expect(await ping.text()).toBe('pong')
    } finally {
      closeServer(server)
    }
  })
})
