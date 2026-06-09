# M3 — svgedit Native Dialogs → Modals (`SePromptDialog`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 9 remaining native browser dialogs (4× `alert()`, 5× `prompt()`) with themed in-app modals, building a new `SePromptDialog` Lit component + `sePrompt()` helper and wiring it through the editor and the embed API.

**Architecture:** A new standalone `se-prompt-dialog` Lit component (native `<dialog>` + `<form method="dialog">`) mirrors the existing `SePlainAlertDialog`; a `sePrompt(text, default?)` helper wraps it (returns `Promise<string | null>`). The 4 `alert()` sites become `seAlert()`; the 5 `prompt()` sites `await sePrompt()` (their enclosing functions go `async`, with `void`/arrow-wrap at call sites to satisfy `no-floating-promises`/`no-misused-promises`). The embed default prompt handler is pointed at `sePrompt`.

**Tech Stack:** TypeScript, Lit 3, SWC (vite), vitest (jsdom) for unit, Playwright (Chromium+Firefox) for e2e. Design tokens in `src/editor/styles/tokens.css`. Spec: `docs/superpowers/specs/2026-06-08-svgedit-m3-prompt-dialog-design.md`.

---

## Conventions for every task

- **All git commands self-scoped** (multi-session safety): `git -C "C:/Users/jscha/source/repos/svgedit" …`.
- **Commits:** Conventional Commits. Work on a feature branch (created in Task 0), **never commit to `master`**.
- **`src/**/*.ts` is type-checked-linted** (`no-floating-promises`, `no-misused-promises` are errors). `tests/**` are NOT type-checked-linted (relaxed `any`/non-null).
- **Tokens only** in component CSS — `npm run lint:hex` (hex-guard) fails on raw `#hex` outside `tokens.css`.
- **Lit conventions** (`docs/superpowers/conventions/lit-component-conventions.md`): `@customElement` + `@property() accessor` (the `accessor` keyword is REQUIRED), open shadow DOM, `static styles = css\`\``, class-field-arrow event handlers, `::part` hooks. ⚠️ Convention bullet #4 (old `--*-color` names) is **stale** — it predates M1; use `--se-*` semantic tokens like `SePlainAlertDialog` does.

---

## File Structure

**Created**
- `src/editor/dialogs/SePromptDialog.ts` — the `se-prompt-dialog` component (one responsibility: a modal text prompt). Sibling to `SePlainAlertDialog.ts`.
- `tests/unit/se-prompt-dialog.test.ts` — unit test for the close→resolve mapping (no `showModal`).

**Modified**
- `src/editor/dialogs/globalDialogs.ts` — add `sePrompt` helper + `import` + `Window` augmentation.
- `src/editor/global-dialogs.d.ts` — add ambient `declare function sePrompt`.
- `src/editor/panels/LayersPanel.ts` — 3× `prompt`→`await sePrompt` (3 fns `async`), 3× `alert`→`seAlert`, 3 call-site fixes.
- `src/editor/panels/TopPanel.ts` — 2× `prompt`→`await sePrompt` (2 fns `async`), 1× `alert`→`seAlert`, 3 call-site fixes.
- `src/editor/Editor.ts` — embed default prompt handler → `sePrompt`.
- `tests/e2e/layers-panel.spec.ts` — rewire native-dialog driving → drive the modal; add a cancel case.
- `tests/e2e/dialogs-extra.spec.ts` — add `se-prompt-dialog` behavior coverage.
- `EMBED_API.md` — default-prompt-handler now real; `beforeunload` known-limitation note.
- `CHANGELOG.md` — M3 entry.

