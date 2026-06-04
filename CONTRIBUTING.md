# Contributing to svgedit (personal fork)

Thanks for your interest. **Important context:** this repo is a personal hard fork of
[SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit), shaped toward standalone distribution
(Velopack + Docker) and iframe-embeddable use inside
[Control Menu](https://github.com/bilbospocketses/control-menu). Upstream changes are not merged.
The fork is personal-taste-driven, not maintainer-acceptance-driven.

**Issues are welcome** for bug reports, feature suggestions, and discussion — particularly
fork-specific topics (Velopack installer, iframe embed surface, Control Menu integration). General
svgedit issues that apply equally to upstream are better filed at
[SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit).

**Pull requests are reviewed case-by-case** with no guarantee of merge. The fork's scope is locked
(see `README.md`); changes outside that scope generally won't land. Coordinate via an issue first
if the work is substantial.

## Prerequisites

- **Node ≥ 20**
- A modern Chromium-based browser for testing manually. Playwright tests run Chromium + Firefox automatically.

## Setup

```bash
git clone https://github.com/bilbospocketses/svgedit.git
cd svgedit
npm install
npm start          # vite dev → http://localhost:8000/src/editor/index.html
```

## Development Workflow

```bash
npm start          # vite dev server
npm run build      # build to dist/editor
npm run start:iife # build + preview the IIFE bundle
npm test           # lint + vitest unit suite + Playwright e2e
npm run lint       # lint only
```

## Project Structure

```text
packages/svgcanvas/         svgcanvas workspace package (core SVG manipulation)
src/editor/                 editor UI shell (chrome, panels, dialogs)
src/editor/extensions/      built-in editor extensions
scripts/                    build + copy-static helpers, run-e2e.ts
tests/                      Vitest unit suite + Playwright e2e
docs/                       AUDIT, design specs, plans, manual checklists
```

## Code Style

For doc, JSDoc, code-comment, commit-message, and PR-description conventions, see [`STYLE.md`](./STYLE.md).

Master is on TypeScript + ESLint + `typescript-eslint`. The `feat/ts-migration` branch is retained
as historical reference for the JS → TS conversion work that landed on master via TODO #3 and
TODO #19.

General conventions:

- Vanilla DOM + web components — no React, no jQuery.
- ES modules throughout; no CommonJS.
- 2-space indentation, single quotes.
- Colors/theming: use the semantic design tokens — see [`THEMING.md`](./THEMING.md). The hex-guard
  blocks raw color outside `tokens.css`.

## Tests

Tests use **Vitest** (unit) and **Playwright** (e2e). Unit tests live alongside the code they
cover; e2e tests live under `tests/`. The full suite runs via `npm test`.

Any PR that changes core canvas behavior, export pipelines, or extension loading SHOULD include or
update a test.

## Specs and Plans

Larger features go through a spec → plan → implementation cycle:

- **Specs:** `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- **Plans:** `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`

Specs and plans in `docs/` are frozen snapshots — don't retroactively edit them.

## Commit Messages

See [`STYLE.md` § 6](./STYLE.md#6-commit-messages) for conventions.

## Pull Requests

- `master` is PR-gated as of 2026-05-18. Direct push is blocked; all changes land via PR → CI green
  → squash/rebase merge.
- Signed commits are required (SSH or GPG).
- All CI checks must pass before merge (`build-and-unit`, `e2e-chromium`, `e2e-firefox`, CodeQL, Scorecard).
- Update `CHANGELOG.md` under `[Unreleased]` for any user-visible change.

## Branch Strategy

- `master` — releases and stable work
- `feat/ts-migration` — the now-merged JS → TS migration, kept for historical reference
- Short-lived feature branches off `master` for everything else

## Reporting Bugs

Open an issue with:

- Expected vs actual behavior
- OS + browser version
- A minimal reproduction SVG (paste inline or as a Gist)
- Relevant console errors

## Reporting Security Issues

See `SECURITY.md`. Do not file a public issue for security reports.

## License

By contributing you agree your contributions are licensed under the project's `GPL-3.0-only`
license. Inherited upstream code retains the licenses listed in `LICENSE-MIT.txt`.
