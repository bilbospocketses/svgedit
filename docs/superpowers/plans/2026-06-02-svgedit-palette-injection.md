# Host Palette Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an embed host replace svgedit's swatch palette via a `?palette=` URL param and an `editor.setPalette(colors)` runtime method, backed by a configurable core palette store.

**Architecture:** A pure-data `DEFAULT_PALETTE` leaf in the embed layer feeds a core `palette-store` (the single source of truth + validation site). `se-palette` renders from the store and re-renders on change via a subscription. `Editor.setCustomPalette` drives the store and surfaces dropped colors as an embed `error` event; the embed server wires the `?palette=` URL param and a `__setPalette` runtime call to it. One-way (host → editor); replace semantics; `'none'` always preserved.

**Tech Stack:** TypeScript (strict), Lit 3, Vite 7, Vitest 4 (jsdom), Playwright 1.57.

**Spec:** `docs/superpowers/specs/2026-06-02-svgedit-palette-injection-design.md`

---

## Execution notes (this repo / box)

- Commands assume the **repo root** as cwd. On this Windows multi-session box, either run inside the worktree, or scope via `npm --prefix "C:/Users/jscha/source/repos/svgedit" run <script>`. Single test files: `npx vitest run <path>` (uses `vite.config.mjs` jsdom config).
- Implement on a feature branch `feat/todo4-palette-injection`; per-task commits; **squash-merge** the impl PR at the end (signed-repo rule). This is a separate PR from the spec/plan docs PR.
- `npm test` runs `vitest run --coverage` then the Playwright e2e (auto-builds `dist/editor`). Per-task, prefer the targeted `npx vitest run <file>` / `npx playwright test <file>` commands shown.

## File structure

| File | Responsibility | New? |
|---|---|---|
| `src/embed/palette-defaults.ts` | `export const DEFAULT_PALETTE` (42 colors). Pure data, in embed layer so the entry can re-export it. | new |
| `src/editor/components/palette-store.ts` | Source of truth + validation: `getPalette`, `setPalette` (normalize/validate/notify), `subscribePalette`. | new |
| `src/editor/components/sePalette.ts` | Renders from the store; subscribes for re-render. | modify |
| `src/editor/Editor.ts` | `setCustomPalette(colors)` — drives store, emits `error` on dropped colors. | modify |
| `src/embed/url-params.ts` | Parse `?palette=`. | modify |
| `src/embed/server.ts` | Apply URL-param palette on init; `__setPalette` call; `'palette'` capability. | modify |
| `src/embed/client.ts` | Host `setPalette(colors)` method. | modify |
| `src/embed/index.ts` | Re-export `DEFAULT_PALETTE`. | modify |
| `tests/unit/embed-palette.test.ts` | Store unit tests. | new |
| `tests/unit/embed-url-params.test.ts` | `?palette=` parse tests. | modify |
| `tests/unit/embed-server.test.ts` | `__setPalette` + URL-param + capability tests. | modify |
| `tests/e2e/embed-palette.spec.ts` | End-to-end: render, runtime, replace, invalid→error, none. | new |
| `EMBED_API.md`, `README.md`, `CHANGELOG.md` | Docs. | modify |

---

### Task 1: Core palette store + defaults

**Files:**
- Create: `src/embed/palette-defaults.ts`
- Create: `src/editor/components/palette-store.ts`
- Test: `tests/unit/embed-palette.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/embed-palette.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PALETTE } from '../../src/embed/palette-defaults.ts'
import {
  getPalette, setPalette, subscribePalette, _resetPaletteForTest
} from '../../src/editor/components/palette-store.ts'

afterEach(() => { _resetPaletteForTest() })

describe('palette-store', () => {
  it('defaults to DEFAULT_PALETTE (none first, 42 entries)', () => {
    expect(getPalette()).toEqual(DEFAULT_PALETTE)
    expect(DEFAULT_PALETTE[0]).toBe('none')
    expect(DEFAULT_PALETTE).toHaveLength(42)
  })

  it('replaces with valid colors and prepends none', () => {
    const res = setPalette(['#ff0000', '#00ff00'])
    expect(getPalette()).toEqual(['none', '#ff0000', '#00ff00'])
    expect(res.dropped).toEqual([])
  })

  it('does not duplicate a host-supplied none', () => {
    setPalette(['none', '#ff0000'])
    expect(getPalette()).toEqual(['none', '#ff0000'])
  })

  it('drops invalid colors and reports them', () => {
    const res = setPalette(['#ff0000', 'notacolor', ''])
    expect(getPalette()).toEqual(['none', '#ff0000'])
    expect(res.dropped).toEqual(['notacolor', ''])
  })

  it('falls back to DEFAULT_PALETTE when no real color survives', () => {
    const res = setPalette(['notacolor'])
    expect(getPalette()).toEqual(DEFAULT_PALETTE)
    expect(res.dropped).toEqual(['notacolor'])
  })

  it('falls back to DEFAULT_PALETTE for an empty array', () => {
    setPalette([])
    expect(getPalette()).toEqual(DEFAULT_PALETTE)
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    const fn = vi.fn()
    const unsub = subscribePalette(fn)
    setPalette(['#ff0000'])
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    setPalette(['#00ff00'])
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/embed-palette.test.ts`
Expected: FAIL — cannot resolve `src/embed/palette-defaults.ts` / `palette-store.ts`.

