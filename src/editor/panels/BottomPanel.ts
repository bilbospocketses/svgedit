import SvgCanvas from '@svgedit/svgcanvas'
import type Editor from '../Editor.js'
import {
  typedDetail,
  type SeChangeDetail,
  type SePaintDetail,
  type SePaletteDetail,
  type SeButtonElement,
  type SePaintPickerElement,
  type SePaletteElement
} from '../typed-events.js'
import BottomPanelHtml from './BottomPanel.html'

const { $id } = SvgCanvas

/*
 * register actions for left panel
 */
class BottomPanel {
  editor: Editor

  /**
   * @param editor svgedit handler
   */
  constructor (editor: Editor) {
    this.editor = editor
  }

  get selectedElement () {
    return this.editor.selectedElement
  }

  get multiselected () {
    return this.editor.multiselected
  }

  changeStrokeWidth (e: Event): void {
    let val = Number((e.target as HTMLInputElement).value)
    if (
      val === 0 &&
      this.editor.selectedElement &&
      ['line', 'polyline'].includes(this.editor.selectedElement.nodeName)
    ) {
      val = 1
    }
    this.editor.svgCanvas.setStrokeWidth(val)
  }

  changeZoom (value: string): void {
    switch (value) {
      case 'canvas':
      case 'selection':
      case 'layer':
      case 'content':
        this.editor.zoomChanged(window, value)
        break
      default: {
        const newZoom = Number(value) > 0.1 ? Number(value) * 0.01 : 0.1
        const zoom = this.editor.svgCanvas.getZoom()
        if (this.editor.svgCanvas.getMode() === 'pathedit') {
          // In pathedit mode, use zoomImage to update path points correctly.
          this.editor.zoomImage(newZoom / zoom)
        } else {
          const { workarea } = this.editor
          // Use helper function to compute center only once.
          const center = getWorkareaCenter(workarea, zoom)
          this.editor.zoomChanged(
            window,
            {
              width: 0,
              height: 0,
              x: center.x,
              y: center.y,
              zoom: newZoom
            },
            true
          )
        }
      }
    }
  }

  /**
   * @fires module:svgcanvas.SvgCanvas#event:ext_toolButtonStateUpdate
   */
  updateToolButtonState (): void {
    const bNoFill = this.editor.svgCanvas.getColor('fill') === 'none'
    const bNoStroke = this.editor.svgCanvas.getColor('stroke') === 'none'
    const buttonsNeedingStroke = ['tool_fhpath', 'tool_line']
    const buttonsNeedingFillAndStroke = [
      'tools_rect',
      'tools_ellipse',
      'tool_text',
      'tool_path'
    ]

    if (bNoStroke) {
      buttonsNeedingStroke.forEach(btn => {
        const el = $id(btn) as SeButtonElement | null
        // if btn is pressed, change to select button
        if (el?.pressed) {
          this.editor.leftPanel.clickSelect()
        }
        if (el) el.disabled = true
      })
    } else {
      buttonsNeedingStroke.forEach(btn => {
        const el = $id(btn) as SeButtonElement | null
        if (el) el.disabled = false
      })
    }
    if (bNoStroke && bNoFill) {
      buttonsNeedingFillAndStroke.forEach(btn => {
        const el = $id(btn) as SeButtonElement | null
        // if btn is pressed, change to select button
        if (el?.pressed) {
          this.editor.leftPanel.clickSelect()
        }
        if (el) el.disabled = true
      })
    } else {
      buttonsNeedingFillAndStroke.forEach(btn => {
        const el = $id(btn) as SeButtonElement | null
        if (el) el.disabled = false
      })
    }
    this.editor.svgCanvas.runExtensions({
      action: 'toolButtonStateUpdate',
      vars: { nofill: bNoFill, nostroke: bNoStroke }
    })
  }

  handleColorPicker (type: string, evt: Event): void {
    const { paint } = typedDetail<SePaintDetail>(evt)
    this.editor.svgCanvas.setPaint(type, paint)
    this.updateToolButtonState()
  }

  handleStrokeAttr (type: string, evt: Event): void {
    this.editor.svgCanvas.setStrokeAttr(type, typedDetail<SeChangeDetail>(evt).value)
  }

