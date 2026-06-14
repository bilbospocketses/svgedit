// @vitest-environment node
/**
 * Security regression tests for the local HTTP server's network exposure:
 *  - #5: bind to loopback (127.0.0.1) by default, not all interfaces (0.0.0.0).
 *  - #27: reject foreign Host headers (DNS-rebinding guard) when on loopback.
 */
import * as fs from 'node:fs'
import type * as http from 'node:http'
import * as net from 'node:net'
import type { AddressInfo } from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeServer, createServer, resolveBindHost } from '../../../src/server/httpServer.js'

const tmpDirs: string[] = []
function staticFixture (): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgedit-bind-'))
  tmpDirs.push(dir)
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html>editor-root', 'utf8')
  return dir
}

function listen (server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => { resolve((server.address() as AddressInfo).port) })
  })
}

// Raw socket so we control the exact Host line (fetch forbids the Host header).
function statusForHost (port: number, hostHeader: string, urlPath = '/healthz'): Promise<number> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(`GET ${urlPath} HTTP/1.1\r\nHost: ${hostHeader}\r\nConnection: close\r\n\r\n`)
    })
    let buf = ''
    sock.setEncoding('utf8')
    sock.on('data', (chunk: string) => { buf += chunk })
    sock.on('end', () => {
      const m = /^HTTP\/1\.\d (\d{3})/.exec(buf)
      resolve(m ? Number(m[1]) : 0)
    })
    sock.on('error', reject)
  })
}

describe('resolveBindHost (#5 — loopback by default)', () => {
  const saved = process.env.SVGEDIT_BIND_HOST
  afterEach(() => {
    if (saved === undefined) delete process.env.SVGEDIT_BIND_HOST
    else process.env.SVGEDIT_BIND_HOST = saved
  })

  it('defaults to loopback 127.0.0.1, not all interfaces', () => {
    delete process.env.SVGEDIT_BIND_HOST
    expect(resolveBindHost()).toBe('127.0.0.1')
  })

  it('honours an explicit SVGEDIT_BIND_HOST opt-in', () => {
    process.env.SVGEDIT_BIND_HOST = '0.0.0.0'
    expect(resolveBindHost()).toBe('0.0.0.0')
  })
})

describe('createServer — Host-header / DNS-rebinding guard (#27)', () => {
  const servers: http.Server[] = []
  afterEach(() => {
    while (servers.length > 0) { const s = servers.pop(); if (s) closeServer(s) }
    while (tmpDirs.length > 0) { const d = tmpDirs.pop(); if (d !== undefined) fs.rmSync(d, { recursive: true, force: true }) }
  })

  it('rejects a foreign Host header with 403 on the loopback default', async () => {
    const server = createServer({ staticDir: staticFixture() })
    servers.push(server)
    const port = await listen(server)
    expect(await statusForHost(port, 'evil.example')).toBe(403)
  })

  it('allows localhost and 127.0.0.1 Host values', async () => {
    const server = createServer({ staticDir: staticFixture() })
    servers.push(server)
    const port = await listen(server)
    expect(await statusForHost(port, `127.0.0.1:${port}`)).toBe(200)
    expect(await statusForHost(port, 'localhost')).toBe(200)
  })

  it('relaxes the guard when allowedHosts is null (explicit LAN-bind opt-in)', async () => {
    const server = createServer({ staticDir: staticFixture(), allowedHosts: null })
    servers.push(server)
    const port = await listen(server)
    expect(await statusForHost(port, 'evil.example')).toBe(200)
  })
})