- [ ] **Step 3: Create `src/embed/palette-defaults.ts`**

```ts
// src/embed/palette-defaults.ts
// Default swatch palette for se-palette. Defined in the embed layer so the embed
// entry (index.ts) can re-export it to hosts without breaching tsconfig.embed.json
// (rootDir: src/embed). The editor's palette-store imports it as its default.
export const DEFAULT_PALETTE: string[] = [
  'none',
  '#000000', '#3f3f3f', '#7f7f7f', '#bfbfbf', '#ffffff',
  '#ff0000', '#ff7f00', '#ffff00', '#7fff00', '#00ff00',
  '#00ff7f', '#00ffff', '#007fff', '#0000ff', '#7f00ff',
  '#ff00ff', '#ff007f', '#7f0000', '#7f3f00', '#7f7f00',
  '#3f7f00', '#007f00', '#007f3f', '#007f7f', '#003f7f',
  '#00007f', '#3f007f', '#7f007f', '#7f003f', '#ffaaaa',
  '#ffd4aa', '#ffffaa', '#d4ffaa', '#aaffaa', '#aaffd4',
  '#aaffff', '#aad4ff', '#aaaaff', '#d4aaff', '#ffaaff',
  '#ffaad4'
]
```

- [ ] **Step 4: Create `src/editor/components/palette-store.ts`**

```ts
// src/editor/components/palette-store.ts
// Single source of truth + validation site for the editor's swatch palette.
import { DEFAULT_PALETTE } from '../../embed/palette-defaults.js'

export type SetPaletteResult = { applied: string[]; dropped: string[] }

let current: string[] = DEFAULT_PALETTE
const listeners = new Set<() => void>()

// A detached element whose style setter rejects invalid CSS colors. Works in both
// real browsers and jsdom (cssstyle validates color), unlike CSS.supports in jsdom.
const probe = document.createElement('span')
function isValidColor (value: unknown): boolean {
  if (value === 'none') return true
  if (typeof value !== 'string' || value.trim() === '') return false
  probe.style.color = ''
  probe.style.color = value
  return probe.style.color !== ''
}

export function getPalette (): string[] {
  return current
}

export function setPalette (colors: readonly unknown[]): SetPaletteResult {
  const valid: string[] = []
  const dropped: string[] = []
  for (const c of colors) {
    if (isValidColor(c)) valid.push(c as string)
    else dropped.push(String(c))
  }
  const withNone = valid.includes('none') ? valid : ['none', ...valid]
  const hasRealColor = withNone.some(c => c !== 'none')
  current = hasRealColor ? withNone : DEFAULT_PALETTE
  listeners.forEach(fn => fn())
  return { applied: current, dropped }
}

export function subscribePalette (fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Test-only: restore module state between tests.
export function _resetPaletteForTest (): void {
  current = DEFAULT_PALETTE
  listeners.clear()
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/embed-palette.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/embed/palette-defaults.ts src/editor/components/palette-store.ts tests/unit/embed-palette.test.ts
git commit -m "feat(palette): core palette-store + DEFAULT_PALETTE leaf"
```

---

### Task 2: `se-palette` renders from the store

**Files:**
- Modify: `src/editor/components/sePalette.ts`

No unit test here: Lit-rendering behavior is covered by the e2e in Task 7 (URL-param render, runtime re-render). This task is verified by typecheck + lint; the `change`-event contract is unchanged.

- [ ] **Step 1: Replace the hardcoded palette with a store import**

