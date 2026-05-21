# svgedit Embed API — Design

## Status

- **2026-05-20:** Designed via brainstorming session.
- **2026-05-21:** v1 SHIPPED (PR #14 → master `e35a407c`).
- **2026-05-21:** v1.1 audit-cleanup sweep (this update) — closes traceability for audit inputs #2 (runExtensions API tightening, in code), #6 (missing-icon → `error` event, in code), #4 (deferred to #3 Lit conversion of `sePromptDialog`), #7 + #12 (reclassified as non-goal). Audit input #1 remains the only outstanding follow-up; tracked as PR-B (events allowlist 8→12 + ext-connector refactor).
- v1 scope locked.

## Context

svgedit is a personal hard fork of [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit) shaped toward standalone desktop distribution AND iframe-embeddable use inside [Control Menu](https://github.com/bilbospocketses/control-menu) and other host applications. The scope directive (locked 2026-04-30, `memory/project_svgedit.md`) calls for:

- The whole app must drop neatly into an iframe.
- Hand-written `EMBED_API.md` is the contract (no upstream `jsdoc` generator pipeline).
- Embed exposes selective controls, including **two-way theme sync** between parent/child via postMessage.
- Control Menu (and any future host) calls the embed surface; full editor chrome stays optional.

**Inputs to this design:**

- **V6 reference** at `_reference/embed-api-v6/embedapi.js` — `EmbeddedSVGEdit` class wrapping an iframe; postMessage RPC with a same-origin shortcut; ~140 flat method names hand-listed; callback-based; IE9-era code style; manual Backspace forwarding from parent to iframe.
- **V7 internal surface** — `window.svgEditor = this` set at `src/editor/Editor.ts:324`. Promise-returning load methods on the Editor instance (`loadFromString`, `loadFromURL`, `loadFromDataURI`, `loadSvgString`); read via `svgCanvas.getSvgString()`. Used by `ext-storage` + `ext-opensave`. No postMessage layer.
- **Audit inputs** — `docs/AUDIT_2026-05-16.md` § "Embed-API design inputs (#4)" lists 12 design-relevant items, referenced inline below.
- **TS foundation** — Step 3 (JS → TS migration) shipped 2026-05-20 (master `1fdceac8`, tag `post-ts-migration`). `dist/svgcanvas.d.ts` is now emitted by `tsc --build` and can be imported by host code for typed access to the canvas surface.

## Goals

1. **Standalone usability preserved** — embed APIs do not regress single-page-app use of svgedit.
2. **Cross-origin first** — Control Menu runs as a separate origin (Blazor Server, different port); the design assumes cross-origin and same-origin works as a degenerate case, not the other way around.
3. **Full canvas access** — Host can call any `svgCanvas` method by name, not a curated subset. (See Q1.)
4. **Zero method-list maintenance** — generic forwarder + reuse existing TS declarations, not hand-maintained allowlists. (See Q2.)
5. **Async-first** — postMessage-only transport; no sync-vs-async ergonomic divergence. (See Q3.)
6. **Discrete typed events** — strict ~8-event allowlist for host notifications; no firehose of internal events. (See Q4.)
7. **Chrome control** — URL params for initial state + runtime API for live toggling. (See Q5.)
8. **Host-overridable dialogs** — editor renders its own modal by default; host can opt-in to intercept per-call. (See Q6.)
9. **Two consumption paths** — ship a proxy library AS the canonical client AND document the raw postMessage protocol for hosts that build their own. (See Q7.)

## Non-goals (v1)

- Web component wrapper (`<svg-edit-canvas>`, Approach C from Q7) — deferred until a concrete declarative-host need surfaces.
- Sandboxed iframe permissions (CSP, `sandbox=`, `allow=` attrs) — host's responsibility. `EMBED_API.md` will include a "recommended sandbox attributes" reference section but won't enforce.
- **Multi-iframe clipboard tab-sync** (audit input #7, #12) — reclassified from "follow-up" to **non-goal** in the 2026-05-21 v1.1 sweep. No multi-iframe scenario is on the project roadmap; the existing `window.storage` clipboard works for the multi-TAB case already, which is the only use that exists. If a real multi-iframe host emerges later, reopen this as a new design item — don't reopen as an audit follow-up.
- Native dialog → Lit modal IMPLEMENTATION — that's todo #13. This design specifies the embed-side hook CONTRACT; the Lit modals built for #13 will be the default behavior when no host handler is registered.
- Auto-revoking dead Element handles — handles are valid until the editor removes the element. If a host caches a handle past element deletion, next use returns `ELEMENT_NOT_FOUND`. Documented; no GC magic.
- Translation across `protocolVersion` bumps — when we bump to v2, host's v1 proxy library doesn't auto-translate; host upgrades its proxy library to match. Documented.
- Reverting `ext-connector.js` monkey-patching (audit input #1) — out of scope for v1; tracked as separate post-v1 follow-up (see "Follow-up items" below).

## Architecture

Two TypeScript modules + one canonical doc:

| File | Role |
|---|---|
| `src/embed/server.ts` | **Editor-side.** Wired into `Editor.ts` at construction. Detects embed mode (URL `?embed=1` OR `window.parent !== window`). Attaches a single postMessage listener. Applies URL-param chrome state on init. Fires the `ready` event when the document is fully initialized. Also implements the dialog hook fallback (internal Lit modal when no host handler registered). |
| `src/embed/client.ts` | **Host-side proxy library.** Compiled to `dist/embed/client.js` + `dist/embed/client.d.ts`. Target size ~150 lines. Single exported class `SvgEditEmbed` constructed with `(iframeElement, {allowedOrigins})`. Uses ES `Proxy` to auto-forward `editor.<anyMethod>(...)` → postMessage → resolves Promise with result. `editor.on(...)` / `off` / `once` for events. `editor.setTheme(...)` / `setChrome(...)` / `setDialogHandler(...)` for the named extras. |
| `EMBED_API.md` (repo root) | Canonical documentation. Documents URL params, the postMessage envelope shape, the events allowlist with payload schemas, the dialog hook contract, the security model, and a "rolling your own client" guide for hosts that can't use the JS proxy library. |

The editor build emits `dist/embed/client.{js,d.ts}` alongside the existing `dist/svgcanvas.{js,d.ts}`. Hosts depend on both:

```ts
import { SvgEditEmbed } from 'svgedit/embed'
import type { SvgCanvas } from 'svgedit/svgcanvas'
```

## Protocol — postMessage envelope

All messages share `ns: 'svgedit'` (rejects foreign messages) and `v: 1` (the protocol-major version).

```ts
type EmbedEnvelope =
  | { ns: 'svgedit'; v: 1; kind: 'call';            id: number; method: string; args: unknown[] }
  | { ns: 'svgedit'; v: 1; kind: 'result';          id: number; result: unknown }
  | { ns: 'svgedit'; v: 1; kind: 'error';           id: number; message: string; stack?: string; code?: string }
  | { ns: 'svgedit'; v: 1; kind: 'event';                       name: string; payload: unknown }
  | { ns: 'svgedit'; v: 1; kind: 'dialog-request';  id: number; dialog: 'prompt' | 'alert' | 'confirm'; args: unknown[] }
  | { ns: 'svgedit'; v: 1; kind: 'dialog-response'; id: number; response: unknown }
```

- `id` is the correlation token for `call`/`result`/`error` pairs and `dialog-request`/`dialog-response` pairs (monotonically increasing integer; separate counters per direction is fine).
- Events are fire-and-forget (no `id`).
- Host's `SvgEditEmbed` checks `v` compatibility on the first inbound message; major mismatch → throws with a clear error (`'svgedit embed: protocolVersion mismatch — host expects 1, editor reports 2'`).

## Initialization & handshake

**Editor side** (in `Editor.ts` construction path, after URL-param parse):

1. If `?embed=1` OR `window.parent !== window`: attach postMessage listener with origin validation against `allowedOrigins` (URL param `?allowedOrigins=origin1,origin2`, default same-origin).
2. Apply URL-param chrome state (`?chrome=full|minimal|none`) + theme (`?theme=...`).
3. When editor is fully initialized (existing `svgEditor:ready` DOM event — audit input #8): fire embed `ready` event with payload `{version, protocolVersion: 1, capabilities: ['chrome', 'theme', 'dialog-hooks']}`. `version` comes from `package.json`.

**Host side** (in `SvgEditEmbed`):

1. Construct: `new SvgEditEmbed(iframe, {allowedOrigins: ['https://controlmenu.local']})`. Subscribes `window.message` filtered to `iframe.contentWindow`.
2. Awaits `ready` event (also exposed as `editor.ready: Promise<ReadyPayload>` for await-style callers).
3. After `ready` resolves: host can call methods + subscribe events. **Calls issued before `ready` are queued and flushed on resolve** — hosts don't need to gate every call.
4. `capabilities` array lets hosts feature-detect without version sniffing — if a future svgedit drops a capability, hosts can gracefully degrade.

## API surface — methods forwarder

The editor-side forwarder dispatches calls against `svgCanvas` first, then the `Editor` instance:

```ts
// server.ts (sketch)
function handleCall(env: { method: string; args: unknown[] }): unknown {
  const svgEditor = window.svgEditor as Editor
  const target = (svgEditor.svgCanvas as any)[env.method]
    ? svgEditor.svgCanvas
    : svgEditor
  const fn = (target as any)[env.method]
  if (typeof fn !== 'function') {
    throw Object.assign(new Error(`method not found: ${env.method}`), { code: 'METHOD_NOT_FOUND' })
  }
  return fn.apply(target, env.args)
}
```

- All calls return Promises host-side (postMessage is async; even sync editor methods deliver their result asynchronously).
- **Postmessage-serialization implications** documented prominently in `EMBED_API.md`:
  - `Element` / `Node` return values become opaque handle strings (`{__svgeditHandle: 'el-123'}`). Host can pass handles back into subsequent calls; the editor's inbound handler resolves them back to real Element refs before invoking the method. Element-ref methods are the trickiest part of the API; we ship a dedicated e2e suite (`embed-element-handles.spec.ts`) to nail down round-trip semantics.
  - `Function` args/returns are silently dropped (postMessage can't transfer them). Host can subscribe to events instead.
  - `undefined` → `null` (JSON limitation). Documented.
- **TS types:** host writes `import type { SvgCanvas } from 'svgedit/svgcanvas'`. The `SvgEditEmbed` proxy's typed surface is:
  ```ts
  type EmbedSurface = Promisified<SvgCanvas>
    & Promisified<Pick<Editor, 'loadFromString' | 'loadFromURL' | 'loadFromDataURI' | 'loadSvgString'>>
    & {
      setTheme(theme: string): Promise<void>
      setChrome(state: ChromeState | ChromePreset): Promise<void>
      setDialogHandler(kind: 'prompt' | 'alert' | 'confirm', fn: DialogHandler): () => void
      setDialogTimeout(ms: number): Promise<void>
      on(event: EmbedEventName, handler: EmbedEventHandler): () => void
      off(event: EmbedEventName, handler: EmbedEventHandler): void
      once(event: EmbedEventName, handler: EmbedEventHandler): void
      readonly ready: Promise<ReadyPayload>
    }
  ```
  where `Promisified<T>` is the standard `{ [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never }` shape.
- `MethodNotFoundError` is returned as `{kind: 'error', code: 'METHOD_NOT_FOUND'}` so hosts can feature-detect without try/catch on the call site if they prefer.

## Events allowlist (8 events)

| Event | Payload | When |
|---|---|---|
| `ready` | `{version: string, protocolVersion: number, capabilities: string[]}` | Once, when editor fully initialized |
| `change` | `{}` (deliberately empty — host calls `getSvgString()` if the bytes are needed; the payload would be heavy on every change) | After content change, debounced 200ms |
| `save` | `{svgString: string}` | User invoked save via editor chrome (when chrome is shown). Carries the SVG since intent-to-commit is the moment hosts want the bytes. |
| `selection-changed` | `{count: number, ids: string[]}` | Selection updated. IDs only (host can look up details via methods if needed). |
| `theme-changed` | `{theme: string}` | User toggled theme inside editor (two-way sync; see Theme sync section) |
| `extension-error` | `{name: string, message: string, stack?: string}` | Closes audit input #5 (silent `console.error` → surfaceable to host) |
| `error` | `{message: string, source: string, stack?: string}` | Generic editor-runtime error the editor decides is host-worth-knowing |
| `destroy` | `{}` | Editor shutting down (pagehide / unload). Host can clean up its proxy. |

**Deliberately skipped:**

- `extension-loaded` — too noisy; success is the default expectation.
- `chrome-changed` — host knows when it called `setChrome`; editor-initiated chrome changes don't exist in v1's design.
- Fine-grained editor internal events (`mouse-down`, `mouse-up`, `transition`, etc.) — would leak internal state; host can subscribe to `change` for outcomes.
- `prompt-requested` / `alert-requested` / `confirm-requested` — handled by the dialog hook system (below), not the event channel.

## URL params

| Param | Type | Default | Effect |
|---|---|---|---|
| `embed` | `1` (presence) | absent → standalone mode | Activates embed mode (postMessage listener, chrome system) |
| `chrome` | `full` \| `minimal` \| `none` | `full` (or `none` if `?embed=1` with no `chrome` param) | Initial chrome preset (see Chrome control) |
| `theme` | `light` \| `dark` \| `<custom>` | editor's persisted default | Initial theme |
| `allowedOrigins` | comma-separated origins | same-origin only | Postmessage allowlist; `*` for any-origin (warns) |
| `dialogTimeout` | integer (ms) | `30000` | Timeout (ms) after which a registered dialog handler is considered failed → editor falls back to its internal modal AND emits `error` event |

## Chrome control

**URL params** (initial state — set before first paint, no flash of full chrome):

- `?embed=1` — master switch.
- `?chrome=full|minimal|none` — presets.

**Runtime API:**

- `editor.setChrome({menu?, toolbox?, layers?, palette?, statusbar?, header?})` → `Promise<void>` — per-element boolean.
- Preset shorthand: `editor.setChrome('minimal')` resolves to `{toolbox: true, ...rest: false}`.
- `editor.setChrome('none')` resolves to `{...all: false}`.
- `editor.setChrome('full')` resolves to `{...all: true}`.

**Implementation:** thin CSS-class layer on `<body>` (`body.embed`, `body.no-toolbox`, `body.no-layers`, etc.). Pairs cleanly with post-#3 Lit components — they read body classes to render or skip themselves. (Mirror of ws-scrcpy-web's `body.embed` pattern — `archive/project_scrcpy_embed.md`.)

## Dialog hook system

```ts
// host side
const unregister = editor.setDialogHandler('prompt', async (text, defaultValue) => {
  return await myCustomPromptUI(text, defaultValue)  // returns string | null
})

editor.setDialogHandler('alert', async (text) => { await myToast(text) })
editor.setDialogHandler('confirm', async (text) => myCustomConfirmUI(text))  // returns boolean
```

- Three named hooks: `prompt`, `alert`, `confirm`.
- Each returns an unregister function.
- **If registered:** editor sends `dialog-request`, awaits `dialog-response`. Timeout 30s (configurable per editor instance via URL param `?dialogTimeout=15000` or runtime `editor.setDialogTimeout(15000)`). On timeout: editor falls back to internal Lit modal AND emits an `error` event with `source: 'dialog-handler-timeout'`.
- **If not registered:** editor renders its own Lit modal (default UX, works fully standalone).
- Closes 9 audit-flagged sites (audit input #3): `LayersPanel.js` × 6, `TopPanel.js` × 3, `jQuery.jPicker.js`. (Plus `ext-helloworld.js:77` which is moot once that extension is deleted.)
- The post-#3 Lit modal replacement (svgedit todo #13) IS the default implementation behind this hook — building #13 satisfies both the standalone-modal UX AND the embed-default behavior.
- `sePromptDialog` rename to its actual purpose (status-display, not prompt-with-input — audit input #4) is captured in todo #13's scope; the dialog hook system here uses the new names.

## Theme sync (two-way)

- **Initial:** `?theme=dark` URL param, OR `editor.setTheme('dark')` after `ready`, OR editor's persisted default if neither.
- **Editor → host:** `theme-changed` event fires whenever the editor's theme toggles internally (e.g., user clicks a theme button if one is exposed in current chrome).
- **Host → editor:** `editor.setTheme(theme: string)` call.
- **Reconciliation:** last-write-wins; no acknowledgement loop. If host and editor toggle simultaneously, the later message wins. The small race window is acceptable for a UX state.
- **Echo-loop prevention:** when host calls `editor.setTheme(t)`, the editor applies the theme but does NOT emit a `theme-changed` event back — the host already knows it caused the change. The event ONLY fires for user-initiated theme changes inside the editor (e.g., a theme toggle button in visible chrome). This eliminates the ping-pong loop where host applies → editor emits → host re-applies.

## Security

**Host side** (in `SvgEditEmbed`):

- Constructor option: `{allowedOrigins: string[]}`. Default = same-origin only (resolved against `iframe.src`).
- Wildcard `*` accepted but warns in console: `'SvgEditEmbed: wildcard origin enabled — only safe for dev/test'`.
- Validates `event.origin` on every inbound message; rejects with `console.warn` ('SvgEditEmbed: rejected message from unauthorized origin: <origin>'). Also requires `event.source === iframe.contentWindow` (prevents foreign-iframe impersonation).
- **Outbound:** `iframe.contentWindow.postMessage(env, <iframe.src origin>)`. Never `'*'` by default (data-exfiltration risk via embedded malicious frame).

**Editor side** (in `server.ts`):

- URL param `?allowedOrigins=origin1,origin2` (comma-separated). Default same-origin only.
- Wildcard `*` accepted, warns.
- Validates `event.origin` on inbound; silent drop + warn on reject (don't reply — don't leak existence).
- **Outbound** to `window.parent` with `targetOrigin: <first allowed origin>` (or `'*'` if any-origin mode and warned).

Defense-in-depth: both sides validate independently — a bug on one side doesn't break the boundary.

## Versioning

- `protocolVersion: 1` in every envelope.
- The editor's package version (svgedit's own semver) evolves independently from `protocolVersion`.
- **Backward compat (editor evolves, host stays):** generic forwarder absorbs new `svgCanvas` methods non-breakingly. Unknown method names → `METHOD_NOT_FOUND` error code (host can feature-detect). `capabilities` array in `ready` payload signals new features without version sniffing.
- **Forward compat (host upgrades first):** if editor reports `protocolVersion: 2` but host proxy expects `1`, host throws at construction: `'svgedit embed: protocolVersion mismatch — host expects 1, editor reports 2'`.
- `protocolVersion` bumps are rare by design — envelope shape is the contract; method names live on the side and don't bump it.

## Error handling

| Failure | Behavior |
|---|---|
| Method throws | Editor catches → sends `{kind: 'error', id, message, stack, code?}` → host Proxy rejects Promise |
| Method not found | `{kind: 'error', code: 'METHOD_NOT_FOUND', id, message}` |
| Origin reject | Silent drop + `console.warn` (don't reply; don't leak existence) |
| Postmessage parse failure | Silent drop + `console.warn` |
| Dialog handler timeout (30s default, configurable) | Falls back to internal Lit modal; emits `error` event with `source: 'dialog-handler-timeout'` |
| URL param parse failure on init | Emits `error` event after `ready`; ignores bad param |
| Protocol version mismatch | Host throws at construction. Editor doesn't know until first call; first call's `error` reply surfaces it. |
| Element handle resolved to deleted element | `{kind: 'error', code: 'ELEMENT_NOT_FOUND', id, message}` |

## Testing strategy

**Unit (vitest):**

- `server.ts` — envelope parse + dispatch + result-serialize + error paths; origin validator; URL param parser; dialog hook dispatch + timeout fallback.
- `client.ts` — Proxy dispatch + Promise correlation; event subscribe/unsubscribe/once; allowedOrigins validation; `ready` await + queued-calls flush; protocol version check.

**E2E (Playwright):** new fixture `tests/e2e/fixtures/embed-host.html` — minimal parent page that hosts the editor in an iframe and exposes hooks for test assertions. Suites:

- `embed-init.spec.ts` — handshake, `ready` payload, URL-param chrome state, queued-calls flush.
- `embed-methods.spec.ts` — round-trip on representative methods (`clearSelection`, `loadFromString`, `getSvgString`, `embedImage`, `addExtension`).
- `embed-events.spec.ts` — all 8 events fire with correct payloads; subscribe / unsubscribe / once.
- `embed-element-handles.spec.ts` — Element-ref serialization round-trip semantics (the trickiest part of the API).
- `embed-chrome.spec.ts` — URL-param presets + runtime `setChrome` toggle.
- `embed-theme.spec.ts` — two-way theme sync; editor-toggled → event fires; host-toggled → editor applies.
- `embed-dialogs.spec.ts` — default modal vs registered hook; timeout fallback; unregister works.
- `embed-security.spec.ts` — origin mismatch dropped; same-origin works; wildcard works (with warn).
- `embed-versioning.spec.ts` — protocolVersion mismatch error.

## V6 reference disposition

`_reference/embed-api-v6/` stays in repo for now — already cited in CodeQL DISMISSED rationale for 2 `js/unvalidated-dynamic-method-call` alerts (svgedit CHANGELOG.md under "Fixed (CodeQL alert triage — 2026-05-19)"). Removing it would resurface those alerts. After v1 of the new embed API ships AND the CodeQL dismissal is re-pointed at the new code: small cleanup PR removes `_reference/embed-api-v6/`. Logged as a follow-up todo; not v1-blocking.

## Follow-up items (out of v1 scope; tracked)

Status legend: ✓ closed in code, ✓-doc closed in this doc (re-classified), ▢ outstanding.

1. ▢ **`ext-connector.ts` monkey-patching cleanup** (audit input #1). Fix shape: add `before-group` / `after-group` / `before-move` / `after-move` events to the allowlist (events count → 12), refactor `ext-connector` to subscribe via the svgCanvas event bus instead of patching `svgCanvas` methods at runtime. **Tracked as PR-B.**
2. ✓ **`runExtensions` API tightening** (audit input #2). `selection.ts:178-181` `@todo`s closed in 2026-05-21 v1.1 sweep — `runExtensions` now always returns an array (formerly opt-in via 3rd boolean param) and takes a typed options object `{action, vars?}` (formerly positional). All ~20 callsites migrated. Type tightened in `svgcanvas.augment.d.ts`.
3. ✓-doc **Multi-iframe clipboard tab-sync** (audit input #7, #12). Re-classified to non-goal in the 2026-05-21 v1.1 sweep — see "Non-goals (v1)" section. Multi-tab works today via `window.storage`; multi-iframe isn't on the project roadmap.
4. ▢ **`_reference/embed-api-v6/` cleanup** — defer to post-v1-ship; tied to CodeQL dismissal rewiring.
5. ▢ **`<svg-edit-canvas>` web component wrapper** (Approach C from Q7). Defer until a declarative-host need surfaces.
6. ✓ **Missing-icon `console.warn` surfacing** (audit input #6 — `Editor.ts:945-949`). Closed in 2026-05-21 v1.1 sweep — `setIcon` now emits an `error` event with `source: 'missing-icon'` via `_embedServer?.emit('error', ...)` alongside the standalone-mode `console.warn`. Hosts can subscribe + show a localized error UI; standalone callers see no behavior change.
7. ✓-doc **`sePromptDialog` rename** (audit input #4). Closes during svgedit todo #3 (elix → Lit migration) — the rename ships as part of the Lit conversion of dialog components. No separate follow-up needed.

## Decisions log

| # | Decision | Chosen | Rationale |
|---|---|---|---|
| Q1 | API surface breadth | Full canvas access (V6-style) | Maximum flexibility; aligns with scope-directive's "iframe drop-in" framing for any host. |
| Q2 | Surface mechanism | Generic RPC forwarder + reuse `dist/svgcanvas.d.ts` | Zero method-list maintenance; leverages TS-foundation work from Step 3; new svgCanvas methods auto-exposed. |
| Q3 | Transport | postMessage-only | Consistent async semantics regardless of origin; cross-origin-ready by default (Control Menu is cross-origin); single code path to test. |
| Q4 | Event channel | Discrete typed events with strict allowlist (~8) | Tight documented contract; each event has a typed payload; no leak of internal noise. |
| Q5 | Chrome control | Both URL params + runtime API | URL params for initial state (no flash); runtime API for live toggling. Best of both. |
| Q6 | Dialogs | Editor renders by default; host can opt-in to override per-call | Works fully standalone; sophisticated hosts can theme dialogs in their own design system. |
| Q7 | Consumption model | A + B: ship proxy library AND document raw protocol | Control Menu gets turnkey integration; protocol stays open for hosts that build their own client. C (web component) deferred. |

## Audit input traceability

11 of 12 closed as of the 2026-05-21 v1.1 sweep. Only #1 remains, tracked as PR-B.

| Audit # | Source | Status |
|---|---|---|
| 1 | `ext-connector.ts:46-70` monkey-patching | ▢ Follow-up item 1 (PR-B — events allowlist 8→12 + ext-connector refactor) |
| 2 | `selection.ts:178-181` `runExtensions` `@todo`s | ✓ v1.1 (2026-05-21) — return-array default + args-as-object refactor; ~20 callsites migrated |
| 3 | Native `prompt`/`alert` (9 sites) | ✓ v1 — Dialog hook system |
| 4 | `sePromptDialog.ts` misnamed | ✓-doc v1.1 (2026-05-21) — closes during svgedit todo #3 (Lit conversion); rename ships with the Lit migration |
| 5 | `EditorStartup.ts` silent extension errors | ✓ v1 — `extension-error` event |
| 6 | `Editor.ts:945-949` silent missing-icon warn | ✓ v1.1 (2026-05-21) — folded into `error` event via `source: 'missing-icon'` |
| 7 | Tab-sync clipboard multi-iframe | ✓-doc v1.1 (2026-05-21) — re-classified as non-goal (no multi-iframe scenario on roadmap) |
| 8 | `window.svgEditor` + `svgEditor:ready` event | ✓ v1 — Initialization & handshake |
| 9 | `loadFromString` / `loadFromURL` / `loadFromDataURI` | ✓ v1 — API surface (typed-pick from `Editor`) |
| 10 | `getSvgString()` | ✓ v1 — API surface (`svgCanvas` forwarder) |
| 11 | `addExtension(name, initfn, initArgs)` | ✓ v1 — API surface (`svgCanvas` forwarder) |
| 12 | Tab-sync via `window.storage` | ✓-doc v1.1 (2026-05-21) — re-classified as non-goal (multi-tab works today; multi-iframe off-roadmap) |

## Open questions

None at design-doc time. Issues surfaced during implementation should be tracked back into this spec (or the implementation plan) rather than left as code comments.

## References

- **V6 reference:** `_reference/embed-api-v6/embedapi.js` + `embedapi-dom.js` + `embedapi.html`.
- **V7 internal:** `src/editor/Editor.ts:324` (`window.svgEditor = this`), `src/editor/Editor.ts:1310-1390` (Promise-returning load methods), `packages/svgcanvas/svgcanvas.ts` (canonical `class SvgCanvas`).
- **Audit:** `docs/AUDIT_2026-05-16.md` § "Embed-API design inputs (#4)".
- **Scope directive:** `memory/project_svgedit.md` § "Scope directive (locked in 2026-04-30)".
- **Companion host pattern:** `memory/archive/project_scrcpy_embed.md` (ws-scrcpy-web embed-mode reference — `body.embed` CSS pattern, hash-param activation).
- **Related todos:** `memory/todo_svgedit.md` items #3 (elix → Lit), #5 (Control Menu integration), #13 (native dialog → modal replacement).
