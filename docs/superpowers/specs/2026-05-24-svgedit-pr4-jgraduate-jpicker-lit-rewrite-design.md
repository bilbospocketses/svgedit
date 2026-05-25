# PR-4: jGraduate + jPicker Lit Rewrite

> **Date:** 2026-05-24
> **Status:** Design approved
> **Scope:** Item #3 PR-4 — rewrite jQuery.jGraduate.ts (1,290 LOC) + jQuery.jPicker.ts (1,855 LOC) + Slider.ts + ColorValuePicker.ts as Lit components. Target: ~1,500-2,000 LOC total.
> **Decision context:** Full fidelity preserved. No new deps. Lit-component UX consistency with PR-1/2/3.

---

## Decisions locked

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Color map rendering | Canvas 2D | Professional standard (Adobe, Chrome DevTools). Exact HSV math for all 7 modes. Eliminates 62KB sprite sheet. |
| Color data model | Standalone `ColorModel` class | Decoupled from rendering. Testable. Shared between color picker + gradient editor. EventTarget-based. |
| Component count | 5 components + 1 model class | Natural functional boundaries. Each component single-purpose, 200-600 LOC. |
| Sub-PR split | 2 sub-PRs (4a: color picker layer, 4b: gradient layer) | Natural dependency boundary — jGraduate calls jPicker, so color picker ships first. |
| Input events | Pointer Events | Uniform mouse/touch/pen. `setPointerCapture` scopes drag to element. No window listener leaks. |
| Tag name strategy | `se-color-picker`, `se-color-slider`, `se-gradient-editor`, `se-gradient-stop`, `se-paint-picker` | `se-` prefix per convention. No consumer-facing tag change (`<se-colorpicker>` stays via `se-paint-picker` rename-in-place). |

---

## Architecture

```
se-paint-picker (host — replaces seColorPicker.ts)
├── PaintBox (kept as-is — manages 14x14 swatch SVG)
└── se-gradient-editor (replaces jGraduateMethod)
    ├── tabs: solid / linear / radial
    ├── [solid mode] se-color-picker
    ├── [gradient mode]
    │   ├── SVG preview (native <linearGradient>/<radialGradient> on <rect>)
    │   ├── coordinate drag markers (begin/end or center/focus)
    │   ├── stop track
    │   │   └── se-gradient-stop × N (draggable, dblclick → edit)
    │   ├── se-color-slider × 4 (radius, ellipticity, angle, opacity)
    │   ├── spread method <select>
    │   └── [editing stop] se-color-picker (inline)
    └── Ok / Cancel buttons

se-color-picker (replaces jPickerMethod + ColorValuePicker.ts)
├── ColorModel instance (active) + ColorModel instance (original)
├── 2D color map: <canvas> + se-color-slider mode="2d"
├── 1D color bar: <canvas> + se-color-slider mode="1d"
├── preview swatches (active vs current)
├── radio buttons (H/S/V/R/G/B/A mode switch)
├── text inputs (all channels + hex + ahex)
├── quick-color grid (42 colors)
└── Ok / Cancel buttons

se-color-slider (replaces Slider.ts)
├── container <div> (pointerdown target)
├── arrow indicator (positioned)
└── pointer capture drag logic
```

**Data flow:**
1. `se-paint-picker` owns a `Paint` object, passes to `se-gradient-editor`
2. `se-gradient-editor` manages gradient state (stops, coordinates, type)
3. Stop double-click → `se-gradient-editor` renders `se-color-picker` inline for that stop
4. `se-color-picker` owns a `ColorModel`, renders canvas + sliders
5. `se-color-slider` is a pure positional input — emits {x, y}, knows nothing about color
6. Canvas background is rendered by `se-color-picker` (parent owns the canvas, slider overlays it)
7. Ok/Cancel bubble up: `se-color-picker` → `se-gradient-editor` → `se-paint-picker` → `BottomPanel`

---

## Component specifications

### ColorModel (`src/editor/components/jgraduate/ColorModel.ts`)

