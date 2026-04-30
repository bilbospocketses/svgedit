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

## Fork point

Forked 2026-04-23 from [SVG-Edit/svgedit v7.4.1](https://github.com/SVG-Edit/svgedit) via `bilbospocketses/svgedit`. No upstream tracking; this is a one-time starter base.
