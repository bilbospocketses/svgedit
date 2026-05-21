# svgedit Embed API v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement v1 of the svgedit embed API — generic postMessage RPC forwarder (editor-side) + ES-Proxy client library (host-side) + EMBED_API.md docs + 9 Playwright e2e suites — per `docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md`.

**Architecture:** Two TypeScript modules under `src/embed/` (server-side wired into `Editor.ts`; client-side standalone). Shared protocol types in `src/embed/protocol.ts`. Build pipeline emits `dist/embed/*.{js,d.ts}` via a dedicated `tsconfig.embed.json` invoked from `npm run build`. Wraps existing elix-based dialogs (`seAlert` / `seConfirm` / `sePromptDialog`) as the default dialog fallback — when #3 (elix→Lit) ships, those internals swap without touching the embed contract.

**Tech Stack:** TypeScript 6.x (day-one strict), Vite 7, Vitest 4 + jsdom (unit), Playwright 1.57 (e2e). No new runtime dependencies. Conventional commits with `feat(embed):` / `test(embed):` / `docs(embed):` / `chore(build):` scopes.

---

## File structure

**Create:**
- `src/embed/protocol.ts` — shared envelope types + event-name + error-code constants
- `src/embed/origin.ts` — origin validation helpers
- `src/embed/url-params.ts` — URL param parser
- `src/embed/chrome.ts` — chrome CSS-class application + preset resolution
- `src/embed/theme.ts` — theme CSS-class application
- `src/embed/server.ts` — editor-side `EmbedServer` class
- `src/embed/client.ts` — host-side `SvgEditEmbed` class
- `src/embed/index.ts` — package entry point (re-exports `SvgEditEmbed` + types)
- `tsconfig.embed.json` — separate tsconfig for emitting `dist/embed/`
- `tests/unit/embed-protocol.test.js` — protocol type-guard tests
- `tests/unit/embed-origin.test.js` — origin validator tests
- `tests/unit/embed-url-params.test.js` — URL param parser tests
- `tests/unit/embed-chrome.test.js` — chrome control tests
- `tests/unit/embed-theme.test.js` — theme tests
- `tests/unit/embed-server.test.js` — server unit tests (jsdom)
- `tests/unit/embed-client.test.js` — client unit tests (jsdom)
- `tests/e2e/fixtures/embed-host.html` — Playwright parent-page fixture
- `tests/e2e/embed-helpers.js` — Playwright helpers
- `tests/e2e/embed-init.spec.js` — handshake suite
- `tests/e2e/embed-methods.spec.js` — methods round-trip suite
- `tests/e2e/embed-events.spec.js` — events allowlist suite
- `tests/e2e/embed-element-handles.spec.js` — Element handle round-trip suite
- `tests/e2e/embed-chrome.spec.js` — chrome control suite
- `tests/e2e/embed-theme.spec.js` — theme sync suite
- `tests/e2e/embed-dialogs.spec.js` — dialog hook suite
- `tests/e2e/embed-security.spec.js` — origin validation suite
- `tests/e2e/embed-versioning.spec.js` — protocol version suite
- `EMBED_API.md` — canonical documentation at repo root

**Modify:**
- `src/editor/Editor.ts:324` — instantiate `EmbedServer` after `window.svgEditor = this`
- `package.json` — add `exports` mapping, add `build:embed` script, wire into `build` chain
- `CHANGELOG.md` — add `### Added (#4 embed API v1)` entry under `[Unreleased]`
- `README.md` — refresh "Embedding (planned)" section with concrete `EMBED_API.md` link + minimal quickstart
- `todo_svgedit.md` (memory) — move item #4 to Shipped at end (during final-integration task)
- `project_index.md` (memory) — update svgedit entry

**Helper for test setup (used in Tasks 12-16):** all client unit tests construct an `<iframe>` element via `document.createElement` (NEVER `innerHTML`) so the security hook stays quiet and the pattern stays XSS-clean even for hardcoded test fixtures.

---

## Pre-flight

### Task 0: Branch setup + plan commit

**Files:**
- Commit: `docs/superpowers/plans/2026-05-20-svgedit-embed-api-v1-plan.md` (already on disk, untracked on master at session start)

- [ ] **Step 1: Confirm expected working-tree state on master**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" status --short
```

Expected output:
```
?? docs/superpowers/plans/2026-05-20-svgedit-embed-api-v1-plan.md
?? tsconfig.tsbuildinfo
```

Both untracked are expected: the plan file (this document, will be committed in Step 3); `tsconfig.tsbuildinfo` is a build artifact (ignored by convention). Any OTHER dirty state means something else is in progress — stop and investigate.

- [ ] **Step 2: Create implementation branch**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" checkout -b feat/embed-api-v1
```

Expected: `Switched to a new branch 'feat/embed-api-v1'`

- [ ] **Step 3: Stage + commit the plan as the first commit on this branch**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add docs/superpowers/plans/2026-05-20-svgedit-embed-api-v1-plan.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(plan): #4 embed API v1 implementation plan (Task 0)"
git -C "C:/Users/jscha/source/repos/svgedit" log -1 --format='%h %s%n%G?  %GS'
```

Expected: commit lands signed (G), one file changed.

- [ ] **Step 4: Verify branch + working-tree state**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" branch --show-current
git -C "C:/Users/jscha/source/repos/svgedit" status --short
```

Expected: branch = `feat/embed-api-v1`. Only `tsconfig.tsbuildinfo` remains untracked.

---

## Phase 1: Foundation (Tasks 1-5)

### Task 1: Protocol envelope types

**Files:**
- Create: `src/embed/protocol.ts`
- Test: `tests/unit/embed-protocol.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/embed-protocol.test.js
import { describe, expect, it } from 'vitest'
import { isValidEnvelope, PROTOCOL_VERSION } from '../../src/embed/protocol.ts'

describe('embed protocol', () => {
  it('PROTOCOL_VERSION is 1', () => {
    expect(PROTOCOL_VERSION).toBe(1)
  })

  it('isValidEnvelope accepts a well-formed call envelope', () => {
    const env = { ns: 'svgedit', v: 1, kind: 'call', id: 1, method: 'getZoom', args: [] }
    expect(isValidEnvelope(env)).toBe(true)
  })

  it('isValidEnvelope rejects foreign namespace', () => {
    const env = { ns: 'other', v: 1, kind: 'call', id: 1, method: 'x', args: [] }
    expect(isValidEnvelope(env)).toBe(false)
  })

  it('isValidEnvelope rejects missing fields', () => {
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'call' })).toBe(false)
    expect(isValidEnvelope(null)).toBe(false)
    expect(isValidEnvelope({})).toBe(false)
  })

  it('isValidEnvelope accepts each kind', () => {
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'result', id: 1, result: null })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'error', id: 1, message: 'x' })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: {} })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'dialog-request', id: 1, dialog: 'alert', args: ['hi'] })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'dialog-response', id: 1, response: null })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-protocol.test.js
```

Expected: FAIL — `Cannot find module '../../src/embed/protocol.ts'`

- [ ] **Step 3: Implement `src/embed/protocol.ts`**

```ts
// src/embed/protocol.ts
export const PROTOCOL_VERSION = 1

export type EmbedEventName =
  | 'ready' | 'change' | 'save' | 'selection-changed'
  | 'theme-changed' | 'extension-error' | 'error' | 'destroy'

export type ChromePreset = 'full' | 'minimal' | 'none'

export type ChromeState = {
  menu?: boolean
  toolbox?: boolean
  layers?: boolean
  palette?: boolean
  statusbar?: boolean
  header?: boolean
}

export const ERROR_CODES = {
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  PROTOCOL_VERSION_MISMATCH: 'PROTOCOL_VERSION_MISMATCH',
  DIALOG_HANDLER_TIMEOUT: 'DIALOG_HANDLER_TIMEOUT'
} as const
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

export type EmbedCall =
  { ns: 'svgedit'; v: 1; kind: 'call'; id: number; method: string; args: unknown[] }
export type EmbedResult =
  { ns: 'svgedit'; v: 1; kind: 'result'; id: number; result: unknown }
export type EmbedError =
  { ns: 'svgedit'; v: 1; kind: 'error'; id: number; message: string; stack?: string; code?: string }
export type EmbedEvent =
  { ns: 'svgedit'; v: 1; kind: 'event'; name: EmbedEventName; payload: unknown }
export type EmbedDialogRequest =
  { ns: 'svgedit'; v: 1; kind: 'dialog-request'; id: number; dialog: 'prompt' | 'alert' | 'confirm'; args: unknown[] }
export type EmbedDialogResponse =
  { ns: 'svgedit'; v: 1; kind: 'dialog-response'; id: number; response: unknown }

export type EmbedEnvelope =
  | EmbedCall | EmbedResult | EmbedError | EmbedEvent | EmbedDialogRequest | EmbedDialogResponse

export type ElementHandle = { __svgeditHandle: string }
export function isElementHandle (v: unknown): v is ElementHandle {
  return typeof v === 'object' && v !== null && typeof (v as { __svgeditHandle?: unknown }).__svgeditHandle === 'string'
}

export type ReadyPayload = {
  version: string
  protocolVersion: number
  capabilities: string[]
}

const KINDS = new Set(['call', 'result', 'error', 'event', 'dialog-request', 'dialog-response'])

export function isValidEnvelope (env: unknown): env is EmbedEnvelope {
  if (typeof env !== 'object' || env === null) return false
  const e = env as Record<string, unknown>
  if (e.ns !== 'svgedit') return false
  if (e.v !== 1) return false
  if (typeof e.kind !== 'string' || !KINDS.has(e.kind)) return false
  switch (e.kind) {
    case 'call':
      return typeof e.id === 'number' && typeof e.method === 'string' && Array.isArray(e.args)
    case 'result':
      return typeof e.id === 'number' && 'result' in e
    case 'error':
      return typeof e.id === 'number' && typeof e.message === 'string'
    case 'event':
      return typeof e.name === 'string' && 'payload' in e
    case 'dialog-request':
      return typeof e.id === 'number' && (e.dialog === 'prompt' || e.dialog === 'alert' || e.dialog === 'confirm') && Array.isArray(e.args)
    case 'dialog-response':
      return typeof e.id === 'number' && 'response' in e
    default:
      return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-protocol.test.js
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/protocol.ts tests/unit/embed-protocol.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): protocol envelope types + validator (Task 1)"
```

---

### Task 2: Origin validator

**Files:**
- Create: `src/embed/origin.ts`
- Test: `tests/unit/embed-origin.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/embed-origin.test.js
import { describe, expect, it } from 'vitest'
import { isOriginAllowed, parseAllowedOrigins } from '../../src/embed/origin.ts'

describe('embed origin validator', () => {
  it('allows exact-match origin', () => {
    expect(isOriginAllowed('https://example.com', ['https://example.com'])).toBe(true)
  })

  it('rejects unrelated origin', () => {
    expect(isOriginAllowed('https://evil.com', ['https://example.com'])).toBe(false)
  })

  it('wildcard "*" allows any origin', () => {
    expect(isOriginAllowed('https://anything.com', ['*'])).toBe(true)
  })

  it('empty list rejects everything', () => {
    expect(isOriginAllowed('https://example.com', [])).toBe(false)
  })

  it('parseAllowedOrigins splits comma-separated string', () => {
    expect(parseAllowedOrigins('https://a.com,https://b.com')).toEqual(['https://a.com', 'https://b.com'])
  })

  it('parseAllowedOrigins handles whitespace and empty entries', () => {
    expect(parseAllowedOrigins(' https://a.com , , https://b.com ')).toEqual(['https://a.com', 'https://b.com'])
  })

  it('parseAllowedOrigins of "*" returns ["*"]', () => {
    expect(parseAllowedOrigins('*')).toEqual(['*'])
  })

  it('parseAllowedOrigins of empty string returns []', () => {
    expect(parseAllowedOrigins('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-origin.test.js
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/embed/origin.ts`**

