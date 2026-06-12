export type InlineTag = 'strong' | 'em' | 'u' | 's'
export type BlockTag = 'p' | 'h1' | 'h2' | 'h3'
export type Align = 'left' | 'center' | 'right'
export type FontPreset = 'S' | 'M' | 'L' | 'XL'

const FONT_PX: Record<Exclude<FontPreset, 'M'>, string> = { S: '12px', L: '24px', XL: '36px' }

// createElement must only ever receive a LITERAL tag name. These switch helpers map the
// DOM-sourced (toolbar <select>) tag back onto a constant so no tainted string flows into
// document.createElement — the values are already allowlisted, but this keeps the sink clean.
const createBlockEl = (tag: BlockTag): HTMLElement => {
  switch (tag) {
    case 'h1': return document.createElement('h1')
    case 'h2': return document.createElement('h2')
    case 'h3': return document.createElement('h3')
    default: return document.createElement('p')
  }
}

const createInlineEl = (tag: InlineTag): HTMLElement => {
  switch (tag) {
    case 'em': return document.createElement('em')
    case 'u': return document.createElement('u')
    case 's': return document.createElement('s')
    default: return document.createElement('strong')
  }
}

const activeRange = (root: Element): Range | null => {
  const sel = (root.ownerDocument.defaultView ?? window).getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const r = sel.getRangeAt(0)
  return root.contains(r.commonAncestorContainer) ? r : null
}

const wrap = (root: Element, el: HTMLElement): void => {
  const r = activeRange(root); if (!r) return
  el.appendChild(r.extractContents()); r.insertNode(el)
  const sel = (root.ownerDocument.defaultView ?? window).getSelection()
  if (!sel) return
  sel.removeAllRanges()
  const nr = document.createRange(); nr.selectNodeContents(el); sel.addRange(nr)
}

const blocksInRange = (root: Element): HTMLElement[] => {
  const r = activeRange(root); if (!r) return []
  const blocks = new Set<HTMLElement>()
  const isBlock = (n: Node): n is HTMLElement =>
    n.nodeType === 1 && /^(p|h1|h2|h3|h4|h5|h6|li|pre|blockquote)$/.test((n as Element).localName)
  let node: Node | null = r.startContainer
  while (node && node !== root) { if (isBlock(node)) { blocks.add(node); break } node = node.parentNode }
  root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote').forEach((b) => {
    if (r.intersectsNode(b)) blocks.add(b as HTMLElement)
  })
  return [...blocks]
}

export const toggleInline = (root: Element, tag: InlineTag): void => {
  const r = activeRange(root); if (!r) return
  const existing = r.commonAncestorContainer.parentElement?.closest(tag)
  if (existing && root.contains(existing)) {
    const parent = existing.parentNode
    if (parent) { while (existing.firstChild) parent.insertBefore(existing.firstChild, existing); existing.remove() }
    return
  }
  wrap(root, createInlineEl(tag))
}

/**
 * Replace a list item with a block element, lifting it OUT of its list.
 *
 * `block` (created + styled by the caller) receives the item's children and is placed
 * immediately after the item's list; any siblings that followed the item are moved into
 * a fresh list of the same kind after `block` (a split), so the list is never left with
 * a non-`li` block as a child. The original list is removed if the lift empties it.
 * Processing a run of items in turn coalesces — each lifted item carries its trailing
 * siblings into the tail list the next call operates on.
 */
const liftItem = (li: HTMLElement, block: HTMLElement): void => {
  const list = li.parentElement
  if (!list) return
  while (li.firstChild) block.appendChild(li.firstChild)
  const after: ChildNode[] = []
  for (let n = li.nextSibling; n; n = n.nextSibling) after.push(n)
  list.after(block)
  if (after.length) {
    // Literal createElement — `list.localName` is a read, never a tainted sink arg.
    const tail = list.localName === 'ol' ? document.createElement('ol') : document.createElement('ul')
    const style = list.getAttribute('style')
    if (style) tail.setAttribute('style', style)
    for (const node of after) tail.appendChild(node)
    block.after(tail)
  }
  li.remove()
  if (!list.children.length) list.remove()
}

export const setBlock = (root: Element, tag: BlockTag): void => {
  for (const block of blocksInRange(root)) {
    const repl = createBlockEl(tag)
    const style = block.getAttribute('style')
    if (style) repl.setAttribute('style', style)
    if (block.localName === 'li') {
      liftItem(block, repl)
    } else {
      while (block.firstChild) repl.appendChild(block.firstChild)
      block.replaceWith(repl)
    }
  }
}

export const toggleList = (root: Element, kind: 'ul' | 'ol'): void => {
  const blocks = blocksInRange(root)
  const first = blocks[0]
  if (!first) return
  // Literal createElement — no DOM-sourced `kind` string flows into the sink.
  const list = kind === 'ol' ? document.createElement('ol') : document.createElement('ul')
  first.replaceWith(list)
  for (const b of blocks) {
    const li = document.createElement('li')
    while (b.firstChild) li.appendChild(b.firstChild)
    list.appendChild(li)
    if (b.parentNode) b.remove()
  }
}

export const insertLink = (root: Element, url: string): void => {
  const a = document.createElement('a')
  a.setAttribute('href', url)
  a.setAttribute('target', '_blank')
  a.setAttribute('rel', 'noopener noreferrer')
  wrap(root, a)
}

const setStyleProp = (root: Element, prop: string, value: string | null): void => {
  if (value === null) {
    // Remove: find the nearest ancestor span carrying this prop and unwrap it.
    const r = activeRange(root); if (!r) return
    const anchor = r.commonAncestorContainer
    const anchorEl: Element | null = anchor.nodeType === 1 ? (anchor as Element) : anchor.parentElement
    const el: HTMLElement | null = anchorEl?.closest<HTMLElement>('span') ?? null
    if (el && root.contains(el) && el.style.getPropertyValue(prop)) {
      const parent = el.parentNode
      if (parent) { while (el.firstChild) parent.insertBefore(el.firstChild, el); el.remove() }
    }
    return
  }
  const span = document.createElement('span')
  span.style.setProperty(prop, value)
  wrap(root, span)
}

export const setColor = (root: Element, cssColor: string): void => setStyleProp(root, 'color', cssColor)

export const setFontSize = (root: Element, preset: FontPreset): void =>
  setStyleProp(root, 'font-size', preset === 'M' ? null : FONT_PX[preset])

export const setAlign = (root: Element, value: Align): void => {
  for (const block of blocksInRange(root)) block.style.setProperty('text-align', value)
}

export const clearFormatting = (root: Element): void => {
  const r = activeRange(root); if (!r) return
  const text = r.toString()
  r.deleteContents(); r.insertNode(document.createTextNode(text))
}
