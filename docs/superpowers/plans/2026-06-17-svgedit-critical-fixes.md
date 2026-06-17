# svgedit CRITICAL Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the 20 open CRITICAL findings (#7–#26) from the 2026-06-14 five-lens audit across **7 cohesive, signed, squash-merged PRs**, each built strictly test-first (RED before fix).

**Architecture:** Per-cluster branch off the latest `master` → write the RED test that proves the bug → fix → full gate → signed squash-merge → switch off the merged branch. Findings are grouped by file/concern so each PR is independently reviewable and bisectable.

**Tech Stack:** TypeScript, Lit 3 (web components), Vitest + jsdom (unit), Playwright (e2e). Engine = `packages/svgcanvas`; app = `src/editor`.

---

## Global Constraints

- **Base:** every PR branches off the *current* `master` via the verified script — never a stale/merged base:
  `pwsh C:/Users/jscha/.claude/scripts/git-new-branch.ps1 -Repo "C:/Users/jscha/source/repos/svgedit" -Branch "<branch>"`
- **TDD is mandatory and load-bearing here.** Write the RED test FIRST and run it. **If the RED test PASSES against current code, the finding is an over-claim → mark it `⊘ not-a-bug` in `reference_svgedit_security_review.md`, make NO production change, and move on.** Two of the original 26 CRITICALs (#4, #6) were already over-claims; pre-flight (below) flags more.
- **Full gate before every commit** (all must be green):
  - `npm --prefix "C:/Users/jscha/source/repos/svgedit" run typecheck` (svgcanvas pkg)
  - `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/tsc.cmd" --noEmit -p "C:/Users/jscha/source/repos/svgedit/tsconfig.json"` (editor)
  - `npm --prefix "C:/Users/jscha/source/repos/svgedit" run typecheck:server`
  - `npm --prefix "C:/Users/jscha/source/repos/svgedit" run lint`
  - `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run` (full unit suite)
  - e2e PRs (6/7) additionally run the relevant Playwright spec.
- **Fast inner loop (single test, no `cd`):**
  `& "C:/Users/jscha/source/repos/svgedit/node_modules/.bin/vitest.cmd" --root "C:/Users/jscha/source/repos/svgedit" run <filter>`
- **Merge:** `gh pr merge --squash --delete-branch <N>` (signed repo — squash only, NEVER rebase). After merge: `git -C "C:/Users/jscha/source/repos/svgedit" checkout master` and the next PR branches off the updated master.
- **Commits:** Conventional Commits; reference finding numbers (`#N`); **no AI attribution**.
- **All git/file ops use absolute paths / `git -C`** (multi-session host — no cwd reliance).
- **Local-Dependencies-Only:** N/A for these fixes (no binary/spawn/exec paths touched) — but re-verify per edit.
- **Build gotchas:** import svgcanvas internals via subpaths (`@svgedit/svgcanvas/core/*.js`); the editor typecheck is the separate `tsc -p tsconfig.json` (not `npm run typecheck`, which is svgcanvas-only).

---

## Pre-flight verification (2026-06-17, against `master` 7cf29a09)

Every finding below was re-read against current source. **The ledger (3 days old) was partly inaccurate — reassessments:**

| # | Ledger claim | Verified reality | Action |
|---|---|---|---|
| 7 | inverted layer-move guard | **Real.** `let promptMoveLayerOnce=false`; after first confirmed move the flag short-circuits all later moves with no confirm (`editorInit.ts:216-235`). | Fix: always confirm. |
| 8 | marker id → `url()`/DOM-id injection | **Real but low-severity.** `el.id` → `'mkr_'+pos+'_'+el.id` → element id + `url(#…)` via `setAttribute` (injection-contained). Defense-in-depth. | Validate id charset. RED-confirm. |
| 9 | i18n/title → innerHTML injection (8 exts) | **Mostly defense-in-depth.** Interpolated `${title}`/`${key}` are *static* i18n keys (`name` is a hardcoded const). Only `extPath` (ext-shapes) is config-tainted. | Convert sinks to DOM API; real RED only for extPath. |
| 10 | shapelib `d` unvalidated | **Defense-in-depth.** `dataset.draw` → `addSVGElementsFromJson({attr:{d}})` via `setAttribute` (contained); source is `extPath`-loaded shapelib. | Validate path-data charset. |
| 11 | height validated vs width | **Real.** `isValidUnit('height', w)` at `imagePropertiesDialog.ts:320` — passes `w`. | Fix: `…'height', h`. |
| 12 | invalid dims dispatched anyway | **Real.** `_onSave` adds `.error` class but always `dispatchEvent(closeEvent)` (line 343). | Fix: `return` when invalid. |
| 13 | `convertToNum` mis-parses units | **Real but robustness-grade.** `val.slice(-2)` only breaks on 1-char/unknown units; all valid SVG units are 2-char or `%`. | Regex parse + guard. |
| 14 | `shortFloat` broken control flow | **Likely not a correctness bug.** Works for all valid inputs via coercion; the `[5]` path needs an invalid 1-tuple. | Characterization test; if GREEN → clarity refactor only. |
| 15 | `cloneSelectedElements` clones nothing | **⊘ Almost certainly NOT-A-BUG.** Current code breaks on the first *null hole* (`if(!elem)break`), which is the ledger's prescribed fix. Normal case slices the full array. | RED-confirm → expect PASS → mark ⊘. |
| 16 | `cycleElement` selectOnly([false]) | **Real.** curElem truthy but absent from `allElems` ⇒ `elem` stays `false` ⇒ `selectOnly([false])` (`selected-elem.ts:1251`). | Fix: not-found guard. |
| 17 | color-slider stale-event rAF | **Real.** `_onPointerMove` closes over the first `e`; later moves return early (`se-color-slider.ts:97-104`). | Store latest event. |
| 18 | slider rAF not cancelled on up | **Real.** `_onPointerUp` doesn't cancel `_rafId` (`:106-112`). | Cancel + commit final. |
| 19 | ~30 recalc try/catch{ok(true)} | **Real — 16 blocks.** Many are jsdom-`SVGPointList`-blocked (that's *why* they're vacuous). | Mixed: assert real where jsdom allows; mock/skip/e2e where not. |
| 20 | tautological `cmd!==undefined\|\|cmd===null` | **Real — ~38 occurrences.** | Assert actual return/attrs. |
| 21 | polyline/polygon remap assert nothing | **Real — 3 blocks (424-440, 442-458, 461-477).** jsdom-`SVGPointList`-blocked. | Verify attr-vs-`.points` path; mock or e2e. |
| 22 | vacuous `visibilituy` assert | **Real.** Typo ⇒ always `null` (`utilities.test.ts:341`). | Fix spelling + pin actual value. |
| 23 | multi-touch move never sent | **Real.** touchmove uses 1 touch only (`touch.test.ts:96-102`). | Add multi-touch move assertion. |
| 24 | origin test identical payloads | **Real.** evil + legit payloads identical ⇒ passes even if origin check removed (`embed-client.test.ts:55-72`). | Make payloads distinguishable. |
| 25 | e2e unregistered tag names | **Real.** Test uses `se-flying-button`/`se-explorer-button`; real tags lack the inner hyphen. | Correct tags + real assertion. |
| 26 | e2e assert own mutation | **Real — 4 tests (issues 699/726/752 + zoom).** They mutate the DOM and assert their own mutation. | Rewrite to drive real UI. |

**Net expectation:** ~12 genuine fixes, **#15 → ⊘ not-a-bug**, #14 likely refactor-only, #8/#9/#10/#13 robustness/defense-in-depth (real but not high-severity), and the test-integrity tranche (PR6/7) partly gated on jsdom limits. **Trust the RED step over this table.**

---

## PR 1 — `security/extension-input-validation` (#8, #9, #10)

**Files:**
- Modify: `src/editor/extensions/ext-markers/ext-markers.ts` (#8 — id at lines 206, 250; `addMarker` at 96)
- Modify: `src/editor/extensions/ext-shapes/ext-shapes.ts` (#10 — `currentD` at line 62)
- Modify: `src/editor/extensions/ext-connector/ext-connector.ts`, `ext-grid`, `ext-panning`, `ext-polystar`, `ext-layer_view`, `ext-markers` (#9 — `innerHTML` sinks)
- Create: `tests/unit/ext-input-validation.test.ts`
- Maybe create: a shared helper `packages/svgcanvas/core/validators.ts` (id + path-data validators) if reused.

**Interfaces (produced):**
- `isSafeDomId(id: string): boolean` — `^[A-Za-z_][\w-]*$`
- `isSafePathData(d: string): boolean` — `^[\d\s,.eE+\-MmLlHhVvCcSsQqTtAaZz]*$`

### Task 1.1 — #8 marker id validation

- [ ] **Step 1: RED test** — `tests/unit/ext-input-validation.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { isSafeDomId } from '../../packages/svgcanvas/core/validators.js'

describe('marker id safety (#8)', () => {
  it('rejects ids that escape url(#…) / selectors', () => {
    expect(isSafeDomId('rect_1')).toBe(true)
    expect(isSafeDomId('evil)id')).toBe(false)      // closes url(#…)
    expect(isSafeDomId('a"]')).toBe(false)          // selector breakout
    expect(isSafeDomId('1leadingDigit')).toBe(false)
  })
})
```

- [ ] **Step 2: Run RED** — `… vitest … run ext-input-validation` → FAIL (`isSafeDomId` not exported).
- [ ] **Step 3: Implement** — create `packages/svgcanvas/core/validators.ts`:

```ts
export const isSafeDomId = (id: string): boolean => /^[A-Za-z_][\w-]*$/.test(id)
export const isSafePathData = (d: string): boolean => /^[\d\s,.eE+\-MmLlHhVvCcSsQqTtAaZz]*$/.test(d)
```

- [ ] **Step 4** — In `ext-markers.ts`, guard both id-construction sites. At line ~205-208:

```ts
// Set marker on element
if (!isSafeDomId(el.id)) { return }   // reject unsafe element id before building marker id
const id = 'mkr_' + pos + '_' + el.id
addMarker(id, val)
svgCanvas.changeSelectedAttribute(markerName, 'url(#' + id + ')')
```
And the same guard before line ~250 (`newMarkerId` in `updateReferences`). Import `isSafeDomId`.

- [ ] **Step 5: Run** the unit + a behavioral test (marker still applies for a normal id) → PASS.
- [ ] **Step 6:** *(no commit yet — bundle PR1 below)*

> **Honesty note:** the sinks are `setAttribute`-based (injection-contained), so this is defense-in-depth. If a behavioral RED proving a *real* XSS/selector breakout can't be constructed, keep the validator (cheap hardening) but record #8 as "hardened, not exploitable" in the ledger.

### Task 1.2 — #10 shapelib path-data validation

- [ ] **Step 1: RED test** (append to the same file):

```ts
import { isSafePathData } from '../../packages/svgcanvas/core/validators.js'
describe('shapelib path-data safety (#10)', () => {
  it('accepts real path data, rejects junk', () => {
    expect(isSafePathData('M0,0 L10,10 Z')).toBe(true)
    expect(isSafePathData('"><script>')).toBe(false)
  })
})
```

- [ ] **Step 2: Run RED** → PASS for the validator unit (already implemented in 1.1) — so the *unit* is green; the behavioral change is the guard in ext-shapes.
- [ ] **Step 3: Implement** — `ext-shapes.ts` line ~62:

```ts
const rawD = $id('tool_shapelib')!.dataset.draw ?? ''
const currentD = isSafePathData(rawD) ? rawD : ''
```
Import `isSafePathData` from `@svgedit/svgcanvas/core/validators.js`.

- [ ] **Step 4: Run** → PASS.

> **Honesty note:** `d` flows through `setAttribute` (contained) and originates from `extPath`-loaded shapelib JSON. Defense-in-depth. Record accordingly.

### Task 1.3 — #9 innerHTML → DOM construction

- [ ] **Step 1: RED test** — the only *tainted* input is `extPath` (ext-shapes button). Assert it can't break out:

```ts
describe('extPath in ext-shapes button (#9)', () => {
  it('does not allow extPath to inject markup', () => {
    // extPath is interpolated into a se-explorerbutton template literal (ext-shapes.ts:46-49).
    // Build the same string and assert a hostile extPath cannot add attributes/nodes.
    const extPath = '"></se-explorerbutton><img src=x onerror=alert(1)>'
    const tpl = document.createElement('template')
    tpl.innerHTML = `<se-explorerbutton lib="${extPath}/x/"></se-explorerbutton>`
    expect(tpl.content.querySelector('img')).toBeNull()   // currently FAILS — img is injected
  })
})
```

- [ ] **Step 2: Run RED** → FAIL (the `<img>` is parsed — injection confirmed for the extPath path).
- [ ] **Step 3: Implement** — in `ext-shapes.ts` `callback()`, replace the template-literal `innerHTML` with DOM construction:

```ts
const btn = document.createElement('se-explorerbutton')
btn.id = 'tool_shapelib'
btn.setAttribute('title', svgEditor.i18next.t(`${name}:buttons.0.title`))
btn.setAttribute('lib', `${extPath}/ext-shapes/shapelib/`)   // setAttribute → no markup parsing
btn.setAttribute('src', 'shapelib.svg')
canv.insertChildAtIndex($id('tools_left')!, btn, 9)
```
(Verify `insertChildAtIndex` accepts a Node; if it requires an HTML string, switch to `append` / `insertBefore`.)

- [ ] **Step 4:** For the *static-i18n* sinks (`ext-connector:382`, `ext-grid:157`, `ext-panning:45`, `ext-polystar:111`, `ext-layer_view:83`, `ext-markers:266-275`): convert each `template.innerHTML = \`…\`` to `createElement`/`setAttribute` construction (defense-in-depth — no RED, inputs are static). Keep each diff mechanical and behavior-preserving; one behavioral test per converted extension (button/panel still appears) guards it.
- [ ] **Step 5: Run** the full unit suite → PASS.

> **Honesty note:** Only the extPath case has a real exploit RED. The other 5 conversions are hardening; if the refactor risk outweighs value for any, record it as a tracked MINOR instead of forcing it into this CRITICAL PR.

### Task 1.4 — Gate, commit, merge PR1

- [ ] Run the **Full gate** (Global Constraints).
- [ ] Commit: `fix(extensions): validate untrusted ids/path-data and remove innerHTML injection sinks (#8, #9, #10)`
- [ ] `git -C … push -u origin security/extension-input-validation` → `gh pr create` → `gh pr merge --squash --delete-branch <N>` → `git -C … checkout master`.
- [ ] Update ledger statuses for #8/#9/#10 (shipped / hardened-not-exploitable as determined).

---

## PR 2 — `fix/editor-action-guards` (#7, #11, #12)

**Files:**
- Modify: `src/editor/editorInit.ts:216-235` (#7)
- Modify: `src/editor/dialogs/imagePropertiesDialog.ts:311-344` (#11, #12)
- Test: `tests/unit/image-properties-dialog.test.ts` (create); #7 covered by a focused unit on the handler logic or an e2e (see note).

### Task 2.1 — #11 height-validated-against-width + #12 dispatch-on-invalid

- [ ] **Step 1: RED test** — `tests/unit/image-properties-dialog.test.ts`. Both bugs are in `_onSave`; test the validation outcome (no `change` event when invalid; height validated against `h`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../../src/editor/dialogs/imagePropertiesDialog.ts'   // registers <se-img-prop-dialog>

const mk = async () => {
  const el = document.createElement('se-img-prop-dialog') as any
  document.body.append(el)
  await el.updateComplete
  return el
}

describe('imageProperties _onSave (#11, #12)', () => {
  beforeEach(() => { document.body.replaceChildren() })

  it('#12: does NOT dispatch change when a dimension is invalid', async () => {
    const el = await mk()
    el._canvasWidth.value = 'not-a-size'; el._canvasHeight.value = '480'
    const spy = vi.fn(); el.addEventListener('change', spy)
    el._onSave()
    expect(spy).not.toHaveBeenCalled()    // currently FAILS — it dispatches anyway
  })

  it('#11: validates HEIGHT against the height value, not width', async () => {
    const el = await mk()
    el._canvasWidth.value = '640'; el._canvasHeight.value = 'not-a-size'
    const spy = vi.fn(); el.addEventListener('change', spy)
    el._onSave()
    expect(spy).not.toHaveBeenCalled()    // currently FAILS — h validated against w=640 (valid) ⇒ dispatches
  })
})
```
(If `_canvasWidth`/`_canvasHeight` are `@query` getters resolving to inputs in shadow DOM, set `.value` on the resolved input; adjust to the actual property names confirmed at lines 313-314.)

- [ ] **Step 2: Run RED** → both FAIL.
- [ ] **Step 3: Implement** — rewrite `_onSave` validation block (lines 311-324) to track validity, fix the `w`→`h` bug, and bail before dispatch:

```ts
private _onSave = (): void => {
  let saveOpt = ''
  const w = this._canvasWidth.value
  const h = this._canvasHeight.value
  let valid = true
  if (w !== 'fit' && !isValidUnit('width', w)) {
    this._canvasWidth.parentElement?.classList.add('error'); valid = false
  } else {
    this._canvasWidth.parentElement?.classList.remove('error')
  }
  if (h !== 'fit' && !isValidUnit('height', h)) {        // h, not w  (#11)
    this._canvasHeight.parentElement?.classList.add('error'); valid = false
  } else {
    this._canvasHeight.parentElement?.classList.remove('error')
  }
  if (!valid) { return }                                  // (#12) don't dispatch invalid dims
  // …unchanged saveOpt + closeEvent dispatch (lines 325-343)…
}
```

- [ ] **Step 4: Run** → PASS.

### Task 2.2 — #7 always-confirm destructive layer move

- [ ] **Step 1: RED test** — the handler lives in `editorInit.ts` inside `init`; the cleanest RED is an e2e (drive two consecutive layer-move changes, assert the confirm dialog fires *both* times). If a focused unit is feasible, assert `seConfirm` is invoked on every `selLayerNames` change. Place an e2e in `tests/e2e/layers.spec.ts` (or extend existing): perform a layer move, confirm, then a second move → assert a confirm prompt appears again (currently it does not).
- [ ] **Step 2: Run RED** → FAIL (second move auto-applies, no prompt).
- [ ] **Step 3: Implement** — `editorInit.ts:216-235`, drop the flag gating; always confirm:

```ts
// fired when user wants to move elements to another layer
// eslint-disable-next-line @typescript-eslint/no-misused-promises
$id('selLayerNames')?.addEventListener('change', async (evt) => {
  const destLayer = typedDetail<SeChangeDetail>(evt).value
  if (!destLayer) return
  const confirmStr = editor.i18next.t('notification.QmoveElemsToLayer').replace('%s', destLayer)
  const ok = await seConfirm(confirmStr)
  if (ok === 'Cancel') return
  editor.svgCanvas.moveSelectedToLayer(destLayer)
  editor.svgCanvas.clearSelection()
  editor.layersPanel.populateLayers()
})
```
Remove the now-unused `let promptMoveLayerOnce = false`.

- [ ] **Step 4: Run** the e2e → PASS.

### Task 2.3 — Gate, commit, merge PR2

- [ ] Full gate (+ the layers e2e). Commit: `fix(editor): always confirm destructive layer move; validate image-prop dims before dispatch (#7, #11, #12)`. Push → PR → squash-merge → checkout master. Update ledger.

---

## PR 3 — `fix/units-parsing` (#13, #14)

**Files:** Modify `packages/svgcanvas/core/units.ts` (`convertToNum` 146-166; `shortFloat` 89-98). Test: `tests/unit/units.test.ts` (exists — `describe('units')`, `beforeEach` calls `units.init({getBaseUnit:'cm',getWidth:800,getHeight:600,getRoundDigits:4,…})`).

### Task 3.1 — #13 convertToNum parsing

- [ ] **Step 1: RED test** (add inside `describe('units')`):

```ts
it('convertToNum() does not zero a value with a 1-char/unknown unit (#13)', () => {
  // old: '5z'.slice(-2)==='5z', Number('5z'.slice(0,-2))===Number('')===0 ⇒ returns 0
  assert.equal(units.convertToNum('width', '5z'), 5)
  assert.equal(units.convertToNum('width', '42'), 42)   // regression: plain number
})
```

- [ ] **Step 2: Run RED** → FAIL (returns `0`).
- [ ] **Step 3: Implement** — replace the trailing-`slice(-2)` block (lines 163-165):

```ts
  const m = /^(-?[\d.]+)([a-z%]*)$/i.exec(val)
  if (!m) { return NaN }                       // explicit: unparseable input ⇒ NaN, not silent 0
  const num = Number(m[1])
  const unit = m[2].toLowerCase()
  return num * (typeMap_[unit] ?? 1)
```
(The earlier `%` and pure-number branches at 148-162 are unchanged.)

- [ ] **Step 4: Run** → PASS. Add a NaN-guard assertion: `assert.ok(Number.isNaN(units.convertToNum('width','abc')))`.

> **Honesty note:** robustness-grade (valid SVG units are all 2-char or `%`). Keep the fix (strictly better parsing) but record severity nuance.

### Task 3.2 — #14 shortFloat characterization + refactor

- [ ] **Step 1: Characterization test** (pins intended behavior):

```ts
it('shortFloat() handles tuples and unitful strings (#14)', () => {
  assert.equal(units.shortFloat([1.23456, 2.34567]), '1.2346,2.3457')  // digits=4
  assert.equal(units.shortFloat(5), 5)
  assert.equal(units.shortFloat('3.14159px'), 3.1416)
})
```

- [ ] **Step 2: Run** → if **GREEN**, #14 is **not a correctness bug** (record as such). Proceed to the clarity refactor guarded by this test. If RED, you've found a real case — fix it.
- [ ] **Step 3: Refactor** for clarity (Array-first ordering; kill the `as unknown as number - 0` cast):

```ts
export const shortFloat = (val: string | number | [number, number]): number | string => {
  const digits = elementContainer_.getRoundDigits()
  if (Array.isArray(val)) {
    return `${shortFloat(val[0])},${shortFloat(val[1])}`
  }
  if (!isNaN(val as number)) {
    return Number(Number(val).toFixed(digits))
  }
  return Number(Number.parseFloat(val as string).toFixed(digits))
}
```

- [ ] **Step 4: Run** → still GREEN.

### Task 3.3 — Gate, commit, merge PR3

- [ ] Full gate. Commit: `fix(units): robust convertToNum unit parsing; clarify shortFloat (#13, #14)`. Push → PR → squash-merge → checkout master. Update ledger (#14 as refactor/over-claim if Step 3.2 was green).

---

## PR 4 — `fix/selection-integrity` (#15, #16)

**Files:** Modify `packages/svgcanvas/core/selected-elem.ts` (#16 `cycleElement` 1221-1253; #15 `cloneSelectedElements` 237-282 — likely unchanged). Test: `tests/unit/selected-elem.test.ts` (create if absent; mirror the SvgCanvas-bootstrap mock used by paste-elem/blur-event tests, ledger #152).

### Task 4.1 — #15 confirm NOT-A-BUG

- [ ] **Step 1: RED test** — clone N non-null selected elements, assert N clones appear:

```ts
it('cloneSelectedElements clones every selected element (#15)', () => {
  // bootstrap canvas with 3 selected rects (no null holes)
  // call svgCanvas.cloneSelectedElements(10, 10)
  // assert the layer now contains 6 rects (3 original + 3 clones)
  expect(layer.querySelectorAll('rect').length).toBe(6)
})
```

- [ ] **Step 2: Run** → **expected PASS** (current loop breaks on the first null hole, slices the full array). 
- [ ] **Step 3:** Since it passes, **make NO production change.** Mark #15 `⊘ not-a-bug` in `reference_svgedit_security_review.md` with the rationale (ledger described the inverse of the actual `if (!elem) break`). Keep the test as a regression guard.

> If, against expectation, Step 2 FAILS, the real bug exists — fix per ledger (break on first null hole) and proceed normally.

### Task 4.2 — #16 cycleElement not-found guard

- [ ] **Step 1: RED test**:

```ts
it('cycleElement does not selectOnly([false]) when current element is not in the layer (#16)', () => {
  // selectedElements[0] = an element NOT among getVisibleElements(layer)
  // spy svgCanvas.selectOnly
  // svgCanvas.cycleElement(true)
  expect(selectOnlySpy).not.toHaveBeenCalledWith([false], true)   // currently FAILS
})
```
(Use a canvas mock where `getSelectedElements()→[orphan]`, `getVisibleElements()→[other]`, `getCurrentGroup()→null`, `getCurrentDrawing().getCurrentLayer()→layer`, and `selectOnly` is a `vi.fn()`.)

- [ ] **Step 2: Run RED** → FAIL (`selectOnly([false], true)` called).
- [ ] **Step 3: Implement** — guard before line 1251:

```ts
  if (!elem) { return }                       // curElem not found in layer ⇒ leave selection unchanged
  svgCanvas.selectOnly([elem as Element], true)
  svgCanvas.call('selected', selectedElements)
```

- [ ] **Step 4: Run** → PASS.

### Task 4.3 — Gate, commit, merge PR4

- [ ] Full gate. Commit: `fix(canvas): guard cycleElement against missing current element (#16); confirm #15 not-a-bug`. Push → PR → squash-merge → checkout master. Update ledger.

---

## PR 5 — `perf/color-slider-raf` (#17, #18)

**Files:** Modify `src/editor/components/jgraduate/se-color-slider.ts:97-112`. Create `tests/unit/se-color-slider.test.ts`.

**Test harness note:** stub rAF so frames are flushed manually; stub jsdom-missing pointer-capture.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../../src/editor/components/jgraduate/se-color-slider.ts'

let rafCb: FrameRequestCallback | null
beforeEach(() => {
  rafCb = null
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafCb = cb; return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => { rafCb = null })
})
afterEach(() => vi.unstubAllGlobals())

const mkSlider = async () => {
  const el = document.createElement('se-color-slider') as any
  el.mode = '1d'; el.width = 100; el.height = 100
  document.body.append(el); await el.updateComplete
  const div = el.shadowRoot.querySelector('div') as HTMLElement
  div.setPointerCapture = vi.fn(); div.releasePointerCapture = vi.fn()   // jsdom lacks these
  return { el, div }
}
const pointer = (type: string, y: number) =>
  new PointerEvent(type, { clientX: 0, clientY: y, pointerId: 1, bubbles: true })
```

### Task 5.1 — #17 latest-event repaint

- [ ] **Step 1: RED test**:

```ts
it('uses the LATEST pointer position within a frame (#17)', async () => {
  const { el, div } = await mkSlider()
  div.dispatchEvent(pointer('pointerdown', 10))   // schedules nothing yet (immediate update)
  div.dispatchEvent(pointer('pointermove', 30))   // schedules rAF capturing y=30
  div.dispatchEvent(pointer('pointermove', 70))   // rafId set ⇒ currently dropped
  rafCb?.(0)                                       // flush the frame
  expect(Math.round(el.y)).toBe(70)               // currently 30 (stale) ⇒ FAIL
})
```

- [ ] **Step 2: Run RED** → FAIL (`el.y` ≈ 30).
- [ ] **Step 3: Implement** — store the latest event:

```ts
private _latestEvent: PointerEvent | null = null

private _onPointerMove = (e: PointerEvent) => {
  if (!this._dragging) return
  this._latestEvent = e
  if (this._rafId) return
  this._rafId = requestAnimationFrame(() => {
    this._rafId = 0
    if (this._latestEvent) this._updateFromPointer(this._latestEvent)
  })
}
```

- [ ] **Step 4: Run** → PASS.

### Task 5.2 — #18 cancel pending rAF on pointer-up

- [ ] **Step 1: RED test**:

```ts
it('does not commit a stale frame after pointer-up (#18)', async () => {
  const { el, div } = await mkSlider()
  div.dispatchEvent(pointer('pointerdown', 10))
  div.dispatchEvent(pointer('pointermove', 40))   // schedules rAF
  const changes: number[] = []
  el.addEventListener('sl-change', (e: any) => changes.push(e.detail.y))
  div.dispatchEvent(pointer('pointerup', 90))      // should commit final 90 and cancel pending
  rafCb?.(0)                                        // stale frame must be a no-op
  expect(el.y).toBe(90)                             // committed final position
  expect(changes.filter(v => Math.round(v) === 40)).toHaveLength(0)  // no stale 40 ⇒ currently FAIL
})
```

- [ ] **Step 2: Run RED** → FAIL (stale 40 frame fires after up).
- [ ] **Step 3: Implement** — cancel pending rAF and commit the final position:

```ts
private _onPointerUp = (e: PointerEvent) => {
  this._dragging = false
  if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = 0 }
  this._updateFromPointer(this._latestEvent ?? e)   // commit true final position
  this._latestEvent = null
  const el = e.currentTarget as HTMLElement
  el.releasePointerCapture(e.pointerId)
  el.removeEventListener('pointermove', this._onPointerMove)
  el.removeEventListener('pointerup', this._onPointerUp)
}
```

- [ ] **Step 4: Run** both → PASS.

### Task 5.3 — Gate, commit, merge PR5

- [ ] Full gate. Commit: `fix(color-slider): repaint with latest pointer event; cancel pending frame on pointer-up (#17, #18)`. Push → PR → squash-merge → checkout master. Update ledger.

---

## PR 6 — `test/recalculate-integrity` (#19, #20, #21)

**Files:** Modify `tests/unit/recalculate.test.ts` (1953 lines). Possibly read `packages/svgcanvas/core/recalculate.ts` + `coords.ts` to confirm the points code path.

**Decision gate (run FIRST):** Determine whether `recalculateDimensions` reads polyline/polygon geometry via the `.points` **SVGPointList** property (jsdom-unsupported) or by parsing the `points` **attribute string** (jsdom-OK). Grep `coords.ts`/`recalculate.ts` for `.points`. This decides #19-polyline and #21.

### Task 6.1 — #20 replace tautological assertions (~38 sites)

- [ ] **Step 1:** For a representative rect/group test (jsdom-safe geometry), write the REAL assertion. Example at line ~1079 (`g` with transform):

```ts
const cmd = recalculate.recalculateDimensions(g)
// recalculateDimensions returns a Command when it bakes the transform, else null/undefined.
expect(cmd).toBeTruthy()
// and assert the baked result on the child geometry, e.g.:
assert.equal(rect.getAttribute('x'), '<expected baked x>')
```

- [ ] **Step 2: Run** → confirms the real expected value (RED if the tautology hid a wrong value).
- [ ] **Step 3:** Apply the same transformation to the remaining `assert.ok(cmd !== undefined || cmd === null)` sites (agent-reported lines: 1081, 1099, 1127, 1144, 1215, 1308, 1375, 1391, 1407, 1425, 1444, 1463, 1479, 1497, 1510, 1529, 1554, 1574, 1595, 1619, 1638, 1657, 1675, 1690, 1704, 1719, 1734, 1750, 1768, 1789, 1814, 1839, 1861, 1883, 1905, 1919, 1936, 1951). For each: assert the actual `cmd` shape (truthy Command vs `null` for no-op) AND, where jsdom permits, the resulting attribute. **Do not** leave any tautology behind.

> Any site whose element is polyline/polygon defers to Task 6.3.

### Task 6.2 — #19 de-fang error-swallowing try/catch (16 blocks)

- [ ] For each `try { fn(); assert.ok(true) } catch { assert.ok(true) }` block: if the element is jsdom-safe (rect/group/path attributes), **remove the try/catch** and assert the real post-`recalculate` state. Run RED first — a previously-hidden throw becomes a real failure to fix or characterize.
- [ ] Blocks that are genuinely jsdom-blocked (polyline/polygon `.points`) defer to Task 6.3 — do **not** convert them to a fake pass.

### Task 6.3 — #21 polyline/polygon remap (jsdom-gated)

- [ ] **If attribute-path (decision gate = string parse):** assert the remapped `points` attribute directly. Example (line 442-458, `translate(5,10)` on `'10,10 20,20 30,10'`):

```ts
recalculate.recalculateDimensions(polyline)
assert.equal(polyline.getAttribute('points'), '15,20 25,30 35,20')
```
and polygon (461-477, `translate(10,15)` on `'10,10 20,10 15,20'`) → `'20,25 30,25 25,35'`.

- [ ] **If `.points`-path (jsdom-blocked):** choose ONE, in order of preference:
  1. **Migrate** these 3 cases to an e2e spec (`tests/e2e/recalculate-points.spec.ts`) where a real browser provides `SVGPointList`; assert the remapped attribute there.
  2. **Mock** `SVGPolylineElement.prototype.points` in the test with a minimal fake backed by attribute parsing.
  3. **`it.skip(…, 'jsdom lacks SVGPointList — see e2e')`** with an explicit reason (last resort — still better than a fake pass).
- [ ] Record the chosen route in the PR description.

### Task 6.4 — Gate, commit, merge PR6

- [ ] Full gate (+ any new e2e). Commit: `test(recalculate): real assertions for transform baking; remove vacuous try/catch (#19, #20, #21)`. Push → PR → squash-merge → checkout master. Update ledger.

> **Honesty note:** if making #19/#21 real surfaces a genuine `recalculate` bug (a baked value is wrong), STOP and spin a follow-up production-fix PR — do not bury a real bug behind an adjusted expectation.

---

## PR 7 — `test/assertion-integrity` (#22, #23, #24, #25, #26)

**Files:** `tests/unit/utilities.test.ts` (#22), `tests/unit/touch.test.ts` (#23), `tests/unit/embed-client.test.ts` (#24), `tests/e2e/se-components.spec.ts` (#25), `tests/e2e/issues.spec.ts` + `tests/e2e/zoom.spec.ts` (#26).

### Task 7.1 — #22 fix typo + pin real value

- [ ] **Step 1:** `utilities.test.ts:341` — correct `'visibilituy'` → `'visibility'`. Run to observe the actual value `convertToPath` produces, then pin it:

```ts
assert.equal(path.getAttribute('visibility'), <observed value>)   // was always-null typo
```
- [ ] **Step 2: Run** → GREEN with the real value.

### Task 7.2 — #23 actually exercise multi-touch move

- [ ] **Step 1:** Verify in `packages/svgcanvas/.../touch.ts` that a multi-touch `touchmove` is ignored. Then add to the test (after line 104):

```ts
svgroot.dispatch('touchmove', {
  type: 'touchmove',
  changedTouches: [
    { target, clientX: 9, clientY: 10, screenX: 11, screenY: 12 },
    { target, clientX: 1, clientY: 2, screenX: 3, screenY: 4 }
  ],
  preventDefault: vi.fn()
})
expect(mouseMove).toBe(1)   // multi-touch move must NOT translate to a mousemove
```
- [ ] **Step 2: Run** → if it fails, multi-touch moves are NOT ignored (real bug → follow-up). If green, the test now genuinely covers the named behavior.

### Task 7.3 — #24 distinguishable origin payloads

- [ ] **Step 1:** `embed-client.test.ts:55-72` — make the unauthorized message's payload distinct so acceptance would change the result:

```ts
// evil.com — DIFFERENT version so accepting it would flip the assertion:
data: { ns:'svgedit', v:1, kind:'event', name:'ready', payload:{ version:'9.9.9', protocolVersion:1, capabilities:[] } },
origin: 'https://evil.com', source: iframe.contentWindow
// editor.test — the legit one stays 7.4.1
```
Keep `expect(payload.version).toBe('7.4.1')`.

- [ ] **Step 2: Run** → GREEN now; and removing the origin check would make it RED (verify by temporarily commenting the guard, optional).

### Task 7.4 — #25 correct custom-element tag names

- [ ] **Step 1:** Confirm the registered tags via `@customElement(...)` in `seFlyingButton.ts` / `seExplorerButton.ts` (ledger: `se-flyingbutton`, `se-explorerbutton`).
- [ ] **Step 2:** In `se-components.spec.ts`, replace `se-flying-button`/`se-explorer-button` with the verified tags, and add a real upgrade assertion so an unregistered tag can't pass:

```ts
expect(await button.evaluate(el => !!el.shadowRoot)).toBe(true)   // proves the element upgraded
```
- [ ] **Step 3: Run** the spec → GREEN against the real components.

### Task 7.5 — #26 rewrite self-mutation e2e to drive real UI

- [ ] For each of issues 699 / 726 / 752 (`issues.spec.ts`) and the zoom spec: replace the "mutate `canvasBackground` myself then assert it changed" body with a flow that drives the **actual svgedit feature** and asserts the app's resulting state. E.g. zoom: invoke the zoom tool/`setZoom`, assert `#svgroot`/canvas transform or `#zoom` readout changed; selection-preservation: select an element, zoom, assert the selection (`#selectorGroup`) still wraps it. Each test RED-first against the real behavior.
- [ ] If a feature behaves differently than the test name implies, surface it (follow-up) rather than asserting the wrong thing.

### Task 7.6 — Gate, commit, merge PR7

- [ ] Full gate (+ the e2e specs). Commit: `test: make assertion-integrity tests actually exercise their target behavior (#22-#26)`. Push → PR → squash-merge → checkout master. Update ledger.

> **Honesty note:** #26 (4 e2e rewrites) is the most exploratory work in the batch and the most likely to spill — it depends on the real zoom/select/text UX and may expose behavior gaps.

---

## Self-Review

**1. Coverage:** all 20 open CRITICALs (#7–#26) are assigned to exactly one task; #1–#6 are excluded (shipped / not-a-bug). ✔
**2. Placeholders:** RED + fix code is concrete for every production finding; the only deliberately-deferred decisions are RED-gated (#15 expected-pass, #14 characterization, #9 partial, #19/#21 jsdom decision-gate) and each carries an explicit decision procedure, not a TODO. ✔
**3. Type/name consistency:** `isSafeDomId`/`isSafePathData` defined once (Task 1.1) and reused; `_latestEvent`/`_rafId` consistent across Tasks 5.1/5.2; `_onSave` signature unchanged. ✔
**4. Sequencing:** PRs are independent (distinct files) but execute serially off the latest master per branch-discipline; PR order is the recommended risk order (production fixes 1–5 first, exploratory test fixes 6–7 last). ✔

**Known execution-time verifications (RED step resolves each):** exact `_canvasWidth`/`_canvasHeight` query names (PR2); `insertChildAtIndex` Node-vs-string (PR1.3); the `.points` vs attribute path (PR6 decision gate); registered custom-element tag names (PR7.4); `touch.ts` multi-touch-move behavior (PR7.2); the actual `visibility` value (PR7.1).