**Audited, no change needed** (verified during planning)
- `tests/e2e/embed-dialogs.spec.ts` — no `prompt` references.
- `tests/unit/embed-server.test.ts`, `tests/unit/embed-client.test.ts` — inject their own mock prompt handlers; the `Editor.ts` default swap does not affect them.
- `tests/e2e/mainmenu.spec.ts:94` — already calls `window.sePrompt?.('prompt me','defaults')` (pre-wired in anticipation). Defining `sePrompt` activates it as a harmless unawaited smoke call beside the existing `seConfirm`/`seSelect` ones. No edit; re-run to confirm green.

---

## Task 0: Feature branch

**Files:** none (git only)

- [ ] **Step 1: Create the branch off up-to-date master**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feat/m3-native-dialogs-modals
```
Expected: `Switched to a new branch 'feat/m3-native-dialogs-modals'`.

---

## Task 1: `SePromptDialog` component + `sePrompt` helper (unit-tested)

**Files:**
- Create: `src/editor/dialogs/SePromptDialog.ts`
- Modify: `src/editor/dialogs/globalDialogs.ts`, `src/editor/global-dialogs.d.ts`
- Test: `tests/unit/se-prompt-dialog.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/se-prompt-dialog.test.ts`. It registers the component by import, then drives the inner `<dialog>`'s `close` event directly (jsdom has no `showModal`, so we never call `open()`):

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/dialogs/SePromptDialog.ts'

const flushRender = async (el) => {
  await customElements.whenDefined('se-prompt-dialog')
  await new Promise((resolve) => queueMicrotask(resolve))
  if (el && typeof el.updateComplete?.then === 'function') {
    await el.updateComplete
  }
}

// Simulate the native <dialog> close without showModal (unavailable in jsdom).
const closeWith = (el, returnValue, inputValue) => {
  const dlg = el.shadowRoot.querySelector('dialog')
  const input = el.shadowRoot.querySelector('input')
  if (inputValue !== undefined) input.value = inputValue
  dlg.returnValue = returnValue
  dlg.dispatchEvent(new Event('close'))
}

describe('se-prompt-dialog close → resolve mapping', () => {
  let el

  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-prompt-dialog')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('resolves the live input value when accepted (returnValue "ok")', async () => {
    el.message = 'Enter name'
    el.value = 'seed'
    await flushRender(el)
    const closed = el.whenClosed()
    closeWith(el, 'ok', 'typed-name')
    await expect(closed).resolves.toEqual({ value: 'typed-name' })
  })

  it('resolves null when cancelled (returnValue "cancel")', async () => {
    await flushRender(el)
    const closed = el.whenClosed()
    closeWith(el, 'cancel', 'ignored')
    await expect(closed).resolves.toEqual({ value: null })
  })

  it('resolves null on Esc (empty returnValue)', async () => {
    await flushRender(el)
    const closed = el.whenClosed()
    closeWith(el, '', 'ignored')
    await expect(closed).resolves.toEqual({ value: null })
  })

  it('seeds the input with the default value', async () => {
    el.value = 'default-text'
    await flushRender(el)
    expect(el.shadowRoot.querySelector('input').value).toBe('default-text')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/se-prompt-dialog.test.ts`
Expected: FAIL — module `../../src/editor/dialogs/SePromptDialog.ts` cannot be resolved (file does not exist yet).

- [ ] **Step 3: Create the component**

Create `src/editor/dialogs/SePromptDialog.ts`:

