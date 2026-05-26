/**
 * @file jPickerShim — transitional bridge between jGraduate's internal
 * jPickerMethod calls and the new se-color-picker Lit component.
 *
 * Exports the same `jPickerDefaults` and `jPickerMethod` API surface that
 * jQuery.jPicker.ts exported, but delegates rendering to se-color-picker.
 * Will be deleted in PR-4b when jGraduate itself is rewritten.
 *
 * @module jPickerShim
 */

// Side-effect import — registers the <se-color-picker> custom element
import './se-color-picker.js'
import type { ColorModel } from './ColorModel.js'

// ---------------------------------------------------------------------------
// jPickerDefaults — same shape as the original for external consumers
// ---------------------------------------------------------------------------

export const jPickerDefaults = {
  window: {
    title: null as string | null,
    effects: {
      type: 'slide',
      speed: { show: 'slow', hide: 'fast' }
    },
    position: { x: 'screenCenter', y: 'top' },
    expandable: false,
    liveUpdate: true,
    alphaSupport: false,
    alphaPrecision: 0,
    updateInputColor: true
  },
  color: {
    mode: 'h',
    active: 'ff0000ff'
  },
  images: {
    clientPath: '/images/jgraduate/images/'
  }
}

// ---------------------------------------------------------------------------
// Compatibility proxy — wraps ColorModel in the .val(name) API jGraduate expects
// ---------------------------------------------------------------------------

/**
 * Build a proxy object with a `.val(name)` method matching the old jPicker Color
 * interface that jGraduate consumes.
 *
 * @param model - The ColorModel from se-color-picker's event detail
 * @returns Object with a `val(name)` method
 */
/** Proxy returned to jGraduate callbacks — mirrors the old jPicker Color .val() API. */
interface ValProxy {
  val: (name: string) => unknown
}

function buildValProxy (model: ColorModel): ValProxy {
  return {
    val (name: string): unknown {
      switch (name) {
        case 'hex': return model.hex
        case 'ahex': return model.ahex
        case 'a': return model.a
        case 'r': return model.r
        case 'g': return model.g
        case 'b': return model.b
        case 'h': return model.h
        case 's': return model.s
        case 'v': return model.v
        case 'all':
          return {
            r: model.r,
            g: model.g,
            b: model.b,
            a: model.a,
            h: model.h,
            s: model.s,
            v: model.v,
            hex: model.hex,
            ahex: model.ahex
          }
        default:
          return null
      }
    }
  }
}

// ---------------------------------------------------------------------------
// jPickerMethod — drop-in replacement for the original
// ---------------------------------------------------------------------------

/**
 * Instantiate an se-color-picker inside `elem`, wire callbacks.
 *
 * @param elem - The container element (will be cleared and shown)
 * @param options - Options object with color.active, window.alphaSupport, etc.
 * @param commitCallback - Called with a val-proxy when user clicks OK
 * @param liveCallback - Called with a val-proxy on every live color change
 * @param cancelCallback - Called when user clicks Cancel
 * @param _i18next - Unused, kept for signature compat
 */
/** Shape of the options object passed by jGraduate to jPickerMethod. */
interface JPickerOptions {
  color?: {
    active?: string | { val?: (name: string) => string; ahex?: string }
    alphaSupport?: boolean
  }
  window?: { alphaSupport?: boolean }
}

export function jPickerMethod (
  elem: HTMLElement,
  options: JPickerOptions | undefined,
  commitCallback: ((proxy: ValProxy) => void) | null,
  liveCallback: ((proxy: ValProxy) => void) | null,
  cancelCallback: (() => void) | null,
  _i18next?: unknown
): void {
  // Resolve the initial color string (8-char ahex expected)
  let initColor = 'ff0000ff'
  if (options?.color?.active) {
    const active = options.color.active
    if (typeof active === 'string') {
      // Strip leading # if present, normalise to 8-char
      let hex = active.replace(/^#/, '').toLowerCase()
      if (hex.length === 6) hex += 'ff'
      initColor = hex
    } else if (typeof active === 'object' && active !== null && typeof active.val === 'function') {
      // Legacy jPicker Color object with .val('ahex')
      initColor = active.val('ahex') || 'ff0000ff'
    } else if (typeof active?.ahex === 'string') {
      initColor = active.ahex
    }
  }

  const alphaSupport = options?.color?.alphaSupport ?? options?.window?.alphaSupport ?? true

  // Create and configure the se-color-picker element
  const picker = document.createElement('se-color-picker')
  picker.setAttribute('color', initColor)
  picker.setAttribute('alpha-support', String(alphaSupport))

  // Clear container content, append picker, show container
  elem.textContent = ''
  elem.appendChild(picker)
  elem.style.display = 'block'

  // Helper: hide container on commit/cancel
  const hide = (): void => {
    elem.style.display = 'none'
  }

  // Wire event listeners
  picker.addEventListener('commit', (e: Event) => {
    const detail = (e as CustomEvent<{ color: ColorModel }>).detail
    const proxy = buildValProxy(detail.color)
    hide()
    if (commitCallback) {
      commitCallback(proxy)
    }
  })

  picker.addEventListener('cancel', () => {
    hide()
    if (cancelCallback) {
      cancelCallback()
    }
  })

  if (liveCallback) {
    picker.addEventListener('live', (e: Event) => {
      const detail = (e as CustomEvent<{ color: ColorModel }>).detail
      const proxy = buildValProxy(detail.color)
      liveCallback(proxy)
    })
  }
}