Pure data class. No Lit dependency.

```typescript
export class ColorModel extends EventTarget {
  // Channels
  private _r: number  // 0-255
  private _g: number  // 0-255
  private _b: number  // 0-255
  private _h: number  // 0-360
  private _s: number  // 0-100
  private _v: number  // 0-100
  private _a: number  // 0-255

  // Batch setters (single change event)
  setRgb(r: number, g: number, b: number): void
  setHsv(h: number, s: number, v: number): void
  setHex(hex: string): void
  setAhex(ahex: string): void
  set(channel: ColorChannel, value: number): void

  // Getters
  get r/g/b/h/s/v/a(): number
  get hex(): string      // 6-char lowercase
  get ahex(): string     // 8-char lowercase
  get cssColor(): string // rgba() for canvas

  // Events: dispatches 'change' with { channel, source } detail
  // source: caller-provided token to prevent feedback loops
}

// Exported pure functions (unit-testable)
export function hsvToRgb(h: number, s: number, v: number): [number, number, number]
export function rgbToHsv(r: number, g: number, b: number): [number, number, number]
export function hexToRgba(hex: string): { r, g, b, a }
export function rgbaToHex(r: number, g: number, b: number, a: number): string
export function validateHex(hex: string): boolean
```

**Tests:** ~20 unit tests — conversion round-trips, edge cases (black/white/pure hue/transparent), batch-set single-event contract, source-token feedback prevention.

---

### se-color-slider (`src/editor/components/jgraduate/se-color-slider.ts`)

Generic drag surface. Reused by both `se-color-picker` (map + bar) and `se-gradient-editor` (4 parameter sliders).

**Attributes:**
- `mode`: `'2d' | '1d'` (default `'2d'`)
- `width` / `height`: number (default 256/256)
- `range-min-x` / `range-max-x` / `range-min-y` / `range-max-y`: number

**Properties (reflected):**
- `x` / `y`: current value in range units

**Events:**
- `sl-change`: `{ detail: { x: number, y: number } }`, `bubbles: true, composed: true`

**Interaction:**
- `pointerdown` on container → `setPointerCapture(e.pointerId)` → compute value from pointer offset → update x/y → emit
- `pointermove` (captured) → update + emit (throttled to rAF)
- `pointerup` → `releasePointerCapture`

**Rendering:**
- Host `<div>` with `position: relative`, sized to `width × height`
- Arrow indicator: `<div class="arrow">` absolutely positioned based on current x/y mapped to pixel coordinates
- Container is transparent — parent layers the canvas behind it via CSS stacking

**LOC estimate:** ~120

---

### se-color-picker (`src/editor/components/jgraduate/se-color-picker.ts`)

Full Photoshop-style color picker.

**Attributes:**
- `color`: string (8-char ahex, initial value)
- `alpha-support`: boolean (default true)
- `mode`: `'h'|'s'|'v'|'r'|'g'|'b'|'a'` (default `'h'`)

**Internal state:**
- `_active: ColorModel` — color being edited
- `_original: ColorModel` — snapshot for preview comparison + cancel restore
- `@state() _mode` — current color mode (drives canvas rendering + slider ranges)
- `@state() _editingHex: boolean` — when hex input is focused, suppress model→input sync

**Canvas rendering (`_renderMap()` + `_renderBar()`):**
- Called via `updated()` when `_mode` changes or model fires `'change'`
- Debounced to 1 animation frame (avoid re-rendering per pointermove pixel)
- Map: 256×256 `ImageData`, iterate rows+cols, compute color per-pixel based on mode:
  - H-mode: x=S(0-100), y=V(100-0), fixed H from bar
  - S-mode: x=H(0-360), y=V(100-0), fixed S from bar
  - V-mode: x=H(0-360), y=S(100-0), fixed V from bar
  - R-mode: x=B(0-255), y=G(255-0), fixed R from bar
  - G-mode: x=B(0-255), y=R(255-0), fixed G from bar
  - B-mode: x=R(0-255), y=G(255-0), fixed B from bar
  - A-mode: same as H-mode map, bar shows alpha gradient
