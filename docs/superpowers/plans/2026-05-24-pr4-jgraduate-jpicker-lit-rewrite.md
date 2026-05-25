# PR-4: jGraduate + jPicker Lit Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the jQuery-based jGraduate gradient editor + jPicker color picker as Lit components, eliminating all jQuery dependencies and image-sprite rendering in favor of Canvas 2D.

**Architecture:** 5 Lit components + 1 standalone ColorModel class, split across 2 sub-PRs. PR-4a delivers the color picker layer (ColorModel + se-color-slider + se-color-picker + jPickerMethod shim). PR-4b delivers the gradient layer (se-gradient-stop + se-gradient-editor + se-paint-picker) and deletes all legacy files.

**Tech Stack:** Lit 3, TypeScript (strict), Canvas 2D API, Pointer Events, vitest (jsdom), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-05-24-svgedit-pr4-jgraduate-jpicker-lit-rewrite-design.md`
**Lit conventions:** `docs/superpowers/conventions/lit-component-conventions.md`

**Repo:** `C:/Users/jscha/source/repos/svgedit` — master at `2852273d`
**Branch:** `feat/pr-4a-color-picker` (PR-4a), then `feat/pr-4b-gradient-editor` (PR-4b)

---

## File Structure (PR-4a)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/editor/components/jgraduate/ColorModel.ts` | Pure color data model: r/g/b/h/s/v/a with cross-field sync + conversion functions |
| Create | `src/editor/components/jgraduate/se-color-slider.ts` | Generic 2D/1D drag surface with Pointer Events |
| Create | `src/editor/components/jgraduate/se-color-picker.ts` | Full color picker: Canvas map/bar + inputs + preview |
| Create | `src/editor/components/jgraduate/jPickerShim.ts` | Thin adapter bridging jGraduateMethod's calls to se-color-picker |
| Create | `tests/unit/color-model.test.js` | Unit tests for ColorModel + conversion functions |
| Create | `tests/unit/se-color-picker.test.js` | Unit tests for se-color-picker component |
| Delete | `src/editor/components/jgraduate/jQuery.jPicker.ts` | Replaced by se-color-picker + shim |
| Delete | `src/editor/components/jgraduate/ColorValuePicker.ts` | Absorbed into se-color-picker |
| Delete | `src/editor/components/jgraduate/Slider.ts` | Replaced by se-color-slider |
| Delete | `src/editor/components/jgraduate/images/Maps.png` | Canvas replaces sprite sheet |
| Delete | `src/editor/components/jgraduate/images/Bars.png` | Canvas replaces |
| Delete | `src/editor/components/jgraduate/images/AlphaBar.png` | Canvas replaces |
| Delete | `src/editor/components/jgraduate/images/bar-opacity.png` | CSS checker replaces |
| Delete | `src/editor/components/jgraduate/images/map-opacity.png` | CSS checker replaces |
| Delete | `src/editor/components/jgraduate/images/preview-opacity.png` | CSS checker replaces |
| Delete | `src/editor/components/jgraduate/images/mappoint.gif` | CSS arrow replaces |
| Delete | `src/editor/components/jgraduate/images/rangearrows.gif` | CSS arrow replaces |
| Delete | `src/editor/components/jgraduate/images/picker.gif` | CSS arrow replaces |
| Modify | `src/editor/components/jgraduate/jQuery.jGraduate.ts` | Update imports: `jPickerMethod` → from `./jPickerShim.js` |

## File Structure (PR-4b)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/editor/components/jgraduate/se-gradient-stop.ts` | Individual draggable gradient stop marker |
| Create | `src/editor/components/jgraduate/se-gradient-editor.ts` | Full gradient editor: tabs + SVG preview + stops + sliders |
| Create | `src/editor/components/se-paint-picker.ts` | Top-level host (registers as `se-colorpicker`) |
| Delete | `src/editor/components/jgraduate/jQuery.jGraduate.ts` | Replaced by se-gradient-editor |
| Delete | `src/editor/components/jgraduate/jPickerShim.ts` | No longer needed |
| Delete | `src/editor/components/seColorPicker.ts` | Replaced by se-paint-picker |
| Delete | `src/editor/components/jgraduate/images/rangearrows2.gif` | CSS arrow replaces |
| Delete | `src/editor/components/jgraduate/images/NoColor.png` | CSS pattern replaces |
| Modify | `src/editor/panels/BottomPanel.ts` | Update import: remove `jGraduate` import (Paint comes from svgcanvas) |

---

## PR-4a Tasks

### Task 1: ColorModel — Conversion Functions

**Files:**
- Create: `src/editor/components/jgraduate/ColorModel.ts`
- Create: `tests/unit/color-model.test.js`

- [ ] **Step 1: Write failing tests for conversion functions**

```javascript
// tests/unit/color-model.test.js
import { describe, expect, it } from 'vitest'
import { hsvToRgb, rgbToHsv, hexToRgba, rgbaToHex, validateHex } from '../../src/editor/components/jgraduate/ColorModel.ts'

describe('color conversion functions', () => {
  describe('hsvToRgb', () => {
    it('converts pure red', () => {
      expect(hsvToRgb(0, 100, 100)).toEqual([255, 0, 0])
    })
    it('converts pure green', () => {
      expect(hsvToRgb(120, 100, 100)).toEqual([0, 255, 0])
    })
    it('converts pure blue', () => {
      expect(hsvToRgb(240, 100, 100)).toEqual([0, 0, 255])
    })
    it('converts black (v=0)', () => {
      expect(hsvToRgb(0, 0, 0)).toEqual([0, 0, 0])
    })
    it('converts white (s=0, v=100)', () => {
      expect(hsvToRgb(0, 0, 100)).toEqual([255, 255, 255])
    })
    it('converts mid-gray', () => {
      expect(hsvToRgb(0, 0, 50)).toEqual([128, 128, 128])
    })
    it('converts h=360 same as h=0', () => {
      expect(hsvToRgb(360, 100, 100)).toEqual([255, 0, 0])
    })
  })

  describe('rgbToHsv', () => {
    it('converts pure red', () => {
      expect(rgbToHsv(255, 0, 0)).toEqual([0, 100, 100])
    })
    it('converts pure green', () => {
      expect(rgbToHsv(0, 255, 0)).toEqual([120, 100, 100])
    })
    it('converts pure blue', () => {
      expect(rgbToHsv(0, 0, 255)).toEqual([240, 100, 100])
    })
    it('converts black', () => {
      expect(rgbToHsv(0, 0, 0)).toEqual([0, 0, 0])
    })
    it('converts white', () => {
      expect(rgbToHsv(255, 255, 255)).toEqual([0, 0, 100])
    })
    it('round-trips with hsvToRgb', () => {
      const [r, g, b] = hsvToRgb(210, 75, 80)
      const [h, s, v] = rgbToHsv(r, g, b)
      expect(h).toBe(210)
      expect(s).toBe(75)
      expect(v).toBe(80)
    })
  })

  describe('hexToRgba', () => {
    it('parses 6-char hex', () => {
      expect(hexToRgba('ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 255 })
    })
    it('parses 8-char hex with alpha', () => {
      expect(hexToRgba('ff000080')).toEqual({ r: 255, g: 0, b: 0, a: 128 })
    })
    it('returns null components for empty/none', () => {
      expect(hexToRgba('')).toEqual({ r: null, g: null, b: null, a: null })
      expect(hexToRgba('none')).toEqual({ r: null, g: null, b: null, a: null })
    })
  })

  describe('rgbaToHex', () => {
    it('converts to 8-char lowercase hex', () => {
      expect(rgbaToHex(255, 0, 0, 255)).toBe('ff0000ff')
    })
    it('pads single-digit values', () => {
      expect(rgbaToHex(0, 0, 0, 0)).toBe('00000000')
    })
  })

  describe('validateHex', () => {
    it('strips non-hex characters', () => {
      expect(validateHex('#FF0000')).toBe('ff0000')
    })
    it('truncates to 8 chars', () => {
      expect(validateHex('ff0000ff99')).toBe('ff0000ff')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/color-model.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement conversion functions**

```typescript
// src/editor/components/jgraduate/ColorModel.ts

export type ColorChannel = 'r' | 'g' | 'b' | 'h' | 's' | 'v' | 'a'

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  if (s === 0) {
    const gray = (v * 255 / 100) | 0
    return [gray, gray, gray]
  }
  if (h === 360) h = 0
  h /= 60
  s /= 100
  v /= 100
  const i = h | 0
  const f = h - i
  const p = v * (1 - s)
  const q = v * (1 - s * f)
  const t = v * (1 - s * (1 - f))
  let r: number, g: number, b: number
  switch (i) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    default: r = v; g = p; b = q; break
  }
  return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0]
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max
  const s = max ? (max - min) / max : 0
  let h = 0
  if (s !== 0) {
    const delta = max - min
    if (r === max) h = (g - b) / delta
    else if (g === max) h = 2 + (b - r) / delta
    else h = 4 + (r - g) / delta
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return [h, Math.round(s * 100), Math.round(v * 100)]
}

export function hexToRgba(hex: string): { r: number | null, g: number | null, b: number | null, a: number | null } {
  if (hex === '' || hex === 'none') return { r: null, g: null, b: null, a: null }
  hex = validateHex(hex)
  if (hex.length === 6) hex += 'ff'
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
    a: parseInt(hex.substring(6, 8), 16)
  }
}

