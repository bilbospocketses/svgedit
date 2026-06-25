/**
 * Selection state store for the editor: the single source of truth for the
 * currently-selected element and the multi-select flag, with a subscription
 * mechanism so UI (panels, coordinators) can react to selection changes rather
 * than reading `Editor` fields directly.
 *
 * Introduced in the #108 god-object decomposition (PR-3). `Editor` exposes
 * `selectedElement` / `multiselected` as accessors over this store, so every
 * existing reader/writer is unchanged; panels migrate to `subscribe()` in a
 * later PR. Until then there are no subscribers and emit is a no-op.
 * @license MIT
 */

/** Immutable snapshot emitted on every selection change. */
export interface SelectionState {
  selectedElement: Element | null
  multiselected: boolean
}

/** Listener invoked synchronously after each selection change. */
export type SelectionListener = (state: SelectionState) => void

/** Holds the current selection and notifies subscribers when it changes. */
export class EditorSelection {
  #selectedElement: Element | null = null
  #multiselected = false
  #listeners = new Set<SelectionListener>()

  get selectedElement (): Element | null {
    return this.#selectedElement
  }

  set selectedElement (value: Element | null) {
    this.#selectedElement = value
    this.#emit()
  }

  get multiselected (): boolean {
    return this.#multiselected
  }

  set multiselected (value: boolean) {
    this.#multiselected = value
    this.#emit()
  }

  /** Set both fields atomically and emit a single change. */
  setSelection (selectedElement: Element | null, multiselected: boolean): void {
    this.#selectedElement = selectedElement
    this.#multiselected = multiselected
    this.#emit()
  }

  /** Subscribe to selection changes; returns an unsubscribe function. */
  subscribe (listener: SelectionListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #emit (): void {
    const state: SelectionState = {
      selectedElement: this.#selectedElement,
      multiselected: this.#multiselected
    }
    for (const listener of this.#listeners) {
      listener(state)
    }
  }
}
