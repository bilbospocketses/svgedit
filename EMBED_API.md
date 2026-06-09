# svgedit Embed API

**protocolVersion 1** — v1 scope: iframe embed, postMessage RPC, chrome control, two-way theme
sync, dialog hooks, typed events.

## Quickstart

Drop svgedit into any host page with four lines:

```html
<iframe id="svge"
        src="https://your-svgedit-host/index.html?embed=1&chrome=minimal&theme=dark">
</iframe>
<script type="module">
  import { SvgEditEmbed } from 'https://your-svgedit-host/dist/embed/index.js'

  const editor = new SvgEditEmbed(
    document.getElementById('svge'),
    { allowedOrigins: ['https://your-svgedit-host'] }
  )

  await editor.ready

  // load SVG content
  await editor.editor.loadFromString(
    '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80" fill="steelblue"/></svg>'
  )

  // listen for saves
  editor.on('save', ({ svgString }) => console.log('saved:', svgString))
</script>
```

Calls issued before `await editor.ready` are queued and flushed automatically once the editor
reports ready — no manual gating required.

---

## URL params reference

All params are optional. Apply them to the editor iframe `src`.

| Param | Type | Default | Effect |
| --- | --- | --- | --- |
| `embed` | `1` | absent | Activates embed mode. Enables the postMessage listener and chrome system. Without this param the editor runs in standalone mode and ignores all embed messages. |
| `chrome` | `full` \| `minimal` \| `none` | `none` when `embed=1` | Initial chrome preset. Set before first paint — no flash of unwanted chrome. See [Chrome control](#chrome-control). |
| `theme` | `light` \| `dark` | editor's persisted choice, else OS `prefers-color-scheme` | Initial theme, applied as `html[data-theme="<value>"]` (drives the design tokens). An invalid value falls back to the OS preference. |
| `allowedOrigins` | comma-separated origins | same-origin only | Origins the editor will accept postMessages from. `*` accepts any origin — logs a dev-only console warning; use only for local dev/test. |
| `dialogTimeout` | integer (ms) | `30000` | How long (ms) the editor waits for a host dialog handler to respond before falling back to its own internal modal. |

**Examples:**

```text
/index.html?embed=1
/index.html?embed=1&chrome=minimal&theme=dark
/index.html?embed=1&chrome=none&allowedOrigins=https://app.example.com
/index.html?embed=1&chrome=full&dialogTimeout=10000
/index.html?embed=1&allowedOrigins=https://host-a.com,https://host-b.com
```

---

## The SvgEditEmbed library

### Import

```js
// ES module from the editor host
import { SvgEditEmbed } from 'https://your-svgedit-host/dist/embed/index.js'

// npm package (when bundling)
import { SvgEditEmbed } from 'svgedit/embed'
```

### Constructor

```ts
new SvgEditEmbed(iframe: HTMLIFrameElement, opts?: SvgEditEmbedOptions)
```

`SvgEditEmbedOptions`:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `allowedOrigins` | `string[]` | `[new URL(iframe.src).origin]` | Origins the host will accept messages from. Pass `['*']` only for local dev. |

Constructing `SvgEditEmbed` immediately attaches a `window.message` listener. The handshake with
the editor begins as soon as the iframe loads.

### Public API

```ts
class SvgEditEmbed {
  // Resolves when the editor reports ready. Rejects on protocolVersion mismatch.
  readonly ready: Promise<ReadyPayload>

  // Proxy object — call any svgCanvas or Editor method as a Promise.
  readonly editor: Record<string, (...args: unknown[]) => Promise<unknown>>

  // Event subscriptions
  on(event: EmbedEventName, handler: (payload: unknown) => void): () => void
  off(event: EmbedEventName, handler: (payload: unknown) => void): void
  once(event: EmbedEventName, handler: (payload: unknown) => void): () => void

  // Chrome control (runtime)
  setChrome(state: ChromeState | ChromePreset): Promise<void>

  // Theme control (runtime)
  setTheme(theme: string): Promise<void>

  // Palette control (runtime) — replace the swatch palette
  setPalette(colors: readonly string[]): Promise<void>

  // Dialog hooks
  setDialogHandler(
    kind: 'prompt' | 'alert' | 'confirm',
    handler: (text: string, defaultValue?: string) => Promise<unknown>
  ): () => void   // returns unregister function

  // Adjust the dialog fallback timeout at runtime (overrides the URL param)
  setDialogTimeout(ms: number): Promise<void>

  // Tear down the message listener. Call when the iframe is removed from the DOM.
  dispose(): void
}
```

**ReadyPayload:**

```ts
type ReadyPayload = {
  version: string          // editor's package version (e.g. "7.5.0")
  protocolVersion: number  // always 1 for v1
  capabilities: string[]   // e.g. ["chrome", "theme", "dialog-hooks", "palette"]
}
```

---

## Calling editor methods

### The Proxy pattern

`editor.editor` is an ES `Proxy`. Any property access returns a function that sends a postMessage
`call` envelope to the iframe and resolves a Promise when the result arrives:

```js
await editor.ready

// Call any svgCanvas method by name
const zoom = await editor.editor.getZoom()
const svg  = await editor.editor.getSvgString()
await editor.editor.clearSelection()

// Call Editor load methods
await editor.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><circle r="40"/></svg>')
await editor.editor.loadFromURL('https://example.com/drawing.svg')
```

The editor-side dispatcher checks `svgCanvas` first, then the `Editor` instance. Every call
returns a `Promise` regardless of whether the underlying method is synchronous — postMessage is
always async.

### TypeScript typed access

For compile-time types, import the canvas type and cast:

```ts
import { SvgEditEmbed } from 'svgedit/embed'
import type { SvgCanvas } from 'svgedit/svgcanvas'

type PromisifiedCanvas = { [K in keyof SvgCanvas]: SvgCanvas[K] extends (...args: infer A) => infer R
  ? (...args: A) => Promise<Awaited<R>>
  : never
}

const editor = new SvgEditEmbed(iframe, { allowedOrigins: ['https://your-host.com'] })
const canvas = editor.editor as unknown as PromisifiedCanvas

await canvas.loadFromString(svg)
const result: string = await canvas.getSvgString()
```

### Element handle round-trip rules

Methods that return `Element` objects (such as `getElem`, `getSelectedElements`) cannot transfer
DOM nodes across the iframe boundary. The editor-side serializer replaces each `Element` with an
opaque handle object:

```js
// host receives a handle, not a real Element
const handle = await editor.editor.getElem('my-rect')
// handle looks like: { __svgeditHandle: 'el-42' }

// pass the handle back as an argument — the editor resolves it to the real Element
const id = await editor.editor.getId(handle)
```

Handle lifecycle rules:

- Handles are valid until the editor removes the element (e.g. via `loadFromString` replacing the
  entire document).
- Using a stale handle returns `ELEMENT_NOT_FOUND` (see [Error codes](#error-codes)).
- There is no automatic garbage collection of handles — they survive until the document is
  replaced.

### JSON serialization caveats

postMessage uses the structured-clone algorithm (superset of JSON). Three things to watch for:

| Type | Behavior |
| --- | --- |
| `undefined` return value | Arrives as `null` on the host side (JSON limitation). |
| `Function` in args or return | Silently dropped — functions cannot be cloned. Subscribe to events instead. |
| `Element` / `Node` | Replaced by a handle object (see above). |

---

## Subscribing to events

### Event allowlist

The embed API fires twelve typed events. Internal editor events are not forwarded to avoid
leaking implementation detail.

| Event | When | Payload |
| --- | --- | --- |
| `ready` | Once, when editor fully initialized | `{ version: string, protocolVersion: number, capabilities: string[] }` |
| `change` | After content change, debounced 200 ms | `{}` — deliberately empty; call `getSvgString()` when you need the bytes |
| `save` | User triggered save via editor chrome | `{ svgString: string }` |
| `selection-changed` | Selection updated | `{ count: number, ids: string[] }` |
| `theme-changed` | User toggled theme inside editor | `{ theme: string }` |
| `extension-error` | An extension threw on load or execution | `{ name: string, message: string, stack?: string }` |
| `error` | Generic editor runtime error worth surfacing | `{ message: string, source: string, stack?: string, code?: string }` |
| `destroy` | Editor is shutting down (pagehide / unload) | `{}` |
| `before-group` | Fires immediately before `groupSelectedElements` runs (v1.1) | `{}` — call `getSelectedElements()` if details needed |
| `after-group` | Fires immediately after `groupSelectedElements` completes (v1.1) | `{}` |
| `before-move` | Fires immediately before `moveSelectedElements` runs (v1.1) | `{}` |
| `after-move` | Fires immediately after `moveSelectedElements` completes (v1.1) | `{}` |

The four `before-*` / `after-*` group/move events are also exposed on svgCanvas's internal event
bus (`svgCanvas.bind('before-group', fn)`), which extensions like `ext-connector` subscribe to in
order to react to group/move lifecycle without monkey-patching svgCanvas methods. The embed
channel mirrors those events so external hosts get the same signal.

`change` is intentionally payload-free — sending the full SVG string on every stroke would be
expensive. Pull with `getSvgString()` when you actually need it (e.g. on an autosave timer).

### `on` / `off` / `once` examples

```js
// persistent subscription — on() returns an unsubscribe function
const unsub = editor.on('save', ({ svgString }) => {
  console.log('saved, length:', svgString.length)
})

// unsubscribe when done
unsub()

// equivalent long-form
editor.off('save', handler)

// one-shot — fires exactly once, then auto-removes
editor.once('selection-changed', ({ count, ids }) => {
  console.log('first selection:', count, ids)
})

// listen for content changes; pull bytes only when needed
editor.on('change', async () => {
  const svg = await editor.editor.getSvgString()
  localStorage.setItem('draft', svg)
})

// surface extension failures to your own error tracker
editor.on('extension-error', ({ name, message }) => {
  myErrorTracker.capture({ tag: 'svgedit-extension', name, message })
})
```

---

## Chrome control

Chrome refers to the editor's surrounding UI: toolbars, menus, layer panel, palette, status bar,
and header. In embed mode you choose which pieces to show.

### URL params (initial state)

Set chrome before first paint — no flash of unwanted UI:

```text
?embed=1&chrome=full      # all UI visible
?embed=1&chrome=minimal   # toolbox only; menu/layers/palette/statusbar/header hidden
?embed=1&chrome=none      # no UI at all — canvas only
?embed=1                  # shorthand for chrome=none
```

### Runtime API (chrome)

Toggle chrome live after the editor is ready:

```js
await editor.ready

// presets
await editor.setChrome('none')
await editor.setChrome('minimal')
await editor.setChrome('full')

// per-element control — omit a key to leave it unchanged
await editor.setChrome({ menu: true })            // show menu only
await editor.setChrome({ toolbox: true, layers: true })
await editor.setChrome({ palette: false, statusbar: false })
```

### ChromeState shape

```ts
type ChromePreset = 'full' | 'minimal' | 'none'

type ChromeState = {
  menu?:      boolean
  toolbox?:   boolean
  layers?:    boolean
  palette?:   boolean
  statusbar?: boolean
  header?:    boolean
}
```

Preset resolution:

| Preset | menu | toolbox | layers | palette | statusbar | header |
| --- | --- | --- | --- | --- | --- | --- |
| `full` | true | true | true | true | true | true |
| `minimal` | false | true | false | false | false | false |
| `none` | false | false | false | false | false | false |

Implementation: the server applies CSS classes (`no-menu`, `no-toolbox`, etc.) to `<body>`. The
`embed` class is always added when embed mode is active.

---

## Palette

Replace the editor's color swatch strip (`se-palette`) with your own brand colors.
Replace-semantics: your colors become the whole palette. The `none` (no-fill/no-stroke) swatch is
always kept — it is prepended if you omit it.

### URL param (initial state)

```text
?embed=1&palette=%23ff0000,%23223344,none
```

Comma-separated CSS colors, URL-encoded. Applied before first paint — no flash of the default
swatches.

### Runtime API (palette)

```js
import { SvgEditEmbed, DEFAULT_PALETTE } from 'svgedit/embed'

await editor.ready

await editor.setPalette(['#ff0000', '#223344', '#00a3e0'])     // replace
await editor.setPalette([...DEFAULT_PALETTE, '#00a3e0'])        // append (host-composed)
```

`DEFAULT_PALETTE` is the built-in 42-color array, exported for host-side composition.

### Validation

Each entry must be `none` or a valid CSS color. Invalid entries are dropped (the rest still
apply); if any are dropped at runtime the editor emits an `error` event with
`source: 'invalid-palette-color'`. If nothing valid remains, the default palette is restored.
`'palette'` appears in the `ready` payload's `capabilities`.

---

## Dialog hooks

By default the editor handles all three dialogs with its own built-in modals: `alert` →
`seAlert`, `confirm` → `seConfirm`, and `prompt` → `sePrompt` (a `SePromptDialog` text-input
modal returning the entered string, or `null` on cancel). Hosts can intercept any of the three
to render dialogs in their own design system.

> **Known limitation:** the browser's `beforeunload` ("Leave site?") confirmation is owned by
> the browser and cannot be replaced by an in-app modal — it is the one dialog outside this hook
> system.

### Registering handlers

```js
// alert — no return value needed
const unregAlert = editor.setDialogHandler('alert', async (text) => {
  await myToast(text)
})

// confirm — return true/false
const unregConfirm = editor.setDialogHandler('confirm', async (text) => {
  return await myCustomConfirmUI(text)
})

// prompt — return the user's string, or null on cancel
const unregPrompt = editor.setDialogHandler('prompt', async (text, defaultValue) => {
  return await myCustomInputUI(text, defaultValue)
})
```

Each `setDialogHandler` call returns an unregister function. Call it to stop intercepting:

```js
const unregAlert = editor.setDialogHandler('alert', handler)
// later:
unregAlert()  // editor uses its own modal again for alert
```

### Timeout behavior

If a registered handler does not resolve within the configured timeout (default 30 seconds,
configurable via `?dialogTimeout=<ms>` URL param or `editor.setDialogTimeout(ms)`), the editor:

1. Falls back to its own built-in modal for that dialog call.
2. Emits an `error` event with `source: 'dialog-handler-timeout'`.

```js
// shorten the timeout at runtime
await editor.setDialogTimeout(10000)

// detect timeouts
editor.on('error', ({ source, message }) => {
  if (source === 'dialog-handler-timeout') {
    console.warn('dialog handler too slow:', message)
  }
})
```

### Prompt dialog component

The `prompt` hook's default in-app modal is `SePromptDialog` (`se-prompt-dialog`) — an
interactive text-input dialog added in M3 (#13). A separate, legacy status-display component that
was once also named `sePromptDialog` has been renamed to `seStatusDialog`; the two are now
distinct and the naming overlap is resolved.

---

## Theme sync

Theme state flows both directions. Last write wins — there is no acknowledgement loop.

### Setting the initial theme

```text
?embed=1&theme=dark
?embed=1&theme=light
```

Or at runtime after `ready`:

```js
await editor.setTheme('dark')
await editor.setTheme('light')
```

The theme value is applied as `html[data-theme="<value>"]` on the editor's document, which
activates the design tokens. Only `light` and `dark` are supported; any other value falls back
to the OS `prefers-color-scheme`.

### Listening for editor-initiated theme changes

When a user clicks a theme toggle inside the editor (visible only when chrome includes it), the
editor emits `theme-changed`:

```js
editor.on('theme-changed', ({ theme }) => {
  document.documentElement.setAttribute('data-theme', theme)
})
```

### Echo-loop prevention

When the host calls `editor.setTheme(t)`, the editor applies the theme but does **not** emit a
`theme-changed` event back. The event only fires for user-initiated changes inside the editor.
This prevents the ping-pong loop: host applies → editor emits → host re-applies.

### Typical two-way sync pattern

```js
// Apply the editor's theme to the host page too
editor.on('theme-changed', ({ theme }) => {
  document.body.dataset.theme = theme
})

// Sync a host-side theme toggle to the editor
document.getElementById('my-theme-toggle').addEventListener('change', async (e) => {
  const theme = e.target.checked ? 'dark' : 'light'
  document.body.dataset.theme = theme
  await editor.setTheme(theme)
  // no echo — theme-changed will NOT fire from inside the editor for this call
})
```

---

## Security: allowedOrigins

The embed API validates origins on both sides independently. A bug on one side does not break the
boundary.

### Host side (SvgEditEmbed)

- Constructor option `allowedOrigins` defaults to `[new URL(iframe.src).origin]` — the iframe's
  own origin.
- Every inbound message is validated: `event.origin` must be in `allowedOrigins` AND
  `event.source` must be `iframe.contentWindow`. The second check prevents impersonation from
  other iframes in the page.
- Outbound messages use `iframe.contentWindow.postMessage(env, iframeOrigin)` — never `'*'`.
- Wildcard `'*'` is accepted but logs a warning and disables origin checking (dev/test only).

### Editor side (server.ts)

- URL param `?allowedOrigins=origin1,origin2` (comma-separated). Default is same-origin only.
- Inbound messages from unauthorized origins are silently dropped plus `console.warn`. The editor
  does not reply — it does not leak its existence to foreign origins.
- Outbound to `window.parent` uses the first allowed origin as `targetOrigin` (or `'*'` in
  wildcard mode).
- Wildcard `*` is accepted; logs a warning and disables origin checking.

### Recommended iframe sandbox attributes

```html
<iframe
  id="svge"
  src="https://your-svgedit-host/index.html?embed=1"
  sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
  referrerpolicy="strict-origin-when-cross-origin"
>
</iframe>
```

Caveats:

- `allow-same-origin` is required for the editor's localStorage persistence to work. Omitting it
  breaks the editor's settings save.
- `allow-downloads` is needed for the editor's SVG export / save-to-disk functionality.
- `allow-modals` is **optional**. The editor's `alert` / `confirm` / `prompt` / `select` dialogs are
  in-app `<dialog>.showModal()` modals that work with or without it, and an unregistered dialog
  handler falls back to those same in-app modals (not native `window.*` dialogs). The one thing this
  flag still gates is the browser-native `beforeunload` "Leave site?" unsaved-changes warning — omit
  it and that browser-owned prompt simply won't appear (already a documented limitation).
- `allow-top-navigation` is not needed and should be omitted — the embed API uses postMessage, not
  navigation.
- Do not add `allow-popups` unless your use case requires it.

---

## Versioning

The postMessage envelope carries `v: 1` (the `protocolVersion`). This is separate from the
editor's package version (its semver).

### What protocolVersion covers

The envelope shape — `ns`, `v`, `kind`, `id`, field names — is the versioned contract. Method
names on the canvas surface are not versioned; new methods auto-expose via the generic forwarder,
and unknown method names return `METHOD_NOT_FOUND`.

### Backward compatibility (editor evolves, host stays on v1 library)

- New `svgCanvas` methods appear automatically — no host library update needed.
- New capabilities appear in the `ready` payload's `capabilities` array. Feature-detect rather
  than version-sniff:

  ```js
  const { capabilities } = await editor.ready
  if (capabilities.includes('my-future-capability')) { /* ... */ }
  ```

- Unknown method names → `METHOD_NOT_FOUND` error code — hosts can test for a method's existence
  without try/catch at every call site.

### Forward compatibility (host upgrades first, editor reports v2)

If the editor reports `protocolVersion: 2` but the host proxy library expects `1`, the proxy
rejects the `ready` promise with a clear error:

```text
svgedit embed: protocolVersion mismatch — host expects 1, editor reports 2
```

Update the host's `SvgEditEmbed` library to match the new editor version before enabling the
upgraded editor.

---

## Error codes

All errors arrive as a rejected Promise on the call site. The error object has a `code` property
when the failure is typed.

| Code | When |
| --- | --- |
| `METHOD_NOT_FOUND` | The method name does not exist on `svgCanvas` or `Editor`. |
| `ELEMENT_NOT_FOUND` | An element handle was passed but the element it referred to no longer exists in the document. |
| `PROTOCOL_VERSION_MISMATCH` | Editor and host proxy library disagree on `protocolVersion`. The proxy rejects `editor.ready`; the rejection `Error` carries this `code`. |
| `DIALOG_HANDLER_TIMEOUT` | A registered dialog handler did not resolve within the timeout. Surfaced as an `error` event carrying `source: 'dialog-handler-timeout'` and this `code`; the editor falls back to its own modal. |

Catching errors:

```js
try {
  await editor.editor.someSvgCanvasMethod()
} catch (err) {
  if (err.code === 'METHOD_NOT_FOUND') {
    // feature not available in this editor version
  }
}

// or use then/catch for Promise chains
editor.editor.getElem('deleted-element-id')
  .then(handle => editor.editor.getId(handle))
  .catch(err => {
    if (err.code === 'ELEMENT_NOT_FOUND') {
      console.warn('element was removed')
    }
  })
```

---

## Rolling your own client

If your host cannot use the JavaScript proxy library (non-JS host, WebAssembly, server-side
rendering, etc.), you can speak the protocol directly via postMessage.

### Envelope shape

All messages share `ns: 'svgedit'` and `v: 1`. Foreign messages (wrong `ns` or `v`) are silently
dropped by both sides.

```ts
// Host → Editor
{ ns: 'svgedit', v: 1, kind: 'call',            id: number, method: string, args: unknown[] }
{ ns: 'svgedit', v: 1, kind: 'dialog-response', id: number, response: unknown }

// Editor → Host
{ ns: 'svgedit', v: 1, kind: 'result',          id: number, result: unknown }
{ ns: 'svgedit', v: 1, kind: 'error',           id: number, message: string, stack?: string, code?: string }
{ ns: 'svgedit', v: 1, kind: 'event',                       name: string, payload: unknown }
{ ns: 'svgedit', v: 1, kind: 'dialog-request',  id: number, dialog: 'prompt' | 'alert' | 'confirm', args: unknown[] }
```

`id` is your correlation token. Use a monotonically increasing integer. Match a `result` or
`error` back to a `call` by `id`. Match a `dialog-response` to a `dialog-request` by `id`. Events
have no `id` — they are fire-and-forget.

### targetOrigin rules

- **Host → Editor:** `iframe.contentWindow.postMessage(env, iframeOrigin)` where `iframeOrigin` is
  the editor host's origin. Never use `'*'` in production — it exposes the message to any embedded
  frame that may be co-resident.
- **Editor → Host:** the editor sends to `window.parent` with `targetOrigin` set to the first
  entry in `allowedOrigins` (or `'*'` in wildcard mode). Your host page must be at that origin to
  receive the message.

### Minimal raw-protocol example

```js
const iframe = document.getElementById('svge')
const editorOrigin = new URL(iframe.src).origin
let callId = 0
const pending = new Map()

window.addEventListener('message', (e) => {
  if (e.source !== iframe.contentWindow) return
  if (e.origin !== editorOrigin) return
  const env = e.data
  if (!env || env.ns !== 'svgedit' || env.v !== 1) return

  if (env.kind === 'event' && env.name === 'ready') {
    // editor is ready; flush your queued calls
    console.log('ready', env.payload)
  }
  if (env.kind === 'result') {
    pending.get(env.id)?.resolve(env.result)
    pending.delete(env.id)
  }
  if (env.kind === 'error') {
    const err = Object.assign(new Error(env.message), { code: env.code })
    pending.get(env.id)?.reject(err)
    pending.delete(env.id)
  }
  if (env.kind === 'event') {
    console.log('event:', env.name, env.payload)
  }
})

function call (method, args = []) {
  return new Promise((resolve, reject) => {
    callId += 1
    pending.set(callId, { resolve, reject })
    iframe.contentWindow.postMessage(
      { ns: 'svgedit', v: 1, kind: 'call', id: callId, method, args },
      editorOrigin
    )
  })
}

// usage after ready:
const svg = await call('getSvgString')
await call('loadFromString', ['<svg xmlns="http://www.w3.org/2000/svg"><circle r="20"/></svg>'])
```

### Named operations via special method names

The generic `call` forwarder dispatches to `svgCanvas` first, then `Editor`. A small set of
`__prefixed` method names route to built-in embed operations:

| Method name | Effect |
| --- | --- |
| `__setTheme` | Apply theme via `html[data-theme]` (`'light'` / `'dark'` arg) |
| `__setChrome` | Apply chrome state (string preset or ChromeState object) |
| `__setPalette` | Replace the swatch palette (array of CSS colors) |
| `__setDialogTimeout` | Update dialog fallback timeout (number ms) |
| `__registerDialogHandler` | Tell the editor you are handling a dialog kind |
| `__unregisterDialogHandler` | Tell the editor you stopped handling a dialog kind |

You only need these if you are building your own dialog hook system. The `SvgEditEmbed` proxy
library handles them transparently.

---

## Sandbox attributes summary

Summary of the sandbox attributes discussed in [Security: allowedOrigins](#security-allowedorigins):

```html
<iframe
  id="svge"
  src="https://your-svgedit-host/index.html?embed=1&chrome=minimal"
  sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"
  referrerpolicy="strict-origin-when-cross-origin"
  width="100%"
  height="600"
  style="border:0;"
>
</iframe>
```

| Attribute | Required? | Why |
| --- | --- | --- |
| `allow-scripts` | Always | The editor is a JavaScript application. |
| `allow-same-origin` | Strongly recommended | Needed for localStorage (editor settings persistence). Without it, every session starts from defaults. |
| `allow-downloads` | If export / save needed | SVG export / save-to-disk triggers a browser download. |
| `allow-modals` | Optional | The editor's dialogs are in-app `<dialog>.showModal()` modals that work without it (verified); an unregistered handler falls back to those same in-app modals, not native `window.*`. It gates only the browser-native `beforeunload` unsaved-changes prompt. |
| `allow-popups` | Rarely | Not required by the embed API. Add only if an extension you load needs it. |
| `allow-top-navigation` | No | The embed API uses postMessage only. Do not add this. |