```ts
import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

/**
 * A modal prompt dialog (message + text input + OK/Cancel) backed by a native
 * HTML5 <dialog> and a <form method="dialog"> (Enter submits = OK).
 *
 * Consumers interact imperatively via the `sePrompt` helper (globalDialogs.ts):
 *   const d = new SePromptDialog()
 *   d.message = 'Enter a name'
 *   d.value = 'default'
 *   d.open()
 *   const { value } = await d.whenClosed()   // string on OK, null on Cancel/Esc
 */
@customElement('se-prompt-dialog')
export default class SePromptDialog extends LitElement {
  static styles = css`
    dialog {
      padding: 1em;
      background: var(--se-surface);
      width: 300px;
      border: 1px solid var(--se-border);
      font-size: 0.8em;
      font-family: var(--se-font-sans);
      border-radius: var(--se-radius-sm);
      color: var(--se-text);
    }

    dialog::backdrop {
      background: var(--se-scrim);
    }

    .se-prompt-message {
      text-align: left;
      margin-bottom: var(--se-space-3);
      color: var(--se-text);
    }

    input {
      width: 100%;
      box-sizing: border-box;
      background: var(--se-surface-2);
      color: var(--se-text);
      border: 1px solid var(--se-border-strong);
      border-radius: var(--se-radius-sm);
      padding: var(--se-space-2) var(--se-space-3);
      font-family: var(--se-font-sans);
      font-size: 1em;
    }

    input:focus-visible {
      outline: 2px solid var(--se-focus-ring);
      outline-offset: 1px;
    }

    #buttonContainer {
      margin-top: 1em;
      text-align: center;
    }

    #buttonContainer button:not(:first-child) {
      margin-left: 0.5em;
    }
  `

  /** Prompt message shown above the input (arrives already translated). */
  @property() accessor message = ''

  /** Initial/default value seeded into the input. */
  @property() accessor value = ''

  private _resolve: ((result: { value: string | null }) => void) | null = null

  /** Whether the dialog is currently open. */
  get opened (): boolean {
    const dlg = this.shadowRoot?.querySelector('dialog')
    return dlg?.open ?? false
  }

  /** Show the dialog as a modal; focus + select the input (native-prompt parity). */
  open (): void {
    if (!this.isConnected) {
      document.body.append(this)
    }
    void this.updateComplete.then(() => {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (dlg && !dlg.open) {
        dlg.showModal()
        const input = this.shadowRoot?.querySelector('input')
        if (input) {
          input.focus()
          input.select()
        }
      }
    })
  }

  /** Programmatically close the dialog (resolves as cancel → null). */
  close (): void {
    const dlg = this.shadowRoot?.querySelector('dialog')
    if (dlg?.open) {
      dlg.close()
    }
  }

  /**
   * Resolves when the dialog closes: the entered string on OK, null on Cancel/Esc.
   */
  whenClosed (): Promise<{ value: string | null }> {
    return new Promise((resolve) => {
      this._resolve = resolve
    })
  }

  private _onClose = (): void => {
    const dlg = this.renderRoot.querySelector('dialog')
    const input = this.renderRoot.querySelector('input')
    const accepted = dlg?.returnValue === 'ok'
    if (this._resolve) {
      this._resolve({ value: accepted ? (input?.value ?? '') : null })
      this._resolve = null
    }
  }

  render () {
    return html`
      <dialog @close=${this._onClose}>
        <form method="dialog">
          <div class="se-prompt-message" part="message">${this.message}</div>
          <input type="text" part="input" .value=${this.value} />
          <div id="buttonContainer" part="button-container">
            <button type="submit" value="ok" part="button">OK</button>
            <button type="submit" value="cancel" part="button">Cancel</button>
          </div>
        </form>
      </dialog>
    `
  }
}
```

- [ ] **Step 4: Add the `sePrompt` helper + global wiring**

In `src/editor/dialogs/globalDialogs.ts`:

Add the import at the top (after the existing `SePlainAlertDialog` import on line 1):
```ts
import SePromptDialog from './SePromptDialog.js'
```

Add `sePrompt` to the `Window` augmentation block (after the `seSelect` line):
```ts
    sePrompt: (text: string, defaultValue?: string) => Promise<string | null>
```

Add the helper (after the `seSelect` definition, before the `window.*` assignments):
```ts
const sePrompt = async (text: string, defaultValue = ''): Promise<string | null> => {
  const dialog = new SePromptDialog()
  dialog.message = text
  dialog.value = defaultValue
  dialog.open()
  const response = await dialog.whenClosed()
  return response.value
}
```

