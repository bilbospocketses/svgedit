# M3 — svgedit Native Dialogs → Modals (`SePromptDialog`) (design spec)

- **Date:** 2026-06-08
- **Status:** Approved (brainstorm) → ready for implementation plan
- **Program:** UI Modernization (M1 design system ✅ → M2 theme toggle ✅ → **M3 modals/#13** → M4 icons). Builds on M2 (master `b31aa5d8`).
- **Backlog item:** todo_svgedit #13 (reframed 2026-06-02).

## 1. Context & problem

The editor still calls **native browser dialogs** in nine places. Two kinds remain (the `confirm()` surface was already fully replaced by `seConfirm()` during the elix→Lit migration):

- **4× `alert()`** — `TopPanel.ts:607`, `LayersPanel.ts:99/135/183`. A non-modal in-app equivalent already exists: `seAlert()`.
- **5× `prompt()`** — `TopPanel.ts:163/668`, `LayersPanel.ts:90/126/174`. **No in-app equivalent exists.** `seStatusDialog` (formerly `sePromptDialog`) is status-display only; `Editor.ts:367` records that "V7 lacks a real prompt-with-input."

Native dialogs are unstyled, ignore the M1/M2 token theme, block the JS thread, and cannot be driven by the embed host. M3 replaces all nine with themed in-app modals, building the missing prompt primitive in the process.

## 2. Goals / non-goals

**Goals**
- Swap the **4 `alert()`** → existing `seAlert()`.
- Build a **new `SePromptDialog`** Lit component + **`sePrompt(text, default?)`** helper (`Promise<string | null>`) and route the **5 `prompt()`** through it.
- Wire the **embed default prompt handler** (`Editor.ts:366`) to `sePrompt`, closing the EMBED_API prompt-default gap; reconcile `EMBED_API.md`.
- Update the **e2e tests** that drive the native dialogs (they break the moment the modal replaces `prompt()`).

**Non-goals**
- **No built-in validation** in `SePromptDialog` — it is a faithful native-`prompt()` replacement; call sites keep their existing post-prompt checks (e.g. duplicate-layer-name → `seAlert`).
- **No changes** to `seAlert` / `seConfirm` / `seSelect` or `SePlainAlertDialog`.
- **No shared dialog base-class** refactor (deferred until a 3rd such dialog exists — YAGNI).
- **No i18n** of the `OK`/`Cancel` button labels (English-only fork; matches `seConfirm`'s hardcoded labels).
- **`beforeunload`** (`editorInit.ts`) is **not** replaced — the browser owns that dialog. Documented as a known limitation.

## 3. Locked decisions (from brainstorm)

1. **Scope = full native-dialog slice** in one cohesive effort: alert swaps + new prompt dialog + prompt swaps + embed wiring + e2e migration + docs.
2. **Architecture = new standalone `SePromptDialog`** (not an extension of `SePlainAlertDialog`) — isolates all change to brand-new code, zero regression risk to the heavily-used `seConfirm`/`seAlert` path, matches the one-file-per-dialog convention.
3. **Minimal native parity** — single text input, default prefilled + auto-selected, Enter submits (= OK), Esc/Cancel resolve `null`, OK resolves the string (incl. `''`). No validation hooks.
4. **`<form method="dialog">`** wrapper for the dialog body — gives Enter-to-submit and modal focus semantics natively (a deliberate, justified divergence from `SePlainAlertDialog`'s button-only shape, which has no text input and thus no Enter-submit need).

## 4. Architecture

### 4.1 `SePromptDialog` — new Lit component (`src/editor/dialogs/SePromptDialog.ts`, element `se-prompt-dialog`)

Mirrors `SePlainAlertDialog`'s shape — native `<dialog>`, open shadow DOM, `static styles = css\`\``, imperative open/`whenClosed` API — with a text input.

**Public/imperative API (consumed by the `sePrompt` helper):**
```
@property() accessor message = ''   // label shown above the input (arrives pre-translated)
@property() accessor value = ''     // initial/default input value (seed)
get opened(): boolean
open(): void                        // append-if-disconnected → showModal → focus + select() the input
close(): void
whenClosed(): Promise<{ value: string | null }>   // string on OK, null on Cancel/Esc
```

**Close semantics (OK vs Cancel vs Esc):** the body is a `<form method="dialog">` with two submit buttons — `OK` first (`value="ok"`, the implicit Enter target) and `Cancel` (`value="cancel"`). Esc triggers the native dialog `cancel` event and closes with `returnValue === ''`. On the dialog `close` event:
```
resolve({ value: dlg.returnValue === 'ok' ? inputEl.value : null })
```
`inputEl.value` is the **live typed value** read at close time (not the `value` seed). OK-with-empty resolves `''`; both `''` and `null` are falsy, so every call site's `if (!x)` branch behaves exactly as it did with native `prompt()`.

**Focus:** after `showModal()` (inside `updateComplete.then(...)`, matching `SePlainAlertDialog`), `inputEl.focus(); inputEl.select()` so typing replaces the default — native-prompt parity.

**Styling (tokens only; passes hex-guard):** reuse `SePlainAlertDialog`'s `dialog` / `::backdrop` rules verbatim; the input uses existing semantic tokens — `background: var(--se-surface-2)`, `color: var(--se-text)`, `border: 1px solid var(--se-border-strong)`, `border-radius: var(--se-radius-sm)`, `font-family: var(--se-font-sans)`, `:focus-visible { outline: 2px solid var(--se-focus-ring); outline-offset: 1px }`. Button container mirrors `#choiceButtonContainer`. Themeable via the same shadow-DOM custom-property inheritance `SePlainAlertDialog` already relies on (no new tokens — M3 is **not** blocked on further M1 token work).

**Lit-convention compliance** (`docs/superpowers/conventions/lit-component-conventions.md`):
- ✅ `@customElement('se-prompt-dialog')` + `@property() accessor` (the `accessor` keyword is **required** — bare class fields produce TS1240/TS1270).
- ✅ Open shadow DOM; `static styles = css\`\``; class-field-arrow event handlers (`private _onClose = (e) => {...}`) per bullet 8 (avoids the `unbound-method` false positive).
- ✅ `::part` hooks with semantic names — `part="input"`, `part="button"`, `part="button-container"` (embed-theming parity with `SePlainAlertDialog`).
- ✅ File-per-component in `src/editor/dialogs/`; `PascalCase.ts` filename matching its sibling `SePlainAlertDialog.ts`.
- ⚠️ **Convention bullet #4 is stale.** It mandates the old `--*-color` variable names ("do not rename theme variables"), but it predates the M1 design-system migration (2026-06-02), which moved chrome **and the dialog components** to `--se-*` semantic tokens. `SePlainAlertDialog.ts` already uses `--se-*`. **Code is authoritative:** `SePromptDialog` uses `--se-*`, matching its sibling. → Follow-up: refresh bullet #4 of the conventions doc (should be logged as a follow-up todo; out of scope for M3 code).
- **i18n:** the `message` arrives already translated (call sites pass `t('notification.…')`), exactly like `SePlainAlertDialog`'s `textContent`; the component renders it verbatim. `OK`/`Cancel` are hardcoded (English-only fork, `seConfirm` precedent). So bullet 5 (`t()` at render) does not apply — this component does no in-component i18n.

### 4.2 `sePrompt` helper + global wiring (`src/editor/dialogs/globalDialogs.ts`)

Alongside `seAlert` / `seConfirm` / `seSelect`:
```
const sePrompt = async (text: string, defaultValue = ''): Promise<string | null> => {
  const dialog = new SePromptDialog()
  dialog.message = text
  dialog.value = defaultValue
  dialog.open()
  return (await dialog.whenClosed()).value
}
window.sePrompt = sePrompt
```
Plus: `import SePromptDialog from './SePromptDialog.js'` (the `@customElement` import side-effect registers the element — same registration path as `SePlainAlertDialog`, so **no `dialogs/index.ts` change needed**); add `sePrompt: (text: string, defaultValue?: string) => Promise<string | null>` to the `Window` interface in `globalDialogs.ts`; add `declare function sePrompt(msg: string, defaultValue?: string): Promise<string | null>` to `src/editor/global-dialogs.d.ts` so call sites use it bare with types.

### 4.3 Call-site migration (the 9 sites)

**4× `alert()` → `seAlert()`** — pure swap, no signature change. Each is immediately followed by `return` (or `return false`), so native `alert()`'s blocking is irrelevant — non-blocking `seAlert` is behavior-equivalent here. Remove the `// TODO: see todo #10` markers.

```
site                       function       change
─────────────────────────  ─────────────  ──────────────────
TopPanel.ts:607            attrChanger    alert → seAlert (then return false)
LayersPanel.ts:99          newLayer       alert → seAlert (then return)
LayersPanel.ts:135         cloneLayer     alert → seAlert (then return)
LayersPanel.ts:183         layerRename    alert → seAlert (then return)
```

**5× `prompt()` → `await sePrompt()`** — each enclosing function becomes `async`; the `if (!x)` / `if (url)` branch logic is unchanged.

```
function       file:line            new signature   caller (fire-and-forget)
─────────────  ───────────────────  ──────────────  ───────────────────────────────
promptImgURL   TopPanel.ts:157      async           TopPanel.ts:224 (already /* await */)
makeHyperlink  TopPanel.ts:665      async           safeClick (TopPanel.ts:892/893)
newLayer       LayersPanel.ts:82    async           safeClick (LayersPanel.ts:61)
cloneLayer     LayersPanel.ts:121   async           LayersPanel.ts:26 handler
layerRename    LayersPanel.ts:170   async           safeClick (LayersPanel.ts:65)
```

All five callers discard the return value (click/menu handlers), so the returned Promise is harmlessly ignored. **Plan-time check:** confirm eslint `@typescript-eslint/no-floating-promises` is not enabled (or prefix each call with `void`); verify the `LayersPanel.ts:26` and `TopPanel.ts:224` call contexts.

### 4.4 Embed wiring + docs

- **`Editor.ts:366-370`** — replace the stub `prompt: (_msg, def) => Promise.resolve(def ?? null)` with `prompt: (msg, def) => sePrompt(msg, def ?? '')`. The return type (`Promise<string | null>`) matches the `EmbedServerOptions` prompt-handler signature. `sePrompt` is reachable here via the same ambient-global + `window.*` path that `seAlert`/`seConfirm` already use at lines 364-365 (dialogs load during startup, well before any handler fires). Drop the "V7 lacks a real prompt" comment; replace with a one-liner noting delegation to the in-app dialog.
- **`EMBED_API.md`** — update the default-prompt-handler description: it now opens a real in-app prompt dialog (previously: returned the default). Add a one-line **known limitation** note that `beforeunload` remains the browser-native dialog (not interceptable).

## 5. Data flow

- **In-editor prompt:** user action (e.g. New Layer) → `await sePrompt(msg, default)` → `new SePromptDialog()` appended + `showModal()` → user types, presses Enter / clicks OK → `close` event, `returnValue==='ok'` → promise resolves the input value → call site validates and proceeds (or `if(!x) return`). Cancel/Esc → resolves `null` → call site aborts.
- **Embed prompt:** host `client.prompt(msg, def)` → postMessage → `EmbedServer` invokes the default handler → `sePrompt(msg, def)` → same dialog path → resolved string/null returned to the host over the embed protocol.

## 6. Testing strategy

Follows the repo's split: **e2e (Playwright, both browsers) is the authoritative coverage for modal interaction** (jsdom's `<dialog>.showModal()` is unreliable); unit tests cover contract/logic only.

- **Migrate `tests/e2e/layers-panel.spec.ts`** (lines 30, 35): replace `page.once('dialog', d => d.accept('Layer 2'))` with — click `#layer_new` → `waitForFunction(() => customElements.get('se-prompt-dialog'))` / wait for the element → fill its input → click the OK part/button. Same for rename (`#layer_rename`). Add a Cancel/Esc case asserting **no** layer is created.
- **New `se-prompt-dialog` coverage** (extend `tests/e2e/dialogs-extra.spec.ts`, matching its `seAlert`/`se-status-dialog` pattern): OK resolves the typed value; Cancel and Esc resolve `null`; Enter submits; the default value is prefilled and selected.
- **Audit `tests/e2e/embed-dialogs.spec.ts`**: if it asserts the old "prompt returns the default" behavior, update it for the modal path.
- **Unit (vitest/jsdom)** — one focused test (per convention bullet 12, form-control/stateful component warrants it): the `sePrompt` contract + `_onClose` resolution logic (resolve value on `returnValue==='ok'`, `null` otherwise), exercised by driving the close handler directly rather than a full `showModal` flow. Model on `tests/unit/seInput.test.ts`.
- **Lint:** `npm run lint` — `SePromptDialog` must pass `lint:hex` (tokens only, no raw hex) and the `tests/unit/design-tokens.test.ts` discipline check.

## 7. Files touched

**New**
- `src/editor/dialogs/SePromptDialog.ts`

**Modified**
- `src/editor/dialogs/globalDialogs.ts` — `+sePrompt`, `+import`, `+Window` decl
- `src/editor/global-dialogs.d.ts` — `+declare function sePrompt`
- `src/editor/panels/LayersPanel.ts` — 3× `prompt`→`await sePrompt` (fns `async`), 3× `alert`→`seAlert`
- `src/editor/panels/TopPanel.ts` — 2× `prompt`→`await sePrompt` (fns `async`), 1× `alert`→`seAlert`
- `src/editor/Editor.ts` — embed prompt handler → `sePrompt`; comment cleanup
- `tests/e2e/layers-panel.spec.ts` — rewire native-dialog driving → modal
- `tests/e2e/dialogs-extra.spec.ts` — `+se-prompt-dialog` tests
- `tests/e2e/embed-dialogs.spec.ts` — audit/update if it exercises the default prompt
- `tests/unit/` — new focused `sePrompt`/component-logic test
- `EMBED_API.md` — prompt-handler default now real; `beforeunload` limitation note
- `CHANGELOG.md` — M3 entry (per CHANGELOG SOP)

## 8. Risks / plan-time checks

- **e2e breakage (known):** native-`prompt()` handling in `layers-panel.spec.ts` must be rewired or the suite hangs. Already accounted for in §6.
- **eslint floating-promises:** verify the rule's status; `void`-prefix the 5 fire-and-forget calls if it's enabled.
- **jsdom `showModal`:** do not assert real modal rendering in unit tests; keep modal coverage in e2e.
- **Element registration order:** confirmed safe (same import-side-effect path as `SePlainAlertDialog`), but verify `se-prompt-dialog` is defined before first use in both the editor and embed paths.
- **Conventions doc drift (bullet #4):** flagged in §4.1; refresh should be logged as a follow-up todo, not part of M3 code.

## 9. References

- Backlog: `todo_svgedit` #13 (reframed 2026-06-02) + UI-Modernization program block.
- Sibling component: `src/editor/dialogs/SePlainAlertDialog.ts`; helpers `src/editor/dialogs/globalDialogs.ts`.
- Tokens: `src/editor/styles/tokens.css` (M1).
- Conventions: `docs/superpowers/conventions/lit-component-conventions.md` (note bullet #4 staleness).
- Embed: `src/embed/server.ts` (handler defaults), `Editor.ts:361-372` (wire-in), `EMBED_API.md`.
- Prior specs: `2026-06-02-svgedit-theme-toggle-design.md` (M2), `2026-06-02-svgedit-design-system-design.md` (M1), `2026-05-21-svgedit-elix-to-lit-design.md` (Lit conventions origin).
