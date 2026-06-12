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