Add the global assignment (with the existing `window.*` assignments at the bottom):
```ts
window.sePrompt = sePrompt
```

In `src/editor/global-dialogs.d.ts`, add the ambient declaration (so bare `sePrompt(...)` typechecks in `Editor.ts`):
```ts
declare function sePrompt(msg: string, defaultValue?: string): Promise<string | null>
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `npx vitest run tests/unit/se-prompt-dialog.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 6: Lint the new code**

Run: `npm run lint`
Expected: clean (no eslint errors, markdownlint clean, hex-guard passes — the component uses only `--se-*` tokens, no raw hex).

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/dialogs/SePromptDialog.ts src/editor/dialogs/globalDialogs.ts src/editor/global-dialogs.d.ts tests/unit/se-prompt-dialog.test.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: add SePromptDialog component + sePrompt() helper (M3)"
```

---

## Task 2: `se-prompt-dialog` e2e behavior coverage

**Files:**
- Modify: `tests/e2e/dialogs-extra.spec.ts`

- [ ] **Step 1: Add the failing e2e tests**

Append these tests inside the `test.describe('Dialog helpers', …)` block in `tests/e2e/dialogs-extra.spec.ts` (kick off `sePrompt` without awaiting it in `evaluate`, then drive the modal with Playwright — Playwright pierces the open shadow root):

```ts
  test('se-prompt-dialog resolves the typed value on OK (Enter)', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.sePrompt === 'function')

    await page.evaluate(() => {
      window.__promptResult = window.sePrompt('Enter value', 'seed')
    })

    const input = page.locator('se-prompt-dialog input')
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('seed')
    await input.fill('typed')
    await input.press('Enter')

    const value = await page.evaluate(() => window.__promptResult)
    expect(value).toBe('typed')
  })

  test('se-prompt-dialog resolves null on Cancel', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.sePrompt === 'function')

    await page.evaluate(() => {
      window.__promptResult = window.sePrompt('Enter value', 'seed')
    })

    await page.locator('se-prompt-dialog button[value="cancel"]').click()

    const value = await page.evaluate(() => window.__promptResult)
    expect(value).toBeNull()
  })

  test('se-prompt-dialog resolves null on Escape', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForFunction(() => typeof window.sePrompt === 'function')

    await page.evaluate(() => {
      window.__promptResult = window.sePrompt('Enter value', 'seed')
    })

    const input = page.locator('se-prompt-dialog input')
    await expect(input).toBeFocused()
    await input.press('Escape')

    const value = await page.evaluate(() => window.__promptResult)
    expect(value).toBeNull()
  })
```

- [ ] **Step 2: Run the new e2e tests to verify they pass**

Run: `npm run build && npx playwright test tests/e2e/dialogs-extra.spec.ts`
Expected: PASS in both Chromium and Firefox (the component + helper from Task 1 already exist; the build picks them up). If `npx playwright test` reports the preview server is not running, run via the orchestrator instead: `tsx scripts/run-e2e.ts` (it builds + serves + runs all specs).

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/dialogs-extra.spec.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test: e2e coverage for se-prompt-dialog OK/Cancel/Esc (M3)"
```

---

## Task 3: Replace the 4 native `alert()` with `seAlert()`

**Files:**
- Modify: `src/editor/panels/TopPanel.ts:606-607`, `src/editor/panels/LayersPanel.ts:98-99, 134-135, 182-183`

No new test — these are mechanical swaps with identical behavior (each `alert()` is immediately followed by `return`, so non-blocking `seAlert` is equivalent). Covered by `npm run lint` + typecheck and the existing suite.

- [ ] **Step 1: Swap in `TopPanel.ts`**

`attrChanger` (~line 606-607). Replace:
```ts
      // TODO: see todo #10 — native alert(); replace with seAlert
      alert(this.editor.i18next.t('notification.invalidAttrValGiven'))
```
with:
```ts
      seAlert(this.editor.i18next.t('notification.invalidAttrValGiven'))
```