- Bar: 20×256 `ImageData`, iterate rows, compute color per-row based on mode

**Mode switching:** Radio button change → update `_mode` → re-render canvases → reposition slider arrows to current color's coordinates in new space.

**Text inputs:** Each channel has `<input type="text" maxlength="3">`. Bidirectional:
- Model → input: on model `'change'` event (skipped if source === this input)
- Input → model: on `blur` or `Enter` key, validate + clamp + call `model.set(channel, value)`
- Arrow keys: ↑ increment, ↓ decrement (current ColorValuePicker behavior preserved)

**Quick-color grid:** 42-color hardcoded palette (same hex values as current `sePalette`). Click cell → `_active.setHex(cell)`.

**Events:**
- `'commit'`: Ok pressed — `{ detail: { color: _active } }`
- `'cancel'`: Cancel pressed
- `'live'`: color changed during editing (for real-time preview if caller wants)

**LOC estimate:** ~450-500

---

### se-gradient-stop (`src/editor/components/jgraduate/se-gradient-stop.ts`)

Individual gradient stop marker on the stop track.

**Attributes:**
- `offset`: number (0-1)
- `color`: string (hex)
- `opacity`: number (0-1)
- `selected`: boolean

**Rendering:** Inline SVG with the teardrop path shape (same `d` attribute as current). Fill = color at opacity. Stroke = black (2px when selected, 1px otherwise). Positioned via CSS `left: ${offset * 100}%` on the host.

**Interaction:**
- `pointerdown` → select + begin drag (setPointerCapture)
- `pointermove` (captured) → emit `'stop-move'` with new offset (clamped 0-1, computed from pointer X / track width)
- `pointerup` → release capture
- `dblclick` → emit `'stop-edit'`
- Delete/Backspace key (when selected) → emit `'stop-delete'`

**Events (all bubbles + composed):**
- `stop-select`: `{ detail: { id } }`
- `stop-move`: `{ detail: { id, offset } }`
- `stop-edit`: `{ detail: { id } }`
- `stop-delete`: `{ detail: { id } }`

**LOC estimate:** ~100

---

### se-gradient-editor (`src/editor/components/jgraduate/se-gradient-editor.ts`)

Full gradient editor. Tabs, SVG preview, stop management, coordinate controls, parameter sliders.

**Attributes:**
- `images-path`: string (path prefix for arrow GIFs)

**Properties:**
- `.paint`: Paint object (set by parent)

**Internal state:**
- `@state() _type: 'solidColor' | 'linearGradient' | 'radialGradient'`
- `@state() _stops: Array<{ id: string, offset: number, color: string, opacity: number }>`
- `@state() _selectedStopId: string | null`
- `@state() _editingStop: boolean`
- `@state() _coords`: `{ x1, y1, x2, y2, cx, cy, fx, fy }` (all 0-1)
- `@state() _radius: number` (0-100, percentage)
- `@state() _ellipticity: number` (0-100)
- `@state() _angle: number` (0-360)
- `@state() _opacity: number` (0-100)
- `@state() _spreadMethod: 'pad' | 'reflect' | 'repeat'`
- `@state() _showFocus: boolean` (match-center checkbox)

**Render sections (conditional on `_type`):**

1. **Tabs** — 3 `<li>` elements with click handlers. Active tab highlighted.
2. **Solid color mode** — renders `<se-color-picker>` directly.
3. **Gradient mode:**
   - **SVG preview** (256×256): `<svg>` containing a `<defs>` with the live gradient element + a `<rect>` filled with `url(#...)`. Gradient attributes bound reactively from state.
   - **Coordinate markers** — positioned `<div>` elements (begin/end for linear, center/focus for radial) with pointer-event drag. Update `_coords` on move → update gradient attributes.
   - **Stop track** — container `<div>` hosting `<se-gradient-stop>` instances. Click empty area → add stop. Event delegation for stop-move/edit/delete.
   - **Stop color editor** — when `_editingStop`, render `<se-color-picker>` positioned below the track. On commit → update stop color/opacity. On cancel → hide.
   - **Parameter sliders** (radial only): radius, ellipticity, angle — each an `<se-color-slider mode="1d">` with a label + text input.
   - **Opacity slider** (always visible)
   - **Spread method** — `<select>` with pad/reflect/repeat options.
