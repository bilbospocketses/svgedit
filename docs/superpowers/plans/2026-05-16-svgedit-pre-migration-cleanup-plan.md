# svgedit pre-migration cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the audit's pre-migration deletions + brand updates + 3 textual fixes + 2 duplicate-code purges so Step 3 (TS migration) doesn't have to type around dead code.

**Architecture:** Single PR (`feat/pre-migration-cleanup`) with 7 ordered commits on `master`. Each commit is one logical unit (file deletions, dead-code drops, brand updates, textual fixes, duplicate purges). No file conversions; no TS scaffolding; `.js` stays `.js`.

**Tech Stack:** Unchanged. `standard` linter still in use (ESLint swap is Step 3). Vite 7, Vitest 4, Playwright 1.57.

**Spec:** `docs/superpowers/specs/2026-05-16-svgedit-pre-migration-cleanup-design.md`

---

## Per-commit verification gate

Run after every commit's edits, BEFORE the `git commit` step. If anything fails, fix before committing — never commit broken intermediate state.

```bash
npm run lint                # standard linter; clean
npx vitest run              # all 565 unit tests pass; no count change
node scripts/run-e2e.mjs    # all 81 Playwright tests pass; no count change
```

If a previously-passing test starts failing after a deletion, the deletion is wrong (either the audit was wrong about deadness, or the deletion removed a load-bearing site). Investigate before continuing — don't paper over.

---

## Task 1 (C0): Branch off master with safety tag

**Files:** none (git operations only).

- [ ] **Step 1: Confirm on master and pristine**

```bash
git checkout master
git pull
git status
```

Expected: `On branch master`, `Your branch is up to date with 'origin/master'`, `nothing to commit, working tree clean`.

- [ ] **Step 2: Place safety tag**

```bash
git tag pre-cleanup
git push origin pre-cleanup
```

This tag is the worst-case rollback point.

- [ ] **Step 3: Cut the working branch**

```bash
git checkout -b feat/pre-migration-cleanup
git push -u origin feat/pre-migration-cleanup
```

- [ ] **Step 4: Capture baseline test counts**

```bash
npm run lint                # capture pass/fail
npx vitest run 2>&1 | tail -5    # capture count
node scripts/run-e2e.mjs 2>&1 | tail -5  # capture count
```

Record vitest + e2e counts. These are the baseline; every subsequent commit's gate must match.

---

## Task 2 (C1): Delete browser-not-supported + tied references

**Files:**
- Delete: `src/editor/browser-not-supported.js`
- Delete: `src/editor/browser-not-supported.html`
- Modify: `scripts/copy-static.mjs` (drop 2 lines from `targets` array)
- Modify: `src/editor/index.html` (drop line 15 `<script>` tag)
- Modify: `src/editor/iife-index.html` (drop line 12 `<script>` tag)
- Modify: `src/editor/xdomain-index.html` (drop line 12 `<script>` tag)

- [ ] **Step 1: Delete the two browser-not-supported files**

```bash
git rm src/editor/browser-not-supported.js
git rm src/editor/browser-not-supported.html
```

- [ ] **Step 2: Drop tied lines from scripts/copy-static.mjs**

Read `scripts/copy-static.mjs`. Locate the two lines in the `targets` array:

```js
    ['src/editor/browser-not-supported.html', 'browser-not-supported.html'],
    ['src/editor/browser-not-supported.js', 'browser-not-supported.js'],
```

Remove both entries from the array. Save.

- [ ] **Step 3: Drop the script tag from index.html**

Read `src/editor/index.html`. Locate line ~15:

```html
  <!-- Lacking browser support -->
  <script type="module" src="./browser-not-supported.js"></script>
```

Remove both the comment line and the script tag line. Save.

- [ ] **Step 4: Drop the script tag from iife-index.html**

Same pattern in `src/editor/iife-index.html` around line 12. Read the file to find the exact location; remove the comment + script tag pair.

- [ ] **Step 5: Drop the script tag from xdomain-index.html**

Same pattern in `src/editor/xdomain-index.html` around line 12. Read the file to find the exact location; remove the comment + script tag pair.

- [ ] **Step 6: Run verification gate**

