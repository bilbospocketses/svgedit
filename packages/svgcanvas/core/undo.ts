/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion */
/**
 * Tools for undo.
 * @module undo
 * @license MIT
 * @copyright 2011 Jeff Schiller
 */
import * as draw from './draw.js'
import * as hstry from './history.js'
import { BBOX_AFFECTING_ATTRS, UndoManager, HistoryEventTypes } from './history.js'
import {
  getRotationAngle, getBBox as utilsGetBBox, setHref, getStrokedBBoxDefaultVisible
} from './utilities.js'
import {
  isGecko
} from '../common/browser.js'
import {
  transformPoint, transformListToTransform, getTransformList
} from './math.js'

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/**
* @function module:undo.init
* @param canvas
*/
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
   
  svgCanvas.undoMgr = getUndoManager()
}

export const getUndoManager = (): InstanceType<typeof UndoManager> => {
  const maxHistory: number = svgCanvas?.configObj?.curConfig?.maxUndoHistory ?? 100
  return new UndoManager({
    /**
     * @param eventType One of the HistoryEvent types
     * @param cmd Fulfills the HistoryCommand interface
     */
    handleHistoryEvent (eventType: string, cmd: hstry.Command): void {
      const EventTypes = HistoryEventTypes
      // TODO: handle setBlurOffsets.
      if (eventType === EventTypes.BEFORE_UNAPPLY || eventType === EventTypes.BEFORE_APPLY) {
        svgCanvas.clearSelection()
      } else if (eventType === EventTypes.AFTER_APPLY || eventType === EventTypes.AFTER_UNAPPLY) {
        const cmdType = cmd.type()
        const isApply = (eventType === EventTypes.AFTER_APPLY)
        if (cmdType === 'ChangeElementCommand' && cmd.elem === svgCanvas.getSvgContent()) {
          const values = isApply ? (cmd as hstry.ChangeElementCommand).newValues : (cmd as hstry.ChangeElementCommand).oldValues
          if (values.width !== null && values.width !== undefined && values.width !== '') {
            const newContentW = Number(values.width)
            if (Number.isFinite(newContentW) && newContentW > 0) {
              svgCanvas.contentW = newContentW
            }
          }
          if (values.height !== null && values.height !== undefined && values.height !== '') {
            const newContentH = Number(values.height)
            if (Number.isFinite(newContentH) && newContentH > 0) {
              svgCanvas.contentH = newContentH
            }
          }
        }
        const elems = cmd.elements()
        svgCanvas.pathActions.clear()
        svgCanvas.call('changed', elems)
        if (cmdType === 'MoveElementCommand') {
          const parent = isApply ? (cmd as hstry.MoveElementCommand).newParent : (cmd as hstry.MoveElementCommand).oldParent
          if (parent === svgCanvas.getSvgContent()) {
            draw.identifyLayers()
          }
        } else if (cmdType === 'InsertElementCommand' || cmdType === 'RemoveElementCommand') {
          if ((cmd as hstry.InsertElementCommand | hstry.RemoveElementCommand).parent === svgCanvas.getSvgContent()) {
            draw.identifyLayers()
          }
          if (cmdType === 'InsertElementCommand') {
            if (isApply) {
              svgCanvas.restoreRefElements(cmd.elem)
            }
          } else if (!isApply) {
            svgCanvas.restoreRefElements(cmd.elem)
          }
          if (cmd.elem) {
            svgCanvas.setUseData(cmd.elem)
          }
        } else if (cmdType === 'ChangeElementCommand') {
          // if we are changing layer names, re-identify all layers
          if (cmd.elem.tagName === 'title' &&
            cmd.elem.parentNode?.parentNode === svgCanvas.getSvgContent()
          ) {
            draw.identifyLayers()
          }
          const values = isApply ? (cmd as hstry.ChangeElementCommand).newValues : (cmd as hstry.ChangeElementCommand).oldValues
          // If stdDeviation was changed, update the blur.
          if (values.stdDeviation) {
            svgCanvas.setBlurOffsets(cmd.elem.parentNode as Element, Number(values.stdDeviation))
          }
          if (cmd.elem.tagName === 'text') {
            const dx = Number(values.x) - Number((cmd as hstry.ChangeElementCommand).oldValues.x)
            const dy = Number(values.y) - Number((cmd as hstry.ChangeElementCommand).oldValues.y)

            const tspans = cmd.elem.children

            for (let i = 0; i < tspans.length; i++) {
              const tspan = tspans[i]
              if (!tspan) continue
              let x = Number(tspan.getAttribute('x'))
              let y = Number(tspan.getAttribute('y'))

              const unapply = (eventType === EventTypes.AFTER_UNAPPLY)
              x = unapply ? x - dx : x + dx
              y = unapply ? y - dy : y + dy

              tspan.setAttribute('x', String(x))
              tspan.setAttribute('y', String(y))
            }
          }
        }
      }
    }
  }, maxHistory)
}

