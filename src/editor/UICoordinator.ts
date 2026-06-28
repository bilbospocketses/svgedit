/**
 * Canvas UI coordination for the SVG editor: canvas resize/scroll, wireframe
 * overlay, zoom handling, mode-driven cursor styling, and the context-panel
 * breadcrumb. Extracted from `Editor` as part of the #108 god-object
 * decomposition (PR-5); `Editor` keeps thin delegators (`updateCanvas` /
 * `updateWireFrame` / `zoomChanged` / `zoomDone` / `modeListener` /
 * `contextChanged`) so `editorInit`, `MainMenu`, the panels and the
 * load/export extensions keep calling `editor.*` unchanged.
 *
 * These handlers read selection straight from `svgCanvas.selectedElements`, so
 * the coordinator depends on the canvas, not on `EditorSelection`.
 * @license MIT
 */
import SvgCanvas from '@svgedit/svgcanvas'
import type { ISvgCanvas } from '@svgedit/svgcanvas'
import { getParentsUntil } from '@svgedit/svgcanvas/common/util.js'
import type ConfigObj from './ConfigObj.js'
import type Rulers from './Rulers.js'
import { renderContextPanel } from './contextPanel.js'

const { $id } = SvgCanvas

/** The slice of `Editor` that UICoordinator depends on. */
export interface UICoordinatorHost {
  svgCanvas: ISvgCanvas
  workarea: HTMLElement
  rulers: Rulers
  configObj: ConfigObj
  leftPanel: { clickSelect: () => void }
  bottomPanel: { changeZoom: (value: string) => void }
  storagePromptState: 'ignore' | 'waiting' | 'closed'
  curContext: string | null
}

/** Owns canvas layout/zoom/cursor/context-panel display for the editor. */
export class UICoordinator {
  #host: UICoordinatorHost

  constructor (host: UICoordinatorHost) {
    this.#host = host
  }

  /**
   * Listens to the mode change, listener is to be added on document.
   * @param _evt custom modeChange event
   */
  modeListener (_evt: Event): void {
    const mode = this.#host.svgCanvas.getMode()
    this.setCursorStyle(mode)
  }

  /**
   * Sets cursor styling for the workarea depending on the current mode.
   */
  setCursorStyle (mode: string): void {
    let cs = 'auto'
    switch (mode) {
      case 'ext-panning':
        cs = 'grab'
        break
      case 'zoom':
      case 'shapelib':
        cs = 'crosshair'
        break
      case 'circle':
      case 'ellipse':
      case 'rect':
      case 'square':
      case 'star':
      case 'polygon':
        cs = `url("./images/cursors/${mode}_cursor.svg"), crosshair`
        break
      case 'text':
        cs = 'text'
        break
      default:
        cs = 'auto'
    }

    this.#host.workarea.style.cursor = cs
  }

