# Configuration options

svgedit options come in two kinds:

- **Config** — settings not meant to be changed by the user through the UI.
- **Preferences** — settings the user *can* change through the UI (Editor Options).

Config and preferences must not share a name. The authoritative list of keys,
defaults, and types is the in-code `Config` and `Prefs` interfaces in
`src/editor/ConfigObj.ts`.

## Setting options programmatically

Call `svgEditor.setConfig(options)` before the editor initializes — for
example, from an inline script in your copy of `src/editor/index.html` that
runs before the editor boots. (This fork has no separate config file.)

```js
svgEditor.setConfig({
  dimensions: [320, 240],
  canvas_expansion: 5,
  initFill: { color: '0000FF' }
})
```

A second argument adjusts how the values apply:

```js
svgEditor.setConfig(options, { overwrite, allowInitialUserOverride })
```

- `overwrite: false` — do not overwrite previously, explicitly set
  configuration (the default is `true`, except URL config, which is always
  `false`).
- `allowInitialUserOverride: true` — let these values be overridden later via
  URL while still providing your defaults.

## Setting options via URL

The same options can be set as query parameters:

```text
.../index.html?dimensions=300,240&canvas_expansion=5&initFill[color]=0000FF
```

If an option is set both via `setConfig()` and the URL, the `setConfig()`
value wins. A few path-related options are disallowed via URL (but can still
be set with `setConfig()`). URL configuration can be locked down with the
`preventAllURLConfig` and `preventURLContentLoading` config flags.

## Preloading a file

To start with a preloaded SVG, set `noStorageOnLoad: true` first if you want
your string to take precedence over any previously stored user content (this
also prevents the user from saving locally).

```js
svgEditor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg">...</svg>')
svgEditor.loadFromDataURI('data:image/svg+xml;base64,...')
svgEditor.loadFromURL('images/logo.svg')
```

Or by URL parameter (value URL-encoded):

```text
?source=<encoded data URI>
?url=<encoded local URL>
```

`loadFromURL` and `?url=` fetch **same-origin** `http(s)` URLs only (relative paths
resolve same-origin); cross-origin and non-`http(s)` URLs are refused as an SSRF guard.
To preload content from another origin, fetch it in your own page and pass the string
via `loadFromString` or `?source=`.