In `src/editor/components/sePalette.ts`, **delete** the module-level `const palette = [ ... ]` block (the array literal beginning `const palette = [` and its `// Todo: Make into configuration item?` comment, through the closing `]`), and add the store import near the existing imports at the top:

```ts
import { getPalette, subscribePalette } from './palette-store.js'
```

- [ ] **Step 2: Update the JSDoc note**

In the class JSDoc, replace the line:

```
 *   - 42-color hardcoded palette + audit-preserve `// Todo: Make into configuration item?`
 *     comment carried forward for future configurable-palette work (PR-2 audit Todo #10)
```

with:

```
 *   - Palette colors come from the configurable core `palette-store` (host-injectable
 *     via the embed API). Resolves the former `// Todo: Make into configuration item?`.
```

- [ ] **Step 3: Subscribe for re-render; render from the store**

Add a private field next to `_containerClickHandler`:

```ts
  private _unsubscribePalette: (() => void) | null = null
```

Add a `connectedCallback` (place it just above `firstUpdated`):

```ts
  connectedCallback () {
    super.connectedCallback()
    this._unsubscribePalette = subscribePalette(() => this.requestUpdate())
  }
```

In `disconnectedCallback`, add the unsubscribe (keep the existing container-listener cleanup):

```ts
  disconnectedCallback () {
    super.disconnectedCallback()
    if (this._unsubscribePalette) {
      this._unsubscribePalette()
      this._unsubscribePalette = null
    }
    if (this._containerClickHandler) {
      getSvgEditor().svgCanvas.container.removeEventListener('click', this._containerClickHandler)
      this._containerClickHandler = null
    }
  }
```

In `render()`, change **both** `palette.map(...)` occurrences to `getPalette().map(...)`:

```ts
        <div id="js-se-palette">
          ${getPalette().map(rgb => this._renderSquare(rgb))}
        </div>
```
```ts
      <div id="palette_popup" style=${this.isPopupOpen ? 'display:flex' : 'display:none'}>
        ${getPalette().map(rgb => this._renderSquare(rgb))}
      </div>
```

- [ ] **Step 4: Verify typecheck + lint pass**

Run: `npm run typecheck && npm run lint`
Expected: PASS (0 errors). No remaining reference to the deleted `palette` const.

- [ ] **Step 5: Commit**

```bash
git add src/editor/components/sePalette.ts
git commit -m "refactor(palette): se-palette renders from palette-store"
```

---

### Task 3: `Editor.setCustomPalette`

**Files:**
- Modify: `src/editor/Editor.ts`

Behavior (dropped-color → `error` event) is covered by the e2e in Task 7; the drop logic itself is unit-tested in Task 1. Editor is too heavy to unit-test in isolation, so this task is verified by typecheck + lint + Task 7.

- [ ] **Step 1: Import the store**

Add to the import section at the top of `src/editor/Editor.ts`:

```ts
import { setPalette } from './components/palette-store.js'
```

- [ ] **Step 2: Add the method**

Insert `setCustomPalette` immediately after the `setIcon (...)` method (after its closing brace):

```ts
  /**
   * Replace the editor's swatch palette (the se-palette strip). Drives the core
   * palette store; se-palette re-renders via its subscription. Non-array input is
   * treated as empty (→ default palette). Invalid colours are dropped and surfaced
   * to embed hosts via an `error` event (mirrors the missing-icon pattern above).
   */
  setCustomPalette (colors: readonly unknown[]): void {
    const list = Array.isArray(colors) ? colors : []
    const { dropped } = setPalette(list)
    if (dropped.length > 0) {
      this._embedServer?.emit('error', {
        message: `palette: ${dropped.length} invalid colour(s) dropped: ${dropped.join(', ')}`,
        source: 'invalid-palette-color'
      })
    }
  }
```

- [ ] **Step 3: Verify typecheck + lint pass**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/editor/Editor.ts
git commit -m "feat(palette): Editor.setCustomPalette drives store + emits error on drop"
```

---

### Task 4: `?palette=` URL param

**Files:**
- Modify: `src/embed/url-params.ts`
- Test: `tests/unit/embed-url-params.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/embed-url-params.test.ts`, add inside the `describe`:

```ts
  it('parses palette as a comma-separated, URL-decoded list', () => {
    const p = parseEmbedURLParams(new URLSearchParams('palette=%23ff0000,%2300ff00,none'))
    expect(p.palette).toEqual(['#ff0000', '#00ff00', 'none'])
  })

  it('returns undefined palette when absent', () => {
    expect(parseEmbedURLParams(new URLSearchParams('')).palette).toBe(undefined)
  })

  it('drops empty palette entries', () => {
    const p = parseEmbedURLParams(new URLSearchParams('palette=%23ff0000,,%2300ff00'))
    expect(p.palette).toEqual(['#ff0000', '#00ff00'])
  })
```

Also extend the existing `'returns defaults for empty URL'` test by adding one line:

```ts
    expect(p.palette).toBe(undefined)
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/embed-url-params.test.ts`
Expected: FAIL — `p.palette` is undefined as a property (type error / assertion fail on the parse test).

- [ ] **Step 3: Implement palette parsing**

In `src/embed/url-params.ts`, add `palette` to the type:

```ts
export type EmbedURLParams = {
  embedMode: boolean
  chrome: ChromePreset | undefined
  theme: string | undefined
  palette: string[] | undefined
  allowedOrigins: string[]
  dialogTimeoutMs: number
}
```

Add the parse logic before the `return` (after the `theme` block):

```ts
  const paletteRaw = params.get('palette')
  const palette = paletteRaw && paletteRaw.length > 0
    ? paletteRaw.split(',').map(c => c.trim()).filter(c => c.length > 0)
    : undefined
```

Add `palette` to the returned object:

```ts
  return { embedMode, chrome, theme, palette, allowedOrigins, dialogTimeoutMs }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/embed-url-params.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/embed/url-params.ts tests/unit/embed-url-params.test.ts
git commit -m "feat(palette): parse ?palette= URL param"
```

---

### Task 5: Server — `__setPalette`, URL-param apply, capability

**Files:**
- Modify: `src/embed/server.ts`
- Test: `tests/unit/embed-server.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/embed-server.test.ts`, add to the `'EmbedServer — constructor + listener setup'` describe (it has the `activeServer` + `afterEach` dispose):

```ts
  it('applies URL-param palette on init via editor.setCustomPalette', () => {
    window.history.replaceState({}, '', '/?embed=1&palette=%23ff0000,none')
    const setCustomPalette = vi.fn()
    const editor = { svgCanvas: {}, setCustomPalette }
    activeServer = new EmbedServer(editor)
    expect(setCustomPalette).toHaveBeenCalledWith(['#ff0000', 'none'])
  })
```

Add to the `'EmbedServer — control messages'` describe:

```ts
  it('__setPalette forwards args to editor.setCustomPalette', async () => {
    const setCustomPalette = vi.fn()
    const editor = { svgCanvas: {}, setCustomPalette }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 106, method: '__setPalette', args: [['#ff0000', 'none']] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(setCustomPalette).toHaveBeenCalledWith(['#ff0000', 'none'])
    server.dispose()
  })
```

In the `'ready() helper emits ready event with declared capabilities'` test, update the capability assertion:

```ts
    expect(readyEvent.payload.capabilities).toEqual(expect.arrayContaining(['chrome', 'theme', 'dialog-hooks', 'palette']))
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/embed-server.test.ts`
Expected: FAIL — `setCustomPalette` not called; capabilities lacks `'palette'`.

- [ ] **Step 3: Apply the URL-param palette in the constructor**

In `src/embed/server.ts`, in the constructor, after the `if (params.theme) applyTheme(...)` line (before the listener attach), add:

```ts
    if (params.palette) {
      const ed = this.editor as Record<string, unknown>
      if (typeof ed.setCustomPalette === 'function') {
        (ed.setCustomPalette as (colors: unknown) => unknown)(params.palette)
      }
    }
```

- [ ] **Step 4: Add the `__setPalette` handler**

In `handleCall`, after the `__setTheme` block (before `__setChrome` is fine too — order is independent), add:

```ts
    if (env.method === '__setPalette') {
      const ed = this.editor as Record<string, unknown>
      if (typeof ed.setCustomPalette === 'function') {
        (ed.setCustomPalette as (colors: unknown) => unknown)(env.args[0])
      }
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
      return
    }
```

- [ ] **Step 5: Add the `'palette'` capability**

Change the `ready` method default:

```ts
  ready (capabilities: string[] = ['chrome', 'theme', 'dialog-hooks', 'palette']): void {
    this.emit('ready', { version: this.version, protocolVersion: PROTOCOL_VERSION, capabilities })
  }
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run tests/unit/embed-server.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/embed/server.ts tests/unit/embed-server.test.ts
git commit -m "feat(palette): server __setPalette + URL-param apply + capability"
```

---

### Task 6: Client method + entry re-export

**Files:**
- Modify: `src/embed/client.ts`
- Modify: `src/embed/index.ts`

Verified by typecheck + `build:embed` + the e2e in Task 7 (which calls `setPalette` and imports nothing new host-side beyond the instance).

- [ ] **Step 1: Add the host method**

In `src/embed/client.ts`, after the `setTheme` method, add:

```ts
  setPalette (colors: readonly string[]): Promise<unknown> {
    return this.call('__setPalette', [colors])
  }
```

- [ ] **Step 2: Re-export `DEFAULT_PALETTE` from the entry**

In `src/embed/index.ts`, add:

```ts
export { DEFAULT_PALETTE } from './palette-defaults.js'
```

- [ ] **Step 3: Verify the embed bundle compiles**

Run: `npm run build:embed`
Expected: PASS; `dist/embed/index.d.ts` includes `DEFAULT_PALETTE`, `dist/embed/index.js` re-exports it.

- [ ] **Step 4: Verify typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/embed/client.ts src/embed/index.ts
git commit -m "feat(palette): client setPalette + DEFAULT_PALETTE export"
```

---

### Task 7: End-to-end coverage

**Files:**
- Create: `tests/e2e/embed-palette.spec.ts`

The `embed-host.html` fixture already exposes `window.__svgeditEmbed` and logs `ERR <source>` for `error` events — no fixture change needed.

- [ ] **Step 1: Write the e2e spec**

Create `tests/e2e/embed-palette.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

// Read the rendered swatch strip's data-rgb list from inside se-palette's shadow root.
const stripColors = (page) =>
  page.frameLocator('#svge').locator('se-palette').first().evaluate(
    el => Array.from(el.shadowRoot.querySelectorAll('#js-se-palette .square'))
      .map(s => s.getAttribute('data-rgb'))
  )

test.describe('embed: palette injection', () => {
  test('URL param ?palette= renders the host palette (none prepended)', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23ff0000,%2300ff00' })
    expect(await stripColors(page)).toEqual(['none', '#ff0000', '#00ff00'])
  })

  test('runtime setPalette replaces the strip', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.setPalette(['#112233', '#445566']))
    await expect.poll(() => stripColors(page)).toEqual(['none', '#112233', '#445566'])
  })

  test('replace semantics — built-in colors are gone', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23abcdef' })
    const colors = await stripColors(page)
    expect(colors).toEqual(['none', '#abcdef'])
    expect(colors).not.toContain('#000000')
  })

  test('invalid color is dropped and emits an error event', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.setPalette(['#00ff00', 'notacolor']))
    await expect.poll(() => page.evaluate(() => window.__getLog())).toContain('ERR invalid-palette-color')
    expect(await stripColors(page)).toEqual(['none', '#00ff00'])
  })

  test('none is preserved even when the host omits it', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23123456' })
    const colors = await stripColors(page)
    expect(colors[0]).toBe('none')
  })

  test('an injected swatch is clickable without error', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/index.html?embed=1&palette=%23ff0000' })
    await page.frameLocator('#svge').locator('se-palette').first()
      .locator('#js-se-palette .square[data-rgb="#ff0000"]').click()
    expect(await page.evaluate(() => window.__getLog())).not.toContain('ERR')
  })
})
```

- [ ] **Step 2: Run the e2e (chromium only first for speed)**

Run: `npx playwright test tests/e2e/embed-palette.spec.ts --project=chromium`
Expected: PASS (6 tests). (If the dev build is stale, run `npm run build` first — Playwright's webserver serves `dist/editor`.)

- [ ] **Step 3: Run both browsers**

Run: `npx playwright test tests/e2e/embed-palette.spec.ts`
Expected: PASS (12 = 6 × chromium + firefox).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/embed-palette.spec.ts
git commit -m "test(palette): e2e for URL-param + runtime palette injection"
```

