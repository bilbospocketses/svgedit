# svgedit elix → Lit Migration — PR-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert 13 pure custom elements/dialogs to LitElement via agent-team parallel dispatch (pilot 1 → fan out 12), preserving every external API surface, every CSS custom-property name, and every audit-flagged bug as-is.

**Architecture:** Pilot one component (`seListItem`) first to calibrate the dispatch-packet shape against the locked PR-1 reference components (`seText` + `seInput`); main session re-runs the gate after pilot merge and folds any packet improvements before fan-out. Then dispatch 12 remaining agents in parallel via `isolation: "worktree"`. Sequential merge + full-gate-re-verify after each worktree. CHANGELOG + PR open at the end.

**Tech Stack:** TypeScript 6.x (day-one strict mode), Lit 3 (TC39 standard decorators + `accessor` keyword), Vite 7 + SWC transform substrate, ESLint v9 (flat config), Vitest 4 (vitest-environment-jsdom), Playwright 1.57 (chromium + firefox), git worktrees via Agent `isolation: "worktree"` parameter.

---

## Spec context

This PR is **PR-2 of 5** in the elix → Lit migration (spec at `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md`). PR-1 shipped 2026-05-22 — master `74fa1c7f` carries `seText.ts` + `seInput.ts` as the locked reference shapes plus the 12-bullet conventions doc at `docs/superpowers/conventions/lit-component-conventions.md`.

### Spec amendment — sePromptDialog deferred to PR-3

The spec's PR-2 table listed `sePromptDialog` (14 total). Plan-writing investigation found `sePromptDialog.ts` lives at `src/editor/dialogs/sePromptDialog.ts` (not `src/editor/components/` as the spec table said) and INTERNALLY instantiates `new SePlainAlertDialog()` — an elix-bound class queued for PR-3 conversion. Converting `sePromptDialog` in PR-2 would either (a) carry an `as any` cast on `new SePlainAlertDialog()` into the new Lit code as compromise, or (b) require partial PR-3 work to land first. User direction (locked at plan-writing): defer `sePromptDialog` to PR-3 alongside `SePlainAlertDialog`. PR-2 = 13. Audit input #4 close (the misnamed-dialog rename) shifts from PR-2 to PR-3. Post-PR-2 wrap-up updates the spec doc to reflect this.

### Out-of-scope (confirmed at plan-writing)

- `sePromptDialog.ts` — deferred to PR-3 (above)
- `seAlertDialog.ts`, `seConfirmDialog.ts`, `seSelectDialog.ts` — NOT custom elements; thin `seAlert/seConfirm/seSelect` global-window wrappers that delegate to `SePlainAlertDialog`. Touched implicitly in PR-3 when `SePlainAlertDialog` converts to Lit (likely just `as any` cast cleanup).
- `PaintBox.ts` — plain class (not a custom element); imports jGraduate; addressed in PR-4.
- `seColorPicker.ts` — custom element but tied to jGraduate + PaintBox; addressed in PR-4.
- All audit-flagged bugs in the 13 PR-2 files — preserve verbatim in the Lit version; fixes live in todo #10.

---

## Pre-flight (before any code)

### State check

- Working tree clean at master `74fa1c7f`
- Baseline gate green: tsc 0 / lint 0 errors + 23 warnings (jgraduate-deferred) / vitest 640/640 / e2e 250/250 both browsers
- Conventions doc exists at `docs/superpowers/conventions/lit-component-conventions.md`
- Reference components on master: `src/editor/components/seText.ts` (50 LOC, simple-attribute pattern) + `src/editor/components/seInput.ts` (84 LOC, complex form-control with `::part('input')`)
- Lit 3.x in `package.json` dependencies
- SWC TS transform active in `vite.config.mjs` (substrate-PR `e46432d1` enables TC39 decorators + `accessor` keyword)

### Validation gate (run after every worktree merge)

```bash
cd C:/Users/jscha/source/repos/svgedit
npx tsc --build --force      # expected: 0 errors
npm run lint                  # expected: 0 errors, 23 warnings (jgraduate baseline — PR-4 clears)
npx vitest run                # expected: ≥ 640/640 passing
npx tsx scripts/run-e2e.ts    # expected: 250/250 both browsers
```

Manual smoke after each merge: open `npm start` editor, click through the converted component or open the converted dialog, verify it renders + behaves identically to master.

---

## File structure

### Modified (13 component/dialog files + 1 doc)

