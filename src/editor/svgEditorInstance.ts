import type Editor from './Editor.js'

// The editor singleton lives on `globalThis` (keyed by a global-registry symbol),
// NOT a module-scoped variable. The extensions are built as a separate bundle
// (scripts/build-extensions.ts, rollup `preserveModules`) that gets its OWN copy of
// this module, so a module-scoped `_instance` splits per bundle: the main editor
// bundle sets its copy while every extension reads its own (forever unset), and
// every extension `init()` then throws "svgEditor not initialized" in the BUILT
// editor (dev works only because Vite serves one shared source module). A
// `Symbol.for` key resolves to the same slot across both bundle copies.
const INSTANCE_KEY = Symbol.for('@svgedit/editor-instance')
const globalStore = globalThis as unknown as Record<symbol, Editor | undefined>

/** Return the singleton Editor instance; throws if called before `setSvgEditor` */
export function getSvgEditor (): Editor {
  const instance = globalStore[INSTANCE_KEY]
  if (!instance) throw new Error('svgEditor not initialized')
  return instance
}

/** Register the singleton Editor instance; must be called once during editor initialization */
export function setSvgEditor (editor: Editor): void {
  globalStore[INSTANCE_KEY] = editor
}
