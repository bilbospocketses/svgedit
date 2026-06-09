// Icon contact-sheet renderer for the M4 Phase-2 Lucide remap.
//
// Renders each given icon at 24px and 14px, on both the light and dark theme,
// in the real `--se-icon` token color, then screenshots each theme to a PNG for
// human visual acceptance between batches.
//
// HOW IT PAINTS — and why not CSS mask:
//   The live app paints icons with `mask-image:url(<file>.svg)` + a token
//   background (M4 Phase 1). Playwright's *headless* chromium does not render
//   `url()`-SVG masks (data: or http) — the element paints fully-clipped/blank —
//   although it renders gradient masks and <img> SVGs fine. (Real Chrome/Edge
//   render the app's masks correctly; this is a headless-only limitation, and
//   the existing icon-theming e2e only asserts the computed background-color so
//   it never surfaced it.) So for the contact sheet we INLINE each SVG and let
//   its `stroke="currentColor"` inherit `color: var(--se-icon)`. For monochrome
//   line glyphs that is pixel-equivalent to the masked silhouette, and it's the
//   faithful preview of the art the reviewer is judging.
//
// Usage:
//   node scripts/icon-contact-sheet.mjs --icons select.svg,rect.svg,undo.svg \
//        --label pilot --out "%LOCALAPPDATA%/ClaudeScratch/svgedit-m4p2"
//
// Playwright resolves from this repo's own node_modules; chromium is its bundled
// browser. No global/PATH binary.

import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

let chromium
try { ({ chromium } = await import('playwright')) }
catch { ({ chromium } = await import('@playwright/test')) }

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }

const REPO = 'C:/Users/jscha/source/repos/svgedit'
const EDITOR = `${REPO}/src/editor`
const icons = arg('--icons', '').split(',').map(s => s.trim()).filter(Boolean)
const label = arg('--label', 'sheet')
const outDir = resolve(arg('--out', `${process.env.LOCALAPPDATA}/ClaudeScratch/svgedit-m4p2`))
if (!icons.length) { console.error('ERROR: pass --icons a.svg,b.svg,...'); process.exit(1) }

const tokensCss = readFileSync(`${EDITOR}/styles/tokens.css`, 'utf8')

const cells = icons.map((file) => {
  let svg
  try { svg = readFileSync(`${EDITOR}/images/${file}`, 'utf8').trim() }
  catch { return `<figure class="cell missing"><div class="row">MISSING</div><figcaption>${file}</figcaption></figure>` }
  return `<figure class="cell">
    <div class="row">
      <span class="ico" style="width:24px;height:24px">${svg}</span>
      <span class="ico" style="width:14px;height:14px">${svg}</span>
    </div>
    <figcaption>${file}</figcaption>
  </figure>`
}).join('\n')

const pageHtml = (theme) => `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><style>
${tokensCss}
html { background:#fafafa; }
html[data-theme="dark"] { background:#1e1e1e; }
body { margin:0; padding:20px; font:12px/1.4 system-ui,Segoe UI,sans-serif; color:#222; }
html[data-theme="dark"] body { color:#ddd; }
h1 { font-size:13px; margin:0 0 14px; font-weight:600; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(118px,1fr)); gap:14px; }
.cell { margin:0; display:flex; flex-direction:column; align-items:center; gap:7px; padding:10px 6px; border:1px solid #8884; border-radius:8px; }
.row { display:flex; align-items:center; gap:14px; height:26px; }
.missing { outline:2px solid #e44; color:#e44; font-size:10px; }
/* The icon ink: currentColor on the inline svg inherits this token. */
.ico { display:inline-flex; color:var(--se-icon); }
.ico svg { width:100%; height:100%; display:block; }
figcaption { font-size:10.5px; opacity:.8; word-break:break-all; text-align:center; }
</style></head><body><h1>${label} — ${theme} · 24px + 14px · ink = var(--se-icon)</h1><div class="grid">${cells}</div></body></html>`

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 })
const written = []
for (const theme of ['light', 'dark']) {
  await page.setContent(pageHtml(theme), { waitUntil: 'load' })
  const file = `${outDir}/${label}-${theme}.png`
  await page.screenshot({ path: file, fullPage: true })
  written.push(file)
}
await browser.close()
console.log('WROTE:\n' + written.join('\n'))