- [ ] **Step 2: Swap the 3 sites in `LayersPanel.ts`**

`newLayer` (~99), `cloneLayer` (~135), `layerRename` (~183). Each is the same two-line pattern. Replace each:
```ts
      // TODO: see todo #10 — native alert(); replace with seAlert
      alert(this.editor.i18next.t('notification.dupeLayerName'))
```
with (drop the TODO comment; keep the existing message key per site — `dupeLayerName` for newLayer/cloneLayer, `layerHasThatName` for layerRename):
```ts
      seAlert(this.editor.i18next.t('notification.dupeLayerName'))
```
And for `layerRename` (~183):
```ts
      seAlert(this.editor.i18next.t('notification.layerHasThatName'))
```

`seAlert` is a global (ambient `declare function seAlert` in `global-dialogs.d.ts` + runtime `window.seAlert`), already used bare elsewhere — no import needed.

- [ ] **Step 3: Lint + typecheck**

Run: `npm run lint`
Expected: clean. (No async change here, so no floating-promise concerns.)

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/panels/TopPanel.ts src/editor/panels/LayersPanel.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: replace 4 native alert() with seAlert() (M3)"
```

---

## Task 4: Migrate the 3 `LayersPanel` `prompt()` sites + rewire layers e2e

**Files:**
- Modify: `src/editor/panels/LayersPanel.ts` (`newLayer`, `cloneLayer`, `layerRename` + call sites at `:26, :61, :65`)
- Test: `tests/e2e/layers-panel.spec.ts`

TDD order: rewire the e2e first (red), then migrate the source (green).

- [ ] **Step 1: Rewire `tests/e2e/layers-panel.spec.ts` to drive the modal**

In the `'creates, renames, toggles and deletes layers'` test, replace the native-dialog driving (current lines ~30-37):
```ts
    page.once('dialog', (dialog) => dialog.accept('Layer 2'))
    await page.click('#layer_new')
    await expect.poll(() => layerNames(page)).resolves.toContain('Layer 2')

    await page.locator('#layerlist td.layername', { hasText: 'Layer 2' }).click()
    page.once('dialog', (dialog) => dialog.accept('Renamed Layer'))
    await page.click('#layer_rename')
    await expect.poll(() => layerNames(page)).resolves.toContain('Renamed Layer')
```
with (drive the `se-prompt-dialog` modal; Enter submits = OK):
```ts
    await page.click('#layer_new')
    await page.locator('se-prompt-dialog input').fill('Layer 2')
    await page.locator('se-prompt-dialog input').press('Enter')
    await expect.poll(() => layerNames(page)).resolves.toContain('Layer 2')

    await page.locator('#layerlist td.layername', { hasText: 'Layer 2' }).click()
    await page.click('#layer_rename')
    await page.locator('se-prompt-dialog input').fill('Renamed Layer')
    await page.locator('se-prompt-dialog input').press('Enter')
    await expect.poll(() => layerNames(page)).resolves.toContain('Renamed Layer')
```

Add a new cancel-path test after that test, inside the `test.describe('Layers panel', …)` block:
```ts
  test('cancelling the new-layer prompt creates no layer', async ({ page }) => {
    const before = await layerNames(page)
    await page.click('#layer_new')
    await page.locator('se-prompt-dialog input').press('Escape')
    await expect.poll(() => layerNames(page)).resolves.toEqual(before)
  })
```

- [ ] **Step 2: Run the layers e2e to verify it fails**

Run: `npm run build && npx playwright test tests/e2e/layers-panel.spec.ts`
Expected: FAIL — `#layer_new` still triggers the native `prompt()` (no `se-prompt-dialog` appears), so the `input` locator times out.

- [ ] **Step 3: Migrate `newLayer` (~line 82)**

