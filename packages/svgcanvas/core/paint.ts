/** Options accepted by the Paint constructor. */
interface PaintOptions {
  alpha?: unknown
  copy?: Paint
  linearGradient?: SVGLinearGradientElement | null
  radialGradient?: SVGRadialGradientElement | null
  solidColor?: unknown
}

/**
 *
 */
export default class Paint {
  /**
   * @type {"none"|"solidColor"|"linearGradient"|"radialGradient"}
   */
  type: 'none' | 'solidColor' | 'linearGradient' | 'radialGradient'
  /**
   * Represents opacity (0-100).
   */
  alpha: number
  /**
   * Represents RRGGBB hex of color (without leading '#'), or null.
   */
  solidColor: string | null
  /**
   * @type {SVGLinearGradientElement | null}
   */
  linearGradient: SVGLinearGradientElement | null
  /**
   * @type {SVGRadialGradientElement | null}
   */
  radialGradient: SVGRadialGradientElement | null

  static #normalizeAlpha (alpha: unknown): number {
    const numeric = Number(alpha)
    if (!Number.isFinite(numeric)) return 100
    return Math.min(100, Math.max(0, numeric))
  }

  static #normalizeSolidColor (color: unknown): string | null {
    if (color === null || color === undefined) return null
    if (typeof color !== 'string' && typeof color !== 'number') return null
    const str = String(color).trim()
    if (!str) return null
    if (str === 'none') return 'none'
    return str.startsWith('#') ? str.slice(1) : str
  }

  static #extractHrefId (hrefAttr: string | null): string | null {
    if (!hrefAttr) return null
    const href = String(hrefAttr).trim()
    if (!href) return null
    if (href.startsWith('#')) return href.slice(1)
    const urlMatch = href.match(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/)
    if (urlMatch?.[1]) return urlMatch[1]
    const hashIndex = href.lastIndexOf('#')
    if (hashIndex >= 0 && hashIndex < href.length - 1) {
      return href.slice(hashIndex + 1)
    }
    return null
  }

  static #resolveGradient (gradient: Element | null | undefined): SVGLinearGradientElement | SVGRadialGradientElement | null {
    if (!gradient?.cloneNode) return null
    const doc = (gradient as Element & { ownerDocument?: Document }).ownerDocument ?? document
    const visited = new Set<string>()
    const clone = gradient.cloneNode(true) as Element

    let refId = Paint.#extractHrefId(
      clone.getAttribute('href') ?? clone.getAttribute('xlink:href')
    )

    while (refId && !visited.has(refId)) {
      visited.add(refId)

      const referenced = doc.getElementById(refId)
      if (!referenced?.getAttribute) break

      const cloneTag = String(clone.tagName ?? '').toLowerCase()
      const referencedTag = String(referenced.tagName ?? '').toLowerCase()
      if (
        !(['lineargradient', 'radialgradient'] as string[]).includes(referencedTag) ||
        referencedTag !== cloneTag
      ) {
        break
      }

      // Copy missing attributes from referenced gradient (matches SVG href inheritance).
      for (const attr of Array.from(referenced.attributes)) {
        const name = attr.name
        if (name === 'id' || name === 'href' || name === 'xlink:href') continue
        const current = clone.getAttribute(name)
        if (current === null || current === '') {
          clone.setAttribute(name, attr.value)
        }
      }

      // If the referencing gradient has no stops, inherit stops from the referenced gradient.
      if (clone.querySelectorAll('stop').length === 0) {
        for (const stop of Array.from(referenced.querySelectorAll('stop'))) {
          clone.append(stop.cloneNode(true))
        }
      }

      // Prepare to continue resolving deeper links if present.
      refId = Paint.#extractHrefId(
        referenced.getAttribute('href') ?? referenced.getAttribute('xlink:href')
      )
    }

    // The clone is now self-contained; remove any href.
    clone.removeAttribute('href')
    clone.removeAttribute('xlink:href')

    return clone as SVGLinearGradientElement | SVGRadialGradientElement
  }

  /**
   * @param {PaintOptions} [opt]
   */
  constructor (opt?: PaintOptions) {
    const options = opt ?? {}
    // Initialise all fields; branches below will overwrite as appropriate.
    this.type = 'none'
    this.solidColor = null
    this.linearGradient = null
    this.radialGradient = null
    this.alpha = Paint.#normalizeAlpha(options.alpha)

    // copy paint object
    if (options.copy) {
      this.type = options.copy.type
      this.alpha = Paint.#normalizeAlpha(options.copy.alpha)
      this.solidColor = null
      this.linearGradient = null
      this.radialGradient = null

      switch (this.type) {
        case 'none':
          break
        case 'solidColor':
          this.solidColor = Paint.#normalizeSolidColor(options.copy.solidColor)
          break
        case 'linearGradient':
          this.linearGradient = options.copy.linearGradient?.cloneNode
            ? (options.copy.linearGradient.cloneNode(true) as SVGLinearGradientElement)
            : null
          break
        case 'radialGradient':
          this.radialGradient = options.copy.radialGradient?.cloneNode
            ? (options.copy.radialGradient.cloneNode(true) as SVGRadialGradientElement)
            : null
          break
      }
      // create linear gradient paint
    } else if (options.linearGradient) {
      this.type = 'linearGradient'
      this.solidColor = null
      this.radialGradient = null
      this.linearGradient = Paint.#resolveGradient(options.linearGradient) as SVGLinearGradientElement | null
      // create radial gradient paint
    } else if (options.radialGradient) {
      this.type = 'radialGradient'
      this.solidColor = null
      this.linearGradient = null
      this.radialGradient = Paint.#resolveGradient(options.radialGradient) as SVGRadialGradientElement | null
      // create solid color paint
    } else if (options.solidColor) {
      this.type = 'solidColor'
      this.solidColor = Paint.#normalizeSolidColor(options.solidColor)
      // create empty paint — fields already initialised above
    }
  }
}