4. **Ok / Cancel buttons**

**Stop management:**
- Add: click empty track area → compute offset from click X, color = inverse of nearest stop (matching `newstop: 'inverse'` default)
- Delete: minimum 2 stops enforced; block delete if only 2 remain
- Reorder: stops array kept sorted by offset after each move

**Building Paint on Ok:**
- Solid: `new Paint({ solidColor: hex })`
- Linear: construct `<linearGradient>` SVG element with attributes + stops
- Radial: construct `<radialGradient>` SVG element with attributes + stops + transform (ellipticity/angle applied as `gradientTransform`)

**Events:**
- `'ok'`: `{ detail: { paint: Paint } }`
- `'cancel'`: no detail

**LOC estimate:** ~550-650

---

### se-paint-picker (`src/editor/components/se-paint-picker.ts`)

Top-level host. Replaces `seColorPicker.ts`. Registered as `<se-colorpicker>` (same tag name — zero consumer churn).

**Attributes (same as current for API compatibility):**
- `label`: string
- `type`: `'fill' | 'stroke'`
- `src`: string (icon path, preserved)

**Internal state:**
- `PaintBox` instance (14×14 swatch SVG — kept as-is)
- `@state() _open: boolean`
- `_paint: Paint`

**Render:**
```html
<div class="trigger" @click=${this._toggle}>
  <!-- PaintBox swatch appended via connectedCallback (existing DOM pattern) -->
</div>
${this._open ? html`
  <se-gradient-editor
    .paint=${this._paint}
    images-path="./components/jgraduate/images/"
    @ok=${this._onOk}
    @cancel=${this._onCancel}
  ></se-gradient-editor>
` : nothing}
```

**`_onOk(e)`:** Update PaintBox, store paint, close picker, dispatch `'change'` event with `{ detail: { paint } }`.

**`_onCancel()`:** Close picker, no state change.

**Public methods (matching current seColorPicker API):**
- `update(svgCanvas, selectedElement, apply)` — refresh paint from current selection
- `setPaint(paint)` — programmatic paint set

**Events:**
- `'change'`: `{ detail: { paint } }` — same contract as current. BottomPanel listens to this.

**LOC estimate:** ~100-120

---

## File plan

### PR-4a creates:
```
src/editor/components/jgraduate/ColorModel.ts        (~200 LOC)
src/editor/components/jgraduate/se-color-slider.ts   (~120 LOC)
src/editor/components/jgraduate/se-color-picker.ts   (~500 LOC)
tests/unit/color-model.test.ts                       (~100 LOC)
tests/unit/se-color-picker.test.ts                   (~80 LOC)
```

### PR-4a deletes:
```
src/editor/components/jgraduate/jQuery.jPicker.ts    (1,837 LOC → replaced by shim + se-color-picker)
src/editor/components/jgraduate/ColorValuePicker.ts  (15KB — absorbed into se-color-picker)
src/editor/components/jgraduate/Slider.ts            (13KB — replaced by se-color-slider)
src/editor/components/jgraduate/images/Maps.png      (61KB — Canvas replaces sprite sheet)
src/editor/components/jgraduate/images/Bars.png      (265B — Canvas replaces)
src/editor/components/jgraduate/images/AlphaBar.png  (1.7KB — Canvas replaces)
src/editor/components/jgraduate/images/bar-opacity.png   (CSS checker pattern replaces)
src/editor/components/jgraduate/images/map-opacity.png   (CSS checker pattern replaces)
src/editor/components/jgraduate/images/preview-opacity.png (CSS checker pattern replaces)
```
Note: `mappoint.gif` (jPicker map arrow) and `rangearrows.gif` (jPicker bar arrow) are also replaced by CSS arrows in the new Lit components. `rangearrows2.gif` and `picker.gif` likewise. Final image deletion list confirmed during implementation.

