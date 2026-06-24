// http://ross.posterous.com/2008/08/19/iphone-touch-events-in-javascript/

import type { ISvgCanvas } from './svgcanvas-types.js'

const touchHandler = (ev: TouchEvent): void => {
  ev.preventDefault()
  const { changedTouches } = ev
  const first = changedTouches[0]
  if (!first) return

  let type: string
  switch (ev.type) {
    case 'touchstart': type = 'mousedown'; break
    case 'touchmove': type = 'mousemove'; break
    case 'touchend': type = 'mouseup'; break
    case 'touchcancel': type = 'mouseup'; break
    default: return
  }

  const { screenX, screenY, clientX, clientY } = first
  const simulatedEvent = new MouseEvent(type, {
    // Event interface
    bubbles: true,
    cancelable: true,
    // UIEvent interface
    view: window,
    detail: 1, // click count
    // MouseEvent interface (customized)
    screenX,
    screenY,
    clientX,
    clientY,
    // MouseEvent interface (defaults) - these could be removed
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    button: 0, // main button (usually left)
    relatedTarget: null
  })
  if (changedTouches.length < 2) {
    first.target?.dispatchEvent(simulatedEvent)
  }
}

/** Registers touch-to-mouse event shims on the SVG root so touch devices behave like mouse input. */
export const init = (svgCanvas: ISvgCanvas): void => {
  svgCanvas.svgroot.addEventListener('touchstart', touchHandler as EventListener)
  svgCanvas.svgroot.addEventListener('touchmove', touchHandler as EventListener)
  svgCanvas.svgroot.addEventListener('touchend', touchHandler as EventListener)
  svgCanvas.svgroot.addEventListener('touchcancel', touchHandler as EventListener)
}