```bash
npm run lint && npx vitest run && node scripts/run-e2e.mjs
```

All must pass with counts unchanged from baseline.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete browser-not-supported.{js,html} + tied references (dead universal-SVG-support check)"
```

---

## Task 3 (C2): Delete ext-helloworld extension

**Files:**
- Delete: `src/editor/extensions/ext-helloworld/` (folder; contains `ext-helloworld.js` + `locale/en.js`)
- Verify: `src/editor/ConfigObj.js` `defaultExtensions` array does NOT reference `ext-helloworld`

- [ ] **Step 1: Verify ext-helloworld is not in defaultExtensions**

```bash
grep -n "ext-helloworld" src/editor/ConfigObj.js
```

Expected: zero matches (audit said the folder existed but was NOT enabled in `defaultExtensions`). If a match surfaces, investigate — Step 1 doesn't disable an active extension, that's a behavior change.

- [ ] **Step 2: Delete the folder**

```bash
git rm -r src/editor/extensions/ext-helloworld/
```

This removes:
- `src/editor/extensions/ext-helloworld/ext-helloworld.js`
- `src/editor/extensions/ext-helloworld/locale/en.js`

- [ ] **Step 3: Run verification gate**

```bash
npm run lint && npx vitest run && node scripts/run-e2e.mjs
```

All must pass with counts unchanged.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete ext-helloworld extension (tutorial/demo, no product value)"
```

---

## Task 4 (C3): Drop in-file dead-code blocks

**Files:**
- Modify: `src/editor/ConfigObj.js` (drop lines 185-191 stale comments + line 364 `window.widget` branch)
- Modify: `src/editor/extensions/ext-storage/ext-storage.js` (drop line 208 `window.widget` branch)
- Modify: `packages/svgcanvas/core/namespaces.js` (drop line 19 NS.OI + lines 22-27 commented namespaces)
- Modify: `packages/svgcanvas/core/sanitize.js` (drop lines 83-114 MathML allowlist + line 209 oi: handling)
- Modify: `src/editor/components/jgraduate/jQuery.jPicker.js` (drop IE6 + commented effects)
- Modify: `packages/svgcanvas/core/path-actions.js` (drop commented Opera-bug + window.opera branch)
- Modify: `src/editor/components/seExplorerButton.js` (drop line 26 dead XMLHttpRequest)

Run each step's edit; verify gate after all edits land (not between each file).

- [ ] **Step 1: Drop ConfigObj.js stale comments + window.widget**

Read `src/editor/ConfigObj.js`. Locate lines 185-191 in the `defaultExtensions` array:

```js
      // 'ext-imagelib',
      // 'ext-arrows',
```

Remove these two comment lines (they reference deleted upstream extensions).

Locate line ~364 with the `window.widget` branch:

```js
      } else if (window.widget) {
        this.defaultPrefs[key] = window.widget.preferenceForKey(storeKey)
```

This branch is inside a longer if/else chain. Remove the `} else if (window.widget) { ... }` block entirely — preserve the if/else structure for the remaining branches. (Read surrounding context to confirm structure before editing.)

- [ ] **Step 2: Drop ext-storage.js window.widget branch**

Read `src/editor/extensions/ext-storage/ext-storage.js`. Locate line 208:

```js
          } else if (window.widget) {
            window.widget.setPreferenceForKey(val, key)
```

Remove the `} else if (window.widget) { ... }` block. Preserve surrounding if/else.

- [ ] **Step 3: Drop namespaces.js NS.OI + commented namespaces**

Read `packages/svgcanvas/core/namespaces.js`. The current `NS` object looks like:

```js
export const NS = {
  HTML: 'http://www.w3.org/1999/xhtml',
  MATH: 'http://www.w3.org/1998/Math/MathML',
  SE: 'http://svg-edit.googlecode.com',
  SVG: 'http://www.w3.org/2000/svg',
  XLINK: 'http://www.w3.org/1999/xlink',
  OI: 'http://www.optimistik.fr/namespace/svg/OIdata',
  XML: 'http://www.w3.org/XML/1998/namespace',
  XMLNS: 'http://www.w3.org/2000/xmlns/' // see http://www.w3.org/TR/REC-xml-names/#xmlReserved
  // SODIPODI: 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd',
  // INKSCAPE: 'http://www.inkscape.org/namespaces/inkscape',
  // RDF: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  // OSB: 'http://www.openswatchbook.org/uri/2009/osb',
  // CC: 'http://creativecommons.org/ns#',
  // DC: 'http://purl.org/dc/elements/1.1/'
}
```