  /**
   * Resize and reposition the canvas element, adjusting scroll to maintain the current view center.
   * @function module:SVGthis.updateCanvas
   */
  updateCanvas (center?: boolean, newCtr?: { x: number; y: number }): void {
    const zoom = this.#host.svgCanvas.getZoom()
    const { workarea } = this.#host
    const cnvs = $id('svgcanvas')
    if (!cnvs) return

    // One CSSStyleDeclaration covers both dimensions (and the center-branch read
    // below): the workarea is a layout-sized scroll container, so its computed
    // width/height are stable across the overflow toggle. Re-reading getComputedStyle
    // per dimension was redundant (#90).
    const workareaStyle = getComputedStyle(workarea, null)
    let w = parseFloat(workareaStyle.width.replace('px', ''))
    let h = parseFloat(workareaStyle.height.replace('px', ''))
    const wOrig = w
    const hOrig = h
    const oldCtr = {
      x: workarea.scrollLeft + wOrig / 2,
      y: workarea.scrollTop + hOrig / 2
    }
    const multi = this.#host.configObj.curConfig.canvas_expansion
    w = Math.max(wOrig, this.#host.svgCanvas.contentW * zoom * multi)
    h = Math.max(hOrig, this.#host.svgCanvas.contentH * zoom * multi)

    if (w === wOrig && h === hOrig) {
      workarea.style.overflow = 'hidden'
    } else {
      workarea.style.overflow = 'scroll'
    }

    // Both canvas dimensions from one declaration, read before its size is set below.
    const cnvsStyle = getComputedStyle(cnvs, null)
    const oldCanY = parseFloat(cnvsStyle.height.replace('px', '')) / 2
    const oldCanX = parseFloat(cnvsStyle.width.replace('px', '')) / 2

    cnvs.style.width = w + 'px'
    cnvs.style.height = h + 'px'
    const newCanY = h / 2
    const newCanX = w / 2
    const offset = this.#host.svgCanvas.updateCanvas(w, h)

    const ratio = newCanX / oldCanX

    const scrollX = w / 2 - wOrig / 2
    const scrollY = h / 2 - hOrig / 2

    if (!newCtr) {
      const oldDistX = oldCtr.x - oldCanX
      const newX = newCanX + oldDistX * ratio

      const oldDistY = oldCtr.y - oldCanY
      const newY = newCanY + oldDistY * ratio

      newCtr = {
        x: newX,
        y: newY
      }
    } else {
      newCtr.x += offset.x
      newCtr.y += offset.y
    }

    if (center) {
      // Go to top-left for larger documents
      if (
        this.#host.svgCanvas.contentW >
        parseFloat(workareaStyle.width.replace('px', ''))
      ) {
        // Top-left
        workarea.scrollLeft = offset.x - 10
        workarea.scrollTop = offset.y - 10
      } else {
        // Center
        workarea.scrollLeft = scrollX
        workarea.scrollTop = scrollY
      }
    } else {
      workarea.scrollLeft = newCtr.x - wOrig / 2
      workarea.scrollTop = newCtr.y - hOrig / 2
    }
    if (this.#host.configObj.curConfig.showRulers) {
      this.#host.rulers.updateRulers(cnvs, zoom)
      workarea.scroll()
    }

    if (
      this.#host.configObj.urldata.storagePrompt !== true &&
      this.#host.storagePromptState === 'ignore'
    ) {
      $id('dialog_box')?.style.setProperty('display', 'none')
    }
  }

  updateWireFrame (): void {
    const rule = `
      #workarea.wireframe #svgcontent * {
        stroke-width: ${1 / this.#host.svgCanvas.getZoom()}px;
      }
    `
    if (document.querySelectorAll('#wireframe_rules').length > 0) {
      ;(document.querySelector('#wireframe_rules') as HTMLElement).textContent =
        this.#host.workarea.classList.contains('wireframe') ? rule : ''
    }
  }

  zoomDone (): void {
    for (const el of this.#host.svgCanvas.selectedElements) {
      if (el) this.#host.svgCanvas.selectorManager.requestSelector(el)?.resize()
    }
    this.updateWireFrame()
  }

  /**
   * Handle a zoom event by computing the new zoom level and updating the canvas scroll position.
   * @function module:svgcanvas.SvgCanvas#zoomChanged
   * @listens module:svgcanvas.SvgCanvas#event:zoomed
   * @fires module:svgcanvas.SvgCanvas#event:ext_zoomChanged
   */
  zoomChanged (_win: unknown, bbox: unknown, autoCenter?: boolean): void {
    const scrbar = 15
    const zInfo = this.#host.svgCanvas.setBBoxZoom(
      bbox,
      parseFloat(
        getComputedStyle(this.#host.workarea, null).width.replace('px', '')
      ) - scrbar,
      parseFloat(
        getComputedStyle(this.#host.workarea, null).height.replace('px', '')
      ) - scrbar
    )
    if (!zInfo) {
      return
    }
    const zoomlevel = zInfo.zoom
    const bb = zInfo.bbox as { x: number; y: number; width: number; height: number }

    if (zoomlevel < 0.001) {
      this.#host.bottomPanel.changeZoom(String(0.1))
      return
    }

    ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (this.#host.svgCanvas.getZoom() * 100).toFixed(1))

    if (autoCenter) {
      this.updateCanvas(false, undefined)
    } else {
      this.updateCanvas(false, {
        x: bb.x * zoomlevel + (bb.width * zoomlevel) / 2,
        y: bb.y * zoomlevel + (bb.height * zoomlevel) / 2
      })
    }

    if (this.#host.svgCanvas.getMode() === 'zoom' && bb.width) {
      // Go to select if a zoom box was drawn
      this.#host.leftPanel.clickSelect()
    }

    this.zoomDone()

    this.#host.svgCanvas.runExtensions({
      action: 'zoomChanged',
      vars: this.#host.svgCanvas.getZoom()
    })
  }

  /**
   * @listens module:svgcanvas.SvgCanvas#event:contextset
   */
  contextChanged (_win: unknown, context: Element | null): void {
    let str = ''
    let parents: Element[] = []
    if (context) {
      parents = (getParentsUntil(context, '#svgcontent') ?? []) as Element[]
      parents.forEach((parent: Element) => {
        if (parent.id) { str += ' > ' + parent.id }
      })
      this.#host.curContext = str
    } else {
      this.#host.curContext = null
    }
    const ctxPanel = $id('cur_context_panel')
    if (ctxPanel) {
      ctxPanel.style.display = context ? 'block' : 'none'
      // Build the breadcrumb via the DOM API — a selected element's id or the layer
      // title is untrusted (both survive the import sanitizer unvalidated) (#47).
      if (context) {
        renderContextPanel(ctxPanel, this.#host.svgCanvas.getCurrentDrawing().getCurrentLayerName(), parents, context)
      } else {
        ctxPanel.replaceChildren()
      }
    }
  }
}
