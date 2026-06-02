# Canvas

The canvas is svgedit's rendering and SVG-manipulation engine, in
`packages/svgcanvas/` (entry point `svgcanvas.ts`). It can run on its own or
driven by the [Editor](EditorAPI.md).

Its public API is the TypeScript surface of the `SvgCanvas` class plus the
`packages/svgcanvas/core/` modules — read the in-code types and JSDoc there.
There is no generated API site.

## Methods surfaced to extensions

Extensions receive a set of canvas methods and properties as the first
argument to their `init` function. See [ExtensionDocs](ExtensionDocs.md) for
that object's shape and an example.

## Canvas events

See the "Canvas events" section of [Events](Events.md).