  handleOpacity (evt: Event): void {
    const target = evt.currentTarget as HTMLInputElement
    const val = Number.parseInt(target.value.split('%')[0] ?? '0')
    this.editor.svgCanvas.setOpacity(String(val / 100))
  }

  handlePalette (e: Event): void {
    e.preventDefault()
    // shift key or right click for stroke
    const { picker, color } = typedDetail<SePaletteDetail>(e)
    // Webkit-based browsers returned 'initial' here for no stroke
    const paint =
      color === 'none'
        ? new SvgCanvas.Paint()
        : new SvgCanvas.Paint({ alpha: 100, solidColor: color.substr(1) })
    if (picker === 'fill') {
      ;($id('fill_color') as SePaintPickerElement | null)?.setPaint(paint)
    } else {
      ;($id('stroke_color') as SePaintPickerElement | null)?.setPaint(paint)
    }
    this.editor.svgCanvas.setColor(picker, color)
    if (
      color !== 'none' &&
      this.editor.svgCanvas.getPaintOpacity(picker as 'fill' | 'stroke') !== 1
    ) {
      this.editor.svgCanvas.setPaintOpacity(picker, 1.0)
    }
    this.updateToolButtonState()
  }

  init (): void {
    // register actions for Bottom panel
    const template = document.createElement('template')
    const { i18next } = this.editor

    template.innerHTML = BottomPanelHtml
    this.editor.$svgEditor.append(template.content.cloneNode(true))
    $id('palette')?.addEventListener('change', this.handlePalette.bind(this))
    ;($id('palette') as SePaletteElement | null)?.init(i18next)
    const { curConfig } = this.editor.configObj
    ;($id('fill_color') as SePaintPickerElement | null)?.setPaint(
      new SvgCanvas.Paint({ alpha: 100, solidColor: curConfig.initFill.color })
    )
    ;($id('stroke_color') as SePaintPickerElement | null)?.setPaint(
      new SvgCanvas.Paint({
        alpha: 100,
        solidColor: curConfig.initStroke.color
      })
    )
    $id('zoom')?.addEventListener('change', (e: Event) =>
      this.changeZoom(typedDetail<SeChangeDetail>(e).value)
    )
    $id('stroke_color')?.addEventListener('change', (evt: Event) =>
      this.handleColorPicker('stroke', evt)
    )
    $id('fill_color')?.addEventListener('change', (evt: Event) =>
      this.handleColorPicker('fill', evt)
    )
    $id('stroke_width')?.addEventListener(
      'change',
      this.changeStrokeWidth.bind(this)
    )
    $id('stroke_style')?.addEventListener('change', (evt: Event) =>
      this.handleStrokeAttr('stroke-dasharray', evt)
    )
    $id('stroke_linejoin')?.addEventListener('change', (evt: Event) =>
      this.handleStrokeAttr('stroke-linejoin', evt)
    )
    $id('stroke_linecap')?.addEventListener('change', (evt: Event) =>
      this.handleStrokeAttr('stroke-linecap', evt)
    )
    $id('opacity')?.addEventListener('change', this.handleOpacity.bind(this))
    ;($id('fill_color') as SePaintPickerElement | null)?.init(i18next)
    ;($id('stroke_color') as SePaintPickerElement | null)?.init(i18next)
  }

  updateColorpickers (apply: boolean): void {
    ;($id('fill_color') as SePaintPickerElement | null)?.updatePaint(
      this.editor.svgCanvas,
      this.editor.selectedElement,
      apply
    )
    ;($id('stroke_color') as SePaintPickerElement | null)?.updatePaint(
      this.editor.svgCanvas,
      this.editor.selectedElement,
      apply
    )
  }
}

// Helper function to get the center of the workarea
const getWorkareaCenter = (workarea: HTMLElement, zoom: number): { x: number; y: number } => {
  const width = parseFloat(getComputedStyle(workarea).width.replace('px', ''))
  const height = parseFloat(getComputedStyle(workarea).height.replace('px', ''))
  return {
    x: (workarea.scrollLeft + width / 2) / zoom,
    y: (workarea.scrollTop + height / 2) / zoom
  }
}

export default BottomPanel