```ts
// src/embed/origin.ts
export function isOriginAllowed (origin: string, allowedOrigins: readonly string[]): boolean {
  if (allowedOrigins.length === 0) return false
  if (allowedOrigins.includes('*')) return true
  return allowedOrigins.includes(origin)
}

export function parseAllowedOrigins (raw: string): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(s => s.length > 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-origin.test.js
```

Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/origin.ts tests/unit/embed-origin.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): origin validator + allowedOrigins parser (Task 2)"
```

---

### Task 3: URL param parser

**Files:**
- Create: `src/embed/url-params.ts`
- Test: `tests/unit/embed-url-params.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/embed-url-params.test.js
import { describe, expect, it } from 'vitest'
import { parseEmbedURLParams } from '../../src/embed/url-params.ts'

describe('embed URL param parser', () => {
  it('returns defaults for empty URL', () => {
    const p = parseEmbedURLParams(new URLSearchParams(''))
    expect(p.embedMode).toBe(false)
    expect(p.chrome).toBe(undefined)
    expect(p.theme).toBe(undefined)
    expect(p.allowedOrigins).toEqual([])
    expect(p.dialogTimeoutMs).toBe(30000)
  })

  it('parses embed=1 as truthy', () => {
    expect(parseEmbedURLParams(new URLSearchParams('embed=1')).embedMode).toBe(true)
  })

  it('parses chrome preset', () => {
    expect(parseEmbedURLParams(new URLSearchParams('chrome=minimal')).chrome).toBe('minimal')
    expect(parseEmbedURLParams(new URLSearchParams('chrome=full')).chrome).toBe('full')
    expect(parseEmbedURLParams(new URLSearchParams('chrome=none')).chrome).toBe('none')
  })

  it('ignores invalid chrome value', () => {
    expect(parseEmbedURLParams(new URLSearchParams('chrome=bogus')).chrome).toBe(undefined)
  })

  it('parses theme as opaque string', () => {
    expect(parseEmbedURLParams(new URLSearchParams('theme=dark')).theme).toBe('dark')
    expect(parseEmbedURLParams(new URLSearchParams('theme=custom-x')).theme).toBe('custom-x')
  })

  it('parses allowedOrigins comma list', () => {
    const p = parseEmbedURLParams(new URLSearchParams('allowedOrigins=https://a.com,https://b.com'))
    expect(p.allowedOrigins).toEqual(['https://a.com', 'https://b.com'])
  })

  it('parses dialogTimeout integer', () => {
    expect(parseEmbedURLParams(new URLSearchParams('dialogTimeout=10000')).dialogTimeoutMs).toBe(10000)
  })

  it('rejects non-integer dialogTimeout, keeps default', () => {
    expect(parseEmbedURLParams(new URLSearchParams('dialogTimeout=abc')).dialogTimeoutMs).toBe(30000)
  })

  it('rejects negative dialogTimeout, keeps default', () => {
    expect(parseEmbedURLParams(new URLSearchParams('dialogTimeout=-1')).dialogTimeoutMs).toBe(30000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-url-params.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement `src/embed/url-params.ts`**

```ts
// src/embed/url-params.ts
import { parseAllowedOrigins } from './origin.ts'
import type { ChromePreset } from './protocol.ts'

export type EmbedURLParams = {
  embedMode: boolean
  chrome: ChromePreset | undefined
  theme: string | undefined
  allowedOrigins: string[]
  dialogTimeoutMs: number
}

const CHROME_PRESETS: readonly ChromePreset[] = ['full', 'minimal', 'none']
const DEFAULT_DIALOG_TIMEOUT_MS = 30000

export function parseEmbedURLParams (params: URLSearchParams): EmbedURLParams {
  const embedRaw = params.get('embed')
  const embedMode = embedRaw === '1' || embedRaw === 'true'

  const chromeRaw = params.get('chrome')
  const chrome = chromeRaw && (CHROME_PRESETS as readonly string[]).includes(chromeRaw)
    ? chromeRaw as ChromePreset
    : undefined

  const themeRaw = params.get('theme')
  const theme = themeRaw && themeRaw.length > 0 ? themeRaw : undefined

  const allowedOrigins = parseAllowedOrigins(params.get('allowedOrigins') ?? '')

  const timeoutRaw = params.get('dialogTimeout')
  const timeoutParsed = timeoutRaw === null ? NaN : Number(timeoutRaw)
  const dialogTimeoutMs = Number.isInteger(timeoutParsed) && timeoutParsed > 0
    ? timeoutParsed
    : DEFAULT_DIALOG_TIMEOUT_MS

  return { embedMode, chrome, theme, allowedOrigins, dialogTimeoutMs }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-url-params.test.js
```

Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/url-params.ts tests/unit/embed-url-params.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): URL param parser (Task 3)"
```

---

### Task 4: Chrome CSS-class application

**Files:**
- Create: `src/embed/chrome.ts`
- Test: `tests/unit/embed-chrome.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/embed-chrome.test.js
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyChrome, resolveChromePreset } from '../../src/embed/chrome.ts'

describe('embed chrome control', () => {
  beforeEach(() => {
    document.body.className = ''
  })

  it('resolveChromePreset full = all visible', () => {
    expect(resolveChromePreset('full')).toEqual({
      menu: true, toolbox: true, layers: true, palette: true, statusbar: true, header: true
    })
  })

  it('resolveChromePreset minimal = only toolbox', () => {
    expect(resolveChromePreset('minimal')).toEqual({
      menu: false, toolbox: true, layers: false, palette: false, statusbar: false, header: false
    })
  })

  it('resolveChromePreset none = all hidden', () => {
    expect(resolveChromePreset('none')).toEqual({
      menu: false, toolbox: false, layers: false, palette: false, statusbar: false, header: false
    })
  })

  it('applyChrome sets embed body class', () => {
    applyChrome(document.body, { menu: true, toolbox: true, layers: true, palette: true, statusbar: true, header: true })
    expect(document.body.classList.contains('embed')).toBe(true)
  })

  it('applyChrome adds no-* class per false element', () => {
    applyChrome(document.body, { menu: false, toolbox: true, layers: false, palette: true, statusbar: false, header: true })
    expect(document.body.classList.contains('no-menu')).toBe(true)
    expect(document.body.classList.contains('no-toolbox')).toBe(false)
    expect(document.body.classList.contains('no-layers')).toBe(true)
    expect(document.body.classList.contains('no-palette')).toBe(false)
    expect(document.body.classList.contains('no-statusbar')).toBe(true)
    expect(document.body.classList.contains('no-header')).toBe(false)
  })

  it('applyChrome removes stale no-* class when element re-enabled', () => {
    applyChrome(document.body, { menu: false })
    expect(document.body.classList.contains('no-menu')).toBe(true)
    applyChrome(document.body, { menu: true })
    expect(document.body.classList.contains('no-menu')).toBe(false)
  })

  it('applyChrome with empty state still tags body.embed', () => {
    applyChrome(document.body, {})
    expect(document.body.classList.contains('embed')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-chrome.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement `src/embed/chrome.ts`**

```ts
// src/embed/chrome.ts
import type { ChromePreset, ChromeState } from './protocol.ts'

const CHROME_ELEMENTS = ['menu', 'toolbox', 'layers', 'palette', 'statusbar', 'header'] as const

export function resolveChromePreset (preset: ChromePreset): Required<ChromeState> {
  switch (preset) {
    case 'full':
      return { menu: true, toolbox: true, layers: true, palette: true, statusbar: true, header: true }
    case 'minimal':
      return { menu: false, toolbox: true, layers: false, palette: false, statusbar: false, header: false }
    case 'none':
      return { menu: false, toolbox: false, layers: false, palette: false, statusbar: false, header: false }
  }
}

export function applyChrome (body: HTMLElement, state: ChromeState): void {
  body.classList.add('embed')
  for (const el of CHROME_ELEMENTS) {
    const visible = state[el]
    if (visible === false) {
      body.classList.add(`no-${el}`)
    } else if (visible === true) {
      body.classList.remove(`no-${el}`)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-chrome.test.js
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/chrome.ts tests/unit/embed-chrome.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): chrome CSS-class application (Task 4)"
```

---

### Task 5: Theme CSS-class application

**Files:**
- Create: `src/embed/theme.ts`
- Test: `tests/unit/embed-theme.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/embed-theme.test.js
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getCurrentTheme } from '../../src/embed/theme.ts'

describe('embed theme', () => {
  beforeEach(() => {
    document.body.className = ''
  })

  it('applyTheme adds theme-<name> class', () => {
    applyTheme(document.body, 'dark')
    expect(document.body.classList.contains('theme-dark')).toBe(true)
  })

  it('applyTheme replaces existing theme-* class', () => {
    applyTheme(document.body, 'dark')
    applyTheme(document.body, 'light')
    expect(document.body.classList.contains('theme-dark')).toBe(false)
    expect(document.body.classList.contains('theme-light')).toBe(true)
  })

  it('getCurrentTheme returns the active theme name', () => {
    applyTheme(document.body, 'custom-blue')
    expect(getCurrentTheme(document.body)).toBe('custom-blue')
  })

  it('getCurrentTheme returns null when no theme applied', () => {
    expect(getCurrentTheme(document.body)).toBe(null)
  })

  it('applyTheme rejects empty/whitespace theme name', () => {
    expect(() => applyTheme(document.body, '')).toThrow()
    expect(() => applyTheme(document.body, ' ')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-theme.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement `src/embed/theme.ts`**

```ts
// src/embed/theme.ts
const THEME_CLASS_PREFIX = 'theme-'

export function applyTheme (body: HTMLElement, theme: string): void {
  const trimmed = theme.trim()
  if (trimmed.length === 0) throw new Error('applyTheme: theme name cannot be empty')
  for (const cls of Array.from(body.classList)) {
    if (cls.startsWith(THEME_CLASS_PREFIX)) body.classList.remove(cls)
  }
  body.classList.add(`${THEME_CLASS_PREFIX}${trimmed}`)
}

export function getCurrentTheme (body: HTMLElement): string | null {
  for (const cls of Array.from(body.classList)) {
    if (cls.startsWith(THEME_CLASS_PREFIX)) {
      return cls.substring(THEME_CLASS_PREFIX.length)
    }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-theme.test.js
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/theme.ts tests/unit/embed-theme.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): theme CSS-class application (Task 5)"
```

---

## Phase 2: Server (Tasks 6-11)

### Task 6: EmbedServer — constructor + URL-param wire-up

**Files:**
- Create: `src/embed/server.ts` (initial sketch — extended in Tasks 7-9)
- Test: `tests/unit/embed-server.test.js` (initial sketch)

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/embed-server.test.js
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbedServer } from '../../src/embed/server.ts'

const makeFakeEditor = () => ({
  svgCanvas: { getZoom: () => 1.5, clearSelection: vi.fn() }
})

describe('EmbedServer — constructor + listener setup', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/')
  })

  it('does not attach when embedMode is false', () => {
    const editor = makeFakeEditor()
    const spy = vi.spyOn(window, 'addEventListener')
    const _server = new EmbedServer(editor, { detectEmbedMode: () => false })
    expect(spy).not.toHaveBeenCalledWith('message', expect.anything())
    spy.mockRestore()
  })

  it('attaches message listener when embedMode is true', () => {
    const editor = makeFakeEditor()
    const spy = vi.spyOn(window, 'addEventListener')
    const _server = new EmbedServer(editor, { detectEmbedMode: () => true, allowedOrigins: ['https://host.test'] })
    expect(spy).toHaveBeenCalledWith('message', expect.any(Function))
    spy.mockRestore()
  })

  it('applies URL-param chrome state on init', () => {
    window.history.replaceState({}, '', '/?embed=1&chrome=minimal')
    const editor = makeFakeEditor()
    const _server = new EmbedServer(editor)
    expect(document.body.classList.contains('embed')).toBe(true)
    expect(document.body.classList.contains('no-menu')).toBe(true)
    expect(document.body.classList.contains('no-toolbox')).toBe(false)
  })

  it('applies URL-param theme on init', () => {
    window.history.replaceState({}, '', '/?embed=1&theme=dark')
    const editor = makeFakeEditor()
    const _server = new EmbedServer(editor)
    expect(document.body.classList.contains('theme-dark')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement initial `src/embed/server.ts`**

```ts
// src/embed/server.ts
import { PROTOCOL_VERSION } from './protocol.ts'
import { parseEmbedURLParams } from './url-params.ts'
import { applyChrome, resolveChromePreset } from './chrome.ts'
import { applyTheme } from './theme.ts'

export type EmbedServerOptions = {
  detectEmbedMode?: (params: { embedMode: boolean }) => boolean
  allowedOrigins?: string[]
  dialogTimeoutMs?: number
}

export class EmbedServer {
  protected readonly editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>
  protected readonly allowedOrigins: readonly string[]
  protected dialogTimeoutMs: number
  private listener: ((e: MessageEvent) => void) | null = null

  constructor (editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>, opts: EmbedServerOptions = {}) {
    this.editor = editor
    const params = parseEmbedURLParams(new URLSearchParams(window.location.search))
    const embedMode = opts.detectEmbedMode
      ? opts.detectEmbedMode(params)
      : params.embedMode || window.parent !== window
    this.allowedOrigins = opts.allowedOrigins ?? params.allowedOrigins
    this.dialogTimeoutMs = opts.dialogTimeoutMs ?? params.dialogTimeoutMs

    if (!embedMode) return

    if (params.chrome) applyChrome(document.body, resolveChromePreset(params.chrome))
    else applyChrome(document.body, resolveChromePreset('none'))

    if (params.theme) applyTheme(document.body, params.theme)

    this.listener = (e: MessageEvent) => this.handleMessage(e)
    window.addEventListener('message', this.listener)
  }

  protected handleMessage (_e: MessageEvent): void {
    // Filled in by Task 7
  }

  dispose (): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
  }

  get _allowedOriginsForTest (): readonly string[] { return this.allowedOrigins }
}

export const _protocolVersion = PROTOCOL_VERSION
export type { ReadyPayload } from './protocol.ts'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/server.ts tests/unit/embed-server.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): EmbedServer constructor + URL-param wire-up (Task 6)"
```

---

### Task 7: EmbedServer — call dispatch + Element-handle round-trip

**Files:**
- Modify: `src/embed/server.ts`
- Modify: `tests/unit/embed-server.test.js`

- [ ] **Step 1: Append failing tests to `tests/unit/embed-server.test.js`**

```js
describe('EmbedServer — call dispatch', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('dispatches call to svgCanvas method and replies with result', async () => {
    const editor = { svgCanvas: { getZoom: () => 1.5 } }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 1, method: 'getZoom', args: [] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(replies).toContainEqual({ ns: 'svgedit', v: 1, kind: 'result', id: 1, result: 1.5 })
    server.dispose()
  })

  it('replies with METHOD_NOT_FOUND error for unknown method', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 2, method: 'doesNotExist', args: [] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(replies.some(r => r.kind === 'error' && r.id === 2 && r.code === 'METHOD_NOT_FOUND')).toBe(true)
    server.dispose()
  })

  it('drops messages from unauthorized origin (no reply)', async () => {
    const editor = { svgCanvas: { getZoom: () => 1.5 } }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 3, method: 'getZoom', args: [] },
      origin: 'https://evil.com',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(replies).toEqual([])
    server.dispose()
  })

  it('serializes Element return value to handle object', async () => {
    const el = document.createElement('div')
    el.id = 'test-element'
    document.body.appendChild(el)
    const editor = { svgCanvas: { getElem: (id) => document.getElementById(id) } }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 4, method: 'getElem', args: ['test-element'] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    const result = replies.find(r => r.kind === 'result' && r.id === 4)
    expect(result).toBeDefined()
    expect(result.result).toMatchObject({ __svgeditHandle: expect.any(String) })
    server.dispose()
  })

  it('deserializes inbound handle object into Element argument', async () => {
    const el = document.createElement('div')
    el.id = 'handle-test'
    document.body.appendChild(el)
    let captured = null
    const editor = {
      svgCanvas: {
        takesElement: (arg) => { captured = arg; return 'ok' },
        getElem: (id) => document.getElementById(id)
      }
    }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 5, method: 'getElem', args: ['handle-test'] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))
    const handle = replies.find(r => r.id === 5).result

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 6, method: 'takesElement', args: [handle] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(captured).toBe(el)
    server.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: FAIL — 5 new tests fail (handleMessage is still empty)

- [ ] **Step 3: Replace `src/embed/server.ts` with the extended implementation**

```ts
// src/embed/server.ts
import { PROTOCOL_VERSION, isValidEnvelope, isElementHandle, ERROR_CODES } from './protocol.ts'
import type { EmbedEnvelope, EmbedCall, ElementHandle } from './protocol.ts'
import { isOriginAllowed } from './origin.ts'
import { parseEmbedURLParams } from './url-params.ts'
import { applyChrome, resolveChromePreset } from './chrome.ts'
import { applyTheme } from './theme.ts'

export type EmbedServerOptions = {
  detectEmbedMode?: (params: { embedMode: boolean }) => boolean
  allowedOrigins?: string[]
  dialogTimeoutMs?: number
}

let handleCounter = 0
const handleMap = new WeakMap<Element, string>()
const reverseHandleMap = new Map<string, Element>()

function allocateHandle (el: Element): ElementHandle {
  let key = handleMap.get(el)
  if (!key) {
    handleCounter += 1
    key = `el-${handleCounter}`
    handleMap.set(el, key)
    reverseHandleMap.set(key, el)
  }
  return { __svgeditHandle: key }
}

function resolveHandle (h: ElementHandle): Element | undefined {
  return reverseHandleMap.get(h.__svgeditHandle)
}

function serializeForPostMessage (v: unknown): unknown {
  if (v instanceof Element) return allocateHandle(v)
  if (Array.isArray(v)) return v.map(serializeForPostMessage)
  if (v && typeof v === 'object' && !isElementHandle(v)) {
    const proto = Object.getPrototypeOf(v)
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {}
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        out[k] = serializeForPostMessage(vv)
      }
      return out
    }
  }
  return v
}

function deserializeArg (v: unknown): unknown {
  if (isElementHandle(v)) {
    const el = resolveHandle(v)
    if (!el) {
      throw Object.assign(new Error(`element handle not found: ${v.__svgeditHandle}`), { code: ERROR_CODES.ELEMENT_NOT_FOUND })
    }
    return el
  }
  if (Array.isArray(v)) return v.map(deserializeArg)
  if (v && typeof v === 'object') {
    const proto = Object.getPrototypeOf(v)
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {}
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        out[k] = deserializeArg(vv)
      }
      return out
    }
  }
  return v
}

export class EmbedServer {
  protected readonly editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>
  protected readonly allowedOrigins: readonly string[]
  protected dialogTimeoutMs: number
  private listener: ((e: MessageEvent) => void) | null = null

  constructor (editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>, opts: EmbedServerOptions = {}) {
    this.editor = editor
    const params = parseEmbedURLParams(new URLSearchParams(window.location.search))
    const embedMode = opts.detectEmbedMode
      ? opts.detectEmbedMode(params)
      : params.embedMode || window.parent !== window
    this.allowedOrigins = opts.allowedOrigins ?? params.allowedOrigins
    this.dialogTimeoutMs = opts.dialogTimeoutMs ?? params.dialogTimeoutMs

    if (!embedMode) return

    if (params.chrome) applyChrome(document.body, resolveChromePreset(params.chrome))
    else applyChrome(document.body, resolveChromePreset('none'))

    if (params.theme) applyTheme(document.body, params.theme)

    this.listener = (e: MessageEvent) => this.handleMessage(e)
    window.addEventListener('message', this.listener)
  }

  protected async handleMessage (e: MessageEvent): Promise<void> {
    if (!isOriginAllowed(e.origin, this.allowedOrigins)) {
      console.warn(`EmbedServer: rejected message from unauthorized origin: ${e.origin}`)
      return
    }
    if (!isValidEnvelope(e.data)) return

    const env = e.data
    switch (env.kind) {
      case 'call':
        await this.handleCall(env)
        return
      default:
        return
    }
  }

  protected async handleCall (env: EmbedCall): Promise<void> {
    try {
      const target = (this.editor.svgCanvas[env.method] !== undefined ? this.editor.svgCanvas : this.editor) as Record<string, unknown>
      const fn = target[env.method]
      if (typeof fn !== 'function') {
        throw Object.assign(new Error(`method not found: ${env.method}`), { code: ERROR_CODES.METHOD_NOT_FOUND })
      }
      const deserializedArgs = env.args.map(deserializeArg)
      const raw = await (fn as (...args: unknown[]) => unknown).apply(target, deserializedArgs)
      const result = serializeForPostMessage(raw)
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result })
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      this.reply({
        ns: 'svgedit', v: 1, kind: 'error', id: env.id,
        message: error.message ?? String(err),
        stack: error.stack,
        code: error.code
      })
    }
  }

  protected reply (env: EmbedEnvelope): void {
    const targetOrigin = this.allowedOrigins[0] === '*' ? '*' : (this.allowedOrigins[0] ?? window.location.origin)
    window.parent.postMessage(env, targetOrigin)
  }

  dispose (): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
  }

  get _allowedOriginsForTest (): readonly string[] { return this.allowedOrigins }
}

export const _protocolVersion = PROTOCOL_VERSION
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: PASS — 9 tests total (4 from Task 6 + 5 new)

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/server.ts tests/unit/embed-server.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): EmbedServer call dispatch + Element-handle round-trip (Task 7)"
```

---

### Task 8: EmbedServer — event emission + ready()

**Files:**
- Modify: `src/embed/server.ts`
- Modify: `tests/unit/embed-server.test.js`

- [ ] **Step 1: Append tests**

```js
describe('EmbedServer — event emission', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('emit() posts envelope to window.parent', () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    const sent = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => sent.push(env))
    server.emit('ready', { version: '7.4.1', protocolVersion: 1, capabilities: ['chrome'] })
    expect(sent).toContainEqual({
      ns: 'svgedit', v: 1, kind: 'event', name: 'ready',
      payload: { version: '7.4.1', protocolVersion: 1, capabilities: ['chrome'] }
    })
    server.dispose()
  })

  it('ready() helper emits ready event with declared capabilities', () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, { version: '7.4.1' })
    const sent = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => sent.push(env))
    server.ready()
    const readyEvent = sent.find(s => s.kind === 'event' && s.name === 'ready')
    expect(readyEvent).toBeDefined()
    expect(readyEvent.payload.protocolVersion).toBe(1)
    expect(readyEvent.payload.capabilities).toEqual(expect.arrayContaining(['chrome', 'theme', 'dialog-hooks']))
    server.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: FAIL — 2 new tests fail

- [ ] **Step 3: Add `version` + `emit` + `ready` to `src/embed/server.ts`**

Extend `EmbedServerOptions`:

```ts
export type EmbedServerOptions = {
  detectEmbedMode?: (params: { embedMode: boolean }) => boolean
  allowedOrigins?: string[]
  dialogTimeoutMs?: number
  version?: string
}
```

Add to the class:

```ts
protected readonly version: string
```

In constructor (after `this.dialogTimeoutMs = ...`):

```ts
this.version = opts.version ?? '0.0.0-unknown'
```

Add methods:

```ts
emit (name: import('./protocol.ts').EmbedEventName, payload: unknown): void {
  this.reply({ ns: 'svgedit', v: 1, kind: 'event', name, payload })
}

ready (capabilities: string[] = ['chrome', 'theme', 'dialog-hooks']): void {
  this.emit('ready', { version: this.version, protocolVersion: PROTOCOL_VERSION, capabilities })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/server.ts tests/unit/embed-server.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): EmbedServer event emission + ready() (Task 8)"
```

---

### Task 9: EmbedServer — dialog hook fallback

**Files:**
- Modify: `src/embed/server.ts`
- Modify: `tests/unit/embed-server.test.js`

- [ ] **Step 1: Append tests**

```js
describe('EmbedServer — dialog hook', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('falls back to default alert handler when no host-registered handler', async () => {
    let internalCalled = false
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, {
      defaultDialogHandlers: {
        alert: async () => { internalCalled = true; return undefined },
        confirm: async () => true,
        prompt: async () => 'default-input'
      }
    })
    const result = await server.requestDialog('alert', ['hello'])
    expect(internalCalled).toBe(true)
    expect(result).toBeUndefined()
    server.dispose()
  })

  it('uses registered host handler via postMessage round-trip', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, {
      defaultDialogHandlers: {
        alert: async () => undefined,
        confirm: async () => true,
        prompt: async () => 'default'
      }
    })
    server.markHostHandlerRegistered('prompt')

    const sent = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => sent.push(env))

    const p = server.requestDialog('prompt', ['enter name', ''])

    const reqEnv = sent.find(s => s.kind === 'dialog-request' && s.dialog === 'prompt')
    expect(reqEnv).toBeDefined()

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'dialog-response', id: reqEnv.id, response: 'jamie' },
      origin: 'https://host.test',
      source: window
    }))

    const result = await p
    expect(result).toBe('jamie')
    server.dispose()
  })

  it('falls back to default if host handler times out', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, {
      dialogTimeoutMs: 50,
      defaultDialogHandlers: {
        alert: async () => undefined,
        confirm: async () => true,
        prompt: async () => 'TIMED-OUT-FALLBACK'
      }
    })
    server.markHostHandlerRegistered('prompt')

    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const result = await server.requestDialog('prompt', ['enter name', ''])
    expect(result).toBe('TIMED-OUT-FALLBACK')
    server.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: FAIL — 3 new tests fail

