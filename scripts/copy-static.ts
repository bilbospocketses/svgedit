import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { transform } from 'esbuild'

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

// Copy svgcanvas sources for Playwright unit-style tests in the browser.
// TypeScript files are transpiled to .js (type annotations stripped, ESM preserved).
// .d.ts files are SKIPPED (type declarations only, no runtime value).
// packages/svgcanvas/dist/ is EXCLUDED (tsc/vite output, not source).
const svgCanvasSrc = resolve(root, 'packages/svgcanvas')
const svgCanvasDest = resolve(outDir, 'tests/vendor/svgcanvas')

/**
 * Walk srcDir recursively, transpiling .ts -> .js via esbuild,
 * skipping .d.ts files and the dist/ subdirectory, copying everything else verbatim.
 * @param {string} srcDir  Absolute path to source directory
 * @param {string} destDir Absolute path to destination directory
 */
async function copyWithTsTranspile(srcDir, destDir) {
  const entries = await readdir(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const relToCanvasRoot = relative(svgCanvasSrc, srcPath)

    // Skip the dist/ subdirectory at the root of packages/svgcanvas
    if (entry.isDirectory() && relToCanvasRoot === 'dist') {
      continue
    }

    if (entry.isDirectory()) {
      const nestedDest = join(destDir, entry.name)
      await mkdir(nestedDest, { recursive: true })
      await copyWithTsTranspile(srcPath, nestedDest)
    } else {
      const name = entry.name

      // Skip .d.ts type declaration files — no runtime value
      if (name.endsWith('.d.ts')) {
        continue
      }

      if (name.endsWith('.ts')) {
        // Transpile TypeScript -> JavaScript: strip type annotations, preserve ESM
        const source = await readFile(srcPath, 'utf8')
        const { code } = await transform(source, {
          loader: 'ts',
          format: 'esm',
          target: 'es2022',
          sourcemap: false
        })
        // Write with .js extension so harness imports resolve
        const destName = name.slice(0, -3) + '.js'
        const destPath = join(destDir, destName)
        await mkdir(destDir, { recursive: true })
        await writeFile(destPath, code, 'utf8')
      } else {
        // .js, .json, .html, .md, etc. — copy verbatim
        await cp(srcPath, join(destDir, name))
      }
    }
  }
}

await copyWithTsTranspile(svgCanvasSrc, svgCanvasDest)

console.info('Copied static editor assets to dist/editor')