---

### Task 8: Documentation

**Files:**
- Modify: `EMBED_API.md`
- Modify: `README.md`

- [ ] **Step 1: Add the Palette section to `EMBED_API.md`**

Insert this section between the end of `## Chrome control` (the `---` that precedes `## Dialog hooks`) and `## Dialog hooks`:

```markdown
## Palette

Replace the editor's color swatch strip (`se-palette`) with your own brand colors. Replace-semantics: your colors become the whole palette. The `none` (no-fill/no-stroke) swatch is always kept — it is prepended if you omit it.

### URL param (initial state)

```
?embed=1&palette=%23ff0000,%23223344,none
```

Comma-separated CSS colors, URL-encoded. Applied before first paint — no flash of the default swatches.

### Runtime API

```js
import { SvgEditEmbed, DEFAULT_PALETTE } from 'svgedit/embed'

await editor.ready

await editor.setPalette(['#ff0000', '#223344', '#00a3e0'])     // replace
await editor.setPalette([...DEFAULT_PALETTE, '#00a3e0'])        // append (host-composed)
```

`DEFAULT_PALETTE` is the built-in 42-color array, exported for host-side composition.

### Validation

Each entry must be `none` or a valid CSS color. Invalid entries are dropped (the rest still apply); if any are dropped at runtime the editor emits an `error` event with `source: 'invalid-palette-color'`. If nothing valid remains, the default palette is restored. `'palette'` appears in the `ready` payload's `capabilities`.

---
```

