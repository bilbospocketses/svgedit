/**
 * Tools for blur event.
 * @module blur
 * @license MIT
 */

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/** Snapshot of the original filter state captured at the start of a live blur preview (#4). */
interface BlurPreviewSnapshot {
  elem: Element
  origFilterAttr: string | null
  filterExisted: boolean
  origStdDev: string | null
}
let blurPreview: BlurPreviewSnapshot | null = null

/**
* @function module:blur.init
*/
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
}

const getFeGaussianBlurElem = (filterElem: Element): Element | null => {
  if (!filterElem || filterElem.nodeType !== 1) return null
  return filterElem.querySelector('feGaussianBlur') ?? filterElem.firstElementChild
}

/**
* Sets the `stdDeviation` blur value on the selected element without being undoable.
* @function module:svgcanvas.SvgCanvas#setBlurNoUndo
*/
export const setBlurNoUndo = (val: number): void => {
  const selectedElements = svgCanvas.getSelectedElements()
  const elem = selectedElements[0]
  if (!elem) return

  let filter = svgCanvas.getFilter()
  if (!filter) {
    filter = svgCanvas.getElement(`${(elem).id}_blur`)
  }

  if (val === 0) {
    // Don't change the StdDev, as that will hide the element.
    // Instead, just remove the value for "filter"
    svgCanvas.changeSelectedAttributeNoUndo('filter', '')
    svgCanvas.setFilterHidden(true)
  } else {
    if (!filter) {
      // Create the filter if missing, but don't add history.
      const blurElem = svgCanvas.addSVGElementsFromJson({
        element: 'feGaussianBlur',
        attr: {
          in: 'SourceGraphic',
          stdDeviation: val
        }
      })
      filter = svgCanvas.addSVGElementsFromJson({
        element: 'filter',
        attr: {
          id: `${(elem).id}_blur`
        }
      })
      filter.append(blurElem)
      svgCanvas.findDefs().append(filter)
    }

    if (svgCanvas.getFilterHidden() || !(elem).getAttribute('filter')) {
      svgCanvas.changeSelectedAttributeNoUndo('filter', `url(#${filter.id})`)
      svgCanvas.setFilterHidden(false)
    }

    const blurElem = getFeGaussianBlurElem(filter)
    if (!blurElem) {
      return
    }
    svgCanvas.changeSelectedAttributeNoUndo('stdDeviation', val, [blurElem])
    svgCanvas.setBlurOffsets(filter, val)
  }
}

/**
* Finishes the blur change command and adds it to history if not empty.
*/
const finishChange = (): void => {
  const curCommand = svgCanvas.getCurCommand()
  if (!curCommand) {
    svgCanvas.setCurCommand(null)
    svgCanvas.setFilter(null)
    svgCanvas.setFilterHidden(false)
    return
  }
  const bCmd = svgCanvas.undoMgr.finishUndoableChange()
  if (!bCmd.isEmpty()) {
    curCommand.addSubCommand(bCmd)
  }
  if (!curCommand.isEmpty()) {
    svgCanvas.addCommandToHistory(curCommand)
  }
  svgCanvas.setCurCommand(null)
  svgCanvas.setFilter(null)
  svgCanvas.setFilterHidden(false)
}

/**
* Sets the `x`, `y`, `width`, `height` values of the filter element in order to
* make the blur not be clipped. Removes them if not neeeded.
* @function module:svgcanvas.SvgCanvas#setBlurOffsets
* @param filterElem - The filter DOM element to update
* @param stdDev - The standard deviation value on which to base the offset size
*/
export const setBlurOffsets = (filterElem: Element, stdDev: number): void => {
  if (!filterElem || filterElem.nodeType !== 1) {
    return
  }

  const dev = Number(stdDev) || 0

  if (dev > 3) {
    // Gaussian blur: 99.7% of energy within ±3σ. Scale filter region accordingly.
    const offset = Math.max(50, dev * 3)
    const size = 100 + offset * 2
    svgCanvas.assignAttributes(filterElem, {
      x: `-${offset}%`,
      y: `-${offset}%`,
      width: `${size}%`,
      height: `${size}%`
    }, 100)
  } else {
    filterElem.removeAttribute('x')
    filterElem.removeAttribute('y')
    filterElem.removeAttribute('width')
    filterElem.removeAttribute('height')
  }
}

