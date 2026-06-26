/**
 * Browser detection.
 * @module browser
 * @license MIT
 *
 */

const NSSVG = 'http://www.w3.org/2000/svg'

/**
 * Browser capabilities and detection object.
 * Uses modern feature detection and lazy evaluation patterns.
 */
export class BrowserDetector {
  #userAgent: string = navigator.userAgent
  #cachedResults: Map<string, boolean> = new Map()

  /** Memoize a boolean capability check with a single Map lookup. */
  #memo (key: string, compute: () => boolean): boolean {
    let result = this.#cachedResults.get(key)
    if (result === undefined) {
      result = compute()
      this.#cachedResults.set(key, result)
    }
    return result
  }

  /**
   * Detects if the browser is Gecko-based
   */
  get isGecko (): boolean {
    return this.#memo('isGecko', () => this.#userAgent.includes('Gecko/'))
  }

  /**
   * Detects if the browser is Chrome
   */
  get isChrome (): boolean {
    return this.#memo('isChrome', () => this.#userAgent.includes('Chrome/'))
  }

  /**
   * Detects if the platform is macOS
   */
  get isMac (): boolean {
    return this.#memo('isMac', () => this.#userAgent.includes('Macintosh'))
  }

  /**
   * Tests if the browser supports accurate text character positioning
   */
  get supportsGoodTextCharPos (): boolean {
    return this.#memo('supportsGoodTextCharPos', () => this.#testTextCharPos())
  }

  /**
   * Private method to test text character positioning support
   */
  #testTextCharPos (): boolean {
    const svgroot = document.createElementNS(NSSVG, 'svg')
    const svgContent = document.createElementNS(NSSVG, 'svg')
    document.documentElement.append(svgroot)
    svgContent.setAttribute('x', '5')
    svgroot.append(svgContent)
    const text = document.createElementNS(NSSVG, 'text')
    text.textContent = 'a'
    svgContent.append(text)

    try {
      const pos = text.getStartPositionOfChar(0).x
      return pos === 0
    } catch {
      return false
    } finally {
      svgroot.remove()
    }
  }
}

// Create singleton instance
const browser: BrowserDetector = new BrowserDetector()

// Export as functions for backward compatibility
/**
 * Returns true if the current browser is Gecko-based (e.g., Firefox)
 * @function module:browser.isGecko
 */
export const isGecko = (): boolean => browser.isGecko

/**
 * Returns true if the current browser is Chrome-based
 * @function module:browser.isChrome
 */
export const isChrome = (): boolean => browser.isChrome

/**
 * Returns true if the current platform is macOS
 * @function module:browser.isMac
 */
export const isMac = (): boolean => browser.isMac

/**
 * Returns true if the browser accurately positions SVG text characters (used to gate workarounds)
 * @function module:browser.supportsGoodTextCharPos
 */
export const supportsGoodTextCharPos = (): boolean => browser.supportsGoodTextCharPos

// Export browser instance for direct access
export default browser
