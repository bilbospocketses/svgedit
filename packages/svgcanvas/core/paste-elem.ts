/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
// svgCanvas is opaquely typed (typed in Task 10 C6); file-level disable matches clear.ts pattern
import {
  getStrokedBBoxDefaultVisible,
  getUrlFromAttr
} from './utilities.js'
import * as hstry from './history.js'

const {
  InsertElementCommand, BatchCommand
} = hstry

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svgCanvas: any = null

/**
* @function module:paste-elem.init
* @param {unknown} canvas
* @returns {void}
*/
export const init = (canvas: unknown): void => {
  svgCanvas = canvas
}

/** Represents one JSON-serialised SVG element as produced by addSVGElementsFromJson */
interface SVGAsJSON {
  attr?: Record<string, string>
  children?: SVGAsJSON[]
  [key: string]: unknown
}

/**
* @function module:svgcanvas.SvgCanvas#pasteElements
* @param {"in_place"|"point"|undefined} type
* @param {number|undefined} x Expected if type is "point"
* @param {number|undefined} y Expected if type is "point"
* @fires module:svgcanvas.SvgCanvas#event:changed
* @fires module:svgcanvas.SvgCanvas#event:ext_IDsUpdated
* @returns {void}
*/
export const pasteElementsMethod = (type?: 'in_place' | 'point', x?: number, y?: number): void => {
  const rawClipboard = sessionStorage.getItem(svgCanvas.getClipboardID())
  let clipb: SVGAsJSON[]
  try {
    clipb = JSON.parse(rawClipboard as string) as SVGAsJSON[]
  } catch {
    return
  }
  if (!Array.isArray(clipb) || !clipb.length) return

  const pasted: Element[] = []
  const batchCmd = new BatchCommand('Paste elements')
  /**
  * Maps old IDs to newly assigned IDs after a paste.
  */
  const changedIDs: Record<string, string> = {}

  // Recursively replace IDs and record the changes
  const checkIDs = (elem: SVGAsJSON): void => {
    if (elem.attr?.id) {
      const oldId = elem.attr.id
      changedIDs[oldId] = svgCanvas.getNextId()
      elem.attr.id = changedIDs[oldId] as string
    }
    if (elem.children) elem.children.forEach((child) => checkIDs(child))
  }
  clipb.forEach((elem) => checkIDs(elem))

  // Update any internal references in the clipboard to match the new IDs.
  const remapReferences = (elem: SVGAsJSON): void => {
    const attrs = elem?.attr
    if (attrs) {
      for (const [attrName, attrVal] of Object.entries(attrs)) {
        if (typeof attrVal !== 'string' || !attrVal) continue
        if ((attrName === 'href' || attrName === 'xlink:href') && attrVal.startsWith('#')) {
          const refId = attrVal.slice(1)
          if (refId in changedIDs) {
            attrs[attrName] = `#${changedIDs[refId]}`
          }
        }
        const url = getUrlFromAttr(attrVal)
        if (url) {
          const refId = url.slice(1)
          if (refId in changedIDs) {
            attrs[attrName] = attrVal.replace(url, `#${changedIDs[refId]}`)
          }
        }
      }
    }
    if (elem.children) elem.children.forEach((child) => remapReferences(child))
  }
  clipb.forEach((elem) => remapReferences(elem))

  // Give extensions like the connector extension a chance to reflect new IDs and remove invalid elements
  svgCanvas.runExtensions({
    action: 'IDsUpdated',
    vars: { elems: clipb, changes: changedIDs }
  }).forEach(function (extChanges: { remove?: string[] } | null) {
    if (!extChanges || !('remove' in extChanges)) return

    extChanges.remove?.forEach(function (removeID: string) {
      clipb = clipb.filter(function (clipBoardItem: SVGAsJSON) {
        return clipBoardItem?.attr?.id !== removeID
      })
    })
  })

  // Move elements to lastClickPoint
  let len = clipb.length
  if (!len) return
  while (len--) {
    const elem = clipb[len]
    if (!elem) { continue }

    const copy: Element = svgCanvas.addSVGElementsFromJson(elem)
    pasted.push(copy)
    batchCmd.addSubCommand(new InsertElementCommand(copy))

    svgCanvas.restoreRefElements(copy)
  }

  if (!pasted.length) return
  svgCanvas.selectOnly(pasted)

  if (type !== 'in_place') {
    let ctrX: number | undefined
    let ctrY: number | undefined

    if (!type) {
      ctrX = svgCanvas.getLastClickPoint('x') as number
      ctrY = svgCanvas.getLastClickPoint('y') as number
    } else if (type === 'point') {
      ctrX = x
      ctrY = y
    }

    const bbox = getStrokedBBoxDefaultVisible(pasted)
    if (bbox && Number.isFinite(ctrX) && Number.isFinite(ctrY)) {
      const cx = (ctrX as number) - (bbox.x + bbox.width / 2)
      const cy = (ctrY as number) - (bbox.y + bbox.height / 2)
      const dx: number[] = []
      const dy: number[] = []

      pasted.forEach(function (_item: Element) {
        dx.push(cx)
        dy.push(cy)
      })

      const cmd = svgCanvas.moveSelectedElements(dx, dy, false)
      if (cmd) batchCmd.addSubCommand(cmd)
    }
  }

  svgCanvas.addCommandToHistory(batchCmd)
  svgCanvas.call('changed', pasted)
}