- [ ] **Step 2: Mention palette in `README.md`**

Change the embed reference line:

```
  `EMBED_API.md` (postMessage RPC, two-way theme sync)
```

to:

```
  `EMBED_API.md` (postMessage RPC, two-way theme sync, swatch-palette injection)
```

- [ ] **Step 3: Lint docs**

Run: `npm run lint:md`
Expected: PASS (0 markdownlint errors).

- [ ] **Step 4: Commit**

```bash
git add EMBED_API.md README.md
git commit -m "docs(palette): EMBED_API.md palette section + README mention"
```

---

### Task 9: CHANGELOG + full verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the CHANGELOG entry**

In `CHANGELOG.md`, insert directly under `## [Unreleased]` (newest-first):

```markdown
### Added (Host palette injection -- 2026-06-02)

- Hosts can inject a custom swatch palette into the embedded editor: a `?palette=<comma-separated
  colors>` URL param (initial, no flash) and an `editor.setPalette(colors)` runtime method. Replaces
  the built-in 42-color palette; `DEFAULT_PALETTE` is exported from `svgedit/embed` for host-side
  append.
- The palette is now a real editor setting (`Editor.setCustomPalette`) backed by a core
  `palette-store`; `se-palette` reads and re-renders from it. Resolves the long-standing
  `// Todo: Make into configuration item?`.
