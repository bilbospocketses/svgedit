# Canvas

The canvas is svgedit's rendering and SVG-manipulation engine, in
`packages/svgcanvas/` (entry point `svgcanvas.ts`). It can run on its own or
driven by the [Editor](EditorAPI.md).

Its public API is the TypeScript surface of the `SvgCanvas` class plus the
`packages/svgcanvas/core/` modules — read the in-code types and JSDoc there.
There is no generated API site.

## Methods surfaced to extensions

Extensions reach the canvas through `getSvgEditor().svgCanvas` (some also
receive a context object as their `init` argument). See
[ExtensionDocs](ExtensionDocs.md).

## Canvas events

See the "Canvas events" section of [Events](Events.md).
