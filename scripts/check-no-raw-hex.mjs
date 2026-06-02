// scripts/check-no-raw-hex.mjs
// Warns (default) or fails (--error) if a raw #hex color appears in chrome CSS / Lit
// `static styles` outside the allowlist. Usage: node scripts/check-no-raw-hex.mjs [--error]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const ERROR = process.argv.includes('--error')

// Files that legitimately contain raw hex (data, not chrome).
const ALLOW = [
  'src/editor/styles/tokens.css',
  'src/embed/palette-defaults.ts',
  'src/editor/locale/lang.en.ts',
  'src/editor/ConfigObj.ts'
].map((p) => p.split('/').join(sep))

const HEX = /#[0-9a-fA-F]{3,8}\b/

function walk (dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(css|ts)$/.test(e)) out.push(p)
  }
  return out
}

const violations = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (ALLOW.some((a) => rel.endsWith(a))) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (HEX.test(line)) violations.push(`${rel}:${i + 1}: ${line.trim()}`)
  })
}

if (violations.length) {
  const head = `[check-no-raw-hex] ${violations.length} raw hex outside tokens.css:`
  console[ERROR ? 'error' : 'warn'](`${head}\n${violations.join('\n')}`)
  if (ERROR) process.exit(1)
} else {
  console.log('[check-no-raw-hex] clean')
}
