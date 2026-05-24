# svgedit elix → Lit PR-3a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First of 3 sub-PRs under todo item #3 PR-3. Convert the 4 elix-internals-bound user-facing components in `src/editor/components/` to Lit; delete 2 now-dead internal-only files made orphan by the conversion. After PR-3a: `components/` is mostly elix-free (jGraduate-bound `PaintBox.ts` + `seColorPicker.ts` remain — they belong to PR-4).

**Architecture:** Per-component subagent dispatch via `superpowers:subagent-driven-development` with worktree isolation. 1 pilot (`seSpinInput` — most elix-tangled) sets the elix-replacement design pattern sequentially; then 3 parallel-batch conversions (`seMenu`, `seMenuItem`, `seDropdown`). After all 4 land, the main session deletes the 2 now-dead files, runs the full gate, and opens PR-3a. Each per-component agent gets the verbatim current source + both PR-1 reference component shapes (`seText.ts` + `seInput.ts`) + the 14-bullet conventions + validation gate inlined in its prompt — never referenced by path. Pre-dispatch 4-line self-check verbalized in chat per `feedback_subagent_code_specificity`. Post-dispatch gate re-verification by main session per `feedback_verify_subagent_gate_claims`.

**Tech Stack:** Lit 3.x, TypeScript 6.x (TC39 standard decorators + `accessor` keyword), Vite 7 + SWC for TC39-decorator transform (PR-1 substrate), ESLint v9 flat config, Vitest 4, Playwright 1.57 (chromium + firefox).

---

## Decisions locked (2026-05-24 planning session)

| # | Decision | Locked value | Rationale |
|---|---|---|---|
| 1 | Sub-PR split for #3 PR-3 | **3 sub-PRs (PR-3a / PR-3b / PR-3c) by strategic axis** | Each independently reviewable + gateable + revertable. PR-3 is shape-design-heavy (vs PR-2 which was mechanical). Smaller PRs reduce review burden + revert blast radius. |
| 2 | `<elix-dialog>` replacement (PR-3c scope; not used in PR-3a) | **Native HTML5 `<dialog>` element** | Baseline-supported in all modern browsers; API matches existing (`.showModal()` / `.close()` / `[open]` attr); zero new files; matches spec's "no new dep" philosophy. |
| 3 | `sePromptDialog` rename (PR-3b scope; not used in PR-3a) | **`seStatusDialog`** (tag: `<se-status-dialog>`) | Matches svgedit's `*Dialog` suffix convention. "Status" accurately captures the cancel-only display purpose (verified at `sePromptDialog.ts:46` — `this.dialog.choices = ['Cancel']`). |
| 4 | `storageDialog` in PR-3? | **Yes — add to PR-3c** | `storageDialog.html` uses `<elix-dialog>`; excluding it blocks the final `import 'elix/define/Dialog.js'` removal. Adding closes the elix-import goal within PR-3. |

**Source-of-truth for these decisions for downstream PRs:** this plan. Spec doc `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md` will get a "PR-3a SHIPPED" amendment block at ship time (matching the established PR-1 / PR-2 pattern in that file).

**PR-3 overall scope** (this plan covers only PR-3a; PR-3b + PR-3c get their own plan docs at execution time):

| Sub-PR | Conversions | Deletes | After-state |
|---|---|---|---|
| **PR-3a** (this plan) | `seMenu`, `seMenuItem`, `seDropdown`, `seSpinInput` (4) | `sePlainMenuButton.ts`, `sePlainBorderButton.ts` (2 dead-on-arrival) | `components/` mostly elix-free (PaintBox + seColorPicker remain for PR-4 jGraduate work) |
| **PR-3b** (future) | `SePlainAlertDialog`, `sePromptDialog` → `seStatusDialog` (2 + rename + 5 callsite updates) | — | Plain alert/status dialogs elix-free |
| **PR-3c** (future) | `svgSourceDialog`, `imagePropertiesDialog`, `editorPreferencesDialog`, `exportDialog`, `storageDialog` (5 with native `<dialog>`) | 3 vendored se-elix overrides + `import 'elix/define/Dialog.js'` line in `dialogs/index.ts` | ZERO elix imports across `src/` |

---

## File structure

### Files MODIFIED (4 per-component conversions)

| File | Current LOC | Target Lit LOC | Approx delta |
|---|---|---|---|
| `src/editor/components/seMenu.ts` | 125 | ~50-70 | −55 to −75 |
| `src/editor/components/seMenuItem.ts` | 132 | ~70-90 | −40 to −60 |
| `src/editor/components/seDropdown.ts` | 186 | ~80-110 | −75 to −105 |
| `src/editor/components/seSpinInput.ts` | 244 | ~100-130 | −115 to −145 |

Estimated cumulative net delta for conversions alone: **−285 to −385 LOC**.

### Files DELETED (2 dead-on-arrival)

| File | Current LOC | Why dead after PR-3a |
|---|---|---|
| `src/editor/components/sePlainMenuButton.ts` | 23 | Registers `<elix-menu-button>` for use BY `seMenu`'s template. When `seMenu` becomes self-contained Lit, no consumer remains. (Verified: `customElements.define('elix-menu-button', ElixMenuButton)` line 23 is the only registration; `seMenu.ts:27` is the only template consumer.) |
| `src/editor/components/sePlainBorderButton.ts` | 34 | Default-exported; composed via `sourcePartType: sePlainBorderButton` inside `sePlainMenuButton` (`sePlainMenuButton.ts:6` is the only import). Transitively dead. |

**Estimated cumulative net delete: −57 LOC.**

### Files NOT touched in PR-3a (deferred)

| File | Deferred to | Why |
|---|---|---|
| `src/editor/dialogs/se-elix/define/NumberSpinBox.ts` | PR-3c | Registers `<elix-number-spin-box>`. `exportDialog.html:51` still uses this tag in markup; deleting in PR-3a would break exportDialog until PR-3c lands. |
| `src/editor/dialogs/se-elix/src/base/NumberSpinBox.ts` | PR-3c | Base class for above. Transitively gated. |
| `src/editor/dialogs/se-elix/src/plain/PlainNumberSpinBox.ts` | PR-3c | Plain variant for above. Transitively gated. |
| `src/editor/components/PaintBox.ts` + `seColorPicker.ts` | PR-4 | Bound to jGraduate (not elix). Belongs in the jGraduate Lit-rewrite. |

