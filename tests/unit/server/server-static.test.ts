// @vitest-environment node
/**
 * #33 — static-file exposure: the local server must not serve dotfiles
 * (a stray `.env`, `.git/config`, editor backups …) out of the static root,
 * independent of sirv's implicit option defaults. sirv v3 already skips
 * dotfiles in its default (non-dev) file index; these tests pin that posture
 * so a dependency default change or an accidental `dev:true` can't silently
 * start leaking them.
 */
import * as fs from 'node:fs'
import type * as http from 'node:http'
import * as net from 'node:net'
import type { AddressInfo } from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeServer, createServer } from '../../../src/server/httpServer.js'

const tmpDirs: string[] = []
function staticFixtureWithDotfile (): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgedit-static-'))
  tmpDirs.push(dir)
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html>editor-root', 'utf8')
  fs.writeFileSync(path.join(dir, '.env'), 'SECRET_TOKEN=do-not-serve', 'utf8')
  return dir
}

function listen (server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => { resolve((server.address() as AddressInfo).port) })
  })
}

// Raw socket so we control the Host line (fetch forbids the Host header).
function getPath (port: number, urlPath: string): Promise<{ status: number, body: string }> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(`GET ${urlPath} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`)
    })
    let buf = ''
    sock.setEncoding('utf8')
    sock.on('data', (chunk: string) => { buf += chunk })
    sock.on('end', () => {
      const m = /^HTTP\/1\.\d (\d{3})/.exec(buf)
      const sep = buf.indexOf('\r\n\r\n')
      resolve({ status: m ? Number(m[1]) : 0, body: sep >= 0 ? buf.slice(sep + 4) : '' })
    })
    sock.on('error', reject)
  })
}

describe('createServer — static-file exposure (#33)', () => {
  const servers: http.Server[] = []
  afterEach(() => {
    while (servers.length > 0) { const s = servers.pop(); if (s) closeServer(s) }
    while (tmpDirs.length > 0) { const d = tmpDirs.pop(); if (d !== undefined) fs.rmSync(d, { recursive: true, force: true }) }
  })

  it('serves a normal static file', async () => {
    const server = createServer({ staticDir: staticFixtureWithDotfile() })
    servers.push(server)
    const port = await listen(server)
    const res = await getPath(port, '/index.html')
    expect(res.status).toBe(200)
    expect(res.body).toContain('editor-root')
  })

  it('does not serve dotfiles such as /.env', async () => {
    const server = createServer({ staticDir: staticFixtureWithDotfile() })
    servers.push(server)
    const port = await listen(server)
    const res = await getPath(port, '/.env')
    expect(res.status).not.toBe(200)
    expect(res.body).not.toContain('do-not-serve')
  })
})
