import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import * as history from '../../packages/svgcanvas/core/history.js'
import dataStorage from '../../packages/svgcanvas/core/dataStorage.js'
import { init as initElemGetSet } from '../../packages/svgcanvas/core/elem-get-set.js'
import * as undo from '../../packages/svgcanvas/core/undo.js'
import type { ISvgCanvas } from '../../packages/svgcanvas/core/svgcanvas-types.js'

const createSvgElement = (name: string) => {
  return document.createElementNS(NS.SVG, name)
}

describe('elem-get-set', () => {
  let canvas: ISvgCanvas
  let historyStack: history.Command[]
  let svgContent: SVGSVGElement

  beforeEach(() => {
    historyStack = []
    svgContent = createSvgElement('svg') as SVGSVGElement
    canvas = {
      history,
      zoom: 1,
      contentW: 100,
      contentH: 100,
      selectorManager: {
        requestSelector () {
          return { resize () {} }
        }
      },
      pathActions: {
        zoomChange () {},
        clear () {}
      },
      runExtensions () {},
      call: vi.fn(),
      changeSelectedAttribute: vi.fn(),
      changeSelectedAttributeNoUndo: vi.fn(),
      getDOMDocument () { return document },
      getSvgContent () { return svgContent },
      getSelectedElements () { return this.selectedElements || [] },
      getDataStorage () { return dataStorage },
      getZoom () { return this.zoom },
      setZoom (value: number) { this.zoom = value },
      getResolution () {
        return {
          w: Number(svgContent.getAttribute('width')) / this.zoom,
          h: Number(svgContent.getAttribute('height')) / this.zoom,
          zoom: this.zoom
        }
      },
      addCommandToHistory (cmd: history.Command) {
        historyStack.push(cmd)
      },
      setCurShape () {},
      setCurProperties () {},
      getMode () { return '' },
      setCurText: vi.fn(),
      textActions: {
        setCursor () {}
      }
    }
    svgContent.setAttribute('width', '100')
    svgContent.setAttribute('height', '100')
    initElemGetSet(canvas)
  })

  afterEach(() => {
    while (svgContent.firstChild) {
      svgContent.firstChild.remove()
    }
  })

  it('setGroupTitle() inserts title and undo removes it', () => {
    const g = createSvgElement('g')
    svgContent.append(g)
    canvas.selectedElements = [g]

    canvas.setGroupTitle('Hello')
    expect(g.firstChild?.nodeName).toBe('title')
    expect(g.firstChild?.textContent).toBe('Hello')
    expect(historyStack).toHaveLength(1)

    historyStack[0]!.unapply(null)
    expect(g.querySelector('title')).toBeNull()

    historyStack[0]!.apply(null)
    expect(g.querySelector('title')?.textContent).toBe('Hello')
  })

  it('setGroupTitle() updates title text with undo/redo', () => {
    const g = createSvgElement('g')
    const title = createSvgElement('title')
    title.textContent = 'Old'
    g.append(title)
    svgContent.append(g)
    canvas.selectedElements = [g]

    canvas.setGroupTitle('New')
    expect(g.querySelector('title')?.textContent).toBe('New')
    expect(historyStack).toHaveLength(1)

    historyStack[0]!.unapply(null)
    expect(g.querySelector('title')?.textContent).toBe('Old')

    historyStack[0]!.apply(null)
    expect(g.querySelector('title')?.textContent).toBe('New')
  })

  it('setGroupTitle() removes title and undo restores it', () => {
    const g = createSvgElement('g')
    const title = createSvgElement('title')
    title.textContent = 'Label'
    g.append(title)
    svgContent.append(g)
    canvas.selectedElements = [g]

    canvas.setGroupTitle('')
    expect(g.querySelector('title')).toBeNull()
    expect(historyStack).toHaveLength(1)

    historyStack[0]!.unapply(null)
    expect(g.querySelector('title')?.textContent).toBe('Label')

    historyStack[0]!.apply(null)
    expect(g.querySelector('title')).toBeNull()
  })

  // Audit #29 item #4: setStrokeWidth gains a `preventUndo` flag so the toolbar
  // can live-preview each keystroke without recording a per-keystroke command
  // (the editor wraps the previews in one beginUndoableChange/finishUndoableChange).
  it('setStrokeWidth() records undo by default (changeSelectedAttribute) (#4)', () => {
    const rect = createSvgElement('rect')
    svgContent.append(rect)
    canvas.selectedElements = [rect]

    canvas.setStrokeWidth(5)

    expect(canvas.changeSelectedAttribute).toHaveBeenCalledWith('stroke-width', 5, [rect])
    expect(canvas.changeSelectedAttributeNoUndo).not.toHaveBeenCalled()
  })

  it('setStrokeWidth(val, true) previews without undo (changeSelectedAttributeNoUndo) (#4)', () => {
    const rect = createSvgElement('rect')
    svgContent.append(rect)
    canvas.selectedElements = [rect]

    canvas.setStrokeWidth(5, true)

    expect(canvas.changeSelectedAttributeNoUndo).toHaveBeenCalledWith('stroke-width', 5, [rect])
    expect(canvas.changeSelectedAttribute).not.toHaveBeenCalled()
  })

  // Audit #29 item #4 (tier 2): setRectRadius gains a `preventUndo` flag so the
  // editor can live-preview rx/ry without recording a per-keystroke command (it
  // snapshots the originals and records one command on commit, since rx+ry change
  // together and beginUndoableChange tracks a single attribute).
  it('setRectRadius() sets rx/ry and records one command by default (#4)', () => {
    const rect = createSvgElement('rect')
    svgContent.append(rect)
    canvas.selectedElements = [rect]

    canvas.setRectRadius(8)

    expect(rect.getAttribute('rx')).toBe('8')
    expect(rect.getAttribute('ry')).toBe('8')
    expect(historyStack).toHaveLength(1)
  })

  it('setRectRadius(val, true) previews rx/ry without recording undo (#4)', () => {
    const rect = createSvgElement('rect')
    svgContent.append(rect)
    canvas.selectedElements = [rect]

    canvas.setRectRadius(8, true)

    expect(rect.getAttribute('rx')).toBe('8')
    expect(rect.getAttribute('ry')).toBe('8')
    expect(historyStack).toHaveLength(0)
  })

  it('setDocumentTitle() inserts and removes title with undo/redo', () => {
    canvas.setDocumentTitle('Doc')
    const docTitle = svgContent.querySelector(':scope > title')
    expect(docTitle?.textContent).toBe('Doc')
    expect(historyStack).toHaveLength(1)

    historyStack[0]!.unapply(null)
    expect(svgContent.querySelector(':scope > title')).toBeNull()

    historyStack[0]!.apply(null)
    expect(svgContent.querySelector(':scope > title')?.textContent).toBe('Doc')
  })

  it('setDocumentTitle() does nothing when empty and no title exists', () => {
    canvas.setDocumentTitle('')
    expect(svgContent.querySelector(':scope > title')).toBeNull()
    expect(historyStack).toHaveLength(0)
  })

  it('setBBoxZoom() returns the computed zoom for zero-size bbox', () => {
    canvas.zoom = 1
    canvas.selectedElements = [createSvgElement('rect')]

    const bbox = { width: 0, height: 0, x: 0, y: 0, factor: 2 }
    const result = canvas.setBBoxZoom(bbox, 100, 100)

    expect(result?.zoom).toBe(2)
    expect(canvas.getZoom()).toBe(2)
  })

  it('setImageURL() records undo even when image fails to load', () => {
    const originalImage = globalThis.Image
    try {
      globalThis.Image = class FakeImage {
        constructor () {
          this.width = 10
          this.height = 10
          this.onload = null
          this.onerror = null
        }

        get src () {
          return this._src
        }

        set src (value) {
          this._src = value
          this.onerror?.(new Error('load failed'))
        }
      }

      const image = createSvgElement('image')
      image.setAttribute('href', 'old.png')
      svgContent.append(image)
      canvas.selectedElements = [image]

      canvas.setImageURL('bad.png')
      expect(image.getAttribute('href')).toBe('bad.png')
      expect(historyStack).toHaveLength(1)

      historyStack[0]!.unapply(null)
      expect(image.getAttribute('href')).toBe('old.png')

      historyStack[0]!.apply(null)
      expect(image.getAttribute('href')).toBe('bad.png')
    } finally {
      globalThis.Image = originalImage
    }
  })

  it('setRectRadius() preserves attribute absence on undo', () => {
    const rect = createSvgElement('rect')
    svgContent.append(rect)
    canvas.selectedElements = [rect]

    canvas.setRectRadius('5')
    expect(rect.getAttribute('rx')).toBe('5')
    expect(rect.getAttribute('ry')).toBe('5')
    expect(historyStack).toHaveLength(1)

    historyStack[0]!.unapply(null)
    expect(rect.hasAttribute('rx')).toBe(false)
    expect(rect.hasAttribute('ry')).toBe(false)
  })

  it('undo updates contentW/contentH for svgContent size changes', () => {
    const svg = createSvgElement('svg')

    const localCanvas = {
      contentW: 100,
      contentH: 100,
      getSvgContent () { return svg },
      clearSelection () {},
      pathActions: { clear () {} },
      call () {}
    }
    undo.init(localCanvas)

    svg.setAttribute('width', '200')
    svg.setAttribute('height', '150')
    localCanvas.contentW = 200
    localCanvas.contentH = 150
    const cmd = new history.ChangeElementCommand(svg, { width: 100, height: 100 })
    localCanvas.undoMgr.addCommandToHistory(cmd)

    localCanvas.undoMgr.undo()
    expect(localCanvas.contentW).toBe(100)
    expect(localCanvas.contentH).toBe(100)

    localCanvas.undoMgr.redo()
    expect(localCanvas.contentW).toBe(200)
    expect(localCanvas.contentH).toBe(150)
  })

  it('setBold() emits changed only for modified text elements', () => {
    const text = createSvgElement('text')
    text.textContent = 'Hello'
    const rect = createSvgElement('rect')
    svgContent.append(text, rect)
    canvas.selectedElements = [text, rect]

    canvas.setBold(true)

    expect(canvas.changeSelectedAttribute).toHaveBeenCalledWith('font-weight', 'bold', [text])
    expect(canvas.call).toHaveBeenCalledWith('changed', [text])
  })

  it('setBold() skips changed event for no-op text updates', () => {
    const text = createSvgElement('text')
    text.textContent = 'Hello'
    text.setAttribute('font-weight', 'bold')
    svgContent.append(text)
    canvas.selectedElements = [text]

    canvas.setBold(true)

    expect(canvas.changeSelectedAttribute).not.toHaveBeenCalled()
    expect(canvas.call).not.toHaveBeenCalled()
  })

  it('setFontColor() ignores non-text selections when emitting changed', () => {
    const text = createSvgElement('text')
    text.textContent = 'Hello'
    const rect = createSvgElement('rect')
    svgContent.append(text, rect)
    canvas.selectedElements = [text, rect]

    canvas.setFontColor('#f00')

    expect(canvas.changeSelectedAttribute).toHaveBeenCalledWith('fill', '#f00', [text])
    expect(canvas.call).toHaveBeenCalledWith('changed', [text])
  })

  // --- #99 group-flatten characterization (collectNonGroupElements) ---
  it('setStrokeWidth() flattens a group selection to its non-group descendants', () => {
    const g = createSvgElement('g')
    const r1 = createSvgElement('rect')
    const r2 = createSvgElement('rect')
    g.append(r1, r2)
    svgContent.append(g)
    canvas.selectedElements = [g]

    canvas.setStrokeWidth(3)

    const [attr, val, els] = canvas.changeSelectedAttribute.mock.calls[0]
    expect(attr).toBe('stroke-width')
    expect(val).toBe(3)
    expect(new Set(els)).toEqual(new Set([r1, r2]))
  })

  it('setStrokeAttr() flattens a group selection to its non-group descendants', () => {
    const g = createSvgElement('g')
    const r1 = createSvgElement('rect')
    const c1 = createSvgElement('circle')
    g.append(r1, c1)
    svgContent.append(g)
    canvas.selectedElements = [g]

    canvas.setStrokeAttr('stroke-dasharray', '5,5')

    const [attr, val, els] = canvas.changeSelectedAttribute.mock.calls[0]
    expect(attr).toBe('stroke-dasharray')
    expect(val).toBe('5,5')
    expect(new Set(els)).toEqual(new Set([r1, c1]))
  })

  it('setColor() excludes top-level polyline/line for fill but keeps them inside groups', () => {
    const topLine = createSvgElement('line')
    const topRect = createSvgElement('rect')
    const g = createSvgElement('g')
    const innerLine = createSvgElement('line')
    g.append(innerLine)
    svgContent.append(topLine, topRect, g)
    canvas.selectedElements = [topLine, topRect, g]

    canvas.setColor('fill', '#0f0')

    const [attr, val, els] = canvas.changeSelectedAttribute.mock.calls[0]
    expect(attr).toBe('fill')
    expect(val).toBe('#0f0')
    // Top-level line excluded for fill; top-level rect kept; the line nested in
    // the group is flattened in WITHOUT the exclusion (asymmetry is preserved).
    expect(new Set(els)).toEqual(new Set([topRect, innerLine]))
  })

  // --- #100 text-setter scaffold characterization (applyTextAttr) ---
  it('setFontFamily() sets curText and emits changed for modified text', () => {
    const text = createSvgElement('text')
    text.textContent = 'Hi'
    svgContent.append(text)
    canvas.selectedElements = [text]

    canvas.setFontFamily('serif')

    expect(canvas.setCurText).toHaveBeenCalledWith('font_family', 'serif')
    expect(canvas.changeSelectedAttribute).toHaveBeenCalledWith('font-family', 'serif', [text])
    expect(canvas.call).toHaveBeenCalledWith('changed', [text])
  })

  it('setTextAnchor() emits changed for modified text without touching curText', () => {
    const text = createSvgElement('text')
    text.textContent = 'Hi'
    svgContent.append(text)
    canvas.selectedElements = [text]

    canvas.setTextAnchor('middle')

    expect(canvas.setCurText).not.toHaveBeenCalled()
    expect(canvas.changeSelectedAttribute).toHaveBeenCalledWith('text-anchor', 'middle', [text])
    expect(canvas.call).toHaveBeenCalledWith('changed', [text])
  })
})
