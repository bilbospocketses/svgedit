# svgedit elix → Lit Migration — Design

## Status

- **2026-05-21:** Designed via `superpowers:brainstorming` session.
- v1 scope locked: 5-PR phased migration, agent-team parallelization for PR-2 only.
- jGraduate disposition LOCKED: Lit-rewrite both jGraduate + jPicker.
- Implementation pending — next step: implementation plan via `superpowers:writing-plans` (PR-1 first; subsequent PRs get their own plans at execution time).
- **2026-05-21 (PR-1 execution):** Consumer audit surfaced two regressions in the original Reference shape A — `<se-zoom>` (BottomPanel) reads child `<se-text>` `value` attribute for zoom-option values, and `LayersPanel.html:5` `<se-text id="layersLabel">` depends on the current code's host-id-to-inner-div propagation for the bold-sizing CSS rule to match. Reference shape A corrected to add `@property() value` + scope the CSS via `:host([id="layersLabel"])`. Reference shape B (`seInput`) unchanged structurally; the `change` event-type shift (`CustomEvent('change')` → `Event('change', {bubbles, composed})`) was consumer-verified equivalent.
- **2026-05-22 (PR-1 LANDED):** PR [#20](https://github.com/bilbospocketses/svgedit/pull/20) squash-merged to master `fda81244` (web-flow signed, verified true, all 4 required checks green). Conventions doc landed at `docs/superpowers/conventions/lit-component-conventions.md`; reference components `seText.ts` + `seInput.ts` on master. **Gate-verification regression caught + fixed forward (commit `c3a7cc67`):** the PR-1 consumer audit caught `<se-text id="layersLabel">` (CSS) but missed `<se-text id="sidepanel_handle">` (LayersPanel.html:2), which `layers-panel.spec.js:20,46` targets via the Playwright selector `div#sidepanel_handle` — the original seText's `attributeChangedCallback case 'id'` did imperative id-mirroring onto the inner shadow div, and that mirror was lost in the Lit conversion. Fix: `<div id=${ifDefined(this.id || undefined)} ...>` to restore the mirror. **Audit refinement memorialized:** consumer audits MUST grep test files for selectors (`div#<id>` / `<tag>#<id>` / Playwright + vitest patterns), not just CSS + component HTML. Worth pasting verbatim into PR-2 / PR-3 / PR-4 / PR-5 dispatch packets. **Next gating item before PR-2:** todo #17 (JSDoc → TS types doc-pass, eliminate the 140 remaining lint warnings) — decided 2026-05-21 LATE to slot BEFORE PR-2 agent-team kickoff so parallel subagents see the right TS-native type-style example.
- **2026-05-23 (PR-2 LANDED):** PR [#28](https://github.com/bilbospocketses/svgedit/pull/28) squash-merged to master `ee392de8` (web-flow signed, verified true, all 5 required checks green). **10 of original 14 PR-2 components converted**; 4 deferred to PR-3 (see Amendment below). Execution via `superpowers:subagent-driven-development` in 4 batches — pilot (seListItem) → fan-out 5 (Batch 2) → fan-out 3 (Batch 3) → solo (Batch 4: cmenuDialog only); each implementer subagent followed by spec + code-quality reviewer subagents in parallel + per-task gate re-verification by main session per `feedback_verify_subagent_gate_claims`. Cumulative net LOC reduction: −705 across 10 source files + 2 deleted HTML files (`cmenuLayersDialog.html` + `cmenuDialog.html`, both inlined into their TS files). 5 patterns established (now in `lit-component-conventions.md` as bullets 15-21): `boolAttr` module-local converter constant; `classMap` directive over JS template interpolation; `styleMap` directive for imperative `style.*` mutations; `unsafeHTML` directive for dynamic-innerHTML scenarios with internal config data; full `disconnectedCallback` lifecycle for components attaching listeners to external DOM nodes. Touchend double-fire bug (latent: `svgEditor.$click` registered both `click` AND `touchend`, causing handlers to fire twice per touch tap) fixed at every `$click` site swapped to declarative `@click=`.

### Amendment (2026-05-23): 4 deferrals from PR-2 → PR-3

The original spec listed 14 components/dialogs for PR-2. Execution discovered 4 were actually elix-coupled and incompatible with the "pure custom elements without elix dependency" PR-2 discipline. They move to PR-3:

| Deferred component | Why discovered late | Disposition |
|---|---|---|
| `sePromptDialog` | Lives at `src/editor/dialogs/sePromptDialog.ts` (not `components/` as spec table said) AND internally instantiates `new SePlainAlertDialog()` (an elix-bound class queued for PR-3). Found at PR-2 plan-write time. | Defer to PR-3 alongside `SePlainAlertDialog`. Audit input #4 (the rename-during-conversion to match the dialog's actual purpose) shifts to PR-3. |
| `svgSourceDialog` | HTML template uses `<elix-dialog>` (registered via `import 'elix/define/Dialog.js'` in `src/editor/dialogs/index.ts`); code calls `$dialog.open()` / `.close()` (elix API). Found at PR-2 Batch 4 dispatch time. | Defer to PR-3. Conversion approach (native HTML5 `<dialog>` swap vs. Lit `<se-dialog>` primitive) decided in PR-3 scope. |
| `imagePropertiesDialog` | Same elix-dialog dependency. | Defer to PR-3. |
| `editorPreferencesDialog` | Same elix-dialog dependency. | Defer to PR-3. |

**Root cause of the late discovery:** `AUDIT_2026-05-16.md` enumerated the TS-side dependency graph for the original "16 pure custom elements" list but did NOT walk the HTML files for each component to catch elix-dialog usage in the templates. The PR-2 plan-write Step 4 inventory check (`grep -lE "from ['\"]elix" src/editor/components/*.ts src/editor/dialogs/*.ts`) only caught TS-side imports, missing HTML-side ones.

**Lesson for future migration audits:** for components with companion HTML files (via `vite-plugin-string` import or similar pattern), audit the HTML side too. The vite-plugin-string pattern was specifically the loophole.

**Updated counts:**
- PR-2 SHIPPED: 10 components/dialogs (1 pilot + 5 Batch 2 + 3 Batch 3 + 1 Batch 4)
- PR-3 ADDED: 4 components/dialogs (above) — increases PR-3 from "11 elix-bound" to **15 elix-bound + sePromptDialog**

The PR-2 + PR-3 tables below have been updated to reflect this; the rest of the spec doc (Goals, Per-conversion approach, Risks table, etc.) is unchanged — the amendment is a scope-rebalance, not a re-design.

## Context

svgedit todo item #3 — the largest remaining architectural item in the personal-fork roadmap (`memory/project_svgedit.md`). The scope directive (locked 2026-04-30) calls for **replacing elix with Lit, no React anywhere in the project, component-by-component migration rather than big-bang**.

**Inputs to this design:**

- **Audit:** `docs/AUDIT_2026-05-16.md` enumerates the migration surface — 12 elix-bound components, 5 shadowDOM-piercing sites flagged for redesign, 16 pure custom elements ready for direct LitElement conversion, jGraduate + jPicker (3,145 LOC) as the biggest single chunk. Plus `jamilih` to drop (Lit's `html\`\`` template literals replace its declarative-DOM role).
- **TS foundation:** Step 3 (JS → TS migration) shipped 2026-05-20 (master `1fdceac8`, tag `post-ts-migration`). All components already TypeScript; this migration is type-shape preserving for external API surface.
- **Audit-cleanup arc:** 12 of 12 audit-input traceability items closed via PRs #14/#15/#16 (2026-05-21). Audit input #4 (`sePromptDialog` misnamed) closes during this migration when sePromptDialog converts and is renamed to match its actual purpose (status-display modal, not prompt-with-input).
- **Subagent code specificity lesson:** `memory/feedback_subagent_code_specificity.md` mandates verbatim-source dispatch + pre-dispatch self-check + reference shape inlined in every per-component agent prompt. The two canonical incidents (tiny11options Path C plan + Core mode plan, May 2026) are the exact failure pattern this migration would hit without that discipline. The JS → TS migration applied this rule only partially — tolerable for mechanical type-annotation work; not tolerable for shape-inventing Lit conversion.

## Goals

1. **Drop `elix` dependency entirely** — zero `import 'elix/...'` lines, zero `<elix-*>` customElements, no remaining vendored se-elix overrides.
2. **Drop `jamilih` dependency entirely** — Lit's template literals replace it.
3. **Two reference Lit components land first** as the conventions-lock gate. Every subsequent per-component conversion mimics one of those two patterns.
4. **External API of every converted component preserved verbatim** — same attribute names, same events, same `customElements.define(...)` registration name. Zero callsite changes outside the component file (with one exception: sePromptDialog rename, scoped to PR-2 with all callsites updated in the same agent prompt).
5. **Boilerplate collapse** — each `se-*` component currently follows a ~200-line manual-attribute-dispatch pattern; Lit's `@property` decorators reduce this to ~30-50 LOC per component.
6. **jGraduate + jPicker decomposed into 8-12 sub-components + 2 thin parents** for testability and AI-edit-reliability (CLAUDE.md flags large single files as a refactoring smell).
7. **PR-2 agent-team dispatch follows `feedback_subagent_code_specificity` discipline** — verbatim source + reference inline + worktree isolation + post-dispatch gate re-verification by main session.

## Non-goals (v1)

- **No new color-picker / gradient-editor library.** jGraduate + jPicker get a full Lit rewrite, preserving the gradient editor (no off-the-shelf library does SVG gradient-stop editing, per the locked jgraduate disposition).
- **No FACE (form-associated custom elements).** svgedit has no `<form>` anywhere; FACE adds complexity without value. Reference component B (`seInput`) uses the simpler `value` property + `change` event pattern.
- **No CSS theming-variable rename.** Existing `--main-bg-color` / `--icon-bg-color` / `--icon-bg-color-hover` / `--input-color` / `--orange-color` / `--global-se-spin-input-width` are preserved verbatim during conversion. Renaming theme variables is a separate, deferred cleanup item.
- **No `@lit/context` dependency.** Props-down / events-up at thin-parent level is sufficient for the 1-level-deep coupling in jGraduate / jPicker.
- **No `@open-wc/testing-helpers` addition** unless jsdom shadow DOM proves flaky for the seInput contract test. Default: lean test coverage trusting existing e2e.
- **No bundle-size mandate.** Net reduction expected (elix is ~50+ KB minified) but not a gate.
- **No HMR / dev-server overhaul.** Vite 7's existing Lit support is sufficient.

## Architecture

### Substrate

| Decision | Value | Rationale |
|---|---|---|
| Lit version | 3.x latest stable | Current stable major; matches scope directive |
| Decorator style | Standard TC39 (`@customElement`, `@property`) | tsconfig already configured (`target: ES2025`, no `experimentalDecorators` flag) |
| Property declaration | `@property() accessor name = default` (the `accessor` keyword is REQUIRED with TC39 standard decorators + Lit 3); never `static properties` map | Lit 3's `@property()` decorator signature only matches a `ClassAccessorDecorator` overload — bare class fields produce TS1240/TS1270 errors. Discovered at PR-1 execution. |
| Shadow DOM scope | Open (Lit default) | Matches current convention in `seText.ts` and all se-* components |
| Styling | `static styles = css\`\`` | Lit canonical; component-scoped, no external CSS file imports |
| Theme variables | Preserve existing `--*-color` names | Zero theme-breaking |
| i18n | Call `t()` at `render()` time, not in setters | Avoids stale translations when locale changes |
| Templating | Lit's `html\`\`` template literals | Drops `jamilih` |
| Event composition | `bubbles: true, composed: true` for events that need to escape shadow DOM | Panels listening at editor root receive them |
| `::part` strategy | Styling hooks only; semantic names (`label`, `input`, `icon`, `button`) | External styling without piercing shadow DOM |
| Slot strategy | Named slots when 2+; default slot when 1; none when component owns all internal markup | Content composition without piercing |
| File organization | One component per file in `src/editor/components/` | Matches current; no barrel files |
| Component naming | Keep `se-*` prefix verbatim | Zero consumer churn outside the component file |
| Registration | `@customElement('se-name')` decorator side-effect at module load | Lit canonical |

### Reference component shape A — `seText.ts` (simple, ~25 LOC target)

Pattern for the 14 attribute-only components dispatched in PR-2.

```ts
import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { t } from '../locale.js'

@customElement('se-text')
export class SeText extends LitElement {
  // Host-id-scoped: the rule only applies to <se-text id="layersLabel">
  // (LayersPanel.html:5). Other instances (BottomPanel zoom options)
  // keep their default font.
  static styles = css`
    :host([id="layersLabel"]) div {
      font-size: 13px;
      line-height: normal;
      font-weight: 700;
    }
  `

  @property() accessor text = ''
  @property() accessor title = ''
  @property() accessor value = ''  // read by <se-zoom> from child <se-text> options (BottomPanel)

  render() {
    return html`
      <div title=${t(this.title)}>${t(this.text)}</div>
    `
  }
}
```

External API contract preserved from current `seText.ts`: `text` / `title` / `value` attributes; host's `id` attribute drives the optional `#layersLabel` bold-sizing via the `:host()` selector instead of the current pattern of propagating id onto the inner div. Dropped: `style` attribute observation (no consumer found) and the buggy `this.$div.value = newValue` (`@ts-expect-error: pre-existing null-misuse`) line. The two consumer surfaces this shape protects: BottomPanel's `<se-zoom>` reading `child.value` from its `<se-text>` children for zoom-option values; LayersPanel's `<se-text id="layersLabel">` triggering the bold-sizing CSS.

### Reference component shape B — `seInput.ts` (complex form-control, ~50 LOC target)

Pattern for form-control conversions (seInput in PR-1; seSpinInput, seSelect, seDropdown in PR-3).

```ts
import { LitElement, html, css, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { t } from '../locale.js'

@customElement('se-input')
export class SeInput extends LitElement {
  static styles = css`
    .wrap { height: 24px; margin: 5px 1px; padding: 3px; }
    input { background: var(--input-color); border-radius: 3px; height: 24px; }
  `
  @property() accessor value = ''
  @property() accessor label = ''
  @property() accessor title = ''
  @property() accessor src = ''
  @property({ type: Number }) accessor size = 0

  render() {
    return html`
      <div class="wrap" title=${t(this.title)}>
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

  // Class-field arrow auto-binds `this` and sidesteps the
  // @typescript-eslint/unbound-method false-positive on Lit's
  // `@event=${this._handler}` reference pattern (Lit binds it itself).
  private _onChange = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }
}
```

External API contract preserved from current `seInput.ts`: `value` / `label` / `title` / `src` / `size` attributes; `change` event fires on the host on user input or keyup. Internal `<elix-input>` is replaced with a direct `<input>` — `elix/define/Input.js` import dropped as a side-effect (killing 1 of the 12 elix-bound deps upfront; PR-3 becomes 11 elix-bound). The Lit version dispatches `new Event('change', {bubbles: true, composed: true})` where current code uses `new CustomEvent('change')` (non-bubbling, no detail). Verified consumer-equivalent at PR-1 execution: `TopPanel.ts`'s `attrChanger` attaches `addEventListener('change')` directly on the host and reads `e.target.value` / `e.target.getAttribute('data-attr')` — both work with both event shapes. No external consumer pierces `<elix-input>` from `<se-input>`'s shadowRoot (verified via grep at PR-1 execution).

### Lit conventions checklist

Captured in `docs/superpowers/conventions/lit-component-conventions.md` (PR-1 creates this). Twelve bullets that every per-component conversion follows:

1. Use `@customElement('se-name')` + `@property() accessor name = default` decorators (the `accessor` keyword is REQUIRED — TC39 standard decorators + Lit 3 only match the `ClassAccessorDecorator` overload, bare class fields produce TS1240/TS1270); never `static properties` map
2. Open shadow DOM (Lit default); never override `createRenderRoot()`
3. `static styles = css\`\`` block; no external CSS files imported into components
4. Use existing `--*-color` CSS custom-property names; do not rename theme variables
5. i18n via `t()` at render time, never in setter; import from `../locale.js`
6. `::part` for styling hooks ONLY; semantic names (`label`, `input`, `icon`, `button`)
7. `<slot>` for content composition (named slots when 2+; default slot when 1)
8. Events: `bubbles: true, composed: true` for events that need to escape shadow DOM; event handlers passed in templates declared as class-field arrows (`private _h = (e) => ...`), not method form (`@typescript-eslint/unbound-method` false-positive on `@event=${this._h}`)
9. Drop `jamilih` import; use Lit's `html\`\`` template literal
10. Name: keep `se-*` prefix verbatim (zero consumer churn outside the component file)
11. File per component in `src/editor/components/`; no barrel files; export class + run `@customElement` decorator side-effect
12. Test: trust existing e2e; add a focused unit-test contract only for `seInput` (form-control value/event semantics)

## Migration phases — 5 PRs

### PR-1: Lit infrastructure + 2 reference components (conventions lock)

**Scope:**

- `npm install lit@^3` — add Lit 3.x to `dependencies`
- Convert `src/editor/components/seText.ts` → LitElement (simple reference, ~30 LOC; ~100 LOC net reduction from current 132 LOC)
- Convert `src/editor/components/seInput.ts` → LitElement (complex reference, ~50 LOC; ~160 LOC net reduction from current 209 LOC). Drops `elix/define/Input.js` import.
- Add `docs/superpowers/conventions/lit-component-conventions.md` with the 12-bullet checklist
- Add `tests/unit/seInput.test.js` — form-control contract test (value/event semantics)
- CHANGELOG entry under `[Unreleased]`

**Verification gate:**

```
npx tsc --build --force  → 0 errors
npm run lint             → 0 errors, 145 warnings (baseline)
npx vitest run           → ≥ 638/638 passing (637 baseline + ≥1 seInput contract)
npx tsx scripts/run-e2e.ts → 250/250 passing both browsers
manual smoke: open editor; verify seText + seInput render and behave identically to master
```

Plus verify in PR-1 (one-time substrate checks):
- Vite HMR works with Lit decorators (edit-reload on seText)
- ESLint v9 + standard TC39 decorators compatible (lint stays at baseline)

**Net size:** ~150-200 LOC delta + 1 new doc file + 1 new test file.

**Unblocks:** PR-2 (agent-team copies seText / seInput patterns), PR-3 (sequential conversions reuse same patterns).

---

### PR-2: 10 pure custom elements/dialogs via subagent-driven-development (SHIPPED 2026-05-23, PR #28)

**Scope as shipped:** 10 components/dialogs from the audit's "16 pure" list, minus `seText` (done in PR-1), minus 4 elix-coupled deferrals (moved to PR-3 — see Amendment above and PR-3 table below).

| Component | File | Audit notes / preserves |
|---|---|---|
| `seListItem` (PILOT) | `src/editor/components/seListItem.ts` | — |
| `seSelect` | `src/editor/components/seSelect.ts` | — |
| `seButton` | `src/editor/components/seButton.ts` | `Editor.ts:setAll` shortcut key normalization (todo #10) preserved; class rename `ToolButton` → `SeButton` |
| `sePalette` | `src/editor/components/sePalette.ts` | `// Todo: Make into configuration item?` preserved (todo #10); class rename `SEPalette` → `SePalette` |
| `seList` | `src/editor/components/seList.ts` | — |
| `seFlyingButton` | `src/editor/components/seFlyingButton.ts` | Class rename `FlyingButton` → `SeFlyingButton`; latent touchend double-fire bug fixed (cascade applied to all subsequent `$click` sites in PR-2) |
| `seExplorerButton` | `src/editor/components/seExplorerButton.ts` | `:26` dead `XMLHttpRequest` preserve was already-gone by execution time (audit-flag predated TS migration); `:134` HTML syntax error preserve also already-gone; class rename `ExplorerButton` → `SeExplorerButton`; uses `unsafeHTML` for innerHTML-style shape-library generation |
| `seZoom` | `src/editor/components/seZoom.ts` | Inverted-guard `attributeChangedCallback` preserved via explicit override + `super.attributeChangedCallback()` call; press-and-hold setTimeout chain preserved verbatim (500ms initial / 50ms repeat) |
| `cmenuLayersDialog` *(dialog)* | `src/editor/dialogs/cmenuLayersDialog.ts` | Class rename `SeCMenuLayerDialog` → `SeCMenuLayersDialog` (missing `s`); HTML import via `vite-plugin-string` replaced by inline `static styles` + `render()`; `cmenuLayersDialog.html` DELETED; full `disconnectedCallback` lifecycle for workarea + `#sidepanels` listeners |
| `cmenuDialog` *(dialog)* | `src/editor/dialogs/cmenuDialog.ts` | `:204-205` `screen.*` viewport bug preserved verbatim with TODO comment; class rename `SeCMenuDialog` → `SeCMenuCanvasDialog` (matches `<se-cmenu_canvas-dialog>` tag); `cmenuDialog.html` DELETED |

**Dispatch model:** subagent-driven-development in 4 batches (1 pilot → 5 fan-out → 3 fan-out → 1 solo). Per-task implementer subagent + spec reviewer + code-quality reviewer (all sonnet model). Sequential merge with full gate re-verification at PR-2 branch HEAD after each. See "PR-2 agent-team dispatch discipline" section for the per-agent packet contents and main-session protocol.

**Verification gate (main session re-runs after each worktree merges back):**

```
npx tsc --build --force  → 0 errors
npm run lint             → 0 errors, 145 warnings (baseline)
npx vitest run           → ≥ 638/638 passing (no expected new tests; existing baseline)
npx tsx scripts/run-e2e.ts → 250/250 passing both browsers
manual smoke: click through each converted component (button, palette, zoom, dialogs)
```

**Net size as shipped:** 10 source files converted + 2 HTML files deleted; **−705 LOC** across both.

**Class renames as shipped:** `ToolButton` → `SeButton`; `SEPalette` → `SePalette`; `FlyingButton` → `SeFlyingButton`; `ExplorerButton` → `SeExplorerButton`; `SeCMenuLayerDialog` → `SeCMenuLayersDialog` (with missing `s`); `SeCMenuDialog` → `SeCMenuCanvasDialog`. All in-file casts updated; no consumer-side changes (all consumer-side references were already `as any`-typed or used `document.createElement('<tag>')` which doesn't depend on the class name).

**Risk callout — original was sePromptDialog rename**: deferred to PR-3 alongside sePromptDialog itself.

---

### PR-3: 15 elix-bound components + sePromptDialog + se-elix vendored overrides (sequential)

**Scope:** 11 elix-bound from the audit's "12" list (minus `seInput` done in PR-1) + 4 deferrals from PR-2 (see Amendment above) = **15 elix-bound + sePromptDialog**. Sequential because each needs an elix-replacement design.

**Original PR-3 list (11):**

- `seMenu.ts` (uses `<elix-menu-button>`; `:46` shadowDOM-piercing site resolves naturally once elix internals disappear)
- `seMenuItem.ts` (uses `<elix-menu-item>`; `:31-32` shadowDOM-piercing site resolves naturally)
- `seDropdown.ts`
- `seSpinInput.ts` (uses `<elix-number-spin-box>`; `:106 / :108 / :217-229` shadowDOM-piercing sites resolve naturally)
- `sePlainMenuButton.ts`
- `sePlainBorderButton.ts`
- `SePlainAlertDialog.ts` (in `src/editor/dialogs/`)
- `exportDialog.ts` (in `src/editor/dialogs/`; uses `<elix-number-spin-box>`)
- `src/editor/dialogs/se-elix/src/base/NumberSpinBox.js` (vendored override → delete)
- `src/editor/dialogs/se-elix/src/plain/PlainNumberSpinBox.js` (vendored override → delete)
- `src/editor/dialogs/se-elix/define/NumberSpinBox.js` (vendored override → delete)

**Deferred from PR-2 (4):**

- `sePromptDialog.ts` (in `src/editor/dialogs/`; internally instantiates `new SePlainAlertDialog()`) — **renamed during conversion** to match actual purpose (status-display modal, not prompt-with-input); closes audit input #4. New name candidates: `seStatusDialog`, `seInfoDialog`, `seStatusModal`. Decision at PR-3 dispatch time. ALL callsites updated in the same agent prompt.
- `svgSourceDialog.ts` (in `src/editor/dialogs/`; uses `<elix-dialog>` in HTML template) — `:100` `super.attributeChangedCallback()` latent throw preserved (todo #10)
- `imagePropertiesDialog.ts` (in `src/editor/dialogs/`; uses `<elix-dialog>` in HTML template) — `:174` same `super.attributeChangedCallback()` issue preserved
- `editorPreferencesDialog.ts` (in `src/editor/dialogs/`; uses `<elix-dialog>` in HTML template) — `:182` same `super.attributeChangedCallback()` issue preserved

**PR-3 sequencing consideration:** convert `SePlainAlertDialog` early in PR-3 so the sePromptDialog conversion (which internally instantiates it) can follow without `as any` casts on the constructor. The 3 elix-dialog-coupled dialogs can be converted independently — either swap `<elix-dialog>` for the native HTML5 `<dialog>` element (which has `.showModal()` / `.show()` / `.close()` matching the existing API) or build a Lit `<se-dialog>` primitive. The choice is a PR-3-time decision.

**Per-conversion approach:** Read the elix-using component + the elix internals it composes (`node_modules/elix/.../*.js`) + the panels that consume the component. Design the Lit replacement that owns the previously-elix-internal markup directly. The 5 audit-flagged shadowDOM-piercing sites all resolve here because the elix internals disappear — our Lit components own everything internally.

**Verification gate:** same as PR-2; manual smoke focused on menu interactions, spin input keyboard, plain alert dialog, export dialog.

**Net size:** ~11 files converted + 3 vendored overrides deleted.

**Open at PR-3 execution:** decide whether to split into multiple sub-PRs (one per elix component) or one big PR. Defer that call until PR-2 lands and the shape of the work is clearer.

---

### PR-4: jGraduate + jPicker decomposed Lit rewrite

**Scope:** 3,145 LOC (`jQuery.jGraduate.ts` 1,290 + `jQuery.jPicker.ts` 1,855) → ~1,500-2,500 LOC across 11-13 files. See "jGraduate + jPicker decomposition map" section.

**Dedicated brainstorming gate:** PR-4 deserves a separate `superpowers:brainstorming` session at execution time before any code lands — the state-management contracts between the 11 sub-components need to be locked precisely.

**Per-sub-component approach:** Some are parallel-dispatchable (`SeHexInput`, `SeRgbControls`, `SeHslControls`, `SeColorSwatches` — independent leaf primitives). Others have shared state (the HSV color in jPicker, gradient stops in jGraduate) and need sequential conversion with shared-state design.

**Verification gate:**

```
npx tsc --build --force  → 0 errors
npm run lint             → 0 errors, 145 warnings (baseline)
npx vitest run           → ≥ 640/640 passing (PR-4 adds gradient round-trip + color round-trip contract tests)
npx tsx scripts/run-e2e.ts → 250/250 passing both browsers
manual smoke: open fill picker; switch color; build gradient; save+reload
```

**Net size:** 11-13 new sub-component files + 2 thin parents replacing the current monoliths.

---

### PR-5: jamilih drop + final elix cleanup + ext-overview_window revival

**Scope:**

- Remove `jamilih` from `package.json` `dependencies` (no consumers left after PR-1 through PR-4)
- Remove `elix` from `package.json` `dependencies`
- Remove all `import 'elix/...'` lines (should be zero left after PR-3 + PR-4)
- Grep verification: `customElements.get('elix-*')` and `<elix-*>` should return zero matches across `src/` + `packages/` + `tests/`
- Revive `ext-overview_window`:
  - Perf fix (investigate at execution time)
  - Firefox bug fix at `lines 122-123` (`evt.originalEvent.layerX`)
  - Add `'overview_window'` back to `defaultExtensions` in `ConfigObj.ts`
- CHANGELOG sweep documenting completion of the 5-PR migration
- Spec doc final-state update (this file)

**Verification gate:**

```
npx tsc --build --force  → 0 errors
npm run lint             → 0 errors, ≤145 warnings (baseline or lower)
npx vitest run           → ≥ 640/640 passing (may add ext-overview_window tests)
npx tsx scripts/run-e2e.ts → ≥ 250/250 passing both browsers
bundle size: net reduction vs master `568d36ba` (elix drop expected ~50+ KB minified)
```

**Net size:** ~10-15 file changes (mostly deletions + dep manifest), plus ~250 LOC for ext-overview_window revival.

---

## PR-2 agent-team dispatch discipline

PR-2 is where `feedback_subagent_code_specificity` becomes load-bearing. The JS → TS migration applied this rule only partially — tolerable because TS conversion is mechanical type-annotation (low shape-invention risk). Lit conversion is shape-inventing — each agent designs the new component's template, property declarations, event semantics, and `::part` / slot surface. Without the discipline below, the canonical incidents from `feedback_subagent_code_specificity.md` (tiny11options Path C plan + Core mode plan, May 2026) replay almost line-for-line.

### Per-agent dispatch packet — required contents

Every Agent call for a per-component conversion MUST include, **inlined verbatim in the prompt** (not referenced by path):

1. **Component to convert:** absolute file path — `C:/Users/jscha/source/repos/svgedit/src/editor/components/<name>.ts`
2. **Verbatim current source** — Read'd by main session BEFORE dispatch, pasted into the prompt with line numbers. Never let the agent read the file itself; the prompt IS the source-of-truth.
3. **Both reference components inlined** — full code of locked PR-1 `seText.ts` (simple ref) + `seInput.ts` (complex ref), pasted as the shape to mimic.
4. **External-API contract** — every attribute the component currently exposes (from `observedAttributes`), every event it fires, every consumer (grep result for `<se-name>` across `src/` + `tests/`).
5. **Conventions checklist (12 bullets) inlined verbatim** — every bullet from `docs/superpowers/conventions/lit-component-conventions.md`. Do not cite by path; paste in.
6. **Audit notes** — line-pointers from `docs/AUDIT_2026-05-16.md` for this specific component (preserve-as-is items, known bugs that stay as-is).
7. **Validation gate command + expected counts:**
   ```
   npx tsc --build --force  → 0 errors
   npm run lint             → 0 errors, 145 warnings (baseline)
   npx vitest run           → ≥ 638/638 passing
   npx tsx scripts/run-e2e.ts → 250/250 passing both browsers
   ```
8. **Worktree path** — each agent gets `isolation: "worktree"` parameter so parallel writes don't clobber.

### Pre-dispatch 4-line self-check — verbalized inline in chat BEFORE each Agent call

The main session must say (visibly, in chat) before EACH Agent dispatch:

1. **"I'm about to dispatch a subagent to convert `<componentName>`."**
2. **"The verbatim code in the prompt is: `src/editor/components/<componentName>.ts:<line-range>` (Read'd before dispatch)."**
3. **"The fix shape I'm passing is: the locked seText + seInput reference components — not a description."**
4. **"Validation: tsc + lint + vitest + e2e → expected 0 / 0 errors+145 warnings / ≥ 638 / 250."**

If step 2 is "I haven't Read the file yet" — STOP, Read, re-dispatch.

### User intercept handles — any of these halts dispatch immediately

- "Did you Read the file before dispatching?"
- "What did you pass to the subagent?"
- "Where's the line range?"
- "Show me the fix-shape snippet you passed."
- "Are you passing specific code?"

Response is: **"You're right — halting. Reading `<file>` now, then re-dispatching with verbatim text."** No defense, no rationalization, no "but it's a small task."

### Worktree isolation — required for parallel dispatch

Per `feedback_parallel_agent_conflicts`: each per-component Agent dispatch uses `isolation: "worktree"`. Even if each agent's primary file is unique, shared callsites (panel HTML files that consume multiple se-* components, CHANGELOG, test files) would clobber under concurrent writes.

**Merge protocol:** worktrees merge back to the PR-2 branch sequentially as each agent completes. Main session runs the FULL gate after each merge — not the agent's report.

### Post-dispatch gate re-verification — never trust the agent

Per `feedback_verify_subagent_gate_claims`: every agent that reports "gate green" gets re-verified by main session running the gate itself in the merged PR-2 branch. The Task 12 incident from the JS → TS migration (agent reported "lint unchanged"; actual delta was +245 errors) is the canonical reason this discipline exists.

If post-merge gate fails: revert the failed worktree's diff, re-dispatch with the failure log inlined as part of the prompt's "what went wrong last time" context.

---

## jGraduate + jPicker decomposition map (PR-4)

### jPicker.ts (1,855 LOC) → 8 sub-components + 1 thin parent

| New file | Role | Approx LOC |
|---|---|---|
| `src/editor/components/jgraduate/seHsvSquare.ts` | 2D saturation × value picker square; pointer-drag → emits `hsv-changed` | ~120 |
| `src/editor/components/jgraduate/seHueStrip.ts` | Vertical hue selector strip; pointer-drag → emits `hue-changed` | ~80 |
| `src/editor/components/jgraduate/seAlphaStrip.ts` | Alpha (opacity) slider; emits `alpha-changed` | ~80 |
| `src/editor/components/jgraduate/seHexInput.ts` | Hex color text input with validation; emits `hex-changed` | ~70 |
| `src/editor/components/jgraduate/seRgbControls.ts` | R/G/B sliders + numeric inputs; emits `rgb-changed` | ~120 |
| `src/editor/components/jgraduate/seHslControls.ts` | H/S/L sliders + numeric inputs; emits `hsl-changed` | ~120 |
| `src/editor/components/jgraduate/seColorSwatches.ts` | Saved swatches grid; emits `swatch-selected` | ~100 |
| `src/editor/components/jgraduate/seActiveColorPreview.ts` | Current/previous color preview blocks | ~50 |
| `src/editor/components/jgraduate/seColorPicker.ts` (thin parent) | Composes all sub-components, owns canonical color state, props-down/events-up | ~150-200 |

### jGraduate.ts (1,290 LOC) → 3 sub-components + 1 thin parent

| New file | Role | Approx LOC |
|---|---|---|
| `src/editor/components/jgraduate/seGradientStopsBar.ts` | Stops visualization bar (linear & radial); pointer-events for add/remove stops | ~150 |
| `src/editor/components/jgraduate/seGradientStopMarker.ts` | Individual draggable stop marker; emits `stop-moved` / `stop-deleted` | ~80 |
| `src/editor/components/jgraduate/seGradientPreview.ts` | Live preview swatch reflecting current gradient | ~50 |
| `src/editor/components/jgraduate/seGradient.ts` (thin parent) | Composes sub-components + the `seColorPicker` above for per-stop color editing; owns gradient state | ~200-300 |

### State management

**Props-down / events-up** — the standard Lit pattern, no `@lit/context` dependency added. State lives at the thin parents (`seColorPicker` for color, `seGradient` for gradient). Sub-components receive read-only props and fire events to mutate state at the parent. 1-level-deep coupling makes this clean.

### Existing API preservation

Both `jQuery.jGraduate.ts` and `jQuery.jPicker.ts` expose jQuery-style entry points (`$.fn.jGraduate(...)`, `$.fn.jPicker(...)`) to current callers (likely 3-5 callsites in `BottomPanel.ts` and dialog files). The thin parents (`seGradient`, `seColorPicker`) replace those entry points with declarative HTML: `<se-gradient gradient="...">` / `<se-color-picker color="...">`. Caller-site updates land as a separate sweep within PR-4's scope.

### Existing helpers under `jgraduate/`

The current source has two existing helper files at `src/editor/components/jgraduate/`:

- `ColorValuePicker.ts` — disposition TBD at PR-4 brainstorm (may be replaced by the new Lit decomposition, may be retained as a non-Lit helper, may be merged into one of the new sub-components)
- `Slider.ts` — disposition TBD at PR-4 brainstorm (same options)

Both files inspected at PR-4 execution; decision logged in the PR-4 brainstorm spec.

### Decomposition gate

PR-4 deserves a **dedicated brainstorming session at execution time** before any code lands — the state-management contracts between the 11 sub-components need to be locked precisely, AND the disposition of the existing `ColorValuePicker.ts` + `Slider.ts` helpers needs resolution. This decomposition map is the high-level shape; the per-sub-component prop / event contracts get nailed down at PR-4's brainstorm.

---

## Risks (in priority order)

| # | Risk | Mitigation |
|---|---|---|
| 1 | Agent shape-invention during PR-2 (canonical-incident pattern from `feedback_subagent_code_specificity`) | Per-agent dispatch packet + 4-line pre-dispatch self-check + worktree isolation + post-dispatch gate re-verification |
| 2 | Each conversion drifts to "improvements" beyond scope (rename attrs, change events, refactor unrelated code) | CLAUDE.md "don't add features beyond what task requires" inlined in every agent prompt; external API contract listed verbatim; preserve audit-flagged bugs as-is |
| 3 | CSS custom-property name drift breaks theming | Conventions checklist locks preservation of `--*-color` names; spec calls this out explicitly |
| 4 | Vite HMR + Lit decorators compatibility | Verify in PR-1 — `npm start` + edit-reload sanity check on the two reference components |
| 5 | ESLint v9 + standard TC39 decorators compatibility | Verify in PR-1 — lint must stay at baseline 145 warnings |
| 6 | jGraduate / jPicker state-management complexity (PR-4) | Dedicated brainstorming session before PR-4 lands |
| 7 | sePromptDialog rename misses callsites | Single agent owns rename + all callsite updates; pre-dispatch grep result for old name pasted into prompt |
| 8 | Existing 250 e2e baseline regression | Hard stop on any PR that drops e2e count; per-PR gate |
| 9 | shadowDOM-in-jsdom for the seInput contract test | Use `@open-wc/testing-helpers` if jsdom shadow DOM proves flaky; otherwise plain DOM assertions |
| 10 | Bundle size: jamilih + elix drop savings vs Lit addition | Track bundle size in PR-1 baseline; verify net reduction by PR-5 |

## Test plan per PR

| PR | Gate |
|---|---|
| PR-1 | tsc 0 / lint 145 / vitest ≥638 (seInput contract test) / e2e 250 / manual smoke: open editor, verify seText + seInput render and behave identically to master |
| PR-2 | tsc 0 / lint 145 / vitest ≥638 / e2e 250 / manual smoke: open editor, click through each converted component (button, dropdown, palette, zoom, etc.) |
| PR-3 | tsc 0 / lint 145 / vitest ≥638 / e2e 250 / manual smoke: menu interactions, spin input keyboard, plain alert dialog, export dialog |
| PR-4 | tsc 0 / lint 145 / vitest ≥640 (jGraduate + jPicker contract tests) / e2e 250 / manual smoke: open fill picker, switch color, build gradient, save+reload |
| PR-5 | tsc 0 / lint ≤145 / vitest baseline / e2e ≥250 (potentially more if ext-overview_window adds tests) / bundle size check / grep confirms zero elix/jamilih references |

## Open questions (resolved at execution time, not now)

1. **Final inventory of "16 pure" vs "12 elix-bound"** — audit numbers from 2026-05-16 may be off by 1-2 against current `components/` + `dialogs/` state. PR-1 first step: enumerate actual.
2. **PaintBox and seColorPicker classification** — neither was explicitly in the audit's 16-pure or 12-elix-bound lists. Inspect at PR-1 execution and slot into the right phase.
3. **sePromptDialog new name** — candidates: `seStatusDialog`, `seInfoDialog`, `seStatusModal`. Pick at PR-2 dispatch time.
4. **PR-4 state-management contracts** — defer to dedicated PR-4 brainstorm.
5. **ext-overview_window's perf fix scope** — known: `evt.originalEvent.layerX` Firefox bug at lines 122-123. The "perf fix" is vaguer; investigate at PR-5 execution.
6. **Bundle target after migration** — measure baseline at PR-1, set net-reduction target after PR-5.
7. **PR-3 sub-PR split decision** — defer until PR-2 lands and the shape of the elix-bound work is clearer.
8. **Existing `jgraduate/ColorValuePicker.ts` + `jgraduate/Slider.ts` disposition** — replace, retain, or merge into new sub-components. Resolved at PR-4 brainstorm.
9. **Dialog file location** — 5 dialogs in PR-2 live at `src/editor/dialogs/`, not `src/editor/components/`. PR-2 dispatch packets must use the correct path per component (verified by `git ls-files` at PR-2 execution).

## Audit-input traceability

This migration closes audit input #4 (`sePromptDialog` misnamed) during PR-2 by renaming the component to match its actual purpose. Closed in spec doc `2026-05-20-svgedit-embed-api-design.md` as ✓-doc; closes in code here.

| Audit # | Closed by |
|---|---|
| 4 | PR-2 (sePromptDialog rename + all callsite updates in same agent prompt) |

## References

- **Audit:** `docs/AUDIT_2026-05-16.md` § "Pre-migration deletions" + § "Component migration deferred to #3"
- **TS migration:** `docs/superpowers/plans/2026-05-16-svgedit-ts-migration-plan.md` (closest analog; lessons captured in `memory/feedback_verify_subagent_gate_claims.md`)
- **Embed API design:** `docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md` (closed audit input #4 as ✓-doc; this migration closes it in code)
- **Subagent code specificity rule:** `memory/feedback_subagent_code_specificity.md` (canonical incidents; load-bearing for PR-2)
- **Parallel agent conflicts:** `memory/feedback_parallel_agent_conflicts.md` (worktree isolation)
- **Verify subagent gate claims:** `memory/feedback_verify_subagent_gate_claims.md` (post-dispatch gate re-verification)
- **Scope directive:** `memory/project_svgedit.md` § "Scope directive (locked in 2026-04-30)"
- **Active backlog:** `memory/todo_svgedit.md` item #3
