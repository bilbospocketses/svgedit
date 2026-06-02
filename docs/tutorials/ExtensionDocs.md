# Extensions

svgedit supports extensions — standalone TypeScript modules that add tools,
buttons, and behavior. The built-in extensions live in
`src/editor/extensions/ext-<name>/`; `ext-grid` is a good, simple reference.

## Basic format

An extension default-exports an object with a `name` and an `init`:

```js
import { getSvgEditor } from '../../svgEditorInstance.js'

export default {
  name: 'myext',
  async init () {
    const svgEditor = getSvgEditor()
    const svgCanvas = svgEditor.svgCanvas
    // ...set up, then return an object describing buttons / handlers...
    return { /* svgicons, buttons, context_tools, event handlers, callback */ }
  }
}
```

- `name` is the unique extension ID; if omitted it is derived from the file
  name (`ext-<name>.ts` → `<name>`).
- `init` does the setup. Most extensions obtain the editor and canvas via
  `getSvgEditor()` (from `src/editor/svgEditorInstance.ts`); some also receive a
  context object (e.g. `{ svgroot, selectorManager }`) as `init`'s argument.
  `init` may be `async`.
- `init` returns an object that can include `svgicons`, `buttons`,
  `context_tools`, canvas event handlers (e.g. `mouseDown`, `mouseUp`,
  `selectedChanged`), and a `callback` run once the extension (and its icons)
  are ready. The full shape is the `ExtensionInitResponse` type in
  `packages/svgcanvas/`.

## Buttons, icons, context tools

Buttons appear in the left ("mode") panel or the top ("context") panel; declare
them in the returned `buttons` array, and selection-dependent tools in
`context_tools`. Icons are SVG — an XML document of `<g>` groups keyed by button
ID — referenced through the returned `svgicons` path.

## Localization

The fork is English-only, but the per-extension locale mechanism remains. Each
extension ships `ext-<name>/locale/en.js` (default-exporting a string
dictionary) and registers it during `init`:

```js
const lang = svgEditor.configObj.pref('lang') // 'en'
const strings = (await import(`./locale/${lang}.js`)).default
svgEditor.i18next.addResourceBundle(lang, name, strings)
```

`svgEditor.i18next` is the English-only locale shim (`src/editor/locale.ts`).
See [LocaleDocs](LocaleDocs.md).

## Helpers

Inside `init`, `getSvgEditor()` returns the editor and `svgEditor.svgCanvas`
the canvas, exposing its surfaced methods (`$id`, `$click`, `NS`,
`assignAttributes`, …). See [CanvasAPI](CanvasAPI.md).

## Extension events

See [Events](Events.md) for the events that trigger extension callbacks.
