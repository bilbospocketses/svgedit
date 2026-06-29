// The `Editor` import below drags the editor source graph into the tests
// program. The editor ambient declarations it relies on
// (src/editor/global-dialogs.d.ts = the seAlert/seConfirm/sePrompt globals;
// vite-shims.d.ts = the `*.html` module shim) are added to the tests program via
// tests/tsconfig.json `include` so the dragged source type-checks clean
// (#34 drag-resolution = option ii; include-style, not triple-slash, per eslint).
import type Editor from '../src/editor/Editor.js'

declare global {
  interface Window {
    svgEditor: Editor
  }
}

export {}
