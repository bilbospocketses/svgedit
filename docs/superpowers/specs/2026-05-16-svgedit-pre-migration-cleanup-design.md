# svgedit pre-migration cleanup — design spec

**Status:** Approved (brainstorm 2026-05-16). Feeds the implementation plan written by `superpowers:writing-plans`.

**Maps to:** Step 1 of the 5-step migration sequence (see below). Mostly mechanical execution from `docs/AUDIT_2026-05-16.md` § "Pre-migration deletions" + § "Brand / attribution updates" + audit decisions on the two duplicate-code purges.

**Inputs:** `docs/AUDIT_2026-05-16.md` (per-file audit + decisions log); `todo_svgedit.md` items #2 (migration-cleanup checklist), #10 (correctness backlog — 3 textual entries folded into this PR).

---

## 1. Migration sequencing — 5 PRs (expanded from 4)

Step 1.5 was added during this brainstorm to isolate browser-compat investigation work from Step 1's mechanical cleanup.

| Step | PR | Scope | Status before this spec |
|---|---|---|---|
| 1 | `feat/pre-migration-cleanup` | **THIS SPEC.** Mechanical deletions + brand updates + 3 textual fixes + grep-verified duplicate purges | Designed (this doc); plan to be written |
| 1.5 | `feat/browser-compat-investigation` | Manual browser testing of `isWebkit()` Chrome-7 + Firefox 353575 workarounds; drop if obsolete | Deferred to dedicated mini-PR |
| 2 | `feat/pathseg-drop` | 8 `createSVGPathSeg*` refactors + polyfill removal | Designed in `docs/AUDIT_2026-05-16.md` § pathseg-drop transition plan |
| 3 | `feat/ts-migration` | TS conversion under day-one strict | Spec + plan already written (`2026-05-16-svgedit-ts-migration-design.md`, `...-plan.md`) |
| 4 | `feat/elix-to-lit` | Lit rewrite of elix-bound components | Deferred to dedicated brainstorm (`todo_svgedit.md` #3) |

This spec covers **only Step 1**. Step 1.5 gets its own brief spec when it's time; Step 2 is mostly described by the audit doc + the Step 3 spec's brief sketch.

---

## 2. Scope

### In scope

**A. File / folder deletions:**
- `src/editor/browser-not-supported.js` (8 lines — universal SVG support check, dead since ~2008)
- `src/editor/browser-not-supported.html` (companion stub)
- `src/editor/extensions/ext-helloworld/` (entire folder, including `ext-helloworld.js` + `locale/en.js` — tutorial/demo extension, no product value)

**B. Tied references to remove with A:**
- `scripts/copy-static.mjs:14-15` — two lines copying `browser-not-supported.*` to `dist/`
- `src/editor/index.html:15` — `<script type="module" src="./browser-not-supported.js"></script>`
- `src/editor/iife-index.html:12` — same script tag
- `src/editor/xdomain-index.html:12` — same script tag
- Verify no `ext-helloworld` references remain in `ConfigObj.js`'s `defaultExtensions` array (audit said clean; verify)

**C. In-file dead-code deletions:**

| Site | What | Why dead |
|---|---|---|
| `ConfigObj.js:185-191` | `// 'ext-imagelib'` + `// 'ext-arrows'` stale comments | Folders deleted upstream long ago |
| `ConfigObj.js:364` | `else if (window.widget) { ... }` | KaiOS / Apple-Dashboard widget API; dead since ~2014 |
| `ext-storage.js:208` | Same `window.widget` branch | Same |
| `packages/svgcanvas/core/namespaces.js:22-27` | Commented-out SODIPODI/INKSCAPE/RDF/OSB/CC/DC namespaces | Inkscape-import nostalgia; never used |
| `packages/svgcanvas/core/sanitize.js:83-114` | MathML allowlist (31 entries) | Out of scope for Control Menu use case per audit decision |
| `packages/svgcanvas/core/sanitize.js:209` | `oi:` namespace handling | Vestigial Optimistik fork remnant |
| `packages/svgcanvas/core/namespaces.js:19` | `NS.OI` definition | Same |
| `jQuery.jPicker.js:645` | `const isLessThanIE7 = ...` definition | IE6 detection; dead since ~2014 |
| `jQuery.jPicker.js:1063-1067` | IE6 alpha-image filter branch | IE6 dead |
| `jQuery.jPicker.js:1085-1093` | IE6 alpha+opacity filter branch | IE6 dead |
| `jQuery.jPicker.js:1097-1101` | IE6 alpha-image filter branch | IE6 dead |
| `jQuery.jPicker.js:1267-1278` | Commented-out jQuery `fadeIn`/`slideDown` effects | Dead commented code |
| `jQuery.jPicker.js:1296-1307` | Commented-out jQuery `show` effects | Dead commented code |
| `path-actions.js:887-899` | Commented-out Opera-bug workaround block | Opera-Presto dead since 2013 |
| `path-actions.js:1167-1170` | `if (window.opera) { ... }` Opera-repaint branch | Same |
| `seExplorerButton.js:26` | `this.request = new XMLHttpRequest()` (unused — actual fetches use `fetch()`) | Dead instance per audit |

**D. Brand / attribution updates:**

| Site | From | To |
|---|---|---|
| `packages/svgcanvas/core/clear.js:51` | `https://github.com/SVG-Edit/svgedit` (SVG-creator comment URL) | `https://github.com/bilbospocketses/svgedit` |
| `src/editor/MainMenu.js:6` | `const homePage = 'https://github.com/SVG-Edit/svgedit'` | `const homePage = 'https://github.com/bilbospocketses/svgedit'` |
| `src/editor/MainMenu.js:229` | `<se-menu id="main_button" label="SVG-Edit" ...>` | `<se-menu id="main_button" label="svgedit" ...>` |

**E. Three textual fixes (folded per brainstorm Q1):**

| Site | Fix |
|---|---|
| `src/editor/components/seExplorerButton.js:134` | `class="image-lib""` → `class="image-lib"` (delete extra `"`) |
| `src/editor/components/seZoom.js:78` | Add missing `;` at end of `position:fixed` line (line 79 starts `display:flex`) |
| `src/editor/extensions/ext-connector/ext-connector.js:240` | Comment typo "startss" → "starts" |

These are textual-only changes (HTML/CSS parsers are tolerant of the current state; the typo is in a comment). They don't change observable behavior.

**F. Verify-then-delete duplicates (grep-verification only — no browser testing):**

| Site | Verification | Action |
|---|---|---|
| `packages/svgcanvas/core/path.js:633-786 convertPath` | Audit B4a found this is a duplicate of `path-actions.js:41-209 convertPath`. Active code routes through path-actions.js's version. Final verification: `grep -rn "from.*path['\"]" packages src` — confirm no consumer imports `convertPath` from `path.js`. | Delete the 154 lines |
| `src/editor/Editor.js:439-456 getParents` | Audit-of-audit verified no external `editor.getParents()` callers. Editor.js does NOT import the util `getParents` (only `getParentsUntil`). Final verification: `grep -rn "editor\.getParents\|this\.getParents" src packages` — should yield only Editor.js's own declaration. | Delete the 18 lines |

### Out of scope

- **Browser-compat investigations** (`isWebkit` Chrome-7 workaround + Firefox 353575 workarounds) — deferred to dedicated Step 1.5 PR (manual browser testing required)
- **All other todo #10 bugs requiring real fixes** (LayersPanel duplicate `_eye.style.width`, duplicate `mouseup` listener, `super.attributeChangedCallback` 3 sites, `screen.*` vs `window.inner*` in cmenuDialog, i18n double-dot in Editor.js, `appendChild(string)` in contextmenu.js, jQuery-on-DOM in jPicker, etc.) — separate dedicated PR after Step 3
- **Code-quality modernizations** (vendor-prefix CSS, `e.keyCode`→`e.key`, magic-index inputs, bitwise int-casts, etc.) — these live in `todo_svgedit.md` #2's migration-cleanup checklist and ride with the TS migration in Step 3
- **Naming-consistency renames** (`controllPoint*`, `getrootSctm`, etc.) — Step 3's Task 17 (TS-aware rename refactor)
- **File conversions** (`.js` stays `.js` in Step 1)
- **TS scaffolding** — Step 3
- **Linter changes** — `standard` stays in Step 1; ESLint swap is Step 3

### Note on "no behavior changes" rule

The rule for Step 1 is **"no *intended* behavior changes; textual cleanup OK."** The 3 textual fixes (E above) are not behavior changes — HTML/CSS parsers are tolerant of the current state, and the typo is in a comment. Documented here so future auditors of this PR don't get confused by the inclusion.

---

## 3. Commit cadence

**Branch:** `feat/pre-migration-cleanup` (cut from `master`; safety tag `pre-cleanup` placed on master HEAD before cutting).

**7 commits, by logical unit:**

```
C0   chore: tag `pre-cleanup` safety point on master before branching
C1   chore: delete browser-not-supported.{js,html} + tied references in copy-static.mjs + 3 index.html files
C2   chore: delete ext-helloworld extension folder + verify no defaultExtensions refs
C3   chore: drop dead-code blocks (window.widget, IE6, Opera, MathML, oi:, jPicker commented effects, dead XMLHttpRequest)
C4   chore: update brand / attribution to fork (clear.js, MainMenu.js homePage + brand label)
C5   fix: textual cleanup (seExplorerButton HTML syntax, seZoom CSS semicolon, ext-connector comment typo)
C6   refactor: verify-then-delete duplicate convertPath (path.js:633-786) + getParents (Editor.js:439-456)
```

**Why this cadence:**
- One commit per logical unit so a partial revert keeps the rest of the cleanup
- C1 + C2 (file deletions) before C3 (in-file edits) so reviewers see scope shrinking first
- C5 (textual fixes) and C6 (duplicate purges) at the end so they're easy to revert if a regression surfaces
- ~5-10 file touches per commit; reviewable in ~5 min each

---

## 4. Verification gates

### Per-commit (before each commit lands)

```bash
npm run lint                # standard linter (still standard at this point; ESLint swap is Step 3)
npx vitest run              # all 565 unit tests pass
node scripts/run-e2e.mjs    # all 81 Playwright e2e tests pass
```

### PR-merge gate

All per-commit gates plus:
- `npm run build` succeeds; `dist/editor/` produced
- Manual smoke: open `http://localhost:8000/src/editor/index.html`, draw rect + circle + path, save SVG, reload the page, modify, save again. Verify no console errors. Verify brand string shows "svgedit" (not "SVG-Edit") in the main menu.
- File-count check: `git diff --stat master..HEAD` shows expected deletions (specifically: 4 file deletions = browser-not-supported.{js,html} + ext-helloworld/{ext-helloworld.js,locale/en.js}; ~150-200 line deletions across in-file edits)

### Regression-watch list

| Site | Why risky | Mitigation |
|---|---|---|
| `path.js:633-786 convertPath` deletion | Audit said duplicate but trust-but-verify | `grep -rn "from.*['\"]\\.\\.\\?/path['\"]" packages src` before deleting; expect zero consumer imports of `convertPath` from `path.js` |
| `Editor.js:439-456 getParents` deletion | Audit-of-audit verified no external callers but final check needed | `grep -rn "editor\\.getParents\\|this\\.getParents" src packages`; expect only Editor.js's own declaration |
| MathML allowlist removal | Any in-the-wild SVG with MathML will silently lose those elements on import | Acceptable per audit decision; out of scope for Control Menu use case |
| Optimistik `oi:` namespace removal | Vestigial `oi:` attributes in imported SVGs get stripped | Acceptable |
| `window.widget` removal | KaiOS / Apple-Dashboard runtime dead; no current users | Acceptable |
| `<script>` tag removal from 3 `.html` files | If any test or runtime expects `window.SVGSVGElement` check to fire | The check is universal-SVG-support, irrelevant in modern browsers; not a real risk |

---

## 5. Risks + rollback

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Audit's "duplicate" claim for `path.js convertPath` is wrong | Low | Subtle runtime breakage if a consumer imports the path.js version | Grep before deleting (C6 Step 1); if a live import surfaces, abort C6 and document for a follow-up audit |
| A deletion target has already been removed by upstream-or-earlier-work | Low | Cosmetic — just skip that line item | Per-commit gate catches; no harm |
| A commented-out block being deleted contains the only documentation for *why* a workaround was once needed | Low | Loss of historical context | For IE6, Opera, KaiOS the historical reasoning is well-known; not worth preserving |
| Brand string change to "svgedit" in `MainMenu.js:229` breaks a snapshot test | Low | One test fails; easy fix | If test snapshot exists, update it as part of C4 |

### Rollback

Step 1 lands as a single PR with 7 ordered commits on `feat/pre-migration-cleanup`:

- **Pre-merge rollback:** `git checkout master && git branch -D feat/pre-migration-cleanup`. Zero impact.
- **Post-merge rollback:** `git revert -m 1 <merge-commit-sha>`. Recovers master fully.
- **Per-commit revert:** any of C1–C6 individually revertable; e.g., if MathML deletion surfaces a regression, `git revert <C3-sha>` puts back the entire C3 dead-code-drop, then re-land minus the MathML lines as a follow-up.
- **Safety tag:** `pre-cleanup` placed at master HEAD in C0.

### Follow-on after Step 1 lands

1. **Step 1.5** (`feat/browser-compat-investigation`) — manual browser testing of `isWebkit()` Chrome-7 + Firefox 353575 workarounds.
2. **Step 2** (`feat/pathseg-drop`) — audit's pathseg-drop transition plan.
3. **Step 3** (`feat/ts-migration`) — per the existing TS migration spec + plan.

---

## Headline

This PR is **"the audit's pre-migration deletions list, executed mechanically, plus 3 textual fixes and 2 duplicate-code purges."** Smaller and more boring than Step 3 — by design. Sets a clean baseline so Step 3 doesn't have to navigate around dead code while typing.
