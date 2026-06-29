import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { init as textActionsInit, textActionsMethod } from '../../packages/svgcanvas/core/text-actions.js'
import { init as utilitiesInit } from '../../packages/svgcanvas/core/utilities.js'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import type { ISvgCanvas } from '../../packages/svgcanvas/core/svgcanvas-types.js'

type MockSelectorManager = {
  requestSelector: Mock
}

type MockSvgCanvas = {
  getSvgRoot: () => SVGSVGElement
  getSvgContent: () => SVGSVGElement
  getZoom: () => number
  setCurrentMode: Mock
  notifyModeChange: Mock
  clearSelection: Mock
  addToSelection: Mock
  deleteSelectedElements: Mock
  call: Mock
  getSelectedElements: () => SVGTextElement[]
  getCurrentMode: () => string
  selectorManager: MockSelectorManager
  getRootSctm: () => DOMMatrix | { a: number, b: number, c: number, d: number, e: number, f: number }
  $click: Mock
  contentW: number
  textActions: typeof textActionsMethod
}

describe('TextActions', () => {
  let svgCanvas: MockSvgCanvas
  let svgRoot: SVGSVGElement
  let textElement: SVGTextElement
  let inputElement: HTMLInputElement
  let mockSelectorManager: MockSelectorManager

  beforeEach(() => {
    // Create mock SVG elements
    svgRoot = document.createElementNS(NS.SVG, 'svg')
    svgRoot.setAttribute('width', '640')
    svgRoot.setAttribute('height', '480')
    document.body.append(svgRoot)

    // Create svgContent element (container for SVG content)
    const svgContent = document.createElementNS(NS.SVG, 'svg')
    svgContent.id = 'svgcontent'
    svgRoot.append(svgContent)

    textElement = document.createElementNS(NS.SVG, 'text')
    textElement.setAttribute('x', '100')
    textElement.setAttribute('y', '100')
    textElement.setAttribute('id', 'text1')
    textElement.textContent = 'Test'
    svgContent.append(textElement)

    // Mock text measurement methods
    textElement.getStartPositionOfChar = vi.fn((i) => ({ x: 100 + i * 10, y: 100 } as unknown as DOMPoint))
    textElement.getEndPositionOfChar = vi.fn((i) => ({ x: 100 + (i + 1) * 10, y: 100 } as unknown as DOMPoint))
    textElement.getCharNumAtPosition = vi.fn(() => 0)
    textElement.getBBox = vi.fn(() => ({
      x: 100,
      y: 90,
      width: 40,
      height: 20
    } as unknown as DOMRect))

    inputElement = document.createElement('input')
    inputElement.type = 'text'
    document.body.append(inputElement)

    // Create mock selector group
    const selectorParentGroup = document.createElementNS(NS.SVG, 'g')
    selectorParentGroup.id = 'selectorParentGroup'
    svgRoot.append(selectorParentGroup)

    // Mock selector manager
    mockSelectorManager = {
      requestSelector: vi.fn(() => ({
        showGrips: vi.fn()
      }))
    }

    // Mock svgCanvas
    svgCanvas = {
      getSvgRoot: () => svgRoot,
      getSvgContent: () => svgContent,
      getZoom: () => 1,
      setCurrentMode: vi.fn(),
      notifyModeChange: vi.fn(),
      clearSelection: vi.fn(),
      addToSelection: vi.fn(),
      deleteSelectedElements: vi.fn(),
      call: vi.fn(),
      getSelectedElements: () => [textElement],
      getCurrentMode: () => 'select',
      selectorManager: mockSelectorManager,
      getRootSctm: () => svgRoot.getScreenCTM?.() || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      $click: vi.fn(),
      contentW: 640,
      textActions: textActionsMethod
    }

    // Initialize utilities and text-actions modules
    utilitiesInit(svgCanvas as unknown as ISvgCanvas)
    textActionsInit(svgCanvas as unknown as ISvgCanvas)
    textActionsMethod.setInputElem(inputElement)
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  describe('Class instantiation', () => {
    it('should export textActionsMethod as singleton instance', () => {
      expect(textActionsMethod).toBeDefined()
      expect(typeof textActionsMethod.select).toBe('function')
      expect(typeof textActionsMethod.start).toBe('function')
    })

    it('should have all public methods', () => {
      const publicMethods = [
        'select',
        'start',
        'mouseDown',
        'mouseMove',
        'mouseUp',
        'setCursor',
        'toEditMode',
        'toSelectMode',
        'setInputElem',
        'clear',
        'init'
      ]

      publicMethods.forEach(method => {
        expect(typeof (textActionsMethod as unknown as Record<string, unknown>)[method]).toBe('function')
      })
    })
  })

  describe('setInputElem', () => {
    it('should set the input element', () => {
      const newInput = document.createElement('input')
      expect(() => {
        textActionsMethod.setInputElem(newInput)
      }).not.toThrow()
    })
  })

  describe('select', () => {
    it('should set current text element and enter edit mode', () => {
      textActionsMethod.select(textElement, 100, 100)
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('textedit')
    })
  })

  describe('start', () => {
    it('should start editing a text element', () => {
      textActionsMethod.start(textElement)
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('textedit')
    })
  })

  describe('init', () => {
    it('should initialize text editing for current element', () => {
      textActionsMethod.start(textElement)
      textActionsMethod.init()

      // Verify text measurement methods were called
      expect(textElement.getStartPositionOfChar).toHaveBeenCalled()
      expect(textElement.getEndPositionOfChar).toHaveBeenCalled()
    })

    it('should handle empty text content', () => {
      const emptyText = document.createElementNS(NS.SVG, 'text')
      emptyText.textContent = ''
      emptyText.getStartPositionOfChar = vi.fn(() => ({ x: 100, y: 100 } as unknown as DOMPoint))
      emptyText.getEndPositionOfChar = vi.fn(() => ({ x: 100, y: 100 } as unknown as DOMPoint))
      emptyText.getBBox = vi.fn(() => ({ x: 100, y: 90, width: 0, height: 20 } as unknown as DOMRect))
      emptyText.removeEventListener = vi.fn()
      emptyText.addEventListener = vi.fn()
      svgRoot.append(emptyText)

      expect(() => {
        textActionsMethod.start(emptyText)
        textActionsMethod.init()
      }).not.toThrow()
    })

    it('should return early if no current text', () => {
      // Should not throw when called without a current text element
      expect(() => {
        textActionsMethod.init()
      }).not.toThrow()
    })
  })

  describe('toEditMode', () => {
    it('should switch to text edit mode', () => {
      textActionsMethod.start(textElement)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('textedit')
      expect(mockSelectorManager.requestSelector).toHaveBeenCalled()
    })

    it('should accept x, y coordinates for cursor positioning', () => {
      textActionsMethod.start(textElement)
      textActionsMethod.toEditMode(100, 100)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('textedit')
    })
  })

  describe('toSelectMode', () => {
    it('should switch to select mode', () => {
      textActionsMethod.start(textElement)
      textActionsMethod.toSelectMode(false)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })

    it('should select element when selectElem is true', () => {
      textActionsMethod.start(textElement)
      textActionsMethod.toSelectMode(true)

      expect(svgCanvas.clearSelection).toHaveBeenCalled()
      expect(svgCanvas.call).toHaveBeenCalled()
      expect(svgCanvas.addToSelection).toHaveBeenCalled()
    })

    it('should delete empty text elements', () => {
      const emptyText = document.createElementNS(NS.SVG, 'text')
      emptyText.textContent = ''
      emptyText.getBBox = vi.fn(() => ({ x: 100, y: 90, width: 0, height: 20 } as unknown as DOMRect))
      emptyText.removeEventListener = vi.fn()
      emptyText.addEventListener = vi.fn()
      ;(emptyText as unknown as { style: unknown }).style = {}
      svgRoot.append(emptyText)

      textActionsMethod.start(emptyText)
      textActionsMethod.toSelectMode(false)

      expect(svgCanvas.deleteSelectedElements).toHaveBeenCalled()
    })

    it('notifies the editor of the mode change so the workarea cursor refreshes', () => {
      textActionsMethod.start(textElement)
      textActionsMethod.toSelectMode(true)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
      expect(svgCanvas.notifyModeChange).toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('should exit text edit mode if currently in it', () => {
      svgCanvas.getCurrentMode = () => 'textedit'
      textActionsMethod.start(textElement)
      textActionsMethod.clear()

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })

    it('should do nothing if not in text edit mode', () => {
      svgCanvas.getCurrentMode = () => 'select'
      const callCount = svgCanvas.setCurrentMode.mock.calls.length
      textActionsMethod.clear()

      expect(svgCanvas.setCurrentMode.mock.calls.length).toBe(callCount)
    })
  })

  describe('mouseDown', () => {
    it('should handle mouse down event', () => {
      const mockEvent = { pageX: 100, pageY: 100 } as unknown as MouseEvent
      // Should set focus (via private method)
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.mouseDown(mockEvent, textElement, 100, 100)
      }).not.toThrow()
    })
  })

  describe('mouseMove', () => {
    it('should handle mouse move event', () => {
      // Method should execute without error
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.mouseMove(110, 100)
      }).not.toThrow()
    })
  })

  describe('mouseUp', () => {
    it('should handle mouse up event', () => {
      const mockEvent = { target: textElement, pageX: 100, pageY: 100 } as unknown as MouseEvent
      // Method should execute without error
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.mouseUp(mockEvent, 100, 100)
      }).not.toThrow()
    })

    it('should exit text mode if clicked outside text element', () => {
      textActionsMethod.start(textElement)

      const otherElement = document.createElementNS(NS.SVG, 'rect')
      const mockEvent = { target: otherElement, pageX: 200, pageY: 200 } as unknown as MouseEvent

      textActionsMethod.mouseDown(mockEvent, textElement, 200, 200)
      textActionsMethod.mouseUp(mockEvent, 200, 200)

      // Should have called toSelectMode
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })
  })

  describe('setCursor', () => {
    it('should set cursor position', () => {
      // Method should execute without error
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.setCursor(0)
      }).not.toThrow()
    })

    it('should accept undefined index', () => {
      // Should not throw
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.setCursor(undefined)
      }).not.toThrow()
    })
  })

  describe('Private methods encapsulation', () => {
    it('should not expose private methods', () => {
      const privateMethodNames = [
        '#setCursor',
        '#setSelection',
        '#getIndexFromPoint',
        '#setCursorFromPoint',
        '#setEndSelectionFromPoint',
        '#screenToPt',
        '#ptToScreen',
        '#selectAll',
        '#selectWord'
      ]

      privateMethodNames.forEach(method => {
        expect((textActionsMethod as unknown as Record<string, unknown>)[method]).toBeUndefined()
      })
    })

    it('should not expose private fields', () => {
      const privateFieldNames = [
        '#curtext',
        '#textinput',
        '#cursor',
        '#selblock',
        '#blinker',
        '#chardata',
        '#textbb',
        '#matrix',
        '#lastX',
        '#lastY',
        '#allowDbl'
      ]

      privateFieldNames.forEach(field => {
        expect((textActionsMethod as unknown as Record<string, unknown>)[field]).toBeUndefined()
      })
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete edit workflow', () => {
      // Start editing
      textActionsMethod.start(textElement)
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('textedit')

      // Initialize
      textActionsMethod.init()

      // Simulate mouse interaction
      textActionsMethod.mouseDown({ pageX: 100, pageY: 100 } as unknown as MouseEvent, textElement, 100, 100)
      textActionsMethod.mouseMove(110, 100)
      textActionsMethod.mouseUp({ target: textElement, pageX: 110, pageY: 100 } as unknown as MouseEvent, 110, 100)

      // Exit edit mode
      textActionsMethod.toSelectMode(true)
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })

    it('should handle text with transform attribute', () => {
      textElement.setAttribute('transform', 'rotate(45 100 100)')

      // Should handle transformed text without error
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
      }).not.toThrow()
    })

    it('should handle empty text element', () => {
      textElement.textContent = ''
      textActionsMethod.start(textElement)
      textActionsMethod.init()
      textActionsMethod.toSelectMode(true)
      expect(svgCanvas.deleteSelectedElements).toHaveBeenCalled()
    })

    it('should handle text element without parent', () => {
      const orphanText = document.createElementNS(NS.SVG, 'text')
      orphanText.textContent = 'Orphan'
      orphanText.getStartPositionOfChar = vi.fn((i) => ({ x: 100 + i * 10, y: 100 } as unknown as DOMPoint))
      orphanText.getEndPositionOfChar = vi.fn((i) => ({ x: 100 + (i + 1) * 10, y: 100 } as unknown as DOMPoint))
      orphanText.getBBox = vi.fn(() => ({ x: 100, y: 90, width: 60, height: 20 } as unknown as DOMRect))

      expect(() => {
        textActionsMethod.start(orphanText)
        textActionsMethod.init()
      }).not.toThrow()
    })

    it('should handle setCursor with undefined index', () => {
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.setCursor(undefined)
      }).not.toThrow()
    })

    it('should handle setCursor with empty input', () => {
      inputElement.value = ''
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.setCursor()
      }).not.toThrow()
    })

    it('should handle text with no transform', () => {
      textElement.removeAttribute('transform')
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
      }).not.toThrow()
    })

    it('should handle getIndexFromPoint with single character', () => {
      textElement.textContent = 'A'
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.mouseDown({ pageX: 100, pageY: 100 } as unknown as MouseEvent, textElement, 100, 100)
      }).not.toThrow()
    })

    it('should handle getIndexFromPoint outside text range', () => {
      textElement.getCharNumAtPosition = vi.fn(() => -1)
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.mouseDown({ pageX: 50, pageY: 100 } as unknown as MouseEvent, textElement, 50, 100)
      }).not.toThrow()
    })

    it('should handle getIndexFromPoint at end of text', () => {
      textElement.getCharNumAtPosition = vi.fn(() => 100)
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.mouseDown({ pageX: 200, pageY: 100 } as unknown as MouseEvent, textElement, 200, 100)
      }).not.toThrow()
    })

    it('should handle mouseUp clicking outside text', () => {
      const outsideElement = document.createElementNS(NS.SVG, 'rect')
      textActionsMethod.start(textElement)
      textActionsMethod.init()
      textActionsMethod.mouseDown({ pageX: 100, pageY: 100 } as unknown as MouseEvent, textElement, 100, 100)
      textActionsMethod.mouseUp({ target: outsideElement, pageX: 101, pageY: 101 } as unknown as MouseEvent, 101, 101)
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })

    it('should handle toEditMode with no arguments', () => {
      textActionsMethod.start(textElement)
      textActionsMethod.toEditMode()
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('textedit')
    })

    it('should handle toSelectMode without selectElem', () => {
      textActionsMethod.start(textElement)
      textActionsMethod.init()
      textActionsMethod.toSelectMode(false)
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })

    it('should handle clear when not in textedit mode', () => {
      const originalGetMode = svgCanvas.getCurrentMode
      svgCanvas.getCurrentMode = vi.fn(() => 'select')
      textActionsMethod.clear()
      svgCanvas.getCurrentMode = originalGetMode
      expect(svgCanvas.setCurrentMode).not.toHaveBeenCalled()
    })

    it('should handle init with no current text', () => {
      expect(() => {
        textActionsMethod.init()
      }).not.toThrow()
    })

    it('should handle mouseMove during selection', () => {
      expect(() => {
        textActionsMethod.start(textElement)
        textActionsMethod.init()
        textActionsMethod.mouseDown({ pageX: 100, pageY: 100 } as unknown as MouseEvent, textElement, 100, 100)
        textActionsMethod.mouseMove(120, 100)
        textActionsMethod.mouseMove(130, 100)
      }).not.toThrow()
    })

    it('should handle mouseMove without shift key', () => {
      const evt = { shiftKey: false, clientX: 100, clientY: 100 }
      expect(() => {
        (textActionsMethod.mouseMove as unknown as (mouseX: number, mouseY: number, evt?: unknown) => void)(10, 20, evt)
      }).not.toThrow()
    })

    it('should handle mouseDown with different mouse button', () => {
      const evt = { button: 2 } as unknown as MouseEvent
      expect(() => {
        textActionsMethod.mouseDown(evt, null as unknown as Element, 10, 20)
      }).not.toThrow()
    })

    it('should handle mouseUp with valid cursor position', () => {
      const elem = document.createElementNS(NS.SVG, 'text')
      elem.textContent = 'test'
      const evt = { target: elem }
      expect(() => {
        (textActionsMethod.mouseUp as unknown as (evt: unknown, mouseTarget: unknown, mouseX: number, mouseY: number) => void)(evt, elem, 10, 20)
      }).not.toThrow()
    })

    it('should handle toSelectMode with valid element', () => {
      const elem = document.createElementNS(NS.SVG, 'text')
      textActionsMethod.toSelectMode(elem)
      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })
  })
})