Remove:
- The `OI:` line (line 19)
- All 6 commented-out namespace lines (SODIPODI through DC)
- Fix the trailing comma on the previous line if needed (after removing OI, the line above gets a comma; after removing all commented-out namespaces, the XMLNS line keeps its inline comment but no trailing comma needed).

Final `NS` object should look like:

```js
export const NS = {
  HTML: 'http://www.w3.org/1999/xhtml',
  MATH: 'http://www.w3.org/1998/Math/MathML',
  SE: 'http://svg-edit.googlecode.com',
  SVG: 'http://www.w3.org/2000/svg',
  XLINK: 'http://www.w3.org/1999/xlink',
  XML: 'http://www.w3.org/XML/1998/namespace',
  XMLNS: 'http://www.w3.org/2000/xmlns/' // see http://www.w3.org/TR/REC-xml-names/#xmlReserved
}
```

- [ ] **Step 4: Drop sanitize.js MathML allowlist + oi: handling**

Read `packages/svgcanvas/core/sanitize.js`. Locate lines 83-114 — the MathML element entries in the `svgWhiteList` object:

```js
  // MathML Elements
  annotation: ['encoding'],
  'annotation-xml': ['encoding'],
  maction: ['actiontype', 'other', 'selection'],
  // ... 28 more entries ...
  none: [],
  semantics: [],
```

