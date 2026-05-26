/**
 * @file typed-events — type-safe CustomEvent detail access for svgedit Lit elements.
 *
 * Replaces the pervasive `(evt as any).detail.value` pattern with a single
 * narrow cast helper (`typedDetail<T>`) and named detail interfaces.
 *
 * Usage at call sites:
 * ```ts
 * import { typedDetail, type SeChangeDetail } from '../typed-events.js'
 * // ...
 * const { value } = typedDetail<SeChangeDetail>(evt)
 * ```
 *
 * @module typed-events
 */

// Re-export the existing ColorModel detail type so consumers can import from
// a single location.
export type { ColorChangeDetail } from './components/jgraduate/ColorModel.js'

// ---------------------------------------------------------------------------
// Generic "value" change (se-select, se-dropdown, se-list, TopPanel inputs)
// ---------------------------------------------------------------------------

/** Detail for `change` events carrying a single `value` string. */
export interface SeChangeDetail {
  value: string
}

// ---------------------------------------------------------------------------
// se-paint-picker / se-gradient-editor "paint" events
// ---------------------------------------------------------------------------

/**
 * Detail for `change` / `ok` events carrying a Paint object.
 * The paint type is opaque (SvgCanvas.Paint) — typed as `unknown` here;
 * consumers narrow via their own Paint import if needed.
 */
export interface SePaintDetail {
  paint: unknown
}

// ---------------------------------------------------------------------------
// se-color-picker events
// ---------------------------------------------------------------------------

/**
 * Detail for `live` and `commit` events from se-color-picker.
 * The `color` property is a ColorModel instance.
 */
export interface SeColorDetail {
  color: unknown
}

// ---------------------------------------------------------------------------
// se-color-slider
// ---------------------------------------------------------------------------

/** Detail for `sl-change` events from se-color-slider. */
export interface SeSliderChangeDetail {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// se-gradient-stop events
// ---------------------------------------------------------------------------

/** Detail for `stop-select`, `stop-edit`, `stop-delete` events. */
export interface SeStopIdDetail {
  id: string
}

/** Detail for `stop-move` events. */
export interface SeStopMoveDetail {
  id: string
  offset: number
}

// ---------------------------------------------------------------------------
// se-list-item
// ---------------------------------------------------------------------------

/** Detail for `selectedindexchange` events from se-list-item. */
export interface SeSelectedIndexDetail {
  selectedItem: string
}

// ---------------------------------------------------------------------------
// se-palette
// ---------------------------------------------------------------------------

/** Detail for `change` events from se-palette. */
export interface SePaletteDetail {
  picker: string
  color: string
}

// ---------------------------------------------------------------------------
// cmenu-dialog / context menu
// ---------------------------------------------------------------------------

/** Detail for `change` events from se-cmenu (context menu). */
export interface SeCmenuDetail {
  trigger: string
}

// ---------------------------------------------------------------------------
// svg-source-dialog (polymorphic change event)
// ---------------------------------------------------------------------------

/**
 * The SVG-source dialog dispatches `change` with several distinct shapes.
 * This union covers all observed variants.
 */
export type SeSvgSourceDetail =
  | { dialog: string }
  | { copy: string; value: string }
  | { value: string; dialog: string }
  | { dynamic: boolean; dialog: string }

// ---------------------------------------------------------------------------
// storage-dialog
// ---------------------------------------------------------------------------

/** Detail for `change` events from the storage-preference dialog. */
export interface SeStorageDetail {
  trigger: string
  select: string
  checkbox: boolean
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Type-safe accessor for `CustomEvent.detail`.
 *
 * Replaces `(evt as any).detail` with a single narrow cast so that every
 * consumer gets the correct detail type without sprinkling `as any` or
 * `as CustomEvent<X>` at every call site.
 *
 * @example
 * ```ts
 * const { value } = typedDetail<SeChangeDetail>(evt)
 * ```
 */
export function typedDetail<T> (evt: Event): T {
  return (evt as CustomEvent<T>).detail
}