### Files INSPECTED but unchanged (consumer-side verification only)

- `src/editor/panels/TopPanel.ts`, `BottomPanel.ts`, `LeftPanel.ts`, `LayersPanel.ts` — read by each per-component agent to extract external-API contract (attributes used + events listened for).
- `src/editor/Editor.ts`, `EditorStartup.ts` — same.
- `tests/e2e/*.spec.js` — grepped for `<se-menu>`, `<se-menu-item>`, `<se-dropdown>`, `<se-spin-input>` selectors per [[feedback_consumer_audit_grep_test_files]].
- `src/editor/extensions/**/*.html`, `src/editor/extensions/**/*.ts` — same.

### Files MAY-CHANGE (small mechanical edits possible)

- `CHANGELOG.md` — `[Unreleased]` section appended at Task 6 by main session.

---

## Shared dispatch packet — include VERBATIM in every per-component Agent prompt

The packet below is the **mandatory boilerplate** every per-component dispatch in Tasks 1-4 must include in full, with per-component fields substituted at the placeholders. This implements the spec's § "Per-agent dispatch packet — required contents" + § "PR-2 agent-team dispatch discipline".

> **Why inline?** Per `feedback_subagent_code_specificity`: agents will NOT reliably fetch reference files from disk. The prompt IS the source of truth — paste the references in.

### The packet template

````
You are converting a single elix-bound TypeScript custom-element to a Lit 3 LitElement.
This is task <TASK_NUM> of svgedit's PR-3a elix → Lit migration.

## Component to convert

**Absolute path:** <ABSOLUTE_FILE_PATH>

## Verbatim current source (lines <LINE_RANGE>)

<PASTE FULL CURRENT FILE CONTENT WITH LINE NUMBERS HERE>

## External-API contract — preserve verbatim

- **Custom element name:** <TAG_NAME> (do NOT change)
- **Attributes:** <LIST_FROM_observedAttributes>
- **Events fired:** <LIST_FROM_dispatchEvent_CALLS>
- **Consumers (grep result):** <LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP>
- **Class name:** <CURRENT_CLASS_NAME> (keep current name OR see "Class renames" below if applicable)

## Audit notes — preserve as-is in conversion

<PASTE LINE-POINTERS FROM AUDIT_2026-05-16.md FOR THIS COMPONENT — bugs to preserve, shadowDOM-piercing sites that resolve naturally, etc.>

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

## Lit-component conventions (locked PR-1; bullets 13-14 added PR-2 pilot)

1. Use `@customElement('se-name')` + `@property() accessor name = default` decorators (the `accessor` keyword is REQUIRED — TC39 standard decorators + Lit 3 only match the `ClassAccessorDecorator` overload, bare class fields produce TS1240/TS1270); never `static properties` map.
2. Open shadow DOM (Lit default); never override `createRenderRoot()`.
3. `static styles = css``` block; no external CSS files imported into components.
4. Use existing `--*-color` CSS custom-property names (`--main-bg-color`, `--icon-bg-color`, `--icon-bg-color-hover`, `--input-color`, `--orange-color`, `--global-se-spin-input-width`); do not rename theme variables.
5. i18n via `t()` at render time, never in setter; import from `../locale.js`.
6. `::part` for styling hooks ONLY; semantic names (`label`, `input`, `icon`, `button`).
7. `<slot>` for content composition (named slots when 2+; default slot when 1).
8. Events: `bubbles: true, composed: true` for events that need to escape shadow DOM (so panels listening at editor root receive them). Event handlers passed in templates MUST be declared as class-field arrows (`private _handler = (e: Event) => {...}`), NOT method form — `@typescript-eslint/unbound-method` flags the `@event=${this._handler}` method-reference pattern as a false positive even though Lit auto-binds `this` for it.
9. Drop `jamilih` import; use Lit's `html``` template literal.
10. Name: keep `se-*` prefix verbatim (zero consumer churn outside the component file).
11. File per component in `src/editor/components/` (or `src/editor/dialogs/` for the dialog components); no barrel files; export class + run `@customElement` decorator side-effect.
12. Test: trust existing e2e; add a focused unit-test contract only for components with non-trivial form-control or stateful semantics.
13. **`ifDefined` for optional attributes with empty-string defaults.** When an `@property() accessor` has an empty-string default (`= ''`) AND the corresponding HTML attribute is OPTIONAL on consumers, wrap the binding with `ifDefined(this.X || undefined)` in `render()` to avoid rendering `attr=""` on the DOM. Reference: `seInput.ts`'s `size=${ifDefined(this.size || undefined)}`.
14. **Kebab-case HTML attributes map via `@property({ attribute: 'kebab-case' })`.** For HTML attributes with kebab-case names (e.g., `img-height`), declare as `@property({ attribute: 'img-height' }) accessor imgHeight = ''`.

## Per-conversion approach

1. **Read the elix internals** the component composes (under `node_modules/elix/...`) to understand what markup + behavior the elix wrapper was providing.
2. **Design the Lit replacement that owns that markup directly** — the `seText.ts` / `seInput.ts` reference shapes show the patterns. Mimic; do not invent new shapes.
3. **Replace shadowDOM-piercing sites** by owning the previously-pierced markup internally — these resolve naturally once elix internals disappear.
4. **Preserve EVERY external-API attribute / event** listed in the External-API contract section verbatim. Zero callsite changes outside the component file.
5. **Preserve audit-flagged bugs** as-is unless the audit note explicitly says "fix this in PR-3a".
6. **PR-2 patterns** (apply when the original code uses these shapes):
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
   - **Full `disconnectedCallback` lifecycle** for components that attach listeners to external DOM nodes — pair every `addEventListener` on external nodes with a `removeEventListener` in `disconnectedCallback`. Factor `_attachXListeners()` / `_detachXListeners()` helpers; call detach from both `updated()` (when target changes) AND `disconnectedCallback()`.
   - **Touchend double-fire bug fix:** every `svgEditor.$click(elem, handler)` call site MUST swap to declarative `@click=${handler}` (the `$click` helper at `packages/svgcanvas/core/utilities.ts:1273` registers both `click` AND `touchend`; modern browsers synthesize `click` from touch taps natively, so handlers fire twice per tap).

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

