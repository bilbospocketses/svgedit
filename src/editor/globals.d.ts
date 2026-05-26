/**
 * Ambient type declarations for the `svgEditor` global used by custom element
 * components. Only the members actually accessed in src/editor/components/ are
 * typed here — everything else is intentionally omitted.
 *
 * TODO #19 will replace this ambient file with a proper accessor module
 * (`getSvgEditor()` / `setSvgEditor()`) and explicit imports.
 */

// ---------------------------------------------------------------------------
// svgEditor global — typed to cover what components actually use
// ---------------------------------------------------------------------------

interface SvgEditorConfigObj {
  curConfig: {
    imgPath: string
    dynamicOutput: boolean
  }
}

/** Minimal shape of the `svgCanvas` instance used by component files. */
interface SvgEditorCanvas {
  container: EventTarget
}

/**
 * Global `svgEditor` object injected into each custom element's scope at
 * runtime. Components access it via `declare const svgEditor: SvgEditorGlobal`
 * (replaces the previous `declare const svgEditor: any`).
 */
interface SvgEditorGlobal {
  configObj: SvgEditorConfigObj
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $click: (element: EventTarget, handler: (evt: any) => void) => void
  svgCanvas: SvgEditorCanvas
}

declare const svgEditor: SvgEditorGlobal
