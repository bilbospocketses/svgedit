# AGENTS.md — svgedit

Notes for AI coding agents (Claude Code, aider, codex, etc.) working in this repo.

## Style

All doc, JSDoc, code-comment, commit-message, and PR-description conventions live in
[`STYLE.md`](./STYLE.md). Read it before substantial contribution. Flag exceptions on the
PR; don't silently deviate.

## File and git operations

This repo lives on a multi-session host where multiple agents may operate on the same
working tree. Treat the filesystem and git index as shared state:

- Use absolute paths for every file operation (read, write, edit, glob, grep).
- Use `git -C "<repo-root>"` for every git operation. Plain `git <subcommand>` relies on
  cwd and can target a different session's working tree.
- Don't `cd` into the repo directory. Pass the absolute path each call.

## No AI attribution

Per `STYLE.md` § 6, commit messages must not include `Co-Authored-By: Claude…`,
`Generated with Claude Code`, or any AI-attribution trailer. Fork lineage is human-only.

## Verify against current code

Memories, training-data snapshots, and prior-session summaries can drift from the
working tree. Before asserting that a file, function, or flag exists, verify against
the current code with `Read`, `Grep`, or `git -C "<repo-root>" log`.

## In-flight design work

- Design specs (frozen snapshots): `docs/superpowers/specs/`
- Implementation plans (frozen snapshots): `docs/superpowers/plans/`
- Active backlog: see the project TODO file (path documented in repo owner's memory).

## Quick commands

```bash
npm start          # vite dev → http://localhost:8100/src/editor/index.html
npm run build      # build to dist/editor + dist/server
npm run serve      # build + run the Node server (production serve) → http://localhost:8100/
npm test           # lint + vitest + Playwright e2e
npm run lint       # eslint + markdownlint-cli2
npm run lint:md    # markdownlint only
npm run typecheck  # tsc --build — packages/svgcanvas ONLY (see below)
npm run typecheck:editor  # svgcanvas decls + editor (src/editor + src/server) typecheck — self-contained
npm run typecheck:server  # server (src/server) typecheck via tsconfig.server.json
```

## Launcher (0b)

The `launcher/` crate is svgedit's Velopack `--mainExe` (Rust). It is built
separately from the JS app (`npm run build:launcher`) and is NOT part of `npm run
build`, so the editor build needs no Rust toolchain. Tests: `cargo test
--manifest-path launcher/Cargo.toml`. Static-linked: Windows `+crt-static`
(`launcher/.cargo/config.toml`), Linux `x86_64-unknown-linux-musl`. Packaging
(`vpk pack`, seed-Node bundling) is a later #7 milestone.

## Typecheck scope (gotcha)

`npm run typecheck` builds and typechecks **only `packages/svgcanvas`**. It does **not**
cover the editor (`src/editor/**`), and neither does `npm test` (vitest transpiles via swc
without type-checking). To typecheck the editor, run:

```bash
npm run typecheck:editor   # = tsc --build packages/svgcanvas && tsc --noEmit -p tsconfig.json
```

This script is self-contained because the editor typecheck needs `packages/svgcanvas`'s
`.d.ts` built first — **and `npm run build` clobbers them** (its `vite build packages/svgcanvas`
step overwrites `dist/`), so a bare `tsc --noEmit -p tsconfig.json` after a build throws ~50
spurious `TS6305` "output not built" errors until you re-run `tsc --build packages/svgcanvas`.
The script chains both so you never hit that. (IDE diagnostics also work for a quick check.)

The canvas package compiles with `--isolatedDeclarations`, so every **exported** declaration
needs an explicit type annotation (e.g. `export const X: Set<string> = …`, function return
types). ESLint also forbids the non-null assertion operator (`!`) — use guards / `??`.

## Importing the canvas engine

Import svgcanvas internals via **subpaths** — `@svgedit/svgcanvas/core/<module>.js` — which
resolve to the TypeScript **source**. The bare `@svgedit/svgcanvas` specifier resolves to the
built `dist/` (gitignored), which is stale at dev time unless rebuilt; prefer subpaths for
runtime values imported into editor/test code.

## E2E testing gotchas

The Playwright e2e suite runs against the BUILT editor via `vite preview`
(`npm run start:e2e` on :9000), not the dev server — build first (`npm run build`);
test-only changes need no rebuild. Self-scope without `cd`:
`node_modules/.bin/playwright.cmd test <spec> --config playwright.config.mjs --project=chromium`
with `PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright`.

- **Re-verify e2e changes under `$env:CI='true'`.** CI forces `workers: 1` +
  `reuseExistingServer: false` (one fresh server, sequential). Some failures are
  races the local parallel run *wins* and only CI loses — e.g. the storage-dialog
  intercept below first passed locally and failed only in CI.
- **The storage-consent modal intercepts clicks.** `ext-storage`'s first-run
  `se-storage-dialog` opens asynchronously over the editor (after it reports ready)
  whenever there is no `svgeditstore` cookie. Any spec that `page.goto('/index.html')`
  directly and then clicks will have the click swallowed. Either use
  `visitAndApproveStorage` (dismisses it), or — for direct-goto specs — seed the
  cookie BEFORE navigating so the prompt never opens:
  `await page.context().addCookies([{ name: 'svgeditstore', value: 'prefsAndContent', url: baseURL }])`.
  Post-load dismissal is racy (the modal is not in the DOM yet at `ready`); suppress
  at source.
- **Browser-only perf findings** (canvas, `getComputedStyle`, layout) cannot be
  unit-tested — jsdom stubs them. Use the count-assertion harness in
  `tests/e2e/perf/`: `installPerfCounters(page)` (before navigating) wraps
  `getComputedStyle` / canvas `getContext`+`toDataURL` / `querySelectorAll` with
  counters keyed by selector + element; `measure(page, action)` resets, runs the
  action, and returns the counts. Assert a redundant call drops to `<= 1` after the
  fix (chromium-only — deterministic counts). To exercise a DISABLED-by-default
  extension (e.g. overview), load it in the spec via `page.evaluate` importing
  `/extensions/ext-X/ext-X.js` and calling
  `svgCanvas.addExtension(m.default.name, m.default.init.bind(svgEditor), { langParam: 'en' })`
  — see `overview-viewbox.perf.spec.ts` for the exact call.