- [ ] **Step 3: Add dialog hook server to `src/embed/server.ts`**

Add types + extend options:

```ts
export type DialogKind = 'prompt' | 'alert' | 'confirm'
export type DialogHandlers = {
  prompt: (text: string, defaultValue: string) => Promise<string | null>
  alert: (text: string) => Promise<void>
  confirm: (text: string) => Promise<boolean>
}

export type EmbedServerOptions = {
  detectEmbedMode?: (params: { embedMode: boolean }) => boolean
  allowedOrigins?: string[]
  dialogTimeoutMs?: number
  version?: string
  defaultDialogHandlers?: DialogHandlers
}
```

Add fields:

```ts
private readonly defaultDialogHandlers: DialogHandlers
private readonly hostHandlersRegistered: Set<DialogKind> = new Set()
private readonly pendingDialogReplies: Map<number, (response: unknown) => void> = new Map()
private dialogIdCounter = 0
```

In constructor:

```ts
this.defaultDialogHandlers = opts.defaultDialogHandlers ?? {
  alert: async (msg) => { window.alert(msg) },
  confirm: async (msg) => window.confirm(msg),
  prompt: async (msg, def) => window.prompt(msg, def)
}
```

Extend `handleMessage` switch to handle `dialog-response`:

```ts
case 'dialog-response': {
  const resolve = this.pendingDialogReplies.get(env.id)
  if (resolve) {
    this.pendingDialogReplies.delete(env.id)
    resolve(env.response)
  }
  return
}
```

