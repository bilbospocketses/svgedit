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

  /**
   * Detects if the browser is Gecko-based
   */
  get isGecko (): boolean {
    if (!this.#cachedResults.has('isGecko')) {
      this.#cachedResults.set('isGecko', this.#userAgent.includes('Gecko/'))
    }
    return this.#cachedResults.get('isGecko') ?? false
  }

  /**
   * Detects if the browser is Chrome
   */
  get isChrome (): boolean {
    if (!this.#cachedResults.has('isChrome')) {
      this.#cachedResults.set('isChrome', this.#userAgent.includes('Chrome/'))
    }
    return this.#cachedResults.get('isChrome') ?? false
  }

  /**
   * Detects if the platform is macOS
   */
  get isMac (): boolean {
    if (!this.#cachedResults.has('isMac')) {
      this.#cachedResults.set('isMac', this.#userAgent.includes('Macintosh'))
    }
    return this.#cachedResults.get('isMac') ?? false
  }

  /**
   * Tests if the browser supports accurate text character positioning
   */
  get supportsGoodTextCharPos (): boolean {
    if (!this.#cachedResults.has('supportsGoodTextCharPos')) {
      this.#cachedResults.set('supportsGoodTextCharPos', this.#testTextCharPos())
    }
    return this.#cachedResults.get('supportsGoodTextCharPos') ?? false
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
 * @function module:browser.isGecko
 */
export const isGecko = (): boolean => browser.isGecko

/**
 * @function module:browser.isChrome
 */
export const isChrome = (): boolean => browser.isChrome

/**
 * @function module:browser.isMac
 */
export const isMac = (): boolean => browser.isMac

/**
 * @function module:browser.supportsGoodTextCharPos
 */
export const supportsGoodTextCharPos = (): boolean => browser.supportsGoodTextCharPos

// Export browser instance for direct access
export default browser
