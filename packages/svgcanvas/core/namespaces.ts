/**
 * Namespaces or tools therefor.
 * @module namespaces
 * @license MIT
 */

/**
 * Common namespaces constants in alpha order.
 * @enum {string}
 */
export const NS = {
  HTML: 'http://www.w3.org/1999/xhtml',
  SE: 'http://svg-edit.googlecode.com',
  SVG: 'http://www.w3.org/2000/svg',
  XLINK: 'http://www.w3.org/1999/xlink',
  XML: 'http://www.w3.org/XML/1998/namespace',
  XMLNS: 'http://www.w3.org/2000/xmlns/' // see http://www.w3.org/TR/REC-xml-names/#xmlReserved
} as const

/** Union of NS object keys */
export type NSKey = keyof typeof NS

/**
 * Returns the namespace URI map with values swapped to their lowercase keys.
 */
export const getReverseNS = (): Record<string, string> => {
  const reverseNS: Record<string, string> = {}
  for (const [name, URI] of Object.entries(NS)) {
    reverseNS[URI] = name.toLowerCase()
  }
  return reverseNS
}