Add methods:

```ts
markHostHandlerRegistered (kind: DialogKind): void { this.hostHandlersRegistered.add(kind) }
unmarkHostHandlerRegistered (kind: DialogKind): void { this.hostHandlersRegistered.delete(kind) }

async requestDialog (kind: DialogKind, args: unknown[]): Promise<unknown> {
  if (!this.hostHandlersRegistered.has(kind)) {
    return this.invokeDefaultDialog(kind, args)
  }
  this.dialogIdCounter += 1
  const id = this.dialogIdCounter
  const responsePromise = new Promise<unknown>((resolve) => {
    this.pendingDialogReplies.set(id, resolve)
  })
  this.reply({ ns: 'svgedit', v: 1, kind: 'dialog-request', id, dialog: kind, args })
  const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
    setTimeout(() => resolve({ timeout: true }), this.dialogTimeoutMs)
  )
  const winner = await Promise.race([responsePromise, timeoutPromise])
  if (typeof winner === 'object' && winner !== null && 'timeout' in winner) {
    this.pendingDialogReplies.delete(id)
    this.emit('error', { message: 'dialog handler timed out', source: 'dialog-handler-timeout' })
    return this.invokeDefaultDialog(kind, args)
  }
  return winner
}

private async invokeDefaultDialog (kind: DialogKind, args: unknown[]): Promise<unknown> {
  switch (kind) {
    case 'alert':   return this.defaultDialogHandlers.alert(args[0] as string)
    case 'confirm': return this.defaultDialogHandlers.confirm(args[0] as string)
    case 'prompt':  return this.defaultDialogHandlers.prompt(args[0] as string, (args[1] ?? '') as string)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: PASS — 14 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/server.ts tests/unit/embed-server.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): EmbedServer dialog hook system (Task 9)"
```

---

### Task 10: EmbedServer — control-message handlers (dialog registration, setTheme, setChrome, setDialogTimeout)

**Files:**
- Modify: `src/embed/server.ts`
- Modify: `tests/unit/embed-server.test.js`

- [ ] **Step 1: Append tests**

```js
describe('EmbedServer — control messages', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('__registerDialogHandler marks handler registered', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 100, method: '__registerDialogHandler', args: ['prompt'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(server._isHostHandlerRegistered('prompt')).toBe(true)
    server.dispose()
  })

  it('__unregisterDialogHandler unmarks it', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    server.markHostHandlerRegistered('alert')

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 101, method: '__unregisterDialogHandler', args: ['alert'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(server._isHostHandlerRegistered('alert')).toBe(false)
    server.dispose()
  })

  it('__setTheme applies theme via theme module', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 102, method: '__setTheme', args: ['dark'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(document.body.classList.contains('theme-dark')).toBe(true)
    server.dispose()
  })

  it('__setChrome with preset string applies preset', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 103, method: '__setChrome', args: ['minimal'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(document.body.classList.contains('no-menu')).toBe(true)
    expect(document.body.classList.contains('no-toolbox')).toBe(false)
    server.dispose()
  })

  it('__setChrome with object applies per-element state', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 104, method: '__setChrome', args: [{ menu: true }] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(document.body.classList.contains('no-menu')).toBe(false)
    server.dispose()
  })

  it('__setDialogTimeout updates timeout (positive integer only)', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 105, method: '__setDialogTimeout', args: [5000] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(server._dialogTimeoutForTest()).toBe(5000)
    server.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: FAIL — 6 new tests fail

- [ ] **Step 3: Add control-message handlers to `handleCall` in `src/embed/server.ts`**

At the TOP of `handleCall` (before the existing method-lookup block), add:

```ts
import type { ChromeState, ChromePreset } from './protocol.ts'

// ... inside handleCall, before the target = ... line:

if (env.method === '__registerDialogHandler') {
  this.markHostHandlerRegistered(env.args[0] as DialogKind)
  this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
  return
}
if (env.method === '__unregisterDialogHandler') {
  this.unmarkHostHandlerRegistered(env.args[0] as DialogKind)
  this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
  return
}
if (env.method === '__setTheme') {
  applyTheme(document.body, env.args[0] as string)
  this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
  return
}
if (env.method === '__setChrome') {
  const arg = env.args[0]
  const state: ChromeState = typeof arg === 'string'
    ? resolveChromePreset(arg as ChromePreset)
    : arg as ChromeState
  applyChrome(document.body, state)
  this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
  return
}
if (env.method === '__setDialogTimeout') {
  const ms = env.args[0]
  if (typeof ms === 'number' && Number.isInteger(ms) && ms > 0) {
    this.dialogTimeoutMs = ms
  }
  this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
  return
}
```

Also add test-accessors:

```ts
_isHostHandlerRegistered (kind: DialogKind): boolean { return this.hostHandlersRegistered.has(kind) }
_dialogTimeoutForTest (): number { return this.dialogTimeoutMs }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-server.test.js
```

Expected: PASS — 20 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/server.ts tests/unit/embed-server.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): EmbedServer control-message handlers (Task 10)"
```

---

### Task 11: Wire EmbedServer into Editor.ts + wire svgCanvas events

**Files:**
- Modify: `src/editor/Editor.ts` (around line 324)

- [ ] **Step 1: Read the current Editor.ts constructor end**

Read lines 318-330 of `src/editor/Editor.ts` to confirm the wire-in point.

- [ ] **Step 2: Apply edits to `src/editor/Editor.ts`**

Add ONE import at the top (alongside existing imports):

```ts
import { EmbedServer } from '../embed/server.ts'
const SVGEDIT_VERSION = '7.4.1'
```

**Do NOT add** `import { seAlert, seConfirm } ...` — `seAlert` and `seConfirm` are attached to `window` by their respective dialog modules at module-load time (see `src/editor/dialogs/seAlertDialog.ts:15`'s `;(window as any).seAlert = seAlert`). Each consumer file uses ambient `declare function` declarations — `Editor.ts` already has these at lines 32-33:
```ts
declare function seAlert (msg: string): void
declare function seConfirm (msg: string): boolean | Promise<boolean | string>
```
Reuse those existing declarations; no new import or declare statement needed.

Add private field in the class body:

```ts
private _embedServer!: EmbedServer
```

Replace the end-of-constructor block:

OLD:
```ts
    this.mainMenu = new MainMenu(this)
    // makes svgEditor accessible as a global variable
    window.svgEditor = this
  } // end Constructor
```

NEW:
```ts
    this.mainMenu = new MainMenu(this)
    // makes svgEditor accessible as a global variable
    window.svgEditor = this

    // Embed-API wire-in (Task 11). Activates only when ?embed=1 OR window.parent !== window.
    // Default dialog handlers wrap existing window.seAlert / window.seConfirm (see ambient declarations at lines 32-33).
    this._embedServer = new EmbedServer(this as unknown as { svgCanvas: Record<string, unknown> }, {
      version: SVGEDIT_VERSION,
      defaultDialogHandlers: {
        alert: async (msg) => { seAlert(msg) },
        confirm: async (msg) => {
          const result = await seConfirm(msg)
          return Boolean(result)
        },
        prompt: async (_msg, def) => {
          // V7 lacks a real prompt-with-input (audit input #4 — sePromptDialog is status-display).
          // Until #13 adds a real prompt, return the default; hosts that need real prompts must register a handler.
          return def ?? null
        }
      }
    })

    // Wire svgCanvas events to embed event channel
    const sc = this.svgCanvas as unknown as { bind?: (name: string, fn: (...args: unknown[]) => void) => void }
    if (typeof sc.bind === 'function') {
      let changeTimer: ReturnType<typeof setTimeout> | null = null
      sc.bind('changed', () => {
        if (changeTimer) clearTimeout(changeTimer)
        changeTimer = setTimeout(() => this._embedServer.emit('change', {}), 200)
      })
      sc.bind('selected', (selected: unknown) => {
        const arr = Array.isArray(selected) ? selected as Element[] : []
        this._embedServer.emit('selection-changed', {
          count: arr.length,
          ids: arr.map(e => e?.id).filter((s): s is string => typeof s === 'string' && s.length > 0)
        })
      })
    }
  } // end Constructor
```

- [ ] **Step 3: Hook the existing `svgEditor:ready` event to fire `_embedServer.ready()`**

Find the existing `svgEditor:ready` dispatch (likely in `EditorStartup.ts`):

```bash
grep -rn "svgEditor:ready" "C:/Users/jscha/source/repos/svgedit/src/editor"
```

Add an embed `ready()` call IMMEDIATELY after the existing dispatch. Example pattern (exact line depends on grep output):

```ts
window.dispatchEvent(new CustomEvent('svgEditor:ready'))
// Fire embed ready event after the existing DOM-level signal
window.svgEditor._embedServer?.ready()
```

- [ ] **Step 4: Verify**

```bash
cd C:/Users/jscha/source/repos/svgedit
npx tsc --build --force
npm run lint
npx vitest run
```

Expected:
- tsc 0 errors
- lint 0 errors (warnings OK; baseline 145)
- vitest: 564 baseline + ~50 new from Tasks 1-10 = ~614 total. Re-measure at this step.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/Editor.ts src/editor/EditorStartup.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): wire EmbedServer into Editor.ts + svgCanvas event bridge (Task 11)"
```

---

## Phase 3: Client (Tasks 12-16)

### Task 12: SvgEditEmbed — constructor + ready awaiter

**Files:**
- Create: `src/embed/client.ts`
- Test: `tests/unit/embed-client.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/embed-client.test.js
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SvgEditEmbed } from '../../src/embed/client.ts'

