/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
// svgCanvas is opaquely typed (typed in Task 10 C6); file-level disable matches clear.ts pattern
/**
 * @module text-actions Tools for Text edit functions
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria, 2010 Jeff Schiller
 */

import { NS } from './namespaces.js'
import { transformPoint, matrixMultiply, getTransformList, transformListToTransform } from './math.js'
import type { XYObject } from './math.js'
import {
  assignAttributes,
  getElement,
  getBBox as utilsGetBBox
} from './utilities.js'
import type { BBoxObject } from './utilities.js'
import { supportsGoodTextCharPos } from '../common/browser.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any = null

/**
 * @function module:text-actions.init
 * @param {unknown} canvas
 * @returns {void}
 */
export const init = (canvas: unknown): void => {
  svgCanvas = canvas
}

/** Bounding data for a single character position. */
interface CharData {
  x: number
  width: number
  y?: number
  height?: number
}

/**
 * Group: Text edit functions
 * Functions relating to editing text elements.
 * @class TextActions
 * @memberof module:svgcanvas.SvgCanvas#
 */
class TextActions {
  #curtext: SVGTextElement | false | null = null
  #textinput: HTMLInputElement | null = null
  #cursor: Element | null = null
  #selblock: Element | null = null
  #blinker: ReturnType<typeof setInterval> | null = null
  #chardata: CharData[] = []
  #textbb: BBoxObject | null = null // , transbb;
  #matrix: SVGMatrix | null = null
  #lastX: number = 0
  #lastY: number = 0
  #allowDbl: boolean = false

  /**
   * Get the accumulated transformation matrix from the element up to the SVG content element.
   * This includes transforms from all parent groups, fixing the issue where text cursor
   * appears in the wrong position when editing text inside a transformed group.
   * @param {Element} elem - The element to get the accumulated matrix for
   * @returns {SVGMatrix|null} The accumulated transformation matrix, or null if none
   * @private
   */
  #getAccumulatedMatrix = (elem: Element): SVGMatrix | null => {
    const svgContent: Element = svgCanvas.getSvgContent()
    const matrices: SVGMatrix[] = []

    let current: Node | null = elem
    while (current && current !== svgContent && (current).nodeType === 1) {
      const tlist = getTransformList(current as Element)
      if (tlist && tlist.numberOfItems > 0) {
        const matrix = transformListToTransform(tlist).matrix
        matrices.unshift(matrix) // Add to beginning to maintain correct order
      }
      current = (current as Element).parentNode
    }

    if (matrices.length === 0) {
      return null
    }

    if (matrices.length === 1) {
      return matrices[0] ?? null
    }

