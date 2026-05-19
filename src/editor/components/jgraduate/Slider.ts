/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// jGraduate (legacy jQuery plugin) ships as 'any'; cleanup deferred to #3 (Lit migration)
import { findPos } from '@svgedit/svgcanvas/common/util.js'

/** Callback registered via `bind()`. Receives the slider instance twice (self, context). */
type SliderCallback = (self: Slider, context: Slider) => void

/** Value object passed to/returned from `val()`. */
interface SliderXY {
  x?: number
  y?: number
}

/** Range bounds object passed to/returned from `range()`. */
interface SliderRange {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

interface SliderBar extends HTMLElement {
  w: number
  h: number
}

interface SliderArrow extends HTMLImageElement {
  w: number
  h: number
}

interface SliderOptions {
  arrow?: { image?: string; width?: number; height?: number }
  map?: { width?: number; height?: number }
}

/**
 * Whether a value is `null` or `undefined`.
 * @param {any} val
 * @returns {boolean}
 */
const isNullish = (val: unknown): val is null | undefined => {
  return val === null || val === undefined
}
/**
 * Encapsulate slider functionality for the ColorMap and ColorBar -
 * could be useful to use a jQuery UI draggable for this with certain extensions.
 * @memberof module:jPicker
 */
export default class Slider {
  /**
   * @param {external:jQuery} bar
   * @param {module:jPicker.SliderOptions} options
   */
  constructor (bar: SliderBar, options: SliderOptions) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    /**
     * Fire events on the supplied `context`
     * @param {module:jPicker.JPickerInit} context
     * @returns {void}
     */
    function fireChangeEvents (context: Slider): void {
      changeEvents.forEach((changeEvent) => {
        changeEvent.call(that, that, context)
      })
    }

    /**
     * Bind the mousedown to the bar not the arrow for quick snapping to the clicked location.
     * @param {external:jQuery.Event} e
     * @returns {void}
     */
    function mouseDown (e: MouseEvent): void {
      const off = findPos(bar)
      offset = { l: off.left | 0, t: off.top | 0 }
      clearTimeout(timeout)
      // using setTimeout for visual updates - once the style is updated the browser will re-render internally allowing the next Javascript to run
      timeout = setTimeout(function () {
        setValuesFromMousePosition.call(that, e)
      }, 0)
      // Bind mousemove and mouseup event to the document so it responds when dragged of of the bar - we will unbind these when on mouseup to save processing
      document.addEventListener('mousemove', mouseMove)
      document.addEventListener('mouseup', mouseUp)
      e.preventDefault() // don't try to select anything or drag the image to the desktop
    }
    /**
     * Set the values as the mouse moves.
     * @param {external:jQuery.Event} e
     * @returns {false}
     */
    function mouseMove (e: MouseEvent): false {
      clearTimeout(timeout)
      timeout = setTimeout(function () {
        setValuesFromMousePosition.call(that, e)
      }, 0)
      e.stopPropagation()
      e.preventDefault()
      return false
    }
    /**
     * Unbind the document events - they aren't needed when not dragging.
     * @param {external:jQuery.Event} e
     * @returns {false}
     */
    function mouseUp (e: MouseEvent): false {
      document.removeEventListener('mousemove', mouseMove)
      document.removeEventListener('mouseup', mouseUp)
      e.stopPropagation()
      e.preventDefault()
      return false
    }

