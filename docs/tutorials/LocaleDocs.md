# Locale

This fork is **English-only**. The former `i18next`-based runtime and the
non-English locale files were removed per the project scope directive.
`src/editor/locale.ts` is a small shim that keeps the existing call shapes
working.

## The `t()` function

```js
import { t } from './locale.js'

t('foo.bar')             // dotted key against the default ('translation') bundle
t('myext:foo.bar')       // 'namespace:key' against an extension-registered bundle
t('greeting', { name })  // '{{name}}' placeholders replaced from the vars object
```

If a key is not found, `t()` returns the key string unchanged.

## Locale-object format

A bundle is a nested dictionary of strings (and sub-dictionaries). The base
English bundle is `src/editor/locale/lang.en.js` (default export). Example
shape:

```js
export default {
  tools: { select: 'Select', line: 'Line' },
  layers: { layer: 'Layer' }
}
```

## Extensions

Extensions register their own (English) strings under a namespace via
`svgEditor.i18next.addResourceBundle('en', '<name>', dict)`, typically loading
`ext-<name>/locale/en.js` during their `init` (see
[ExtensionDocs](ExtensionDocs.md)). The `addResourceBundle` facade deep-merges
into the namespace, so multiple consumers do not clobber each other.

## Not supported

Multi-language authoring and the old multiple-`lang.<code>.js` mechanism are
gone — the fork ships only `en`.
