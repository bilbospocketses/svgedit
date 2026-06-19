// Single source of truth for the localStorage keys used to persist the current
// drawing and its title, plus the save/clear operation that writes them.
//
// Keeping the key derivation in one place is what fixes #52: the old code saved
// the title under `title-svgedit-<name>` but cleared it under
// `svgedit-<name>-title`, so clearing a document left a stale title behind.
// Deriving both keys here means the set / clear / read sites can no longer drift.

/** Minimal subset of the Web Storage API — keeps this unit testable with a stub. */
export interface KeyedStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

/** localStorage key holding the serialized SVG for a given canvas name. */
export function contentStorageKey (canvasName: string): string {
  return `svgedit-${canvasName}`
}

/** localStorage key holding the document title for a given canvas name. */
export function titleStorageKey (canvasName: string): string {
  return `title-${contentStorageKey(canvasName)}`
}

/**
 * Persist the current SVG + its title, or clear both when `svgString` is empty.
 * Content and title always use the matching key pair, so a clear can never leave
 * a stale title behind.
 */
export function saveSvgContent (
  storage: KeyedStorage,
  canvasName: string,
  svgString: string,
  title: string
): void {
  const contentKey = contentStorageKey(canvasName)
  const titleKey = titleStorageKey(canvasName)
  if (!svgString) {
    storage.removeItem(contentKey)
    storage.removeItem(titleKey)
  } else {
    storage.setItem(contentKey, svgString)
    storage.setItem(titleKey, title)
  }
}
