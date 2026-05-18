import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const outDir = resolve(root, 'dist/editor')

await mkdir(outDir, { recursive: true })

const targets = [
  ['src/editor/index.html', 'index.html'],
  ['src/editor/xdomain-index.html', 'xdomain-index.html'],
  ['src/editor/iife-index.html', 'iife-index.html'],
  ['src/editor/svgedit.css', 'svgedit.css'],
  ['src/editor/images', 'images'],
  ['src/editor/components/jgraduate/images', 'components/jgraduate/images'],
  ['src/editor/extensions', 'extensions'],
  // Test harness assets for Playwright (unit-style tests in browser)
  ['src/editor/tests', 'tests'],
  ['node_modules/path-data-polyfill/path-data-polyfill.js', 'tests/vendor/path-data-polyfill/path-data-polyfill.js']
]

for (const [src, dest] of targets) {
  await cp(resolve(root, src), resolve(outDir, dest), { recursive: true })
}

// Copy svgcanvas sources for Playwright unit-style tests in the browser
const svgCanvasSrc = resolve(root, 'packages/svgcanvas')
const svgCanvasDest = resolve(outDir, 'tests/vendor/svgcanvas')
await cp(svgCanvasSrc, svgCanvasDest, { recursive: true })

console.info('Copied static editor assets to dist/editor')
