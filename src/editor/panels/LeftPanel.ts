import SvgCanvas from '@svgedit/svgcanvas'
import type Editor from '../Editor.js'
import type { SeButtonElement } from '../typed-events.js'
import leftPanelHTML from './LeftPanel.html'

const { $id, $qa, $click } = SvgCanvas

/** Null-safe wrapper around $click — skips if element is null. */
const safeClick = (el: HTMLElement | null, handler: EventListenerOrEventListenerObject): void => {
  if (el) $click(el, handler)
}

/*
 * register actions for left panel
 */
class LeftPanel {
  editor: Editor

  /**
   * @param editor svgedit handler
   */
  constructor (editor: Editor) {
    this.editor = editor
  }

  /**
   * This is a common function used when a tool has been clicked (chosen).
   * It does several common things:
   * - Removes the pressed button from whatever tool currently has it.
   * - Adds the the pressed button  to the button passed in.
   * @function this.updateLeftPanel
   * @param button The DOM element or string selector representing the toolbar button
   */
  updateLeftPanel (button: string): boolean {
    const btnEl = $id(button) as SeButtonElement | null
    if (btnEl?.disabled) return false
    // remove the pressed state on other(s) button(s)
    $qa('#tools_left *[pressed]').forEach((b: Element) => {
      ;(b as SeButtonElement).pressed = false
    })
    // pressed state for the clicked button
    if (btnEl) btnEl.pressed = true
    return true
  }

  /**
   * Unless the select toolbar button is disabled, sets the button
   * and sets the select mode and cursor styles.
   * @function module:SVGEditor.clickSelect
   */
  clickSelect () {
    if (this.updateLeftPanel('tool_select')) {
      // this.editor.workarea.style.cursor = 'auto'
      this.editor.svgCanvas.setMode('select')
    }
  }

  clickFHPath () {
    if (this.updateLeftPanel('tool_fhpath')) {
      this.editor.svgCanvas.setMode('fhpath')
    }
  }

  clickLine () {
    if (this.updateLeftPanel('tool_line')) {
      this.editor.svgCanvas.setMode('line')
    }
  }

  clickSquare () {
    if (this.updateLeftPanel('tool_square')) {
      this.editor.svgCanvas.setMode('square')
    }
  }

  clickRect () {
    if (this.updateLeftPanel('tool_rect')) {
      this.editor.svgCanvas.setMode('rect')
    }
  }

  clickFHRect () {
    if (this.updateLeftPanel('tool_fhrect')) {
      this.editor.svgCanvas.setMode('fhrect')
    }
  }

  clickCircle () {
    if (this.updateLeftPanel('tool_circle')) {
      this.editor.svgCanvas.setMode('circle')
    }
  }

  clickEllipse () {
    if (this.updateLeftPanel('tool_ellipse')) {
      this.editor.svgCanvas.setMode('ellipse')
    }
  }

  clickFHEllipse () {
    if (this.updateLeftPanel('tool_fhellipse')) {
      this.editor.svgCanvas.setMode('fhellipse')
    }
  }

  clickImage () {
    if (this.updateLeftPanel('tool_image')) {
      this.editor.svgCanvas.setMode('image')
    }
  }

  clickZoom () {
    if (this.updateLeftPanel('tool_zoom')) {
      this.editor.svgCanvas.setMode('zoom')
      this.editor.workarea.style.cursor = 'crosshair'
    }
  }

  dblclickZoom () {
    if (this.updateLeftPanel('tool_zoom')) {
      this.editor.zoomImage()
      this.clickSelect()
    }
  }

  clickText () {
    if (this.updateLeftPanel('tool_text')) {
      this.editor.svgCanvas.setMode('text')
    }
  }

  clickPath () {
    if (this.updateLeftPanel('tool_path')) {
      this.editor.svgCanvas.setMode('path')
    }
  }

  clickForeign () {
    if (this.updateLeftPanel('tool_foreign')) {
      this.editor.svgCanvas.setMode('foreign')
    }
  }

  add (id: string, handler: () => void): void {
    safeClick($id(id), () => {
      if (this.updateLeftPanel(id)) {
        handler()
      }
    })
  }

  init (): void {
    // add Left panel
    const template = document.createElement('template')
    template.innerHTML = leftPanelHTML
    this.editor.$svgEditor.append(template.content.cloneNode(true))
    // register actions for left panel
    safeClick($id('tool_select'), this.clickSelect.bind(this))
    safeClick($id('tool_fhpath'), this.clickFHPath.bind(this))
    safeClick($id('tool_text'), this.clickText.bind(this))
    safeClick($id('tool_image'), this.clickImage.bind(this))
    safeClick($id('tool_foreign'), this.clickForeign.bind(this))
    safeClick($id('tool_zoom'), this.clickZoom.bind(this))
    $id('tool_zoom')?.addEventListener('dblclick', this.dblclickZoom.bind(this))
    safeClick($id('tool_path'), this.clickPath.bind(this))
    safeClick($id('tool_line'), this.clickLine.bind(this))

    // flyout
    safeClick($id('tool_rect'), this.clickRect.bind(this))
    safeClick($id('tool_square'), this.clickSquare.bind(this))
    safeClick($id('tool_fhrect'), this.clickFHRect.bind(this))
    safeClick($id('tool_ellipse'), this.clickEllipse.bind(this))
    safeClick($id('tool_circle'), this.clickCircle.bind(this))
    safeClick($id('tool_fhellipse'), this.clickFHEllipse.bind(this))
  }
}

export default LeftPanel
