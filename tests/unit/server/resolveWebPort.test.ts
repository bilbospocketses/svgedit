// @vitest-environment node
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
function listenOnEphemeral (): Promise<net.Server> {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.listen(0, () => { resolve(s) })
  })
}
function portOf (s: net.Server): number {
  const addr = s.address()
  return typeof addr === 'object' && addr !== null ? addr.port : 0
}
function closeServer (s: net.Server): Promise<void> {
  return new Promise((resolve) => { s.close(() => { resolve() }) })
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveWebPort', () => {
  it('exposes the default port 8100', () => {
    expect(DEFAULT_WEB_PORT).toBe(8100)
  })

  it('honors the SVGEDIT_WEB_PORT override exactly and persists it', async () => {
    const root = makeTmpRoot()
    const probe = await listenOnEphemeral()
    const overridePort = portOf(probe)
    await closeServer(probe) // free it so the override can bind it
    const got = await resolveWebPort({ SVGEDIT_WEB_PORT: String(overridePort) }, root)
    expect(got).toBe(overridePort)
    expect(readConfig(root).webPort).toBe(overridePort)
  })

  it('auto-shifts within the band when the persisted port is busy, and persists the shift', async () => {
    const root = makeTmpRoot()
    const blocker = await listenOnEphemeral()
    const busy = portOf(blocker)
    try {
      fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ webPort: busy }), 'utf8')
      const got = await resolveWebPort({}, root)
      expect(got).toBeGreaterThan(busy)
      expect(got).toBeLessThanOrEqual(busy + 99)
      expect(readConfig(root).webPort).toBe(got)
    } finally {
      await closeServer(blocker)
    }
  })

  it('defaults to the DEFAULT_WEB_PORT band when nothing is set', async () => {
    const root = makeTmpRoot()
    const got = await resolveWebPort({}, root)
    expect(got).toBeGreaterThanOrEqual(DEFAULT_WEB_PORT)
    expect(got).toBeLessThanOrEqual(DEFAULT_WEB_PORT + 99)
  })
})
