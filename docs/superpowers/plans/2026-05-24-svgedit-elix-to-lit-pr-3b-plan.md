# svgedit elix → Lit PR-3b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Second of 3 sub-PRs under todo item #3 PR-3. Convert the 2 plain-alert / status-display elix-bound dialogs in `src/editor/dialogs/` to Lit; rename `sePromptDialog` → `seStatusDialog` (closes audit input #4 — misnamed dialog); rename the `SePlainAlertDialog` tag from `<se-elix-alert-dialog>` to `<se-plain-alert-dialog>` (elix prefix is misleading post-conversion); update all 5 callsite files. After PR-3b: `dialogs/` is mostly elix-free; only the 5 elix-dialog-coupled HTML-bound dialogs remain (PR-3c scope).

**Architecture:** Two-task sequential chain (SePlainAlertDialog FIRST, then sePromptDialog → seStatusDialog rename + callsites). Sequential because the existing sePromptDialog internally instantiates `new SePlainAlertDialog()` — converting SePlainAlertDialog first means the seStatusDialog conversion can reference the Lit-version constructor without `as any` casts. Both per-task agents are dispatched via `superpowers:subagent-driven-development` with worktree isolation. Each agent gets the verbatim current source + the locked PR-1 reference component shapes (`seText.ts` + `seInput.ts`) + the 14-bullet conventions + the 5 PR-2 patterns + the 5 PR-3a lessons + the native `<dialog>` reference implementation + the validation gate, ALL inlined in its prompt — never referenced by path. Pre-dispatch 4-line self-check verbalized in chat per `feedback_subagent_code_specificity`. Post-dispatch gate re-verification by main session per `feedback_verify_subagent_gate_claims`.

**Tech Stack:** Lit 3.x, TypeScript 6.x (TC39 standard decorators + `accessor` keyword), Native HTML5 `<dialog>` element (Baseline-supported), Vite 7 + SWC for TC39-decorator transform (PR-1 substrate), ESLint v9 flat config, Vitest 4, Playwright 1.57 (chromium + firefox).

---

## Decisions locked (2026-05-24 PR-3b planning session)

These extend the PR-3a-time PR-3 locks (sub-PR split + native `<dialog>` + seStatusDialog rename target):

