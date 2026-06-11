# foreignObject HTML Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-panel "Insert HTML" tool that creates a `foreignObject` and opens a themed modal rich-text editor (headings, bold/italic/underline/strikethrough, lists, links, color, alignment, font-size), with the content surviving svgedit's sanitizer and a save→reload round-trip.

**Architecture:** Three layers built in order. **Phase A** extends the SVG sanitizer with a namespace-branched HTML allowlist (the SVG path is left untouched) whose tag/attr/CSS-property constants are *exported* so the editor emits exactly what the sanitizer permits. **Phase B** builds the pure, dependency-free editor units — a `Selection`-based command layer, a DOM↔string serializer, and a Lit `<dialog>` component (mirroring M3's `SePromptDialog`). **Phase C** wires it to the canvas — a tool/mode, a `svgcanvas.setForeignContent` method that swaps content with undo/redo history, double-click-to-edit, and a thin editor controller.

**Tech Stack:** TypeScript, Lit 3 (web components), native `<dialog>` + `contenteditable`, vitest (jsdom unit tests), Playwright (e2e), `--se-*` design tokens. Zero new runtime dependencies.

**Reference spec:** `docs/superpowers/specs/2026-06-11-svgedit-foreignobject-html-authoring-design.md`

**Conventions:**
- Branch is `feat/foreignobject-html-authoring` (already cut off `cf829402`).
- Run a single unit test: `npx vitest run tests/unit/<file>.test.ts` (add `-t '<name>'` for one case).
- Lint: `npm run lint` (eslint + markdownlint + `lint:hex` raw-hex guard).
- Typecheck the canvas package: `npm run typecheck`. Full build (editor typecheck too): `npm run build`.
- Full suite (lint → unit+coverage → e2e both browsers): `npm test`.
- Commit messages: Conventional Commits (`feat(foreign): …`, `test(foreign): …`). **No AI-attribution trailer** (repo policy).
- Lit component rules (`docs/superpowers/conventions/lit-component-conventions.md`): `@customElement` + `@property() accessor` (the `accessor` keyword is required), open shadow DOM, `static styles = css\`\``, class-field-arrow event handlers, tokens-only CSS (no raw hex).

---

## Phase A — Sanitizer extension (foundation; de-risk first)

### Task A1: Namespace round-trip spike (verify the highest-risk assumption FIRST)

The whole design assumes an XHTML-namespaced `foreignObject` child, serialized to an SVG string and reparsed by the load path, retains `NS.HTML` on its descendants. Prove it before building anything.

**Files:**
- Test: `tests/unit/foreign-namespace-roundtrip.test.ts` (create)

- [ ] **Step 1: Write the spike test**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'

describe('foreignObject XHTML namespace round-trip', () => {
  it('descendant HTML keeps NS.HTML after serialize → reparse as image/svg+xml', () => {
    // Build an SVG with a foreignObject whose child is an XHTML-namespaced div.
    const svg = document.createElementNS(NS.SVG, 'svg')
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    fo.setAttribute('width', '200'); fo.setAttribute('height', '100')
    const root = document.createElementNS(NS.HTML, 'div')
    root.setAttribute('xmlns', NS.HTML)
    const strong = document.createElementNS(NS.HTML, 'strong')
    strong.textContent = 'hi'
    root.appendChild(strong); fo.appendChild(root); svg.appendChild(fo)

    const str = new XMLSerializer().serializeToString(svg)
    const doc = new DOMParser().parseFromString(str, 'image/svg+xml')

    const reparsedStrong = doc.getElementsByTagName('strong')[0]
    expect(reparsedStrong).toBeTruthy()
    expect(reparsedStrong.namespaceURI).toBe(NS.HTML)
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/unit/foreign-namespace-roundtrip.test.ts`
Expected: **PASS**. If it FAILS (descendants come back as `NS.SVG` or null), STOP — the serialize wrapper in Task B1 must explicitly stamp `xmlns` on the root *and* the parse path may need `text/html` fallback handling. Record the actual `namespaceURI` observed in the task notes and adjust B1/C2 before continuing. Do not proceed to A2 until this is green.

- [ ] **Step 3: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add tests/unit/foreign-namespace-roundtrip.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "test(foreign): pin XHTML namespace round-trip assumption"
```

---

### Task A2: Export the allowlist constants

**Files:**
- Modify: `packages/svgcanvas/core/sanitize.ts` (add exports near the top, after the existing `svgWhiteList_` block ~line 97)
- Test: `tests/unit/foreign-html-allowlist.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  FOREIGN_HTML_TAGS, FOREIGN_HTML_ATTRS, FOREIGN_STYLE_PROPS, FOREIGN_HREF_SCHEMES
} from '../../packages/svgcanvas/core/sanitize.js'

describe('foreign HTML allowlist constants', () => {
  it('allows inline + block tags, excludes script/table (v1)', () => {
    expect(FOREIGN_HTML_TAGS.has('strong')).toBe(true)
    expect(FOREIGN_HTML_TAGS.has('h2')).toBe(true)
    expect(FOREIGN_HTML_TAGS.has('a')).toBe(true)
    expect(FOREIGN_HTML_TAGS.has('script')).toBe(false)
    expect(FOREIGN_HTML_TAGS.has('table')).toBe(false)
  })
  it('allows the v1 CSS properties, not positioning', () => {
    expect(FOREIGN_STYLE_PROPS.has('color')).toBe(true)
    expect(FOREIGN_STYLE_PROPS.has('text-align')).toBe(true)
    expect(FOREIGN_STYLE_PROPS.has('font-size')).toBe(true)
    expect(FOREIGN_STYLE_PROPS.has('position')).toBe(false)
    expect(FOREIGN_STYLE_PROPS.has('background-color')).toBe(false) // phase 2
  })
  it('a-tag attrs and safe href schemes', () => {
    expect(FOREIGN_HTML_ATTRS.a).toContain('href')
    expect(FOREIGN_HTML_ATTRS.a).toContain('target')
    expect(FOREIGN_HTML_ATTRS.a).toContain('rel')
    expect(FOREIGN_HREF_SCHEMES.has('https:')).toBe(true)
    expect(FOREIGN_HREF_SCHEMES.has('javascript:')).toBe(false)
    expect(FOREIGN_HREF_SCHEMES.has('mailto:')).toBe(false) // decision: no mailto
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/foreign-html-allowlist.test.ts`
Expected: FAIL — `FOREIGN_HTML_TAGS` is not exported.

- [ ] **Step 3: Add the constants to `sanitize.ts`** (place after `svgWhiteList_`, before the namespace-aware block)

```ts
// === foreignObject HTML content allowlist (co-designed with the editor) ===
// Exported so the editor's serialize layer emits exactly what is permitted here.
export const FOREIGN_HTML_TAGS = new Set<string>([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'pre', 'hr', 'br',
  'strong', 'em', 'u', 's', 'b', 'i', 'sub', 'sup', 'a', 'blockquote'
])

// Per-tag attribute allowlist; '*' = applies to every allowed tag.
export const FOREIGN_HTML_ATTRS: Record<string, string[]> = {
  '*': ['class', 'id', 'style'],
  a: ['class', 'id', 'style', 'href', 'target', 'rel']
}

export const FOREIGN_STYLE_PROPS = new Set<string>([
  'color', 'text-align', 'font-size', 'font-weight',
  'font-style', 'text-decoration', 'list-style-type'
])

// Allowed href schemes for <a>. Relative / fragment hrefs (no scheme) are also allowed.
export const FOREIGN_HREF_SCHEMES = new Set<string>(['http:', 'https:'])
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/foreign-html-allowlist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add packages/svgcanvas/core/sanitize.ts tests/unit/foreign-html-allowlist.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): export HTML sanitize allowlist constants"
```

---

### Task A3: Namespace branch + tag allowlist (`sanitizeForeignHtml`)

**Files:**
- Modify: `packages/svgcanvas/core/sanitize.ts` (branch at the top of `sanitizeSvg`; add `sanitizeForeignHtml`)
- Test: `tests/unit/foreign-html-sanitize.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as sanitize from '../../packages/svgcanvas/core/sanitize.js'

describe('sanitizeForeignHtml — tags', () => {
  const h = (tag: string) => document.createElementNS(NS.HTML, tag)
  let root: Element
  beforeEach(() => {
    console.warn = () => {}
    const svg = document.createElementNS(NS.SVG, 'svg')
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    root = h('div'); fo.appendChild(root); svg.appendChild(fo)
    document.body.appendChild(svg)
  })
  afterEach(() => { document.body.textContent = '' })

  it('keeps allowed inline/block tags', () => {
    root.innerHTML = '<p>a <strong>b</strong> <em>c</em></p>'
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('strong')).toBeTruthy()
    expect(root.querySelector('em')).toBeTruthy()
  })

  it('unwraps a disallowed tag but keeps its text (script)', () => {
    root.innerHTML = '<p>safe<script>alert(1)<\/script></p>'
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('script')).toBeNull()
    expect(root.textContent).toContain('safe')
  })

  it('unwraps a disallowed tag but keeps children (table → its text)', () => {
    root.innerHTML = '<table><tr><td>cell</td></tr></table>'
    sanitize.sanitizeSvg(root)
    expect(root.querySelector('table')).toBeNull()
    expect(root.textContent).toContain('cell')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/foreign-html-sanitize.test.ts`
Expected: FAIL — `<strong>` gets stripped today (not whitelisted) / `sanitizeForeignHtml` doesn't exist.

- [ ] **Step 3: Add the branch + tag handling in `sanitize.ts`**

At the very top of `sanitizeSvg`, after the text-node block and the `nodeType !== 1` guard, before `const allowedAttrs = ...`:

```ts
  // HTML content inside a foreignObject takes a separate ruleset (the SVG path below
  // is left untouched). Detected by the XHTML namespace — also resolves the a/title/style
  // shared-tag-name ambiguity between SVG and HTML.
  if (elem.namespaceURI === NS.HTML) {
    sanitizeForeignHtml(elem)
    return
  }
```

Add the new function (after `sanitizeSvg`):

```ts
/** Sanitize one HTML element living inside a foreignObject (XHTML namespace). */
const sanitizeForeignHtml = (elem: Element): void => {
  const parent = elem.parentNode
  const tag = elem.localName
  if (!parent) return

  // Unknown tag → unwrap: promote children before this node, then remove it.
  if (!FOREIGN_HTML_TAGS.has(tag)) {
    const children: Node[] = []
    while (elem.firstChild) children.push(parent.insertBefore(elem.firstChild, elem))
    elem.remove()
    for (let i = children.length; i--;) {
      const c = children[i]
      if (c) sanitizeSvg(c)
    }
    return
  }

  sanitizeForeignAttrs(elem, tag)

  // recurse to children (snapshot first; sanitize may unwrap and mutate the live list)
  const kids = [...elem.childNodes]
  for (let i = kids.length; i--;) {
    const c = kids[i]
    if (c) sanitizeSvg(c)
  }
}
```

Add a temporary minimal `sanitizeForeignAttrs` (fleshed out in A4/A5) so this compiles:

```ts
const sanitizeForeignAttrs = (_elem: Element, _tag: string): void => { /* A4/A5 */ }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/foreign-html-sanitize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add packages/svgcanvas/core/sanitize.ts tests/unit/foreign-html-sanitize.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): namespace-branch HTML sanitize + tag allowlist"
```

---

### Task A4: Attribute allowlist + filtered inline style

**Files:**
- Modify: `packages/svgcanvas/core/sanitize.ts` (`sanitizeForeignAttrs`)
- Test: extend `tests/unit/foreign-html-sanitize.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
describe('sanitizeForeignHtml — attrs + style', () => {
  const h = (tag: string) => document.createElementNS(NS.HTML, tag)
  let root: Element
  beforeEach(() => {
    console.warn = () => {}
    const svg = document.createElementNS(NS.SVG, 'svg')
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    root = h('div'); fo.appendChild(root); svg.appendChild(fo)
    document.body.appendChild(svg)
  })
  afterEach(() => { document.body.textContent = '' })

  it('keeps allowlisted CSS props, drops the rest', () => {
    root.innerHTML = '<span style="color: red; font-size: 16px; position: absolute">x</span>'
    sanitize.sanitizeSvg(root)
    const span = root.querySelector('span')!
    const style = span.getAttribute('style') || ''
    expect(style).toContain('color')
    expect(style).toContain('font-size')
    expect(style).not.toContain('position')
  })

  it('drops style values containing url()/expression()', () => {
    root.innerHTML = '<span style="color: url(javascript:alert(1)); font-size: 16px">x</span>'
    sanitize.sanitizeSvg(root)
    const style = root.querySelector('span')!.getAttribute('style') || ''
    expect(style).not.toContain('url(')
    expect(style).toContain('font-size')
  })

  it('strips event handlers and unknown attrs, keeps class/id', () => {
    root.innerHTML = '<p class="c" id="i" onclick="alert(1)" data-x="1">x</p>'
    sanitize.sanitizeSvg(root)
    const p = root.querySelector('p')!
    expect(p.getAttribute('class')).toBe('c')
    expect(p.getAttribute('id')).toBe('i')
    expect(p.hasAttribute('onclick')).toBe(false)
    expect(p.hasAttribute('data-x')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/foreign-html-sanitize.test.ts -t "attrs + style"`
Expected: FAIL — `sanitizeForeignAttrs` is a no-op stub.

- [ ] **Step 3: Implement `sanitizeForeignAttrs`** (replace the stub)

```ts
const filterForeignStyle = (value: string): string => {
  const kept: string[] = []
  for (const decl of value.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (!FOREIGN_STYLE_PROPS.has(prop)) continue
    if (/url\(|expression\(/i.test(val)) continue
    kept.push(`${prop}: ${val}`)
  }
  return kept.join('; ')
}

const sanitizeForeignAttrs = (elem: Element, tag: string): void => {
  const allowed = FOREIGN_HTML_ATTRS[tag] ?? FOREIGN_HTML_ATTRS['*']
  for (let i = elem.attributes.length; i--;) {
    const attr = elem.attributes.item(i)
    if (!attr) continue
    const name = attr.name.toLowerCase()
    if (!allowed.includes(name)) { elem.removeAttribute(attr.name); continue }
    if (name === 'style') {
      const filtered = filterForeignStyle(attr.value)
      if (filtered) elem.setAttribute('style', filtered)
      else elem.removeAttribute('style')
    }
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/foreign-html-sanitize.test.ts`
Expected: PASS (all A3 + A4 cases).

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add packages/svgcanvas/core/sanitize.ts tests/unit/foreign-html-sanitize.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): HTML attr allowlist + filtered inline style"
```

---

### Task A5: Link hardening (href scheme + forced target/rel)

**Files:**
- Modify: `packages/svgcanvas/core/sanitize.ts` (extend `sanitizeForeignAttrs` for `<a>`)
- Test: extend `tests/unit/foreign-html-sanitize.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
describe('sanitizeForeignHtml — links', () => {
  const h = (tag: string) => document.createElementNS(NS.HTML, tag)
  let root: Element
  beforeEach(() => {
    console.warn = () => {}
    const svg = document.createElementNS(NS.SVG, 'svg')
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    root = h('div'); fo.appendChild(root); svg.appendChild(fo)
    document.body.appendChild(svg)
  })
  afterEach(() => { document.body.textContent = '' })

  it('keeps http(s) links and forces target/rel', () => {
    root.innerHTML = '<a href="https://example.com">x</a>'
    sanitize.sanitizeSvg(root)
    const a = root.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://example.com')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps fragment + relative hrefs', () => {
    root.innerHTML = '<a href="#sec">x</a><a href="/page">y</a>'
    sanitize.sanitizeSvg(root)
    const as = root.querySelectorAll('a')
    expect(as[0].getAttribute('href')).toBe('#sec')
    expect(as[1].getAttribute('href')).toBe('/page')
  })

  it('strips javascript:/data:/mailto: hrefs (keeps the link text)', () => {
    root.innerHTML = '<a href="javascript:alert(1)">a</a><a href="mailto:x@y.z">b</a>'
    sanitize.sanitizeSvg(root)
    for (const a of root.querySelectorAll('a')) {
      expect(a.hasAttribute('href')).toBe(false)
    }
    expect(root.textContent).toContain('a')
    expect(root.textContent).toContain('b')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/foreign-html-sanitize.test.ts -t "links"`
Expected: FAIL — no link handling yet.

- [ ] **Step 3: Add link handling** — at the end of `sanitizeForeignAttrs`, after the attribute loop:

```ts
  if (tag === 'a') {
    const href = elem.getAttribute('href')
    if (href !== null) {
      const safe = isSafeForeignHref(href)
      if (!safe) elem.removeAttribute('href')
    }
    if (elem.hasAttribute('href')) {
      elem.setAttribute('target', '_blank')
      elem.setAttribute('rel', 'noopener noreferrer')
    } else {
      elem.removeAttribute('target'); elem.removeAttribute('rel')
    }
  }
```

Add the helper near `filterForeignStyle`:

```ts
const isSafeForeignHref = (href: string): boolean => {
  const v = href.trim()
  if (v.startsWith('#') || v.startsWith('/') || v.startsWith('./') || v.startsWith('../')) return true
  const m = /^([a-z][a-z0-9+.-]*:)/i.exec(v)
  if (!m) return true // scheme-less relative
  return FOREIGN_HREF_SCHEMES.has(m[1].toLowerCase())
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/foreign-html-sanitize.test.ts`
Expected: PASS (all foreign-html-sanitize cases).

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add packages/svgcanvas/core/sanitize.ts tests/unit/foreign-html-sanitize.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): link href scheme hardening + forced target/rel"
```

---

### Task A6: SVG-path regression guard + idempotence

**Files:**
- Test: extend `tests/unit/foreign-html-sanitize.test.ts`

- [ ] **Step 1: Add tests**

```ts
describe('sanitize — SVG path unaffected + idempotence', () => {
  beforeEach(() => { console.warn = () => {} })

  it('does not touch an SVG rect with style (still maps to attrs)', () => {
    const svg = document.createElementNS(NS.SVG, 'svg')
    const rect = document.createElementNS(NS.SVG, 'rect')
    rect.setAttribute('style', 'stroke: blue; stroke-width: 4')
    svg.appendChild(rect); document.body.appendChild(svg)
    sanitize.sanitizeSvg(rect)
    expect(rect.getAttribute('stroke')).toBe('blue')   // SVG branch still rewrites style→attr
    expect(rect.hasAttribute('style')).toBe(false)
    document.body.textContent = ''
  })

  it('is idempotent for already-clean foreign content', () => {
    const svg = document.createElementNS(NS.SVG, 'svg')
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    const root = document.createElementNS(NS.HTML, 'div')
    root.innerHTML = '<p><strong>a</strong> <span style="color: red">b</span></p>'
    fo.appendChild(root); svg.appendChild(fo); document.body.appendChild(svg)
    sanitize.sanitizeSvg(root)
    const once = root.innerHTML
    sanitize.sanitizeSvg(root)
    expect(root.innerHTML).toBe(once)
    document.body.textContent = ''
  })
})
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/unit/foreign-html-sanitize.test.ts && npx vitest run tests/unit/sanitize.test.ts`
Expected: PASS (new cases AND the original `sanitize.test.ts` still green — proves no SVG regression).

- [ ] **Step 3: Lint + commit**

```bash
npm --prefix C:/Users/jscha/source/repos/svgedit run lint
git -C C:/Users/jscha/source/repos/svgedit add tests/unit/foreign-html-sanitize.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "test(foreign): SVG-path regression + idempotence guards"
```

---

## Phase B — Editor units (pure layers + Lit dialog)

### Task B1: `foreign-html-serialize.ts` — DOM ↔ string

**Files:**
- Create: `src/editor/dialogs/foreign-html-serialize.ts`
- Test: `tests/unit/foreign-html-serialize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { serialize, deserialize, FOREIGN_ROOT_CLASS } from '../../src/editor/dialogs/foreign-html-serialize.ts'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'

describe('foreign-html serialize/deserialize', () => {
  it('wraps content in an xmlns="…/xhtml" root with the marker class', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<p>hi <strong>x</strong></p>'
    const out = serialize(editor)
    expect(out).toContain(`xmlns="${NS.HTML}"`)
    expect(out).toContain(FOREIGN_ROOT_CLASS)
    expect(out).toContain('<strong>x</strong>')
  })

  it('drops non-allowlisted tags/attrs in the pre-injection pass', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<p onclick="x()">a<script>1<\/script></p>'
    const out = serialize(editor)
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('<script')
  })

  it('deserialize returns a fragment of the root\'s children', () => {
    const html = `<div xmlns="${NS.HTML}" class="${FOREIGN_ROOT_CLASS}"><p>hi</p></div>`
    const frag = deserialize(html)
    const div = document.createElement('div'); div.appendChild(frag)
    expect(div.querySelector('p')?.textContent).toBe('hi')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/foreign-html-serialize.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `foreign-html-serialize.ts`**

```ts
import { NS } from '@svgedit/svgcanvas'
import { FOREIGN_HTML_TAGS, FOREIGN_HTML_ATTRS, FOREIGN_STYLE_PROPS } from '@svgedit/svgcanvas'

export const FOREIGN_ROOT_CLASS = 'se-fo-root'

const filterStyle = (value: string): string =>
  value.split(';').map((d) => {
    const i = d.indexOf(':'); if (i < 0) return ''
    const prop = d.slice(0, i).trim().toLowerCase(); const val = d.slice(i + 1).trim()
    if (!FOREIGN_STYLE_PROPS.has(prop) || /url\(|expression\(/i.test(val)) return ''
    return `${prop}: ${val}`
  }).filter(Boolean).join('; ')

/** Strip an editor DOM subtree to allowlisted tags/attrs (pre-injection pass). */
const prune = (node: Element): void => {
  for (const child of [...node.children]) {
    const tag = child.localName.toLowerCase()
    if (!FOREIGN_HTML_TAGS.has(tag)) {
      while (child.firstChild) node.insertBefore(child.firstChild, child)
      child.remove(); continue
    }
    const allowed = FOREIGN_HTML_ATTRS[tag] ?? FOREIGN_HTML_ATTRS['*']
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase()
      if (!allowed.includes(name)) { child.removeAttribute(attr.name); continue }
      if (name === 'style') {
        const f = filterStyle(attr.value)
        f ? child.setAttribute('style', f) : child.removeAttribute('style')
      }
    }
    prune(child)
  }
}

/** Editor DOM → XHTML-namespaced string for injection into a foreignObject. */
export const serialize = (editorRoot: Element): string => {
  const clone = editorRoot.cloneNode(true) as Element
  prune(clone)
  const inner = clone.innerHTML
  return `<div xmlns="${NS.HTML}" class="${FOREIGN_ROOT_CLASS}">${inner}</div>`
}

/** foreignObject child HTML → a fragment of editor DOM for edit mode. */
export const deserialize = (html: string): DocumentFragment => {
  const tpl = document.createElement('template')
  // Reduce to the root's inner content if it is our wrapper.
  const tmp = document.createElement('div'); tmp.innerHTML = html
  const root = tmp.querySelector(`.${FOREIGN_ROOT_CLASS}`) ?? tmp
  tpl.innerHTML = root.innerHTML
  return tpl.content
}
```

> NOTE: `NS`, `FOREIGN_HTML_TAGS`, `FOREIGN_HTML_ATTRS`, `FOREIGN_STYLE_PROPS` must be re-exported from the `@svgedit/svgcanvas` package entry (`packages/svgcanvas/svgcanvas.ts` already `export { … } from './core/sanitize.js'` and exports `NS`). Verify these names are on the package's public exports; if not, add `export { FOREIGN_HTML_TAGS, FOREIGN_HTML_ATTRS, FOREIGN_STYLE_PROPS, NS } from './core/...'` there as a one-line change in this step.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/foreign-html-serialize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/foreign-html-serialize.ts tests/unit/foreign-html-serialize.test.ts packages/svgcanvas/svgcanvas.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): editor DOM<->string serialize layer"
```

---

### Task B2: `foreign-html-commands.ts` — command layer

Pure `Selection`/`Range` functions on a root `Element`, emitting only allowlisted markup. jsdom supports `getSelection`/`Range`; selection-spanning behaviors are verified more thoroughly in e2e (Task C5).

**Files:**
- Create: `src/editor/dialogs/foreign-html-commands.ts`
- Test: `tests/unit/foreign-html-commands.test.ts`

- [ ] **Step 1: Write failing tests** (covers each command's emitted markup)

```ts
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import * as cmd from '../../src/editor/dialogs/foreign-html-commands.ts'

const selectAll = (root: Element) => {
  const r = document.createRange(); r.selectNodeContents(root)
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(r)
}
let root: HTMLElement
beforeEach(() => {
  document.body.textContent = ''
  root = document.createElement('div'); root.contentEditable = 'true'
  document.body.appendChild(root)
})

describe('foreign-html commands', () => {
  it('toggleInline wraps the selection in <strong>', () => {
    root.innerHTML = '<p>hello</p>'; selectAll(root.querySelector('p')!)
    cmd.toggleInline(root, 'strong')
    expect(root.querySelector('strong')?.textContent).toBe('hello')
  })

  it('setBlock retags the block to <h2>', () => {
    root.innerHTML = '<p>title</p>'; selectAll(root.querySelector('p')!)
    cmd.setBlock(root, 'h2')
    expect(root.querySelector('h2')?.textContent).toBe('title')
    expect(root.querySelector('p')).toBeNull()
  })

  it('setColor wraps selection in a span with allowlisted style', () => {
    root.innerHTML = '<p>red</p>'; selectAll(root.querySelector('p')!)
    cmd.setColor(root, '#cc0000')
    const span = root.querySelector('span')!
    expect(span.getAttribute('style')).toContain('color')
  })

  it('setAlign sets text-align on the block', () => {
    root.innerHTML = '<p>x</p>'; selectAll(root.querySelector('p')!)
    cmd.setAlign(root, 'center')
    expect(root.querySelector('p')!.getAttribute('style')).toContain('text-align: center')
  })

  it('insertLink wraps selection in a hardened anchor', () => {
    root.innerHTML = '<p>link</p>'; selectAll(root.querySelector('p')!)
    cmd.insertLink(root, 'https://example.com')
    const a = root.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://example.com')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('setFontSize "M" removes an explicit size span', () => {
    root.innerHTML = '<p><span style="font-size: 24px">x</span></p>'
    selectAll(root.querySelector('span')!)
    cmd.setFontSize(root, 'M')
    expect(root.querySelector('span')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `foreign-html-commands.ts`** (full code for every command)

```ts
export type InlineTag = 'strong' | 'em' | 'u' | 's'
export type BlockTag = 'p' | 'h1' | 'h2' | 'h3'
export type Align = 'left' | 'center' | 'right'
export type FontPreset = 'S' | 'M' | 'L' | 'XL'

const FONT_PX: Record<Exclude<FontPreset, 'M'>, string> = { S: '12px', L: '24px', XL: '36px' }

const activeRange = (root: Element): Range | null => {
  const sel = (root.ownerDocument.defaultView ?? window).getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const r = sel.getRangeAt(0)
  return root.contains(r.commonAncestorContainer) ? r : null
}

const wrap = (root: Element, el: HTMLElement): void => {
  const r = activeRange(root); if (!r) return
  el.appendChild(r.extractContents()); r.insertNode(el)
  const sel = (root.ownerDocument.defaultView ?? window).getSelection()!
  sel.removeAllRanges()
  const nr = document.createRange(); nr.selectNodeContents(el); sel.addRange(nr)
}

const blocksInRange = (root: Element): HTMLElement[] => {
  const r = activeRange(root); if (!r) return []
  const blocks = new Set<HTMLElement>()
  const isBlock = (n: Node): n is HTMLElement =>
    n.nodeType === 1 && /^(p|h1|h2|h3|h4|h5|h6|li|pre|blockquote)$/.test((n as Element).localName)
  let node: Node | null = r.startContainer
  while (node && node !== root) { if (isBlock(node)) { blocks.add(node); break } node = node.parentNode }
  // also cover the (rare) multi-block case
  root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote').forEach((b) => {
    if (r.intersectsNode(b)) blocks.add(b as HTMLElement)
  })
  return [...blocks]
}

export const toggleInline = (root: Element, tag: InlineTag): void => {
  const r = activeRange(root); if (!r) return
  const existing = (r.commonAncestorContainer.parentElement)?.closest(tag)
  if (existing && root.contains(existing)) {
    while (existing.firstChild) existing.parentNode!.insertBefore(existing.firstChild, existing)
    existing.remove(); return
  }
  wrap(root, document.createElement(tag))
}

export const setBlock = (root: Element, tag: BlockTag): void => {
  for (const block of blocksInRange(root)) {
    const repl = document.createElement(tag)
    if (block.getAttribute('style')) repl.setAttribute('style', block.getAttribute('style')!)
    while (block.firstChild) repl.appendChild(block.firstChild)
    block.replaceWith(repl)
  }
}

export const toggleList = (root: Element, kind: 'ul' | 'ol'): void => {
  const blocks = blocksInRange(root); if (!blocks.length) return
  const list = document.createElement(kind)
  blocks[0].replaceWith(list)
  for (const b of blocks) { const li = document.createElement('li'); while (b.firstChild) li.appendChild(b.firstChild); list.appendChild(li); if (b.parentNode) b.remove() }
}

export const insertLink = (root: Element, url: string): void => {
  const a = document.createElement('a')
  a.setAttribute('href', url)
  a.setAttribute('target', '_blank')
  a.setAttribute('rel', 'noopener noreferrer')
  wrap(root, a)
}

const setStyleProp = (root: Element, prop: string, value: string | null): void => {
  const span = document.createElement('span')
  if (value !== null) span.style.setProperty(prop, value)
  wrap(root, span)
  if (value === null || !span.getAttribute('style')) {
    while (span.firstChild) span.parentNode!.insertBefore(span.firstChild, span)
    span.remove()
  }
}

export const setColor = (root: Element, cssColor: string): void => setStyleProp(root, 'color', cssColor)

export const setFontSize = (root: Element, preset: FontPreset): void =>
  setStyleProp(root, 'font-size', preset === 'M' ? null : FONT_PX[preset])

export const setAlign = (root: Element, value: Align): void => {
  for (const block of blocksInRange(root)) block.style.setProperty('text-align', value)
}

export const clearFormatting = (root: Element): void => {
  const r = activeRange(root); if (!r) return
  const text = r.toString()
  r.deleteContents(); r.insertNode(document.createTextNode(text))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/foreign-html-commands.test.ts`
Expected: PASS. (If a selection-API edge fails in jsdom, narrow that one assertion to e2e in C5 and leave a `// e2e:` note — do not weaken the command code.)

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/foreign-html-commands.ts tests/unit/foreign-html-commands.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): selection-based rich-text command layer"
```

---

### Task B3: `SeForeignHtmlDialog.ts` — Lit dialog component

**Files:**
- Create: `src/editor/dialogs/SeForeignHtmlDialog.ts`
- Test: `tests/unit/se-foreign-html-dialog.test.ts`

- [ ] **Step 1: Write the failing test** (mirrors `se-prompt-dialog.test.ts`)

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/dialogs/SeForeignHtmlDialog.ts'

const flush = async (el: any) => {
  await customElements.whenDefined('se-foreign-html-dialog')
  await new Promise((r) => queueMicrotask(r))
  if (el?.updateComplete) await el.updateComplete
}
const closeWith = (el: any, returnValue: string) => {
  const dlg = el.shadowRoot.querySelector('dialog')
  dlg.returnValue = returnValue
  dlg.dispatchEvent(new Event('close'))
}

describe('se-foreign-html-dialog', () => {
  let el: any
  beforeEach(() => { document.body.textContent = ''; el = document.createElement('se-foreign-html-dialog'); document.body.appendChild(el) })
  afterEach(() => { document.body.textContent = '' })

  it('resolves serialized html on OK', async () => {
    el.value = '<p>hi</p>'
    await flush(el)
    const closed = el.whenClosed()
    closeWith(el, 'ok')
    const { html } = await closed
    expect(html).toContain('hi')
  })

  it('resolves null on cancel', async () => {
    await flush(el)
    const closed = el.whenClosed()
    closeWith(el, 'cancel')
    await expect(closed).resolves.toEqual({ html: null })
  })

  it('seeds the editor with the value (edit mode)', async () => {
    el.value = '<p><strong>seed</strong></p>'
    await flush(el)
    expect(el.shadowRoot.querySelector('[part="editor"]').textContent).toContain('seed')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/se-foreign-html-dialog.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `SeForeignHtmlDialog.ts`**

```ts
import { LitElement, html, css } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { serialize, deserialize } from './foreign-html-serialize.js'
import * as cmd from './foreign-html-commands.js'

/**
 * Modal rich-HTML editor for foreignObject content. Consumed via the `seForeignHtml`
 * helper (globalDialogs.ts). `value` seeds edit mode; `whenClosed()` resolves the
 * serialized XHTML string on OK, or null on Cancel/Esc.
 */
@customElement('se-foreign-html-dialog')
export default class SeForeignHtmlDialog extends LitElement {
  static styles = css`
    dialog { padding: 0; width: 560px; max-width: 92vw; background: var(--se-surface); color: var(--se-text);
      border: 1px solid var(--se-border); border-radius: var(--se-radius-sm); font-family: var(--se-font-sans); }
    dialog::backdrop { background: var(--se-scrim); }
    .title { padding: var(--se-space-3); font-weight: 600; border-bottom: 1px solid var(--se-border); }
    .toolbar { display: flex; flex-wrap: wrap; gap: var(--se-space-2); padding: var(--se-space-2) var(--se-space-3);
      border-bottom: 1px solid var(--se-border); background: var(--se-surface-2); }
    .toolbar button, .toolbar select { background: var(--se-surface); color: var(--se-text);
      border: 1px solid var(--se-border-strong); border-radius: var(--se-radius-sm); padding: 2px 8px; font-size: .85em; cursor: pointer; }
    [part="editor"] { min-height: 160px; padding: var(--se-space-3); outline: none; }
    [part="editor"]:focus-visible { outline: 2px solid var(--se-focus-ring); outline-offset: -2px; }
    textarea { display: none; width: 100%; min-height: 160px; box-sizing: border-box; border: none;
      padding: var(--se-space-3); font-family: var(--se-font-mono, monospace); background: var(--se-surface-2); color: var(--se-text); }
    :host([source]) [part="editor"] { display: none; }
    :host([source]) textarea { display: block; }
    .foot { display: flex; justify-content: space-between; align-items: center; padding: var(--se-space-3); border-top: 1px solid var(--se-border); }
    .foot button { padding: 4px 14px; border-radius: var(--se-radius-sm); font-size: .9em; cursor: pointer; }
    button[value="ok"] { background: var(--se-accent); color: var(--se-on-accent, #fff); border: none; }
  `

  @property() accessor value = ''
  @property({ type: Boolean, reflect: true }) accessor source = false
  @query('[part="editor"]') private accessor _editor!: HTMLElement
  @query('textarea') private accessor _source!: HTMLTextAreaElement
  @state() private accessor _color = '#000000'

  private _resolve: ((r: { html: string | null }) => void) | null = null

  get opened (): boolean { return this.shadowRoot?.querySelector('dialog')?.open ?? false }

  open (): void {
    if (!this.isConnected) document.body.append(this)
    void this.updateComplete.then(() => {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (dlg && !dlg.open) {
        if (this.value) { this._editor.replaceChildren(deserialize(this.value)) }
        dlg.showModal(); this._editor.focus()
      }
    })
  }

  close (): void { this.shadowRoot?.querySelector('dialog')?.close() }

  whenClosed (): Promise<{ html: string | null }> {
    return new Promise((resolve) => { this._resolve = resolve })
  }

  private _onClose = (): void => {
    const dlg = this.renderRoot.querySelector('dialog')
    const accepted = dlg?.returnValue === 'ok'
    let out: string | null = null
    if (accepted) {
      if (this.source) this._editor.innerHTML = this._source.value
      out = serialize(this._editor)
    }
    this._resolve?.({ html: out }); this._resolve = null
    this.remove()
  }

  private _onPaste = (e: ClipboardEvent): void => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    this._editor.ownerDocument.execCommand('insertText', false, text)
  }

  private _toggleSource = (): void => {
    if (!this.source) this._source.value = serialize(this._editor)
    else this._editor.innerHTML = this._source.value
    this.source = !this.source
  }

  private _do (fn: () => void): void { this._editor.focus(); fn() }

  render () {
    return html`
      <dialog @close=${this._onClose}>
        <div class="title">Insert / Edit HTML</div>
        <div class="toolbar" part="toolbar">
          <select @change=${(e: Event) => this._do(() => cmd.setBlock(this._editor, (e.target as HTMLSelectElement).value as cmd.BlockTag))}>
            <option value="p">Normal</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option>
          </select>
          <button title="Bold" @click=${() => this._do(() => cmd.toggleInline(this._editor, 'strong'))}><b>B</b></button>
          <button title="Italic" @click=${() => this._do(() => cmd.toggleInline(this._editor, 'em'))}><i>I</i></button>
          <button title="Underline" @click=${() => this._do(() => cmd.toggleInline(this._editor, 'u'))}><u>U</u></button>
          <button title="Strikethrough" @click=${() => this._do(() => cmd.toggleInline(this._editor, 's'))}><s>S</s></button>
          <button title="Bulleted list" @click=${() => this._do(() => cmd.toggleList(this._editor, 'ul'))}>&bull;</button>
          <button title="Numbered list" @click=${() => this._do(() => cmd.toggleList(this._editor, 'ol'))}>1.</button>
          <button title="Link" @click=${this._onLink}>&#128279;</button>
          <input type="color" title="Text color" .value=${this._color}
            @input=${(e: Event) => { this._color = (e.target as HTMLInputElement).value }}
            @change=${() => this._do(() => cmd.setColor(this._editor, this._color))} />
          <select title="Align" @change=${(e: Event) => this._do(() => cmd.setAlign(this._editor, (e.target as HTMLSelectElement).value as cmd.Align))}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
          <select title="Font size" @change=${(e: Event) => this._do(() => cmd.setFontSize(this._editor, (e.target as HTMLSelectElement).value as cmd.FontPreset))}>
            <option value="M">Size</option><option value="S">S</option><option value="L">L</option><option value="XL">XL</option>
          </select>
          <button title="Clear formatting" @click=${() => this._do(() => cmd.clearFormatting(this._editor))}>&#10006;</button>
          <button title="HTML source" @click=${this._toggleSource}>&lt;/&gt;</button>
        </div>
        <div part="editor" contenteditable="true" @paste=${this._onPaste}></div>
        <textarea part="source"></textarea>
        <form method="dialog" class="foot">
          <span></span>
          <span>
            <button value="cancel">Cancel</button>
            <button value="ok">OK</button>
          </span>
        </form>
      </dialog>
    `
  }

  private _onLink = async (): Promise<void> => {
    const url = await window.sePrompt('Enter the link URL (https://…)')
    if (url) this._do(() => cmd.insertLink(this._editor, url))
  }
}
```

> NOTE: confirm the token names against `src/editor/styles/tokens.css` (`--se-surface`, `--se-surface-2`, `--se-text`, `--se-border`, `--se-border-strong`, `--se-scrim`, `--se-accent`, `--se-focus-ring`, `--se-radius-sm`, `--se-space-2/3`, `--se-font-sans`). If `--se-on-accent`/`--se-font-mono` don't exist, drop them (the fallbacks are inline). This keeps `lint:hex` green (no raw hex except the `<input type=color>` default, which is a value, not chrome — see Task C-lint note).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/se-foreign-html-dialog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/SeForeignHtmlDialog.ts tests/unit/se-foreign-html-dialog.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): SeForeignHtmlDialog Lit component"
```

---

### Task B4: `seForeignHtml` helper + global wiring

**Files:**
- Modify: `src/editor/dialogs/globalDialogs.ts`
- Modify: `src/editor/global-dialogs.d.ts`

- [ ] **Step 1: Add the helper + Window decl in `globalDialogs.ts`**

```ts
import SeForeignHtmlDialog from './SeForeignHtmlDialog.js'  // registration side-effect
// …in the `declare global { interface Window {…} }` block, add:
//   seForeignHtml: (initialHtml?: string) => Promise<string | null>

const seForeignHtml = async (initialHtml = ''): Promise<string | null> => {
  const dialog = new SeForeignHtmlDialog()
  dialog.value = initialHtml
  dialog.open()
  return (await dialog.whenClosed()).html
}
window.seForeignHtml = seForeignHtml
```

- [ ] **Step 2: Add the ambient decl** in `src/editor/global-dialogs.d.ts`

```ts
declare function seForeignHtml (initialHtml?: string): Promise<string | null>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm --prefix C:/Users/jscha/source/repos/svgedit run lint`
Expected: PASS (no unused/type errors).

- [ ] **Step 4: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/dialogs/globalDialogs.ts src/editor/global-dialogs.d.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): seForeignHtml global dialog helper"
```

---

## Phase C — Canvas integration

### Task C1: `setForeignContent` on svgcanvas (content swap + history + height auto-fit)

**Files:**
- Modify: `packages/svgcanvas/svgcanvas.ts` (add method + bind it like `setForeignContent = setForeignContentMethod`)
- Create: `packages/svgcanvas/core/foreign.ts` (the method, kept out of the already-large `svgcanvas.ts`)
- Test: `tests/unit/foreign-set-content.test.ts`

- [ ] **Step 1: Write the failing test** (history structure + content swap; height auto-fit is e2e)

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { setForeignContentMethod } from '../../packages/svgcanvas/core/foreign.js'

const makeCanvas = () => {
  const added: any[] = []
  const svgCanvas = {
    history: {
      BatchCommand: class { subs: any[] = []; addSubCommand (c: any) { this.subs.push(c) } },
      InsertElementCommand: class { constructor (public el: any) {} },
      RemoveElementCommand: class { constructor (public el: any, public sib: any, public parent: any) {} },
      ChangeElementCommand: class { constructor (public el: any, public attrs: any) {} }
    },
    addCommandToHistory: vi.fn((c) => added.push(c))
  }
  return { svgCanvas, added }
}

describe('setForeignContent', () => {
  it('swaps the foreignObject child and records one batch command', () => {
    const { svgCanvas, added } = makeCanvas()
    const fo = document.createElementNS(NS.SVG, 'foreignObject')
    fo.setAttribute('width', '200'); fo.setAttribute('height', '100')
    document.createElementNS(NS.SVG, 'svg').appendChild(fo)
    setForeignContentMethod(svgCanvas as any, fo, `<div xmlns="${NS.HTML}" class="se-fo-root"><p>hi</p></div>`)
    expect(fo.querySelector('p')?.textContent).toBe('hi')
    expect(svgCanvas.addCommandToHistory).toHaveBeenCalledTimes(1)
    expect(added[0].subs.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/foreign-set-content.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `packages/svgcanvas/core/foreign.ts`**

```ts
import { NS } from './namespaces.js'

/** Parse an XHTML string into a namespaced element for injection. */
const parseForeignRoot = (htmlString: string): Element => {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="${NS.SVG}"><foreignObject>${htmlString}</foreignObject></svg>`, 'image/svg+xml')
  const root = doc.querySelector('foreignObject')!.firstElementChild
  if (root) return document.importNode(root, true)
  const empty = document.createElementNS(NS.HTML, 'div'); empty.setAttribute('xmlns', NS.HTML); return empty
}

/**
 * Replace a foreignObject's HTML child with new (already-sanitized) content,
 * auto-fit its height to the rendered content, and record one undoable batch.
 */
export const setForeignContentMethod = (svgCanvas: any, fo: Element, htmlString: string): void => {
  const { BatchCommand, InsertElementCommand, RemoveElementCommand, ChangeElementCommand } = svgCanvas.history
  const batch = new BatchCommand('Set HTML content')
  const oldRoot = fo.firstElementChild
  const sibling = oldRoot?.nextSibling ?? null
  if (oldRoot) { batch.addSubCommand(new RemoveElementCommand(oldRoot, sibling, fo)); oldRoot.remove() }
  const newRoot = parseForeignRoot(htmlString)
  fo.appendChild(newRoot)
  batch.addSubCommand(new InsertElementCommand(newRoot))

  // Height auto-fit: keep width, grow height to fit content (best-effort; needs layout).
  const measured = (newRoot as HTMLElement).scrollHeight
  if (measured && Number(fo.getAttribute('height')) < measured) {
    const oldH = fo.getAttribute('height')
    fo.setAttribute('height', String(measured))
    batch.addSubCommand(new ChangeElementCommand(fo, { height: oldH }))
  }
  svgCanvas.addCommandToHistory(batch)
}
```

In `svgcanvas.ts`: import and bind it next to the other method bindings (search for an existing `this.<name> = <name>Method` block, e.g. near `this.sanitizeSvg = sanitizeSvg` ~line 1492):

```ts
import { setForeignContentMethod } from './core/foreign.js'
// …in the constructor binding block:
this.setForeignContent = (fo: Element, htmlString: string) => setForeignContentMethod(this, fo, htmlString)
```

Add `setForeignContent` to the canvas type surface (`packages/svgcanvas/core/svgcanvas-types.ts`) alongside `sanitizeSvg`:
```ts
setForeignContent: (fo: Element, htmlString: string) => void
```

- [ ] **Step 4: Run to verify it passes + typecheck**

Run: `npx vitest run tests/unit/foreign-set-content.test.ts && npm --prefix C:/Users/jscha/source/repos/svgedit run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add packages/svgcanvas/core/foreign.ts packages/svgcanvas/svgcanvas.ts packages/svgcanvas/core/svgcanvas-types.ts tests/unit/foreign-set-content.test.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): setForeignContent canvas method with history + height fit"
```

---

### Task C2: `foreign` mode (create + dialog) and double-click-to-edit in `event.ts`

**Files:**
- Modify: `packages/svgcanvas/core/event.ts`

The `foreignObject` sizing cases already exist in mousemove (~line 419) and the size-keep switch (~line 833). This task adds: (1) element creation on `mouseDown` when `currentMode === 'foreign'`, (2) a `mouseUp` hook that, after a foreign-mode draw, emits a canvas event the editor controller listens for, and (3) a `dblclick` hook for an existing `foreignObject`.

- [ ] **Step 1: Add foreign-mode creation in the `mouseDown` mode switch**

Find the `mouseDown` mode `switch` (where `case 'rect'` / `case 'square'` create `started` elements via `addSVGElementsFromJson`). Add:

```ts
      case 'foreignObject': {
        started = true
        const fo = svgCanvas.addSVGElementsFromJson({
          element: 'foreignObject',
          curStyles: false,
          attr: { x, y, width: 1, height: 1, id: svgCanvas.getNextId() }
        })
        // seed an empty XHTML root so it is a valid, selectable element
        const root = document.createElementNS(NS.HTML, 'div')
        root.setAttribute('xmlns', NS.HTML)
        root.setAttribute('class', 'se-fo-root')
        fo.appendChild(root)
        break
      }
```

(`setMode('foreign')` sets `currentMode`; map it to the existing `'foreignObject'` sizing cases. If the mode string differs from the element name, add a `case 'foreign':` that falls through to `'foreignObject'`, mirroring the `'square'`→`'rect'` fall-through.)

- [ ] **Step 2: Add the `mouseUp` completion hook**

In `mouseUp`, where a freshly drawn shape is finalized (after the `recalculateDimensions`/selection of `started` elements), add — for foreign mode — a default-size fallback and a callback:

```ts
    if (svgCanvas.getMode() === 'foreignObject' && element && element.tagName === 'foreignObject') {
      // click (no drag) → default size
      if (Number(element.getAttribute('width')) < 2) element.setAttribute('width', '240')
      if (Number(element.getAttribute('height')) < 2) element.setAttribute('height', '120')
      svgCanvas.call('foreignCreate', element)   // editor controller opens the dialog
      return
    }
```

(`svgCanvas.call(eventName, arg)` is svgedit's existing event-emit mechanism — verify the exact name used elsewhere, e.g. `svgCanvas.call('changed', …)`, and register `foreignCreate` as a bindable event in the canvas event map if required.)

- [ ] **Step 3: Add the `dblclick` edit hook**

Find the existing `dblClick`/`mouseDown`-detail handling (svgedit opens text editing on dblclick). Add, for a `foreignObject` target in select mode:

```ts
    if (mouseTarget && mouseTarget.tagName === 'foreignObject') {
      svgCanvas.call('foreignEdit', mouseTarget)
      return
    }
```

- [ ] **Step 4: Typecheck + commit** (behavior verified by e2e in C5)

Run: `npm --prefix C:/Users/jscha/source/repos/svgedit run typecheck`
Expected: PASS.

```bash
git -C C:/Users/jscha/source/repos/svgedit add packages/svgcanvas/core/event.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): foreign draw mode + dblclick-to-edit canvas events"
```

> Plan-time check: confirm `NS` is imported in `event.ts` (it imports from `./namespaces.js` elsewhere). Confirm `svgCanvas.call`/event-registration names against a sibling event (grep `svgCanvas.call(`).

---

### Task C3: Left-panel tool button, handler, locale, icon

**Files:**
- Modify: `src/editor/panels/LeftPanel.html`
- Modify: `src/editor/panels/LeftPanel.ts`
- Modify: `src/editor/locale/lang.en.ts` (add `tools.mode_foreign`)
- Create: the tool icon asset per the **M4 icon/mask pipeline** (alongside `text.svg`/`image.svg`; see `2026-06-09-svgedit-m4-icon-overhaul-design.md`)

- [ ] **Step 1: Add the button** in `LeftPanel.html` (after `tool_text`/`tool_image`)

```html
    <se-button id="tool_foreign" title="tools.mode_foreign" src="foreign.svg"></se-button>
```

- [ ] **Step 2: Add the handler + wiring** in `LeftPanel.ts`

```ts
  clickForeign () {
    if (this.updateLeftPanel('tool_foreign')) {
      this.editor.svgCanvas.setMode('foreign')
    }
  }
```

And in `init()`, next to the other `safeClick` lines:

```ts
    safeClick($id('tool_foreign'), this.clickForeign.bind(this))
```

- [ ] **Step 3: Add the locale key** in `src/editor/locale/lang.en.ts` (find the `tools` object, `mode_text`/`mode_image` entries)

```ts
    mode_foreign: 'Insert HTML',
```

- [ ] **Step 4: Add the icon** — create `foreign.svg` per the M4 pipeline (a text-box glyph), placed where `text.svg` resolves from for `se-button src`. Verify the path by checking where `text.svg` lives (grep the build's static-copy config / `scripts/copy-static.ts`).

- [ ] **Step 5: Build + lint** (the button renders only after a build/dev-serve; verified visually in C5)

Run: `npm --prefix C:/Users/jscha/source/repos/svgedit run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/panels/LeftPanel.html src/editor/panels/LeftPanel.ts src/editor/locale/lang.en.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): Insert HTML tool button, handler, locale, icon"
```

---

### Task C4: Editor controller (orchestration)

**Files:**
- Create: `src/editor/foreignHtml.ts`
- Modify: `src/editor/Editor.ts` (register the controller at init)

- [ ] **Step 1: Implement `foreignHtml.ts`**

```ts
import type Editor from './Editor.js'
import { deserialize } from './dialogs/foreign-html-serialize.js'

/** Wire the foreign-HTML create/edit flow to the canvas events emitted in event.ts. */
export const registerForeignHtml = (editor: Editor): void => {
  const canvas = editor.svgCanvas

  const authorInto = async (fo: Element, initialHtml: string, isNew: boolean): Promise<void> => {
    const result = await window.seForeignHtml(initialHtml)
    if (result === null || result.trim() === '') {
      // cancel, or empty-on-OK → delete the box (new boxes were just drawn)
      if (isNew || result === '') fo.remove()
      canvas.setMode('select')
      return
    }
    const clean = result // already allowlist-pruned by serialize; sanitize is the backstop
    const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
    tmp.innerHTML = '' // ensure parse context
    canvas.setForeignContent(fo, clean)
    canvas.sanitizeSvg(fo) // backstop pass over the injected subtree
    canvas.setMode('select')
    canvas.selectOnly?.([fo])
  }

  canvas.bind?.('foreignCreate', (_win: unknown, fo: Element) => { void authorInto(fo, '', true) })
  canvas.bind?.('foreignEdit', (_win: unknown, fo: Element) => {
    const root = fo.firstElementChild
    const current = root ? `<div xmlns="http://www.w3.org/1999/xhtml" class="se-fo-root">${root.innerHTML}</div>` : ''
    void authorInto(fo, current, false)
  })
}
```

> `deserialize` import is only needed if you preload the dialog from a fragment instead of a string; the dialog already accepts an HTML string via `value`, so the controller passes the string form above. Remove the unused import if eslint flags it.

- [ ] **Step 2: Register at init** in `Editor.ts` (where panels/dialogs are initialized — grep for `new LeftPanel` / `globalDialogs`):

```ts
import { registerForeignHtml } from './foreignHtml.js'
// …after svgCanvas + panels are constructed in the init path:
registerForeignHtml(this)
```

- [ ] **Step 3: Verify the canvas event API names** — `canvas.bind`/`canvas.call`/`canvas.selectOnly`/`canvas.setMode` must match svgedit's surface. Grep: `selectOnly`, `.bind(`, `.call(` in `packages/svgcanvas/svgcanvas.ts`. Adjust the controller to the real names if they differ (e.g. `addToSelection`).

- [ ] **Step 4: Build + lint**

Run: `npm --prefix C:/Users/jscha/source/repos/svgedit run build`
Expected: PASS (full typecheck of editor + canvas).

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add src/editor/foreignHtml.ts src/editor/Editor.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "feat(foreign): editor controller wiring create/edit flow"
```

---

### Task C5: End-to-end tests

**Files:**
- Create: `tests/e2e/foreign-html.spec.ts`

- [ ] **Step 1: Write the e2e spec** (model on an existing spec in `tests/e2e/`; selectors per the live DOM)

```ts
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.goto('/src/editor/index.html') })

test('insert HTML: tool → draw → author → appears on canvas', async ({ page }) => {
  await page.click('#tool_foreign')
  const canvas = page.locator('#svgcanvas')
  await canvas.dragTo(canvas, { sourcePosition: { x: 120, y: 120 }, targetPosition: { x: 360, y: 260 } })
  const dialog = page.locator('se-foreign-html-dialog')
  await expect(dialog).toBeVisible()
  const editor = dialog.locator('[part="editor"]')
  await editor.click(); await page.keyboard.type('Hello callout')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('foreignObject')).toHaveCount(1)
  await expect(page.locator('foreignObject')).toContainText('Hello callout')
})

test('cancel on a new box removes it', async ({ page }) => {
  await page.click('#tool_foreign')
  const canvas = page.locator('#svgcanvas')
  await canvas.dragTo(canvas, { sourcePosition: { x: 120, y: 120 }, targetPosition: { x: 300, y: 240 } })
  await page.locator('se-foreign-html-dialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('foreignObject')).toHaveCount(0)
})

test('double-click edits; undo restores; save→reload round-trips', async ({ page }) => {
  // insert
  await page.click('#tool_foreign')
  const canvas = page.locator('#svgcanvas')
  await canvas.dragTo(canvas, { sourcePosition: { x: 120, y: 120 }, targetPosition: { x: 360, y: 260 } })
  let dialog = page.locator('se-foreign-html-dialog')
  await dialog.locator('[part="editor"]').click(); await page.keyboard.type('First')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('foreignObject')).toContainText('First')

  // round-trip: read the SVG source and reload it (use the source dialog or canvas API)
  const svg = await page.evaluate(() => (window as any).svgCanvas.getSvgString())
  await page.evaluate((s) => (window as any).svgCanvas.setSvgString(s), svg)
  await expect(page.locator('foreignObject')).toContainText('First')

  // undo after an edit
  await page.locator('#tool_select').click()
  await page.locator('foreignObject').dblclick()
  dialog = page.locator('se-foreign-html-dialog')
  await dialog.locator('[part="editor"]').click()
  await page.keyboard.press('Control+a'); await page.keyboard.type('Second')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('foreignObject')).toContainText('Second')
  await page.keyboard.press('Control+z')
  await expect(page.locator('foreignObject')).toContainText('First')
})

test('source toggle authors raw HTML', async ({ page }) => {
  await page.click('#tool_foreign')
  const canvas = page.locator('#svgcanvas')
  await canvas.dragTo(canvas, { sourcePosition: { x: 120, y: 120 }, targetPosition: { x: 360, y: 260 } })
  const dialog = page.locator('se-foreign-html-dialog')
  await dialog.getByRole('button', { name: '</>' }).click()
  await dialog.locator('textarea').fill('<h2>Sourced</h2>')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('foreignObject h2')).toContainText('Sourced')
})
```

- [ ] **Step 2: Run e2e** (builds, serves on :9000, runs Playwright both browsers)

Run: `npm --prefix C:/Users/jscha/source/repos/svgedit test`
Expected: lint + unit (all green) + e2e including the new spec PASS in both browsers. Triage any selector mismatches against the live DOM (`#svgcanvas` id, OK/Cancel button accessible names) and fix the spec — not the app — unless a real bug surfaces (then `superpowers:systematic-debugging`).

- [ ] **Step 3: Commit**

```bash
git -C C:/Users/jscha/source/repos/svgedit add tests/e2e/foreign-html.spec.ts
git -C C:/Users/jscha/source/repos/svgedit commit -m "test(foreign): e2e insert/edit/cancel/source/undo/round-trip"
```

---

### Task C6: CHANGELOG + docs (export limitation)

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]` → Added)
- Modify: the user-facing feature docs (the editor README / docs page that lists tools — grep for where `mode_text`/tools are documented)

- [ ] **Step 1: Add the CHANGELOG entry** under `## [Unreleased]` → `### Added` (per CHANGELOG SOP — note only under `[Unreleased]`, never a pre-written version header)

```markdown
### Added
- **Insert HTML tool** — author rich HTML (headings, bold/italic/underline/strikethrough, lists, links, color, alignment, font size) inside a `foreignObject`, via a themed modal editor. Double-click to edit; content round-trips through save/load. Known limitation: `foreignObject` content renders in the editor but not in all SVG raster/export paths (and not in non-browser SVG renderers such as librsvg).
```

- [ ] **Step 2: Verify svgedit's own export behavior** — manually export a drawing containing a foreignObject (PNG/PDF path) and record whether it appears; note the result in the docs limitation line. (If svgedit's export drops it, the CHANGELOG note above is accurate as written.)

- [ ] **Step 3: Lint (markdownlint) + commit**

```bash
npm --prefix C:/Users/jscha/source/repos/svgedit run lint:md
git -C C:/Users/jscha/source/repos/svgedit add CHANGELOG.md
git -C C:/Users/jscha/source/repos/svgedit commit -m "docs(foreign): changelog + foreignObject export limitation note"
```

---

### Task C7: Full-suite green + finish

- [ ] **Step 1: Run the full suite**

Run: `npm --prefix C:/Users/jscha/source/repos/svgedit test`
Expected: lint + unit (+coverage) + e2e (both browsers) ALL green.

- [ ] **Step 2:** Use `superpowers:finishing-a-development-branch` to decide merge/PR. On a signed repo, the PR merges via **squash** (`gh pr merge --squash --delete-branch`), never rebase (web-flow signing).

---

## Self-Review (completed by plan author)

**Spec coverage** — every spec section maps to a task: §4.4 sanitizer → A2–A6; §4.3 serialize → B1; §4.2 commands → B2; §4.1 dialog → B3; §4.6 helper/panel/controller → B4, C3, C4; §4.5 svgcanvas/event → C1, C2; §5 data flow → C4 + C5; §6 testing → A1/A6 + B-tests + C5; §7 files → all tasks; §8 risks → A1 (namespace spike), C1 (height-fit best-effort), C5 (export verify), C-notes (hex-guard, event-API verification).

**Placeholder scan** — no "TBD/TODO/handle edge cases"; the `> NOTE`/`Plan-time check` blocks are explicit verification steps with the exact grep/anchor to confirm, matching the spec's §8 style (the executor confirms a real name against current code), not deferred design.

**Type consistency** — names are consistent across tasks: `FOREIGN_HTML_TAGS`/`FOREIGN_HTML_ATTRS`/`FOREIGN_STYLE_PROPS`/`FOREIGN_HREF_SCHEMES` (A2 → B1 → A4/A5), `serialize`/`deserialize`/`FOREIGN_ROOT_CLASS` (B1 → B3 → C4), command names `toggleInline/setBlock/toggleList/insertLink/setColor/setFontSize/setAlign/clearFormatting` + types `InlineTag/BlockTag/Align/FontPreset` (B2 → B3), `setForeignContent`/`setForeignContentMethod` (C1 → C4), canvas events `foreignCreate`/`foreignEdit` (C2 → C4), element marker class `se-fo-root` (C2 → B1 → C4).