/**
* Adds/updates the blur filter to the selected element.
* @function module:svgcanvas.SvgCanvas#setBlur
* @param val - Float with the new `stdDeviation` blur value
* @param complete - Whether or not the action should be completed (to add to the undo manager)
*/
export const setBlur = (val: number, complete: boolean): void => {
  const {
    InsertElementCommand, ChangeElementCommand, BatchCommand
  } = svgCanvas.history

  const selectedElements = svgCanvas.getSelectedElements()
  if (svgCanvas.getCurCommand()) {
    finishChange()
    return
  }

  // Looks for associated blur, creates one if not found
  const elem = selectedElements[0]
  if (!elem) {
    return
  }
  const elemId = (elem).id
  let filter = svgCanvas.getElement(`${elemId}_blur`)
  svgCanvas.setFilter(filter)

  const blurVal = Number(val) || 0

  const batchCmd = new BatchCommand('Change blur')

  if (blurVal === 0) {
    const oldFilter = (elem).getAttribute('filter')
    if (!oldFilter) {
      return
    }
    const changes = { filter: oldFilter }
    ;(elem).removeAttribute('filter')
    batchCmd.addSubCommand(new ChangeElementCommand(elem, changes))
    svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.setFilter(null)
    svgCanvas.setFilterHidden(true)
    return
  }

  // Ensure blur filter exists.
  if (!filter) {
    const newblur = svgCanvas.addSVGElementsFromJson({
      element: 'feGaussianBlur',
      attr: {
        in: 'SourceGraphic',
        stdDeviation: blurVal
      }
    })

    filter = svgCanvas.addSVGElementsFromJson({
      element: 'filter',
      attr: {
        id: `${elemId}_blur`
      }
    })
    filter.append(newblur)
    const defs = svgCanvas.findDefs()
    if (defs && defs.ownerDocument === filter.ownerDocument) {
      defs.append(filter)
    }
    svgCanvas.setFilter(filter)
    batchCmd.addSubCommand(new InsertElementCommand(filter))
  }

  const changes: Record<string, string | null> = { filter: (elem).getAttribute('filter') }
  svgCanvas.changeSelectedAttributeNoUndo('filter', `url(#${filter.id})`)
  batchCmd.addSubCommand(new ChangeElementCommand(elem, changes))
  svgCanvas.setBlurOffsets(filter, blurVal)
  svgCanvas.setCurCommand(batchCmd)

  // Only open an undoable change when finalizing. A non-final (complete=false)
  // call must not leave a beginUndoableChange unpaired -- that orphans an entry
  // on the undo-change stack and offsets its pointer for every later edit (#102).
  if (complete) {
    const blurElem = getFeGaussianBlurElem(filter)
    svgCanvas.undoMgr.beginUndoableChange('stdDeviation', [blurElem])
    svgCanvas.setBlurNoUndo(blurVal)
    finishChange()
  }
}

/**
* Snapshot the element's original filter state at the start of a live blur preview
* so finishBlurPreview() can record one undo entry spanning original -> final (#4).
* @function module:svgcanvas.SvgCanvas#beginBlurPreview
*/
export const beginBlurPreview = (): void => {
  const elem = svgCanvas.getSelectedElements()[0]
  if (!elem) { blurPreview = null; return }
  const filter = svgCanvas.getElement(`${(elem).id}_blur`)
  const blurElem = filter ? getFeGaussianBlurElem(filter) : null
  blurPreview = {
    elem,
    origFilterAttr: elem.getAttribute('filter'),
    filterExisted: Boolean(filter),
    origStdDev: blurElem ? blurElem.getAttribute('stdDeviation') : null
  }
}

/**
* Close a live blur preview (started by beginBlurPreview, previewed via
* setBlurNoUndo) into a single undo entry covering the new-filter, adjust-existing,
* and remove cases (#4). A no-op preview records nothing.
* @function module:svgcanvas.SvgCanvas#finishBlurPreview
*/
export const finishBlurPreview = (): void => {
  const snap = blurPreview
  blurPreview = null
  if (!snap) { return }
  const { InsertElementCommand, ChangeElementCommand, BatchCommand } = svgCanvas.history
  const { elem } = snap

  // Normalize the empty filter attr left by setBlurNoUndo(0) to "removed" so the
  // committed state matches setBlur(0) and undo/redo toggle a clean attribute.
  if (elem.getAttribute('filter') === '') { elem.removeAttribute('filter') }

  const filter = svgCanvas.getElement(`${(elem).id}_blur`)
  const blurElem = filter ? getFeGaussianBlurElem(filter) : null
  const curFilterAttr = elem.getAttribute('filter')
  const curStdDev = blurElem ? blurElem.getAttribute('stdDeviation') : null

  const batchCmd = new BatchCommand('Change blur')
  // A <filter> created during the preview: its final stdDeviation rides along in the
  // element reference, so the InsertElementCommand captures the whole filter.
  if (filter && !snap.filterExisted) {
    batchCmd.addSubCommand(new InsertElementCommand(filter))
  }
  // The element's filter attribute ('' and null both mean "no filter").
  if ((curFilterAttr ?? '') !== (snap.origFilterAttr ?? '')) {
    batchCmd.addSubCommand(new ChangeElementCommand(elem, { filter: snap.origFilterAttr }))
  }
  // stdDeviation change on a filter that ALREADY existed (a new filter carries its
  // value in the InsertElementCommand above).
  if (snap.filterExisted && blurElem && curStdDev !== snap.origStdDev) {
    batchCmd.addSubCommand(new ChangeElementCommand(blurElem, { stdDeviation: snap.origStdDev }))
  }
  if (!batchCmd.isEmpty()) {
    svgCanvas.addCommandToHistory(batchCmd)
  }
}