const buildIframe = (src = 'https://editor.test/') => {
  document.body.replaceChildren()
  const iframe = document.createElement('iframe')
  iframe.id = 'svge'
  iframe.src = src
  document.body.appendChild(iframe)
  Object.defineProperty(iframe, 'contentWindow', { value: window, configurable: true })
  return iframe
}

describe('SvgEditEmbed — constructor + ready', () => {
  let iframe
  beforeEach(() => {
    iframe = buildIframe()
  })

  it('does not throw with default options', () => {
    expect(() => new SvgEditEmbed(iframe, {})).not.toThrow()
  })

  it('exposes a ready Promise that resolves on ready event', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready',
                payload: { version: '7.4.1', protocolVersion: 1, capabilities: ['chrome', 'theme', 'dialog-hooks'] } },
        origin: 'https://editor.test',
        source: iframe.contentWindow
      }))
    }, 0)
    const payload = await client.ready
    expect(payload.version).toBe('7.4.1')
    expect(payload.protocolVersion).toBe(1)
    client.dispose()
  })

  it('rejects ready if protocolVersion mismatches', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready',
                payload: { version: '8.0.0', protocolVersion: 2, capabilities: [] } },
        origin: 'https://editor.test',
        source: iframe.contentWindow
      }))
    }, 0)
    await expect(client.ready).rejects.toThrow(/protocolVersion mismatch/)
    client.dispose()
  })

  it('drops messages from unauthorized origin', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: [] } },
        origin: 'https://evil.com',
        source: iframe.contentWindow
      }))
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: [] } },
        origin: 'https://editor.test',
        source: iframe.contentWindow
      }))
    }, 0)
    const payload = await client.ready
    expect(payload.version).toBe('7.4.1')
    client.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement `src/embed/client.ts`**

```ts
// src/embed/client.ts
import { PROTOCOL_VERSION, isValidEnvelope } from './protocol.ts'
import type { EmbedEnvelope, ReadyPayload } from './protocol.ts'
import { isOriginAllowed } from './origin.ts'

export type SvgEditEmbedOptions = {
  allowedOrigins?: string[]
}

export class SvgEditEmbed {
  protected readonly iframe: HTMLIFrameElement
  protected readonly allowedOrigins: readonly string[]
  private listener: ((e: MessageEvent) => void) | null = null
  private readonly _ready: Promise<ReadyPayload>
  private _resolveReady!: (p: ReadyPayload) => void
  private _rejectReady!: (e: Error) => void

  constructor (iframe: HTMLIFrameElement, opts: SvgEditEmbedOptions = {}) {
    this.iframe = iframe
    this.allowedOrigins = opts.allowedOrigins ?? [new URL(iframe.src, window.location.href).origin]

    this._ready = new Promise<ReadyPayload>((resolve, reject) => {
      this._resolveReady = resolve
      this._rejectReady = reject
    })

    this.listener = (e: MessageEvent) => this.handleMessage(e)
    window.addEventListener('message', this.listener)
  }

  get ready (): Promise<ReadyPayload> { return this._ready }

  protected handleMessage (e: MessageEvent): void {
    if (e.source !== this.iframe.contentWindow) return
    if (!isOriginAllowed(e.origin, this.allowedOrigins)) {
      console.warn(`SvgEditEmbed: rejected message from unauthorized origin: ${e.origin}`)
      return
    }
    if (!isValidEnvelope(e.data)) return
    const env = e.data as EmbedEnvelope
    if (env.kind === 'event' && env.name === 'ready') {
      const payload = env.payload as ReadyPayload
      if (payload.protocolVersion !== PROTOCOL_VERSION) {
        this._rejectReady(new Error(`svgedit embed: protocolVersion mismatch — host expects ${PROTOCOL_VERSION}, editor reports ${payload.protocolVersion}`))
        return
      }
      this._resolveReady(payload)
    }
  }

  dispose (): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/client.ts tests/unit/embed-client.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): SvgEditEmbed constructor + ready awaiter (Task 12)"
```

---

### Task 13: SvgEditEmbed — Proxy + Promise correlation + queued-call flush

**Files:**
- Modify: `src/embed/client.ts`
- Modify: `tests/unit/embed-client.test.js`

- [ ] **Step 1: Append tests**

```js
const buildIframeWithStubPM = () => {
  document.body.replaceChildren()
  const iframe = document.createElement('iframe')
  iframe.id = 'svge'
  iframe.src = 'https://editor.test/'
  document.body.appendChild(iframe)
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true })
  return iframe
}

describe('SvgEditEmbed — Proxy method dispatch', () => {
  let iframe
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  const fireReady = () => window.dispatchEvent(new MessageEvent('message', {
    data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: [] } },
    origin: 'https://editor.test',
    source: iframe.contentWindow
  }))

  it('Proxy forwards method calls via postMessage with id correlation', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(fireReady, 0)
    await client.ready

    const callPromise = client.editor.getZoom()

    expect(iframe.contentWindow.postMessage).toHaveBeenCalled()
    const sentEnv = iframe.contentWindow.postMessage.mock.calls[0][0]
    expect(sentEnv.kind).toBe('call')
    expect(sentEnv.method).toBe('getZoom')
    expect(sentEnv.args).toEqual([])

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'result', id: sentEnv.id, result: 1.5 },
      origin: 'https://editor.test',
      source: iframe.contentWindow
    }))

    const result = await callPromise
    expect(result).toBe(1.5)
    client.dispose()
  })

  it('Proxy rejects Promise on error reply', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(fireReady, 0)
    await client.ready

    const callPromise = client.editor.bogusMethod()
    const sentEnv = iframe.contentWindow.postMessage.mock.calls[0][0]
    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'error', id: sentEnv.id, message: 'method not found: bogusMethod', code: 'METHOD_NOT_FOUND' },
      origin: 'https://editor.test',
      source: iframe.contentWindow
    }))

    await expect(callPromise).rejects.toThrow(/method not found/)
    client.dispose()
  })

  it('queued calls before ready are flushed after ready resolves', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const callPromise = client.editor.getZoom()

    expect(iframe.contentWindow.postMessage).not.toHaveBeenCalled()

    fireReady()
    await client.ready

    expect(iframe.contentWindow.postMessage).toHaveBeenCalled()
    const sentEnv = iframe.contentWindow.postMessage.mock.calls[0][0]
    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'result', id: sentEnv.id, result: 2.0 },
      origin: 'https://editor.test',
      source: iframe.contentWindow
    }))
    expect(await callPromise).toBe(2.0)
    client.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: FAIL — 3 new tests fail

- [ ] **Step 3: Extend `src/embed/client.ts`**

Add fields:

```ts
private readonly pendingCalls: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map()
private callIdCounter = 0
private readonly callQueue: Array<{ method: string; args: unknown[]; resolve: (v: unknown) => void; reject: (e: Error) => void }> = []
private isReady = false
```

Add `editor` Proxy getter:

```ts
get editor (): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const self = this
  return new Proxy({}, {
    get (_target, prop: string) {
      return (...args: unknown[]) => self.call(prop, args)
    }
  }) as Record<string, (...args: unknown[]) => Promise<unknown>>
}

protected call (method: string, args: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!this.isReady) {
      this.callQueue.push({ method, args, resolve, reject })
      return
    }
    this.dispatchCall(method, args, resolve, reject)
  })
}

private dispatchCall (method: string, args: unknown[], resolve: (v: unknown) => void, reject: (e: Error) => void): void {
  this.callIdCounter += 1
  const id = this.callIdCounter
  this.pendingCalls.set(id, { resolve, reject })
  const env = { ns: 'svgedit' as const, v: 1 as const, kind: 'call' as const, id, method, args }
  this.iframe.contentWindow!.postMessage(env, new URL(this.iframe.src, window.location.href).origin)
}
```

Extend `handleMessage` — after the existing `ready` block, set `isReady` + flush queue:

```ts
if (env.kind === 'event' && env.name === 'ready') {
  const payload = env.payload as ReadyPayload
  if (payload.protocolVersion !== PROTOCOL_VERSION) {
    this._rejectReady(new Error(`svgedit embed: protocolVersion mismatch — host expects ${PROTOCOL_VERSION}, editor reports ${payload.protocolVersion}`))
    return
  }
  this.isReady = true
  this._resolveReady(payload)
  while (this.callQueue.length > 0) {
    const q = this.callQueue.shift()!
    this.dispatchCall(q.method, q.args, q.resolve, q.reject)
  }
  return
}
if (env.kind === 'result') {
  const pending = this.pendingCalls.get(env.id)
  if (pending) {
    this.pendingCalls.delete(env.id)
    pending.resolve(env.result)
  }
  return
}
if (env.kind === 'error') {
  const pending = this.pendingCalls.get(env.id)
  if (pending) {
    this.pendingCalls.delete(env.id)
    const err = Object.assign(new Error(env.message), env.code ? { code: env.code } : {})
    pending.reject(err)
  }
  return
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/client.ts tests/unit/embed-client.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): SvgEditEmbed Proxy + Promise correlation + queued-call flush (Task 13)"
```

---

### Task 14: SvgEditEmbed — event subscription (on/off/once)

**Files:**
- Modify: `src/embed/client.ts`
- Modify: `tests/unit/embed-client.test.js`

- [ ] **Step 1: Append tests**

```js
describe('SvgEditEmbed — event subscription', () => {
  let iframe
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  it('on(name, handler) receives matching events', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const received = []
    client.on('save', (payload) => received.push(payload))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'save', payload: { svgString: '<svg/>' } },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    expect(received).toEqual([{ svgString: '<svg/>' }])
    client.dispose()
  })

  it('off(name, handler) removes the subscription', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const received = []
    const handler = (payload) => received.push(payload)
    client.on('change', handler)
    client.off('change', handler)

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'change', payload: {} },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    expect(received).toEqual([])
    client.dispose()
  })

  it('once(name, handler) fires only once', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    let count = 0
    client.once('change', () => count += 1)

    const fire = () => window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'change', payload: {} },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    fire(); fire(); fire()
    expect(count).toBe(1)
    client.dispose()
  })

  it('multiple subscribers all receive the same event', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    let a = 0, b = 0
    client.on('change', () => a += 1)
    client.on('change', () => b += 1)

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'change', payload: {} },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    expect(a).toBe(1)
    expect(b).toBe(1)
    client.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: FAIL — 4 new tests fail

- [ ] **Step 3: Add event subscription to `src/embed/client.ts`**

Add fields + methods:

