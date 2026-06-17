/**
 * Input validators for untrusted values that flow into DOM ids, CSS `url(#…)`,
 * path data, and HTML-string sinks. Cheap allow-list guards (defense-in-depth;
 * several of these sinks are already `setAttribute`-contained — see audit #8/#9/#10).
 * @module validators
 * @license MIT
 */

/** True if `id` is a safe DOM id: letter/underscore start, then word chars or hyphen. */
export const isSafeDomId = (id: string): boolean => /^[A-Za-z_][\w-]*$/.test(id)

/** True if `d` contains only SVG path-data characters (commands, numbers, separators). */
export const isSafePathData = (d: string): boolean => /^[\d\s,.eE+\-MmLlHhVvCcSsQqTtAaZz]*$/.test(d)

/**
 * True if `p` is a safe extension path/URL — i.e. contains no quotes, angle
 * brackets, or whitespace that could break out of an HTML attribute or tag.
 */
export const isSafeExtPath = (p: string): boolean => /^[\w\-./:?=&%~]*$/.test(p)