- Do NOT change attribute names, event names, or the `customElements.define()` registration tag.
- Do NOT rename the class name unless this packet's "Class renames" line explicitly says so.
- Do NOT update consumer callsites (panels, dialogs, tests) — they MUST work unchanged.
- Do NOT touch any other file in the repo. Your scope is `<ABSOLUTE_FILE_PATH>` plus the CHANGELOG line (see "Out-of-file changes" below).
- Do NOT touch CHANGELOG yourself — the main session appends it at Task 6.
- Do NOT add new dependencies. Lit 3 is already in `package.json` from PR-1.
- Do NOT add new tests unless your component has non-trivial form-control or stateful semantics that the existing e2e doesn't cover. Trust the existing 250 e2e suite.

## Out-of-file changes — none

This task only modifies `<ABSOLUTE_FILE_PATH>`. CHANGELOG is appended later by the main session.

## When you're done

Report:
1. Final LOC count of the converted file
2. Validation-gate output (paste the 5 commands' results)
3. Any deviations from the reference shape with rationale
4. Anything you noticed but didn't fix (preserve-as-is items, latent issues)
````

### Per-component substitutions

The placeholders `<TASK_NUM>`, `<ABSOLUTE_FILE_PATH>`, `<LINE_RANGE>`, `<TAG_NAME>`, `<LIST_FROM_observedAttributes>`, `<LIST_FROM_dispatchEvent_CALLS>`, `<LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP>`, `<CURRENT_CLASS_NAME>`, and the per-component VERBATIM source and AUDIT NOTES are filled in by the main session in each per-component task below.

---

## Tasks

### Task 0: Branch + baseline gate

**Files:**
- Create: branch `feat/elix-to-lit-pr-3a` from master `12f6a70e`

- [ ] **Step 1: Verify master is at expected SHA**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" rev-parse master
```

Expected: `12f6a70e8...` (the PR #29 spec-amendment merge from 2026-05-23 LATE). If different, STOP and surface to user.

- [ ] **Step 2: Create branch**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull origin master
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feat/elix-to-lit-pr-3a
```

- [ ] **Step 3: Baseline gate from master HEAD**

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
- vitest: 640/640 passing (per todo's PR-2 ship summary)
- e2e: 250/250 passing both browsers

If any of these are different from expected, STOP and investigate before any conversions.

- [ ] **Step 4: Commit baseline-confirmation breadcrumb (optional, no code changes)**

Skip if baselines are clean — branch is ready for Task 1. The first real commit will land via Task 1's worktree merge.

---

### Task 1: PILOT — Convert seSpinInput (solo, sequential)

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seSpinInput.ts` (current 244 lines → target ~100-130)

**Why pilot:** Most elix-tangled of the 4 (uses `<elix-number-spin-box>` registered via vendored override; has 3 shadowDOM-piercing sites at lines 106, 108, 217-229; has a `connectedCallback` with 3 listeners that need full `disconnectedCallback` lifecycle pairing per PR-2 pattern #5; uses `svgEditor.$click` which needs the touchend double-fire swap per PR-2 cascade). Sets the elix-replacement design pattern for the parallel batch in Tasks 2-4.

**External-API contract** (extracted by main session BEFORE dispatch):
- Tag name: `se-spin-input`
- Attributes (from `observedAttributes` line 89): `value`, `label`, `src`, `size`, `min`, `max`, `step`, `title`
- Events fired: `change` (line 225, 233, 238 — all dispatch via `this.$event = new CustomEvent('change')` allocated once at line 79). Lit version dispatches `new Event('change', { bubbles: true, composed: true })` per convention bullet 8.
- Class name: `SESpinInput` (keep current name; spec § PR-2 class-renames list does not include this)
- ShadowDOM-piercing sites that resolve naturally: line 106 (size attribute → pierces elix-number-spin-box input), line 108 (sets style on inner input), lines 217-229 (connectedCallback iterating childNodes of pierced shadowRoot)

**Audit notes** (carried forward from todo #10 + spec table):
- ShadowDOM-piercing at 3 sites: all resolve when Lit version owns the input directly.
- `svgEditor.$click(this.$input, ...)` at line 235 → swap to declarative `@click=${this._onClick}` per PR-2 touchend cascade.
- The original code uses a single shared `CustomEvent` allocated once in constructor — Lit version dispatches a fresh `Event` per change call (per convention bullet 8).

- [ ] **Step 1: Pre-dispatch 4-line self-check (verbalize in chat BEFORE the Agent call)**

State out loud in the chat:
1. "I'm about to dispatch a subagent to convert `seSpinInput`."
2. "The verbatim code in the prompt is: `src/editor/components/seSpinInput.ts:1-244` (Read'd before dispatch via main-session Read tool)."
3. "The fix shape I'm passing is: the locked seText + seInput reference components — not a description."
4. "Validation: tsc + lint + vitest + e2e → expected 0 errors / 0 errors + 23 warnings / ≥ 640 / 250."

If step 2 is "I haven't Read the file yet" — STOP, Read, re-dispatch.

- [ ] **Step 2: Read current source via main-session Read tool**

```
Read C:/Users/jscha/source/repos/svgedit/src/editor/components/seSpinInput.ts
```

Bind the full content into context. Will paste into the agent prompt at Step 4.

- [ ] **Step 3: Grep consumers in main session**

Use Grep tool to enumerate every consumer of `<se-spin-input>` across `src/`, `tests/`, `packages/`:

```
Grep pattern: "se-spin-input|<se-spin-input"
path: C:/Users/jscha/source/repos/svgedit
output_mode: content
```

Record the file:line list. Paste into the agent prompt under "External-API contract → Consumers".

- [ ] **Step 4: Dispatch subagent via Agent tool with worktree isolation**

```
Agent(
  description: "Convert seSpinInput to Lit (PR-3a pilot)",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: <SHARED_DISPATCH_PACKET with placeholders filled:
    TASK_NUM = 1 (PILOT)
    ABSOLUTE_FILE_PATH = C:/Users/jscha/source/repos/svgedit/src/editor/components/seSpinInput.ts
    LINE_RANGE = 1-244
    TAG_NAME = se-spin-input
    LIST_FROM_observedAttributes = value, label, src, size, min, max, step, title
    LIST_FROM_dispatchEvent_CALLS = `change` event (currently single shared CustomEvent allocated once at line 79; Lit version: fresh `new Event('change', {bubbles:true, composed:true})` per dispatch per convention bullet 8)
    LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP = <PASTE FROM STEP 3>
    CURRENT_CLASS_NAME = SESpinInput
    VERBATIM SOURCE = <PASTE FROM STEP 2 with line numbers>
    AUDIT NOTES = (see above in Task 1 header)>
)
```

- [ ] **Step 5: Wait for subagent report; do NOT trust the gate-pass claim**

Per [[feedback_verify_subagent_gate_claims]], the subagent's "gate green" report is informational only. The main session re-runs the gate after merge in Step 7.

- [ ] **Step 6: Merge worktree back to branch**

```powershell
# The Agent tool's isolation:"worktree" returns the worktree path + branch name on completion.
# Merge that branch into feat/elix-to-lit-pr-3a:
git -C "C:/Users/jscha/source/repos/svgedit" checkout feat/elix-to-lit-pr-3a
git -C "C:/Users/jscha/source/repos/svgedit" merge --ff-only <agent-branch-name>
```

If merge has conflicts (shouldn't for a single-file conversion): inspect, resolve manually, re-stage, re-commit. If anything unexpected, STOP and surface to user.

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

- [ ] **Step 8: Commit (already happened at worktree merge; just verify)**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" log --oneline -3
```

Expected: top commit is the Lit conversion of seSpinInput; matches the subagent's reported diff.

- [ ] **Step 9: Spec-compliance reviewer subagent (parallel with code-quality reviewer)**

Per PR-2 dispatch protocol, after each conversion lands on branch, dispatch TWO reviewer subagents in parallel (single message with two Agent tool calls):

```
Agent #1 — spec compliance reviewer:
  description: "PR-3a Task 1 spec compliance review"
  subagent_type: "general-purpose"
  prompt: "Review the diff at <SHA> against this plan's § 'Per-conversion approach' bullets + the 14 convention bullets + the External-API contract for seSpinInput. Report deviations only — skip everything that looks right. <PASTE diff via git -C path show <SHA>>"

Agent #2 — code-quality reviewer:
  description: "PR-3a Task 1 code quality review"
  subagent_type: "general-purpose"
  prompt: "Code-quality review of <SHA>. Flag: unused vars, dead branches, type-safety regressions, swallowed exceptions, fragile shadowDOM assumptions, any new `as any` casts that don't have a clear rationale. <PASTE diff>"
```

- [ ] **Step 10: Apply reviewer findings (if any)**

If either reviewer surfaces a real issue (not bikeshed), main session fixes inline via Edit tool OR re-dispatches a fixup subagent. Re-run Step 7 after any fixup.

---

### Task 2: Convert seMenu (parallel batch — Tasks 2, 3, 4 dispatched in single message)

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seMenu.ts` (current 125 lines → target ~50-70)

**External-API contract:**
- Tag name: `se-menu`
- Attributes (from `observedAttributes` line 63): `label`, `src`
- Events fired: none (the elix-menu-button handles popup internally; seMenu is just a wrapper)
- Class name: `SeMenu` (keep)
- ShadowDOM-piercing site that resolves naturally: line 54 (`(this.$menu as any).shadowRoot.querySelector('#popupToggle').shadowRoot` — double pierce)
- Internal dep being eliminated: `import 'elix/define/MenuItem.js'` (line 1) + `import './sePlainMenuButton.js'` (line 2; `sePlainMenuButton` registers `<elix-menu-button>`). After conversion, seMenu owns its own popup button + menu surface directly using Lit; both imports disappear.

**Audit notes:**
- ShadowDOM-piercing site at line 54 resolves naturally.
- The `imgPath` initialization (line 55, `svgEditor.configObj.curConfig.imgPath`) is preserved — same pattern in Lit version (probably in `connectedCallback` since it depends on global `svgEditor` being initialized).
- The `attributeChangedCallback` `label`/`src` cases imperatively prepend image / text onto `this.$label` — Lit version renders declaratively in `render()` from `@property() accessor label / src` state.

**Design note for the agent:** The current seMenu wraps `<elix-menu-button>` which provides a click-to-open popup with `<slot>` for menu items. Lit replacement needs:
- A clickable button (the menu button face — currently shows label + image)
- A popup container that toggles open/closed on button click (use native `<button>` with `aria-expanded` + a `<div role="menu">` shown/hidden via `@state()` accessor + `classMap` directive)
- A `<slot>` inside the popup for `<se-menu-item>` children
- Click-outside-to-close listener (paired with full `disconnectedCallback` lifecycle per PR-2 pattern #5)
- Keyboard accessibility: Escape to close, arrow keys to navigate items (mimic elix-menu-button behavior)

- [ ] **Steps 1-3 for Tasks 2/3/4:** Read all 3 sources + grep all 3 sets of consumers FIRST, then dispatch all 3 agents in a single Agent message (parallel).

- [ ] **Step 4 (joint for Tasks 2/3/4): Dispatch 3 agents in parallel via single Agent message**

Each agent gets its own SHARED_DISPATCH_PACKET (filled per Task 2/3/4 below). Single message contains 3 Agent tool calls.

For Task 2 (seMenu):
```
Agent(
  description: "Convert seMenu to Lit",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: <SHARED_DISPATCH_PACKET with:
    TASK_NUM = 2
    ABSOLUTE_FILE_PATH = C:/Users/jscha/source/repos/svgedit/src/editor/components/seMenu.ts
    LINE_RANGE = 1-125
    TAG_NAME = se-menu
    LIST_FROM_observedAttributes = label, src
    LIST_FROM_dispatchEvent_CALLS = none (component is a popup wrapper; child <se-menu-item> elements fire their own clicks)
    LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP = <FROM JOINT GREP STEP>
    CURRENT_CLASS_NAME = SeMenu
    VERBATIM SOURCE = <PASTE>
    AUDIT NOTES = (from Task 2 header) + (design note for the agent inlined here)>
)
```

- [ ] **Step 5 (per Task): Wait for each subagent; do not trust gate claims.**

- [ ] **Step 6 (per Task): Sequential merge — merge each worktree as it completes.**

Order doesn't matter for the 3 parallel tasks (each touches a different file). Conflict expected: zero. If any conflict surfaces, investigate and surface to user.

- [ ] **Step 7 (after ALL 3 merges): Joint main-session gate re-verification.**

```powershell
cd "C:/Users/jscha/source/repos/svgedit"
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
```

Expected: same baseline as Task 0. If regression in any count, identify which of the 3 conversions caused it (binary-search by reverting one at a time if necessary), then re-dispatch.

- [ ] **Step 8: Spec + code-quality reviewers (parallel, per task)**

Dispatch 6 reviewer subagents — 2 per converted component, all in a single Agent message (3 components × 2 reviewers). Mirror Task 1 Step 9.

- [ ] **Step 9: Apply reviewer findings (if any)**

---

### Task 3: Convert seMenuItem (parallel batch member)

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seMenuItem.ts` (current 132 lines → target ~70-90)

**External-API contract:**
- Tag name: `se-menu-item`
- Attributes (from `observedAttributes` line 51): `label`, `src`
- Also reads (NOT in observedAttributes): `shortcut` attribute (line 70, 112), `id` attribute (line 122)
- Events fired: none directly (relies on host's native `click` event from being a button-like child of a menu); the `connectedCallback` keyboard-shortcut handler at lines 110-128 fires `document.getElementById(this.id)?.click()` — synthetic click on self
- Class name: `SeMenuItem` (keep)
- ShadowDOM-piercing site that resolves naturally: lines 31-32 — `(this.$menuitem as any).shadowRoot.querySelector('#checkmark')` (sets style display:none on elix's internal checkmark)

**Audit notes:**
- ShadowDOM-piercing site at lines 31-32 resolves naturally when seMenuItem owns its own markup (no checkmark to hide; just don't render one).
- The `connectedCallback` keyboard-shortcut handler must be paired with `disconnectedCallback` `removeEventListener('keydown', ...)` per PR-2 pattern #5 (currently leaky on disconnect).
- Use `normalizeShortcut(e)` helper if extracted as part of todo #10 work — but per Task 1's "Out of scope": do NOT refactor `Editor.js:setAll` / `seButton.js:234` / `seMenuItem.js:114` into a shared helper unless it's a 1-file change isolated to seMenuItem. Spec says "Preserve audit-flagged bugs as-is unless the audit note explicitly says fix in this PR" — todo #10 says "Extract single normalizeShortcut(e) helper" but that's cross-file; defer.

**Design note for the agent:** The current seMenuItem wraps `<elix-menu-item>` which provides menu-item semantics (checkmark, selection state) inside a parent `<elix-menu-button>`'s popup. Lit replacement:
- Render a clickable item (use `<button>` with `role="menuitem"` for a11y)
- Show optional `<img>` for `src` attribute, text from `t(label)`, and shortcut text in parens if `shortcut` attribute is set
- Keyboard-shortcut listener (currently `document.addEventListener('keydown', ...)` in `connectedCallback`) — keep the same shape but PAIR with `disconnectedCallback` `removeEventListener` per PR-2 pattern #5.

- [ ] Dispatched in parallel with Task 2 (see Task 2 Step 4). Substitutions for this dispatch:
  ```
  TASK_NUM = 3
  ABSOLUTE_FILE_PATH = C:/Users/jscha/source/repos/svgedit/src/editor/components/seMenuItem.ts
  LINE_RANGE = 1-132
  TAG_NAME = se-menu-item
  LIST_FROM_observedAttributes = label, src
  LIST_FROM_dispatchEvent_CALLS = none direct (native click bubbles; keyboard shortcut fires synthetic click on self at line 123)
  LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP = <FROM JOINT GREP>
  CURRENT_CLASS_NAME = SeMenuItem
  VERBATIM SOURCE = <PASTE>
  AUDIT NOTES = (from Task 3 header)
  ```

---

### Task 4: Convert seDropdown (parallel batch member)

**Files:**
- Modify: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seDropdown.ts` (current 186 lines → target ~80-110)

**External-API contract:**
- Tag name: `se-dropdown`
- Attributes (from `observedAttributes` line 63): `title`, `src`, `inputsize`, `value`
- Events fired: `change` event with `{detail: {value}}` (line 112-113); fires when the popup closes with a selected option
- Class name: `Dropdown` (CAMEL CASE INCONSISTENT — consider class rename to `SeDropdown` for consistency with PR-2 renames `ToolButton → SeButton`, `SEPalette → SePalette`, etc. **Decision: rename `Dropdown` → `SeDropdown`.** Class is only consumed internally; consumer-side uses `<se-dropdown>` markup or `document.createElement('se-dropdown')` (untyped). Verify with main-session grep before dispatch.)
- ShadowDOM-piercing site at line 104: `(this.$input.shadowRoot?.querySelector('[part~="input"]') as HTMLElement | null)?.style.setProperty('width', this[internal.state].inputsize)` — resolves when Lit version owns the dropdown's input area directly

**Audit notes:**
- Most elix-internals-heavy of PR-3a components: uses `defaultState`, `internal.template`, `internal.render`, `internal.setState`, `internal.firstRender`, `internal.state` symbols + the `ListComboBox` base class + `NumberSpinBox` vendored override as `inputPartType`.
- Bonus dropdown TODO at lines 168-185 (commented-out `stepZoom` function): preserve verbatim as a comment (TODO note); do NOT implement.

**Design note for the agent:** The current seDropdown extends elix `ListComboBox` (a combo box: a button + popup with a list of options, where you can either pick from the list or type a custom value via the `NumberSpinBox` input). Lit replacement:
- Use a native `<input>` for the typed value
- A `<button>` to toggle the popup
- A `<div role="listbox">` (shown/hidden via `@state` + `classMap`) containing `<slot>` for `<option>` children
- Click-on-option dispatches `change` event with `{detail: {value: option.value}}`
- Full `disconnectedCallback` lifecycle pairing per PR-2 pattern #5
- **Critical:** drop the `NumberSpinBox` as inputPartType wiring — Lit version uses plain `<input>`. Audit revealed seDropdown is consumed by ToolButton popup + zoom value selection. Confirm consumers via grep do NOT depend on number-spin-box semantics inside the dropdown (they shouldn't — but verify).

- [ ] Dispatched in parallel with Tasks 2 and 3 (see Task 2 Step 4). Substitutions:
  ```
  TASK_NUM = 4
  ABSOLUTE_FILE_PATH = C:/Users/jscha/source/repos/svgedit/src/editor/components/seDropdown.ts
  LINE_RANGE = 1-186
  TAG_NAME = se-dropdown
  LIST_FROM_observedAttributes = title, src, inputsize, value
  LIST_FROM_dispatchEvent_CALLS = `change` event with detail: {value: string} (currently at lines 112-113 inside [internal.render] when an option is selected on popup close; Lit version dispatches on declarative @click of option)
  LIST_OF_CONSUMERS_FROM_MAIN_SESSION_GREP = <FROM JOINT GREP>
  CURRENT_CLASS_NAME = Dropdown
  CLASS RENAME = Dropdown → SeDropdown (for PR-2-cascade consistency)
  VERBATIM SOURCE = <PASTE>
  AUDIT NOTES = (from Task 4 header)
  ```

---

### Task 5: Delete now-dead sePlainMenuButton.ts + sePlainBorderButton.ts

**Files:**
- Delete: `C:/Users/jscha/source/repos/svgedit/src/editor/components/sePlainMenuButton.ts` (23 lines)
- Delete: `C:/Users/jscha/source/repos/svgedit/src/editor/components/sePlainBorderButton.ts` (34 lines)

**Why delete (re-verify before action):** After Task 2's seMenu conversion, no Lit code references `<elix-menu-button>` anymore. `sePlainMenuButton.ts` is the sole registration of `<elix-menu-button>` (line 23: `customElements.define('elix-menu-button', ElixMenuButton)`). `sePlainBorderButton.ts` is only imported by `sePlainMenuButton.ts` (line 6). Both transitively dead.

- [ ] **Step 1: Verify no remaining references**

Main session greps both files' export names + the `<elix-menu-button>` tag across the WHOLE repo (excluding node_modules):

```
Grep pattern: "sePlainMenuButton|ElixMenuButton|sePlainBorderButton|SePlainBorderButton|elix-menu-button|<elix-menu-button"
path: C:/Users/jscha/source/repos/svgedit
output_mode: content
glob (or path filter): exclude node_modules + the 2 files being deleted
```

Expected result AFTER Task 2 has landed: ZERO matches (other than potentially the AUDIT_2026-05-16.md historical doc + CHANGELOG.md historical entries; those are OK).

If matches found in source code (anywhere outside docs/, AUDIT, CHANGELOG): STOP — Task 2's seMenu conversion didn't fully remove the elix-menu-button dependency. Surface to user.

- [ ] **Step 2: Delete the files**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/sePlainMenuButton.ts src/editor/components/sePlainBorderButton.ts
```

- [ ] **Step 3: Re-run full gate**

```powershell
cd "C:/Users/jscha/source/repos/svgedit"
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
```

Expected: same baseline (no count regressions; cumulative count of converted files reduced but gate-pass intact).

If tsc fails with TS2307 (cannot find module) somewhere: that's a missed consumer. Surface to user, do not patch in panic.

- [ ] **Step 4: Commit**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "refactor(#3 PR-3a): delete sePlainMenuButton + sePlainBorderButton (dead after seMenu Lit conversion)"
```

---

### Task 6: Final gate + CHANGELOG entry + dispatch packet verification

- [ ] **Step 1: Full main-session gate from final branch HEAD**

```powershell
cd "C:/Users/jscha/source/repos/svgedit"
git -C "C:/Users/jscha/source/repos/svgedit" status                # clean
git -C "C:/Users/jscha/source/repos/svgedit" log --oneline -8     # review commit history
npx tsc --build --force                                           # 0 errors
npm run lint                                                      # 0 errors, 23 warnings (baseline)
npx vitest run                                                    # ≥ 640/640 (NO new tests expected unless seDropdown contract test was added)
npx tsx scripts/run-e2e.ts                                        # 250/250 both browsers
```

Record cumulative LOC delta in chat:
```powershell
git -C "C:/Users/jscha/source/repos/svgedit" diff --stat master..feat/elix-to-lit-pr-3a -- src/editor/components/
```

- [ ] **Step 2: Manual cross-browser smoke (mandatory per spec § Test plan)**

Per spec § "Test plan per PR" → PR-3 gate includes "manual smoke: menu interactions, spin input keyboard, plain alert dialog, export dialog". PR-3a-specific smoke checklist:

```
Open editor at http://localhost:8000/src/editor/index.html (via `npm start`).

For each of these surfaces, click through:
- Top menu (File / Edit / ...) → opens, items clickable, Escape closes, click-outside closes
- Each menu item with a keyboard shortcut → shortcut fires the click
- Stroke width spin input (LeftPanel) → type a number, +/- arrows work, value propagates to selected element
- Zoom dropdown (BottomPanel) → click opens, select option, value changes
- Toolbar dropdowns (linecap/linejoin/shape style) → open, select, value propagates

Repeat for Chromium + Firefox.

If ANY surface regresses behavior vs master, STOP and surface to user.
```

- [ ] **Step 3: CHANGELOG.md entry append**

```powershell
# Edit CHANGELOG.md, append to the [Unreleased] section:
```

Entry text (paste verbatim under existing `## [Unreleased]` section):

```markdown
### Changed

- **#3 PR-3a — Convert 4 elix-bound user-facing components to Lit + delete 2 now-dead internal-only files.** Closes a strategic chunk of todo item #3 (PR-3 of the 5-PR elix → Lit migration). Sub-PR scope = `components/` becomes mostly elix-free; only `PaintBox.ts` + `seColorPicker.ts` remain (jGraduate-bound; PR-4 scope). Converted: `seMenu` (~125 → ~50-70 LOC, native `<button>` + popup `<div role="menu">`, click-outside-to-close + Escape handling), `seMenuItem` (~132 → ~70-90 LOC, native `<button role="menuitem">`, full `disconnectedCallback` lifecycle for keyboard-shortcut listener), `seDropdown` (~186 → ~80-110 LOC, native `<input>` + popup `<div role="listbox">`, class renamed `Dropdown` → `SeDropdown` per PR-2 cascade), `seSpinInput` (~244 → ~100-130 LOC, native `<input>` + `<button>` arrows, full `disconnectedCallback` lifecycle for change/keyup/click handlers, `svgEditor.$click` → declarative `@click=` per PR-2 touchend cascade). Deleted: `sePlainMenuButton.ts` (was registering `<elix-menu-button>`; sole consumer was `seMenu`'s template), `sePlainBorderButton.ts` (was composed only by `sePlainMenuButton`; transitively dead). Three vendored se-elix overrides under `src/editor/dialogs/se-elix/` REMAIN — they register `<elix-number-spin-box>` which `exportDialog.html` still uses; cleanup deferred to PR-3c. Three shadowDOM-piercing sites flagged in `docs/AUDIT_2026-05-16.md` resolved naturally (no longer needed once components own their internal markup directly). All gates green: tsc 0 / lint 0 errors + 23 warnings (jgraduate-deferred baseline) / vitest ≥ 640 / e2e 250 both browsers. Pattern cascade applied: full `disconnectedCallback` lifecycle (PR-2 pattern #5), `classMap` + `styleMap` directives (PR-2 patterns #2/#3), `ifDefined` for optional attrs (PR-2 pilot bullet #13), touchend double-fire bug fix at all `svgEditor.$click` sites (PR-2 cascade). External APIs preserved verbatim per spec; zero consumer-side changes.
```

- [ ] **Step 4: Commit CHANGELOG**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(changelog): #3 PR-3a — 4 elix-bound components Lit-converted + 2 dead files deleted"
```

---

### Task 7: Open PR-3a

- [ ] **Step 1: Push branch**

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/elix-to-lit-pr-3a
```

- [ ] **Step 2: Create PR via gh**

```powershell
gh pr create --title "feat(#3 PR-3a): 4 elix-bound components Lit-converted + 2 dead-on-arrival files deleted" --body @'
## Summary

First of 3 sub-PRs under todo item #3 PR-3 of the 5-PR elix → Lit migration. Converts 4 elix-internals-bound user-facing components in `src/editor/components/` to Lit; deletes 2 internal-only files made orphan by the conversion.

**Scope locked at planning** (2026-05-24 session, decisions recorded in `docs/superpowers/plans/2026-05-24-svgedit-elix-to-lit-pr-3a-plan.md` § "Decisions locked"):

- Sub-PR split: 3 sub-PRs (PR-3a / PR-3b / PR-3c) by strategic axis
- `<elix-dialog>` replacement (PR-3c): native HTML5 `<dialog>`
- `sePromptDialog` rename target (PR-3b): `seStatusDialog`
- `storageDialog` scope: included in PR-3c

## What this PR does

### Conversions (4)

- **seMenu** (~125 → ~50-70 LOC): native `<button>` + popup `<div role="menu">`, click-outside-to-close + Escape handling
- **seMenuItem** (~132 → ~70-90 LOC): native `<button role="menuitem">`, full `disconnectedCallback` lifecycle for keyboard-shortcut listener
- **seDropdown** (~186 → ~80-110 LOC): native `<input>` + popup `<div role="listbox">`, class renamed `Dropdown` → `SeDropdown` per PR-2 cascade
- **seSpinInput** (~244 → ~100-130 LOC): native `<input>` + `<button>` arrows, full `disconnectedCallback` lifecycle, `svgEditor.$click` → declarative `@click=` per PR-2 touchend cascade

### Deletes (2 dead-on-arrival)

- **sePlainMenuButton.ts** (23 LOC): sole registration of `<elix-menu-button>`; only consumer was `seMenu`s template
- **sePlainBorderButton.ts** (34 LOC): composed only by `sePlainMenuButton`; transitively dead

### Not in scope (deferred)

- 3 vendored se-elix overrides under `src/editor/dialogs/se-elix/` — register `<elix-number-spin-box>` which `exportDialog.html` still uses → PR-3c
- PaintBox + seColorPicker — bound to jGraduate (not elix) → PR-4

## Patterns applied

All from PR-2 lessons captured in `docs/superpowers/conventions/lit-component-conventions.md`:

- Full `disconnectedCallback` lifecycle for external-DOM-listener cleanup (pattern #5)
- `classMap` + `styleMap` directives for declarative class/style binding (patterns #2/#3)
- `ifDefined` directive for optional attributes with empty-string defaults (bullet #13)
- Touchend double-fire bug fix at all `svgEditor.$click` sites (cascade)
- TC39 standard decorators + `accessor` keyword + Lit 3 (substrate from PR-1)

## Test plan

- [x] tsc 0 errors
- [x] lint 0 errors + 23 warnings (jgraduate-deferred baseline)
- [x] vitest ≥ 640/640 passing
- [x] e2e 250/250 passing both browsers (chromium + firefox)
- [x] manual cross-browser smoke: top menu open/close/items clickable; spin-input type + arrows + value propagation; zoom dropdown + toolbar dropdowns; keyboard shortcut fires menu item click

## After this PR

- `components/` is mostly elix-free (PaintBox + seColorPicker remain for PR-4)
- 3 elix-imports remaining in src/: 1 in `dialogs/index.ts` + 2 in remaining vendored se-elix overrides
- PR-3b next: SePlainAlertDialog + sePromptDialog → seStatusDialog rename + 5 callsite updates

Closes todo item #3 PR-3a (PR-3 of 5).

🤖 Plan: docs/superpowers/plans/2026-05-24-svgedit-elix-to-lit-pr-3a-plan.md
🤖 Spec: docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md
'@
```

- [ ] **Step 3: Wait for required CI checks to pass**

Required checks (per ws-scrcpy-web / control-menu / svgedit Phase G lockdown):
- `build-and-test`
- `Analyze (javascript-typescript)`
- `Analyze (actions)`
- `Scorecard analysis`

If any check fails, investigate. Do NOT bypass.

- [ ] **Step 4: Squash-merge per CLAUDE.md PR-merge-method rule**

```powershell
gh pr merge --squash --delete-branch
```

Verify squash result is web-flow signed (`committer: GitHub | verified: true`).

- [ ] **Step 5: Update spec doc with PR-3a SHIPPED amendment (separate small PR)**

Spec amendments in this repo go through PRs (established pattern: PR #21 marked PR-1 LANDED; PR #29 captured PR-2 → PR-3 deferrals). Mirror that pattern.

```powershell
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull origin master
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b docs/pr-3a-shipped-spec-amendment
# Edit docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md § Status
# Append a "2026-05-NN (PR-3a LANDED):" bullet mirroring the existing
# "2026-05-22 (PR-1 LANDED):" / "2026-05-23 (PR-2 LANDED):" entries.
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(spec): mark #3 PR-3a LANDED in elix-to-lit Status block"
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin docs/pr-3a-shipped-spec-amendment
gh pr create --title "docs(spec): mark #3 PR-3a LANDED" --body "Pure docs update; mirrors PR #21 pattern for PR-1 landing."
# After checks green:
gh pr merge --squash --delete-branch
```

- [ ] **Step 6: Update todo_svgedit.md**

In `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`:
- Update the resume banner at top to point at PR-3b planning next (replace the "PR-3 planning" banner with "PR-3a SHIPPED + PR-3b planning queued")
- Move PR-3a entry to the Shipped section with full detail (mirror existing Shipped-section entry style for PR-1, PR-2)
- Update the active item count + "Last updated" timestamp

This is a memory write — **requires user codeword (`make it so` / `engage` / `do that thing`)** per CLAUDE.md before proceeding.

- [ ] **Step 7: Surface PR-3b planning option**

After PR-3a ships and todo is updated, surface to user: "PR-3a SHIPPED. Next queued: PR-3b planning (SePlainAlertDialog + sePromptDialog → seStatusDialog rename + 5 callsite updates). Open a `superpowers:writing-plans` session for PR-3b?"

---

## Self-review

### Spec coverage

PR-3a scope from the spec doc § "PR-3" original list (11 components) intersected with the user-facing-only subset:

| Spec PR-3 entry | Covered in PR-3a? | Where |
|---|---|---|
| seMenu | ✓ | Task 2 |
| seMenuItem | ✓ | Task 3 |
| seDropdown | ✓ | Task 4 |
| seSpinInput | ✓ | Task 1 (pilot) |
| sePlainMenuButton | ✓ (delete, not convert) | Task 5 |
| sePlainBorderButton | ✓ (delete, not convert) | Task 5 |
| SePlainAlertDialog | DEFERRED → PR-3b | — |
| exportDialog | DEFERRED → PR-3c | — |
| 3 vendored se-elix overrides | DEFERRED → PR-3c | (co-locate with exportDialog) |
| sePromptDialog | DEFERRED → PR-3b | — |
| svgSourceDialog | DEFERRED → PR-3c | — |
| imagePropertiesDialog | DEFERRED → PR-3c | — |
| editorPreferencesDialog | DEFERRED → PR-3c | — |

storageDialog (added scope) deferred → PR-3c. All accounted for.

### Placeholder scan

None of the "No Placeholders" anti-patterns are present:
- No "TBD" / "TODO" / "implement later"
- No "add appropriate error handling"
- No "write tests for the above" without code
- "Similar to Task N" → not used; each Task 2/3/4 has its full External-API contract + design note in-place (Task 2's "Step 4 joint dispatch" references Task 3 and Task 4 for parallel dispatch ONLY; per-task content is self-contained in each Task's header)
- All commands shown verbatim
- All shell paths absolute per CLAUDE.md Multi-Session cwd Discipline

### Type consistency

- `change` event semantics in Tasks 1, 4 are aligned: dispatch `new Event('change', { bubbles: true, composed: true })` per convention bullet 8.
- Class names: `SESpinInput` (Task 1, keep) / `SeMenu` (Task 2, keep) / `SeMenuItem` (Task 3, keep) / `Dropdown → SeDropdown` (Task 4, rename per PR-2 cascade). Consistent with PR-2 rename cascade (ToolButton → SeButton, SEPalette → SePalette, FlyingButton → SeFlyingButton, ExplorerButton → SeExplorerButton, SeCMenuLayerDialog → SeCMenuLayersDialog, SeCMenuDialog → SeCMenuCanvasDialog).
- Tag names preserved verbatim per convention bullet 10.

### Gate baselines

The plan uses lint baseline `0 errors + 23 warnings (jgraduate-deferred)` from PR #23 (Tier B JSDoc strip). The pre-Tier-B baseline of 145 warnings would be wrong — verify with the master HEAD's actual lint output at Task 0 baseline gate. (Note: if the baseline differs from 23, Task 0 Step 3's "Expected" section needs adjustment; this is part of the Task 0 verification, not a planning failure.)

### CHANGELOG entry

The CHANGELOG entry at Task 6 Step 3 is long but matches the prior PR-2 / PR-1 entries' density. Acceptable per [[feedback_workflow_bound_lessons_stay_in_protocol]] (CHANGELOG IS the workflow's canonical detail-keeper for ship summaries).

### Codeword gate

Task 7 Step 6 (memory write to todo_svgedit.md) is explicitly flagged as requiring user codeword. All other writes are in-project docs/code and allowed without codeword per CLAUDE.md.