```ts
import type { EmbedEventName } from './protocol.ts'

type EventHandler = (payload: unknown) => void

private readonly eventHandlers: Map<EmbedEventName, Set<EventHandler>> = new Map()

on (name: EmbedEventName, handler: EventHandler): () => void {
  let set = this.eventHandlers.get(name)
  if (!set) {
    set = new Set()
    this.eventHandlers.set(name, set)
  }
  set.add(handler)
  return () => this.off(name, handler)
}

off (name: EmbedEventName, handler: EventHandler): void {
  this.eventHandlers.get(name)?.delete(handler)
}

once (name: EmbedEventName, handler: EventHandler): () => void {
  const wrapped = (payload: unknown) => {
    this.off(name, wrapped)
    handler(payload)
  }
  return this.on(name, wrapped)
}

private dispatchEvent (name: EmbedEventName, payload: unknown): void {
  this.eventHandlers.get(name)?.forEach(h => h(payload))
}
```

In `handleMessage`, AFTER the existing ready-handling block, add a generic event dispatch:

```ts
if (env.kind === 'event') {
  this.dispatchEvent(env.name as EmbedEventName, env.payload)
  return
}
```

Make sure the ready-handling block returns AFTER dispatching to subscribers as well (so hosts that subscribe to `on('ready', ...)` also see it):

```ts
if (env.kind === 'event' && env.name === 'ready') {
  // ... existing protocol-version + resolve logic ...
  // After resolving:
  this.dispatchEvent('ready', env.payload)
  // ... queue flush ...
  return
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/client.ts tests/unit/embed-client.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): SvgEditEmbed event subscription (on/off/once) (Task 14)"
```

---

### Task 15: SvgEditEmbed — dialog handler API

**Files:**
- Modify: `src/embed/client.ts`
- Modify: `tests/unit/embed-client.test.js`

- [ ] **Step 1: Append tests**

```js
describe('SvgEditEmbed — dialog handlers', () => {
  let iframe
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  const fireReady = () => window.dispatchEvent(new MessageEvent('message', {
    data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: [] } },
    origin: 'https://editor.test', source: iframe.contentWindow
  }))

  it('setDialogHandler routes dialog-request to handler and posts response', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady()
    await client.ready

    client.setDialogHandler('prompt', async (text, def) => `${text}=${def}`)

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'dialog-request', id: 99, dialog: 'prompt', args: ['name?', 'anon'] },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    await new Promise(r => setTimeout(r, 10))

    const respEnv = iframe.contentWindow.postMessage.mock.calls
      .map(c => c[0]).find(e => e.kind === 'dialog-response' && e.id === 99)
    expect(respEnv).toBeDefined()
    expect(respEnv.response).toBe('name?=anon')
    client.dispose()
  })

  it('setDialogHandler returns an unregister function', () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const off = client.setDialogHandler('alert', async () => undefined)
    expect(typeof off).toBe('function')
    off()
    client.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: FAIL — 2 new tests fail

- [ ] **Step 3: Add dialog handler API**

Add to `src/embed/client.ts`:

```ts
type DialogKind = 'prompt' | 'alert' | 'confirm'
type DialogHandler = (text: string, defaultValue?: string) => Promise<unknown>

private readonly dialogHandlers: Map<DialogKind, DialogHandler> = new Map()

setDialogHandler (kind: DialogKind, handler: DialogHandler): () => void {
  this.dialogHandlers.set(kind, handler)
  void this.call('__registerDialogHandler', [kind])
  return () => {
    this.dialogHandlers.delete(kind)
    void this.call('__unregisterDialogHandler', [kind])
  }
}

private async handleDialogRequest (env: { id: number; dialog: DialogKind; args: unknown[] }): Promise<void> {
  const handler = this.dialogHandlers.get(env.dialog)
  if (!handler) return
  const response = await handler(env.args[0] as string, env.args[1] as string | undefined)
  const respEnv = { ns: 'svgedit' as const, v: 1 as const, kind: 'dialog-response' as const, id: env.id, response }
  this.iframe.contentWindow!.postMessage(respEnv, new URL(this.iframe.src, window.location.href).origin)
}
```

In `handleMessage`, add:

```ts
if (env.kind === 'dialog-request') {
  void this.handleDialogRequest(env)
  return
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: PASS — 13 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/client.ts tests/unit/embed-client.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): SvgEditEmbed dialog handler API (Task 15)"
```

---

### Task 16: SvgEditEmbed — convenience methods (setTheme / setChrome / setDialogTimeout)

**Files:**
- Modify: `src/embed/client.ts`
- Modify: `tests/unit/embed-client.test.js`

- [ ] **Step 1: Append tests**

```js
describe('SvgEditEmbed — convenience methods', () => {
  let iframe
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  const fireReady = () => window.dispatchEvent(new MessageEvent('message', {
    data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: ['chrome', 'theme'] } },
    origin: 'https://editor.test', source: iframe.contentWindow
  }))

  it('setTheme posts a __setTheme call', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady()
    await client.ready

    void client.setTheme('dark')
    const sent = iframe.contentWindow.postMessage.mock.calls.map(c => c[0])
    expect(sent.some(e => e.kind === 'call' && e.method === '__setTheme' && e.args[0] === 'dark')).toBe(true)
    client.dispose()
  })

  it('setChrome posts a __setChrome call with preset', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady()
    await client.ready

    void client.setChrome('minimal')
    const sent = iframe.contentWindow.postMessage.mock.calls.map(c => c[0])
    expect(sent.some(e => e.kind === 'call' && e.method === '__setChrome' && e.args[0] === 'minimal')).toBe(true)
    client.dispose()
  })

  it('setDialogTimeout posts a __setDialogTimeout call', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady()
    await client.ready

    void client.setDialogTimeout(15000)
    const sent = iframe.contentWindow.postMessage.mock.calls.map(c => c[0])
    expect(sent.some(e => e.kind === 'call' && e.method === '__setDialogTimeout' && e.args[0] === 15000)).toBe(true)
    client.dispose()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: FAIL — 3 new tests fail

- [ ] **Step 3: Add convenience methods to `src/embed/client.ts`**

```ts
import type { ChromeState, ChromePreset } from './protocol.ts'

setTheme (theme: string): Promise<unknown> {
  return this.call('__setTheme', [theme])
}

setChrome (state: ChromeState | ChromePreset): Promise<unknown> {
  return this.call('__setChrome', [state])
}

setDialogTimeout (ms: number): Promise<unknown> {
  return this.call('__setDialogTimeout', [ms])
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/embed-client.test.js
```

Expected: PASS — 16 tests

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/client.ts tests/unit/embed-client.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(embed): SvgEditEmbed convenience methods (setTheme/setChrome/setDialogTimeout) (Task 16)"
```

---

## Phase 4: Build pipeline (Task 17)

### Task 17: Index barrel + tsconfig.embed + package exports

**Files:**
- Create: `src/embed/index.ts`
- Create: `tsconfig.embed.json`
- Modify: `package.json`

- [ ] **Step 1: Create index barrel**

```ts
// src/embed/index.ts
export { SvgEditEmbed } from './client.ts'
export type { SvgEditEmbedOptions } from './client.ts'
export { PROTOCOL_VERSION, ERROR_CODES } from './protocol.ts'
export type {
  EmbedEnvelope, EmbedEventName, ReadyPayload, ChromeState, ChromePreset, ElementHandle
} from './protocol.ts'
```

- [ ] **Step 2: Create `tsconfig.embed.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src/embed",
    "outDir": "dist/embed",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "noEmit": false,
    "module": "ES2022",
    "moduleResolution": "Bundler"
  },
  "include": ["src/embed/**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.test.js"]
}
```

- [ ] **Step 3: Add build script + exports to `package.json`**

In `scripts` block, change `build` and add `build:embed`:

```json
"build:embed": "tsc --project tsconfig.embed.json",
"build": "vite build packages/svgcanvas && vite build && npm run build:embed",
```

Add `exports` field at top level (above `dependencies`):

```json
"exports": {
  ".": "./dist/editor/Editor.js",
  "./embed": {
    "import": "./dist/embed/index.js",
    "types": "./dist/embed/index.d.ts"
  }
},
```

- [ ] **Step 4: Build + verify**

```bash
cd C:/Users/jscha/source/repos/svgedit
npm run build:embed
ls dist/embed
```

Expected: `client.js`, `client.d.ts`, `protocol.js`, `protocol.d.ts`, `origin.js`, `origin.d.ts`, `url-params.js`, `url-params.d.ts`, `chrome.js`, `chrome.d.ts`, `theme.js`, `theme.d.ts`, `server.js`, `server.d.ts`, `index.js`, `index.d.ts`.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add src/embed/index.ts tsconfig.embed.json package.json
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "chore(build): emit dist/embed via tsc + package exports (Task 17)"
```

---

## Phase 5: E2E (Tasks 18-26)

### Task 18: E2E fixture (parent-page host + helpers)

**Files:**
- Create: `tests/e2e/fixtures/embed-host.html`
- Create: `tests/e2e/embed-helpers.js`

- [ ] **Step 1: Create the parent-page fixture**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>svgedit embed host fixture</title>
<style>
  body { margin: 0; font-family: sans-serif; }
  #log { position: fixed; top: 0; right: 0; width: 320px; height: 100vh; overflow: auto; background: #f6f6f6; font: 11px monospace; padding: 6px; border-left: 1px solid #ccc; }
  iframe { width: calc(100% - 320px); height: 100vh; border: 0; }
</style>
</head>
<body>
<iframe id="svge"></iframe>
<pre id="log"></pre>
<script type="module">
  import { SvgEditEmbed } from '/dist/embed/index.js'

  const url = new URL(window.location.href)
  const editorSrc = url.searchParams.get('editorSrc') ?? '/src/editor/index.html?embed=1'
  const allowedOriginsParam = url.searchParams.get('allowedOrigins') ?? ''
  const allowedOrigins = allowedOriginsParam ? allowedOriginsParam.split(',') : [window.location.origin]

  const iframe = document.getElementById('svge')
  iframe.src = editorSrc

  const log = document.getElementById('log')
  const append = (s) => { log.textContent += s + '\n' }

  window.__svgeditEmbed = new SvgEditEmbed(iframe, { allowedOrigins })
  window.__svgeditEmbed.on('ready', (payload) => append(`READY ${JSON.stringify(payload)}`))
  window.__svgeditEmbed.on('change', () => append('CHANGE'))
  window.__svgeditEmbed.on('save', (p) => append(`SAVE bytes=${(p.svgString ?? '').length}`))
  window.__svgeditEmbed.on('selection-changed', (p) => append(`SELECTION ${JSON.stringify(p)}`))
  window.__svgeditEmbed.on('theme-changed', (p) => append(`THEME ${p.theme}`))
  window.__svgeditEmbed.on('extension-error', (p) => append(`EXT-ERR ${p.name}: ${p.message}`))
  window.__svgeditEmbed.on('error', (p) => append(`ERR ${p.source}: ${p.message}`))
  window.__svgeditEmbed.on('destroy', () => append('DESTROY'))

  window.__getLog = () => log.textContent
  window.__clearLog = () => { log.textContent = '' }
</script>
</body>
</html>
```

- [ ] **Step 2: Create helpers**

```js
// tests/e2e/embed-helpers.js
export async function openEmbedHost (page, { editorSrc, allowedOrigins } = {}) {
  const params = new URLSearchParams()
  if (editorSrc) params.set('editorSrc', editorSrc)
  if (allowedOrigins) params.set('allowedOrigins', allowedOrigins.join(','))
  const url = `/tests/e2e/fixtures/embed-host.html${params.toString() ? `?${params.toString()}` : ''}`
  await page.goto(url)
  await page.waitForFunction(() => window.__svgeditEmbed && window.__getLog().includes('READY'), { timeout: 15000 })
}

export async function getLog (page) {
  return await page.evaluate(() => window.__getLog())
}

