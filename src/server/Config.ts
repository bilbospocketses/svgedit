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
