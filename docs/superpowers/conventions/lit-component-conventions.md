# svgedit Lit-Component Conventions

> **Source:** This doc captures the 12-bullet conventions checklist locked in PR-1 of the elix → Lit migration. See `docs/superpowers/specs/2026-05-21-svgedit-elix-to-lit-design.md` for the design context and `src/editor/components/seText.ts` + `src/editor/components/seInput.ts` for the locked reference component shapes.

> **For agent prompts (PR-2 onward):** Paste this entire doc verbatim into per-component dispatch prompts. Do NOT reference it by path — the agent will not read it from disk reliably. The conventions are the contract; deviation = bug.

## The 14-bullet checklist (locked PR-1 2026-05-21; bullets 13-14 added from PR-2 pilot calibration 2026-05-22)

1. Use `@customElement('se-name')` + `@property() accessor name = default` decorators (the `accessor` keyword is REQUIRED — TC39 standard decorators + Lit 3 only match the `ClassAccessorDecorator` overload, bare class fields produce TS1240/TS1270); never `static properties` map.
2. Open shadow DOM (Lit default); never override `createRenderRoot()`.
3. `static styles = css\`\`` block; no external CSS files imported into components.
4. Use existing `--*-color` CSS custom-property names (`--main-bg-color`, `--icon-bg-color`, `--icon-bg-color-hover`, `--input-color`, `--orange-color`, `--global-se-spin-input-width`); do not rename theme variables.
5. i18n via `t()` at render time, never in setter; import from `../locale.js`.
6. `::part` for styling hooks ONLY; semantic names (`label`, `input`, `icon`, `button`).
7. `<slot>` for content composition (named slots when 2+; default slot when 1).
8. Events: `bubbles: true, composed: true` for events that need to escape shadow DOM (so panels listening at editor root receive them). Event handlers passed in templates MUST be declared as class-field arrows (`private _handler = (e: Event) => {...}`), NOT method form — `@typescript-eslint/unbound-method` flags the `@event=${this._handler}` method-reference pattern as a false positive even though Lit auto-binds `this` for it.
9. Drop `jamilih` import; use Lit's `html\`\`` template literal.
10. Name: keep `se-*` prefix verbatim (zero consumer churn outside the component file).
11. File per component in `src/editor/components/` (or `src/editor/dialogs/` for the 5 dialog components); no barrel files; export class + run `@customElement` decorator side-effect.
12. Test: trust existing e2e; add a focused unit-test contract only for components with non-trivial form-control or stateful semantics (seInput in PR-1 is the pattern reference).
13. **`ifDefined` for optional attributes with empty-string defaults** (added 2026-05-22 from PR-2 pilot). When an `@property() accessor` has an empty-string default (`= ''`) AND the corresponding HTML attribute is OPTIONAL on consumers (i.e., consumers may omit it from markup), wrap the binding with `ifDefined(this.X || undefined)` in `render()` to avoid rendering `attr=""` on the DOM. Reference: `seInput.ts`'s `size=${ifDefined(this.size || undefined)}` for the `size` attribute on `<input>`. Without `ifDefined`, Lit emits `attr=""` as a literal DOM attribute, which browsers may interpret as 0 (for numeric attrs like `height`) or trigger CSS attribute-selector mismatches.
14. **Kebab-case HTML attributes map via `@property({ attribute: 'kebab-case' })`** (added 2026-05-22 from PR-2 pilot). For HTML attributes with kebab-case names (e.g., `img-height`), declare as `@property({ attribute: 'img-height' }) accessor imgHeight = ''`. The `attribute:` option maps the kebab-case attribute on the DOM to the camelCase property in TypeScript. Required whenever the HTML attribute name doesn't match the JS property name verbatim.

## Reference component shapes

The two PR-1 reference components live in code at:

- **Simple** — `src/editor/components/seText.ts` — pure attributes + `render()`. Pattern for the 14 attribute-only components dispatched in PR-2.
- **Complex** — `src/editor/components/seInput.ts` — form-control behavior, `::part('input')` exposure, mutual-exclusion conditional rendering for label/icon. Pattern for the form-control conversions (seSpinInput / seSelect / seDropdown in PR-3).

When dispatching a per-component agent in PR-2 or PR-3, paste BOTH reference component files inline in the prompt alongside the current source of the component being converted.

## What this doc does NOT cover

- Specific external-API contracts of individual components — those live in each component's own file + audit notes from `docs/AUDIT_2026-05-16.md`.
- PR-2 agent-team dispatch discipline (verbatim source, pre-dispatch self-check, worktree isolation, post-dispatch gate re-verification) — see spec § "PR-2 agent-team dispatch discipline".
- jGraduate / jPicker decomposition (PR-4) — see spec § "jGraduate + jPicker decomposition map" + a dedicated PR-4 brainstorm at execution time.
