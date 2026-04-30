# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `CHANGELOG.md` (this file).
- `_reference/embed-api-v6/` — preserved V6-era embed API source as design input for the upcoming V7+ embed API.

### Changed
- Enforced LF line endings repo-wide via `.gitattributes` (commit `838716ea`).
- `.gitignore` rewritten — dropped dead entries (Cypress, react-extensions react-test path, NYC, instrumented, `ignore`), added `.vs/`.
- `package.json` slimmed: dropped `react-test` workspace, JSDoc generator pipeline, npm-publish scripts, remark markdown linter, `nyc`, `rimraf`, `open-cli`, `npm-run-all`.

### Removed
- `archive/` directory (V6 examples, old wiki content, screencasts, untested extensions). V6 embed-api preserved in `_reference/`.
- Upstream-deploy artifacts: `composer.json`, `netlify.toml`, `lgtm.yml`, `licenseInfo.json`, `CHANGES.md` (67KB upstream history), `publish.md`, root `FUNDING.yml`.
- `.github/` directory in full (FUNDING, ISSUE_TEMPLATE, pull_request_template, comment-template, workflows including codeql, npmpublish, on-push, on-PR). Will be re-added with our own CI when needed.
- `scripts/publish.mjs`, `scripts/version-bump.mjs` — no npm publishing for this fork.
- `packages/react-test/` — no React in this project.
- JSDoc generator pipeline (`docs/jsdoc-config.js`, `docs/layout.tmpl`, `jsdoc` devDep, `build-docs` / `open-docs` / `test-build` scripts). Public API will be documented via hand-written `EMBED_API.md`.
- `nyc.config.js` — orphaned after `nyc` devDep removal.

### Fixed
- `fix(scripts): rewrite scripts/run-e2e.mjs without nyc/rimraf` — housekeeping pass removed both deps but left them as live calls in the e2e runner. Replaced with native `node:fs/promises`; dropped vestigial `seedNycFromVitest` and `npx nyc report` steps; dropped `COVERAGE` env / `__coverage__` rebuild check (vitest's v8 coverage is the live coverage path). Also fixed pre-existing Windows incompatibility — `spawn('npx', …, { shell: false })` failed with `ENOENT` because `npx`/`npm` are `.cmd` shims; now `shell: process.platform === 'win32'`. Verified end-to-end: 81/81 e2e tests pass in 25.5s on Windows.

### Added (locale shim)
- `feat(locale): English-only — drop i18next, replace locale.js with native shim` — Per scope directive (§5: strip localization). New `src/editor/locale.js` (70 lines) provides a tiny `t(key, vars)` runtime supporting dotted keys (`'foo.bar'`), namespace lookups (`'ns:foo.bar'`), and `{{var}}` interpolation. Exposes an `i18next`-compatible facade with `.t()` and `.addResourceBundle()` so all 195 existing callsites across `src/editor/` and the 11 default extensions stay unchanged. `putLocale()` simplified to a no-op returning `{ langParam: 'en', i18next: facade }`.
- `tests/locale.test.js` rewritten — 7 tests covering the shim contract (dotted lookup, namespace, interpolation, missing-key key-fallback, defensive non-string handling, post-`addResourceBundle` namespace lookup).

### Changed (locale shim)
- `Editor.js` — `goodLangs` array trimmed from 23 entries to `['en']`. `EditorStartup.js` callsite unchanged (the new `putLocale` ignores its args).

### Removed (locale shim)
- `i18next` runtime dependency (was 25.7.4).
- 57 root locale files (`src/editor/locale/lang.{af,ar,az,be,bg,ca,cs,cy,da,de,el,es,et,fa,fi,fr,fy,ga,gl,...}.js`) — only `lang.en.js` retained.
- 46 extension locale files across 10 extension dirs (`ext-{connector,eyedropper,grid,helloworld,layer_view,markers,opensave,panning,polystar,shapes}`) — only each extension's `en.js` retained.

## Fork point

Forked 2026-04-23 from [SVG-Edit/svgedit v7.4.1](https://github.com/SVG-Edit/svgedit) via `bilbospocketses/svgedit`. No upstream tracking; this is a one-time starter base.
