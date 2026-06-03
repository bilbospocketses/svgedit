/**
 * @file ext-overview_window.js
 *
 * @license MIT
 *
 *
 */
import { dragmove } from './dragmove/dragmove.js'
import { getSvgEditor } from '../../svgEditorInstance.js'

export default {
  name: 'overview_window',
  init () {
    const svgEditor = getSvgEditor()
    const { $id, $click } = svgEditor.svgCanvas
    const overviewWindowGlobals: Record<string, boolean> = {}

    // Define and insert the base html element.
    const propsWindowHtml =
      '<div id="overview_window_content_pane" style="width:100%; word-wrap:break-word;  display:inline-block; margin-top:20px;">' +
        '<div id="overview_window_content" style="position:relative; padding-left:15px; top:0px;">' +
          '<div style="background-color:var(--se-surface-2); display:inline-block; overflow:visible;">' +
            '<svg id="overviewMiniView" width="132" height="100" x="0" y="0" viewBox="0 0 4800 3600" ' +
                'xmlns="http://www.w3.org/2000/svg" ' +
                'xmlns:xlink="http://www.w3.org/1999/xlink">' +
              '<use x="0" y="0" href="#svgroot"> </use>' +
            '</svg>' +
            '<div id="overview_window_view_box" style="min-width:50px; min-height:50px; position:absolute; top:30px; left:30px; z-index:5; background-color:var(--se-accent-subtle);">' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    $id('sidepanel_content')!.insertAdjacentHTML('beforeend', propsWindowHtml)

    // Define dynamic animation of the view box.
    const updateViewBox = () => {
      const { workarea } = svgEditor
      const portHeight = parseFloat(getComputedStyle(workarea, null).height.replace('px', ''))
      const portWidth = parseFloat(getComputedStyle(workarea, null).width.replace('px', ''))
      const portX = workarea.scrollLeft
      const portY = workarea.scrollTop
      const windowWidth = parseFloat(getComputedStyle($id('svgcanvas')!, null).width.replace('px', ''))
      const windowHeight = parseFloat(getComputedStyle($id('svgcanvas')!, null).height.replace('px', ''))
      const overviewWidth = parseFloat(getComputedStyle($id('overviewMiniView')!, null).width.replace('px', ''))
      const overviewHeight = parseFloat(getComputedStyle($id('overviewMiniView')!, null).height.replace('px', ''))

      const viewBoxX = portX / windowWidth * overviewWidth
      const viewBoxY = portY / windowHeight * overviewHeight
      const viewBoxWidth = portWidth / windowWidth * overviewWidth
      const viewBoxHeight = portHeight / windowHeight * overviewHeight

      $id('overview_window_view_box')!.style.minWidth = viewBoxWidth + 'px'
      $id('overview_window_view_box')!.style.minHeight = viewBoxHeight + 'px'
      $id('overview_window_view_box')!.style.top = viewBoxY + 'px'
      $id('overview_window_view_box')!.style.left = viewBoxX + 'px'
    }
    $id('workarea')!.addEventListener('scroll', () => {
      if (!(overviewWindowGlobals.viewBoxDragging)) {
        updateViewBox()
      }
    })
    $id('workarea')!.addEventListener('resize', updateViewBox)
    updateViewBox()

    // Compensate for changes in zoom and canvas size.
    const updateViewDimensions = function () {
      const viewWidth = parseFloat(getComputedStyle($id('svgroot')!, null).width.replace('px', ''))
      const viewHeight = parseFloat(getComputedStyle($id('svgroot')!, null).height.replace('px', ''))

      const viewX = 640
      const viewY = 480

      const svgWidthOld = parseFloat(getComputedStyle($id('overviewMiniView')!, null).width.replace('px', ''))
      const svgHeightNew = viewHeight / viewWidth * svgWidthOld
      $id('overviewMiniView')!.setAttribute('viewBox', viewX + ' ' + viewY + ' ' + viewWidth + ' ' + viewHeight)
      $id('overviewMiniView')!.setAttribute('height', String(svgHeightNew))
      updateViewBox()
    }
    updateViewDimensions()

    // Set up the overview window as a controller for the view port.
    overviewWindowGlobals.viewBoxDragging = false
    const updateViewPortFromViewBox = function () {
      const windowWidth = parseFloat(getComputedStyle($id('svgcanvas')!, null).width.replace('px', ''))
      const windowHeight = parseFloat(getComputedStyle($id('svgcanvas')!, null).height.replace('px', ''))
      const overviewWidth = parseFloat(getComputedStyle($id('overviewMiniView')!, null).width.replace('px', ''))
      const overviewHeight = parseFloat(getComputedStyle($id('overviewMiniView')!, null).height.replace('px', ''))
      const viewBoxX = parseFloat(getComputedStyle($id('overview_window_view_box')!, null).getPropertyValue('left').replace('px', ''))
      const viewBoxY = parseFloat(getComputedStyle($id('overview_window_view_box')!, null).getPropertyValue('top').replace('px', ''))

      const portX = viewBoxX / overviewWidth * windowWidth
      const portY = viewBoxY / overviewHeight * windowHeight
      $id('workarea')!.scrollLeft = portX
      $id('workarea')!.scrollTop = portY
    }
    const onStart = () => {
      overviewWindowGlobals.viewBoxDragging = true
      updateViewPortFromViewBox()
    }
    const onEnd = (el: HTMLElement, parent: Element, _x: number, _y: number) => {
      if ((el.offsetLeft + el.offsetWidth) > parseFloat(getComputedStyle(parent, null).width.replace('px', ''))) {
        el.style.left = (parseFloat(getComputedStyle(parent, null).width.replace('px', '')) - el.offsetWidth) + 'px'
      } else if (el.offsetLeft < 0) {
        el.style.left = '0px'
      }
      if ((el.offsetTop + el.offsetHeight) > parseFloat(getComputedStyle(parent, null).height.replace('px', ''))) {
        el.style.top = (parseFloat(getComputedStyle(parent, null).height.replace('px', '')) - el.offsetHeight) + 'px'
      } else if (el.offsetTop < 0) {
        el.style.top = '0px'
      }
      overviewWindowGlobals.viewBoxDragging = false
      updateViewPortFromViewBox()
    }
    const onDrag = function () {
      updateViewPortFromViewBox()
    }
    const dragElem = document.querySelector('#overview_window_view_box') as HTMLElement
    const parentElem = document.querySelector('#overviewMiniView') as Element
    dragmove(dragElem, dragElem, parentElem, onStart, onEnd, onDrag)

    $click($id('overviewMiniView')!, (evt: Event) => {
      const mouseEvt = evt as MouseEvent
      // Firefox doesn't support evt.offsetX and evt.offsetY.
      // TODO: see todo #10 — evt.originalEvent.layerX: non-standard; fix when reviving per todo #3
      const mouseX = mouseEvt.offsetX ?? (mouseEvt as MouseEvent & { originalEvent?: { layerX: number } }).originalEvent?.layerX ?? 0
      const mouseY = mouseEvt.offsetY ?? (mouseEvt as MouseEvent & { originalEvent?: { layerY: number } }).originalEvent?.layerY ?? 0
      const overviewWidth = parseFloat(getComputedStyle($id('overviewMiniView')!, null).width.replace('px', ''))
      const overviewHeight = parseFloat(getComputedStyle($id('overviewMiniView')!, null).height.replace('px', ''))
      const viewBoxWidth = parseFloat(getComputedStyle($id('overview_window_view_box')!, null).getPropertyValue('min-width').replace('px', ''))
      const viewBoxHeight = parseFloat(getComputedStyle($id('overview_window_view_box')!, null).getPropertyValue('min-height').replace('px', ''))

      let viewBoxX = mouseX - 0.5 * viewBoxWidth
      let viewBoxY = mouseY - 0.5 * viewBoxHeight
      // deal with constraints
      if (viewBoxX < 0) {
        viewBoxX = 0
      }
      if (viewBoxY < 0) {
        viewBoxY = 0
      }
      if (viewBoxX + viewBoxWidth > overviewWidth) {
        viewBoxX = overviewWidth - viewBoxWidth
      }
      if (viewBoxY + viewBoxHeight > overviewHeight) {
        viewBoxY = overviewHeight - viewBoxHeight
      }
      $id('overview_window_view_box')!.style.top = viewBoxY + 'px'
      $id('overview_window_view_box')!.style.left = viewBoxX + 'px'
      updateViewPortFromViewBox()
    })

    return {
      name: 'overview window',
      canvasUpdated: updateViewDimensions,
      workareaResized: updateViewBox
    }
  }
}
