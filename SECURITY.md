# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report security issues privately through GitHub's built-in security advisory flow:

**[Report a vulnerability](https://github.com/bilbospocketses/svgedit/security/advisories/new)**

This opens a private channel between you and the maintainer — no public disclosure until a fix is ready.

## What to Include

When reporting, please provide:

- A clear description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept SVG, configuration, browser version)
- The affected version / commit
- Any mitigations you're aware of

## Response Expectations

- **Acknowledgement:** within **72 hours** of receipt
- **Triage and initial assessment:** within one week
- **Fix and disclosure timeline:** discussed with the reporter on a per-issue basis, depending on severity and complexity

## Supported Versions

Security fixes target the latest commit on `master`. Older commits and pre-release tags are not maintained.

## Scope

In scope: the svgedit SVG editor web app, its build pipeline (Vite, `scripts/`), the extension loader, the embed/iframe entry points, and the export modules (SVG, PNG, PDF).

Out of scope:
- Vulnerabilities in upstream dependencies (jspdf, dompurify, elix, vite, etc.) that have not been amplified by svgedit's usage — report those upstream to the respective project.
- Browser engine bugs (XSS, sandbox escapes, etc.) that surface in any web app, not specifically svgedit.
- Self-XSS or issues requiring the victim to paste attacker-controlled SVG into devtools or the source editor.
- Issues affecting only the upstream [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit) project that haven't been carried into this fork — report those upstream.

Thanks for helping keep the project safe.