/**
* Hack for Firefox bugs where text element features aren't updated or get
* messed up. See issue 136 and issue 137.
* This function clones the element and re-selects it.
* @function module:svgcanvas~ffClone
* @todo Test for this bug on load and add it to "support" object instead of
* browser sniffing
* @param elem - The (text) DOM element to clone
* @returns Cloned element
*/
export const ffClone = (elem: Element): Element => {
  if (!isGecko()) { return elem }
  const clone = elem.cloneNode(true)
  elem.before(clone)
  elem.remove()
  svgCanvas.selectorManager.releaseSelector(elem)
  svgCanvas.setSelectedElements(0, clone as Element)
  svgCanvas.selectorManager.requestSelector(clone as Element)!.showGrips(true)
  return clone as Element
}

/**
* This function makes the changes to the elements. It does not add the change
* to the history stack.
* @param attr - Attribute name
* @param newValue - String or number with the new attribute value
* @param elems - The DOM elements to apply the change to
*/
export const changeSelectedAttributeNoUndoMethod = (attr: string, newValue: string | number, elems?: (Element | null)[]): void => {
  if (attr === 'id') {
    // if the user is changing the id, then de-select the element first
    // change the ID, then re-select it with the new ID
    // as this change can impact other extensions, a 'renamedElement' event is thrown
    const elem = elems![0]
    if (!elem) return
    const oldId = elem.id
    if (oldId !== newValue) {
      svgCanvas.clearSelection()
      elem.id = String(newValue)
      svgCanvas.addToSelection([elem], true)
      svgCanvas.call('elementRenamed', { elem, oldId, newId: newValue })
    }
    return
  }
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const zoom: number = svgCanvas.getZoom()
  if (svgCanvas.getCurrentMode() === 'pathedit') {
    // Editing node
    svgCanvas.pathActions.moveNode(attr, newValue)
  }
  elems = elems ?? selectedElements
  let i = elems.length
  const noXYElems = ['g', 'polyline', 'path']

  while (i--) {
    let elem = elems[i]
    if (!elem) { continue }

    // Set x,y vals on elements that don't have them
    if ((attr === 'x' || attr === 'y') && noXYElems.includes(elem.tagName)) {
      const bbox = getStrokedBBoxDefaultVisible([elem])
      if (!bbox) continue
      const diffX = attr === 'x' ? parseFloat(String(newValue)) - bbox.x : 0
      const diffY = attr === 'y' ? parseFloat(String(newValue)) - bbox.y : 0
      svgCanvas.moveSelectedElements(diffX * zoom, diffY * zoom, true)
      continue
    }

    let oldval = attr === '#text' ? elem.textContent : elem.getAttribute(attr)
    if (!oldval) { oldval = '' }
    if (oldval !== String(newValue)) {
      if (attr === '#text') {
        // const oldW = utilsGetBBox(elem).width;
        elem.textContent = String(newValue)

        // FF bug occurs on on rotated elements
        if ((/rotate/).test(elem.getAttribute('transform') ?? '')) {
          elem = ffClone(elem)
        }
        // Hoped to solve the issue of moving text with text-anchor="start",
        // but this doesn't actually fix it. Hopefully on the right track, though. -Fyrd
      } else if (attr === '#href') {
        setHref(elem, String(newValue))
      } else if (newValue) {
        const parsedVal = parseFloat(String(newValue))
        elem.setAttribute(attr, isNaN(parsedVal) ? String(newValue) : String(parsedVal))
      } else if (typeof newValue === 'number') {
        elem.setAttribute(attr, String(newValue))
      } else {
        elem.removeAttribute(attr)
      }

      // Go into "select" mode for text changes
      // NOTE: Important that this happens AFTER elem.setAttribute() or else attributes like
      // font-size can get reset to their old value, ultimately by svgEditor.updateContextPanel(),
      // after calling textActions.toSelectMode() below
      if (svgCanvas.getCurrentMode() === 'textedit' && attr !== '#text' && elem.textContent?.length) {
        svgCanvas.textActions.toSelectMode(elem)
      }

      // Use the Firefox ffClone hack for text elements with gradients or
      // where other text attributes are changed.
      if (isGecko() &&
        elem.nodeName === 'text' &&
        (/rotate/).test(elem.getAttribute('transform') ?? '') &&
        (String(newValue).startsWith('url') || (['font-size', 'font-family', 'x', 'y'].includes(attr) && elem.textContent))) {
        elem = ffClone(elem)
      }
      // Timeout needed for Opera & Firefox
      // codedread: it is now possible for this to be called with elements
      // that are not in the selectedElements array, we need to only request a
      // selector if the element is in that array
      const currentElem: Element = elem
      if (selectedElements.includes(currentElem)) {
        setTimeout(function () {
          // Due to element replacement, this element may no longer
          // be part of the DOM
          if (!currentElem.parentNode) { return }
          svgCanvas.selectorManager.requestSelector(currentElem)!.resize()
        }, 0)
      }
      // Only recalculate rotation center for attributes that change element geometry.
      // Non-geometric attributes (stroke-width, fill, opacity, etc.) don't affect
      // the bbox center, so the rotation is already correct and must not be touched.
      // BBOX_AFFECTING_ATTRS is imported from history.js to keep the list in one place.
      const angle = getRotationAngle(currentElem)
      if (angle !== 0 && attr !== 'transform' && BBOX_AFFECTING_ATTRS.has(attr)) {
        const tlist = getTransformList(currentElem)
        if (!tlist) continue
        let n = tlist.numberOfItems
        while (n--) {
          const xform = tlist.getItem(n)
          if (xform.type === 4) {
            // Compute bbox BEFORE removing the rotation so we can bail out
            // safely if getBBox returns nothing (avoids losing the rotation).
            const box = utilsGetBBox(currentElem)
            if (!box) break

            tlist.removeItem(n)

            // Transform bbox center through only the transforms that come
            // AFTER the rotation in the list (not the pre-rotation transforms).
            // After removeItem(n), what was at n+1 is now at n.
            let centerMatrix: SVGMatrix
            if (n < tlist.numberOfItems) {
              centerMatrix = transformListToTransform(tlist, n, tlist.numberOfItems - 1).matrix
            } else {
              centerMatrix = svgCanvas.getSvgRoot().createSVGMatrix() // identity
            }
            const center = transformPoint(
              box.x + box.width / 2, box.y + box.height / 2, centerMatrix
            )

            const newrot = svgCanvas.getSvgRoot().createSVGTransform()
            newrot.setRotate(angle, center.x, center.y)
            tlist.insertItemBefore(newrot, n)
            break
          }
        }
      }
    } // if oldValue != newValue
  } // for each elem
}

/**
* Change the given/selected element and add the original value to the history stack.
* If you want to change all `selectedElements`, ignore the `elems` argument.
* If you want to change only a subset of `selectedElements`, then send the
* subset to this function in the `elems` argument.
* @function module:svgcanvas.SvgCanvas#changeSelectedAttribute
* @param attr - String with the attribute name
* @param val - String or number with the new attribute value
* @param [elems] - The DOM elements to apply the change to
*/
export const changeSelectedAttributeMethod = (attr: string, val: string | number, elems?: (Element | null)[]): void => {
  const selectedElements: (Element | null)[] = svgCanvas.getSelectedElements()
  const targetElems = elems ?? selectedElements
  svgCanvas.undoMgr.beginUndoableChange(attr, targetElems)

  changeSelectedAttributeNoUndoMethod(attr, val, targetElems)

  const batchCmd = svgCanvas.undoMgr.finishUndoableChange()
  if (!batchCmd.isEmpty()) {
    // svgCanvas.addCommandToHistory(batchCmd);
    svgCanvas.undoMgr.addCommandToHistory(batchCmd)
  }
}
