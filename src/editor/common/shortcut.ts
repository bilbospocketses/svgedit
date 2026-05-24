/**
 * Shortcut-key normalization helpers.
 *
 * Canonical format: `[alt+][shift+][meta+][ctrl+]UPPERCASE_KEY`
 *
 * Modifier order is fixed: alt → shift → meta → ctrl → key. The key is uppercased
 * via `String.prototype.toUpperCase()` — letter keys become e.g. `Z`, special keys
 * like `'ArrowLeft'` become `'ARROWLEFT'`, `'Tab'` → `'TAB'`, `'Escape'` → `'ESCAPE'`.
 *
 * Consumer strings MUST use this canonical format. Examples:
 *   - `shortcut="Q"` — plain letter
 *   - `shortcut="ctrl+Z"` — modifier + letter
 *   - `shortcut="shift+D"` — different modifier + letter
 *   - `shortcut="ARROWLEFT"` — special key
 *   - `shortcut="DELETE/BACKSPACE"` — multiple alternatives via `/`
 *   - `shortcut="alt+shift+meta+ctrl+A"` — fully-modified
 *
 * Unifies the previously-drifted normalization shapes from `seButton.ts`,
 * `seMenuItem.ts`, and `Editor.ts:setAll()` into a single canonical implementation.
 */

/**
 * Compute the canonical shortcut string for a keyboard event.
 *
 * Always returns modifiers in `alt+shift+meta+ctrl+` order, regardless of how
 * the user actually pressed them. Always uppercases the key. Consumer shortcut
 * strings must follow the same convention to match.
 */
export function normalizeShortcut(e: KeyboardEvent): string {
  return [
    e.altKey && 'alt+',
    e.shiftKey && 'shift+',
    e.metaKey && 'meta+',
    e.ctrlKey && 'ctrl+',
    e.key.toUpperCase()
  ].filter(Boolean).join('')
}

/**
 * Test whether a keyboard event matches a shortcut string. Supports `/` for
 * alternative keys: `'DELETE/BACKSPACE'` matches either Delete or Backspace.
 */
export function matchShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const normalized = normalizeShortcut(e)
  return shortcut.split('/').some(s => s === normalized)
}