export async function clearLog (page) {
  await page.evaluate(() => window.__clearLog())
}
```

- [ ] **Step 3: Manual smoke check**

```bash
npm run build
npm run start:e2e
```

Open `http://localhost:8000/tests/e2e/fixtures/embed-host.html` in a browser. Expected: iframe loads, no console errors, right pane shows `READY {"version":"7.4.1",...}`.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/fixtures/embed-host.html tests/e2e/embed-helpers.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e fixture + helpers (Task 18)"
```

---

### Task 19: E2E — embed-init (handshake)

**Files:**
- Create: `tests/e2e/embed-init.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-init.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost, getLog } from './embed-helpers.js'

test.describe('embed: init handshake', () => {
  test('READY event fires with version + protocolVersion + capabilities', async ({ page }) => {
    await openEmbedHost(page)
    const log = await getLog(page)
    expect(log).toMatch(/READY/)
    const readyLine = log.split('\n').find(l => l.startsWith('READY'))
    const payload = JSON.parse(readyLine.replace('READY ', ''))
    expect(payload.protocolVersion).toBe(1)
    expect(payload.version).toBeTruthy()
    expect(payload.capabilities).toEqual(expect.arrayContaining(['chrome', 'theme', 'dialog-hooks']))
  })

  test('URL-param chrome=minimal hides menu+layers but keeps toolbox', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/src/editor/index.html?embed=1&chrome=minimal' })
    const bodyClasses = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(bodyClasses).toContain('embed')
    expect(bodyClasses).toContain('no-menu')
    expect(bodyClasses).toContain('no-layers')
    expect(bodyClasses).not.toContain('no-toolbox')
  })

  test('queued calls before ready flush after ready resolves', async ({ page }) => {
    await openEmbedHost(page)
    const zoom = await page.evaluate(() => window.__svgeditEmbed.editor.getZoom())
    expect(typeof zoom).toBe('number')
    expect(zoom).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-init.spec.js
```

Expected: PASS — 3 tests. If any fail, fix implementation, not the test.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-init.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e init handshake (Task 19)"
```

---

### Task 20: E2E — embed-methods (round-trip)

**Files:**
- Create: `tests/e2e/embed-methods.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-methods.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: methods round-trip', () => {
  test('getZoom returns a number', async ({ page }) => {
    await openEmbedHost(page)
    const zoom = await page.evaluate(() => window.__svgeditEmbed.editor.getZoom())
    expect(typeof zoom).toBe('number')
  })

  test('loadFromString + getSvgString round-trip', async ({ page }) => {
    await openEmbedHost(page)
    const svgIn = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="red"/></svg>'
    await page.evaluate((s) => window.__svgeditEmbed.editor.loadFromString(s), svgIn)
    const svgOut = await page.evaluate(() => window.__svgeditEmbed.editor.getSvgString())
    expect(svgOut).toContain('<rect')
    expect(svgOut).toContain('fill="red"')
  })

  test('clearSelection executes without throwing', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.editor.clearSelection())
  })

  test('METHOD_NOT_FOUND error code on unknown method', async ({ page }) => {
    await openEmbedHost(page)
    const err = await page.evaluate(() =>
      window.__svgeditEmbed.editor.thisIsNotAMethod().then(() => null, (e) => ({ message: e.message, code: e.code }))
    )
    expect(err).not.toBeNull()
    expect(err.code).toBe('METHOD_NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-methods.spec.js
```

Expected: PASS — 4 tests

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-methods.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e methods round-trip (Task 20)"
```

---

### Task 21: E2E — embed-events

**Files:**
- Create: `tests/e2e/embed-events.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-events.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost, getLog } from './embed-helpers.js'

test.describe('embed: events', () => {
  test('ready event fires', async ({ page }) => {
    await openEmbedHost(page)
    expect(await getLog(page)).toMatch(/READY/)
  })

  test('change event fires after content modification', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() =>
      window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    )
    await page.waitForFunction(() => window.__getLog().includes('CHANGE'), { timeout: 5000 })
  })

  test('selection-changed fires when something is selected', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(async () => {
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect id="r" x="0" y="0" width="10" height="10"/></svg>')
      await new Promise(r => setTimeout(r, 100))
    })
    await page.evaluate(() => window.__svgeditEmbed.editor.selectAllInCurrentLayer())
    await page.waitForFunction(() => window.__getLog().includes('SELECTION'), { timeout: 5000 })
  })

  test('once subscription fires exactly once', async ({ page }) => {
    await openEmbedHost(page)
    const count = await page.evaluate(async () => {
      let n = 0
      window.__svgeditEmbed.once('change', () => { n += 1 })
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
      await new Promise(r => setTimeout(r, 300))
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>')
      await new Promise(r => setTimeout(r, 300))
      return n
    })
    expect(count).toBe(1)
  })

  test('off removes subscription', async ({ page }) => {
    await openEmbedHost(page)
    const count = await page.evaluate(async () => {
      let n = 0
      const handler = () => { n += 1 }
      window.__svgeditEmbed.on('change', handler)
      window.__svgeditEmbed.off('change', handler)
      await window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
      await new Promise(r => setTimeout(r, 300))
      return n
    })
    expect(count).toBe(0)
  })
})
```

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-events.spec.js
```

Expected: PASS — 5 tests

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-events.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e events suite (Task 21)"
```

---

### Task 22: E2E — embed-element-handles

**Files:**
- Create: `tests/e2e/embed-element-handles.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-element-handles.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: element handle round-trip', () => {
  test('getElem returns a handle; passing it back resolves to the element', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.editor.loadFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect id="rect-x" width="10" height="10"/></svg>'
    ))
    const handle = await page.evaluate(() => window.__svgeditEmbed.editor.getElem('rect-x'))
    expect(handle).toMatchObject({ __svgeditHandle: expect.any(String) })

    const id = await page.evaluate((h) => window.__svgeditEmbed.editor.getId(h), handle)
    expect(id).toBe('rect-x')
  })

  test('handle for deleted element returns ELEMENT_NOT_FOUND on reuse', async ({ page }) => {
    await openEmbedHost(page)
    await page.evaluate(() => window.__svgeditEmbed.editor.loadFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect id="goner" width="10" height="10"/></svg>'
    ))
    const handle = await page.evaluate(() => window.__svgeditEmbed.editor.getElem('goner'))
    await page.evaluate(() => window.__svgeditEmbed.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"/>'))
    const err = await page.evaluate((h) =>
      window.__svgeditEmbed.editor.getId(h).then(() => null, (e) => ({ code: e.code, message: e.message })),
      handle
    )
    expect(err?.code).toBe('ELEMENT_NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-element-handles.spec.js
```

Expected: PASS — 2 tests

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-element-handles.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e element-handles round-trip (Task 22)"
```

---

### Task 23: E2E — embed-chrome

**Files:**
- Create: `tests/e2e/embed-chrome.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-chrome.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: chrome control', () => {
  test('chrome=full URL param shows all chrome', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/src/editor/index.html?embed=1&chrome=full' })
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).toContain('embed')
    expect(classes).not.toContain('no-toolbox')
    expect(classes).not.toContain('no-menu')
    expect(classes).not.toContain('no-layers')
  })

  test('chrome=none URL param hides everything', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/src/editor/index.html?embed=1&chrome=none' })
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).toContain('no-toolbox')
    expect(classes).toContain('no-menu')
    expect(classes).toContain('no-layers')
  })

  test('runtime setChrome("minimal") toggles classes', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/src/editor/index.html?embed=1&chrome=full' })
    await page.evaluate(() => window.__svgeditEmbed.setChrome('minimal'))
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).toContain('no-menu')
    expect(classes).toContain('no-layers')
    expect(classes).not.toContain('no-toolbox')
  })

  test('runtime setChrome({menu: true}) re-enables menu', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/src/editor/index.html?embed=1&chrome=minimal' })
    await page.evaluate(() => window.__svgeditEmbed.setChrome({ menu: true }))
    const classes = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList))
    expect(classes).not.toContain('no-menu')
  })
})
```

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-chrome.spec.js
```

Expected: PASS — 4 tests

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-chrome.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e chrome control (Task 23)"
```

---

### Task 24: E2E — embed-theme

**Files:**
- Create: `tests/e2e/embed-theme.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-theme.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: theme sync', () => {
  test('URL param ?theme=dark applies theme-dark class', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/src/editor/index.html?embed=1&theme=dark' })
    const cls = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList).find(c => c.startsWith('theme-')))
    expect(cls).toBe('theme-dark')
  })

  test('runtime setTheme("light") replaces theme-dark with theme-light', async ({ page }) => {
    await openEmbedHost(page, { editorSrc: '/src/editor/index.html?embed=1&theme=dark' })
    await page.evaluate(() => window.__svgeditEmbed.setTheme('light'))
    const cls = await page.frameLocator('#svge').locator('body').evaluate(b => Array.from(b.classList).find(c => c.startsWith('theme-')))
    expect(cls).toBe('theme-light')
  })

  test('host-call setTheme does NOT emit theme-changed (echo-loop prevention)', async ({ page }) => {
    await openEmbedHost(page)
    const before = await page.evaluate(() => (window.__getLog().match(/THEME /g) ?? []).length)
    await page.evaluate(() => window.__svgeditEmbed.setTheme('dark'))
    await new Promise(r => setTimeout(r, 200))
    const after = await page.evaluate(() => (window.__getLog().match(/THEME /g) ?? []).length)
    expect(after).toBe(before)
  })
})
```

NOTE: Editor-initiated `theme-changed` event isn't exercised in v1 (no in-editor theme toggle until #3). Add coverage when #3 ships a theme UI.

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-theme.spec.js
```

Expected: PASS — 3 tests

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-theme.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e theme sync (Task 24)"
```

---

### Task 25: E2E — embed-dialogs

**Files:**
- Create: `tests/e2e/embed-dialogs.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-dialogs.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost } from './embed-helpers.js'

test.describe('embed: dialog hooks', () => {
  test('host-registered alert handler intercepts editor alert', async ({ page }) => {
    await openEmbedHost(page)
    const received = await page.evaluate(async () => {
      let captured = null
      window.__svgeditEmbed.setDialogHandler('alert', async (msg) => { captured = msg })
      try {
        await window.__svgeditEmbed.editor.loadFromString('not valid svg')
      } catch (_) {}
      await new Promise(r => setTimeout(r, 300))
      return captured
    })
    expect(received).toBeTruthy()
  })

  test('host-registered handler is unregistered correctly', async ({ page }) => {
    await openEmbedHost(page)
    const ok = await page.evaluate(async () => {
      let captured = null
      const off = window.__svgeditEmbed.setDialogHandler('alert', async (msg) => { captured = msg })
      off()
      await new Promise(r => setTimeout(r, 100))
      try {
        await window.__svgeditEmbed.editor.loadFromString('not valid svg')
      } catch (_) {}
      await new Promise(r => setTimeout(r, 300))
      return captured === null
    })
    expect(ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-dialogs.spec.js
```

Expected: PASS — 2 tests

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-dialogs.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e dialog hooks (Task 25)"
```

---

### Task 26: E2E — embed-security

**Files:**
- Create: `tests/e2e/embed-security.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-security.spec.js
import { expect, test } from '@playwright/test'
import { openEmbedHost, getLog } from './embed-helpers.js'

test.describe('embed: security model', () => {
  test('valid same-origin handshake works (sanity)', async ({ page }) => {
    await openEmbedHost(page)
    expect(await getLog(page)).toMatch(/READY/)
  })

  test('host drops injected message claiming foreign origin', async ({ page }) => {
    await openEmbedHost(page)
    const captured = await page.evaluate(() => {
      let unexpectedFire = false
      window.__svgeditEmbed.on('save', () => { unexpectedFire = true })
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'save', payload: { svgString: 'EVIL' } },
        origin: 'https://evil.com',
        source: window
      }))
      return unexpectedFire
    })
    expect(captured).toBe(false)
  })
})
```

NOTE: True cross-origin requires a multi-server fixture; this is documented as a manual smoke step for v1. Same-origin + foreign-origin injection cover the validator.

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-security.spec.js
```

