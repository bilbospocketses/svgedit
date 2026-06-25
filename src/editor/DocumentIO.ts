/**
 * Document I/O for the SVG editor: load an SVG from a string, URL, or data URI,
 * and confirm-before-discard. Extracted from `Editor` as the first step of the
 * #108 god-object decomposition; `Editor` keeps thin public delegators
 * (`loadSvgString` / `loadFromString` / `loadFromURL` / `loadFromDataURI` /
 * `openPrep`) so extensions and the embed/config callers are unaffected.
 *
 * `seAlert` / `seConfirm` are ambient globals (see `global-dialogs.d.ts`).
 * @license MIT
 */
import SvgCanvas from '@svgedit/svgcanvas'
import type { ISvgCanvas } from '@svgedit/svgcanvas'
import { isSameOriginHttpUrl } from '@svgedit/svgcanvas/core/url-policy.js'

const { decode64 } = SvgCanvas

/** The slice of `Editor` that DocumentIO depends on. */
export interface DocumentIOHost {
  svgCanvas: ISvgCanvas
  i18next: { t: (key: string, vars?: Record<string, unknown>) => string }
  updateCanvas (center?: boolean, newCtr?: { x: number; y: number }): void
  ready (cb: () => unknown): Promise<unknown>
}

/** Loads SVG documents into the canvas and guards unsaved work before opening. */
export class DocumentIO {
  #host: DocumentIOHost

  constructor (host: DocumentIOHost) {
    this.#host = host
  }

  /**
   * Load an SVG string into the canvas immediately (no readiness wait).
   * @throws {Error} Upon failure to load SVG
   */
  loadSvgString (str: string, { noAlert }: { noAlert?: boolean | undefined } = {}): void {
    const host = this.#host
    const success = host.svgCanvas.setSvgString(str) !== false
    if (success) {
      host.updateCanvas(false, undefined)
      return
    }
    if (!noAlert) seAlert(host.i18next.t('notification.errorLoadingSVG'))
    throw new Error('Error loading SVG')
  }

  /** Confirm discarding unsaved changes before opening a new document. */
  async openPrep (): Promise<boolean | string> {
    const host = this.#host
    if (host.svgCanvas.undoMgr.getUndoStackSize() === 0) {
      return true
    }
    return await seConfirm(host.i18next.t('notification.QwantToOpen'))
  }

  /** Load an SVG string, waiting until the editor is ready before applying it. */
  loadFromString (str: string, { noAlert }: { noAlert?: boolean | undefined } = {}): Promise<unknown> {
    return this.#host.ready(() => {
      try {
        this.loadSvgString(str, { noAlert })
      } catch (err) {
        if (noAlert) {
          throw err
        }
      }
    })
  }

  /** Fetch an SVG from a same-origin URL and load it, waiting for readiness. */
  loadFromURL (url: string, { cache, noAlert }: { cache?: boolean | undefined; noAlert?: boolean | undefined } = {}): Promise<unknown> {
    const host = this.#host
    return host.ready(() => {
      return new Promise<void>((resolve, reject) => {
        if (!isSameOriginHttpUrl(url)) {
          if (noAlert) {
            reject(new Error('URLLoadFail'))
            return
          }
          seAlert(host.i18next.t('notification.URLLoadFail'))
          resolve()
          return
        }
        fetch(url, { cache: cache ? 'force-cache' : 'no-cache' })
          .then((response) => {
            if (!response.ok) {
              if (noAlert) {
                reject(new Error('URLLoadFail'))
                return
              }
              seAlert(host.i18next.t('notification.URLLoadFail'))
              resolve()
            }
            return response.text()
          })
          .then((str) => {
            this.loadSvgString(str as string, { noAlert })
            resolve()
          })
          .catch((error) => {
            if (noAlert) {
              reject(new Error('URLLoadFail'))
              return
            }
            seAlert(
              host.i18next.t('notification.URLLoadFail') + ': \n' + error
            )
            resolve()
          })
      })
    })
  }

  /** Decode a data URI (base64 or percent-encoded) and load the resulting SVG. */
  loadFromDataURI (str: string, { noAlert }: { noAlert?: boolean | undefined } = {}): Promise<unknown> {
    return this.#host.ready(() => {
      let base64 = false
      let preMatch = str.match(/^data:image\/svg\+xml;base64,/)
      if (preMatch) {
        base64 = true
      } else {
        preMatch = str.match(/^data:image\/svg\+xml(?:;|;utf8)?,/)
      }
      const pre = preMatch ? preMatch[0] : null
      const src = str.slice((pre ?? '').length)
      return this.loadSvgString(
        base64 ? decode64(src) : decodeURIComponent(src),
        { noAlert }
      )
    })
  }
}
