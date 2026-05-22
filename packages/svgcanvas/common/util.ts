/**
 * Returns the cumulative offsetLeft/offsetTop of an element.
 * @param obj
 */
export const findPos = (obj: HTMLElement | null): { left: number; top: number } => {
  let left = 0
  let top = 0

  if (obj?.offsetParent) {
    let current: HTMLElement | null = obj
    do {
      left += current.offsetLeft
      top += current.offsetTop
      current = current.offsetParent as HTMLElement | null
    } while (current)
  }

  return { left, top }
}

export const isObject = (item: unknown): item is Record<string, unknown> =>
  item !== null && typeof item === 'object' && !Array.isArray(item)

export const mergeDeep = (
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> => {
  const output: Record<string, unknown> = { ...target }

  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      const sourceVal = source[key]
      if (isObject(sourceVal)) {
        const targetVal = target[key]
        output[key] = key in target && isObject(targetVal)
          ? mergeDeep(targetVal, sourceVal)
          : sourceVal
      } else {
        output[key] = sourceVal
      }
    }
  }

  return output
}

type ElementMatcher = (el: Element, sel: string) => boolean | undefined

/**
 * Get the closest matching element up the DOM tree.
 * Uses native Element.closest() when possible for better performance.
 * @param elem     Starting element
 * @param selector Selector to match against (class, ID, data attribute, or tag)
 * @return {Element|null}     Returns null if no match found
 */
export const getClosest = (elem: Element | null, selector: string): Element | null => {
  // Use native closest for standard CSS selectors
  if (elem?.closest) {
    try {
      return elem.closest(selector)
    } catch {
      // Fallback for invalid selectors
    }
  }

  // Fallback implementation for edge cases
  const selectorMatcher: Record<string, ElementMatcher> = {
    '.': (el, sel) => el.classList?.contains(sel.slice(1)),
    '#': (el, sel) => (el as HTMLElement).id === sel.slice(1),
    '[': (el, sel) => {
      const parts = sel.slice(1, -1).split('=').map((s: string) => s.replace(/["']/g, ''))
      const attr = parts[0] ?? ''
      const val = parts[1]
      return val ? el.getAttribute(attr) === val : el.hasAttribute(attr)
    },
    tag: (el, sel) => el.tagName?.toLowerCase() === sel
  }

  const firstChar = selector.charAt(0)
  const matcher: ElementMatcher = selectorMatcher[firstChar] ?? selectorMatcher['tag'] as ElementMatcher

  for (
    let current: Node | null = elem;
    current && current !== document && (current as Element).nodeType === 1;
    current = current.parentNode
  ) {
    if (matcher(current as Element, selector)) return current as Element
  }

  return null
}

/**
 * Get all DOM elements up the tree that match a selector
 * @param elem The base element
 * @param [selector] The class, id, data attribute, or tag to look for
 * @return {Node[] | null} Array of matching nodes or null if no match
 */
export const getParents = (elem: Node | null, selector?: string): Node[] | null => {
  const parents: Node[] = []
  const matchers: Record<string, ElementMatcher> = {
    '.': (el, sel) => el.classList?.contains(sel.slice(1)),
    '#': (el, sel) => (el as HTMLElement).id === sel.slice(1),
    '[': (el, sel) => el.hasAttribute(sel.slice(1, -1)),
    tag: (el, sel) => el.tagName?.toLowerCase() === sel
  }

  const firstChar = selector?.charAt(0)
  const matcher: ElementMatcher | null = selector
    ? (firstChar !== undefined && firstChar in matchers ? matchers[firstChar] : matchers['tag']) as ElementMatcher
    : null

  for (let current: Node | null = elem; current && current !== document; current = current.parentNode) {
    if (!selector || matcher?.(current as Element, selector)) {
      parents.push(current)
    }
  }

  return parents.length > 0 ? parents : null
}

export const getParentsUntil = (
  elem: Node | null,
  parent?: string,
  selector?: string
): Node[] | null => {
  const parents: Node[] = []

  const matchers: Record<string, ElementMatcher> = {
    '.': (el, sel) => el.classList?.contains(sel.slice(1)),
    '#': (el, sel) => (el as HTMLElement).id === sel.slice(1),
    '[': (el, sel) => el.hasAttribute(sel.slice(1, -1)),
    tag: (el, sel) => el.tagName?.toLowerCase() === sel
  }

  const getMatcherFn = (selectorStr: string | undefined): ElementMatcher | null => {
    if (!selectorStr) return null
    const firstChar = selectorStr.charAt(0)
    return (firstChar in matchers ? matchers[firstChar] : matchers['tag']) as ElementMatcher
  }

  const parentMatcher = getMatcherFn(parent)
  const selectorMatcher = getMatcherFn(selector)

  for (let current: Node | null = elem; current && current !== document; current = current.parentNode) {
    // Check if we've reached the parent boundary
    if (parent && parentMatcher?.(current as Element, parent)) {
      break
    }

    // Add to results if matches selector (or no selector specified)
    if (!selector || selectorMatcher?.(current as Element, selector)) {
      parents.push(current)
    }
  }

  return parents.length > 0 ? parents : null
}
