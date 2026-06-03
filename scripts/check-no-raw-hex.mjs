// scripts/check-no-raw-hex.mjs
// Warns (default) or fails (--error) if a raw color literal appears in:
//   - Any line of a .css file
//   - Any line inside a `css\`...\`` tagged-template literal in a .ts file
//
// Raw colors detected:
//   - Hex:         #[0-9a-fA-F]{3,8}\b
//   - Color funcs: rgb(), rgba(), hsl(), hsla()
//   - CSS keywords as property values (e.g. `color: black`)
//
// Safe values NOT flagged: transparent, currentColor, inherit, initial, unset, none, var(--)
// Escape hatch: any line containing the comment marker `hex-guard-allow` is skipped.
//
// Usage: node scripts/check-no-raw-hex.mjs [--error]

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const ERROR = process.argv.includes('--error')

// Only the token source is allowlisted — everything else must use tokens or a hex-guard-allow marker.
const ALLOW = [
  'src/editor/styles/tokens.css'
].map((p) => p.split('/').join(sep))

// --- Patterns ---

// Hex color: #RGB, #RRGGBB, #RRGGBBAA, etc.
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/

// Color functions: rgb(), rgba(), hsl(), hsla()
const COLOR_FN_RE = /\b(rgb|rgba|hsl|hsla)\s*\(/

// CSS color keywords when used as a property value.
// Matches: `<property>: <keyword>` or `<property>: <keyword>;` etc.
// Covers the most common named colors that should be tokenized.
const COLOR_KEYWORDS = [
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'gray', 'grey', 'silver', 'gold', 'pink', 'cyan', 'magenta', 'maroon',
  'navy', 'teal', 'olive', 'lime', 'aqua', 'fuchsia', 'brown', 'coral',
  'crimson', 'indigo', 'violet', 'salmon', 'khaki', 'beige', 'ivory',
  'tan'
]
// Matches a property value that is *only* a color keyword (optionally followed by ; or })
// e.g. `color: black`, `border-color: white;`, etc.
const COLOR_KW_RE = new RegExp(
  ':\\s*(' + COLOR_KEYWORDS.join('|') + ')\\b(?!\\s*-)',
  'i'
)

// Safe values (transparent, currentColor, inherit, initial, unset, none, var(--...)) are
// NOT included in COLOR_KEYWORDS above, so they will never match COLOR_KW_RE.
// var(--...) cannot trigger HEX_RE (no # outside var context needed) or COLOR_FN_RE.
// Therefore no extra safe-value filtering is needed in isRawColor.

function isRawColor (line) {
  // Skip if the line has the allow marker
  if (line.includes('hex-guard-allow')) return false

  const hasHex = HEX_RE.test(line)
  const hasFn = COLOR_FN_RE.test(line)
  const hasKw = COLOR_KW_RE.test(line)

  return hasHex || hasFn || hasKw
}

function walk (dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(css|ts)$/.test(e)) out.push(p)
  }
  return out
}

/**
 * For a .ts file, returns an array of booleans (one per line) indicating whether
 * that line is inside a `css\`...\`` tagged-template literal.
 *
 * State machine:
 *  - Start outside css template
 *  - When a line contains `css\`` (the opening tag), we enter css mode starting
 *    from that line (the opening line itself is checked).
 *  - We leave css mode when we see a line whose TRIMMED content starts with a
 *    backtick (the closing `` ` `` of the template literal at the standard
 *    `static styles = css\`...\n  \`` indentation pattern).
 *  - Nested html\`\` and svg\`\` blocks inside are still checked (they're inside
 *    the css\`\` block scope-wise but we don't need to exclude them; however
 *    html\`\` blocks are not css so they shouldn't have raw colors either).
 *
 * Note: this is a simple line-based state machine. It handles the standard Lit
 * pattern and is not a full JS parser. Edge cases like multi-line css`` openers
 * on the same line as another template close are not expected in this codebase.
 */
function computeCssLines (lines) {
  const inCss = new Array(lines.length).fill(false)
  let cssDepth = 0 // how many css`` blocks are open

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check for css` opener on this line (but not inside a comment)
    // We detect `css\`` as the tagged template open
    if (/\bcss`/.test(line)) {
      // This line opens a css block — mark it as in-css and increase depth
      cssDepth++
      inCss[i] = true
      continue
    }

    if (cssDepth > 0) {
      inCss[i] = true
      // Check if this line closes the template: trimmed starts with a backtick
      // The standard pattern is:  `  `` on its own (the closing of the template)
      if (trimmed.startsWith('`')) {
        // This is the closing line of a css`` block
        cssDepth--
      }
    }
  }

  return inCss
}

const violations = []

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (ALLOW.some((a) => rel.endsWith(a))) continue

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  const ext = file.endsWith('.css') ? 'css' : 'ts'

  if (ext === 'css') {
    // Check every line of CSS files
    lines.forEach((line, i) => {
      if (isRawColor(line)) {
        violations.push(`${rel}:${i + 1}: ${line.trim()}`)
      }
    })
  } else {
    // .ts files: only check lines inside css`` blocks
    const inCss = computeCssLines(lines)
    lines.forEach((line, i) => {
      if (inCss[i] && isRawColor(line)) {
        violations.push(`${rel}:${i + 1}: ${line.trim()}`)
      }
    })
  }
}

if (violations.length) {
  const head = `[check-no-raw-hex] ${violations.length} raw color(s) outside tokens.css:`
  console[ERROR ? 'error' : 'warn'](`${head}\n${violations.join('\n')}`)
  if (ERROR) process.exit(1)
} else {
  console.log('[check-no-raw-hex] clean')
}