Expected: PASS — 2 tests

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-security.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e security model (Task 26)"
```

---

### Task 27: E2E — embed-versioning

**Files:**
- Create: `tests/e2e/embed-versioning.spec.js`

- [ ] **Step 1: Write tests**

```js
// tests/e2e/embed-versioning.spec.js
import { expect, test } from '@playwright/test'

test.describe('embed: versioning', () => {
  test('protocolVersion mismatch throws on host construction', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/embed-host.html')
    const err = await page.evaluate(async () => {
      try {
        const { SvgEditEmbed } = await import('/dist/embed/index.js')
        const iframe = document.createElement('iframe')
        document.body.appendChild(iframe)
        Object.defineProperty(iframe, 'contentWindow', { value: window, configurable: true })
        const c = new SvgEditEmbed(iframe, { allowedOrigins: [window.location.origin] })
        setTimeout(() => {
          window.dispatchEvent(new MessageEvent('message', {
            data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '99.0.0', protocolVersion: 99, capabilities: [] } },
            origin: window.location.origin,
            source: window
          }))
        }, 0)
        await c.ready
        return null
      } catch (e) {
        return { message: e.message }
      }
    })
    expect(err?.message).toMatch(/protocolVersion mismatch/)
  })
})
```

- [ ] **Step 2: Run**

```bash
npx tsx scripts/run-e2e.ts -- tests/e2e/embed-versioning.spec.js
```

Expected: PASS — 1 test

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add tests/e2e/embed-versioning.spec.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(embed): e2e versioning (Task 27)"
```

---

## Phase 6: Documentation + integration (Tasks 28-29)

### Task 28: EMBED_API.md + README refresh

**Files:**
- Create: `EMBED_API.md` (repo root)
- Modify: `README.md`

- [ ] **Step 1: Write EMBED_API.md**

Use `docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md` as source-of-truth for content. EMBED_API.md is the host-facing version — concrete examples, less rationale.

Required sections (in order):

1. **Quickstart** — HTML iframe + JS import + SvgEditEmbed + ready + setTheme + setChrome + a few editor calls
2. **URL params** — the params table (embed, chrome, theme, allowedOrigins, dialogTimeout) with values + examples
3. **The SvgEditEmbed library** — constructor signature, all methods, typing notes
4. **Calling editor methods** — Proxy pattern + typed access via `import type { SvgCanvas } from 'svgedit/svgcanvas'` + element handle round-trip rules + JSON-serialization caveats
5. **Subscribing to events** — 8-event allowlist table with payload schemas + on/off/once code examples
6. **Chrome control** — URL + runtime API + per-element bool + preset shorthand
7. **Dialog hooks** — `setDialogHandler` examples + timeout behavior + the "no real prompt in v7" caveat for prompts when no host handler is registered (returns default)
8. **Theme sync** — `setTheme` + `theme-changed` event + echo-loop prevention note
9. **Security** — `allowedOrigins` semantics + wildcard caveat + recommended sandbox attributes block
10. **Versioning** — `protocolVersion: 1`; mismatch behavior; backward/forward compat
11. **Error codes** — METHOD_NOT_FOUND / ELEMENT_NOT_FOUND / PROTOCOL_VERSION_MISMATCH / DIALOG_HANDLER_TIMEOUT
12. **Rolling your own client** — postMessage envelope reference for non-JS hosts. Document envelope shape, `targetOrigin` rules, registration handshake.
13. **Recommended iframe sandbox attributes:**
    ```html
    <iframe src="..." sandbox="allow-scripts allow-same-origin" allow="clipboard-write"></iframe>
    ```
    with caveats for cross-origin scenarios.

Aim for 400-600 lines.

- [ ] **Step 2: Refresh README.md "Embedding (planned)" section**

OLD (lines ~52-54):
```
## Embedding (planned)

The editor will be embeddable as an iframe with a documented `EMBED_API.md` surface — URL params for chrome control, a `window.svgedit.*` programmatic API, and a postMessage protocol that includes two-way theme sync between host and editor. Design is in flight; see `_reference/embed-api-v6/` for the V6-era prototype that informs the new design.
```

NEW:
```markdown
## Embedding

svgedit can be embedded in any host application via an iframe. See [EMBED_API.md](EMBED_API.md) for the full contract.

Quickstart:

\`\`\`html
<iframe id="svge" src="https://your-svgedit-host/src/editor/index.html?embed=1&chrome=minimal&theme=dark"></iframe>
<script type="module">
  import { SvgEditEmbed } from 'svgedit/embed'
  const editor = new SvgEditEmbed(document.getElementById('svge'), { allowedOrigins: ['https://your-svgedit-host'] })
  await editor.ready
  await editor.editor.loadFromString('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
  editor.on('save', ({ svgString }) => console.log('saved:', svgString))
</script>
\`\`\`
```

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" add EMBED_API.md README.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs(embed): EMBED_API.md + README quickstart (Task 28)"
```

---

### Task 29: Final integration — CHANGELOG + full-suite gate + PR

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Append CHANGELOG entry**

Insert at the top of `[Unreleased]`:

```markdown
### Added (#4 embed API v1 — 2026-05-XX)

- New `src/embed/` module — editor-side `EmbedServer` + host-side `SvgEditEmbed` proxy library + shared protocol/origin/url-params/chrome/theme helpers.
- New `EMBED_API.md` — canonical host-facing contract (URL params, envelope shape, events allowlist, dialog hooks, chrome control, theme sync, security model, versioning).
- `Editor.ts` wire-in at line 324 (`window.svgEditor = this`) — instantiates `EmbedServer` after the global is set; default dialog handlers wrap existing `seAlert` / `seConfirm` (prompt returns default until #13 lands a real prompt component); svgCanvas `changed` + `selected` events bridged to embed `change` + `selection-changed`.
- 7 unit-test suites (vitest + jsdom): protocol, origin, url-params, chrome, theme, server, client.
- 9 e2e suites (Playwright): init, methods, events, element-handles, chrome, theme, dialogs, security, versioning.
- `tsconfig.embed.json` + `npm run build:embed` — emits `dist/embed/{client,protocol,...}.{js,d.ts}` for host consumption.
- `package.json` `exports` field maps `svgedit/embed` to `dist/embed/index.js`.
- Closes svgedit todo item #4. Closes 5 of 12 audit-input items (#3 dialog hooks, #5 extension-error event, #8 ready wire-up, #9 load-API doc, #10 read-API doc, #11 extension-injection doc); 6 remaining items tracked as follow-ups (see EMBED_API.md spec doc § Follow-up items).
```

- [ ] **Step 2: Run the full pre-PR gate**

```bash
cd C:/Users/jscha/source/repos/svgedit
npx tsc --build --force
npm run lint
npm run build
npx vitest run
npx tsx scripts/run-e2e.ts
```

Expected:
- tsc: 0 errors
- lint: 0 errors (warnings OK)
- build: success + `Bundled 11 extensions` + `dist/embed/*.{js,d.ts}` present
- vitest: 564 baseline + ~50 new from Tasks 1-16 = ~614 total. Re-measure.
- e2e: 192 baseline + 21 new from Tasks 19-27 = 213 total. Re-measure.

- [ ] **Step 3: Push branch + open PR**

```bash
git -C "C:/Users/jscha/source/repos/svgedit" push -u origin feat/embed-api-v1
gh pr create --repo bilbospocketses/svgedit --base master --head feat/embed-api-v1 \
  --title "feat(embed): #4 embed API v1" \
  --body "Implements svgedit todo item #4 per docs/superpowers/specs/2026-05-20-svgedit-embed-api-design.md. See plan at docs/superpowers/plans/2026-05-20-svgedit-embed-api-v1-plan.md. CHANGELOG entry has the full summary."
```

- [ ] **Step 4: Wait for 4 required checks**

```bash
gh pr checks <PR-#> --repo bilbospocketses/svgedit --watch --fail-fast
```

Expected: all 4 pass.

- [ ] **Step 5: Squash-merge**

```bash
gh pr merge <PR-#> --repo bilbospocketses/svgedit --squash --delete-branch
git -C "C:/Users/jscha/source/repos/svgedit" fetch origin master --prune
git -C "C:/Users/jscha/source/repos/svgedit" checkout master
git -C "C:/Users/jscha/source/repos/svgedit" pull --ff-only
git -C "C:/Users/jscha/source/repos/svgedit" log -1 --format='%h %s'
```

- [ ] **Step 6: Memory sweep**

Edit `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/todo_svgedit.md`:
- Remove item #4 from Active section
- Add Shipped entry at top of Shipped section (mirror CHANGELOG entry structure, plus merge SHA + PR #)
- Update active-count (12 → 11)
- Refresh next-session resume banner to point at #3 (elix → Lit) as the new next item

Edit `C:/Users/jscha/.claude/projects/C--Users-jscha/memory/project_index.md`:
- Update the svgedit Active TODOs entry (date + item count + next-direction narrative)

Append to `C:/Users/jscha/.claude/CHANGELOG.md`:
- New `### Changed (2026-05-XX — svgedit #4 embed API v1 SHIPPED)` entry with bullets: PR/merge SHA, todo update, what's next.

- [ ] **Step 7: claude-config commit + push**

```bash
git -C "C:/Users/jscha/.claude" add CHANGELOG.md projects/C--Users-jscha/memory/todo_svgedit.md projects/C--Users-jscha/memory/project_index.md
git -C "C:/Users/jscha/.claude" commit -m "memory(svgedit): #4 embed API v1 SHIPPED → Shipped section"
git -C "C:/Users/jscha/.claude" push
```

---

## Self-review checklist (run at end before declaring complete)

**1. Spec coverage:**

- ✅ Architecture (Tasks 1-17)
- ✅ Protocol envelope (Task 1)
- ✅ Initialization & handshake (Tasks 6 + 8 + 11)
- ✅ API surface (Tasks 7 + 13)
- ✅ Events allowlist (Tasks 8 + 21 + svgCanvas event bindings in Task 11)
- ✅ URL params (Tasks 3 + 6)
- ✅ Chrome control (Tasks 4 + 10 + 16 + 23)
- ✅ Dialog hook system (Tasks 9 + 10 + 11 default-handlers + 15 + 25)
- ✅ Theme sync (Tasks 5 + 10 + 16 + 24)
- ✅ Security (Tasks 2 + 6 + 12 + 26)
- ✅ Versioning (Tasks 1 + 12 + 27)
- ✅ Error handling (Tasks 7 + 13 + 22)
- ✅ Testing strategy (Tasks 18-27)
- ✅ V6 reference disposition (preserved; follow-up captured in CHANGELOG + spec)
- ✅ Follow-up items + out-of-scope (captured in CHANGELOG + spec)

**2. Placeholder scan:**

Grep the plan for `TBD` / `TODO` / "implement later" / "similar to Task N":

```bash
grep -nE 'TBD|implement later|similar to task|fill in details' docs/superpowers/plans/2026-05-20-svgedit-embed-api-v1-plan.md
```

Expected: zero matches.

**3. Type consistency:**

- `EmbedEnvelope` discriminated union (Task 1) — used identically across Tasks 7, 8, 12, 13, 14, 15
- `EmbedEventName` 8-name union (Task 1) — used in Task 14 (on/off/once) and Task 11 (server-side svgCanvas bridge)
- `ChromeState` + `ChromePreset` — Tasks 1, 4, 16
- `DialogKind` / `DialogHandler` / `DialogHandlers` — Tasks 9, 10, 15
- `PROTOCOL_VERSION = 1` — Tasks 1, 6, 12

If you find drift between tasks, fix inline in this plan before execution.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-20-svgedit-embed-api-v1-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration. Good fit since this plan has 30 tasks across 6 phases; many independent within Phase 5 (the 9 e2e suites can be dispatched in parallel after Task 18 sets up the fixture).

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch with checkpoints. Good if tight control over each step is desired.
