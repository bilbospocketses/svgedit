# svgedit — Audit #29 Major/Minor Batching Roadmap (2026-06-24)

Execution roadmap for draining the **remaining** open findings of the 2026-06-14 five-lens
code-review audit (audit #29). The authoritative per-finding ledger lives in the project memory
vault (`reference_svgedit_security_review`); this doc is the in-repo record of how the remaining
backlog is sliced into PRs and the order they ship.

## Where this picks up

As of master `7c757e8f`, the audit's CRITICAL tranche, all MAJOR-Security, the MAJOR-Perf
safe-first tier, and the first two Efficiency/Dup slices (color/gradient, engine) are shipped.
**Remaining:** ~75 open MAJOR + 10 deferred-with-rationale MAJOR + ~170 MINOR.

## Structural decisions (2026-06-24)

1. **Severity order — majors first, minors after.** Major-only thematic PRs drain first; a second
   wave of by-area minor-sweep PRs follows. Files get touched twice, but it yields a clean
   "all majors done" milestone.
2. **Per-frame Perf cluster is the final, harness-gated milestone.** The selection/event per-frame
   findings (`#56`–`#76` subset) can't be measured in jsdom; they wait on a real browser
   before/after measurement harness and ship last.

## Execution rhythm (unchanged)

Each PR: branch off fresh `master` (verified-base script) → **TDD RED-first** (expect some findings
to reclassify as over-claim / not-a-bug at the test — recurred on #14/#40/#91/#122/#128) → full
gate (unit + `tsc` pkg/editor/embed/server + lint + e2e on CI) → **squash-merge + delete branch**.
Numbers prefixed `#N` are ledger finding numbers; `#Nʳᶠ` disambiguates the Efficiency/Dup
review-findings whose numbers numerically collide with GitHub PR numbers.

## Wave 1 — Major PRs (18, recommended order)

| # | PR | Findings | Area / files | Notes |
|---|----|----------|--------------|-------|
| 1 | B1 · CI workflow hygiene | #130, #131, #133ʳᶠ | `.github/workflows/*` | concurrency-cancel (PR-only), launcher cargo cache (github-owned `actions/cache` — allowlist blocks `Swatinem`), upload-artifact version drift |
| 2 | B2 · Build-config cleanup | #132ʳᶠ, #134ʳᶠ | `babel.config.json` (delete), `tsconfig.embed/server` | orphan config + dup compiler overrides |
| 3 | S1 · Entry-page HTML | #143, #142ʳᶠ | `index.html` + xdomain trio | tighten `allowedOrigins:['*']` (security) + dedup head/bootstrap |
| 4 | T1 · Unit-test integrity | #147ʳᶠ–#158ʳᶠ | `tests/unit/*` | vacuous asserts, inverted mocks, bootstrap dup. May split T1a/T1b; absorbs the IDE TS-diagnostic noise in color-model/se-color-picker/touch/selected-elem tests |
| 5 | T2 · e2e-test integrity | #159ʳᶠ–#164ʳᶠ | `tests/e2e/*` | buried/zero asserts, fixed `waitForTimeout` sleeps |
| 6 | E1 · Path module | #92, #93 | `path*.ts` | convertPath ~250-line dedup + index-signature typing |
| 7 | E2 · Recalculate | #97, #98 | `recalculate.ts` | clipPath dup (+ `Number`→`convertToNum` correctness), `<use>` block ×4 |
| 8 | E3 · Setter scaffolds | #99, #100 | `elem-get-set.ts` | group-flatten dup + 12 text-setter scaffold |
| 9 | E4 · Align + history dedup | #104, #106 | `selected-elem.ts`, `undo/history.ts` | align index clone + rotation-center dup |
| 10 | E6 · Editor-core cleanup | #109, #110 | `ConfigObj.ts`, `editorInit.ts` | setConfig triplication + dead panning handlers |
| 11 | C1 · Icon/mask + CSS sinks | #114, #115, #117, #118 | components | dedup `.se-icon`/`mask-image` + harden `url()`/`unsafeHTML` sinks |
| 12 | C2 · Component boilerplate | #111, #113, #116 | components/extensions | i18n-load ×8, boolAttr ×3, outside-close ×6 (#116 real bug) |
| 13 | C6 · Gradient/paint color | #126, #127, #129 | se-gradient-*, se-paint-picker | alpha-hex/hex-rgb dedup + paint-picker click-swallow bug |
| 14 | C3 · a11y: seZoom + seList | #119, #120, #121 | seZoom/seList | keyboard/SR operability + dead callback |
| 15 | C4 · a11y: layers panel | #140ʳᶠ, #141ʳᶠ | LayersPanel | keyboard rows + `<img>` alt |
| 16 | C5 · Dialog lifecycle dedup | #112, #135ʳᶠ–#139ʳᶠ | dialogs/cmenu | prompt regex+nav, implicit globals, cmenu dup, export-dialog global mutate, dialog-attr ×5 |
| 17 | E5 · event.ts + `*zoom` bug | #105, #107 | `event.ts` | drag-finalize + mode-switch dedup incl. real `*zoom` bug (RED-first) |
| 18 | E7 · Editor god-object | #108 | `Editor.ts` | ~40 `!` fields / `as unknown`. Large/architectural — may break down further; last |

## Wave 2 — Minor sweeps (by area; ~14–16 PRs)

The ~170 minors are prose-grouped (not individually numbered) in the ledger, so Wave-2 batches are
by-area sweeps and the first step of each is to enumerate that area's minors into a numbered
checklist from the ledger + code. Areas: Rust-launcher · embed/server · engine (split ~4:
path/coords, recalculate, selection/elem-get-set, draw/layer/history) · editor (split ~3:
editor-core, panels/CSS, jgraduate/components) · extensions · build/CI · tests (unit + e2e).

## Final milestone — per-frame Perf cluster

`#57`–`#61`, `#63`/`#64`/`#68`/`#71`–`#73`/`#76` (+ `#56`, near-over-claim) — gated on first
building a real browser before/after measurement harness (jsdom can't measure layout/`getBBox`).
`#68` (null-deref) and `#76` (membership check) are correctness-flavored and may be pulled forward
if the harness slips.

## Cross-references

- Ledger: `reference_svgedit_security_review` (project memory vault) — per-finding status, location,
  fix direction. Canonical source; this roadmap is derived from it.
- Todo: `todo_svgedit` item #29.
- Sibling pattern: `reference_ws_scrcpy_web_security_review` (the 2026-06-13 ws-scrcpy-web review).