Remove all 31 MathML element entries (lines 83-114 in the audit's count — the `// MathML Elements` comment line plus the 31 entries below it).

Also locate line 209 — the `oi:` handling in the sanitize function:

```js
          if (attrName.startsWith('se:') || attrName.startsWith('oi:') || attrName.startsWith('data-')) {
            // We should bypass the namespace aswell
            const seAttrNS = (attrName.startsWith('se:')) ? NS.SE : ((attrName.startsWith('oi:')) ? NS.OI : null)
            seAttrs.push([attrName, attr.value, seAttrNS])
```

Simplify to:

```js
          if (attrName.startsWith('se:') || attrName.startsWith('data-')) {
            // We should bypass the namespace as well
            const seAttrNS = attrName.startsWith('se:') ? NS.SE : null
            seAttrs.push([attrName, attr.value, seAttrNS])
```

Also fixed the "aswell" → "as well" typo while we're here (single-line cleanup, no behavior change).

- [ ] **Step 5: Drop jQuery.jPicker.js IE6 + commented effects**

Read `src/editor/components/jgraduate/jQuery.jPicker.js`. Remove the following blocks (verify each block's exact start/end by reading the file first — line numbers may have shifted):

1. **Line 645 (`isLessThanIE7` constant):**
   ```js
   const isLessThanIE7 = Number.parseFloat(navigator.appVersion.split('MSIE')[1]) < 7 && document.body.filters // needed to run the AlphaImageLoader function for IE6
   ```
   Delete entire line.

2. **Lines 1063-1067 (IE6 filter on image src):**
   ```js
   if (isLessThanIE7 && (src.includes('AlphaBar.png') || src.includes('Bars.png') || src.includes('Maps.png'))) {
       const img = new Image()
       img.src = src
       img.style.filter = 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src=\'' + src + '\', sizingMethod=\'scale\')'
   }
   ```
   Delete entire block (including any surrounding logic that only runs when isLessThanIE7 — verify).

3. **Lines 1085-1093 (IE6 filter on object):**
   ```js
   if (isLessThanIE7) {
       const src = ...
       if (alpha === undefined) {
           obj.style.filter = 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src=\'' + src + '\', sizingMethod=\'scale\')'
       } else {
           obj.style.filter = 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src=\'' + src +
           '\', sizingMethod=\'scale\') progid:DXImageTransform.Microsoft.Alpha(opacity=' + alpha + ')'
       }
   }
   ```
   Delete entire `if (isLessThanIE7) { ... }` block.

4. **Lines 1097-1101 (similar IE6 filter):**
   ```js
   if (isLessThanIE7) {
       ...
       obj.style.filter = 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src=\'' + src + ...
   }
   ```
   Delete entire block.

5. **Lines 1267-1278 (commented-out jQuery effects):**
   ```js
   // $.fn.extend({
   //     fadeIn: ...
   //     ...
   // })
   ```
   Delete entire commented-out block (multi-line `//`-prefixed).

6. **Lines 1296-1307 (commented-out jQuery effects):**
   ```js
   // $.fn.show = ...
   //     ...
   ```
   Delete entire commented-out block.

After all deletions, verify no straggler `isLessThanIE7`, `progid:DXImageTransform`, or commented-out jQuery effects remain in the file:

```bash
grep -n "isLessThanIE7\|progid:DXImageTransform" src/editor/components/jgraduate/jQuery.jPicker.js
```

Expected: zero matches.

- [ ] **Step 6: Drop path-actions.js commented Opera-bug + window.opera**

Read `packages/svgcanvas/core/path-actions.js`.

1. **Lines 887-899 (commented Opera-bug workaround):**
   ```js
   // Opera/win/non-EN throws an error here.
   // TODO: Find out why!
   // Presumed fixed in Opera 10.5, so commented out for now
   
   // try {
   const len = segList.numberOfItems
   // } catch(err) {
   //   const fixed_d = pathActions.convertPath(pth);
   //   pth.setAttribute('d', fixed_d);
   //   segList = pth.pathSegList;
   //   const len = segList.numberOfItems;
   // }
   ```
   Delete the commented-out lines (lines starting with `// `), but **KEEP** the `const len = segList.numberOfItems` line (line 893 — that's active code).

   Result:
   ```js
   const len = segList.numberOfItems
   ```

2. **Lines 1167-1170 (window.opera branch):**
   ```js
   if (window.opera) { // Opera repaints incorrectly
       pth.setAttribute('d', d)
       pth.setAttribute('d', d)
   }
   ```
   Delete entire `if (window.opera) { ... }` block.

Verify:
```bash
grep -n "window\.opera\|Opera 10\.5" packages/svgcanvas/core/path-actions.js
```

Expected: zero matches.

- [ ] **Step 7: Drop seExplorerButton.js dead XMLHttpRequest**

Read `src/editor/components/seExplorerButton.js`. Locate line 26:

```js
    this.request = new XMLHttpRequest()
```

Delete this line. Verify no other code references `this.request`:

```bash
grep -n "this\.request" src/editor/components/seExplorerButton.js
```

Expected: zero matches.

- [ ] **Step 8: Run verification gate**

```bash
npm run lint && npx vitest run && node scripts/run-e2e.mjs
```

All must pass. The MathML allowlist removal is the highest-risk change in this commit — if any vitest uses MathML elements, this is where it'll surface.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: drop dead-code blocks (window.widget, IE6 jPicker, Opera path-actions, MathML allowlist, Optimistik oi:, dead XMLHttpRequest)"
```

---

## Task 5 (C4): Brand / attribution updates

**Files:**
- Modify: `packages/svgcanvas/core/clear.js:51`
- Modify: `src/editor/MainMenu.js:6, 229`

- [ ] **Step 1: Update clear.js exported-SVG comment URL**

Read `packages/svgcanvas/core/clear.js`. Locate line 51:

```js
  const comment = svgCanvas.getDOMDocument().createComment(' Created with SVG-edit - https://github.com/SVG-Edit/svgedit')
```

Replace with:

```js
  const comment = svgCanvas.getDOMDocument().createComment(' Created with svgedit - https://github.com/bilbospocketses/svgedit')
```

- [ ] **Step 2: Update MainMenu.js homePage constant**

Read `src/editor/MainMenu.js`. Locate line 6:

```js
const homePage = 'https://github.com/SVG-Edit/svgedit'
```

Replace with:

```js
const homePage = 'https://github.com/bilbospocketses/svgedit'
```

- [ ] **Step 3: Update MainMenu.js brand label**

Locate line 229:

```js
    <se-menu id="main_button" label="SVG-Edit" src="logo.svg" alt="logo">
```

Replace with:

```js
    <se-menu id="main_button" label="svgedit" src="logo.svg" alt="logo">
```

- [ ] **Step 4: Verify no more upstream brand references remain**

```bash
grep -rn "SVG-Edit/svgedit\|label=\"SVG-Edit\"" packages src
```

Expected: zero matches. (If matches surface, they are additional sites the audit missed — fix them as part of this commit.)

- [ ] **Step 5: Run verification gate**

```bash
npm run lint && npx vitest run && node scripts/run-e2e.mjs
```

If a vitest snapshot or e2e expects "SVG-Edit" brand string, update the snapshot or assertion as part of this commit.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: update brand / attribution to fork (clear.js exported-SVG comment, MainMenu.js homePage + label)"
```

---

## Task 6 (C5): Textual cleanup (3 small fixes)

**Files:**
- Modify: `src/editor/components/seExplorerButton.js:134` (HTML syntax)
- Modify: `src/editor/components/seZoom.js:78` (CSS semicolon)
- Modify: `src/editor/extensions/ext-connector/ext-connector.js:240` (comment typo)

These are textual fixes only (no behavior change in tolerant parsers; the typo is in a comment).

- [ ] **Step 1: Fix seExplorerButton.js HTML syntax error**

Read `src/editor/components/seExplorerButton.js`. Locate line 134:

```html
      <div class="image-lib"">
```

Delete the extra `"` — should become:

```html
      <div class="image-lib">
```

- [ ] **Step 2: Fix seZoom.js missing CSS semicolon**

Read `src/editor/components/seZoom.js`. Locate lines 77-79 in the CSS template-literal:

```css
  #options-container {
    position:fixed
    display:flex;
```

Add `;` at end of `position:fixed` line:

```css
  #options-container {
    position:fixed;
    display:flex;
```

- [ ] **Step 3: Fix ext-connector.js comment typo**

Read `src/editor/extensions/ext-connector/ext-connector.js`. Locate line 240:

```js
      // Query all connector elements (id startss with conn_)
```

Replace `startss` with `starts`:

```js
      // Query all connector elements (id starts with conn_)
```

- [ ] **Step 4: Run verification gate**

```bash
npm run lint && npx vitest run && node scripts/run-e2e.mjs
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: textual cleanup (seExplorerButton HTML syntax, seZoom CSS semicolon, ext-connector comment typo)"
```

---

## Task 7 (C6): Verify-then-delete duplicate convertPath + getParents

**Files:**
- Modify: `packages/svgcanvas/core/path.js` (delete lines 633-786, the duplicate `convertPath` function)
- Modify: `src/editor/Editor.js` (delete lines 439-456, the dead `getParents` class method)

- [ ] **Step 1: Verify path.js convertPath is dead**

```bash
grep -rn "from.*['\"]\\.\\.*/path['\"]" packages src
grep -rn "import.*path['\"]" packages src
```

Expected: zero results showing `import { convertPath } from '...path'` (or similar). All `convertPath` imports should be from `path-actions.js`, not `path.js`.

Also verify within `path.js` itself that the duplicate isn't called by any other function in the same file:

```bash
grep -n "convertPath" packages/svgcanvas/core/path.js
```

Expected: only the function definition at line 633 (and the `export const convertPath` declaration), no other callsites within the file.

If a live consumer is found: ABORT this task. Document the live import in a follow-up audit ticket and skip C6. The remaining commits (C0-C5) still merge cleanly.

- [ ] **Step 2: Delete path.js:633-786 convertPath function**

Read `packages/svgcanvas/core/path.js`. Locate the function starting at line 633:

```js
/**
 * Convert a path to one with only absolute or relative values.
 * ...
 * @function module:path.convertPath
 * @param {SVGPathElement} pth - the path to convert
 * @param {boolean} toRel - true of convert to relative
 * @returns {string}
 */
export const convertPath = (pth, toRel) => {
  // ... ~154 lines of implementation ...
}
```

Delete the entire function including its JSDoc header (lines 628-786 approximately — confirm boundaries by reading the file).

If `convertPath` was re-exported from `path.js`'s barrel export at the bottom of the file, drop that export entry too:

```bash
grep -n "^export" packages/svgcanvas/core/path.js | grep convertPath
```

If any match: remove that export statement.

- [ ] **Step 3: Verify Editor.js getParents is dead**

```bash
grep -rn "editor\.getParents\|\.editor\.getParents\|this\.getParents" src packages
```

Expected: only `src/editor/Editor.js:439:  getParents (el, parentSelector` (the declaration itself) and no other callsites.

If a live consumer is found: ABORT this task. Skip C6's getParents deletion; C6's path.js deletion can still go through if Step 1's grep was clean.

- [ ] **Step 4: Delete Editor.js:439-456 getParents class method**

Read `src/editor/Editor.js`. Locate lines 438-457 (one extra context line above and below):

```js
  // parents() https://stackoverflow.com/a/12981248
  getParents (el, parentSelector /* optional */) {
    // If no parentSelector defined will bubble up all the way to *document*
    if (parentSelector === undefined) {
      parentSelector = document
    }

    const parents = []
    let p = el.parentNode

    while (p !== parentSelector) {
      const o = p
      parents.push(o)
      p = o.parentNode
    }
    parents.push(parentSelector) // Push that parentSelector you wanted to stop at

    return parents
  }
```

Delete the entire method including the leading comment. Total: ~19 lines.

- [ ] **Step 5: Run verification gate**

```bash
npm run lint && npx vitest run && node scripts/run-e2e.mjs
```

All must pass. If any path-related e2e fails, the audit's "duplicate" claim was wrong for some edge case — `git revert` C6 and document for follow-up audit.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: verify-then-delete duplicate convertPath (path.js:633-786) + getParents (Editor.js:439-456)"
```

---

## Task 8 (final wrap): CHANGELOG + manual smoke + push + open PR

This wraps the cleanup with documentation and the PR-merge gate. Produces 1 additional commit (the CHANGELOG) so the branch totals 7 commits when merged (Tasks 2-7 = 6 cleanup commits + this 1 CHANGELOG commit). Task 1's safety tag is on master, not on the branch.

- [ ] **Step 1: Update CHANGELOG.md**

Read `CHANGELOG.md`. Under `## [Unreleased]`, add a new section:

```markdown
### Changed (pre-migration cleanup 2026-XX-XX)
- `chore: pre-migration cleanup` — Mechanical execution of `docs/AUDIT_2026-05-16.md` § "Pre-migration deletions" + § "Brand / attribution updates" + two verify-then-delete duplicates. 7 commits across one PR (`feat/pre-migration-cleanup`). Drops: `browser-not-supported.{js,html}`, `ext-helloworld/` extension, `window.widget` KaiOS branches (ConfigObj + ext-storage), IE6 detection + filters in jPicker, commented-out jQuery effects in jPicker, Opera-bug commented block + `if (window.opera)` branch in path-actions, MathML allowlist (31 entries) + Optimistik `oi:` namespace in sanitize, dead `XMLHttpRequest` in seExplorerButton, commented namespaces in namespaces.js. Brand updates: SVG-creator comment URL in clear.js, `homePage` constant + main menu label in MainMenu.js, all → `bilbospocketses/svgedit`. Three textual fixes folded in: `seExplorerButton.js:134` HTML syntax error, `seZoom.js:78` missing CSS semicolon, `ext-connector.js:240` comment typo. Verify-then-deleted: `path.js:633-786 convertPath` (duplicate of `path-actions.js:41-209`), `Editor.js:439-456 getParents` (dead — no external callers).
```

Replace `2026-XX-XX` with today's date.

- [ ] **Step 2: Build + manual smoke**

```bash
npm run build
npm run start:e2e &
```

Wait for vite preview to come up at `http://localhost:8000/`. Open in Chrome and verify:

1. Editor loads (no console errors)
2. Main menu shows brand label "svgedit" (not "SVG-Edit")
3. Draw a rect — works
4. Draw a circle — works
5. Draw a path — works
6. Save SVG (Tools → Export → SVG, or File → Save) — saved SVG includes `<!-- Created with svgedit - https://github.com/bilbospocketses/svgedit -->` comment
7. Open the saved SVG in a new tab/editor session — round-trips cleanly
8. Modify it, save again — works
9. Check console for any "extension failed to load: ext-helloworld" errors — should be none

Stop the preview server:

```bash
# Find the vite preview process and kill it; or Ctrl+C in the foregrounded terminal
```

- [ ] **Step 3: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): document pre-migration cleanup"
```

- [ ] **Step 4: Final review of branch state**

```bash
git log --oneline master..HEAD
git diff --stat master..HEAD
```

Expected `git log`:
```
<sha7>  docs(changelog): document pre-migration cleanup
<sha6>  refactor: verify-then-delete duplicate convertPath (path.js:633-786) + getParents (Editor.js:439-456)
<sha5>  fix: textual cleanup (seExplorerButton HTML syntax, seZoom CSS semicolon, ext-connector comment typo)
<sha4>  chore: update brand / attribution to fork (clear.js exported-SVG comment, MainMenu.js homePage + label)
<sha3>  chore: drop dead-code blocks (window.widget, IE6 jPicker, Opera path-actions, MathML allowlist, Optimistik oi:, dead XMLHttpRequest)
<sha2>  chore: delete ext-helloworld extension (tutorial/demo, no product value)
<sha1>  chore: delete browser-not-supported.{js,html} + tied references (dead universal-SVG-support check)
```

(That's 7 commits — C1-C6 from the spec plus the CHANGELOG commit. C0 was the safety tag, which doesn't show in the branch's commit log.)

Expected `git diff --stat`: ~150-200 line deletions across ~12-15 files. 4 file deletions (`browser-not-supported.{js,html}` + `ext-helloworld/{ext-helloworld.js,locale/en.js}`).

- [ ] **Step 5: Push final state**

```bash
git push origin feat/pre-migration-cleanup
```

- [ ] **Step 6: Open PR**

Open a PR titled `chore: pre-migration cleanup (Step 1 of 5 migration sequence)` with body:

```markdown
## Summary

Mechanical execution of `docs/AUDIT_2026-05-16.md` § "Pre-migration deletions" + § "Brand / attribution updates" + two verify-then-delete duplicates. Sets a clean baseline so Step 3 (TS migration) doesn't have to type around dead code.

See `docs/superpowers/specs/2026-05-16-svgedit-pre-migration-cleanup-design.md` for the design spec.

## Commits (7)

- Delete browser-not-supported.{js,html} + tied references
- Delete ext-helloworld extension
- Drop dead-code blocks (window.widget, IE6 jPicker, Opera path-actions, MathML allowlist, Optimistik oi:, dead XMLHttpRequest)
- Update brand / attribution to fork
- Textual cleanup (3 fixes)
- Verify-then-delete duplicate convertPath + getParents
- CHANGELOG

## Test plan

- [x] `npm run lint` clean
- [x] `npx vitest run` 565/565 pass
- [x] `node scripts/run-e2e.mjs` 81/81 pass
- [x] `npm run build` succeeds
- [x] Manual smoke: load editor, draw rect/circle/path, save SVG, reload, modify, save again; brand string shows "svgedit"; no console errors
- [x] Step 1.5 (browser-compat investigation) NOT included; deferred to dedicated mini-PR

## Rollback

If a regression surfaces post-merge: `git revert -m 1 <merge-sha>`. Safety tag `pre-cleanup` at master HEAD pre-merge.
```

For a personal fork with no PR pipeline (per project_svgedit.md "no PRs upstream"), the user may choose to merge directly to master via `git merge --no-ff feat/pre-migration-cleanup` instead of using GitHub's PR UI. Either way works.

---

## After this PR lands

1. Tag `post-cleanup` on master: `git tag post-cleanup && git push origin post-cleanup`.
2. Update `todo_svgedit.md` — move Step 1 items to Shipped section; note that Step 1.5 (browser-compat investigation) is the next unit.
3. Brainstorm Step 1.5 (`feat/browser-compat-investigation`) when ready.
4. Then Step 2 (`feat/pathseg-drop`).
5. Then Step 3 (`feat/ts-migration`) per the already-written spec + plan.
