// Pull the editor's ambient declarations into the tests program so the editor
// source graph (dragged in by the `Editor` import below) type-checks clean:
// global-dialogs.d.ts = the seAlert/seConfirm/sePrompt globals; vite-shims.d.ts
// = the `*.html` module shim. Without these the dragged editor source spuriously
// fails (#34 drag-resolution = option ii).
/// <reference path="../src/editor/global-dialogs.d.ts" />
/// <reference path="../src/editor/vite-shims.d.ts" />
import type Editor from '../src/editor/Editor.js'

declare global {
  interface Window {
    svgEditor: Editor
  }
}

export {}
