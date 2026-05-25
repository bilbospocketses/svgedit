/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-non-null-assertion */
// editor / panel API surface is loosely typed; full typing deferred to follow-up
import SvgCanvas from '@svgedit/svgcanvas'
// @ts-expect-error: BottomPanel.html imported as string via vite-plugin-string; no ambient module declaration
import BottomPanelHtml from './BottomPanel.html'

const { $id } = SvgCanvas

/*
 * register actions for left panel
 */
/**
 */
class BottomPanel {
  editor: any

  /**
   * @param editor svgedit handler
   */
  constructor (editor: any) {
    this.editor = editor
  }

  /**
   */
  get selectedElement () {
    return this.editor.selectedElement
  }

  /**
   */
  get multiselected () {
    return this.editor.multiselected
  }

  /**
   */
  changeStrokeWidth (e: any): void {
    let val = e.target.value
    if (
      val === 0 &&
      this.editor.selectedElement &&
      ['line', 'polyline'].includes(this.editor.selectedElement.nodeName)
    ) {
      val = 1
    }
    this.editor.svgCanvas.setStrokeWidth(val)
  }

  /**
   */
  changeZoom (value: any): void {
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
        // if btn is pressed, change to select button
        if (($id(btn) as any).pressed) {
          this.editor.leftPanel.clickSelect()
        }
        ;($id(btn) as any).disabled = true
      })
    } else {
      buttonsNeedingStroke.forEach(btn => {
        ;($id(btn) as any).disabled = false
      })
    }
    if (bNoStroke && bNoFill) {
      buttonsNeedingFillAndStroke.forEach(btn => {
        // if btn is pressed, change to select button
        if (($id(btn) as any).pressed) {
          this.editor.leftPanel.clickSelect()
        }
        ;($id(btn) as any).disabled = true
      })
    } else {
      buttonsNeedingFillAndStroke.forEach(btn => {
        ;($id(btn) as any).disabled = false
      })
    }
    this.editor.svgCanvas.runExtensions({
      action: 'toolButtonStateUpdate',
      vars: { nofill: bNoFill, nostroke: bNoStroke }
    })
  }

  /**
   */
  handleColorPicker (type: any, evt: any): void {
    const { paint } = evt.detail
    this.editor.svgCanvas.setPaint(type, paint)
    this.updateToolButtonState()
  }

  /**
   */
  handleStrokeAttr (type: any, evt: any): void {
    this.editor.svgCanvas.setStrokeAttr(type, evt.detail.value)
  }

  /**
   */
  handleOpacity (evt: any): void {
    const val = Number.parseInt(evt.currentTarget.value.split('%')[0])
    this.editor.svgCanvas.setOpacity(val / 100)
  }

  /**
   */
  handlePalette (e: any): void {
    e.preventDefault()
    // shift key or right click for stroke
    const { picker, color } = e.detail
    // Webkit-based browsers returned 'initial' here for no stroke
    const paint =
      color === 'none'
        ? new SvgCanvas.Paint()
        : new SvgCanvas.Paint({ alpha: 100, solidColor: color.substr(1) })
    if (picker === 'fill') {
      ;($id('fill_color') as any).setPaint(paint)
    } else {
      ;($id('stroke_color') as any).setPaint(paint)
    }
    this.editor.svgCanvas.setColor(picker, color)
    if (
      color !== 'none' &&
      this.editor.svgCanvas.getPaintOpacity(picker) !== 1
    ) {
      this.editor.svgCanvas.setPaintOpacity(picker, 1.0)
    }
    this.updateToolButtonState()
  }

  /**
   */
  init (): void {
    // register actions for Bottom panel
    const template = document.createElement('template')
    const { i18next } = this.editor

    template.innerHTML = BottomPanelHtml
    this.editor.$svgEditor.append(template.content.cloneNode(true))
    $id('palette')!.addEventListener('change', this.handlePalette.bind(this))
    ;($id('palette') as any).init(i18next)
    const { curConfig } = this.editor.configObj
    ;($id('fill_color') as any).setPaint(
      new SvgCanvas.Paint({ alpha: 100, solidColor: curConfig.initFill.color })
    )
    ;($id('stroke_color') as any).setPaint(
      new SvgCanvas.Paint({
        alpha: 100,
        solidColor: curConfig.initStroke.color
      })
    )
    $id('zoom')!.addEventListener('change', (e: any) =>
      this.changeZoom.bind(this)(e.detail.value)
    )
    $id('stroke_color')!.addEventListener('change', (evt: any) =>
      this.handleColorPicker.bind(this)('stroke', evt)
    )
    $id('fill_color')!.addEventListener('change', (evt: any) =>
      this.handleColorPicker.bind(this)('fill', evt)
    )
    $id('stroke_width')!.addEventListener(
      'change',
      this.changeStrokeWidth.bind(this)
    )
    $id('stroke_style')!.addEventListener('change', (evt: any) =>
      this.handleStrokeAttr.bind(this)('stroke-dasharray', evt)
    )
    $id('stroke_linejoin')!.addEventListener('change', (evt: any) =>
      this.handleStrokeAttr.bind(this)('stroke-linejoin', evt)
    )
    $id('stroke_linecap')!.addEventListener('change', (evt: any) =>
      this.handleStrokeAttr.bind(this)('stroke-linecap', evt)
    )
    $id('opacity')!.addEventListener('change', this.handleOpacity.bind(this))
    ;($id('fill_color') as any).init(i18next)
    ;($id('stroke_color') as any).init(i18next)
  }

  /**
   */
  updateColorpickers (apply: any): void {
    ;($id('fill_color') as any).updatePaint(
      this.editor.svgCanvas,
      this.editor.selectedElement,
      apply
    )
    ;($id('stroke_color') as any).updatePaint(
      this.editor.svgCanvas,
      this.editor.selectedElement,
      apply
    )
  }
}

// Helper function to get the center of the workarea
const getWorkareaCenter = (workarea: any, zoom: number): { x: number; y: number } => {
  const width = parseFloat(getComputedStyle(workarea).width.replace('px', ''))
  const height = parseFloat(getComputedStyle(workarea).height.replace('px', ''))
  return {
    x: (workarea.scrollLeft + width / 2) / zoom,
    y: (workarea.scrollTop + height / 2) / zoom
  }
}

export default BottomPanel
