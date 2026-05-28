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
npm start          # vite dev → http://localhost:8000/src/editor/index.html
npm run build      # build to dist/editor
npm test           # lint + vitest + Playwright e2e
npm run lint       # eslint + markdownlint-cli2
npm run lint:md    # markdownlint only
```