export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  return [r, g, b, a].map(v => (v | 0).toString(16).padStart(2, '0')).join('')
}

export function validateHex(hex: string): string {
  hex = hex.toLowerCase().replace(/[^a-f\d]/g, '')
  if (hex.length > 8) hex = hex.substring(0, 8)
  return hex
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/color-model.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/jgraduate/ColorModel.ts tests/unit/color-model.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): add ColorModel conversion functions with tests"
```

---

### Task 2: ColorModel — Class with EventTarget

**Files:**
- Modify: `src/editor/components/jgraduate/ColorModel.ts`
- Modify: `tests/unit/color-model.test.js`

- [ ] **Step 1: Write failing tests for ColorModel class**

Append to `tests/unit/color-model.test.js`:

```javascript
import { ColorModel } from '../../src/editor/components/jgraduate/ColorModel.ts'

describe('ColorModel class', () => {
  it('initializes from ahex string', () => {
    const m = new ColorModel('ff0000ff')
    expect(m.r).toBe(255)
    expect(m.g).toBe(0)
    expect(m.b).toBe(0)
    expect(m.a).toBe(255)
    expect(m.h).toBe(0)
    expect(m.s).toBe(100)
    expect(m.v).toBe(100)
  })

  it('setRgb updates HSV', () => {
    const m = new ColorModel('000000ff')
    m.setRgb(0, 255, 0)
    expect(m.h).toBe(120)
    expect(m.s).toBe(100)
    expect(m.v).toBe(100)
  })

  it('setHsv updates RGB', () => {
    const m = new ColorModel('000000ff')
    m.setHsv(240, 100, 100)
    expect(m.r).toBe(0)
    expect(m.g).toBe(0)
    expect(m.b).toBe(255)
  })

  it('setHex updates all channels', () => {
    const m = new ColorModel('000000ff')
    m.setHex('00ff00')
    expect(m.r).toBe(0)
    expect(m.g).toBe(255)
    expect(m.b).toBe(0)
    expect(m.hex).toBe('00ff00')
  })

  it('fires change event on set', () => {
    const m = new ColorModel('ff0000ff')
    let fired = false
    m.addEventListener('change', () => { fired = true })
    m.set('r', 128)
    expect(fired).toBe(true)
  })

  it('does not fire change when value unchanged', () => {
    const m = new ColorModel('ff0000ff')
    let count = 0
    m.addEventListener('change', () => { count++ })
    m.set('r', 255)
    expect(count).toBe(0)
  })

  it('change event includes source token', () => {
    const m = new ColorModel('ff0000ff')
    let source = null
    m.addEventListener('change', (e) => { source = e.detail.source })
    m.set('r', 128, 'slider')
    expect(source).toBe('slider')
  })

  it('batch setRgb fires single event', () => {
    const m = new ColorModel('000000ff')
    let count = 0
    m.addEventListener('change', () => { count++ })
    m.setRgb(100, 150, 200)
    expect(count).toBe(1)
  })

  it('hex getter returns 6-char lowercase', () => {
    const m = new ColorModel('ff8800ff')
    expect(m.hex).toBe('ff8800')
  })

  it('ahex getter returns 8-char lowercase', () => {
    const m = new ColorModel('ff880080')
    expect(m.ahex).toBe('ff880080')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/color-model.test.js`
Expected: FAIL — `ColorModel` not exported

- [ ] **Step 3: Implement ColorModel class**

Append to `src/editor/components/jgraduate/ColorModel.ts`:

```typescript
export interface ColorChangeDetail {
  channel: ColorChannel | 'rgb' | 'hsv' | 'hex' | 'ahex'
  source?: string
}

export class ColorModel extends EventTarget {
  private _r = 0
  private _g = 0
  private _b = 0
  private _h = 0
  private _s = 0
  private _v = 0
  private _a = 255

  constructor(ahex?: string) {
    super()
    if (ahex) this._setFromAhex(ahex)
  }

  get r() { return this._r }
  get g() { return this._g }
  get b() { return this._b }
  get h() { return this._h }
  get s() { return this._s }
  get v() { return this._v }
  get a() { return this._a }

  get hex(): string { return rgbaToHex(this._r, this._g, this._b, 0).substring(0, 6) }
  get ahex(): string { return rgbaToHex(this._r, this._g, this._b, this._a) }
  get cssColor(): string { return `rgba(${this._r},${this._g},${this._b},${this._a / 255})` }

  set(channel: ColorChannel, value: number, source?: string): void {
    value = Math.round(value)
    const max = channel === 'h' ? 360 : channel === 's' || channel === 'v' ? 100 : 255
    value = Math.max(0, Math.min(max, value))
    if ((this as any)['_' + channel] === value) return
    ;(this as any)['_' + channel] = value
    if ('rgb'.includes(channel)) {
      const [h, s, v] = rgbToHsv(this._r, this._g, this._b)
      this._h = h; this._s = s; this._v = v
    } else if ('hsv'.includes(channel)) {
      const [r, g, b] = hsvToRgb(this._h, this._s, this._v)
      this._r = r; this._g = g; this._b = b
    }
    this._fire(channel, source)
  }

  setRgb(r: number, g: number, b: number, source?: string): void {
    r = clamp(Math.round(r), 0, 255)
    g = clamp(Math.round(g), 0, 255)
    b = clamp(Math.round(b), 0, 255)
    if (this._r === r && this._g === g && this._b === b) return
    this._r = r; this._g = g; this._b = b
    const [h, s, v] = rgbToHsv(r, g, b)
    this._h = h; this._s = s; this._v = v
    this._fire('rgb', source)
  }

  setHsv(h: number, s: number, v: number, source?: string): void {
    h = clamp(Math.round(h), 0, 360)
    s = clamp(Math.round(s), 0, 100)
    v = clamp(Math.round(v), 0, 100)
    if (this._h === h && this._s === s && this._v === v) return
    this._h = h; this._s = s; this._v = v
    const [r, g, b] = hsvToRgb(h, s, v)
    this._r = r; this._g = g; this._b = b
    this._fire('hsv', source)
  }

  setHex(hex: string, source?: string): void {
    const rgba = hexToRgba(hex)
    if (rgba.r === null) return
    this.setRgb(rgba.r, rgba.g!, rgba.b!, source)
  }

  setAhex(ahex: string, source?: string): void {
    const rgba = hexToRgba(ahex)
    if (rgba.r === null) return
    this._r = rgba.r; this._g = rgba.g!; this._b = rgba.b!; this._a = rgba.a!
    const [h, s, v] = rgbToHsv(this._r, this._g, this._b)
    this._h = h; this._s = s; this._v = v
    this._fire('ahex', source)
  }

  private _setFromAhex(ahex: string): void {
    const rgba = hexToRgba(ahex)
    if (rgba.r === null) return
    this._r = rgba.r; this._g = rgba.g!; this._b = rgba.b!; this._a = rgba.a!
    const [h, s, v] = rgbToHsv(this._r, this._g, this._b)
    this._h = h; this._s = s; this._v = v
  }

  private _fire(channel: ColorChangeDetail['channel'], source?: string): void {
    this.dispatchEvent(new CustomEvent<ColorChangeDetail>('change', {
      detail: { channel, source }
    }))
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/color-model.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/jgraduate/ColorModel.ts tests/unit/color-model.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): add ColorModel class with EventTarget change events"
```

---

### Task 3: se-color-slider Component

**Files:**
- Create: `src/editor/components/jgraduate/se-color-slider.ts`

- [ ] **Step 1: Implement se-color-slider**

```typescript
// src/editor/components/jgraduate/se-color-slider.ts
import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('se-color-slider')
export class SeColorSlider extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      touch-action: none;
      user-select: none;
    }
    .arrow-xy {
      position: absolute;
      width: 11px;
      height: 11px;
      border: 1px solid #000;
      border-radius: 50%;
      background: transparent;
      box-shadow: 0 0 0 1px #fff inset;
      pointer-events: none;
      transform: translate(-50%, -50%);
    }
    .arrow-y {
      position: absolute;
      left: 0;
      width: 100%;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      pointer-events: none;
      transform: translateY(-50%);
    }
    .arrow-y::before, .arrow-y::after {
      content: '';
      position: absolute;
      top: -4px;
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
    }
    .arrow-y::before {
      left: -6px;
      border-right: 5px solid #000;
    }
    .arrow-y::after {
      right: -6px;
      border-left: 5px solid #000;
    }
  `

  @property({ type: String }) accessor mode: '2d' | '1d' = '2d'
  @property({ type: Number }) accessor width = 256
  @property({ type: Number }) accessor height = 256
  @property({ type: Number, attribute: 'range-min-x' }) accessor rangeMinX = 0
  @property({ type: Number, attribute: 'range-max-x' }) accessor rangeMaxX = 100
  @property({ type: Number, attribute: 'range-min-y' }) accessor rangeMinY = 0
  @property({ type: Number, attribute: 'range-max-y' }) accessor rangeMaxY = 100

  @state() private _x = 0
  @state() private _y = 0

  get x() { return this._x }
  set x(v: number) { this._x = v }
  get y() { return this._y }
  set y(v: number) { this._y = v }

  private _dragging = false
  private _rafId = 0

  render() {
    const px = this._valueToPxX(this._x)
    const py = this._valueToPxY(this._y)

    return html`
      <div
        style="width:${this.width}px;height:${this.height}px;cursor:${this.mode === '2d' ? 'crosshair' : 'n-resize'}"
        @pointerdown=${this._onPointerDown}
      >
        ${this.mode === '2d'
          ? html`<div class="arrow-xy" style="left:${px}px;top:${py}px"></div>`
          : html`<div class="arrow-y" style="top:${py}px"></div>`
        }
      </div>
    `
  }

  private _onPointerDown = (e: PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    this._dragging = true
    this._updateFromPointer(e)
    const el = e.target as HTMLElement
    el.addEventListener('pointermove', this._onPointerMove)
    el.addEventListener('pointerup', this._onPointerUp)
    e.preventDefault()
  }

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._dragging) return
    if (this._rafId) return
    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0
      this._updateFromPointer(e)
    })
  }

  private _onPointerUp = (e: PointerEvent) => {
    this._dragging = false
    const el = e.target as HTMLElement
    el.releasePointerCapture(e.pointerId)
    el.removeEventListener('pointermove', this._onPointerMove)
    el.removeEventListener('pointerup', this._onPointerUp)
  }

  private _updateFromPointer(e: PointerEvent): void {
    const rect = (this.shadowRoot!.querySelector('div') as HTMLElement).getBoundingClientRect()
    const px = Math.max(0, Math.min(this.width, e.clientX - rect.left))
    const py = Math.max(0, Math.min(this.height, e.clientY - rect.top))
    this._x = this._pxToValueX(px)
    this._y = this._pxToValueY(py)
    this.dispatchEvent(new CustomEvent('sl-change', {
      detail: { x: this._x, y: this._y },
      bubbles: true,
      composed: true
    }))
  }

  private _valueToPxX(v: number): number {
    return ((v - this.rangeMinX) / (this.rangeMaxX - this.rangeMinX)) * this.width
  }
  private _valueToPxY(v: number): number {
    return ((v - this.rangeMinY) / (this.rangeMaxY - this.rangeMinY)) * this.height
  }
  private _pxToValueX(px: number): number {
    return this.rangeMinX + (px / this.width) * (this.rangeMaxX - this.rangeMinX)
  }
  private _pxToValueY(py: number): number {
    return this.rangeMinY + (py / this.height) * (this.rangeMaxY - this.rangeMinY)
  }
}
```

- [ ] **Step 2: Verify tsc compiles**

Run: `npx tsc --build --force` from repo root
Expected: 0 errors

- [ ] **Step 3: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/jgraduate/se-color-slider.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): add se-color-slider Lit component with pointer events"
```

---

### Task 4: se-color-picker Component — Structure + Canvas Rendering

**Files:**
- Create: `src/editor/components/jgraduate/se-color-picker.ts`

This is the largest single component. Implementation is split: this task covers structure + canvas rendering. Task 5 covers the text inputs and mode switching.

- [ ] **Step 1: Implement se-color-picker core structure**

```typescript
// src/editor/components/jgraduate/se-color-picker.ts
import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { ColorModel, hsvToRgb, type ColorChannel } from './ColorModel.js'
import './se-color-slider.js'
import { t } from '../../locale.js'

type PickerMode = 'h' | 's' | 'v' | 'r' | 'g' | 'b' | 'a'

const CHECKER_CSS = `repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px`

@customElement('se-color-picker')
export class SeColorPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      background: #efefef;
      border: 1px outset #666;
      padding: 5px;
    }
    .layout {
      display: flex;
      gap: 5px;
    }
    .map-container, .bar-container {
      position: relative;
      border: 2px solid;
      border-color: #9a9a9a #fff #fff #9a9a9a;
    }
    .map-container { width: 260px; height: 260px; }
    .bar-container { width: 24px; height: 260px; margin-top: 12px; }
    canvas { display: block; }
    .map-container se-color-slider,
    .bar-container se-color-slider {
      position: absolute;
      top: 2px;
      left: 2px;
    }
    .preview { text-align: center; font-size: 9px; margin: 0 5px; }
    .preview-box { width: 60px; height: 30px; border: 1px solid #000; }
    .preview-active, .preview-current {
      display: block;
      width: 100%;
      height: 50%;
    }
    .inputs { display: flex; flex-direction: column; gap: 2px; }
    .input-row { display: flex; align-items: center; gap: 4px; }
    .input-row input[type="radio"] { margin: 0; }
    .input-row input[type="text"] { width: 30px; text-align: right; }
    .hex-row { margin-top: 4px; }
    .hex-row input { width: 50px; }
    .buttons { display: flex; gap: 4px; margin-top: 8px; justify-content: flex-end; }
    .buttons input { padding: 2px 12px; }
    .quick-grid { display: flex; flex-wrap: wrap; width: 120px; gap: 1px; margin-top: 4px; }
    .quick-cell {
      width: 12px; height: 12px; border: 1px solid #888; cursor: pointer;
    }
  `

  @property({ type: String }) accessor color = 'ff0000ff'
  @property({ type: Boolean, attribute: 'alpha-support' }) accessor alphaSupport = true
  @property({ type: String }) accessor mode: PickerMode = 'h'

  @state() private _mode: PickerMode = 'h'
  private _active!: ColorModel
  private _original!: ColorModel
  private _mapCanvas!: HTMLCanvasElement
  private _barCanvas!: HTMLCanvasElement
  private _rafPending = false

  connectedCallback(): void {
    super.connectedCallback()
    this._mode = this.mode
    this._active = new ColorModel(this.color)
    this._original = new ColorModel(this.color)
    this._active.addEventListener('change', this._onColorChange)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this._active.removeEventListener('change', this._onColorChange)
  }

  firstUpdated(): void {
    this._mapCanvas = this.shadowRoot!.querySelector('#map-canvas') as HTMLCanvasElement
    this._barCanvas = this.shadowRoot!.querySelector('#bar-canvas') as HTMLCanvasElement
    this._renderCanvases()
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('_mode')) {
      this._renderCanvases()
    }
  }

  private _onColorChange = () => {
    if (!this._rafPending) {
      this._rafPending = true
      requestAnimationFrame(() => {
        this._rafPending = false
        this._renderCanvases()
        this.requestUpdate()
      })
    }
    this.dispatchEvent(new CustomEvent('live', {
      detail: { color: this._active },
      bubbles: true, composed: true
    }))
  }

  private _renderCanvases(): void {
    if (!this._mapCanvas || !this._barCanvas) return
    this._renderMap()
    this._renderBar()
  }

  private _renderMap(): void {
    const ctx = this._mapCanvas.getContext('2d')!
    const img = ctx.createImageData(256, 256)
    const data = img.data
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const [r, g, b] = this._mapPixelColor(x, y)
        const idx = (y * 256 + x) * 4
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  private _renderBar(): void {
    const ctx = this._barCanvas.getContext('2d')!
    const img = ctx.createImageData(20, 256)
    const data = img.data
    for (let y = 0; y < 256; y++) {
      const [r, g, b, a] = this._barPixelColor(y)
      for (let x = 0; x < 20; x++) {
        const idx = (y * 20 + x) * 4
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  private _mapPixelColor(x: number, y: number): [number, number, number] {
    switch (this._mode) {
      case 'h': return hsvToRgb(this._active.h, (x / 255) * 100, (1 - y / 255) * 100)
      case 's': return hsvToRgb((x / 255) * 360, this._active.s, (1 - y / 255) * 100)
      case 'v': return hsvToRgb((x / 255) * 360, (1 - y / 255) * 100, this._active.v)
      case 'r': return [this._active.r, Math.round((1 - y / 255) * 255), Math.round((x / 255) * 255)]
      case 'g': return [Math.round((1 - y / 255) * 255), this._active.g, Math.round((x / 255) * 255)]
      case 'b': return [Math.round((x / 255) * 255), Math.round((1 - y / 255) * 255), this._active.b]
      case 'a': return hsvToRgb(this._active.h, (x / 255) * 100, (1 - y / 255) * 100)
    }
  }

  private _barPixelColor(y: number): [number, number, number, number] {
    switch (this._mode) {
      case 'h': { const [r, g, b] = hsvToRgb((y / 255) * 360, 100, 100); return [r, g, b, 255] }
      case 's': { const [r, g, b] = hsvToRgb(this._active.h, (1 - y / 255) * 100, this._active.v); return [r, g, b, 255] }
      case 'v': { const [r, g, b] = hsvToRgb(this._active.h, this._active.s, (1 - y / 255) * 100); return [r, g, b, 255] }
      case 'r': return [Math.round((1 - y / 255) * 255), this._active.g, this._active.b, 255]
      case 'g': return [this._active.r, Math.round((1 - y / 255) * 255), this._active.b, 255]
      case 'b': return [this._active.r, this._active.g, Math.round((1 - y / 255) * 255), 255]
      case 'a': return [this._active.r, this._active.g, this._active.b, Math.round((1 - y / 255) * 255)]
    }
  }

  private _getMapXY(): { x: number, y: number } {
    switch (this._mode) {
      case 'h': return { x: this._active.s / 100, y: 1 - this._active.v / 100 }
      case 's': return { x: this._active.h / 360, y: 1 - this._active.v / 100 }
      case 'v': return { x: this._active.h / 360, y: 1 - this._active.s / 100 }
      case 'r': return { x: this._active.b / 255, y: 1 - this._active.g / 255 }
      case 'g': return { x: this._active.b / 255, y: 1 - this._active.r / 255 }
      case 'b': return { x: this._active.r / 255, y: 1 - this._active.g / 255 }
      case 'a': return { x: this._active.s / 100, y: 1 - this._active.v / 100 }
    }
  }

  private _getBarY(): number {
    switch (this._mode) {
      case 'h': return this._active.h / 360
      case 's': return 1 - this._active.s / 100
      case 'v': return 1 - this._active.v / 100
      case 'r': return 1 - this._active.r / 255
      case 'g': return 1 - this._active.g / 255
      case 'b': return 1 - this._active.b / 255
      case 'a': return 1 - this._active.a / 255
    }
  }

  private _onMapChange = (e: CustomEvent) => {
    const { x, y } = e.detail
    const nx = x / 100, ny = y / 100
    switch (this._mode) {
      case 'h': this._active.setHsv(this._active.h, nx * 100, (1 - ny) * 100, 'map'); break
      case 's': this._active.setHsv(nx * 360, this._active.s, (1 - ny) * 100, 'map'); break
      case 'v': this._active.setHsv(nx * 360, (1 - ny) * 100, this._active.v, 'map'); break
      case 'r': this._active.setRgb(this._active.r, Math.round((1 - ny) * 255), Math.round(nx * 255), 'map'); break
      case 'g': this._active.setRgb(Math.round((1 - ny) * 255), this._active.g, Math.round(nx * 255), 'map'); break
      case 'b': this._active.setRgb(Math.round(nx * 255), Math.round((1 - ny) * 255), this._active.b, 'map'); break
      case 'a': this._active.setHsv(this._active.h, nx * 100, (1 - ny) * 100, 'map'); break
    }
  }

  private _onBarChange = (e: CustomEvent) => {
    const ny = e.detail.y / 100
    switch (this._mode) {
      case 'h': this._active.set('h', ny * 360, 'bar'); break
      case 's': this._active.set('s', (1 - ny) * 100, 'bar'); break
      case 'v': this._active.set('v', (1 - ny) * 100, 'bar'); break
      case 'r': this._active.set('r', (1 - ny) * 255, 'bar'); break
      case 'g': this._active.set('g', (1 - ny) * 255, 'bar'); break
      case 'b': this._active.set('b', (1 - ny) * 255, 'bar'); break
      case 'a': this._active.set('a', (1 - ny) * 255, 'bar'); break
    }
  }

  private _onModeChange = (e: Event) => {
    this._mode = (e.target as HTMLInputElement).value as PickerMode
  }

  private _onOk = () => {
    this.dispatchEvent(new CustomEvent('commit', {
      detail: { color: this._active },
      bubbles: true, composed: true
    }))
  }

  private _onCancel = () => {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }))
  }

  render() {
    const mapXY = this._getMapXY()
    const barY = this._getBarY()

    return html`
      <div class="layout">
        <div class="map-container">
          <canvas id="map-canvas" width="256" height="256"></canvas>
          <se-color-slider
            mode="2d"
            width="256" height="256"
            range-min-x="0" range-max-x="100"
            range-min-y="0" range-max-y="100"
            .x=${mapXY.x * 100}
            .y=${mapXY.y * 100}
            @sl-change=${this._onMapChange}
          ></se-color-slider>
        </div>
        <div class="bar-container">
          <canvas id="bar-canvas" width="20" height="256"></canvas>
          <se-color-slider
            mode="1d"
            width="20" height="256"
            range-min-y="0" range-max-y="100"
            .y=${barY * 100}
            @sl-change=${this._onBarChange}
          ></se-color-slider>
        </div>
        <div>
          <div class="preview">
            ${t('config.jpicker_new_color')}
            <div class="preview-box" style="background:${CHECKER_CSS}">
              <span class="preview-active" style="background:${this._active.cssColor}"></span>
              <span class="preview-current" style="background:${this._original.cssColor}"></span>
            </div>
            ${t('config.jpicker_current_color')}
          </div>
          <div class="inputs">
            ${this._renderInputs()}
          </div>
          <div class="buttons">
            <input type="button" value="${t('common.ok')}" @click=${this._onOk} />
            <input type="button" value="${t('common.cancel')}" @click=${this._onCancel} />
          </div>
        </div>
      </div>
    `
  }

  private _renderInputs() {
    const rows: Array<{ label: string, channel: PickerMode, max: number, suffix: string }> = [
      { label: 'H', channel: 'h', max: 360, suffix: '°' },
      { label: 'S', channel: 's', max: 100, suffix: '%' },
      { label: 'V', channel: 'v', max: 100, suffix: '%' },
      { label: 'R', channel: 'r', max: 255, suffix: '' },
      { label: 'G', channel: 'g', max: 255, suffix: '' },
      { label: 'B', channel: 'b', max: 255, suffix: '' },
    ]
    if (this.alphaSupport) {
      rows.push({ label: 'A', channel: 'a', max: 255, suffix: '%' })
    }
    return html`
      ${rows.map(row => html`
        <div class="input-row">
          <input type="radio" name="mode" value=${row.channel}
            .checked=${this._mode === row.channel}
            @change=${this._onModeChange} />
          <label>${row.label}:</label>
          <input type="text" maxlength="3"
            .value=${String(this._active[row.channel as ColorChannel])}
            data-channel=${row.channel}
            @change=${this._onInputChange}
            @keydown=${this._onInputKeydown}
          />${row.suffix}
        </div>
      `)}
      <div class="input-row hex-row">
        <label>#:</label>
        <input type="text" maxlength="6"
          .value=${this._active.hex}
          data-channel="hex"
          @change=${this._onHexChange}
        />
      </div>
    `
  }

  private _onInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    const channel = input.dataset.channel as ColorChannel
    const value = parseInt(input.value, 10)
    if (!isNaN(value)) {
      this._active.set(channel, value, 'input')
    }
  }

  private _onInputKeydown = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement
    const channel = input.dataset.channel as ColorChannel
    const current = this._active[channel]
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      this._active.set(channel, current + 1, 'input')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      this._active.set(channel, current - 1, 'input')
    }
  }

  private _onHexChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    this._active.setHex(input.value, 'input')
  }
}
```

- [ ] **Step 2: Verify tsc compiles**

Run: `npx tsc --build --force`
Expected: 0 errors

- [ ] **Step 3: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/jgraduate/se-color-picker.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): add se-color-picker Lit component with Canvas 2D rendering"
```

---

### Task 5: se-color-picker Unit Tests

**Files:**
- Create: `tests/unit/se-color-picker.test.js`

- [ ] **Step 1: Write unit tests for se-color-picker**

```javascript
// tests/unit/se-color-picker.test.js
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../src/editor/components/jgraduate/se-color-picker.ts'

const flush = async (el) => {
  await customElements.whenDefined('se-color-picker')
  await new Promise(resolve => queueMicrotask(resolve))
  if (el && typeof el.updateComplete?.then === 'function') {
    await el.updateComplete
  }
}

describe('se-color-picker', () => {
  let el

  beforeEach(() => {
    document.body.textContent = ''
    el = document.createElement('se-color-picker')
    el.setAttribute('color', 'ff0000ff')
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('registers as custom element', async () => {
    await flush(el)
    expect(el.shadowRoot).not.toBeNull()
  })

  it('renders map and bar canvases', async () => {
    await flush(el)
    const mapCanvas = el.shadowRoot.querySelector('#map-canvas')
    const barCanvas = el.shadowRoot.querySelector('#bar-canvas')
    expect(mapCanvas).not.toBeNull()
    expect(barCanvas).not.toBeNull()
    expect(mapCanvas.width).toBe(256)
    expect(barCanvas.width).toBe(20)
  })

  it('renders radio buttons for all modes', async () => {
    await flush(el)
    const radios = el.shadowRoot.querySelectorAll('input[type="radio"]')
    expect(radios.length).toBe(7) // H S V R G B A
  })

  it('dispatches commit event on Ok click', async () => {
    await flush(el)
    let fired = false
    el.addEventListener('commit', () => { fired = true })
    const ok = el.shadowRoot.querySelector('input[value]')
    ok.click()
    expect(fired).toBe(true)
  })

  it('dispatches cancel event on Cancel click', async () => {
    await flush(el)
    let fired = false
    el.addEventListener('cancel', () => { fired = true })
    const buttons = el.shadowRoot.querySelectorAll('.buttons input')
    buttons[1].click()
    expect(fired).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/se-color-picker.test.js`
Expected: All PASS (jsdom has Canvas stub; rendering correctness verified via e2e)

- [ ] **Step 3: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add tests/unit/se-color-picker.test.js
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "test(jgraduate): add se-color-picker unit tests"
```

---

### Task 6: jPickerMethod Shim + Delete Old Files

**Files:**
- Create: `src/editor/components/jgraduate/jPickerShim.ts`
- Modify: `src/editor/components/jgraduate/jQuery.jGraduate.ts` (import path change)
- Delete: `src/editor/components/jgraduate/jQuery.jPicker.ts`
- Delete: `src/editor/components/jgraduate/ColorValuePicker.ts`
- Delete: `src/editor/components/jgraduate/Slider.ts`
- Delete: image files (Maps.png, Bars.png, AlphaBar.png, bar-opacity.png, map-opacity.png, preview-opacity.png, mappoint.gif, rangearrows.gif, picker.gif)

- [ ] **Step 1: Create jPickerMethod shim**

```typescript
// src/editor/components/jgraduate/jPickerShim.ts
import './se-color-picker.js'
import { rgbaToHex } from './ColorModel.js'

export const jPickerDefaults = {
  color: { active: 'ff0000ff', mode: 'h' as const, alphaSupport: true },
  window: { title: '', alphaSupport: true, alphaPrecision: 0 },
  images: { clientPath: 'images/' }
}

export function jPickerMethod(
  elem: HTMLElement,
  options: any,
  commitCallback: ((color: any) => void) | null,
  liveCallback: ((color: any) => void) | null,
  cancelCallback: (() => void) | null,
  _i18next?: any
): void {
  const picker = document.createElement('se-color-picker') as any
  const colorOpt = options?.color?.active
  if (typeof colorOpt === 'string') {
    picker.setAttribute('color', colorOpt)
  } else if (colorOpt && typeof colorOpt.val === 'function') {
    picker.setAttribute('color', colorOpt.val('ahex') || 'ff0000ff')
  }
  picker.setAttribute('alpha-support', String(options?.window?.alphaSupport ?? true))
  elem.textContent = ''
  elem.appendChild(picker)
  elem.style.display = 'block'

  const colorProxy = (model: any) => ({
    val(name?: string) {
      if (!name || name === 'all') return { r: model.r, g: model.g, b: model.b, a: model.a, h: model.h, s: model.s, v: model.v, hex: model.hex, ahex: model.ahex }
      if (name === 'hex') return model.hex
      if (name === 'ahex') return model.ahex
      return (model as any)[name]
    }
  })

  picker.addEventListener('commit', (e: CustomEvent) => {
    if (commitCallback) commitCallback(colorProxy(e.detail.color))
    elem.style.display = 'none'
  })
  picker.addEventListener('cancel', () => {
    if (cancelCallback) cancelCallback()
    elem.style.display = 'none'
  })
  if (liveCallback) {
    picker.addEventListener('live', (e: CustomEvent) => {
      liveCallback(colorProxy(e.detail.color))
    })
  }
}
```

- [ ] **Step 2: Update jGraduate import**

In `src/editor/components/jgraduate/jQuery.jGraduate.ts`, change line 22:

From: `import { jPickerDefaults, jPickerMethod } from './jQuery.jPicker.js'`
To: `import { jPickerDefaults, jPickerMethod } from './jPickerShim.js'`

- [ ] **Step 3: Delete old files**

```
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/jQuery.jPicker.ts
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/ColorValuePicker.ts
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/Slider.ts
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/Maps.png
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/Bars.png
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/AlphaBar.png
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/bar-opacity.png
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/map-opacity.png
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/preview-opacity.png
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/mappoint.gif
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/rangearrows.gif
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/picker.gif
```

- [ ] **Step 4: Verify tsc compiles**

Run: `npx tsc --build --force`
Expected: 0 errors (jGraduate.ts still compiles with the shim providing the same exports)

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run && npx tsx scripts/run-e2e.ts`
Expected: vitest all pass, e2e 250/250

- [ ] **Step 6: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add -A
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): replace jQuery.jPicker with se-color-picker + shim

Delete jQuery.jPicker.ts (1,837 LOC), ColorValuePicker.ts, Slider.ts,
and 9 image assets replaced by Canvas 2D rendering.

jGraduate.ts now imports jPickerShim.ts which bridges its internal
jPickerMethod calls to the new se-color-picker Lit component."
```

---

### Task 7: PR-4a Gate Verification + CHANGELOG + PR

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run full gate**

```
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
```

Expected:
- tsc: 0 errors
- lint: 0 errors, ≤23 warnings (jGraduate.ts still present)
- vitest: all pass (640 + new ColorModel + se-color-picker tests)
- e2e: 250/250

- [ ] **Step 2: Add CHANGELOG entry**

Add under `[Unreleased]` in CHANGELOG.md:

```markdown
### Changed
- **jgraduate:** Replace jQuery.jPicker color picker with Lit-based `se-color-picker` component (PR-4a of elix→Lit migration item #3)
  - New `ColorModel` class: standalone color data model with HSV↔RGB conversion, EventTarget change events
  - New `se-color-slider`: generic 2D/1D drag surface using Pointer Events (replaces Slider.ts)
  - New `se-color-picker`: full Photoshop-style color picker with Canvas 2D rendering (replaces 61KB sprite sheet)
  - Thin `jPickerShim.ts` bridges jGraduate's internal calls to new component (temporary, deleted in PR-4b)
  - Deleted: jQuery.jPicker.ts (1,837 LOC), ColorValuePicker.ts (15KB), Slider.ts (13KB), 9 image assets
```

- [ ] **Step 3: Commit + push + create PR**

```
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: add PR-4a CHANGELOG entry"
git -C "C:/Users/jscha/source/repos/svgedit" push -u personal feat/pr-4a-color-picker
gh pr create --repo bilbospocketses/svgedit --base master --head feat/pr-4a-color-picker --title "feat(jgraduate): PR-4a — se-color-picker Lit component replaces jQuery.jPicker" --body "..."
```

---

## PR-4b Tasks

### Task 8: se-gradient-stop Component

**Files:**
- Create: `src/editor/components/jgraduate/se-gradient-stop.ts`

- [ ] **Step 1: Implement se-gradient-stop**

```typescript
// src/editor/components/jgraduate/se-gradient-stop.ts
import { LitElement, html, svg, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

const PICKER_D = 'M-6.2,0.9c3.6-4,6.7-4.3,6.7-12.4c-0.2,7.9,3.1,8.8,6.5,12.4c3.5,3.8,2.9,9.6,0,12.3c-3.1,2.8-10.4,2.7-13.2,0C-9.6,9.9-9.4,4.4-6.2,0.9z'

@customElement('se-gradient-stop')
export class SeGradientStop extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      top: 0;
      width: 0;
      height: 40px;
      cursor: pointer;
      touch-action: none;
    }
    svg { overflow: visible; pointer-events: all; }
  `

  @property({ type: Number }) accessor offset = 0
  @property({ type: String }) accessor color = '#000000'
  @property({ type: Number }) accessor opacity = 1
  @property({ type: Boolean, reflect: true }) accessor selected = false
  @property({ type: String }) accessor stopId = ''

  private _dragging = false

  render() {
    return html`
      <svg width="0" height="40" style="overflow:visible"
        @pointerdown=${this._onPointerDown}
        @dblclick=${this._onDblClick}
        @keydown=${this._onKeyDown}
        tabindex="0"
      >
        ${svg`
          <path d=${PICKER_D} transform="translate(0, 20)"
            fill=${this.color} fill-opacity=${this.opacity}
            stroke="#000" stroke-width=${this.selected ? 2 : 1} />
        `}
      </svg>
    `
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('offset')) {
      this.style.left = `${this.offset * 100}%`
    }
  }

  private _onPointerDown = (e: PointerEvent) => {
    this._dragging = true
    ;(e.target as SVGElement).setPointerCapture(e.pointerId)
    this.dispatchEvent(new CustomEvent('stop-select', {
      detail: { id: this.stopId }, bubbles: true, composed: true
    }))
    const svg = e.target as SVGElement
    svg.addEventListener('pointermove', this._onPointerMove)
    svg.addEventListener('pointerup', this._onPointerUp)
    e.preventDefault()
  }

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._dragging) return
    const track = this.parentElement!
    const rect = track.getBoundingClientRect()
    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    this.dispatchEvent(new CustomEvent('stop-move', {
      detail: { id: this.stopId, offset }, bubbles: true, composed: true
    }))
  }

  private _onPointerUp = (e: PointerEvent) => {
    this._dragging = false
    ;(e.target as SVGElement).releasePointerCapture(e.pointerId)
    const svg = e.target as SVGElement
    svg.removeEventListener('pointermove', this._onPointerMove)
    svg.removeEventListener('pointerup', this._onPointerUp)
  }

  private _onDblClick = () => {
    this.dispatchEvent(new CustomEvent('stop-edit', {
      detail: { id: this.stopId }, bubbles: true, composed: true
    }))
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.dispatchEvent(new CustomEvent('stop-delete', {
        detail: { id: this.stopId }, bubbles: true, composed: true
      }))
    }
  }
}
```

- [ ] **Step 2: Verify tsc compiles**

Run: `npx tsc --build --force`
Expected: 0 errors

- [ ] **Step 3: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/jgraduate/se-gradient-stop.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): add se-gradient-stop Lit component"
```

---

### Task 9: se-gradient-editor Component

**Files:**
- Create: `src/editor/components/jgraduate/se-gradient-editor.ts`

This is the largest PR-4b component. It replaces `jGraduateMethod` (the gradient editor with tabs, SVG preview, stop track, coordinate inputs, and parameter sliders).

- [ ] **Step 1: Implement se-gradient-editor**

The full implementation follows the spec's section 5 architecture. Key structure:

```typescript
// src/editor/components/jgraduate/se-gradient-editor.ts
import { LitElement, html, svg, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import SvgCanvas from '@svgedit/svgcanvas'
import { ColorModel } from './ColorModel.js'
import './se-color-picker.js'
import './se-color-slider.js'
import './se-gradient-stop.js'
import { t } from '../../locale.js'

interface GradientStop {
  id: string
  offset: number
  color: string
  opacity: number
}

@customElement('se-gradient-editor')
export class SeGradientEditor extends LitElement {
  static styles = css`
    :host { display: block; }
    .tabs { display: flex; list-style: none; margin: 0; padding: 0; gap: 2px; }
    .tabs li { padding: 4px 8px; cursor: pointer; background: #ddd; border: 1px solid #999; }
    .tabs li.active { background: #fff; border-bottom-color: #fff; }
    .grad-container { position: relative; width: 256px; height: 256px; margin: 8px 0; border: 1px solid #999; }
    .grad-container svg { display: block; }
    .coord-marker {
      position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px;
      border-radius: 50%; border: 2px solid #000; background: rgba(255,255,255,0.5);
      cursor: move; touch-action: none; font-size: 9px; text-align: center; line-height: 14px;
    }
    .stop-track { position: relative; height: 40px; margin: 4px 0; cursor: crosshair; background: #eee; border: 1px solid #ccc; }
    .controls { display: flex; flex-direction: column; gap: 4px; margin: 4px 0; }
    .slider-row { display: flex; align-items: center; gap: 4px; }
    .slider-row label { width: 50px; font-size: 11px; }
    .slider-row input[type="text"] { width: 30px; text-align: right; }
    .slider-bar { position: relative; width: 145px; height: 14px; background: #ddd; border: 1px solid #999; }
    .coord-inputs { display: flex; gap: 8px; font-size: 11px; }
    .coord-inputs label { margin-right: 2px; }
    .coord-inputs input { width: 30px; text-align: right; }
    .spread-select { margin: 4px 0; }
    .buttons { display: flex; gap: 4px; margin-top: 8px; }
    .buttons input { padding: 2px 12px; }
    .color-picker-overlay {
      position: absolute; z-index: 100; left: 100px; bottom: 15px;
      background: #fff; border: 1px solid #666; box-shadow: 2px 2px 6px rgba(0,0,0,0.3);
    }
  `

  @property({ attribute: 'images-path' }) accessor imagesPath = './components/jgraduate/images/'
  paint: any = null

  @state() private _type: 'solidColor' | 'linearGradient' | 'radialGradient' = 'solidColor'
  @state() private _stops: GradientStop[] = []
  @state() private _selectedStopId: string | null = null
  @state() private _editingStop = false
  @state() private _coords = { x1: 0, y1: 0, x2: 1, y2: 0, cx: 0.5, cy: 0.5, fx: 0.5, fy: 0.5 }
  @state() private _radius = 100
  @state() private _ellipticity = 0
  @state() private _angle = 0
  @state() private _opacity = 100
  @state() private _spreadMethod: 'pad' | 'reflect' | 'repeat' = 'pad'
  @state() private _showFocus = false

  connectedCallback(): void {
    super.connectedCallback()
    if (this.paint) this._initFromPaint(this.paint)
  }

  private _initFromPaint(paint: any): void {
    this._type = paint.type || 'solidColor'
    this._opacity = paint.alpha ?? 100
    if (this._type === 'solidColor') {
      this._stops = [
        { id: this._genId(), offset: 0, color: '#' + (paint.solidColor || 'ffffff'), opacity: 1 },
        { id: this._genId(), offset: 1, color: '#000000', opacity: 1 }
      ]
    } else {
      const grad = paint[this._type]
      if (grad) {
        this._stops = Array.from(grad.querySelectorAll('stop')).map((s: any) => ({
          id: this._genId(),
          offset: parseFloat(s.getAttribute('offset') || '0'),
          color: s.getAttribute('stop-color') || '#000000',
          opacity: parseFloat(s.getAttribute('stop-opacity') ?? '1')
        }))
        if (this._type === 'linearGradient') {
          this._coords.x1 = parseFloat(grad.getAttribute('x1') || '0')
          this._coords.y1 = parseFloat(grad.getAttribute('y1') || '0')
          this._coords.x2 = parseFloat(grad.getAttribute('x2') || '1')
          this._coords.y2 = parseFloat(grad.getAttribute('y2') || '0')
        } else {
          this._coords.cx = parseFloat(grad.getAttribute('cx') || '0.5')
          this._coords.cy = parseFloat(grad.getAttribute('cy') || '0.5')
          this._coords.fx = parseFloat(grad.getAttribute('fx') || '0.5')
          this._coords.fy = parseFloat(grad.getAttribute('fy') || '0.5')
        }
        this._spreadMethod = (grad.getAttribute('spreadMethod') || 'pad') as any
      }
    }
    if (this._stops.length < 2) {
      this._stops = [
        { id: this._genId(), offset: 0, color: '#ffffff', opacity: 1 },
        { id: this._genId(), offset: 1, color: '#000000', opacity: 1 }
      ]
    }
  }

  private _genId(): string { return 'stop_' + Math.random().toString(36).slice(2, 8) }

  // ... render(), event handlers, _buildPaint() for Ok
  // Full implementation follows spec Section 5 structure — see spec for complete render tree.
  // Implementation details are per the approved design; the component body is ~500-600 LOC.

  render() {
    return html`
      <ul class="tabs">
        <li class=${this._type === 'solidColor' ? 'active' : ''} @click=${() => this._setType('solidColor')}>${t('config.jgraduate_solid_color')}</li>
        <li class=${this._type === 'linearGradient' ? 'active' : ''} @click=${() => this._setType('linearGradient')}>${t('config.jgraduate_linear_gradient')}</li>
        <li class=${this._type === 'radialGradient' ? 'active' : ''} @click=${() => this._setType('radialGradient')}>${t('config.jgraduate_radial_gradient')}</li>
      </ul>

      ${this._type === 'solidColor' ? html`
        <se-color-picker
          color=${(this._stops[0]?.color || '#ff0000').slice(1) + 'ff'}
          @commit=${this._onSolidColorCommit}
          @cancel=${this._onCancel}
        ></se-color-picker>
      ` : html`
        ${this._renderGradientUI()}
      `}
    `
  }

  private _renderGradientUI() {
    const gradId = 'jgrad_preview'
    return html`
      <div class="grad-container">
        <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
          <defs>
            ${this._type === 'linearGradient' ? svg`
              <linearGradient id=${gradId}
                x1=${this._coords.x1} y1=${this._coords.y1}
                x2=${this._coords.x2} y2=${this._coords.y2}
                spreadMethod=${this._spreadMethod}>
                ${this._stops.map(s => svg`<stop offset=${s.offset} stop-color=${s.color} stop-opacity=${s.opacity} />`)}
              </linearGradient>
            ` : svg`
              <radialGradient id=${gradId}
                cx=${this._coords.cx} cy=${this._coords.cy}
                fx=${this._showFocus ? this._coords.fx : this._coords.cx}
                fy=${this._showFocus ? this._coords.fy : this._coords.cy}
                r=${this._radius / 100 * 0.5}
                spreadMethod=${this._spreadMethod}>
                ${this._stops.map(s => svg`<stop offset=${s.offset} stop-color=${s.color} stop-opacity=${s.opacity} />`)}
              </radialGradient>
            `}
          </defs>
          ${svg`<rect width="256" height="256" fill="url(#${gradId})" fill-opacity=${this._opacity / 100} />`}
        </svg>
        ${this._renderCoordMarkers()}
      </div>

      <div class="stop-track" @click=${this._onTrackClick}>
        ${this._stops.map(s => html`
          <se-gradient-stop
            .offset=${s.offset}
            .color=${s.color}
            .opacity=${s.opacity}
            .stopId=${s.id}
            .selected=${s.id === this._selectedStopId}
            @stop-select=${this._onStopSelect}
            @stop-move=${this._onStopMove}
            @stop-edit=${this._onStopEdit}
            @stop-delete=${this._onStopDelete}
          ></se-gradient-stop>
        `)}
      </div>

      ${this._editingStop ? html`
        <div class="color-picker-overlay">
          <se-color-picker
            color=${this._getSelectedStopAhex()}
            alpha-support
            @commit=${this._onStopColorCommit}
            @cancel=${() => { this._editingStop = false }}
          ></se-color-picker>
        </div>
      ` : nothing}

      ${this._renderCoordInputs()}
      ${this._renderSliders()}

      <div class="spread-select">
        <label>${t('config.jgraduate_spread_method')}</label>
        <select @change=${this._onSpreadChange}>
          <option value="pad" .selected=${this._spreadMethod === 'pad'}>${t('properties.jgraduate_pad')}</option>
          <option value="reflect" .selected=${this._spreadMethod === 'reflect'}>${t('properties.jgraduate_reflect')}</option>
          <option value="repeat" .selected=${this._spreadMethod === 'repeat'}>${t('properties.jgraduate_repeat')}</option>
        </select>
      </div>

      <div class="buttons">
        <input type="button" value="${t('common.ok')}" @click=${this._onOk} />
        <input type="button" value="${t('common.cancel')}" @click=${this._onCancel} />
      </div>
    `
  }

  private _renderCoordMarkers() {
    if (this._type === 'linearGradient') {
      return html`
        <div class="coord-marker" style="left:${this._coords.x1 * 256}px;top:${this._coords.y1 * 256}px"
          @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'x1', 'y1')}>1</div>
        <div class="coord-marker" style="left:${this._coords.x2 * 256}px;top:${this._coords.y2 * 256}px"
          @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'x2', 'y2')}>2</div>
      `
    }
    return html`
      <div class="coord-marker" style="left:${this._coords.cx * 256}px;top:${this._coords.cy * 256}px"
        @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'cx', 'cy')}>C</div>
      ${this._showFocus ? html`
        <div class="coord-marker" style="left:${this._coords.fx * 256}px;top:${this._coords.fy * 256}px"
          @pointerdown=${(e: PointerEvent) => this._startCoordDrag(e, 'fx', 'fy')}>F</div>
      ` : nothing}
    `
  }

  private _renderCoordInputs() {
    if (this._type === 'linearGradient') {
      return html`<div class="coord-inputs">
        <div><label>${t('config.jgraduate_begin_point')}</label>
          <label>x:</label><input type="text" .value=${String(this._coords.x1)} @change=${(e: Event) => this._setCoord('x1', e)} />
          <label>y:</label><input type="text" .value=${String(this._coords.y1)} @change=${(e: Event) => this._setCoord('y1', e)} />
        </div>
        <div><label>${t('config.jgraduate_end_point')}</label>
          <label>x:</label><input type="text" .value=${String(this._coords.x2)} @change=${(e: Event) => this._setCoord('x2', e)} />
          <label>y:</label><input type="text" .value=${String(this._coords.y2)} @change=${(e: Event) => this._setCoord('y2', e)} />
        </div>
      </div>`
    }
    return html`<div class="coord-inputs">
      <div><label>${t('config.jgraduate_center_point')}</label>
        <label>x:</label><input type="text" .value=${String(this._coords.cx)} @change=${(e: Event) => this._setCoord('cx', e)} />
        <label>y:</label><input type="text" .value=${String(this._coords.cy)} @change=${(e: Event) => this._setCoord('cy', e)} />
      </div>
      <div><label>${t('config.jgraduate_focal_point')}</label>
        <label>${t('config.jgraduate_match_center')}</label>
        <input type="checkbox" .checked=${!this._showFocus} @change=${this._toggleFocus} />
        <label>x:</label><input type="text" .value=${String(this._coords.fx)} @change=${(e: Event) => this._setCoord('fx', e)} ?disabled=${!this._showFocus} />
        <label>y:</label><input type="text" .value=${String(this._coords.fy)} @change=${(e: Event) => this._setCoord('fy', e)} ?disabled=${!this._showFocus} />
      </div>
    </div>`
  }

  private _renderSliders() {
    return html`<div class="controls">
      ${this._type === 'radialGradient' ? html`
        <div class="slider-row">
          <label>${t('config.jgraduate_radius')}</label>
          <se-color-slider mode="1d" width="145" height="14" range-max-y="200"
            .y=${this._radius} @sl-change=${(e: CustomEvent) => { this._radius = e.detail.y }}
          ></se-color-slider>
          <input type="text" .value=${String(this._radius)} @change=${(e: Event) => { this._radius = parseInt((e.target as HTMLInputElement).value) || 100 }} />%
        </div>
        <div class="slider-row">
          <label>${t('config.jgraduate_ellip')}</label>
          <se-color-slider mode="1d" width="145" height="14" range-max-y="100"
            .y=${this._ellipticity} @sl-change=${(e: CustomEvent) => { this._ellipticity = e.detail.y }}
          ></se-color-slider>
          <input type="text" .value=${String(this._ellipticity)} @change=${(e: Event) => { this._ellipticity = parseInt((e.target as HTMLInputElement).value) || 0 }} />%
        </div>
        <div class="slider-row">
          <label>${t('config.jgraduate_angle')}</label>
          <se-color-slider mode="1d" width="145" height="14" range-max-y="360"
            .y=${this._angle} @sl-change=${(e: CustomEvent) => { this._angle = e.detail.y }}
          ></se-color-slider>
          <input type="text" .value=${String(this._angle)} @change=${(e: Event) => { this._angle = parseInt((e.target as HTMLInputElement).value) || 0 }} />${t('config.jgraduate_deg')}
        </div>
      ` : nothing}
      <div class="slider-row">
        <label>${t('config.jgraduate_opac')}</label>
        <se-color-slider mode="1d" width="145" height="14" range-max-y="100"
          .y=${this._opacity} @sl-change=${(e: CustomEvent) => { this._opacity = e.detail.y }}
        ></se-color-slider>
        <input type="text" .value=${String(this._opacity)} @change=${(e: Event) => { this._opacity = parseInt((e.target as HTMLInputElement).value) || 100 }} />%
      </div>
    </div>`
  }

  // Event handlers
  private _setType(type: typeof this._type) { this._type = type }
  private _onSpreadChange = (e: Event) => { this._spreadMethod = (e.target as HTMLSelectElement).value as any }
  private _toggleFocus = (e: Event) => { this._showFocus = !(e.target as HTMLInputElement).checked }

  private _setCoord(key: string, e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value)
    if (!isNaN(val)) { (this._coords as any)[key] = Math.max(0, Math.min(1, val)); this.requestUpdate() }
  }

  private _startCoordDrag(e: PointerEvent, xKey: string, yKey: string) {
    const el = e.target as HTMLElement
    el.setPointerCapture(e.pointerId)
    const container = this.shadowRoot!.querySelector('.grad-container')!
    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      ;(this._coords as any)[xKey] = Math.max(0, Math.min(1, (ev.clientX - rect.left) / 256))
      ;(this._coords as any)[yKey] = Math.max(0, Math.min(1, (ev.clientY - rect.top) / 256))
      this.requestUpdate()
    }
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    e.preventDefault()
  }

  private _onStopSelect = (e: CustomEvent) => { this._selectedStopId = e.detail.id }
  private _onStopMove = (e: CustomEvent) => {
    const stop = this._stops.find(s => s.id === e.detail.id)
    if (stop) { stop.offset = e.detail.offset; this._stops = [...this._stops].sort((a, b) => a.offset - b.offset); this.requestUpdate() }
  }
  private _onStopEdit = () => { this._editingStop = true }
  private _onStopDelete = (e: CustomEvent) => {
    if (this._stops.length <= 2) return
    this._stops = this._stops.filter(s => s.id !== e.detail.id)
    this._selectedStopId = this._stops[0]?.id ?? null
  }

  private _onTrackClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('se-gradient-stop')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const nearest = this._stops.reduce((prev, curr) => Math.abs(curr.offset - offset) < Math.abs(prev.offset - offset) ? curr : prev)
    const r = parseInt(nearest.color.slice(1, 3), 16)
    const g = parseInt(nearest.color.slice(3, 5), 16)
    const b = parseInt(nearest.color.slice(5, 7), 16)
    const invColor = '#' + [255 - r, 255 - g, 255 - b].map(v => v.toString(16).padStart(2, '0')).join('')
    const newStop: GradientStop = { id: this._genId(), offset, color: invColor, opacity: 1 }
    this._stops = [...this._stops, newStop].sort((a, b) => a.offset - b.offset)
    this._selectedStopId = newStop.id
  }

  private _getSelectedStopAhex(): string {
    const stop = this._stops.find(s => s.id === this._selectedStopId)
    if (!stop) return 'ff0000ff'
    const hex = stop.color.startsWith('#') ? stop.color.slice(1) : stop.color
    const alpha = Math.round(stop.opacity * 255).toString(16).padStart(2, '0')
    return hex + alpha
  }

  private _onStopColorCommit = (e: CustomEvent) => {
    const color = e.detail.color
    const stop = this._stops.find(s => s.id === this._selectedStopId)
    if (stop) {
      stop.color = '#' + color.hex
      stop.opacity = color.a / 255
      this._stops = [...this._stops]
    }
    this._editingStop = false
  }

  private _onSolidColorCommit = (e: CustomEvent) => {
    const color = e.detail.color
    const paint = new SvgCanvas.Paint({ solidColor: color.hex })
    paint.alpha = Math.round(color.a / 255 * 100)
    this.dispatchEvent(new CustomEvent('ok', { detail: { paint }, bubbles: true, composed: true }))
  }

  private _onOk = () => {
    const paint = this._buildPaint()
    this.dispatchEvent(new CustomEvent('ok', { detail: { paint }, bubbles: true, composed: true }))
  }

  private _onCancel = () => {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }))
  }

  private _buildPaint(): any {
    const ns = 'http://www.w3.org/2000/svg'
    const grad = document.createElementNS(ns, this._type === 'linearGradient' ? 'linearGradient' : 'radialGradient')
    if (this._type === 'linearGradient') {
      grad.setAttribute('x1', String(this._coords.x1))
      grad.setAttribute('y1', String(this._coords.y1))
      grad.setAttribute('x2', String(this._coords.x2))
      grad.setAttribute('y2', String(this._coords.y2))
    } else {
      grad.setAttribute('cx', String(this._coords.cx))
      grad.setAttribute('cy', String(this._coords.cy))
      grad.setAttribute('fx', String(this._showFocus ? this._coords.fx : this._coords.cx))
      grad.setAttribute('fy', String(this._showFocus ? this._coords.fy : this._coords.cy))
      grad.setAttribute('r', String(this._radius / 100 * 0.5))
      if (this._ellipticity > 0 || this._angle > 0) {
        grad.setAttribute('gradientTransform', `rotate(${this._angle}, ${this._coords.cx}, ${this._coords.cy}) scale(1, ${1 - this._ellipticity / 100})`)
      }
    }
    grad.setAttribute('spreadMethod', this._spreadMethod)
    for (const s of this._stops) {
      const stop = document.createElementNS(ns, 'stop')
      stop.setAttribute('offset', String(s.offset))
      stop.setAttribute('stop-color', s.color)
      stop.setAttribute('stop-opacity', String(s.opacity))
      grad.appendChild(stop)
    }
    const paint = new SvgCanvas.Paint({ [this._type]: grad })
    paint.alpha = this._opacity
    return paint
  }
}
```

- [ ] **Step 2: Verify tsc compiles**

Run: `npx tsc --build --force`
Expected: 0 errors

- [ ] **Step 3: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add src/editor/components/jgraduate/se-gradient-editor.ts
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): add se-gradient-editor Lit component"
```

---

### Task 10: se-paint-picker + Consumer Rewire + Delete Legacy

**Files:**
- Create: `src/editor/components/se-paint-picker.ts`
- Delete: `src/editor/components/seColorPicker.ts`
- Delete: `src/editor/components/jgraduate/jQuery.jGraduate.ts`
- Delete: `src/editor/components/jgraduate/jPickerShim.ts`
- Delete: `src/editor/components/jgraduate/images/rangearrows2.gif`
- Delete: `src/editor/components/jgraduate/images/NoColor.png`
- Modify: `src/editor/panels/BottomPanel.ts` (remove jGraduate import)

- [ ] **Step 1: Create se-paint-picker**

```typescript
// src/editor/components/se-paint-picker.ts
import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import SvgCanvas from '@svgedit/svgcanvas'
import PaintBox from './PaintBox.js'
import './jgraduate/se-gradient-editor.js'
import { t } from '../locale.js'

@customElement('se-colorpicker')
export class SePaintPicker extends LitElement {
  static styles = css`
    :host { display: inline-block; position: relative; }
    .trigger { cursor: pointer; display: flex; align-items: center; gap: 4px; }
    .trigger img { width: 20px; height: 20px; }
    .swatch { display: inline-block; }
    se-gradient-editor {
      position: absolute; z-index: 1000; top: 30px; left: 0;
      background: #f0f0f0; border: 1px solid #666;
      box-shadow: 2px 2px 8px rgba(0,0,0,0.3);
    }
  `

  @property() accessor label = ''
  @property() accessor type = ''
  @property() accessor src = ''

  @state() private _open = false
  private _paintBox: PaintBox | null = null
  private _paint: any = null
  private _svatchContainer: HTMLElement | null = null
  private _imgPath = ''

  connectedCallback(): void {
    super.connectedCallback()
    this._imgPath = new URL('.', import.meta.url).pathname
  }

  firstUpdated(): void {
    this._svatchContainer = this.shadowRoot!.querySelector('.swatch') as HTMLElement
    if (this._svatchContainer) {
      this._paintBox = new PaintBox(this._svatchContainer, this.type)
    }
  }

  update(svgCanvas: any, selectedElement: any, apply?: boolean): void {
    if (!this._paintBox) return
    const paint = this._paintBox.update(svgCanvas, selectedElement)
    if (this._open && paint) {
      this.requestUpdate()
    }
    if (paint && apply) {
      this._paint = paint
      this._paintBox.setPaint(paint)
      this.dispatchEvent(new CustomEvent('change', { detail: { paint }, bubbles: true, composed: true }))
    }
  }

  setPaint(paint: any): void {
    this._paint = paint
    this._paintBox?.setPaint(paint)
  }

  init(i18next: any): void {
    this.setAttribute('title', t(this.label))
  }

  private _toggle = () => {
    this._open = !this._open
  }

  private _onOk = (e: CustomEvent) => {
    const paint = e.detail.paint
    this._paint = paint
    this._paintBox?.setPaint(paint)
    this._open = false
    this.dispatchEvent(new CustomEvent('change', { detail: { paint }, bubbles: true, composed: true }))
  }

  private _onCancel = () => {
    this._open = false
  }

  render() {
    return html`
      <div class="trigger" @click=${this._toggle} title=${t(this.label)}>
        ${this.src ? html`<img src=${this._imgPath + '/' + this.src} alt="" />` : nothing}
        <div class="swatch"></div>
      </div>
      ${this._open ? html`
        <se-gradient-editor
          .paint=${this._paint}
          images-path="./components/jgraduate/images/"
          @ok=${this._onOk}
          @cancel=${this._onCancel}
        ></se-gradient-editor>
      ` : nothing}
    `
  }
}
```

- [ ] **Step 2: Update BottomPanel.ts import**

In `src/editor/panels/BottomPanel.ts` line 4, change:
From: `import { jGraduate } from '../components/jgraduate/jQuery.jGraduate.js'`
To: `import SvgCanvas from '@svgedit/svgcanvas'`

And update any `jGraduate.Paint` references to `SvgCanvas.Paint`.

- [ ] **Step 3: Delete legacy files**

```
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/seColorPicker.ts
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/jQuery.jGraduate.ts
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/jPickerShim.ts
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/rangearrows2.gif
git -C "C:/Users/jscha/source/repos/svgedit" rm src/editor/components/jgraduate/images/NoColor.png
```

- [ ] **Step 4: Verify tsc compiles**

Run: `npx tsc --build --force`
Expected: 0 errors

- [ ] **Step 5: Commit**

```
git -C "C:/Users/jscha/source/repos/svgedit" add -A
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "feat(jgraduate): PR-4b — se-paint-picker + se-gradient-editor replace jGraduate

Delete jQuery.jGraduate.ts (1,290 LOC), seColorPicker.ts, jPickerShim.ts.
All jQuery code eliminated from jgraduate/. Lint warnings drop from 23 to 0."
```

---

### Task 11: PR-4b Gate Verification + CHANGELOG + PR

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run full gate**

```
npx tsc --build --force
npm run lint
npx vitest run
npx tsx scripts/run-e2e.ts
npm run build
```

Expected:
- tsc: 0 errors
- lint: **0 errors + 0 warnings** (all 23 jgraduate warnings gone)
- vitest: all pass
- e2e: 250/250
- build: success (11 extensions bundled)

- [ ] **Step 2: Manual smoke test**

Open `http://localhost:8000/src/editor/index.html`:
1. Click fill color swatch → gradient editor opens
2. Solid color tab → pick a color → Ok → fill changes
3. Linear gradient tab → drag stops → adjust coordinates → Ok
4. Double-click a stop → color picker opens inline → pick color → Ok
5. Radial gradient tab → adjust radius/ellipticity/angle → Ok
6. Switch stroke color → repeat basic flow
7. Verify e2e still 250/250 after smoke

- [ ] **Step 3: Add CHANGELOG entry**

```markdown
### Changed
- **jgraduate:** Replace jGraduate gradient editor with Lit-based components (PR-4b, completes elix→Lit item #3 PR-4)
  - New `se-gradient-stop`: draggable gradient stop marker with Pointer Events
  - New `se-gradient-editor`: full gradient editor (tabs, SVG preview, stop track, coordinate controls, parameter sliders)
  - New `se-paint-picker`: top-level host replacing seColorPicker.ts (registers as `<se-colorpicker>`, zero consumer API change)
  - Deleted: jQuery.jGraduate.ts (1,290 LOC), seColorPicker.ts, jPickerShim.ts, remaining image assets
  - **ESLint warnings: 23 → 0** (all were in deleted jgraduate files)
  - **jQuery dependency: fully eliminated** from the editor component tree
```

- [ ] **Step 4: Commit + push + create PR**

```
git -C "C:/Users/jscha/source/repos/svgedit" add CHANGELOG.md
git -C "C:/Users/jscha/source/repos/svgedit" commit -m "docs: add PR-4b CHANGELOG entry"
git -C "C:/Users/jscha/source/repos/svgedit" push -u personal feat/pr-4b-gradient-editor
gh pr create --repo bilbospocketses/svgedit --base master --head feat/pr-4b-gradient-editor --title "feat(jgraduate): PR-4b — se-gradient-editor + se-paint-picker complete jQuery elimination" --body "..."
```

---

## Notes for implementers

1. **Lit conventions are mandatory.** Read `docs/superpowers/conventions/lit-component-conventions.md` before writing any component. Key: `@property() accessor` (NOT bare class fields), class-field arrows for event handlers, `bubbles: true, composed: true` for events escaping shadow DOM.

2. **The `accessor` keyword is REQUIRED** on all `@property()` declarations. Without it, Lit 3 + TC39 decorators won't trigger reactive updates.

3. **Canvas in jsdom:** jsdom stubs `<canvas>` but returns a non-functional context. Unit tests verify DOM structure + events, not pixel correctness. Pixel correctness is verified via e2e (Playwright renders in real Chromium).

4. **CSS checker pattern** for alpha backgrounds: `repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px` — use this everywhere sprites previously showed the transparency grid.

5. **The `Paint` class** lives in `@svgedit/svgcanvas` (imported as `SvgCanvas.Paint`). It's the external contract between the color picker and the rest of the editor. Don't modify it.

6. **Import extensions:** Use `.js` extensions in all imports per the project's `"type": "module"` + TypeScript `verbatimModuleSyntax` configuration.

7. **i18n keys:** All `t('config.jgraduate_*')` and `t('config.jpicker_*')` keys already exist in `src/editor/locale/lang.en.ts`. Verify before using; don't invent new keys without checking.
