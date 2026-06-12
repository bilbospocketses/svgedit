/**
 * Minimal shape of the `window.svgEditor` global that e2e tests drive via
 * `page.evaluate`. Shared by the specs that round-trip SVG through the canvas API.
 */
export type SvgEditorWindow = Window & {
  svgEditor: { svgCanvas: { getSvgString: () => string; setSvgString: (s: string) => unknown } }
}