    /**
     * Calculate mouse position and set value within the current range.
     * @param {Event} e
     * @returns {void}
     */
    function setValuesFromMousePosition (e: MouseEvent): void {
      const barW = bar.w // local copies for YUI compressor
      const barH = bar.h
      let locX = e.pageX - (offset?.l ?? 0)
      let locY = e.pageY - (offset?.t ?? 0)
      // keep the arrow within the bounds of the bar
      if (locX < 0) locX = 0
      else if (locX > barW) locX = barW
      if (locY < 0) locY = 0
      else if (locY > barH) locY = barH
      val.call(that, 'xy', {
        x: ((locX / barW) * rangeX) + minX,
        y: ((locY / barH) * rangeY) + minY
      })
    }
    /**
     *
     * @returns {void}
     */
    function draw () {
      const
        barW = bar.w
      const barH = bar.h
      const arrowW = arrow.w
      const arrowH = arrow.h
      let arrowOffsetX = 0
      let arrowOffsetY = 0
      setTimeout(function () {
        if (rangeX > 0) { // range is greater than zero
          // constrain to bounds
          if (x === maxX) arrowOffsetX = barW
          else arrowOffsetX = ((x / rangeX) * barW) | 0
        }
        if (rangeY > 0) { // range is greater than zero
          // constrain to bounds
          if (y === maxY) arrowOffsetY = barH
          else arrowOffsetY = ((y / rangeY) * barH) | 0
        }
        // if arrow width is greater than bar width, center arrow and prevent horizontal dragging
        if (arrowW >= barW) arrowOffsetX = (barW >> 1) - (arrowW >> 1) // number >> 1 - superfast bitwise divide by two and truncate (move bits over one bit discarding lowest)
        else arrowOffsetX -= arrowW >> 1
        // if arrow height is greater than bar height, center arrow and prevent vertical dragging
        if (arrowH >= barH) arrowOffsetY = (barH >> 1) - (arrowH >> 1)
        else arrowOffsetY -= arrowH >> 1
        // set the arrow position based on these offsets
        arrow.style.left = arrowOffsetX + 'px'
        arrow.style.top = arrowOffsetY + 'px'
      })
    }

    /**
     * Get or set a value.
     * @param {?("xy"|"x"|"y")} name
     * @param {module:math.XYObject} value
     * @param {module:jPicker.Slider} context
     * @returns {module:math.XYObject|Float|void}
     */
    function val (name: string | null | undefined, value?: SliderXY | number, context?: Slider): SliderXY | number | undefined {
      const set = value !== undefined
      if (!set) {
        const n = isNullish(name) ? 'xy' : name
        switch (n.toLowerCase()) {
          case 'x': return x
          case 'y': return y
          case 'xy':
          default: return { x, y }
        }
      }
      if (!isNullish(context) && context === that) return undefined
      let changed = false

      let newX: number | undefined; let newY: number | undefined
      const ns = isNullish(name) ? 'xy' : name
      const v = value as SliderXY | number | undefined
      switch (ns.toLowerCase()) {
        case 'x':
          newX = (v && (typeof v === 'number' ? v : (v.x ?? 0)) | 0) || 0
          break
        case 'y':
          newY = (v && (typeof v === 'number' ? v : (v.y ?? 0)) | 0) || 0
          break
        case 'xy':
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- cast required to access .x/.y when v is unknown
          const vobj = (typeof v === 'object' ? v : {}) as SliderXY
          newX = ((vobj.x ?? 0) | 0) || 0
          newY = ((vobj.y ?? 0) | 0) || 0
          break
        }
      }
      if (!isNullish(newX)) {
        if (newX < minX) newX = minX
        else if (newX > maxX) newX = maxX
        if (x !== newX) {
          x = newX
          changed = true
        }
      }
      if (!isNullish(newY)) {
        if (newY < minY) newY = minY
        else if (newY > maxY) newY = maxY
        if (y !== newY) {
          y = newY
          changed = true
        }
      }
      if (changed) { fireChangeEvents.call(that, context ?? that) }
      return undefined
    }

    /**
    * @typedef {PlainObject} module:jPicker.MinMaxRangeX
    * @property {Float} minX
    * @property {Float} maxX
    * @property {Float} rangeX
    */
    /**
    * @typedef {PlainObject} module:jPicker.MinMaxRangeY
    * @property {Float} minY
    * @property {Float} maxY
    * @property {Float} rangeY
    */
    /**
    * @typedef {module:jPicker.MinMaxRangeY|module:jPicker.MinMaxRangeX} module:jPicker.MinMaxRangeXY
    */