    // Multiply all matrices together
    return matrixMultiply(...matrices)
  }

  /**
   *
   * @param {number} [index]
   * @returns {void}
   * @private
   */
  #setCursor = (index?: number): void => {
    const inp = this.#textinput
    if (!inp) return
    const empty = inp.value === ''
    inp.focus()

    let resolvedIndex = index
    if (resolvedIndex === undefined) {
      if (empty) {
        resolvedIndex = 0
      } else {
        if (inp.selectionEnd !== inp.selectionStart) {
          return
        }
        resolvedIndex = inp.selectionEnd ?? 0
      }
    }

    const charbb = this.#chardata[resolvedIndex]
    if (!charbb) return
    if (!empty) {
      inp.setSelectionRange(resolvedIndex, resolvedIndex)
    }
    this.#cursor = getElement('text_cursor')
    if (!this.#cursor) {
      this.#cursor = document.createElementNS(NS.SVG, 'line')
      assignAttributes(this.#cursor, {
        id: 'text_cursor',
        stroke: '#333',
        'stroke-width': 1
      })
      getElement('selectorParentGroup')?.append(this.#cursor)
    }

    if (!this.#blinker) {
      const cursorRef = this.#cursor
      this.#blinker = setInterval(() => {
        const show = cursorRef.getAttribute('display') === 'none'
        cursorRef.setAttribute('display', show ? 'inline' : 'none')
      }, 600)
    }

    const textbb = this.#textbb
    if (!textbb) return

    const startPt = this.#ptToScreen(charbb.x, textbb.y)
    const endPt = this.#ptToScreen(charbb.x, textbb.y + textbb.height)

    assignAttributes(this.#cursor, {
      x1: startPt.x,
      y1: startPt.y,
      x2: endPt.x,
      y2: endPt.y,
      visibility: 'visible',
      display: 'inline'
    })

    if (this.#selblock) {
      this.#selblock.setAttribute('d', '')
    }
  }

  /**
   *
   * @param {number} start
   * @param {number} end
   * @param {boolean} [skipInput]
   * @returns {void}
   * @private
   */
  #setSelection = (start: number, end: number, skipInput?: boolean): void => {
    if (start === end) {
      this.#setCursor(end)
      return
    }

    if (!skipInput) {
      this.#textinput?.setSelectionRange(start, end)
    }

    this.#selblock = getElement('text_selectblock')
    if (!this.#selblock) {
      this.#selblock = document.createElementNS(NS.SVG, 'path')
      assignAttributes(this.#selblock, {
        id: 'text_selectblock',
        fill: 'green',
        opacity: 0.5,
        style: 'pointer-events:none'
      })
      getElement('selectorParentGroup')?.append(this.#selblock)
    }

    const startbb = this.#chardata[start]
    const endbb = this.#chardata[end]
    if (!startbb || !endbb) return

    this.#cursor?.setAttribute('visibility', 'hidden')

    const textbb = this.#textbb
    if (!textbb) return

    const tl = this.#ptToScreen(startbb.x, textbb.y)
    const tr = this.#ptToScreen(startbb.x + (endbb.x - startbb.x), textbb.y)
    const bl = this.#ptToScreen(startbb.x, textbb.y + textbb.height)
    const br = this.#ptToScreen(
      startbb.x + (endbb.x - startbb.x),
      textbb.y + textbb.height
    )

    const dstr =
      'M' +
      tl.x +
      ',' +
      tl.y +
      ' L' +
      tr.x +
      ',' +
      tr.y +
      ' ' +
      br.x +
      ',' +
      br.y +
      ' ' +
      bl.x +
      ',' +
      bl.y +
      'z'

    assignAttributes(this.#selblock, {
      d: dstr,
      display: 'inline'
    })
  }

  /**
   *
   * @param {number} mouseX
   * @param {number} mouseY
   * @returns {number}
   * @private
   */
  #getIndexFromPoint = (mouseX: number, mouseY: number): number => {
    // Position cursor here
    const pt: SVGPoint = (svgCanvas.getSvgRoot() as SVGSVGElement).createSVGPoint()
    pt.x = mouseX
    pt.y = mouseY

    // No content, so return 0
    if (this.#chardata.length === 1) {
      return 0
    }
    // Determine if cursor should be on left or right of character
    const curtext = this.#curtext as SVGTextElement
    let charpos = curtext.getCharNumAtPosition(pt)
    if (charpos < 0) {
      // Out of text range, look at mouse coords
      charpos = this.#chardata.length - 2
      const first = this.#chardata[0]
      if (first && mouseX <= first.x) {
        charpos = 0
      }
    } else if (charpos >= this.#chardata.length - 2) {
      charpos = this.#chardata.length - 2
    }
    const charbb = this.#chardata[charpos]
    if (charbb) {
      const mid = charbb.x + charbb.width / 2
      if (mouseX > mid) {
        charpos++
      }
    }
    return charpos
  }

  /**
   *
   * @param {number} mouseX
   * @param {number} mouseY
   * @returns {void}
   * @private
   */
  #setCursorFromPoint = (mouseX: number, mouseY: number): void => {
    this.#setCursor(this.#getIndexFromPoint(mouseX, mouseY))
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {boolean} [apply]
   * @returns {void}
   * @private
   */
  #setEndSelectionFromPoint = (x: number, y: number, apply?: boolean): void => {
    const i1 = this.#textinput?.selectionStart ?? 0
    const i2 = this.#getIndexFromPoint(x, y)

    const start = Math.min(i1, i2)
    const end = Math.max(i1, i2)
    this.#setSelection(start, end, !apply)
  }

  /**
   *
   * @param {number} xIn
   * @param {number} yIn
   * @returns {XYObject}
   * @private
   */
  #screenToPt = (xIn: number, yIn: number): XYObject => {
    const out = {
      x: xIn,
      y: yIn
    }
    const zoom: number = svgCanvas.getZoom()
    out.x /= zoom
    out.y /= zoom

    if (this.#matrix) {
      const pt = transformPoint(out.x, out.y, this.#matrix.inverse())
      out.x = pt.x
      out.y = pt.y
    }

    return out
  }

  /**
   *
   * @param {number} xIn
   * @param {number} yIn
   * @returns {XYObject}
   * @private
   */
  #ptToScreen = (xIn: number, yIn: number): XYObject => {
    const out = {
      x: xIn,
      y: yIn
    }

    if (this.#matrix) {
      const pt = transformPoint(out.x, out.y, this.#matrix)
      out.x = pt.x
      out.y = pt.y
    }
    const zoom: number = svgCanvas.getZoom()
    out.x *= zoom
    out.y *= zoom

    return out
  }

  /**
   *
   * @param {Event} evt
   * @returns {void}
   * @private
   */
  #selectAll = (evt: Event): void => {
    const curtext = this.#curtext as SVGTextElement
    this.#setSelection(0, curtext.textContent?.length ?? 0)
    ;(evt.target as EventTarget & { removeEventListener: (type: string, listener: EventListener) => void }).removeEventListener('click', this.#selectAll)
  }

  /**
   *
   * @param {MouseEvent} evt
   * @returns {void}
   * @private
   */
  #selectWord = (evt: MouseEvent): void => {
    if (!this.#allowDbl || !this.#curtext) {
      return
    }
    const zoom: number = svgCanvas.getZoom()
    const ept: XYObject = transformPoint(evt.pageX, evt.pageY, svgCanvas.getRootSctm())
    const mouseX = ept.x * zoom
    const mouseY = ept.y * zoom
    const pt = this.#screenToPt(mouseX, mouseY)

    const index = this.#getIndexFromPoint(pt.x, pt.y)
    const str = (this.#curtext).textContent ?? ''
    const first = str.slice(0, index).replace(/[a-z\d]+$/i, '').length
    const m = str.slice(index).match(/^[a-z\d]+/i)
    const last = (m ? m[0].length : 0) + index
    this.#setSelection(first, last)

    // Set tripleclick
    svgCanvas.$click(evt.target, this.#selectAll)

    setTimeout(() => {
      ;(evt.target as EventTarget & { removeEventListener: (type: string, listener: EventListener) => void }).removeEventListener('click', this.#selectAll)
    }, 300)
  }

  /**
   * @param {SVGTextElement} target
   * @param {number} x
   * @param {number} y
   * @returns {void}
   */
  select (target: SVGTextElement, x: number, y: number): void {
    this.#curtext = target
    svgCanvas.textActions.toEditMode(x, y)
  }

  /**
   * @param {SVGTextElement} elem
   * @returns {void}
   */
  start (elem: SVGTextElement): void {
    this.#curtext = elem
    svgCanvas.textActions.toEditMode()
  }

  /**
   * @param {MouseEvent} evt
   * @param {Element} mouseTarget
   * @param {number} startX
   * @param {number} startY
   * @returns {void}
   */
  mouseDown (_evt: MouseEvent, _mouseTarget: Element, startX: number, startY: number): void {
    const pt = this.#screenToPt(startX, startY)

    this.#textinput?.focus()
    this.#setCursorFromPoint(pt.x, pt.y)
    this.#lastX = startX
    this.#lastY = startY

    // TODO: Find way to block native selection
  }

  /**
   * @param {number} mouseX
   * @param {number} mouseY
   * @returns {void}
   */
  mouseMove (mouseX: number, mouseY: number): void {
    const pt = this.#screenToPt(mouseX, mouseY)
    this.#setEndSelectionFromPoint(pt.x, pt.y)
  }

  /**
   * @param {MouseEvent} evt
   * @param {number} mouseX
   * @param {number} mouseY
   * @returns {void}
   */
  mouseUp (evt: MouseEvent, mouseX: number, mouseY: number): void {
    const pt = this.#screenToPt(mouseX, mouseY)

    this.#setEndSelectionFromPoint(pt.x, pt.y, true)

    // TODO: Find a way to make this work: Use transformed BBox instead of evt.target
    // if (lastX === mouseX && lastY === mouseY
    //   && !rectsIntersect(transbb, {x: pt.x, y: pt.y, width: 0, height: 0})) {
    //   svgCanvas.textActions.toSelectMode(true);
    // }

    if (
      evt.target !== this.#curtext &&
      mouseX < this.#lastX + 2 &&
      mouseX > this.#lastX - 2 &&
      mouseY < this.#lastY + 2 &&
      mouseY > this.#lastY - 2
    ) {
      svgCanvas.textActions.toSelectMode(true)
    }
  }

  /**
   * @param {number} index
   * @returns {void}
   */
  setCursor (index: number): void {
    this.#setCursor(index)
  }

  /**
   * @param {number} [x]
   * @param {number} [y]
   * @returns {void}
   */
  toEditMode (x?: number, y?: number): void {
    this.#allowDbl = false
    svgCanvas.setCurrentMode('textedit')
    svgCanvas.selectorManager.requestSelector(this.#curtext).showGrips(false)
    // Make selector group accept clicks
    /* const selector = */ svgCanvas.selectorManager.requestSelector(this.#curtext) // Do we need this? Has side effect of setting lock, so keeping for now, but next line wasn't being used
    // const sel = selector.selectorRect;

    svgCanvas.textActions.init()

    ;(this.#curtext as SVGTextElement).style.cursor = 'text'

    // if (supportsEditableText()) {
    //   curtext.setAttribute('editable', 'simple');
    //   return;
    // }

    if (x === undefined || y === undefined) {
      this.#setCursor()
    } else {
      const pt = this.#screenToPt(x, y)
      this.#setCursorFromPoint(pt.x, pt.y)
    }

    setTimeout(() => {
      this.#allowDbl = true
    }, 300)
  }

  /**
   * @param {boolean|Element} [selectElem]
   * @fires module:svgcanvas.SvgCanvas#event:selected
   * @returns {void}
   */
  toSelectMode (selectElem?: boolean | Element): void {
    svgCanvas.setCurrentMode('select')
    if (this.#blinker !== null) {
      clearInterval(this.#blinker)
    }
    this.#blinker = null
    if (this.#selblock) {
      this.#selblock.setAttribute('display', 'none')
    }
    if (this.#cursor) {
      this.#cursor.setAttribute('visibility', 'hidden')
    }
    ;(this.#curtext as SVGTextElement).style.cursor = 'move'

    if (selectElem) {
      svgCanvas.clearSelection()
      ;(this.#curtext as SVGTextElement).style.cursor = 'move'

      svgCanvas.call('selected', [this.#curtext])
      svgCanvas.addToSelection([this.#curtext], true)
    }
    if (!(this.#curtext as SVGTextElement | null)?.textContent?.length) {
      // No content, so delete
      svgCanvas.deleteSelectedElements()
    }

    this.#textinput?.blur()

    this.#curtext = false

    // if (supportsEditableText()) {
    //   curtext.removeAttribute('editable');
    // }
  }

  /**
   * @param {HTMLInputElement} elem
   * @returns {void}
   */
  setInputElem (elem: HTMLInputElement): void {
    this.#textinput = elem
  }

  /**
   * @returns {void}
   */
  clear (): void {
    if (svgCanvas.getCurrentMode() === 'textedit') {
      svgCanvas.textActions.toSelectMode()
    }
  }

  /**
   * @param {Element} [_inputElem] Not in use
   * @returns {void}
   */
  init (_inputElem?: Element): void {
    if (!this.#curtext) {
      return
    }
    // if (supportsEditableText()) {
    //   curtext.select();
    //   return;
    // }

    const curtext = this.#curtext

    if (!curtext.parentNode) {
      // Result of the ffClone, need to get correct element
      const selectedElements: SVGTextElement[] = svgCanvas.getSelectedElements()
      this.#curtext = selectedElements[0] ?? null
      if (!this.#curtext) return
      svgCanvas.selectorManager.requestSelector(this.#curtext).showGrips(false)
    }

    const textElem = this.#curtext
    const str = textElem.textContent ?? ''
    const len = str.length

    this.#textbb = utilsGetBBox(textElem)

    // Calculate accumulated transform matrix including all parent groups
    // This fixes the issue where text cursor appears in wrong position
    // when editing text inside a group with transforms
    this.#matrix = this.#getAccumulatedMatrix(textElem)

    this.#chardata = []
    this.#chardata.length = len
    this.#textinput?.focus()

    textElem.removeEventListener('dblclick', this.#selectWord)
    textElem.addEventListener('dblclick', this.#selectWord)

    // endX tracks the x of the last character's end position for the final cursor entry
    let endX: number = 0
    const textbb = this.#textbb

    if (!len && textbb) {
      endX = textbb.x + textbb.width / 2
    }

    for (let i = 0; i < len; i++) {
      const start = textElem.getStartPositionOfChar(i)
      const end = textElem.getEndPositionOfChar(i)

      if (!supportsGoodTextCharPos()) {
        const zoom: number = svgCanvas.getZoom()
        const offset: number = (svgCanvas.contentW as number) * zoom
        start.x -= offset
        end.x -= offset

        start.x /= zoom
        end.x /= zoom
      }

      endX = end.x

      // Get a "bbox" equivalent for each character. Uses the
      // bbox data of the actual text for y, height purposes

      // TODO: Decide if y, width and height are actually necessary
      this.#chardata[i] = {
        x: start.x,
        y: textbb?.y ?? 0, // start.y?
        width: end.x - start.x,
        height: textbb?.height ?? 0
      }
    }

    // Add a last bbox for cursor at end of text
    this.#chardata.push({
      x: endX,
      width: 0
    })
    const inp = this.#textinput
    if (inp) {
      this.#setSelection(inp.selectionStart ?? 0, inp.selectionEnd ?? 0, true)
    }
  }
}

// Export singleton instance for backward compatibility
export const textActionsMethod: TextActions = new TextActions()