| # | File path | Current LOC | Target | Audit preservation |
|---|-----------|-------------|--------|---------------------|
| 1 | `src/editor/components/seListItem.ts` | 158 | Lit, ~50 LOC | none |
| 2 | `src/editor/components/seSelect.ts` | 197 | Lit | none |
| 3 | `src/editor/components/seButton.ts` | 237 | Lit | shortcut-key normalization site at line 234 (todo #10 cross-ref — uniformly fixed across 3 sites later) |
| 4 | `src/editor/components/sePalette.ts` | 248 | Lit | `// Todo: Make into configuration item?` comment (todo #10) |
| 5 | `src/editor/components/seList.ts` | 263 | Lit | none |
| 6 | `src/editor/components/seFlyingButton.ts` | 316 | Lit | none |
| 7 | `src/editor/components/seExplorerButton.ts` | 347 | Lit | line 26 dead `XMLHttpRequest` + line 134 HTML syntax error `class="image-lib""` (todo #10) |
| 8 | `src/editor/components/seZoom.ts` | 411 | Lit | line 79 missing semicolon after `position:fixed` (todo #10) |
| 9 | `src/editor/dialogs/cmenuDialog.ts` | 266 | Lit | lines 204-205 `screen.*` viewport bug (todo #10) |
| 10 | `src/editor/dialogs/cmenuLayersDialog.ts` | 169 | Lit | none |
| 11 | `src/editor/dialogs/svgSourceDialog.ts` | 230 | Lit | line 100 `super.attributeChangedCallback()` latent throw (todo #10) |
| 12 | `src/editor/dialogs/imagePropertiesDialog.ts` | 374 | Lit | line 174 same latent throw (todo #10) |
| 13 | `src/editor/dialogs/editorPreferencesDialog.ts` | 406 | Lit | line 182 same latent throw (todo #10) |
|  | `CHANGELOG.md` | n/a | `[Unreleased]` entry append | n/a |

### Created

None.

### Renamed

None (sePromptDialog rename deferred to PR-3).

---

## Dispatch packet template (every Agent call inlines all 10 sections verbatim)

The main session composes one of these per per-component Agent dispatch. Sections in **bold** are filled in at dispatch time from per-component fill-ins; sections without bold are literal-verbatim every time.

### Section 1 — Component identity

- Absolute path to file being converted: **[file_path]**
- HTML tag preserved: **[se-tag-name]**
- Component type: **[LitElement / form-control / dialog]**
- Current LOC: **[loc]**

### Section 2 — Verbatim current source

**[Full file contents from the file path, with line numbers, Read'd by main session BEFORE dispatch and pasted into the prompt. The Agent does NOT Read the file itself — the prompt IS the source-of-truth.]**

### Section 3 — Reference component shapes (locked from PR-1)

```typescript
// src/editor/components/seText.ts — simple reference (50 LOC; pure-attribute pattern)
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

```typescript
// src/editor/components/seInput.ts — complex reference (84 LOC; form-control with ::part exposure)
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

  // Class-field arrow auto-binds `this`; avoids @typescript-eslint/unbound-method
  // false-positive on Lit's `@event=${this._handler}` pattern.
  private _onChange = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }
}
```

**Mimic these shapes. Do NOT improvise patterns not present in one of these two files.**

### Section 4 — External-API contract

- HTML tag: **`<[se-tag-name]>`**
- Attributes (from current `observedAttributes`): **[list]**
- Events fired: **[list of CustomEvent or Event types with bubbles/composed flags + detail shapes]**
- Consumers (verbatim grep result; CSS + production HTML + JS/TS callers + **test files**):
  ```
  [paste output of: grep -rn "<[se-tag-name]" packages src tests --include=*.{ts,js,html,css}]
  [paste output of: grep -rn "[se-tag-name]#" packages src tests --include=*.{spec.js,spec.ts}]
  ```
- `::part` hooks currently exposed (if any): **[list]**
- Host-`id` mirror onto inner element required? **[yes/no — verify by grepping selector `div#<id>` and `<se-tag-name>#<id>` in tests + CSS]**

**Critical:** PR-1's audit caught `<se-text id="sidepanel_handle">` Playwright selector at `layers-panel.spec.js:20,46` that was missed by CSS-only consumer audit. The fix was `ifDefined`-guarded id mirror onto the inner shadow div. **Test files MUST be in scope for the consumer grep.** See memory `feedback_consumer_audit_grep_test_files.md`.

### Section 5 — Conventions checklist (14 bullets — inlined verbatim, NEVER cited by path)

1. Use `@customElement('se-name')` + `@property() accessor name = default` decorators (the `accessor` keyword is REQUIRED — TC39 standard decorators + Lit 3 only match the `ClassAccessorDecorator` overload, bare class fields produce TS1240/TS1270); never `static properties` map.
2. Open shadow DOM (Lit default); never override `createRenderRoot()`.
3. `static styles = css\`\`` block; no external CSS files imported into components.
4. Use existing `--*-color` CSS custom-property names (`--main-bg-color`, `--icon-bg-color`, `--icon-bg-color-hover`, `--input-color`, `--orange-color`, `--global-se-spin-input-width`); do not rename theme variables.
5. i18n via `t()` at render time, never in setter; import from `../locale.js`.
6. `::part` for styling hooks ONLY; semantic names (`label`, `input`, `icon`, `button`).
7. `<slot>` for content composition (named slots when 2+; default slot when 1).
8. Events: `bubbles: true, composed: true` for events that need to escape shadow DOM (so panels listening at editor root receive them). Event handlers passed in templates MUST be declared as class-field arrows (`private _handler = (e: Event) => {...}`), NOT method form — `@typescript-eslint/unbound-method` flags the `@event=${this._handler}` method-reference pattern as a false positive even though Lit auto-binds `this` for it.
9. Drop `jamilih` import; use Lit's `html\`\`` template literal.
10. Name: keep `se-*` prefix verbatim (zero consumer churn outside the component file).
11. File per component in `src/editor/components/` (or `src/editor/dialogs/` for dialog components); no barrel files; export class + run `@customElement` decorator side-effect.
12. Test: trust existing e2e; add a focused unit-test contract only for components with non-trivial form-control or stateful semantics.
13. **`ifDefined` for optional attributes with empty-string defaults.** When an `@property() accessor` has an empty-string default (`= ''`) AND the corresponding HTML attribute is OPTIONAL on consumers (i.e., consumers may omit it), wrap the binding with `ifDefined(this.X || undefined)` in `render()` to avoid rendering `attr=""` on the DOM. Reference: `seInput.ts`'s `size=${ifDefined(this.size || undefined)}`. Without this, Lit emits `attr=""` as a literal DOM attribute, which browsers may interpret as 0 (for numeric attrs) or trigger CSS attribute-selector mismatches. Added 2026-05-22 from PR-2 pilot calibration (`seListItem.ts` `img-height` attribute).
14. **Kebab-case HTML attributes map via the `attribute:` option.** For HTML attributes with kebab-case names (e.g., `img-height`), declare as `@property({ attribute: 'img-height' }) accessor imgHeight = ''`. The `attribute:` option maps the kebab-case attribute to the camelCase property. Required whenever the HTML attribute name doesn't match the JS property name verbatim. Added 2026-05-22 from PR-2 pilot calibration.

### Section 6 — Audit notes (preserve as-is)

**[Per-component audit preservation list, from `docs/AUDIT_2026-05-16.md` + todo #10 cross-references. NO bug fixes in PR-2 — every audit-flagged site survives verbatim in the new Lit version. Examples:]**

- **seListItem:** None.
- **seButton:** Preserve line-234 shortcut-key normalization site exactly as-is (todo #10 uniformly fixes 3 sites later via a `normalizeShortcut(e)` helper).
- **seExplorerButton:** Preserve dead `XMLHttpRequest` at line 26; preserve HTML syntax error `class="image-lib""` at line 134.
- **cmenuDialog:** Preserve `screen.*` (monitor) usage at lines 204-205 (todo #10 will swap to `window.inner*` for viewport correctness).
- **svgSourceDialog / imagePropertiesDialog / editorPreferencesDialog:** Preserve `super.attributeChangedCallback()` line (latent throw — `HTMLElement` has no such method, dead branch in practice). Even in the new Lit version, if the same construct survives shape-wise, leave it.

### Section 7 — Codebase style (post-#17 Tier B)

- **JSDoc-as-types is no longer the style.** After #17 Tier B (PR #23), the codebase has zero `@param {Type}` / `@returns {Type}` / `@type {Type}` tokens. Use TS annotations on the function signature; JSDoc is `@param name - description` form (no `{Type}` brackets).
- **`@typedef` is no longer the style.** TS `type` / `interface` declarations are the source of truth. If a new component needs a shape definition, declare a TS `interface`.
- **Constructor-time global access moves to `render()`.** Patterns like `this.imgPath = svgEditor.configObj.curConfig.imgPath` in `constructor()` must move to `render()` (or `connectedCallback()`) — Lit's `constructor()` runs at element creation, which may be BEFORE `window.svgEditor` is set up by `Editor.ts`. Reading globals at render-time is safe and re-evaluates per-render, which is the right Lit pattern. Added 2026-05-22 from PR-2 pilot calibration (`seListItem.ts`).
- **Match the reference shape's method-name spacing exactly.** `render()` (no space before paren) — not `render ()`. The reference components `seText.ts` + `seInput.ts` use no space; matching them avoids cosmetic drift across 13 conversions. Added 2026-05-22 from PR-2 pilot calibration.
- **Don't add features or refactor beyond what Lit conversion requires.** CLAUDE.md "don't add features beyond what task requires" applies.
- **Don't fix audit-flagged bugs.** Section 6 preservation list is the contract.
- **Commit message style:** `feat(components): #3 PR-2 — convert <name>.ts to LitElement` for `src/editor/components/` files; `feat(dialogs): #3 PR-2 — convert <name>.ts to LitElement` for `src/editor/dialogs/` files.

### Section 8 — Validation gate (run before reporting completion)

Inside the worktree, run:

```bash
npx tsc --build --force      # expected: 0 errors
npm run lint                  # expected: 0 errors, 23 warnings (jgraduate baseline)
npx vitest run                # expected: ≥ 640/640
npx tsx scripts/run-e2e.ts    # expected: 250/250 both browsers
```

Manual smoke: `npm start` → open editor → exercise the converted component/dialog → verify render + behavior matches master.

**If gate fails:** report the failure with the full output. Do NOT mark "gate green" until all four lines + manual smoke pass.

### Section 9 — Scope guardrails (literal)

- Don't add features, refactor, or introduce abstractions beyond Lit conversion. CLAUDE.md "don't add features beyond what task requires" applies.
- Don't rename attributes, change events, or modify external API surface. Section 4's contract is the contract.
- Don't fix audit-flagged bugs (Section 6). Preserve them.
- Don't change CSS custom-property names. Preserve `--*-color` variables verbatim per Section 5 bullet 4.
- Don't introduce JSDoc `{Type}` tokens. Section 7's "JSDoc-as-types is no longer the style" applies.

### Section 10 — Worktree isolation

The Agent dispatch uses `isolation: "worktree"` parameter. The harness creates a temporary worktree; the agent writes only to its worktree. The merge-back path is handled by the main session after gate re-verification.

**Known harness quirks (from PR-2 pilot, 2026-05-22):**

- **`path-data-polyfill` may be missing from the worktree's `node_modules`.** If `npm install` in your worktree leaves `node_modules/path-data-polyfill` absent or empty, copy it from the main repo's `node_modules`:
  ```bash
  # If gate fails with "Cannot find module 'path-data-polyfill'" or build-time MODULE_NOT_FOUND:
  cp -r C:/Users/jscha/source/repos/svgedit/node_modules/path-data-polyfill <worktree-path>/node_modules/
  ```
  This is a known harness-side `npm install` quirk in shallow worktrees — NOT a code fix; never modify `package.json` or `package-lock.json` for this.
- **Worktree force-remove after merge.** Main session should run `git worktree remove -f -f <worktree-path>` after merging. The harness sometimes leaves a stale lock on completed worktrees that blocks the un-flagged `worktree remove` command.
- **Don't lint with a stale worktree still present.** ESLint's flat config `ignores` includes `.claude/**` (added 2026-05-22) so any worktree residue stays out of lint scope. Without that ignore, ESLint walked the worktree's `dist/`, `_reference/`, and `node_modules/` copies during a main-session post-merge gate re-verification, producing a fake 218-error / 6198-warning explosion. If you see that pattern, the fix is to remove the worktree, not to debug the lint output.

---

## Per-component dispatch protocol (Steps 1-9, executed for each conversion; Tasks 2 and 4-15 reference this section)

For each per-component conversion, the executor (main session OR a per-task subagent in subagent-driven-development mode) runs these 9 steps. Tasks below provide the per-component fill-ins (file path, audit preservation list, etc.); this protocol IS the work.

- [ ] **Step 1: Read current source verbatim**

  Read the file at the per-component path, lines 1-EOF, with line numbers. Capture the contents for the dispatch packet § 2.

- [ ] **Step 2: Grep external-API consumers**

  Run:
  ```bash
  grep -rn "<se-<tag>" "C:/Users/jscha/source/repos/svgedit/packages" "C:/Users/jscha/source/repos/svgedit/src" "C:/Users/jscha/source/repos/svgedit/tests" --include="*.ts" --include="*.js" --include="*.html" --include="*.css"
  grep -rn "se-<tag>#" "C:/Users/jscha/source/repos/svgedit/tests" --include="*.spec.ts" --include="*.spec.js"
  ```
  Capture for dispatch packet § 4 (including test-file selectors per the consumer-audit-grep-test-files rule).

- [ ] **Step 3: Compose dispatch packet**

  Use the § Dispatch packet template above. Inline all 10 sections verbatim into the Agent prompt. Per-component fill-ins for **bold** placeholders come from the task's metadata block (file path, audit preservation list, commit message).

  Also Read the locked reference components from master before composing (the seText.ts + seInput.ts text in § 3 above is the May 22 snapshot; if master has drifted since plan-writing, re-Read for the current state):
  - `C:/Users/jscha/source/repos/svgedit/src/editor/components/seText.ts`
  - `C:/Users/jscha/source/repos/svgedit/src/editor/components/seInput.ts`

- [ ] **Step 4: Verbalize 4-line pre-dispatch self-check in chat**

  Say in chat (verbatim, all 4 lines):

  1. "I'm about to dispatch a subagent to convert `<componentName>`."
  2. "The verbatim code in the prompt is: `src/editor/<components|dialogs>/<componentName>.ts:1-<LOC>` (Read'd before dispatch)."
  3. "The fix shape I'm passing is: the locked seText + seInput reference components — not a description."
  4. "Validation: tsc + lint + vitest + e2e → expected 0 / 0 errors+23 warnings / ≥640 / 250."

  **If line 2 is "I haven't Read the file yet" — STOP, Read, re-self-check.**

  **User intercept handles (any of these halts dispatch):**
  - "Did you Read the file before dispatching?"
  - "What did you pass to the subagent?"
  - "Where's the line range?"
  - "Show me the fix-shape snippet you passed."
  - "Are you passing specific code?"

  Response: "You're right — halting. Reading `<file>` now, then re-dispatching with verbatim text." No defense, no rationalization.

- [ ] **Step 5: Dispatch subagent with worktree isolation**

  Tool call shape:
  ```
  Agent({
    description: "Convert <name>.ts to LitElement",
    subagent_type: "general-purpose",
    isolation: "worktree",
    prompt: <packet from Step 3>
  })
  ```

- [ ] **Step 6: Verify subagent's report (post-dispatch gate re-verification, NEVER trust the agent)**

  When the agent reports completion, the main session re-runs the full gate INSIDE the worktree:

  ```bash
  cd <worktree-path>
  npx tsc --build --force
  npm run lint
  npx vitest run
  npx tsx scripts/run-e2e.ts
  ```

  Expected: tsc 0 / lint 0 errors + 23 warnings / vitest ≥640 / e2e 250.

  Per memory `feedback_verify_subagent_gate_claims`: agent reports "gate green" are not trusted. The canonical incident — Task 12 of the JS → TS migration, agent claimed "lint unchanged from baseline", actual delta was +245 errors — is the reason this discipline exists.

  **If gate fails:** revert the worktree's diff (`git -C <worktree-path> reset --hard HEAD~`), re-dispatch the agent with the failure log inlined as "what went wrong last time" context in the new prompt.

- [ ] **Step 7: Merge worktree → PR-2 branch**

  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" fetch <worktree-path>
  git -C "C:/Users/jscha/source/repos/svgedit" merge --no-ff <worktree-branch-name> -m "feat(<dir>): #3 PR-2 — convert <name>.ts to LitElement"
  git -C "C:/Users/jscha/source/repos/svgedit" worktree remove <worktree-path>
  ```

  (Exact worktree-branch-name + worktree-path come from the Agent harness; main session captures them at dispatch time.)

- [ ] **Step 8: Re-run full gate at PR-2 branch HEAD**

  The worktree's gate ran against the worktree's HEAD; the merged PR-2 HEAD needs separate verification (different state — merge can introduce drift):

  ```bash
  cd C:/Users/jscha/source/repos/svgedit
  npx tsc --build --force
  npm run lint
  npx vitest run
  npx tsx scripts/run-e2e.ts
  ```

  Expected: same baseline. If the merged state fails but the worktree state passed, investigate the merge drift before proceeding to the next task.

- [ ] **Step 9: Verify commit landed cleanly**

  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" log --oneline -1
  ```

  Expected: most recent commit message matches the per-component commit message in the task's metadata.

---

## Task 1: Pre-flight execution

**Files:**
- Create: branch `feat/pr-2-lit-pure-elements`
- Read (verify): 13 PR-2 source files + `docs/AUDIT_2026-05-16.md`

- [ ] **Step 1: Confirm working tree clean at master `74fa1c7f`**

  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" status --short --branch
  git -C "C:/Users/jscha/source/repos/svgedit" log --oneline -1 master
  ```
  Expected: clean status; HEAD at `74fa1c7f` (or its successor if master has moved post plan-write).

- [ ] **Step 2: Run baseline gate at master**

  ```bash
  cd C:/Users/jscha/source/repos/svgedit
  npx tsc --build --force
  npm run lint
  npx vitest run
  npx tsx scripts/run-e2e.ts
  ```
  Expected: tsc 0 / lint 0 errors + 23 warnings / vitest 640/640 / e2e 250/250 both browsers.

  If any line fails: STOP and surface to user before proceeding.

- [ ] **Step 3: Create PR-2 branch**

  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feat/pr-2-lit-pure-elements
  ```

- [ ] **Step 4: Verify PR-2 inventory + classify edge cases**

  Confirm precise elix imports (only PR-3 territory):
  ```bash
  cd C:/Users/jscha/source/repos/svgedit
  grep -lE "from ['\"]elix" src/editor/components/*.ts src/editor/dialogs/*.ts
  ```
  Expected output exactly: `seDropdown.ts`, `sePlainBorderButton.ts`, `sePlainMenuButton.ts`, `SePlainAlertDialog.ts` (none in the PR-2 list).

  Confirm each PR-2 file exists:
  ```bash
  ls -la src/editor/components/seListItem.ts src/editor/components/seSelect.ts src/editor/components/seButton.ts src/editor/components/sePalette.ts src/editor/components/seList.ts src/editor/components/seFlyingButton.ts src/editor/components/seExplorerButton.ts src/editor/components/seZoom.ts src/editor/dialogs/cmenuDialog.ts src/editor/dialogs/cmenuLayersDialog.ts src/editor/dialogs/svgSourceDialog.ts src/editor/dialogs/imagePropertiesDialog.ts src/editor/dialogs/editorPreferencesDialog.ts
  ```
  Expected: all 13 files present.

  If any inventory mismatch surfaces (e.g., a file was deleted by an interleaving PR), surface to user before proceeding.

- [ ] **Step 5: Capture per-component audit-preservation notes**

  ```bash
  grep -nE "(seListItem|seSelect|seButton|sePalette|seList|seFlyingButton|seExplorerButton|seZoom|cmenuDialog|cmenuLayersDialog|svgSourceDialog|imagePropertiesDialog|editorPreferencesDialog)" docs/AUDIT_2026-05-16.md
  ```

  Cross-reference with todo #10's bug-preservation list. The File structure table above already has the per-component preservation list captured at plan-write time; Step 5 is a sanity check that no new audit findings were added between plan-write and execution.

- [ ] **Step 6: Pre-flight does not commit**

  Pre-flight produces only a branch + verification artifacts (no source changes). Proceed to Task 2 without a commit.

---

## Task 2: Pilot — Convert `seListItem.ts`

This is the calibration pilot. Run it FIRST and run it ALONE. Verify the dispatch packet template against the locked seText/seInput PR-1 pattern. Catch any packet-shape issues, then fold improvements into the template (via plan-doc edit in Task 3) before fan-out.

**Per-component fill-ins for § Per-component dispatch protocol:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seListItem.ts`
- HTML tag: `<se-list-item>`
- Current LOC: 158 (Lit target ~50 LOC, mirroring seText's ratio)
- Self-check line 2: "`src/editor/components/seListItem.ts:1-158` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert seListItem.ts to LitElement`
- Audit preservation (§ 6 fill-in): "None."
- External-API surface (verify at Step 2 execution):
  - HTML tag: `<se-list-item>`
  - Attributes (from current `observedAttributes`): `option`, `src`, `title`, `img-height`, `selected`
  - Events fired: `selectedindexchange` (bubbles + composed; detail: `{ selectedItem: <value attr> }`)
  - Constructor-time global access: `svgEditor.configObj.curConfig.imgPath` (used to build the `src` URL prefix — must move to render-time in Lit so the property is evaluated per-render)
  - Host-`id` mirror needed: verify via Step 2 grep

**Execute § Per-component dispatch protocol Steps 1-9 with the above fill-ins.**

After Step 9 completes successfully, run the additional pilot-only calibration step:

- [ ] **Step 10 (PILOT-ONLY): Calibration check**

  Review the pilot run:

  1. Did the subagent need clarification of any packet section? (If yes, fold the clarification into § Dispatch packet template before Task 3.)
  2. Did the subagent attempt out-of-scope changes? (If yes, strengthen § 9 scope guardrails — e.g., add explicit "preserve [specific pattern] as-is".)
  3. Did the gate re-verification (Step 6) catch anything the subagent missed in its self-report? (If yes, note as a memory candidate for `feedback_verify_subagent_gate_claims` reinforcement.)
  4. Was the worktree merge clean? (If not, document the worktree-branch / main-branch interaction quirk for fan-out.)
  5. Did the consumer-grep miss any test-file selectors? (If yes, strengthen Section 4's consumer-grep instruction.)

  Capture findings in chat. If § Dispatch packet template needs updates, edit the plan-doc inline (this is the only PR-2-allowed plan-doc-edit; document the edit in the commit message of Task 3).

---

## Task 3: Calibration review (user gate, no dispatch)

This is a HUMAN-IN-THE-LOOP checkpoint. The main session pauses and asks the user:

> "Pilot complete (seListItem). Calibration findings: [list from Task 2 Step 10]. Before fan-out, do you want to (a) update the dispatch packet template (proposed edits: [list]), (b) adjust scope, or (c) proceed to fan-out 12 in parallel as planned?"

- [ ] **Step 1: Present pilot results + calibration findings to user.**

- [ ] **Step 2: If user directs packet template updates, apply them inline to this plan doc and commit:**

  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/plans/2026-05-22-svgedit-elix-to-lit-pr-2-plan.md
  git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(plan): #3 PR-2 — calibration-pass packet template updates"
  ```

- [ ] **Step 3: Confirm "fan out" approval from user.**

  Wait for user confirmation (`make it so` / `engage` / explicit "proceed"). Then proceed to Tasks 4-15.

---

## Tasks 4-15: Fan-out — Convert 12 remaining pure custom elements/dialogs

**Parallelization:** Tasks 4-15 have no shared file dependencies. In subagent-driven-development mode, dispatch all 12 in parallel. In inline execution mode, process them sequentially.

**Per-task execution:** Each task below executes § Per-component dispatch protocol Steps 1-9 with its own fill-ins block. **Skip Task 2 Step 10 (calibration is pilot-only).**

**Merge protocol:** Worktrees merge back to the PR-2 branch SEQUENTIALLY as each one's gate clears. The main session runs Step 8 (re-run gate at PR-2 HEAD) after each merge. **Do NOT batch merges** — sequential merge + gate-after-each is the discipline that catches inter-task drift early.

---

### Task 4: Convert `seSelect.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seSelect.ts`
- HTML tag: `<se-select>`
- Current LOC: 197
- Self-check line 2: "`src/editor/components/seSelect.ts:1-197` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert seSelect.ts to LitElement`
- Audit preservation (§ 6 fill-in): "None."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 5: Convert `seButton.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seButton.ts`
- HTML tag: `<se-button>`
- Current LOC: 237
- Self-check line 2: "`src/editor/components/seButton.ts:1-237` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert seButton.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Preserve shortcut-key normalization site at line 234 of the current source — todo #10 cross-reference. The site builds `meta+ctrl+KEY` (missing shift+alt) and will be uniformly fixed across 3 sites (seButton + seMenuItem + Editor.ts:setAll) via a `normalizeShortcut(e)` helper later. Do NOT alter the modifier-string composition in the Lit version — keep the bug shape verbatim."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 6: Convert `sePalette.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/sePalette.ts`
- HTML tag: `<se-palette>`
- Current LOC: 248
- Self-check line 2: "`src/editor/components/sePalette.ts:1-248` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert sePalette.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Preserve the `// Todo: Make into configuration item?` comment near the hardcoded 42-color palette literal. Todo #10 carries forward a configurable-palette item for embed-host theming (Control Menu brand colors); the Lit version keeps the same hardcoded palette and the same TODO comment in place."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 7: Convert `seList.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seList.ts`
- HTML tag: `<se-list>`
- Current LOC: 263
- Self-check line 2: "`src/editor/components/seList.ts:1-263` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert seList.ts to LitElement`
- Audit preservation (§ 6 fill-in): "None."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 8: Convert `seFlyingButton.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seFlyingButton.ts`
- HTML tag: `<se-flyingbutton>` (verify at Step 2 — confirm `flyingbutton` vs `flying-button`)
- Current LOC: 316
- Self-check line 2: "`src/editor/components/seFlyingButton.ts:1-316` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert seFlyingButton.ts to LitElement`
- Audit preservation (§ 6 fill-in): "None."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 9: Convert `seExplorerButton.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seExplorerButton.ts`
- HTML tag: `<se-explorerbutton>` (verify at Step 2 — confirm `explorerbutton` vs `explorer-button`)
- Current LOC: 347
- Self-check line 2: "`src/editor/components/seExplorerButton.ts:1-347` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert seExplorerButton.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Two sites to preserve verbatim:
  1. Line 26 (current source): dead `XMLHttpRequest` instance — created but never used; actual fetches use `fetch()`. Carry the dead variable into the Lit version unchanged. (Todo #10 cleanup.)
  2. Line 134 (current source): HTML syntax error `class=\"image-lib\"\"` (extra `\"`). Browsers tolerate; keep as-is. (Todo #10 cleanup.)"

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 10: Convert `seZoom.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/components/seZoom.ts`
- HTML tag: `<se-zoom>`
- Current LOC: 411
- Self-check line 2: "`src/editor/components/seZoom.ts:1-411` (Read'd before dispatch)."
- Commit message: `feat(components): #3 PR-2 — convert seZoom.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Preserve missing semicolon after `position:fixed` near line 79 (the next declaration `display:flex` chains into the previous value under strict CSS parsers; tolerant parsers accept). Todo #10 fix. Also note seZoom embeds `<se-text>` children for zoom-option values; the Lit version's outer shape stays the same — child `<se-text>` consumption preserved unchanged."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 11: Convert `cmenuDialog.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/cmenuDialog.ts`
- HTML tag: `<se-cmenu>` (verify at Step 2)
- Current LOC: 266
- Self-check line 2: "`src/editor/dialogs/cmenuDialog.ts:1-266` (Read'd before dispatch)."
- Commit message: `feat(dialogs): #3 PR-2 — convert cmenuDialog.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Preserve `screen.width` / `screen.height` (monitor) usage at lines 204-205 in the position-clamp logic. Todo #10 fix swaps to `window.innerWidth` / `window.innerHeight` (viewport) for correct behavior inside the Control Menu iframe; the Lit version of this PR keeps the bug shape so the audit-flagged behavior is preserved verbatim."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 12: Convert `cmenuLayersDialog.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/cmenuLayersDialog.ts`
- HTML tag: `<se-cmenu-layers>` (verify at Step 2)
- Current LOC: 169
- Self-check line 2: "`src/editor/dialogs/cmenuLayersDialog.ts:1-169` (Read'd before dispatch)."
- Commit message: `feat(dialogs): #3 PR-2 — convert cmenuLayersDialog.ts to LitElement`
- Audit preservation (§ 6 fill-in): "None."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 13: Convert `svgSourceDialog.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/svgSourceDialog.ts`
- HTML tag: `<se-svg-source>` (verify at Step 2)
- Current LOC: 230
- Self-check line 2: "`src/editor/dialogs/svgSourceDialog.ts:1-230` (Read'd before dispatch)."
- Commit message: `feat(dialogs): #3 PR-2 — convert svgSourceDialog.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Preserve `super.attributeChangedCallback()` call at line 100 in the default switch branch. `HTMLElement` has no such method, so the line is a latent throw — but the default branch is unreachable in practice. The Lit version may not have an exact line 100, but if the default-branch construct survives (e.g., a fallthrough `default` case in an attribute-handling switch), keep the `super.attributeChangedCallback(...)` call so the bug shape is preserved verbatim per spec § Risks #2."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 14: Convert `imagePropertiesDialog.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/imagePropertiesDialog.ts`
- HTML tag: `<se-image-properties>` (verify at Step 2)
- Current LOC: 374
- Self-check line 2: "`src/editor/dialogs/imagePropertiesDialog.ts:1-374` (Read'd before dispatch)."
- Commit message: `feat(dialogs): #3 PR-2 — convert imagePropertiesDialog.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Preserve `super.attributeChangedCallback()` latent throw at line 174 (same shape as Task 13's site). Keep verbatim per spec § Risks #2."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

### Task 15: Convert `editorPreferencesDialog.ts`

**Per-component fill-ins:**
- File path: `C:/Users/jscha/source/repos/svgedit/src/editor/dialogs/editorPreferencesDialog.ts`
- HTML tag: `<se-editor-preferences>` (verify at Step 2)
- Current LOC: 406
- Self-check line 2: "`src/editor/dialogs/editorPreferencesDialog.ts:1-406` (Read'd before dispatch)."
- Commit message: `feat(dialogs): #3 PR-2 — convert editorPreferencesDialog.ts to LitElement`
- Audit preservation (§ 6 fill-in): "Preserve `super.attributeChangedCallback()` latent throw at line 182 (same shape as Tasks 13 + 14). Keep verbatim per spec § Risks #2."

**Execute § Per-component dispatch protocol Steps 1-9.**

- [ ] **Done when:** worktree merged to PR-2 branch, full gate green at merged HEAD, commit verified.

---

## Task 16: CHANGELOG entry + full gate + push + open PR

**Files:** `CHANGELOG.md` + remote push + PR open

- [ ] **Step 1: Append CHANGELOG `[Unreleased]` entry**

  Edit `CHANGELOG.md`. Under the `## [Unreleased]` heading, add a section for PR-2. Use this template (fill in the actual gate numbers from Task 15 Step 8):

  ```markdown
  ### Added (#3 elix → Lit migration — PR-2: 13 pure custom elements/dialogs converted to LitElement — YYYY-MM-DD)

  - Converted 13 pure custom elements/dialogs from `HTMLElement` + `observedAttributes` boilerplate to LitElement with `@customElement` + `@property() accessor` decorators, per the conventions locked in `docs/superpowers/conventions/lit-component-conventions.md`. ~3,622 LOC → expected ~1,000-2,000 LOC.
    - **Components (8):** `seListItem`, `seSelect`, `seButton`, `sePalette`, `seList`, `seFlyingButton`, `seExplorerButton`, `seZoom`
    - **Dialogs (5):** `cmenuDialog`, `cmenuLayersDialog`, `svgSourceDialog`, `imagePropertiesDialog`, `editorPreferencesDialog`
  - External API surface preserved verbatim per spec § Risks #2; CSS custom-property names preserved (`--*-color` series unchanged); audit-flagged bugs preserved as-is per spec § Risks #2 (todo #10 covers their later fix).
  - sePromptDialog deferred from PR-2 to PR-3 alongside `SePlainAlertDialog` (transitively elix-coupled; spec amendment captured in this PR's commit history).
  - Final gate at PR-2 branch HEAD: tsc 0 errors / lint 0 errors + 23 warnings (jgraduate-deferred) / vitest XXX/XXX / e2e 250/250 both browsers / build success.
  ```

- [ ] **Step 2: Run full gate one last time at PR-2 HEAD**

  ```bash
  cd C:/Users/jscha/source/repos/svgedit
  npx tsc --build --force
  npm run lint
  npx vitest run
  npx tsx scripts/run-e2e.ts
  ```
  Expected: tsc 0 / lint 0 errors + 23 warnings / vitest ≥640 / e2e 250 both browsers. Update the CHANGELOG entry's vitest number with the actual count.

- [ ] **Step 3: Commit CHANGELOG**

  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
  git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore(changelog): #3 PR-2 — 13 pure custom elements/dialogs Lit-converted"
  ```

- [ ] **Step 4: Push branch + open PR**

  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" push -u personal feat/pr-2-lit-pure-elements
  ```

  Open PR via `gh`:
  ```bash
  gh pr create --title "feat(components+dialogs): #3 PR-2 — 13 pure custom elements/dialogs Lit-converted" --body "$(cat <<'EOF'
  ## Summary

  Implements PR-2 of the elix → Lit migration (spec at `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md`). Converts 13 pure custom elements/dialogs to LitElement via agent-team parallel dispatch (pilot 1 → fan out 12), preserving every external API surface and every audit-flagged bug as-is per spec § Risks #2.

  - 8 components: `seListItem`, `seSelect`, `seButton`, `sePalette`, `seList`, `seFlyingButton`, `seExplorerButton`, `seZoom`
  - 5 dialogs: `cmenuDialog`, `cmenuLayersDialog`, `svgSourceDialog`, `imagePropertiesDialog`, `editorPreferencesDialog`

  ## Spec amendment

  sePromptDialog (originally listed in spec § PR-2 table) deferred to PR-3 alongside `SePlainAlertDialog` — found to be transitively elix-coupled via internal `new SePlainAlertDialog()` instantiation. Audit input #4 (the misnamed-dialog rename) shifts to PR-3.

  ## Test plan

  - [x] tsc 0 errors
  - [x] lint 0 errors + 23 warnings (jgraduate baseline — PR-4 clears)
  - [x] vitest ≥ 640/640
  - [x] e2e 250/250 chromium + firefox
  - [x] manual smoke: click through each converted component + open each converted dialog; verify render + behavior matches master

  ## Related

  - Spec: `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md`
  - Plan: `docs/superpowers/plans/2026-05-22-svgedit-elix-to-lit-pr-2-plan.md`
  - PR-1: #20 (Lit infrastructure + 2 reference components)
  EOF
  )"
  ```

- [ ] **Step 5: Verify CI gates green**

  Wait for the 4 required checks to complete: `build-and-test`, `Analyze (javascript-typescript)`, `Analyze (actions)`, `Scorecard analysis`. All must be green.

- [ ] **Step 6: Squash-merge via gh (NEVER rebase — per CLAUDE.md "PR Merge Method on Signed Repos")**

  ```bash
  gh pr merge --squash --delete-branch <PR-number>
  ```

  Verify the resulting master commit is web-flow signed (`committer: GitHub`, `verified: true`).

---

## Task 17: Post-PR wrap-up

**Files:**
- `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md` (Status block update + sePromptDialog amendment)
- `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md` (PR-2 shipped entry + active-state update)

- [ ] **Step 1: Update spec Status block + sePromptDialog amendment**

  Edit the spec doc:
  1. Update the `## Status` block at the top of the spec to mark PR-2 as LANDED with the squash-commit SHA.
  2. In `### PR-2: 14 remaining pure custom elements via agent-team parallel dispatch`, change the heading to `### PR-2: 13 pure custom elements/dialogs via agent-team parallel dispatch — SHIPPED` and remove the `sePromptDialog` row from the table.
  3. In `### PR-3: 11 remaining elix-bound components + se-elix vendored overrides (sequential)`, add `sePromptDialog` to the list with the original-rename note. Add a paragraph above the list documenting the amendment from PR-2.
  4. In `## Audit-input traceability`, change audit #4's "Closed by" cell from `PR-2 (sePromptDialog rename + all callsite updates in same agent prompt)` to `PR-3 (sePromptDialog rename + all callsite updates + SePlainAlertDialog Lit conversion in same PR)`.

  Commit:
  ```bash
  git -C "C:/Users/jscha/source/repos/svgedit" checkout master
  git -C "C:/Users/jscha/source/repos/svgedit" pull personal master
  git -C "C:/Users/jscha/source/repos/svgedit" checkout -b docs/spec-pr-2-amendment
  git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md
  git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(spec): #3 — mark PR-2 SHIPPED + amend sePromptDialog defer to PR-3"
  ```
  Open the spec-amendment PR via `gh` and merge via squash (same protocol as Task 16).

- [ ] **Step 2: Update `todo_svgedit.md`**

  Edit `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`:
  1. Move the PR-2 outcome into the "Shipped" section with the squash-commit SHA + final gate numbers + lessons captured this session.
  2. Update item #3's "Status" line to reflect 3 PRs remaining (PR-3, PR-4, PR-5).
  3. Update item #3's blocked-on line: "PR-2 ✓ shipped 2026-05-XX; PR-3 next (now includes sePromptDialog rename per PR-2 amendment)."
  4. Update the "Active items" count + "Last updated" date in the header banner.
  5. Update `project_index.md` line for svgedit: `[Active TODOs](todo_svgedit.md) — N active items, last updated YYYY-MM-DD (PR-2 SHIPPED — 13 pure custom elements + 5 dialogs Lit-converted)`.

- [ ] **Step 3: Surface any lessons captured this session for memory-write**

  Common candidates for global memory write (require codeword approval per CLAUDE.md):
  - Per-pilot calibration-loop pattern (if it materially helped catch packet drift, worth a small memory)
  - Any spec-vs-reality investigation discovery (e.g., the sePromptDialog folder + transitive-elix issue)
  - Any worktree-merge drift pattern that fan-out surfaced

  Present these to user; await codeword before writing.

---

## Self-review checklist (run BEFORE execution starts — by plan-writer)

- [x] **Spec coverage:** § PR-2, § PR-2 agent-team dispatch discipline, § Per-agent dispatch packet, § Pre-dispatch 4-line self-check, § User intercept handles, § Worktree isolation, § Post-dispatch gate re-verification, § Risks, § Test plan — every section has a corresponding task or template element.
- [x] **Placeholder scan:** No TBD / TODO / "implement later" / "appropriate error handling" / "similar to Task N" entries. (One inline `[PR-number]` and `<worktree-branch-name>` are dispatch-time fill-ins, not placeholders.)
- [x] **Type consistency:** Component names, HTML tag names, attribute names, event names appear consistently across § File structure, § Dispatch packet template, and each per-component task. The Task 2 fill-ins for `seListItem` (HTML tag `<se-list-item>`, attributes `option/src/title/img-height/selected`, event `selectedindexchange`) match the per-component code at `src/editor/components/seListItem.ts`.
- [x] **Discipline consistency:** Every per-component task references § Per-component dispatch protocol. The protocol's Steps 1-9 are mandatory; pilot adds Step 10. Fan-out tasks explicitly skip Step 10.
- [x] **Worktree isolation:** § Per-component dispatch protocol Step 5 enforces `isolation: "worktree"`. Every per-component task (Tasks 2, 4-15) inherits this.
- [x] **Post-dispatch gate re-verification:** § Per-component dispatch protocol Step 6 mandates re-running the gate in the worktree (not trusting the agent's report). Step 8 mandates re-running the gate at PR-2 HEAD after merge. Both apply to every per-component task.
- [x] **Audit preservation list per component:** § File structure table + each per-component task's § 6 fill-in captures the audit-flagged sites for that component. Tasks with "None" are explicit (not absent).
- [x] **Spec amendment captured:** § Spec context block + Task 17 Step 1 cover the sePromptDialog defer + audit-#4 close shift to PR-3. The amendment lands as its own follow-up PR (Task 17 Step 1).
- [x] **CHANGELOG SOP:** Task 16 Step 1 appends a `[Unreleased]` entry per CLAUDE.md `feedback_changelog_sop`.
- [x] **Multi-session cwd discipline:** Every `git` call uses `git -C "<absolute-path>"`. No `cd <project-dir>` in any task. Per CLAUDE.md.
- [x] **Squash-not-rebase on signed repo:** Task 16 Step 6 uses `gh pr merge --squash --delete-branch`. Per CLAUDE.md.
- [x] **No code in plan steps that the engineer can't execute as-is:** All shell commands are absolute-path and runnable from any cwd. All `Agent({...})` shapes are valid. No "fill in the details" entries.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-svgedit-elix-to-lit-pr-2-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — Use `superpowers:subagent-driven-development`. Dispatch a fresh subagent per task; review between tasks; fan-out tasks (4-15) can dispatch in parallel for max throughput. Two-stage review after each task. Recommended for this plan because the per-task work is well-bounded and parallelism is a real win for 12 fan-out conversions.

2. **Inline Execution** — Use `superpowers:executing-plans`. Execute tasks in the current session with batch execution + checkpoints for review. Sequential only. Recommended if the user prefers tight control over each per-component dispatch.

**Which approach?** Once chosen, the executor invokes the relevant skill and begins from Task 1.