- Invalid colors are dropped with a non-fatal `error` event (`source: 'invalid-palette-color'`); the
  `none` swatch is always preserved. `'palette'` added to the embed `ready` capabilities.
  (TODO #4 / #10 / #16)
```

- [ ] **Step 2: Full verification — lint, unit, e2e, build**

Run: `npm run lint`
Expected: PASS (0 errors).

Run: `npx vitest run`
Expected: PASS — all unit tests including the new `embed-palette` + extended `embed-url-params` / `embed-server`.

Run: `npx playwright test`
Expected: PASS — full e2e suite including `embed-palette.spec.ts`. (Run on a free port per TODO #20; ensure nothing foreign is on 9000.)

Run: `npm run build`
Expected: PASS — `vite build` + `build:embed` succeed; `dist/embed/index.js` exports `DEFAULT_PALETTE`.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(palette): CHANGELOG entry for host palette injection"
```

---

## Self-review checklist (completed during plan authoring)

- **Spec coverage:** URL param (T4/T5), runtime method (T5/T6), replace + `none`-ensure + empty-fallback (T1), `DEFAULT_PALETTE` export (T1/T6), validation + `error` event (T1/T3, e2e T7), capability (T5), `se-palette` refactor with preserved contracts (T2), docs (T8), CHANGELOG (T9). All spec sections map to a task.
- **Placeholder scan:** none — every code/test step has complete code and exact commands.
- **Type consistency:** `setPalette(colors): { applied, dropped }`, `getPalette(): string[]`, `subscribePalette(fn): () => void`, `Editor.setCustomPalette(colors)`, client `setPalette(colors)`, wire method `__setPalette`, event `source: 'invalid-palette-color'`, capability `'palette'` — consistent across tasks.
- **Validator note:** the spec named `CSS.supports('color', …)`; the plan uses a detached-element style probe (robust in jsdom + browsers) — the jsdom fallback the spec's Open Questions explicitly anticipated. Contract (drop invalid) unchanged.