| # | Decision | Locked value | Rationale |
|---|---|---|---|
| 1 | `sePromptDialog` rename target | **`seStatusDialog`** (file: `seStatusDialog.ts`; class: `SeStatusDialog`; tag: `<se-status-dialog>`) | Locked at PR-3a planning time. Matches svgedit's `*Dialog` suffix convention. "Status" accurately captures the cancel-only display purpose (verified at `sePromptDialog.ts:46` — `this.dialog.choices = ['Cancel']`). |
| 2 | `<elix-dialog>` replacement | **Native HTML5 `<dialog>` element** | Locked at PR-3a planning time for PR-3c; also applies to SePlainAlertDialog and seStatusDialog in this PR. Baseline-supported in all modern browsers; API matches existing (`.showModal()` / `.close()` / `open` reflected attr). |
| 3 | `SePlainAlertDialog` tag rename | **`<se-elix-alert-dialog>` → `<se-plain-alert-dialog>`** | "elix" prefix is misleading after the conversion. Class name `SePlainAlertDialog` stays (it's used as the constructor by 4 importers — would be a much bigger churn to rename). Affects 2 sites: `customElements.define()` at SePlainAlertDialog.ts:91 + 2 selectors in `tests/e2e/dialogs-extra.spec.js:30,32`. Both touched in Task 1. |
| 4 | seStatusDialog `close` attribute toggle semantics | **Preserve verbatim — pure toggle (not explicit-close)** | Current `sePromptDialog.ts:49-54` toggles open/closed on ANY `close` attribute change (regardless of value). ext-opensave's flow (open via `.title=`, then immediately `setAttribute('close', false)`) appears to rely on this toggle. Latent UX quirk worth investigating, but NOT in scope for the rename PR. Logged to todo #10 as a post-PR-3b investigation item. |
| 5 | seStatusDialog wrapping vs inlining | **Inline as native `<dialog>` (drop `SePlainAlertDialog` composition)** | Current sePromptDialog wraps a SePlainAlertDialog instance with its own `_shadowRoot` + attribute-driven open/close. Post-Lit-conversion, seStatusDialog owns its own native `<dialog>` directly + Cancel button — simpler, no extra DOM layer, removes the `new SePlainAlertDialog() as any` cast that the current code carries (line 22). |
| 6 | Execution approach | **Subagent-driven-development per task (PR-3a precedent)** | Mirrors what worked for PR-3a. Sequential dispatch: Task 1 dispatches solo agent for SePlainAlertDialog, then Task 2 dispatches solo agent for seStatusDialog + callsite updates. Each followed by spec + code-quality reviewer subagents per PR-2/PR-3a dispatch protocol. |
| 7 | Plan-doc PR shape | **Inline plan-doc bundled in impl PR** (single-PR bundle, mirroring PR-3a) | PR-3a established that the plan-doc lands inside the impl PR's first commit rather than as a separate docs-only PR (which PR-2 did via PR #26). Continue that for PR-3b. |

**Source-of-truth for downstream decisions:** this plan. Spec doc `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md` will get a "PR-3b SHIPPED" amendment block at ship time (matching the established PR-1 / PR-2 / PR-3a pattern in that file).

---

## File structure

### Files MODIFIED (Task 1: SePlainAlertDialog conversion)

| File | Current LOC | Target Lit LOC | Approx delta |
|---|---|---|---|
| `src/editor/dialogs/SePlainAlertDialog.ts` | 92 | ~70-90 | −5 to −20 |

The SePlainAlertDialog conversion is dominated by the elix base-class boilerplate (`get [template]()` override + style-injection + Esc handler), not by source-LOC reduction. Native `<dialog>` + Lit's `static styles = css\`...\`` block replaces the elix template-extension dance.

### Files MODIFIED (Task 1: test selector update for the tag rename)

| File | Current LOC | Lines touched |
|---|---|---|
| `tests/e2e/dialogs-extra.spec.js` | 38 | 30, 32 (2 occurrences of `se-elix-alert-dialog` → `se-plain-alert-dialog`) |

### Files RENAMED + MODIFIED (Task 2: sePromptDialog → seStatusDialog)

| Action | From → To | LOC |
|---|---|---|
| Git rename + Lit conversion | `src/editor/dialogs/sePromptDialog.ts` → `src/editor/dialogs/seStatusDialog.ts` | 103 → ~70-90 |

### Files MODIFIED (Task 2: 5 callsite updates for the rename)

| File | Lines touched | What changes |
|---|---|---|
| `src/editor/dialogs/index.ts` | 9 | `import './sePromptDialog.js'` → `import './seStatusDialog.js'` |
| `src/editor/EditorStartup.ts` | 141-142 | `createElement('se-prompt-dialog')` → `createElement('se-status-dialog')`; `setAttribute('id', 'se-prompt-dialog')` → `setAttribute('id', 'se-status-dialog')` |
| `src/editor/extensions/ext-opensave/ext-opensave.ts` | 59, 60, 67, 88, 119 | 5 occurrences of `$id('se-prompt-dialog')` → `$id('se-status-dialog')` |
| `src/editor/Editor.ts` | 337 | Comment text refresh: "sePromptDialog" → "seStatusDialog" in the embed-API prompt-handler comment |
| `tests/e2e/dialogs-extra.spec.js` | 4, 6, 9 | Test description + 2 selector occurrences `se-prompt-dialog` → `se-status-dialog` |

**Note on `tests/e2e/dialogs-extra.spec.js`:** Touched in BOTH Task 1 (lines 30/32 for SePlainAlertDialog tag rename) AND Task 2 (lines 4/6/9 for sePromptDialog rename). The two edit ranges don't overlap; merge is conflict-free.

### Files NOT touched in PR-3b (deferred)

| File | Deferred to | Why |
|---|---|---|
| `src/editor/dialogs/seAlertDialog.ts` | (cleanup later) | `window.seAlert` wrapper. Imports `SePlainAlertDialog` and instantiates it. API contract preserved by Task 1's verbatim-API approach — no source change needed. The 6 `/* eslint-disable */` directives + `as any` casts could be cleaned up in a follow-up small PR; not blocking. |
| `src/editor/dialogs/seConfirmDialog.ts` | (cleanup later) | Same as seAlertDialog — `window.seConfirm` wrapper. |
| `src/editor/dialogs/seSelectDialog.ts` | (cleanup later) | Same — `window.seSelect` wrapper. |
| `src/editor/dialogs/svgSourceDialog.ts/html`, `imagePropertiesDialog.ts/html`, `editorPreferencesDialog.ts/html`, `exportDialog.ts/html`, `cmenuDialog.ts`, `cmenuLayersDialog.ts` | PR-3c | 5 elix-dialog HTML-bound dialogs (have `<elix-dialog>` in their HTML imports); cmenu-prefixed pair already converted in PR-2 but `dialogs/index.ts` still imports `'elix/define/Dialog.js'` at line 1, which PR-3c removes. |
| `src/editor/dialogs/se-elix/define/NumberSpinBox.ts` + `src/editor/dialogs/se-elix/src/base/NumberSpinBox.ts` + `src/editor/dialogs/se-elix/src/plain/PlainNumberSpinBox.ts` | PR-3c | Registers `<elix-number-spin-box>`. `exportDialog.html:51` still uses this tag in markup; deleting in PR-3b would break exportDialog until PR-3c lands. |

### Files INSPECTED but unchanged (consumer-side verification only)

- `src/editor/dialogs/seAlertDialog.ts`, `seConfirmDialog.ts`, `seSelectDialog.ts` — re-read by Task 1 agent to extract API contract (4 things to preserve: `dialog.textContent =`, `dialog.choices = string[]`, `dialog.open()`, `dialog.whenClosed(): Promise<{choice}>`, `dialog.keyChoice: string | null`). Code body unchanged.
- `tests/e2e/*.spec.js` (other than `dialogs-extra.spec.js`) — grepped for `<se-prompt-dialog>` / `<se-elix-alert-dialog>` selectors per [[feedback_consumer_audit_grep_test_files]] (refined in PR-3a) — expected: only `dialogs-extra.spec.js` matches (the new tag rename test). Task 1 + Task 2 agents must re-verify.
- `docs/EMBED_API.md`, `docs/AUDIT_2026-05-16.md`, `docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md`, `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md`, `CHANGELOG.md` — historical references to "sePromptDialog" name. **DO NOT** retroactively rename in docs — historical docs reflect the state at the time they were written. The CHANGELOG entry appended in Task 3 documents the rename going forward. Only the SPEC AMENDMENT in Task 4 explicitly updates one spec doc's Status block.

### Files MAY-CHANGE (small mechanical edits possible)

- `CHANGELOG.md` — `[Unreleased]` section appended at Task 3 by main session.

---

## Shared dispatch packet — include VERBATIM in every per-component Agent prompt

The packet below is the **mandatory boilerplate** every per-component dispatch in Tasks 1-2 must include in full, with per-component fields substituted at the placeholders. This implements the spec's § "Per-agent dispatch packet — required contents" + § "PR-2 agent-team dispatch discipline".

> **Why inline?** Per `feedback_subagent_code_specificity`: agents will NOT reliably fetch reference files from disk. The prompt IS the source of truth — paste the references in.

### The packet template

````
You are converting a single elix-bound TypeScript custom-element to a Lit 3 LitElement using a native HTML5 `<dialog>` internally.
This is task <TASK_NUM> of svgedit's PR-3b elix → Lit migration.

## Component to convert

**Absolute path (current):** <ABSOLUTE_FILE_PATH_CURRENT>
**Absolute path (after rename, if applicable):** <ABSOLUTE_FILE_PATH_AFTER_RENAME>

## Verbatim current source (lines <LINE_RANGE>)

<PASTE FULL CURRENT FILE CONTENT WITH LINE NUMBERS HERE>

## External-API contract — preserve verbatim

- **Custom element name:** <TAG_NAME_NEW> (<TAG_RENAME_NOTE>)
- **Attributes:** <LIST_FROM_observedAttributes>
- **Public methods / properties:** <LIST_OF_API_USED_BY_CONSUMERS>
- **Events fired:** <LIST_FROM_dispatchEvent_CALLS>
- **Consumers (grep result):** <LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP>
- **Class name:** <CURRENT_CLASS_NAME> (<CLASS_RENAME_NOTE>)

## Audit notes — preserve as-is in conversion

<PASTE LINE-POINTERS FROM AUDIT_2026-05-16.md FOR THIS COMPONENT — bugs to preserve, latent quirks to flag, etc.>

## Reference component shape A — `seText.ts` (simple, attribute-only)

```ts
import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

@customElement('se-text')
export class SeText extends LitElement {
  static styles = css`
    :host([id="layersLabel"]) div {
      font-size: 13px;
      line-height: normal;
      font-weight: 700;
    }
  `

  @property() accessor text = ''
  @property() accessor title = ''
  @property() accessor value = ''

  render() {
    return html`
      <div id=${ifDefined(this.id || undefined)} title=${t(this.title)}>${t(this.text)}</div>
    `
  }
}
```

## Reference component shape B — `seInput.ts` (form-control, ::part exposure)

```ts
import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

@customElement('se-input')
export class SeInput extends LitElement {
  static styles = css`
    .wrap { height: 24px; margin: 5px 1px; padding: 3px; }
    img { top: 2px; left: 4px; position: relative; }
    #label { bottom: 1px; right: -4px; position: relative; margin-right: 4px; color: #fff; }
    input { background-color: var(--input-color); border-radius: 3px; height: 24px; }
  `

  @property() accessor value = ''
  @property() accessor label = ''
  @property() accessor title = ''
  @property() accessor src = ''
  @property({ type: Number }) accessor size = 0

  render() {
    return html`
      <div class="wrap" title=${t(this.title)}>
        ${this.src && !this.label
          ? html`<img alt="icon" width="12" height="12" src=${this.src} part="icon" />`
          : nothing}
        ${this.label
          ? html`<span id="label" part="label">${t(this.label)}</span>`
          : nothing}
        <input
          part="input"
          .value=${this.value}
          size=${ifDefined(this.size || undefined)}
          @change=${this._onChange}
          @keyup=${this._onChange}
        />
      </div>
    `
  }

  private _onChange = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }
}
```

## Reference component shape C — native HTML5 `<dialog>` recipe (PR-3b first-use)

This is the canonical pattern for PR-3b + PR-3c dialog conversions. The native `<dialog>` element handles the modal backdrop, focus trap, and Escape-to-close natively; the Lit component wraps it and exposes the existing imperative API (`.open()` / `.close()` / `whenClosed()` etc.) so consumers don't need to change.

```ts
import { LitElement, html, css } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'

@customElement('se-example-dialog')
export class SeExampleDialog extends LitElement {
  // Static slot/light-content for textContent compatibility (consumers do `dialog.textContent = 'foo'`)
  // Lit's open shadow DOM + a default <slot> projects light-DOM children into the dialog body.

  @state() accessor _choices: string[] = ['Ok']
  @state() accessor _resolveClose: ((result: { choice: string }) => void) | null = null

  /** Set by Esc handler to flag the user-cancelled path; reset on next open. */
  keyChoice: string | null = null

  @query('dialog') accessor _dialog!: HTMLDialogElement

  /** Mirror of the native <dialog>.open boolean — preserves elix `.opened` getter API. */
  get opened (): boolean {
    return this._dialog?.open ?? false
  }

  /** Public setter for the choice button labels. */
  set choices (values: string[]) {
    this._choices = values
  }
  get choices (): string[] {
    return this._choices
  }

  /** Open the dialog modally. Resets keyChoice so each open() starts fresh. */
  open (): void {
    this.keyChoice = null
    this._dialog?.showModal()
  }

  /** Close the dialog (programmatic close). The native 'close' event will fire and resolve whenClosed(). */
  close (): void {
    this._dialog?.close()
  }

  /** Returns a promise that resolves with the user's choice (button text). Lit version mirrors elix's API. */
  whenClosed (): Promise<{ choice: string }> {
    return new Promise((resolve) => {
      this._resolveClose = resolve
    })
  }

  private _onChoiceClick = (choice: string) => () => {
    this._resolveClose?.({ choice })
    this._resolveClose = null
    this._dialog.close()
  }

  /** Native `<dialog>` fires 'close' event for ALL close paths (button, Esc, .close()). Resolve any pending promise. */
  private _onNativeClose = () => {
    if (this._resolveClose) {
      this._resolveClose({ choice: this.keyChoice ?? this._choices[this._choices.length - 1] ?? 'Cancel' })
      this._resolveClose = null
    }
  }

  /** Native dialog already handles Esc → close. We only need to set keyChoice for the API contract. */
  private _onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.keyChoice = 'Cancel'
      // Don't preventDefault — let native <dialog> close naturally.
    }
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.addEventListener('keydown', this._onKeydown)
  }

  disconnectedCallback (): void {
    this.removeEventListener('keydown', this._onKeydown)
    super.disconnectedCallback()
  }

  render () {
    return html`
      <dialog @close=${this._onNativeClose}>
        <div class="frame">
          <div class="content"><slot></slot></div>
          <div class="choice-button-container">
            ${this._choices.map((choice) => html`
              <button type="button" class="choice-button" @click=${this._onChoiceClick(choice)}>${choice}</button>
            `)}
          </div>
        </div>
      </dialog>
    `
  }

  static styles = css`
    dialog {
      padding: 1em;
      background: #CCC;
      width: 300px;
      border: 1px outset #777;
      font-size: 0.8em;
      font-family: Verdana, Helvetica, sans-serif;
      border-radius: 5px;
    }
    .content {
      height: 95px;
      background: #DDD;
      overflow: auto;
      text-align: left;
      border: 1px solid #5a6162;
      padding: 1em;
      border-radius: 5px;
    }
    .choice-button-container {
      margin-top: 1em;
      text-align: center;
    }
    .choice-button:not(:first-child) {
      margin-left: 0.5em;
    }
  `
}
```

**Key native-`<dialog>` notes:**
- `dialog.showModal()` makes it modal (backdrop + focus trap). `dialog.show()` is non-modal (rarely needed).
- `<dialog>` fires a native `close` event for ALL close paths (button click, programmatic `.close()`, Esc keypress). Wire to that event to resolve any pending Promise.
- Native `<dialog>` already handles Esc → close out of the box. No need for `event.preventDefault()` or manual close logic — but we DO need to set `keyChoice = 'Cancel'` BEFORE the close fires (in the keydown handler, before propagation completes) so the close handler can read it.
- **`<button type="button">`** is REQUIRED — bare `<button>` inside a `<dialog>` form context defaults to `type="submit"` which closes the dialog with form submission. PR-3a lesson #4 also applies: never `<div role="button">` for accessibility.
- Use Lit's `@query('dialog') accessor _dialog!: HTMLDialogElement` to access the native dialog imperatively (`.showModal()` / `.close()`). The `!` non-null assertion is safe because the query target is in the render template.

## Lit-component conventions (locked PR-1 + PR-2 + PR-3a lessons)

1. Use `@customElement('se-name')` + `@property() accessor name = default` decorators (the `accessor` keyword is REQUIRED — TC39 standard decorators + Lit 3 only match the `ClassAccessorDecorator` overload, bare class fields produce TS1240/TS1270); never `static properties` map.
2. Open shadow DOM (Lit default); never override `createRenderRoot()`.
3. `static styles = css``` block; no external CSS files imported into components.
4. Use existing `--*-color` CSS custom-property names (`--main-bg-color`, `--icon-bg-color`, `--icon-bg-color-hover`, `--input-color`, `--orange-color`, `--global-se-spin-input-width`); do not rename theme variables.
5. i18n via `t()` at render time, never in setter; import from `../locale.js`.
6. `::part` for styling hooks ONLY; semantic names (`label`, `input`, `icon`, `button`, `frame`, `content`, `choice-button`, `choice-button-container`).
7. `<slot>` for content composition (named slots when 2+; default slot when 1).
8. Events: `bubbles: true, composed: true` for events that need to escape shadow DOM. Event handlers passed in templates MUST be declared as class-field arrows (`private _handler = (e: Event) => {...}`), NOT method form — `@typescript-eslint/unbound-method` flags the `@event=${this._handler}` method-reference pattern as a false positive even though Lit auto-binds `this` for it.
9. Drop `jamilih` import; use Lit's `html``` template literal.
10. Name: keep `se-*` prefix on tag names. SePlainAlertDialog tag renames `se-elix-alert-dialog` → `se-plain-alert-dialog` per PR-3b lock #3. sePromptDialog file + tag + class rename per PR-3b lock #1.
11. File per component in `src/editor/dialogs/`; no barrel files; export class + run `@customElement` decorator side-effect.
12. Test: trust existing e2e; the seStatusDialog test (`dialogs-extra.spec.js`) is the contract test — update its selector but preserve its assertion shape.
13. **`ifDefined` for optional attributes with empty-string defaults.** When an `@property() accessor` has an empty-string default (`= ''`) AND the corresponding HTML attribute is OPTIONAL on consumers, wrap the binding with `ifDefined(this.X || undefined)` in `render()` to avoid rendering `attr=""` on the DOM.
14. **Kebab-case HTML attributes map via `@property({ attribute: 'kebab-case' })`.** For HTML attributes with kebab-case names (e.g., `img-height`), declare as `@property({ attribute: 'img-height' }) accessor imgHeight = ''`.

## PR-2 patterns (apply when the original code uses these shapes)

- **`boolAttr` module-local converter constant** when a Lit boolean property needs `reflect: true` AND consumer tests use `toHaveAttribute('attr', /./)`:
  ```ts
  const boolAttr = {
    reflect: true,
    converter: {
      fromAttribute: (v: string | null) => v !== null,
      toAttribute: (v: boolean) => v ? 'true' : null
    }
  } as const
  // then: @property(boolAttr) accessor pressed = false
  ```
- **`classMap` directive** for `class="base ${conditional}"` patterns: `class=${classMap({ base: true, conditional: this.flag })}` (import from `lit/directives/class-map.js`).
- **`styleMap` directive** for imperative `style.*` mutations: `style=${styleMap({ display: this.flag ? 'flex' : 'none' })}` (import from `lit/directives/style-map.js`).
- **`unsafeHTML` directive** for dynamically-constructed innerHTML (ONLY when data is from internal config files, NOT user-controlled): `unsafeHTML(this._someHtmlState)` (import from `lit/directives/unsafe-html.js`).
- **Full `disconnectedCallback` lifecycle** for components that attach listeners to external DOM nodes — pair every `addEventListener` on external nodes with a `removeEventListener` in `disconnectedCallback`. For dialogs that only attach listeners to `this` (the host element), the pair lives in `connectedCallback` + `disconnectedCallback` on the host.
- **Touchend double-fire bug fix:** every `svgEditor.$click(elem, handler)` call site MUST swap to declarative `@click=${handler}` (PR-2 cascade). N/A in PR-3b — dialog code uses native click events, not `svgEditor.$click`.

## PR-3a lessons (apply when relevant — captured 2026-05-24 from PR-3a's session)

1. **Consumer audits MUST grep test files** for `<tag>#<id>`, `div#<id>`, and elix-internal tags like `elix-number-spin-box`. PR-3a pilot caught 5 test-selector pierces of `elix-number-spin-box` in `tests/e2e/issues.spec.js` + `group-transforms.spec.js`. For PR-3b: grep `<se-prompt-dialog>` (5 sites expected: dialogs-extra.spec.js + 4 production sites) and `<se-elix-alert-dialog>` (2 sites expected: SePlainAlertDialog.ts + dialogs-extra.spec.js). Refines [[feedback_consumer_audit_grep_test_files]].
2. **`<div role="button">` is keyboard-inaccessible.** Tab can't reach it; Enter/Space don't activate without explicit `@keydown` handling. ALWAYS use `<button type="button">` for click triggers. PR-3a fixed this regression in seMenu + seDropdown toggles. For PR-3b: the choice buttons MUST be `<button type="button">` (also avoids the `<dialog>` form-submit default; see native-`<dialog>` recipe notes).
3. **Subagent i18n-key claims need verification — with the RIGHT grep pattern.** PR-3a session had a subagent claim `tools.main_menu` existed at `lang.en.ts:123`. Main session grep'd for the literal dotted form `'tools.main_menu'` (returned only the consumption site), concluded the key was hallucinated, and reverted. **The subagent was right** — the key exists nested as `tools: { main_menu: 'Main Menu' }`. The dotted-form grep missed the nested object structure. **Lesson:** i18n-key grep MUST use the rightmost-portion-only pattern (e.g., `main_menu`), NOT the dotted form. New global memory: `feedback_i18n_key_grep_pattern.md`. For PR-3b: if either agent introduces a `t('foo.bar.baz')` lookup, the verification grep is for `baz` (rightmost), not the dotted form.
4. **Parallel-batch dispatch has port-8000 contention.** Vite preview's `--strictPort` + `reuseExistingServer: true` means siblings risk running tests against wrong `dist/`. N/A in PR-3b — sequential dispatch (Tasks 1 + 2 run one at a time).
5. **Firefox-only layout regression under always-mounted `position: absolute` popups.** PR-3a seMenu had a popup always-mounted `position: absolute` with `display: none` toggle that caused intermittent right-click coordinate drift in Firefox. Mitigation: conditional render (`${this._open ? html : nothing}`). N/A in PR-3b — native `<dialog>` is its own positioned context with a backdrop layer; not a child popup absolutely-positioned over the editor canvas.

## Validation gate — exact commands the main session will run after your worktree merges back

```
git -C "C:/Users/jscha/source/repos/svgedit" status                # clean working tree expected
npx tsc --build --force                                            # 0 errors
npm run lint                                                       # 0 errors, 23 warnings (jgraduate baseline)
npx vitest run                                                     # ≥ 640/640 passing (current baseline)
npx tsx scripts/run-e2e.ts                                         # 250/250 passing both browsers
```

Do NOT report "gate green" without running these yourself first and pasting the output. The main session re-runs them after merge per `feedback_verify_subagent_gate_claims` — if your numbers don't match, the work gets reverted and re-dispatched.

## Out of scope — do NOT do any of the following

- Do NOT change the public API of SePlainAlertDialog (constructor, `.textContent`, `.choices`, `.open()`, `.close()`, `.opened`, `.whenClosed()`, `.keyChoice`). The 4 consumers (seAlertDialog, seConfirmDialog, seSelectDialog, sePromptDialog→seStatusDialog) all rely on this exact shape.
- Do NOT change the seStatusDialog (sePromptDialog) `close` attribute toggle semantics. PR-3b lock #4: preserve verbatim — pure toggle on any value change. Latent quirk worth fixing later (todo #10 follow-up).
- Do NOT change the SePlainAlertDialog CLASS name. PR-3b lock #3: tag renames, class stays. Class name is used by 4 importers as the constructor.
- Do NOT update consumer callsites EXCEPT the 5 enumerated in Task 2's "External-API contract → Consumers" section. Other elix-bound files (svgSourceDialog etc.) are PR-3c scope.
- Do NOT touch any other file in the repo. Your scope is `<ABSOLUTE_FILE_PATH_CURRENT/AFTER_RENAME>` plus the 5 callsite files for Task 2 (or 1 test selector update for Task 1).
- Do NOT touch CHANGELOG yourself — the main session appends it at Task 3.
- Do NOT add new dependencies. Lit 3 is already in `package.json` from PR-1.
- Do NOT add new tests unless your component changes contract semantics. The existing `dialogs-extra.spec.js` test for seStatusDialog is updated in Task 2 for the rename but its assertion shape is preserved.

## Out-of-file changes — task-specific

This task's out-of-file scope is enumerated in the per-task header below.

## When you're done

Report:
1. Final LOC count of the converted file (and the deleted file if it was renamed)
2. Validation-gate output (paste the 5 commands' results)
3. Any deviations from the reference shape with rationale
4. Anything you noticed but didn't fix (preserve-as-is items, latent issues)
````

### Per-component substitutions

The placeholders `<TASK_NUM>`, `<ABSOLUTE_FILE_PATH_CURRENT>`, `<ABSOLUTE_FILE_PATH_AFTER_RENAME>`, `<LINE_RANGE>`, `<TAG_NAME_NEW>`, `<TAG_RENAME_NOTE>`, `<LIST_FROM_observedAttributes>`, `<LIST_OF_API_USED_BY_CONSUMERS>`, `<LIST_FROM_dispatchEvent_CALLS>`, `<LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP>`, `<CURRENT_CLASS_NAME>`, `<CLASS_RENAME_NOTE>`, and the per-component VERBATIM source and AUDIT NOTES are filled in by the main session in each per-component task below.

---

## Tasks

### Task 0: Branch + baseline gate

**Files:**
- Create: branch `feat/elix-to-lit-pr-3b` from master `7cfcc1ee`

- [ ] **Step 1: Verify master is at expected SHA**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" rev-parse master
```

Expected: `7cfcc1ee...` (the PR #34 todo-#10-small-fix-bundle merge from 2026-05-24). If different, STOP and surface to user.

- [ ] **Step 2: Create branch**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull origin master
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feat/elix-to-lit-pr-3b
```

- [ ] **Step 3: Commit plan-doc as the first commit on branch (single-PR bundle per PR-3a precedent)**

The plan-doc file `docs/superpowers/plans/2026-05-24-svgedit-elix-to-lit-pr-3b-plan.md` is already on disk (this very file). Add + commit:

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/plans/2026-05-24-svgedit-elix-to-lit-pr-3b-plan.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(plan): #3 PR-3b — SePlainAlertDialog + sePromptDialog→seStatusDialog Lit conversion plan"
```

- [ ] **Step 4: Baseline gate from master HEAD**

```powershell
cd "C:/Users/jscha/source/repos/svgedit"
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
```

Record the baseline numbers in the chat. Expected:
- tsc: 0 errors
- lint: 0 errors, 23 warnings (jgraduate-deferred baseline from PR #23)
- vitest: 640/640 passing
- e2e: 250/250 passing both browsers (chromium + firefox)

If any of these are different from expected, STOP and investigate before any conversions.

---

### Task 1: Convert SePlainAlertDialog to Lit + rename tag + update test selector

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/SePlainAlertDialog.ts` (current 92 lines → target ~70-90)
- Modify: `C:/Users/jscha/source/repos/svgedit/tests/e2e/dialogs-extra.spec.js` (lines 30 + 32 — the 2 `se-elix-alert-dialog` selectors)

**Why pilot:** SePlainAlertDialog is the sequential precondition for Task 2 (sePromptDialog converts to inline-native-`<dialog>` rather than composing SePlainAlertDialog, BUT Task 2's agent reads Task 1's output to confirm the SePlainAlertDialog API surface for the other consumers — seAlertDialog/seConfirmDialog/seSelectDialog — is preserved). Also: SePlainAlertDialog is the first native-`<dialog>` conversion in the repo; establishes the pattern for Task 2 + all of PR-3c.

**External-API contract** (extracted by main session BEFORE dispatch):
- Tag name: `se-plain-alert-dialog` (RENAMED from `se-elix-alert-dialog`; class name preserved)
- Class name: `SePlainAlertDialog` (PRESERVED — 4 consumers use it as the constructor)
- Public methods / properties consumers rely on:
  - `new SePlainAlertDialog()` — constructor (no args)
  - `dialog.textContent = string` — slotted display text (light DOM `<slot>`)
  - `dialog.choices = string[]` — setter for the list of button labels (default: `['Ok']`)
  - `dialog.open()` — show dialog (modal); resets `keyChoice` to null
  - `dialog.close()` — programmatically close
  - `dialog.opened: boolean` — getter; mirrors native `<dialog>.open`
  - `dialog.whenClosed(): Promise<{ choice: string }>` — resolves with the choice on any close path
  - `dialog.keyChoice: string | null` — instance property; set to 'Cancel' by Esc key handler; null at construction time and on each `open()`
- Observed attributes: NONE (current code has no `observedAttributes` / `attributeChangedCallback`)
- Events fired: native `<dialog>.close` event (delegated by Lit's `@close=` binding to internal handler)
- Consumers (verified via grep, 2026-05-24):
  - `src/editor/dialogs/seAlertDialog.ts:6` — `new SePlainAlertDialog()` + `.textContent = text` + `.choices = ['Ok']` + `.open()`
  - `src/editor/dialogs/seConfirmDialog.ts:7` — `new SePlainAlertDialog() as any` + `.textContent` + `.choices` + `.open()` + `await .whenClosed()` + `.keyChoice ?? response.choice`
  - `src/editor/dialogs/seSelectDialog.ts:7` — `new SePlainAlertDialog() as any` + `.textContent` + `.choices` + `.open()` + `await .whenClosed()` + `response.choice`
  - `src/editor/dialogs/sePromptDialog.ts:22` — `new SePlainAlertDialog() as any` — **NOTE:** sePromptDialog converts to inline native-`<dialog>` in Task 2 (drops this composition); this consumer is consumed-and-replaced in Task 2.
  - `tests/e2e/dialogs-extra.spec.js:30,32` — `document.querySelectorAll('se-elix-alert-dialog')` — **UPDATE in this task to `se-plain-alert-dialog`** (the rename).

**Audit notes** (carried forward from `docs/AUDIT_2026-05-16.md` + the elix-to-Lit spec):
- 6 `/* eslint-disable */` directives at line 1 are elix-base-class `any` leakage suppressors — they DISAPPEAR with the Lit conversion (no elix base class means no leaked `any`).
- 2 `@ts-expect-error` directives (line 3 + line 17 + line 84) are elix-internal-symbol suppressors — they DISAPPEAR with the Lit conversion.
- The original elix `[template]` getter extends elix's PlainAlertDialog template by replacing `#frameContent` with a custom div + button container, then appending a `<style>` block. The Lit version owns the full `<dialog>` template + `static styles = css` block directly — no extension dance needed.
- The original elix `[keydown]` getter handles Esc by setting `keyChoice = 'Cancel'` then calling `this.close()`. The Lit version sets `keyChoice = 'Cancel'` in a host-level `keydown` listener, then lets the native `<dialog>` handle Esc-to-close naturally (no `preventDefault`). The native `close` event then fires and the `whenClosed()` promise resolves with `keyChoice ?? lastChoice ?? 'Cancel'`.

- [ ] **Step 1: Pre-dispatch 4-line self-check (verbalize in chat BEFORE the Agent call)**

State out loud in the chat:
1. "I'm about to dispatch a subagent to convert `SePlainAlertDialog` to Lit + rename the tag + update 2 test selector lines."
2. "The verbatim code in the prompt is: `src/editor/dialogs/SePlainAlertDialog.ts:1-92` AND `tests/e2e/dialogs-extra.spec.js:1-38` (both Read'd before dispatch via main-session Read tool)."
3. "The fix shape I'm passing is: native HTML5 `<dialog>` recipe (shape C) + the locked seText + seInput reference components — not a description."
4. "Validation: tsc + lint + vitest + e2e → expected 0 errors / 0 errors + 23 warnings / 640+ / 250."

If step 2 is "I haven't Read the files yet" — STOP, Read, re-dispatch.

- [ ] **Step 2: Read current sources via main-session Read tool**

```
Read C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/SePlainAlertDialog.ts
Read C:/Users/jscha/source/repos/svgedit/tests/e2e/dialogs-extra.spec.js
Read C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/seAlertDialog.ts
Read C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/seConfirmDialog.ts
Read C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/seSelectDialog.ts
```

Bind the full contents into context. SePlainAlertDialog.ts (target file) + dialogs-extra.spec.js (test file with the 2 selectors to update) get pasted into the agent prompt verbatim at Step 4. The 3 consumer wrappers are NOT pasted to the agent — they're consumer-side verification only and are out of scope for Task 1's modifications.

- [ ] **Step 3: Grep consumers in main session (re-verify the consumer list)**

Use Grep tool to enumerate every consumer of `SePlainAlertDialog` (class import) and `<se-elix-alert-dialog>` (tag) across `src/`, `tests/`, `packages/`:

```
Grep pattern: "SePlainAlertDialog|se-elix-alert-dialog|se-plain-alert-dialog"
path: C:/Users/jscha/source/repos/svgedit
output_mode: content
-n: true
glob: "!node_modules"
```

Expected: 4 consumer .ts files + the SePlainAlertDialog.ts itself + 2 lines in dialogs-extra.spec.js + docs/CHANGELOG historical references. If any unexpected match, surface to user before dispatch.

Paste the file:line list into the agent prompt under "External-API contract → Consumers".

- [ ] **Step 4: Dispatch subagent via Agent tool with worktree isolation**

```
Agent(
  description: "Convert SePlainAlertDialog to Lit + rename tag (PR-3b Task 1)",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: <SHARED_DISPATCH_PACKET with placeholders filled:
    TASK_NUM = 1 (Task 1 of PR-3b)
    ABSOLUTE_FILE_PATH_CURRENT = C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/SePlainAlertDialog.ts
    ABSOLUTE_FILE_PATH_AFTER_RENAME = (not renamed at file level; only tag renamed)
    LINE_RANGE = 1-92
    TAG_NAME_NEW = se-plain-alert-dialog
    TAG_RENAME_NOTE = "RENAMED from `se-elix-alert-dialog` per PR-3b lock #3. Update `customElements.define()` AND the 2 selectors at `tests/e2e/dialogs-extra.spec.js:30,32` in the same task."
    LIST_FROM_observedAttributes = (none — current code has no observedAttributes)
    LIST_OF_API_USED_BY_CONSUMERS = (see External-API contract → Public methods/properties above)
    LIST_FROM_dispatchEvent_CALLS = native <dialog>.close event delegated via @close= binding
    LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP = <PASTE FROM STEP 3>
    CURRENT_CLASS_NAME = SePlainAlertDialog
    CLASS_RENAME_NOTE = "CLASS NAME PRESERVED. Only the tag (customElements.define value) renames."
    VERBATIM SOURCE = <PASTE FULL SePlainAlertDialog.ts FROM STEP 2 with line numbers>
    AUDIT NOTES = (see above in Task 1 header — full text)
    EXTRA OUT-OF-FILE CHANGES = "Update `tests/e2e/dialogs-extra.spec.js` lines 30 + 32 from `se-elix-alert-dialog` to `se-plain-alert-dialog`. Verbatim test source pasted below:"
    <PASTE dialogs-extra.spec.js FROM STEP 2 with line numbers>
  >
)
```

The agent prompt MUST include the dialogs-extra.spec.js verbatim source (38 lines) so the agent can update lines 30 + 32 with high confidence and without needing to re-read.

- [ ] **Step 5: Wait for subagent report; do NOT trust the gate-pass claim**

Per [[feedback_verify_subagent_gate_claims]], the subagent's "gate green" report is informational only. The main session re-runs the gate after merge in Step 7.

- [ ] **Step 6: Merge worktree back to branch**

```powershell
# The Agent tool's isolation:"worktree" returns the worktree path + branch name on completion.
# Merge that branch into feat/elix-to-lit-pr-3b:
git -C "C:/Users/jscha/source/repos/svgedit" checkout feat/elix-to-lit-pr-3b
git -C "C:/Users/jscha/source/repos/svgedit" merge --ff-only <agent-branch-name>
```

If merge has conflicts (shouldn't for a 2-file change): inspect, resolve manually, re-stage, re-commit. If anything unexpected, STOP and surface to user.

- [ ] **Step 7: Main-session gate re-verification**

```powershell
cd "C:/Users/jscha/source/repos/svgedit"
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
```

Expected: same as Task 0 baseline. If ANY count regresses (tsc errors > 0, lint errors > 0 or warnings > 23, vitest < 640, e2e < 250):
- Revert the merge: `git -C "C:/Users/jscha/source/repos/svgedit" reset --hard <pre-merge-SHA>`
- Re-dispatch the subagent with the failure log inlined as "what went wrong last time" context.

- [ ] **Step 8: Spec-compliance reviewer + code-quality reviewer (parallel, single Agent message)**

Per PR-2/PR-3a dispatch protocol, after each conversion lands on branch, dispatch TWO reviewer subagents in parallel (single message with two Agent tool calls):

```
Agent #1 — spec compliance reviewer:
  description: "PR-3b Task 1 spec compliance review"
  subagent_type: "general-purpose"
  prompt: "Review the diff at <SHA> against this plan's § 'Per-conversion approach' bullets + the 14 convention bullets + the External-API contract for SePlainAlertDialog + the native-<dialog> recipe (shape C). Report deviations only — skip everything that looks right. <PASTE diff via git -C path show <SHA>>"

Agent #2 — code-quality reviewer:
  description: "PR-3b Task 1 code quality review"
  subagent_type: "general-purpose"
  prompt: "Code-quality review of <SHA>. Flag: unused vars, dead branches, type-safety regressions (especially the elimination of the 6 eslint-disable directives + 2 @ts-expect-error), swallowed exceptions, missed `<button type=button>` (form-submit default), any new `as any` casts that don't have a clear rationale, missed Esc keydown handler. <PASTE diff>"
```

- [ ] **Step 9: Apply reviewer findings (if any)**

If either reviewer surfaces a real issue (not bikeshed), main session fixes inline via Edit tool OR re-dispatches a fixup subagent. Re-run Step 7 after any fixup.

---

### Task 2: Convert sePromptDialog → seStatusDialog + rename file + 5 callsite updates

**Files:**
- Delete (via git rename): `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/sePromptDialog.ts` (current 103 lines)
- Create (via git rename + content rewrite): `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/seStatusDialog.ts` (target ~70-90 lines)
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/index.ts` (line 9)
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/EditorStartup.ts` (lines 141-142)
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/extensions/ext-opensave/ext-opensave.ts` (lines 59, 60, 67, 88, 119)
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/Editor.ts` (line 337 — comment only)
- Modify: `C:/Users/jscha/source/repos/svgedit/tests/e2e/dialogs-extra.spec.js` (lines 4, 6, 9)

**Why sequential after Task 1:** Task 2's agent reads Task 1's merged source to confirm the SePlainAlertDialog API contract (`.textContent`, `.choices`, `.open()`, etc.) is still preserved for the other 3 consumers (seAlertDialog/seConfirmDialog/seSelectDialog). The seStatusDialog conversion itself does NOT compose SePlainAlertDialog (per PR-3b lock #5 — inline as native `<dialog>` directly), so the technical dependency is one-directional: Task 2 verifies Task 1's contract, but does not import the Lit version.

**External-API contract** (extracted by main session BEFORE dispatch):
- Tag name: `se-status-dialog` (RENAMED from `se-prompt-dialog`)
- Class name: `SeStatusDialog` (RENAMED from `SePromptDialog`)
- File name: `seStatusDialog.ts` (RENAMED from `sePromptDialog.ts`)
- Observed attributes (verified in current source line 30): `title`, `close`
- Public methods / properties consumers rely on:
  - `setAttribute('id', 'se-status-dialog')` — DOM id used by `$id()` lookups (5 sites in ext-opensave)
  - `.title = string` (setter) — opens dialog with the text (current behavior at lines 41-48)
  - `.close = boolean | string` (setter — accepts truthy for "true", falsy for unset) — current behavior at lines 90-97
  - `setAttribute('close', anything)` — TOGGLES open/closed (current behavior at lines 49-54). **PRESERVE VERBATIM — toggle semantics per PR-3b lock #4.**
  - `getAttribute('close')` returns string | null — current behavior at lines 83-85.
- Events fired: none (component is a status-display modal; close path doesn't notify a consumer)
- Consumers (verified via grep, 2026-05-24):
  - `src/editor/dialogs/index.ts:9` — `import './sePromptDialog.js'` → `import './seStatusDialog.js'`
  - `src/editor/EditorStartup.ts:141-142` — `document.createElement('se-prompt-dialog') as any` + `setAttribute('id', 'se-prompt-dialog')` → both refs swap to `se-status-dialog`
  - `src/editor/extensions/ext-opensave/ext-opensave.ts:59,60,67,88,119` — 5 sites of `$id('se-prompt-dialog')` → `$id('se-status-dialog')`
  - `src/editor/Editor.ts:337` — comment text only: "(audit input #4 — sePromptDialog is status-display)" → "(audit input #4 — seStatusDialog, formerly sePromptDialog, is status-display)" — preserve the historical name for traceability
  - `tests/e2e/dialogs-extra.spec.js:4,6,9` — test description `'se-prompt-dialog toggles title and close'` → `'se-status-dialog toggles title and close'`; `customElements.get('se-prompt-dialog')` → `'se-status-dialog'`; `document.createElement('se-prompt-dialog')` → `'se-status-dialog'`

**Audit notes** (carried forward from `docs/AUDIT_2026-05-16.md` § "Real bugs surfaced" + the elix-to-Lit spec):
- Closes audit input #4 (misnamed dialog — "sePromptDialog" is misleading since it's a cancel-only status display, not a prompt-with-input).
- **PRESERVE VERBATIM (per PR-3b lock #4):** the `close` attribute is a pure TOGGLE on any value change. ext-opensave's flow (open via `.title=`, then immediately `setAttribute('close', false)` at line 60) appears to rely on this. Latent UX quirk; investigate-and-fix in a follow-up to todo #10.
- 6 `/* eslint-disable */` directives at line 1 are elix-base-class `any` leakage from the `new SePlainAlertDialog() as any` instantiation — DISAPPEAR when seStatusDialog inlines its own native `<dialog>` (no elix import).
- The original component uses `attachShadow({ mode: 'open' })` + an internal `_shadowRoot` field + a separate `dialog` field holding the SePlainAlertDialog instance. The Lit version uses Lit's open shadow DOM (no manual `attachShadow`) + a single native `<dialog>` in the render template.

**Design notes for the agent:**

Native `<dialog>` shape for seStatusDialog (inline — does NOT compose SePlainAlertDialog):
```ts
@customElement('se-status-dialog')
export class SeStatusDialog extends LitElement {
  // No @property accessors — title + close are observedAttributes-driven via attributeChangedCallback,
  // matching current sePromptDialog behavior. Or use @property with a custom converter — agent's choice,
  // as long as the consumer API (setAttribute, getAttribute, .title=, .close=) is preserved.

  @query('dialog') accessor _dialog!: HTMLDialogElement

  static get observedAttributes (): string[] {
    return ['title', 'close']
  }

  attributeChangedCallback (name: string, _old: string | null, newValue: string | null): void {
    super.attributeChangedCallback?.(name, _old, newValue)
    switch (name) {
      case 'title':
        if (this._dialog?.open) this._dialog.close()
        this._statusText = newValue ?? ''
        this._dialog?.showModal()
        this.requestUpdate()
        break
      case 'close':
        // PRESERVE VERBATIM (PR-3b lock #4): toggle semantics
        if (this._dialog?.open) {
          this._dialog.close()
        } else {
          this._dialog?.showModal()
        }
        break
    }
  }

  @state() accessor _statusText = ''

  get title (): string { return this.getAttribute('title') ?? '' }
  set title (value: string) {
    if (value) this.setAttribute('title', value)
    else this.removeAttribute('title')
  }

  get close (): string | null { return this.getAttribute('close') }
  set close (value: string | boolean | null) {
    if (value) this.setAttribute('close', 'true')
    else this.removeAttribute('close')
  }

  render () {
    return html`
      <dialog>
        <div class="frame">
          <div class="content">${this._statusText}</div>
          <div class="choice-button-container">
            <button type="button" class="choice-button" @click=${this._onCancelClick}>Cancel</button>
          </div>
        </div>
      </dialog>
    `
  }

  private _onCancelClick = () => {
    this._dialog?.close()
  }

  static styles = css`
    /* mirror SePlainAlertDialog styles — same visual treatment per existing UX */
    dialog { padding: 1em; background: #CCC; width: 300px; border: 1px outset #777; font-size: 0.8em; font-family: Verdana, Helvetica, sans-serif; border-radius: 5px; }
    .content { height: 95px; background: #DDD; overflow: auto; text-align: left; border: 1px solid #5a6162; padding: 1em; border-radius: 5px; }
    .choice-button-container { margin-top: 1em; text-align: center; }
  `
}
```

**Note on the `title` attribute:** HTMLElement has a built-in `title` property (tooltip text). Setting `.title = '...'` on a custom element normally sets the HTML `title` attribute (tooltip). The current sePromptDialog gets away with overriding the getter/setter to redirect — Lit can do the same. The agent should preserve this override pattern.

- [ ] **Step 1: Pre-dispatch 4-line self-check**

State out loud in the chat:
1. "I'm about to dispatch a subagent to convert+rename `sePromptDialog` → `seStatusDialog` AND update 5 callsite files."
2. "The verbatim code in the prompt is: `src/editor/dialogs/sePromptDialog.ts:1-103` + the 5 callsite files (all Read'd before dispatch via main-session Read tool)."
3. "The fix shape I'm passing is: native HTML5 `<dialog>` recipe (shape C) + the locked seText + seInput reference components — not a description."
4. "Validation: tsc + lint + vitest + e2e → expected 0 errors / 0 errors + 23 warnings / 640+ / 250."

If step 2 is "I haven't Read the files yet" — STOP, Read, re-dispatch.

- [ ] **Step 2: Read current sources via main-session Read tool**

```
Read C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/sePromptDialog.ts
Read C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/index.ts
Read C:/Users/jscha/source/repos/svgedit/src/editor/EditorStartup.ts (offset around line 141 to read context for 130-160)
Read C:/Users/jscha/source/repos/svgedit/src/editor/extensions/ext-opensave/ext-opensave.ts (whole file — agent needs all 5 callsite lines + surrounding context)
Read C:/Users/jscha/source/repos/svgedit/src/editor/Editor.ts (offset around line 337 to read context for 330-345)
Read C:/Users/jscha/source/repos/svgedit/tests/e2e/dialogs-extra.spec.js (whole file)
```

Bind the full contents into context. All 6 files paste into the agent prompt verbatim at Step 4. The verbatim source on the prompt is the contract — per [[feedback_subagent_code_specificity]], the agent will NOT fetch files from disk.

- [ ] **Step 3: Grep consumers in main session (re-verify the 5-callsite list)**

Use Grep tool to enumerate every consumer:

```
Grep pattern: "sePromptDialog|SePromptDialog|se-prompt-dialog"
path: C:/Users/jscha/source/repos/svgedit
output_mode: content
-n: true
glob: "!node_modules"
```

Expected: 5 production .ts/.js files + sePromptDialog.ts itself + docs/CHANGELOG historical references + dialogs-extra.spec.js. If any unexpected match in production code, surface to user before dispatch.

Paste the file:line list into the agent prompt under "External-API contract → Consumers".

- [ ] **Step 4: Dispatch subagent via Agent tool with worktree isolation**

```
Agent(
  description: "Convert sePromptDialog → seStatusDialog + 5 callsite updates (PR-3b Task 2)",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: <SHARED_DISPATCH_PACKET with placeholders filled:
    TASK_NUM = 2 (Task 2 of PR-3b)
    ABSOLUTE_FILE_PATH_CURRENT = C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/sePromptDialog.ts
    ABSOLUTE_FILE_PATH_AFTER_RENAME = C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/seStatusDialog.ts
    LINE_RANGE = 1-103
    TAG_NAME_NEW = se-status-dialog
    TAG_RENAME_NOTE = "RENAMED from `se-prompt-dialog` per PR-3b lock #1. Update `customElements.define()` AND 5 callsite files (see below)."
    LIST_FROM_observedAttributes = title, close
    LIST_OF_API_USED_BY_CONSUMERS = (see External-API contract → Public methods/properties above)
    LIST_FROM_dispatchEvent_CALLS = (none — component fires no events)
    LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP = <PASTE FROM STEP 3 (5 callsite files, line-numbered)>
    CURRENT_CLASS_NAME = SePromptDialog
    CLASS_RENAME_NOTE = "RENAMED to SeStatusDialog per PR-3b lock #1."
    VERBATIM SOURCE = <PASTE FULL sePromptDialog.ts FROM STEP 2 with line numbers>
    AUDIT NOTES = (see above in Task 2 header — full text)
    EXTRA OUT-OF-FILE CHANGES = "Rename file via `git mv` (the agent runs this in its worktree). Then update 5 callsite files (verbatim source pasted below for each):
      1. src/editor/dialogs/index.ts: line 9 — replace `import './sePromptDialog.js'` with `import './seStatusDialog.js'`
      2. src/editor/EditorStartup.ts: lines 141-142 — replace `'se-prompt-dialog'` (2 occurrences) with `'se-status-dialog'`
      3. src/editor/extensions/ext-opensave/ext-opensave.ts: lines 59, 60, 67, 88, 119 — replace `$id('se-prompt-dialog')` (5 occurrences) with `$id('se-status-dialog')`
      4. src/editor/Editor.ts: line 337 — comment text update from `sePromptDialog` to `seStatusDialog, formerly sePromptDialog` (preserve historical name for traceability)
      5. tests/e2e/dialogs-extra.spec.js: lines 4 (test description), 6 (customElements.get), 9 (document.createElement) — replace `se-prompt-dialog` with `se-status-dialog`"
    <PASTE EACH CALLSITE FILE'S VERBATIM SOURCE WITH LINE NUMBERS>
    DESIGN NOTES = (see "Design notes for the agent" in Task 2 header — full text with the seStatusDialog scaffold)
    PRESERVE-VERBATIM = "The `close` attribute toggle semantics MUST be preserved verbatim per PR-3b lock #4. setAttribute('close', anything) toggles open/closed regardless of value. ext-opensave appears to rely on this; do not 'fix' it in this PR."
  >
)
```

- [ ] **Step 5: Wait for subagent report; do NOT trust the gate-pass claim**

- [ ] **Step 6: Merge worktree back to branch**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" checkout feat/elix-to-lit-pr-3b
git -C "C:/Users/jscha/source/repos/svgedit" merge --ff-only <agent-branch-name>
```

Note: the agent's worktree should contain a `git mv` for the file rename. The `--ff-only` merge preserves that rename in the branch history. Verify after merge via `git log --diff-filter=R --oneline -3` that the rename is recorded.

- [ ] **Step 7: Main-session gate re-verification**

```powershell
cd "C:/Users/jscha/source/repos/svgedit"
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
```

Expected: same as Task 0 baseline.

- [ ] **Step 8: Spec + code-quality reviewers (parallel, single Agent message)**

```
Agent #1 — spec compliance reviewer:
  description: "PR-3b Task 2 spec compliance review"
  subagent_type: "general-purpose"
  prompt: "Review the diff at <SHA> against this plan's § 'Per-conversion approach' bullets + 14 convention bullets + the External-API contract for seStatusDialog + the native-<dialog> recipe + PR-3b lock #4 (preserve close-attribute toggle semantics verbatim). Verify the 5 callsite files all have updated references (no `se-prompt-dialog` remains in production code). Report deviations only. <PASTE diff>"

Agent #2 — code-quality reviewer:
  description: "PR-3b Task 2 code quality review"
  subagent_type: "general-purpose"
  prompt: "Code-quality review of <SHA>. Flag: dead imports (esp. SePlainAlertDialog import dropped from seStatusDialog), unused vars, type-safety regressions, swallowed exceptions, missed `<button type=button>`, any new `as any` casts, missed `getAttribute('close')` typing, missed file rename via git mv (should appear as R100 in diff stat). <PASTE diff>"
```

- [ ] **Step 9: Apply reviewer findings (if any)**

---

### Task 3: Final gate + CHANGELOG entry + todo-#10 follow-up logging

- [ ] **Step 1: Full main-session gate from final branch HEAD**

```powershell
cd "C:/Users/jscha/source/repos/svgedit"
git -C "C:/Users/jscha/source/repos/svgedit" status               # clean
git -C "C:/Users/jscha/source/repos/svgedit" log --oneline -8     # review commit history (should be: plan-doc + Task 1 conversion + Task 2 conversion + reviewer fixups + CHANGELOG)
npx tsc --build --force                                           # 0 errors
npm run lint                                                      # 0 errors, 23 warnings (baseline)
npx vitest run                                                    # ≥ 640/640
npx tsx scripts/run-e2e.ts                                        # 250/250 both browsers
```

Record cumulative LOC delta in chat:
```powershell
git -C "C:/Users/jscha/source/repos/svgedit" diff --stat master..feat/elix-to-lit-pr-3b -- 'src/editor/dialogs/' 'tests/e2e/' 'src/editor/EditorStartup.ts' 'src/editor/Editor.ts' 'src/editor/extensions/'
```

Verify the rename appears as `R100` or similar in the diff stat:
```powershell
git -C "C:/Users/jscha/source/repos/svgedit" log --diff-filter=R --oneline -3
```

- [ ] **Step 2: Manual cross-browser smoke (mandatory per spec § Test plan)**

Per spec § "Test plan per PR" → PR-3 gate includes "manual smoke: menu interactions, spin input keyboard, plain alert dialog, export dialog". PR-3b-specific smoke checklist:

```
Start dev server: `npm start` (vite dev on http://localhost:8000/src/editor/index.html)

For each of these surfaces, click through:

1. seAlert flow (uses SePlainAlertDialog directly):
   - Trigger an action that calls window.seAlert() — e.g., paste invalid SVG via Source dialog
   - Verify the alert dialog opens, has the "Ok" button, click Ok closes it, Esc closes it.
   - Verify tag is `<se-plain-alert-dialog>` in DOM inspector.

2. seConfirm flow (uses SePlainAlertDialog directly):
   - Trigger an action that calls window.seConfirm() — e.g., "Clear" the canvas with existing content
   - Verify the confirm dialog opens with Ok + Cancel buttons. Click Cancel → action not taken. Click Ok → action taken. Esc → equivalent to Cancel (keyChoice path).

3. seStatusDialog flow (formerly sePromptDialog):
   - Trigger an action that opens the status dialog — drag an image into the canvas from the file system (triggers ext-opensave at line 59).
   - Verify the dialog shows "Loading image…" briefly.
   - Verify the dialog closes when the image finishes loading.
   - Verify tag is `<se-status-dialog>` in DOM inspector.

4. Repeat 1-3 in Firefox.

5. Spot-check existing dialogs (PR-3c scope, NOT converted in PR-3b — must still work):
   - Open Document Properties dialog
   - Open Edit Preferences dialog
   - Open SVG Source dialog
   - Open Export dialog

If ANY surface regresses behavior vs master, STOP and surface to user.
```

- [ ] **Step 3: CHANGELOG.md entry append**

Edit `CHANGELOG.md`, append to the `[Unreleased]` section:

```markdown
### Changed

- **#3 PR-3b — Convert 2 plain-alert / status-display elix-bound dialogs to Lit + rename sePromptDialog → seStatusDialog + 5 callsite updates.** Second of 3 sub-PRs under todo item #3 PR-3 (5-PR elix → Lit migration). Closes audit input #4 (misnamed dialog — `sePromptDialog` is misleading since it's a cancel-only status display, not a prompt-with-input). Converted: `SePlainAlertDialog` (~92 → ~70-90 LOC; native HTML5 `<dialog>` element + slot for textContent; preserved API surface — `.choices`, `.open()`, `.close()`, `.opened`, `.whenClosed()`, `.keyChoice` — for the 3 `window.seAlert/seConfirm/seSelect` wrappers; tag renamed `<se-elix-alert-dialog>` → `<se-plain-alert-dialog>` since "elix" prefix is misleading post-conversion; class name preserved as 4 consumers use it as the constructor), `sePromptDialog` → `seStatusDialog` (~103 → ~70-90 LOC; file renamed `sePromptDialog.ts` → `seStatusDialog.ts`; class renamed `SePromptDialog` → `SeStatusDialog`; tag renamed `<se-prompt-dialog>` → `<se-status-dialog>`; inlined as standalone native `<dialog>` rather than composing `SePlainAlertDialog` per planning lock #5 — drops the `new SePlainAlertDialog() as any` cast; preserved the `close` attribute toggle-on-any-value semantics verbatim per planning lock #4 — latent UX quirk that ext-opensave's flow appears to rely on; logged to todo #10 as a follow-up investigation item). 5 callsite updates: `dialogs/index.ts` (import path), `EditorStartup.ts` (createElement + setAttribute id), `ext-opensave.ts` (5 `$id()` sites), `Editor.ts` (1 comment refresh — preserves historical sePromptDialog name for traceability), `tests/e2e/dialogs-extra.spec.js` (test description + 2 selector updates for sePromptDialog rename + 2 selector updates for SePlainAlertDialog tag rename). After PR-3b: `dialogs/` is mostly elix-free (only the 5 elix-dialog-coupled HTML-bound dialogs remain for PR-3c + 3 vendored se-elix overrides + the `import 'elix/define/Dialog.js'` line in `dialogs/index.ts`). Native HTML5 `<dialog>` pattern established for PR-3c. All gates green: tsc 0 / lint 0 errors + 23 warnings (jgraduate-deferred baseline) / vitest ≥ 640 / e2e 250 both browsers. External APIs preserved verbatim per spec; the 3 `window.seAlert/seConfirm/seSelect` wrapper files (`seAlertDialog.ts` / `seConfirmDialog.ts` / `seSelectDialog.ts`) work unchanged via `new SePlainAlertDialog()` constructor + `.textContent` + `.choices` + `.open()` + `.whenClosed()` + `.keyChoice` (the existing wrappers' eslint-disable + `as any` cleanup deferred as a future small follow-up).
```

- [ ] **Step 4: Commit CHANGELOG**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(changelog): #3 PR-3b — 2 plain-alert/status dialogs Lit-converted + sePromptDialog→seStatusDialog rename"
```

- [ ] **Step 5: Add todo #10 follow-up entry (memory write — REQUIRES USER CODEWORD)**

In `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`, append a new sub-item to item #10 ("Correctness backlog"):

```markdown
- [ ] **seStatusDialog `close` attribute toggle semantics** (logged post-PR-3b 2026-05-NN) — `setAttribute('close', anything)` is a pure TOGGLE not an explicit close (legacy from elix sePromptDialog era; preserved verbatim through PR-3b Lit conversion per PR-3b planning lock #4). `ext-opensave.ts:59-60` flow appears to rely on this (opens via `.title=`, then immediately `setAttribute('close', false)`, then later `setAttribute('close', true)` to "close" the dialog — but due to toggle, line 60 actually closes the just-opened dialog, then line 88/119's setAttribute opens it back up for the success path). Latent timing-dependent UX quirk. Investigate the actual UX flow with browser DevTools timing, then decide: (a) fix the toggle to be explicit-close semantics (newValue='true' → close, 'false' → open) + update ext-opensave to use the correct attribute values; OR (b) clarify ext-opensave to use the toggle deliberately by removing line 60 (the just-after-`.title=` setAttribute call); OR (c) refactor to dispatch methods on the element instead of attribute-driven toggle. Pairs with [[feedback_no_speculative_cross_repo_todos]] — fix shipped repo first, then revisit. New file `seStatusDialog.ts` after PR-3b ships at `src/editor/dialogs/seStatusDialog.ts`.
```

**This is a memory write — REQUIRES user codeword (`make it so` / `engage` / `do that thing`)** per CLAUDE.md before proceeding.

Per Task 3, the agent does NOT proceed with the memory write until user approval. Until then, surface the proposed entry text to the user in chat.

---

### Task 4: Open PR-3b + spec amendment

- [ ] **Step 1: Push branch**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/elix-to-lit-pr-3b
```

- [ ] **Step 2: Create PR via gh**

Write the PR body to a file in `C:/Users/jscha/AppData/Local/ClaudeScratch/` (per [[feedback_scratch_files_use_claudescratch]]):

```powershell
$body = @'
## Summary

Second of 3 sub-PRs under todo item #3 PR-3 of the 5-PR elix → Lit migration. Converts 2 plain-alert / status-display elix-bound dialogs in `src/editor/dialogs/` to Lit using native HTML5 `<dialog>`; renames `sePromptDialog` → `seStatusDialog` (closes audit input #4 — misnamed dialog); renames the `SePlainAlertDialog` tag from `<se-elix-alert-dialog>` to `<se-plain-alert-dialog>` (elix prefix is misleading post-conversion); updates all 5 callsite files.

**Scope locked at planning** (2026-05-24 PR-3b session, decisions recorded in `docs/superpowers/plans/2026-05-24-svgedit-elix-to-lit-pr-3b-plan.md` § "Decisions locked"):

- `<elix-dialog>` replacement: native HTML5 `<dialog>` (locked at PR-3a planning; first concrete use in PR-3b)
- `sePromptDialog` rename: `seStatusDialog` (file + class + tag)
- `SePlainAlertDialog` tag rename: `<se-elix-alert-dialog>` → `<se-plain-alert-dialog>` (class name preserved)
- seStatusDialog `close` attribute: preserve verbatim toggle semantics (latent quirk; logged to todo #10)
- seStatusDialog shape: inline native `<dialog>` (drop SePlainAlertDialog composition)
- Execution: subagent-driven per task (sequential, Task 1 → Task 2)

## What this PR does

### Conversions (2)

- **SePlainAlertDialog** (~92 → ~70-90 LOC): native HTML5 `<dialog>` + slot for `textContent` + dynamic choice buttons; preserved API surface for the 3 `window.seAlert/seConfirm/seSelect` wrappers; tag renamed `<se-elix-alert-dialog>` → `<se-plain-alert-dialog>`; class name preserved.
- **sePromptDialog → seStatusDialog** (~103 → ~70-90 LOC): file renamed; class renamed `SePromptDialog` → `SeStatusDialog`; tag renamed `<se-prompt-dialog>` → `<se-status-dialog>`; inlined as standalone native `<dialog>` (drops the `new SePlainAlertDialog() as any` composition); preserved `close` attribute toggle semantics verbatim per planning lock.

### Callsite updates (5 files)

- `src/editor/dialogs/index.ts` (import path)
- `src/editor/EditorStartup.ts` (createElement + setAttribute id)
- `src/editor/extensions/ext-opensave/ext-opensave.ts` (5 `$id()` sites)
- `src/editor/Editor.ts` (1 comment refresh)
- `tests/e2e/dialogs-extra.spec.js` (test description + selectors for BOTH renames)

### Not in scope (deferred)

- 5 elix-dialog HTML-bound dialogs (svgSourceDialog, imagePropertiesDialog, editorPreferencesDialog, exportDialog, storageDialog) + 3 vendored se-elix overrides + the `import 'elix/define/Dialog.js'` line in `dialogs/index.ts` → PR-3c
- 3 `window.se*` wrapper files (`seAlertDialog.ts`, `seConfirmDialog.ts`, `seSelectDialog.ts`) — eslint-disable + `as any` cleanup deferred as a future small follow-up; the wrappers themselves work unchanged via SePlainAlertDialog's preserved API.

### New patterns established

- **Native HTML5 `<dialog>` recipe** (shape C in the dispatch packet) — first use in svgedit; baseline-supported; pattern reusable for all PR-3c dialogs.
- **`<button type="button">` for choice buttons inside `<dialog>`** — avoids the form-submit default that bare `<button>` triggers inside a dialog's implicit form context.
- **Esc-handling via host-level keydown listener that sets keyChoice BEFORE native `<dialog>`'s native Esc-close fires** — Lit version's `keyChoice = 'Cancel'` is set in `_onKeydown`, then native `<dialog>` close fires, then the `@close=` handler reads `keyChoice` and resolves `whenClosed()` with it. Mirrors elix's behavior exactly.

## Test plan

- [x] tsc 0 errors
- [x] lint 0 errors + 23 warnings (jgraduate-deferred baseline)
- [x] vitest ≥ 640/640 passing
- [x] e2e 250/250 passing both browsers (chromium + firefox)
- [x] manual cross-browser smoke: `seAlert()` flow (Ok + Esc); `seConfirm()` flow (Ok/Cancel + Esc); `seStatusDialog` flow via image drag-and-drop (ext-opensave); spot-check existing PR-3c-scope dialogs (Document Properties, Edit Preferences, SVG Source, Export) still work.

## After this PR

- `dialogs/` is mostly elix-free (only 5 elix-dialog-coupled HTML-bound dialogs remain for PR-3c + 3 vendored se-elix overrides + the `import 'elix/define/Dialog.js'` line in `dialogs/index.ts`)
- Native HTML5 `<dialog>` pattern established for PR-3c.
- PR-3c next: 5 elix-dialog HTML-bound dialogs (svgSourceDialog, imagePropertiesDialog, editorPreferencesDialog, exportDialog, storageDialog) + delete 3 vendored se-elix overrides + drop `import 'elix/define/Dialog.js'`. After PR-3c: ZERO elix imports across `src/`.

Closes audit input #4 (`sePromptDialog` misnamed → renamed to `seStatusDialog`).

Plan: docs/superpowers/plans/2026-05-24-svgedit-elix-to-lit-pr-3b-plan.md
Spec: docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md
'@
$body | Out-File -FilePath "C:/Users/jscha/AppData/Local/ClaudeScratch/svgedit-pr-3b-body.md" -Encoding UTF8 -NoNewline
gh pr create --repo bilbospocketses/svgedit --title "feat(#3 PR-3b): 2 plain-alert/status dialogs Lit-converted + sePromptDialog→seStatusDialog rename + 5 callsite updates" --body-file "C:/Users/jscha/AppData/Local/ClaudeScratch/svgedit-pr-3b-body.md"
```

- [ ] **Step 3: Wait for required CI checks to pass**

Required checks (per svgedit Phase G lockdown):
- `build-and-test`
- `Analyze (javascript-typescript)`
- `Analyze (actions)`
- `Scorecard analysis`

If any check fails, investigate. Do NOT bypass.

- [ ] **Step 4: Squash-merge per CLAUDE.md PR-merge-method rule**

```powershell
gh pr merge --repo bilbospocketses/svgedit --squash --delete-branch
```

Verify squash result is web-flow signed (`committer: GitHub | verified: true`).

- [ ] **Step 5: Update spec doc with PR-3b SHIPPED amendment (separate small PR)**

Spec amendments in this repo go through PRs (established pattern: PR #21 marked PR-1 LANDED; PR #29 captured PR-2 → PR-3 deferrals; PR #31 marked PR-3a LANDED). Mirror that pattern.

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull origin master
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b docs/pr-3b-shipped-spec-amendment
# Edit docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md § Status
# Append a "2026-05-NN (PR-3b LANDED):" bullet mirroring the existing
# "2026-05-22 (PR-1 LANDED):" / "2026-05-23 (PR-2 LANDED):" / "2026-05-24 (PR-3a LANDED):" entries.
# Also update the "PR-3" section's "Status" line to reflect 2 of 3 sub-PRs shipped.
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(spec): mark #3 PR-3b LANDED in elix-to-lit Status block"
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin docs/pr-3b-shipped-spec-amendment
gh pr create --repo bilbospocketses/svgedit --title "docs(spec): mark #3 PR-3b LANDED" --body "Pure docs update; mirrors PR #21/#29/#31 pattern for PR-1/PR-2/PR-3a landings."
# After checks green:
gh pr merge --repo bilbospocketses/svgedit --squash --delete-branch
```

- [ ] **Step 6: Update todo_svgedit.md (memory write — REQUIRES USER CODEWORD)**

In `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`:
- Update the resume banner at top to point at PR-3c planning next (replace the "PR-3b planning queued" banner with "PR-3b SHIPPED + PR-3c planning queued")
- Move PR-3b entry to the Shipped section with full detail (mirror existing Shipped-section entry style for PR-1 / PR-2 / PR-3a)
- Update the active item count + "Last updated" timestamp
- Append the todo-#10 follow-up entry from Task 3 Step 5 (if not already there)

This is a memory write — **requires user codeword (`make it so` / `engage` / `do that thing`)** per CLAUDE.md before proceeding.

- [ ] **Step 7: Surface PR-3c planning option**

After PR-3b ships and todo is updated, surface to user: "PR-3b SHIPPED. Next queued: PR-3c planning (5 elix-dialog HTML-bound dialogs + 3 vendored se-elix overrides + drop `import 'elix/define/Dialog.js'`). Open a `superpowers:writing-plans` session for PR-3c?"

---

## Self-review

### Spec coverage

PR-3b scope from the spec doc's PR-3 list intersected with the "2 sub-PR-3b" subset:

| Spec PR-3 entry | Covered in PR-3b? | Where |
|---|---|---|
| SePlainAlertDialog (`src/editor/dialogs/SePlainAlertDialog.ts`) | ✓ | Task 1 |
| sePromptDialog rename → seStatusDialog (with 5 callsite updates) | ✓ | Task 2 |
| seMenu / seMenuItem / seDropdown / seSpinInput | DONE → PR-3a | — |
| sePlainMenuButton / sePlainBorderButton | DONE → PR-3a (deleted) | — |
| exportDialog / svgSourceDialog / imagePropertiesDialog / editorPreferencesDialog / storageDialog | DEFERRED → PR-3c | — |
| 3 vendored se-elix overrides | DEFERRED → PR-3c | — |
| `import 'elix/define/Dialog.js'` in dialogs/index.ts | DEFERRED → PR-3c | — |

All accounted for. PR-3b is the middle sub-PR of the 3-sub-PR PR-3 split.

### Placeholder scan

None of the "No Placeholders" anti-patterns are present:
- No "TBD" / "TODO" / "implement later" in the plan itself (only in audit notes describing existing source state)
- No "add appropriate error handling"
- No "write tests for the above" without code
- "Similar to Task N" → not used; Task 1 and Task 2 each have their full External-API contract + design note in-place
- All commands shown verbatim
- All shell paths absolute per CLAUDE.md Multi-Session cwd Discipline

### Type consistency

- `keyChoice: string | null` (Task 1) preserved verbatim — same type as current source line 75.
- `whenClosed(): Promise<{ choice: string }>` (Task 1) — return type matches current elix shape used at seConfirmDialog.ts:11 + seSelectDialog.ts:11.
- `choices: string[]` (Task 1) — type matches all 4 consumers' usage (`['Ok']`, `['Ok', 'Cancel']`, `['Cancel']`, custom string[]).
- Class names: `SePlainAlertDialog` (Task 1, keep) / `SePromptDialog → SeStatusDialog` (Task 2, rename). Consistent with PR-3a rename cascade.
- Tag names: `se-elix-alert-dialog → se-plain-alert-dialog` (Task 1) / `se-prompt-dialog → se-status-dialog` (Task 2). Both renames preserve `se-*` prefix per convention bullet 10.

### Gate baselines

Plan uses lint baseline `0 errors + 23 warnings (jgraduate-deferred)` from PR #23 (Tier B JSDoc strip), vitest `640/640`, e2e `250/250` — same as PR-3a baseline. Task 0 Step 4 verifies these match the actual master HEAD state before any conversions.

### CHANGELOG entry

The CHANGELOG entry at Task 3 Step 3 is long but matches the prior PR-3a / PR-2 / PR-1 entries' density. Acceptable per [[feedback_workflow_bound_lessons_stay_in_protocol]] (CHANGELOG IS the workflow's canonical detail-keeper for ship summaries).

### Codeword gate

Task 3 Step 5 (todo #10 follow-up logging — memory write to todo_svgedit.md) AND Task 4 Step 6 (todo_svgedit.md ship-state update — memory write) are explicitly flagged as requiring user codeword. All other writes are in-project docs/code and allowed without codeword per CLAUDE.md.

### Coverage of 5 PR-3a lessons in dispatch packet

| PR-3a lesson | In dispatch packet? | Applicable to PR-3b? |
|---|---|---|
| 1. Consumer audits MUST grep test files | ✓ (PR-3a lessons § lesson 1) | YES — both Tasks 1 + 2 must grep test files |
| 2. `<div role="button">` keyboard-inaccessible | ✓ (PR-3a lessons § lesson 2) | YES — choice buttons in both dialogs must be `<button type="button">` |
| 3. Subagent i18n-key claims need rightmost-portion grep | ✓ (PR-3a lessons § lesson 3) | Conditionally — only if Task 1 or 2 introduces t() lookups (unlikely; current source uses literal "Cancel" / "Ok") |
| 4. Parallel-batch port-8000 contention | ✓ (PR-3a lessons § lesson 4) | NO — sequential dispatch in PR-3b |
| 5. Firefox-only layout regression on always-mounted absolute popups | ✓ (PR-3a lessons § lesson 5) | NO — native `<dialog>` is its own positioned context with backdrop layer |

### Native `<dialog>` recipe — first-use risks

- **Risk: text content not visible** — Setting `dialog.textContent = 'foo'` on Lit element with `<slot>` should project into the dialog body. Verified mentally; e2e + manual smoke catch it if not.
- **Risk: `<dialog>` form-submit default** — Native `<dialog>` has an implicit form context where `<button>` defaults to `type="submit"`, which closes the dialog with form submission. Mitigated by explicit `<button type="button">` per dispatch packet convention.
- **Risk: Esc handling timing** — Native `<dialog>` close fires synchronously on Esc. The `_onKeydown` listener must set `keyChoice` BEFORE the close handler runs. JavaScript event ordering on a single element should fire keydown before close — verified mentally; e2e + manual smoke catch it.
- **Risk: backdrop styling** — Native `<dialog>::backdrop` pseudo-element is the modal backdrop. Default styling may differ from elix's. Manual smoke confirms visual parity is acceptable; if not, add `dialog::backdrop { background: rgba(0,0,0,0.4) }` or similar to `static styles`.

### File-rename diff hygiene

Task 2's file rename (`sePromptDialog.ts` → `seStatusDialog.ts`) must show as `git diff --stat` rename (`R100` or similar). The agent runs `git mv` in its worktree. The main session verifies via `git log --diff-filter=R --oneline -3` post-merge. If the file appears as separate delete + add (not a rename), the agent did not use `git mv` — surface to user and consider re-dispatching with explicit guidance.

### Test file paint pattern

`tests/e2e/dialogs-extra.spec.js` is touched by BOTH Task 1 (lines 30 + 32) and Task 2 (lines 4 + 6 + 9). The two edit ranges don't overlap; sequential edits are conflict-free. Task 1's worktree merge lands the line 30 + 32 changes first; Task 2's worktree merge lands lines 4 + 6 + 9 on top. Verify via `git -C ... log -p tests/e2e/dialogs-extra.spec.js` that both edits are recorded after Task 2 merges.
