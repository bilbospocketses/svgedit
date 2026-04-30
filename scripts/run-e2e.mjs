import { spawn } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Put Playwright browsers inside the project so CI without sudo/system cache still works.
const playwrightCache = process.env.PLAYWRIGHT_BROWSERS_PATH ||
  join(process.cwd(), 'node_modules', '.cache', 'ms-playwright')
process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightCache
const sanitizedEnv = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: playwrightCache }
delete sanitizedEnv.ELECTRON_RUN_AS_NODE
delete process.env.ELECTRON_RUN_AS_NODE

// shell:true on Windows so `npx`/`npm` (which are `.cmd` shims) resolve via PATHEXT.
const isWindows = process.platform === 'win32'
const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: isWindows, env: sanitizedEnv, ...opts })
  child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))))
  child.on('error', reject)
})

const hasPlaywright = async () => {
  try {
    await run('npx', ['playwright', '--version'], { timeout: 30000 })
    return true
  } catch (error) {
    console.warn('Skipping e2e tests because Playwright is unavailable or failed to verify.')
    console.warn(error.message || error)
    return false
  }
}

const ensureBrowser = async () => {
  // Download Chromium to the project cache if it's missing.
  if (!existsSync(playwrightCache)) {
    await run('npx', ['playwright', 'install', 'chromium'])
  }
}

const getLatestMtime = async (root) => {
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
