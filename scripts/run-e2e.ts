import { spawn, type SpawnOptions } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Put Playwright browsers inside the project so CI without sudo/system cache still works.
const playwrightCache = process.env.PLAYWRIGHT_BROWSERS_PATH ||
  join(process.cwd(), 'node_modules', '.cache', 'ms-playwright')
process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightCache
const sanitizedEnv: Record<string, string | undefined> = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: playwrightCache }
delete sanitizedEnv['ELECTRON_RUN_AS_NODE']
delete process.env['ELECTRON_RUN_AS_NODE']

// shell:true on Windows so `npx`/`npm` (which are `.cmd` shims) resolve via PATHEXT.
const isWindows = process.platform === 'win32'
const run = (cmd: string, args: string[], opts: SpawnOptions = {}): Promise<void> => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: isWindows, env: sanitizedEnv, ...opts })
  child.on('exit', (code, signal) => (code === 0
    ? resolve(undefined)
    : reject(Object.assign(new Error(`${cmd} exited with code ${code}${signal ? ` (killed by ${signal})` : ''}`), { signal }))))
  child.on('error', reject)
})

// The availability probe's hang guard: far above a healthy `npx playwright --version`
// (a few seconds even on a cold npx cache), so only a hung probe reaches it.
const PLAYWRIGHT_PROBE_TIMEOUT_MS = 120000

const hasPlaywright = async () => {
  try {
    await run('npx', ['playwright', '--version'], { timeout: PLAYWRIGHT_PROBE_TIMEOUT_MS })
    return true
  } catch (error) {
    if (error instanceof Error && (error as Error & { signal?: string | null }).signal) {
      // Killed by the hang guard: say so loudly, so a slow or stuck box does not
      // quietly drop the e2e suite from `npm test`.
      console.error('='.repeat(78))
      console.error(`HUNG: the e2e availability probe \`npx playwright --version\` (scripts/run-e2e.ts) gave no answer within ${PLAYWRIGHT_PROBE_TIMEOUT_MS / 1000} s and was stopped.`)
      console.error('E2E TESTS WERE NOT RUN. Run `npx playwright test` by hand once the probe answers.')
      console.error('='.repeat(78))
      return false
    }
    console.warn('Skipping e2e tests because Playwright is unavailable or failed to verify.')
    console.warn(error instanceof Error ? error.message : String(error))
    return false
  }
}

const isBrowserInstalled = async (prefix: string): Promise<boolean> => {
  if (!existsSync(playwrightCache)) return false
  try {
    const entries = await readdir(playwrightCache)
    return entries.some(name => name.startsWith(prefix + '-'))
  } catch {
    return false
  }
}

const ensureBrowser = async () => {
  // Download browsers to the project cache if any are missing.
  if (!(await isBrowserInstalled('chromium'))) {
    await run('npx', ['playwright', 'install', 'chromium'])
  }
  if (!(await isBrowserInstalled('firefox'))) {
    await run('npx', ['playwright', 'install', 'firefox'])
  }
}

const getLatestMtime = async (root: string): Promise<number> => {
  let latest = 0
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      const childLatest = await getLatestMtime(fullPath)
      if (childLatest > latest) latest = childLatest
    } else {
      const fileStat = await stat(fullPath)
      if (fileStat.mtimeMs > latest) latest = fileStat.mtimeMs
    }
  }
  return latest
}

const ensureBuild = async () => {
  const distIndex = join(process.cwd(), 'dist', 'editor', 'index.html')
  let needsBuild = !existsSync(distIndex)

  if (!needsBuild) {
    const distStat = await stat(distIndex)
    const roots = [
      join(process.cwd(), 'packages', 'svgcanvas', 'core'),
      join(process.cwd(), 'src')
    ]
    const latestSource = Math.max(
      ...(await Promise.all(roots.map(getLatestMtime)))
    )
    if (latestSource > distStat.mtimeMs) {
      needsBuild = true
    }
  }

  if (needsBuild) {
    console.log('Building dist/editor for Playwright preview...')
    await run('npm', ['run', 'build'])
  }
}

if (await hasPlaywright()) {
  await ensureBrowser()
  await ensureBuild()
  await run('npx', ['playwright', 'test'])
}