### PR-4b creates:
```
src/editor/components/jgraduate/se-gradient-stop.ts   (~100 LOC)
src/editor/components/jgraduate/se-gradient-editor.ts (~600 LOC)
src/editor/components/se-paint-picker.ts              (~120 LOC)
```

### PR-4b deletes:
```
src/editor/components/jgraduate/jQuery.jGraduate.ts  (1,290 LOC)
src/editor/components/seColorPicker.ts               (current host)
```

### Kept unchanged:
```
src/editor/components/PaintBox.ts                    (tiny, no jQuery)
src/editor/components/jgraduate/images/mappoint*.png (stop-marker overlays)
src/editor/components/jgraduate/images/rangearrows*.gif (slider arrows)
src/editor/components/jgraduate/images/picker.gif
src/editor/components/jgraduate/images/NoColor.png
src/editor/components/jgraduate/LICENSE-Apache2.0.txt
```

---

## Gates

### PR-4a gate:
- `tsc --build --force` 0 errors
- `npm run lint` 0 errors, ≤23 warnings (jGraduate.ts still present)
- `vitest` all pass (existing + new ColorModel + se-color-picker unit tests)
- e2e 250/250: PR-4a provides a **`jPickerMethod` shim** (thin adapter, ~30 LOC) that bridges `jQuery.jGraduate.ts`'s two internal calls (lines 623 + 1186) to the new `se-color-picker` component. The shim: creates an `se-color-picker` element, appends it to the target container, listens for `commit`/`cancel` events, calls the original callbacks, then removes itself. Exported from the same path (`./jQuery.jPicker.js`) so jGraduate's import doesn't change. Deleted in PR-4b when jGraduate.ts itself is deleted.

### PR-4b gate:
- `tsc --build --force` 0 errors
- `npm run lint` **0 errors + 0 warnings** (jGraduate.ts deleted, all 23 warnings gone)
- `vitest` all pass
- e2e 250/250 chromium + firefox
- Build success (11 extensions bundled)
- Manual smoke: open fill/stroke picker → solid color works → switch to linear gradient → drag stops → double-click stop → color picker opens → pick color → Ok → gradient updates → switch to radial → adjust radius/ellip/angle → Ok

---

## Interaction with todo #10 bugs

The following todo #10 correctness bugs live in the files being deleted:

- **`jQuery.jPicker.ts:1292, 1596`** — jQuery `.prev()` / `.html('')` on DOM elements → **Fixed by deletion.** New code uses proper DOM APIs.
- **`jQuery.jGraduate.ts` comparison bugs** (lines 527/530 — `attr.includes('x') === 'left'`) → **Fixed by deletion.** New code uses explicit coordinate-to-property mapping.
- **`jQuery.jGraduate.ts` isGecko local** → **Fixed by deletion.** `setAttrs` workaround unnecessary on modern Firefox.

These items should be marked as shipped in todo #10 when PR-4b merges.

---

## CSS strategy

Styles move into `static styles = css\`\`` blocks per Lit convention. The existing jGraduate/jPicker CSS (currently in `seColorPicker.ts`'s `<template>` + external stylesheet references) gets distributed to each component's scoped styles. Shadow DOM encapsulation means no class-name collisions with the rest of the editor.

Theme variables (`--main-bg-color`, `--icon-bg-color`, etc.) propagate through shadow DOM naturally via CSS custom property inheritance — no special handling needed.

---

## What this spec does NOT cover

- PaintBox Lit conversion (deferred — tiny file, no jQuery, working fine)
- `jGraduate.Paint` class changes (lives in `@svgedit/svgcanvas`, untouched)
- PR-5 scope (jamilih drop + cleanup — separate future work)
- Extension-level color picker customization (embed API follow-up)