    /**
     *
     * @param {"minx"|"maxx"|"rangex"|"miny"|"maxy"|"rangey"|"all"} name
     * @param {module:jPicker.MinMaxRangeXY} value
     * @returns {module:jPicker.MinMaxRangeXY|module:jPicker.MinMaxRangeX|module:jPicker.MinMaxRangeY|void}
     */
    function range (name: string | null | undefined, value?: SliderRange | number): SliderRange | number | undefined {
      const set = value !== undefined
      if (!set) {
        const n = isNullish(name) ? 'all' : name
        switch (n.toLowerCase()) {
          case 'minx': return minX
          case 'maxx': return maxX
          case 'rangex': return { minX, maxX }
          case 'miny': return minY
          case 'maxy': return maxY
          case 'rangey': return { minY, maxY }
          case 'all':
          default: return { minX, maxX, minY, maxY }
        }
      }
      let newMinX: number | undefined
      let newMaxX: number | undefined
      let newMinY: number | undefined
      let newMaxY: number | undefined
      const ns = isNullish(name) ? 'all' : name
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- cast required to access .minX/.maxX/.minY/.maxY when value is unknown
      const rv = (typeof value === 'object' ? value : {}) as SliderRange
      const rnum = typeof value === 'number' ? value : 0
      switch (ns.toLowerCase()) {
        case 'minx':
          newMinX = (typeof value === 'number' ? rnum : (rv.minX ?? 0)) | 0
          break
        case 'maxx':
          newMaxX = (typeof value === 'number' ? rnum : (rv.maxX ?? 0)) | 0
          break
        case 'rangex':
          newMinX = (rv.minX ?? 0) | 0
          newMaxX = (rv.maxX ?? 0) | 0
          break
        case 'miny':
          newMinY = (typeof value === 'number' ? rnum : (rv.minY ?? 0)) | 0
          break
        case 'maxy':
          newMaxY = (typeof value === 'number' ? rnum : (rv.maxY ?? 0)) | 0
          break
        case 'rangey':
          newMinY = (rv.minY ?? 0) | 0
          newMaxY = (rv.maxY ?? 0) | 0
          break
        case 'all':
        default:
          newMinX = (rv.minX ?? 0) | 0
          newMaxX = (rv.maxX ?? 0) | 0
          newMinY = (rv.minY ?? 0) | 0
          newMaxY = (rv.maxY ?? 0) | 0
          break
      }

      if (!isNullish(newMinX) && minX !== newMinX) {
        minX = newMinX
        rangeX = maxX - minX
      }
      if (!isNullish(newMaxX) && maxX !== newMaxX) {
        maxX = newMaxX
        rangeX = maxX - minX
      }
      if (!isNullish(newMinY) && minY !== newMinY) {
        minY = newMinY
        rangeY = maxY - minY
      }
      if (!isNullish(newMaxY) && maxY !== newMaxY) {
        maxY = newMaxY
        rangeY = maxY - minY
      }
      return undefined
    }
    /**
    * @param {GenericCallback} callback
    * @returns {void}
    */
    function bind (callback: SliderCallback): void {
      if (typeof callback === 'function') changeEvents.push(callback)
    }
    /**
    * @param {GenericCallback} callback
    * @returns {void}
    */
    function unbind (callback: SliderCallback): void {
      if (typeof callback !== 'function') return
      let idx: number
      while ((idx = changeEvents.indexOf(callback)) !== -1) changeEvents.splice(idx, 1)
    }
    /**
    *
    * @returns {void}
    */
    function destroy (): void {
      // unbind all possible events and null objects
      document.removeEventListener('mousemove', mouseMove)
      document.removeEventListener('mouseup', mouseUp)
      bar.removeEventListener('mousedown', mouseDown)
      // destroy: allow GC by severing closures (pre-existing pattern)
      // @ts-expect-error: pre-existing null-assignment for GC, see todo #10
      bar = null
      // @ts-expect-error: pre-existing null-assignment for GC, see todo #10
      arrow = null
      // @ts-expect-error: pre-existing null-assignment for GC, see todo #10
      changeEvents = null
    }
    let offset: { l: number; t: number } | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    let x = 0
    let y = 0
    let minX = 0
    let maxX = 100
    let rangeX = 100
    let minY = 0
    let maxY = 100
    let rangeY = 100
    let arrow: SliderArrow = bar.querySelector('img') as SliderArrow // the arrow image to drag
    let changeEvents: SliderCallback[] = []
    Object.assign(that, {
      val,
      range,
      bind,
      unbind,
      destroy
    })
    // initialize this control
    arrow.src = (options.arrow?.image) ?? ''
    arrow.w = (options.arrow && options.arrow.width) || parseFloat(getComputedStyle(arrow, null).width.replace('px', ''))
    arrow.h = (options.arrow && options.arrow.height) || parseFloat(getComputedStyle(arrow, null).height.replace('px', ''))
    bar.w = (options.map && options.map.width) || parseFloat(getComputedStyle(bar, null).width.replace('px', ''))
    bar.h = (options.map && options.map.height) || parseFloat(getComputedStyle(bar, null).height.replace('px', ''))
    bar.addEventListener('mousedown', mouseDown)
    bind.call(that, draw)
  }
}
