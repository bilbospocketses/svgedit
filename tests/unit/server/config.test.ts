// @vitest-environment node
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
