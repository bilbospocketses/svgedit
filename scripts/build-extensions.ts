import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build, type Plugin, type ResolvedConfig } from 'vite'
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars'
import string from 'vite-plugin-string'
import swc from 'unplugin-swc'

const root = process.cwd()
const extensionsRoot = resolve(root, 'src/editor/extensions')
const outDir = resolve(root, 'dist/editor/extensions')

const htmlStringPlugin = string({
  include: [
    'src/editor/dialogs/**/*.html',
    'src/editor/panels/*.html',
    'src/editor/templates/*.html',
    'src/editor/extensions/*/*.html'
  ]
})
htmlStringPlugin.enforce = 'post'

const entries: string[] = []
for (const dirent of await readdir(extensionsRoot, { withFileTypes: true })) {
  if (!dirent.isDirectory() || !dirent.name.startsWith('ext-')) continue
  // After TS migration Task 14, entry files are .ts; pre-migration code had .js.
  // Try .ts first, fall back to .js for safety during migration / external extensions.
  for (const ext of ['.ts', '.js']) {
    const entryPath = join(extensionsRoot, dirent.name, `${dirent.name}${ext}`)
    try {
      const st = await stat(entryPath)
      if (st.isFile()) {
        entries.push(entryPath)
        break
      }
    } catch {
      // no entry file at this ext, try next
    }
  }
}

if (!entries.length) {
  console.info('No extension entries found')
  process.exit(0)
}

await build({
  // Use isolated config to avoid inheriting the main lib/iife build.
  configFile: false,
  root,
  base: './',
  logLevel: 'info',
  plugins: [
    swc.vite({
      tsconfigFile: false,
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorVersion: '2022-03' },
        target: 'es2022',
        keepClassNames: true
      },
      sourceMaps: true
    }),
    {
      name: 'svgedit-skip-vite-build-html',
      apply: 'build',
      enforce: 'pre',
      configResolved (config: ResolvedConfig) {
        // plugins is readonly in ResolvedConfig; cast to write during build setup
        ;(config as unknown as { plugins: ResolvedConfig['plugins'] }).plugins =
          config.plugins.filter(plugin => plugin.name !== 'vite:build-html')
      }
    },
    htmlStringPlugin,
    {
      ...dynamicImportVars({
        include: ['src/editor/extensions/*/*.js']
      }),
      apply: 'build' as const
    } as Plugin
  ],
  build: {
    outDir,
    emptyOutDir: false, // main build already wrote Editor.js, keep it
    // #54: this is a prod-only build (dev serves extensions from source via the
    // vite dev server), so never emit `.js.map` — they embed full TS sources and
    // would be publicly fetchable under the served dist/editor/extensions/ tree.
    sourcemap: false,
    minify: false, // keep exports intact
    rollupOptions: {
      treeshake: false,
      preserveEntrySignatures: 'strict',
      input: entries,
      output: {
        format: 'es',
        inlineDynamicImports: false,
        preserveModules: true,
        preserveModulesRoot: extensionsRoot,
        entryFileNames: '[name].js',
        chunkFileNames: 'extensions/_chunks/[name]-[hash].js',
        assetFileNames: 'extensions/_assets/[name]-[hash][extname]'
      }
    }
  }
})

console.info(`Bundled ${entries.length} extensions`)
