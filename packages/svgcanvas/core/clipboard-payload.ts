// Guard for the cross-tab clipboard mirror (#51). When another same-origin tab
// flashes its clipboard onto localStorage, this tab receives a `storage` event
// and mirrors the value into its own sessionStorage. The value is only mirrored
// if it is plausibly our own clipboard payload — a bounded-size JSON array
// (copy writes `JSON.stringify(SVGAsJSON[])`). This caps quota abuse from an
// oversized value and keeps known-garbage out of the paste path.

/** Maximum characters accepted for a mirrored clipboard payload (~10 MB). */
export const MAX_CLIPBOARD_CHARS: number = 10 * 1024 * 1024

/**
 * Whether a `storage`-event value should be mirrored into sessionStorage as the
 * clipboard: a non-empty, size-bounded string that parses to a JSON array.
 */
export function isMirrorableClipboard (value: string | null): value is string {
  if (value === null || value.length === 0 || value.length > MAX_CLIPBOARD_CHARS) {
    return false
  }
  try {
    return Array.isArray(JSON.parse(value))
  } catch {
    return false
  }
}
