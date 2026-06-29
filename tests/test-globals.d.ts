import type { SvgEditEmbed } from '../src/embed/client.js'
import type Editor from '../src/editor/Editor.js'

// Ad-hoc globals the test suite hangs on `window`. Typed against their real
// shapes where one exists (rename-safety, #34 option B); honest inferred types
// for the per-spec dialog/log scaffolding. Kills the TS2339 "does not exist on
// Window" errors across the e2e specs.
declare global {
  interface Window {
    // Browser unit-test harness (src/editor/tests/unit-harness.html) exposing
    // the svgcanvas core modules to the tests/e2e/unit/* Playwright specs.
    svgHarness: {
      namespaces: typeof import('@svgedit/svgcanvas/core/namespaces.js')
      utilities: typeof import('@svgedit/svgcanvas/core/utilities.js')
      math: typeof import('@svgedit/svgcanvas/core/math.js')
      pathModule: typeof import('@svgedit/svgcanvas/core/path.js')
      coords: typeof import('@svgedit/svgcanvas/core/coords.js')
      units: typeof import('@svgedit/svgcanvas/core/units.js')
      draw: typeof import('@svgedit/svgcanvas/core/draw.js')
      history: typeof import('@svgedit/svgcanvas/core/history.js')
      recalculate: typeof import('@svgedit/svgcanvas/core/recalculate.js')
      util: typeof import('@svgedit/svgcanvas/common/util.js')
      touch: typeof import('@svgedit/svgcanvas/core/touch.js')
      clearModule: typeof import('@svgedit/svgcanvas/core/clear.js')
    }
    // Embed client instance (src/embed/client.ts) driven by the embed e2e specs.
    __svgeditEmbed: SvgEditEmbed
    // Editor instance alias used by a few specs (e.g. mainmenu).
    __svgEditor: Editor
    // Per-spec dialog/log/export scaffolding (assigned then read within a spec).
    __getLog: () => string
    __clearLog: () => void
    __promptResult: unknown
    __capturedDialog: string | null
    __capturedDialog2: string | null
    __svgEditorReady: Promise<unknown>
    __svgEditorReadyResolved: boolean
    __setConfig: unknown
    __raster: unknown
    __resolution: unknown
    __rulers: unknown
    __updated: unknown
    __pdf: unknown
    __title: unknown
    __bg: unknown
    onSeButton: ((...args: unknown[]) => void) | undefined
    onSeFlying: ((...args: unknown[]) => void) | undefined
    onSeExplorer: ((...args: unknown[]) => void) | undefined
  }
}

export {}