Change the signature `newLayer (): void {` → `async newLayer (): Promise<void> {`. Replace the prompt block:
```ts
    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const newName = prompt(
      this.editor.i18next.t('notification.enterUniqueLayerName'),
      uniqName
    )
```
with:
```ts
    const newName = await sePrompt(
      this.editor.i18next.t('notification.enterUniqueLayerName'),
      uniqName
    )
```
(The `if (!newName) return` logic below is unchanged — `''` and `null` are both falsy, preserving native behavior.)

- [ ] **Step 4: Migrate `cloneLayer` (~line 121)**

Change `cloneLayer (): void {` → `async cloneLayer (): Promise<void> {`. Replace:
```ts
    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const newName = prompt(
      this.editor.i18next.t('notification.enterUniqueLayerName'),
      name
    )
```
with:
```ts
    const newName = await sePrompt(
      this.editor.i18next.t('notification.enterUniqueLayerName'),
      name
    )
```

- [ ] **Step 5: Migrate `layerRename` (~line 170)**

Change `layerRename (): void {` → `async layerRename (): Promise<void> {`. Replace:
```ts
    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const newName = prompt(this.editor.i18next.t('notification.enterNewLayerName'), '')
```
with:
```ts
    const newName = await sePrompt(this.editor.i18next.t('notification.enterNewLayerName'), '')
```

- [ ] **Step 6: Fix the 3 call sites (async ripple)**

`lmenuFunc` (~line 26) — `cloneLayer` is now async; discard the promise:
```ts
      case 'dupe':
        void this.cloneLayer()
        break
```

`init()` bindings (~lines 61, 65) — `safeClick`'s handler type is void-returning, so wrap the now-async methods:
```ts
    safeClick($id('layer_new'), () => { void this.newLayer() })
```
```ts
    safeClick($id('layer_rename'), () => { void this.layerRename() })
```

`sePrompt` is a global (ambient decl + `window.sePrompt`) — no import needed.

- [ ] **Step 7: Run the layers e2e to verify it passes**

Run: `npm run build && npx playwright test tests/e2e/layers-panel.spec.ts`
Expected: PASS in both browsers (create/rename via modal + cancel-creates-nothing).

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: clean — no `no-floating-promises`/`no-misused-promises` errors (the `void` + arrow-wrap fixes cover them).

