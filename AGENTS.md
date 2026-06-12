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
