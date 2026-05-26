// https://github.com/knadh/dragmove.js
// Kailash Nadh (c) 2020.
// MIT License.
// can't use npm version as the dragmove is different.

let _loaded = false
const _callbacks: Array<(x: number, y: number) => void> = []
const _isTouch = window.ontouchstart !== undefined

export const dragmove = function (
  target: HTMLElement,
  handler: HTMLElement,
  parent: Element,
  onStart: (target: HTMLElement, lastX: number, lastY: number) => void,
  onEnd: (target: HTMLElement, parent: Element, x: number, y: number) => void,
  onDrag: (target: HTMLElement, x: number, y: number) => void
): void {
  // Register a global event to capture mouse moves (once).
  if (!_loaded) {
    document.addEventListener(_isTouch ? 'touchmove' : 'mousemove', function (e: Event) {
      const me = e as MouseEvent & { touches?: TouchList }
      let clientX: number
      let clientY: number
      if (me.touches && me.touches.length > 0) {
        clientX = me.touches[0]!.clientX
        clientY = me.touches[0]!.clientY
      } else {
        clientX = me.clientX
        clientY = me.clientY
      }

      // On mouse move, dispatch the coords to all registered callbacks.
      for (const cb of _callbacks) {
        cb(clientX, clientY)
      }
    })
  }

  _loaded = true
  let isMoving = false; let hasStarted = false
  let startX = 0; let startY = 0; let lastX = 0; let lastY = 0

  // On the first click and hold, record the offset of the pointer in relation
  // to the point of click inside the element.
  handler.addEventListener(_isTouch ? 'touchstart' : 'mousedown', function (e: Event) {
    e.stopPropagation()
    e.preventDefault()
    if (target.dataset.dragEnabled === 'false') {
      return
    }

    const me = e as MouseEvent & { touches?: TouchList }
    let clientX: number
    let clientY: number
    if (me.touches && me.touches.length > 0) {
      clientX = me.touches[0]!.clientX
      clientY = me.touches[0]!.clientY
    } else {
      clientX = me.clientX
      clientY = me.clientY
    }

    isMoving = true
    startX = target.offsetLeft - clientX
    startY = target.offsetTop - clientY
  })

  // On leaving click, stop moving.
  document.addEventListener(_isTouch ? 'touchend' : 'mouseup', function () {
    if (onEnd && hasStarted) {
      onEnd(target, parent, parseInt(target.style.left), parseInt(target.style.top))
    }

    isMoving = false
    hasStarted = false
  })

  // On leaving click, stop moving.
  document.addEventListener(_isTouch ? 'touchmove' : 'mousemove', function () {
    if (onDrag && hasStarted) {
      onDrag(target, parseInt(target.style.left), parseInt(target.style.top))
    }
  })

  // Register mouse-move callback to move the element.
  _callbacks.push(function move (x: number, y: number) {
    if (!isMoving) {
      return
    }

    if (!hasStarted) {
      hasStarted = true
      if (onStart) {
        onStart(target, lastX, lastY)
      }
    }

    lastX = x + startX
    lastY = y + startY

    // If boundary checking is on, don't let the element cross the viewport.
    if (target.dataset.dragBoundary === 'true') {
      if (lastX < 1 || lastX >= window.innerWidth - target.offsetWidth) {
        return
      }
      if (lastY < 1 || lastY >= window.innerHeight - target.offsetHeight) {
        return
      }
    }

    target.style.left = lastX + 'px'
    target.style.top = lastY + 'px'
  })
}

export { dragmove as default }