- [ ] **Step 9: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/panels/LayersPanel.ts tests/e2e/layers-panel.spec.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: layer prompts use sePrompt() modal; rewire layers e2e (M3)"
```

---

## Task 5: Migrate the 2 `TopPanel` `prompt()` sites

**Files:**
- Modify: `src/editor/panels/TopPanel.ts` (`promptImgURL`, `makeHyperlink` + call sites at `:224, :892, :893`)

These two paths (image URL on import, hyperlink tool) aren't directly e2e-driven; coverage is the `se-prompt-dialog` e2e (Task 2) + lint/typecheck + the final manual smoke (Task 8).

- [ ] **Step 1: Migrate `promptImgURL` (~line 157)**

Change `promptImgURL ({ cancelDeletes = false } = {}) {` → `async promptImgURL ({ cancelDeletes = false } = {}): Promise<void> {`. Replace:
```ts
    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const url = prompt(
      this.editor.i18next.t('notification.enterNewImgURL'),
      curhref
    )
```
with:
```ts
    const url = await sePrompt(
      this.editor.i18next.t('notification.enterNewImgURL'),
      curhref
    )
```

- [ ] **Step 2: Migrate `makeHyperlink` (~line 665)**

Change `makeHyperlink (): void {` → `async makeHyperlink (): Promise<void> {`. Replace:
```ts
      // TODO: see todo #10 — native prompt(); replace with custom dialog
      const url = prompt(
        this.editor.i18next.t('notification.enterNewLinkURL'),
        'http://'
      )
```
with:
```ts
      const url = await sePrompt(
        this.editor.i18next.t('notification.enterNewLinkURL'),
        'http://'
      )
```

- [ ] **Step 3: Fix the 3 call sites (async ripple)**

`updateContextPanel` (~line 224) — replace the `/* await */` placeholder:
```ts
        void this.promptImgURL({ cancelDeletes: true })
```

Button bindings (~lines 892-893) — wrap the now-async method:
```ts
    safeClick($id('tool_make_link'), () => { void this.makeHyperlink() })
    safeClick($id('tool_make_link_multi'), () => { void this.makeHyperlink() })
```

- [ ] **Step 4: Lint + typecheck**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/panels/TopPanel.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: image-URL and hyperlink prompts use sePrompt() modal (M3)"
```

---

## Task 6: Wire the embed default prompt handler

**Files:**
- Modify: `src/editor/Editor.ts:363-371`

- [ ] **Step 1: Point the embed default prompt handler at `sePrompt`**

In the `defaultDialogHandlers` object, replace the prompt stub:
```ts
        prompt: (_msg, def) => {
          // V7 lacks a real prompt-with-input (audit input #4 — seStatusDialog (formerly sePromptDialog) is status-display).
          // Until #13 adds a real prompt, return the default; hosts that need real prompts must register a handler.
          return Promise.resolve(def ?? null)
        }
```
with:
```ts
        // M3 (#13): the in-app SePromptDialog is the default; hosts may still register their own handler.
        prompt: (msg, def) => sePrompt(msg, def ?? '')
```
(`sePrompt` is reachable here via the same ambient-global + `window.*` path as the `seAlert`/`seConfirm` on the lines just above; its `Promise<string | null>` return matches the handler signature.)

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Confirm the embed protocol unit tests still pass (they inject their own handlers)**

Run: `npx vitest run tests/unit/embed-server.test.ts tests/unit/embed-client.test.ts`
Expected: PASS — these tests supply their own mock `prompt` handlers, so the default swap doesn't affect them.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/Editor.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat: embed default prompt handler uses sePrompt() (M3)"
```

---

## Task 7: Docs — EMBED_API.md + CHANGELOG.md

**Files:**
- Modify: `EMBED_API.md`, `CHANGELOG.md`

- [ ] **Step 1: Update `EMBED_API.md`**

Find the default-prompt-handler description and the existing `### sePromptDialog rename note` (~line 435). Update the prose so it states: the **default** `prompt` handler now opens the in-app `se-prompt-dialog` (`sePrompt`), returning the entered string or `null` (previously it returned the supplied default because no real prompt existed). Add a one-line known-limitation note:
```markdown
> **Known limitation:** the browser's `beforeunload` ("Leave site?") dialog is owned by the
> browser and cannot be replaced by an in-app modal. All other dialogs (`alert`/`confirm`/`prompt`)
> are in-app `se-*` components.
```

- [ ] **Step 2: Update `CHANGELOG.md`**

Add an entry under the current unreleased/working section, Keep-a-Changelog style, matching the file's existing heading format:
```markdown
### Added
- **`SePromptDialog` (`se-prompt-dialog`) + `sePrompt()`** — a themed in-app modal text prompt
  (M3 / #13), replacing the last native `prompt()` calls.

### Changed
- **Native dialogs → in-app modals (M3 / #13):** the 4 remaining `alert()` calls now use
  `seAlert()`, and the 5 `prompt()` calls (layer new/clone/rename, image URL, hyperlink) now use
  the new `sePrompt()` modal. The embed default `prompt` handler delegates to `sePrompt()`,
  closing the EMBED_API prompt-default gap. `beforeunload` remains browser-native (documented
  limitation).
```

- [ ] **Step 3: Lint markdown**

Run: `npm run lint:md`
Expected: clean (markdownlint-cli2 passes).

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add EMBED_API.md CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: EMBED_API prompt handler + CHANGELOG for M3"
```

---

## Task 8: Full verification + PR

**Files:** none (verification + git)

- [ ] **Step 1: Full lint**

Run: `npm run lint`
Expected: clean across eslint + markdownlint + hex-guard.

- [ ] **Step 2: Full unit suite (with coverage)**

Run: `npx vitest run`
Expected: all unit tests pass, including the new `se-prompt-dialog.test.ts`.

- [ ] **Step 3: Full e2e (both browsers, auto-builds dist)**

Run: `tsx scripts/run-e2e.ts`
Expected: all e2e pass in Chromium + Firefox — including the rewired `layers-panel.spec.ts`, the new `dialogs-extra.spec.ts` prompt tests, and `mainmenu.spec.ts` (line 94's `window.sePrompt?.()` now active and harmless).

- [ ] **Step 4: Manual smoke (real app)**

Run: `npm start` → open `http://localhost:8000/src/editor/index.html`. Verify in both light and dark theme (top-bar toggle):
- New Layer / Rename Layer / Clone Layer (layer context menu) → themed prompt modal; OK creates/renames, Cancel/Esc aborts, Enter submits, input text pre-selected.
- Duplicate-name → themed `seAlert` (not native).
- Hyperlink tool (`tool_make_link`) → themed prompt for URL.
- Import an image → the image-URL prompt is the themed modal.

- [ ] **Step 5: Push + open PR (squash-merge per repo workflow)**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/m3-native-dialogs-modals
gh pr create --repo (git -C "C:/Users/jscha/source/repos/svgedit" remote get-url origin) --title "M3 (#13): native dialogs → in-app modals (SePromptDialog)" --body "<summary + closes #13>"
```
Then arm auto-merge with **squash** (never rebase — signed-repo rule):
```bash
gh pr merge --squash --delete-branch --auto <PR#> --repo (git -C "C:/Users/jscha/source/repos/svgedit" remote get-url origin)
```
e2e touches `src/embed`? No — but `Editor.ts` does; embed e2e gates the PR. Confirm CI green before considering it landed.

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- Spec §2 goal "4 alert→seAlert" → Task 3. "new SePromptDialog + sePrompt" → Task 1. "5 prompt→sePrompt" → Tasks 4 (3 layer) + 5 (2 top). "embed wiring" → Task 6. "update e2e tests" → Tasks 2, 4. "EMBED_API + beforeunload note" → Task 7.
- Spec §4.1 component (form-method-dialog close semantics, focus+select, token styling, `::part`, `accessor`) → Task 1 Step 3. §4.2 helper + Window + d.ts → Task 1 Step 4. §4.3 call-site tables + async ripple → Tasks 3/4/5. §4.4 embed + docs → Tasks 6/7.
- Spec §6 testing: unit close→resolve → Task 1 Steps 1-5; e2e component → Task 2; layers rewire → Task 4; embed-dialogs audit → covered (no change, documented in File Structure); lint/hex/tokens → Task 1 Step 6 + Task 8.
- Spec §7 files-touched ↔ this plan's File Structure: match.

**2. Placeholder scan** — no TBD/TODO/"handle edge cases"/"similar to" left. Every code step shows complete code. (The PR body `<summary + closes #13>` in Task 8 Step 5 is an author-fill at PR time, not a code placeholder.)

**3. Type consistency** — names consistent across tasks: component `SePromptDialog` / element `se-prompt-dialog`; helper `sePrompt(text, defaultValue?) => Promise<string | null>`; component props `message`, `value`; `whenClosed() => Promise<{ value: string | null }>`; internal `_resolve`, `_onClose`; submit button values `'ok'`/`'cancel'`; `returnValue === 'ok'` is the single accept check used in both `_onClose` and the unit test. Call-site fixes use `void`/`() => { void this.x() }` uniformly.

**Verified-fact note:** all `:line` references are from the 2026-06-08 reading of current `master` (`b31aa5d8`); they may drift by a few lines as edits land — match on the surrounding code shown, not the absolute line number.
