# Events

## Save / open / export handlers

Saving, opening, and exporting are provided by extensions — notably
`src/editor/extensions/ext-opensave/`. To change how the editor saves, opens,
or exports, customize or replace that extension. The handler shape (`open`,
`save`, `exportImage`, `exportPDF`) is documented as the `CustomHandler`
interface in `src/editor/Editor.ts`.

## Editor-ready event (host / embedder pages)

When the editor finishes loading it dispatches a native, bubbling
`CustomEvent` named `svgEditorReady` on the `document.documentElement` of its
opener or parent window (see `src/editor/editorInit.ts`). A host page listens
for it with native DOM events (no jQuery):

```js
document.addEventListener('svgEditorReady', () => {
  // The embedded / opened editor has finished initializing.
})
```

A clean host-facing API for driving the embedded editor is planned separately
(the embed-API work; it will ship as `EMBED_API.md`).

## Within-frame editor callbacks (`svgEditor.ready`)

Code running inside the editor frame can register callbacks with
`svgEditor.ready(fn)` (see `src/editor/Editor.ts`); it is used internally too.

## Extension events

Extensions run functions when certain events fire. See the `vars` parameter of
`runExtensions` in `packages/svgcanvas/svgcanvas.ts` for the available
extension events, and `ExtensionStatus` for the values the corresponding
extension methods return. See [ExtensionDocs](ExtensionDocs.md).

## Canvas events

Canvas events are observed with `canvas.bind(eventName, callback)` and fired
internally with `canvas.call(eventName, …)` (see
`packages/svgcanvas/svgcanvas.ts`). `bind` returns any previously bound
callback; the callback receives the `window` object and one event-specific
argument.

The events currently fired by the canvas (grep `call('…')` under
`packages/svgcanvas/` for the authoritative list) include `changed`,
`selected`, `pointsAdded`, `transition`, `contextset`, `zoomed`, `zoomDone`,
`updateCanvas`, `exported`, `exportedPDF`, `sourcechanged`, `setnonce`,
`unsetnonce`, `extension_added`, `beforeClear`, `afterClear`, and
`elementRenamed`. These mostly matter when working with the canvas directly or
developing svgedit itself.
