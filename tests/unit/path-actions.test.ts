import '../../packages/svgcanvas/core/path-method.js'
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { init as pathActionsInit, pathActionsMethod } from '../../packages/svgcanvas/core/path-actions.js'
import { init as utilitiesInit } from '../../packages/svgcanvas/core/utilities.js'
import { init as unitsInit } from '../../packages/svgcanvas/core/units.js'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import { getPathData } from '../../packages/svgcanvas/core/path-data.js'
import type { ISvgCanvas } from '../../packages/svgcanvas/core/svgcanvas-types.js'

// Pass-through spy on getPathData so we can prove cleanup() reads the path data
// once per pass rather than once per segment (audit #29 perf #60).
vi.mock('../../packages/svgcanvas/core/path-data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/svgcanvas/core/path-data.js')>()
  return { ...actual, getPathData: vi.fn((...args) => actual.getPathData(...args)) }
})

// Shape of a segment object held by the mock Path instance.
type MockSeg = {
  index: number
  item: { x: number; y: number }
  type: number
  selected: boolean
  move: Mock
}

// Shape of the mock Path instance returned by svgCanvas.getPath_().
type MockPath = {
  elem: SVGPathElement
  segs: MockSeg[]
  selected_pts: number[]
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number } | null
  show: Mock
  update: Mock
  init: Mock
  setPathContext: Mock
  storeD: Mock
  selectPt: Mock
  addPtsToSelection: Mock
  removePtFromSelection: Mock
  clearSelection: Mock
  setSegType: Mock
  movePts: Mock
  moveCtrl: Mock
  addSeg: Mock
  deleteSeg: Mock
  endChanges: Mock
  dragctrl: boolean
  dragging: number[] | null
  cur_pt: number | null
  oldbbox: { x: number; y: number; width: number; height: number }
  eachSeg?: Mock
}

// The mock canvas is an ISvgCanvas stand-in; the methods the tests drive with
// mockReturnValue/mockClear are narrowed to vitest's Mock.
type SvgCanvasMock = ISvgCanvas & {
  getCurrentMode: Mock
  getDrawnPath: Mock
  getRubberBox: Mock
  getSelectedElements: Mock
  getPath_: Mock
}

describe('PathActions', () => {
  let svgRoot: SVGSVGElement
  let pathElement: SVGPathElement
  let svgCanvas: SvgCanvasMock
  let mockPath: MockPath

  beforeEach(() => {
    // Create mock SVG elements
    svgRoot = document.createElementNS(NS.SVG, 'svg')
    svgRoot.setAttribute('width', '640')
    svgRoot.setAttribute('height', '480')
    document.body.append(svgRoot)

    pathElement = document.createElementNS(NS.SVG, 'path')
    pathElement.setAttribute('id', 'path1')
    pathElement.setAttribute('d', 'M10,10 L50,50 L90,10 z')
    svgRoot.append(pathElement)

    // Create mock path object (simulating the path module's internal Path class)
    mockPath = {
      elem: pathElement,
      segs: [
        { index: 0, item: { x: 10, y: 10 }, type: 2, selected: false, move: vi.fn() },
        { index: 1, item: { x: 50, y: 50 }, type: 4, selected: false, move: vi.fn() },
        { index: 2, item: { x: 90, y: 10 }, type: 4, selected: false, move: vi.fn() }
      ],
      selected_pts: [],
      matrix: null,
      show: vi.fn(() => mockPath),
      update: vi.fn(() => mockPath),
      init: vi.fn(() => mockPath),
      setPathContext: vi.fn(),
      storeD: vi.fn(),
      selectPt: vi.fn(),
      addPtsToSelection: vi.fn(),
      removePtFromSelection: vi.fn(),
      clearSelection: vi.fn(),
      setSegType: vi.fn(),
      movePts: vi.fn(),
      moveCtrl: vi.fn(),
      addSeg: vi.fn(),
      deleteSeg: vi.fn(),
      endChanges: vi.fn(),
      dragctrl: false,
      dragging: null,
      cur_pt: null,
      oldbbox: { x: 0, y: 0, width: 100, height: 100 }
    }

    // Mock svgCanvas
    svgCanvas = {
      getSvgRoot: () => svgRoot,
      getZoom: () => 1,
      setCurrentMode: vi.fn(),
      getCurrentMode: vi.fn(() => 'select'),
      clearSelection: vi.fn(),
      addToSelection: vi.fn(),
      deleteSelectedElements: vi.fn(),
      call: vi.fn(),
      getSelectedElements: vi.fn(() => [pathElement]),
      getDrawnPath: vi.fn(() => null),
      setDrawnPath: vi.fn(),
      getPath_: vi.fn(() => mockPath),
      getId: vi.fn(() => 'svg_1'),
      getNextId: vi.fn(() => 'svg_2'),
      setStarted: vi.fn(),
      addPointGrip: vi.fn(),
      addCtrlGrip: vi.fn(() => {
        const grip = document.createElementNS(NS.SVG, 'circle')
        grip.setAttribute('cx', '0')
        grip.setAttribute('cy', '0')
        grip.setAttribute('r', '4')
        return grip
      }),
      getCtrlLine: vi.fn(() => {
        const line = document.createElementNS(NS.SVG, 'line')
        return line
      }),
      replacePathSeg: vi.fn(),
      getGridSnapping: vi.fn(() => false),
      getOpacity: vi.fn(() => 1),
      round: (val: number) => Math.round(val),
      getRoundDigits: vi.fn(() => 2),
      addSVGElementsFromJson: vi.fn((json) => {
        const elem = document.createElementNS(NS.SVG, json.element)
        if (json.attr) {
          Object.entries(json.attr).forEach(([key, value]) => {
            elem.setAttribute(key, value)
          })
        }
        return elem
      }),
      createSVGElement: vi.fn((config) => {
        const elem = document.createElementNS(NS.SVG, config.element)
        if (config.attr) {
          Object.entries(config.attr).forEach(([key, value]) => {
            elem.setAttribute(key, value)
          })
        }
        return elem
      }),
      selectorManager: {
        getRubberBandBox: vi.fn(() => {
          const rect = document.createElementNS(NS.SVG, 'rect')
          rect.setAttribute('id', 'selectorRubberBand')
          return rect
        }),
        requestSelector: vi.fn(() => ({
          showGrips: vi.fn()
        }))
      },
      getRubberBox: vi.fn(() => null),
      setRubberBox: vi.fn((box) => box),
      getPointFromGrip: vi.fn((point) => point),
      getGripPt: vi.fn((seg) => ({ x: seg.item.x, y: seg.item.y })),
      getContainer: vi.fn(() => svgRoot),
      getMouseTarget: vi.fn(() => pathElement),
      smoothControlPoints: vi.fn(),
      removePath_: vi.fn(),
      recalcRotatedPath: vi.fn(),
      remapElement: vi.fn(),
      addCommandToHistory: vi.fn(),
      reorientGrads: vi.fn(),
      setLinkControlPoints: vi.fn(),
      contentW: 640
    } as unknown as SvgCanvasMock

    // Create selector parent group
    const selectorParentGroup = document.createElementNS(NS.SVG, 'g')
    selectorParentGroup.id = 'selectorParentGroup'
    svgRoot.append(selectorParentGroup)

    // Create pathpointgrip container
    const pathpointgripContainer = document.createElementNS(NS.SVG, 'g')
    pathpointgripContainer.id = 'pathpointgrip_container'
    svgRoot.append(pathpointgripContainer)

    // Initialize modules
    utilitiesInit(svgCanvas)
    unitsInit(svgCanvas)
    pathActionsInit(svgCanvas)
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  describe('Class instantiation', () => {
    it('should export pathActionsMethod as singleton instance', () => {
      expect(pathActionsMethod).toBeDefined()
      expect(typeof pathActionsMethod.mouseDown).toBe('function')
      expect(typeof pathActionsMethod.mouseMove).toBe('function')
      expect(typeof pathActionsMethod.mouseUp).toBe('function')
    })

    it('should have all public methods', () => {
      const publicMethods = [
        'mouseDown',
        'mouseMove',
        'mouseUp',
        'toEditMode',
        'toSelectMode',
        'addSubPath',
        'select',
        'reorient',
        'clear',
        'resetOrientation',
        'zoomChange',
        'getNodePoint',
        'linkControlPoints',
        'clonePathNode',
        'opencloseSubPath',
        'deletePathNode',
        'smoothPolylineIntoPath',
        'setSegType',
        'moveNode',
        'fixEnd',
        'convertPath'
      ]

      publicMethods.forEach(method => {
        expect(typeof pathActionsMethod[method]).toBe('function')
      })
    })
  })

  describe('mouseDown', () => {
    it('should handle mouse down in path mode', () => {
      svgCanvas.getCurrentMode.mockReturnValue('path')
      svgCanvas.getDrawnPath.mockReturnValue(null)

      const mockEvent = { target: pathElement, shiftKey: false }
      const result = pathActionsMethod.mouseDown(mockEvent, pathElement, 100, 100)

      expect(svgCanvas.addPointGrip).toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should handle mouse down on existing path point', () => {
      // First enter edit mode to initialize path
      pathActionsMethod.toEditMode(pathElement)
      svgCanvas.getCurrentMode.mockReturnValue('pathedit')

      const grip = document.createElementNS(NS.SVG, 'circle')
      grip.id = 'pathpointgrip_0'
      const mockEvent = { target: grip, shiftKey: false }

      pathActionsMethod.mouseDown(mockEvent, grip, 100, 100)

      expect(mockPath.clearSelection).toHaveBeenCalled()
      expect(mockPath.addPtsToSelection).toHaveBeenCalled()
    })
  })

  describe('mouseMove', () => {
    it('should handle mouse move in path mode', () => {
      svgCanvas.getCurrentMode.mockReturnValue('path')
      const drawnPath = document.createElementNS(NS.SVG, 'path')
      drawnPath.setAttribute('d', 'M10,10 L50,50')
      svgCanvas.getDrawnPath.mockReturnValue(drawnPath)

      pathActionsMethod.mouseMove(120, 120)

      // Should update path stretchy line
      expect(svgCanvas.replacePathSeg).toHaveBeenCalled()
    })

    it('should handle dragging path points', () => {
      pathActionsMethod.toEditMode(pathElement)
      svgCanvas.getCurrentMode.mockReturnValue('pathedit')
      mockPath.dragging = [100, 100]

      pathActionsMethod.mouseMove(110, 110)

      expect(mockPath.movePts).toHaveBeenCalled()
    })

    const setupRubberBandScene = () => {
      pathActionsMethod.toEditMode(pathElement)
      svgCanvas.getCurrentMode.mockReturnValue('pathedit')
      mockPath.dragging = null
      const mkSeg = (index: number) => ({ index, item: { x: index * 10, y: index * 10 }, select: vi.fn(), next: null, prev: null })
      const segs = [mkSeg(0), mkSeg(1), mkSeg(2)]
      segs[0]!.next = segs[1]; segs[1]!.prev = segs[0]; segs[1]!.next = segs[2]; segs[2]!.prev = segs[1]
      mockPath.selected_pts = []
      mockPath.eachSeg = vi.fn((cb) => segs.forEach((s, i) => cb.call(s, i)))
      const rb = document.createElementNS(NS.SVG, 'rect')
      rb.setAttribute('x', '0'); rb.setAttribute('y', '0'); rb.setAttribute('width', '500'); rb.setAttribute('height', '500')
      svgRoot.append(rb)
      svgCanvas.getRubberBox.mockReturnValue(rb)
      return segs
    }

    it('measures the rubber-band box once per move, not once per path segment (#58)', () => {
      setupRubberBandScene()
      svgCanvas.getRubberBox.mockClear()

      pathActionsMethod.mouseMove(50, 50)

      // The rubber-band box is invariant across segments, so it must be looked
      // up once per move — not re-fetched + re-measured inside the per-segment loop.
      expect(svgCanvas.getRubberBox).toHaveBeenCalledTimes(1)
    })

    it('selects the path points whose grips fall inside the rubber-band box (#58)', () => {
      const segs = setupRubberBandScene()

      pathActionsMethod.mouseMove(50, 50)

      // Grips at (0,0),(10,10),(20,20) all fall within the 0,0,500x500 box.
      expect(segs[1]!.select).toHaveBeenCalledWith(true)
      expect(mockPath.selected_pts).toContain(1)
    })
  })

  describe('mouseUp', () => {
    it('should handle mouse up in path mode', () => {
      svgCanvas.getCurrentMode.mockReturnValue('path')
      const drawnPath = document.createElementNS(NS.SVG, 'path')
      svgCanvas.getDrawnPath.mockReturnValue(drawnPath)

      const mockEvent = { target: pathElement }
      const result = pathActionsMethod.mouseUp(mockEvent, drawnPath, 100, 100)

      expect(result).toEqual({ keep: true, element: drawnPath })
    })

    it('should finalize path point dragging', () => {
      pathActionsMethod.toEditMode(pathElement)
      svgCanvas.getCurrentMode.mockReturnValue('pathedit')
      mockPath.dragging = [100, 100]
      mockPath.cur_pt = 1

      const mockEvent = { target: pathElement, shiftKey: false }
      pathActionsMethod.mouseUp(mockEvent, pathElement, 105, 105)

      expect(mockPath.update).toHaveBeenCalled()
      expect(mockPath.endChanges).toHaveBeenCalledWith('Move path point(s)')
    })
  })

  describe('toEditMode', () => {
    it('should switch to path edit mode', () => {
      pathActionsMethod.toEditMode(pathElement)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('pathedit')
      expect(svgCanvas.clearSelection).toHaveBeenCalled()
      expect(mockPath.show).toHaveBeenCalledWith(true)
      expect(mockPath.update).toHaveBeenCalled()
    })
  })

  describe('toSelectMode', () => {
    it('should switch to select mode', () => {
      pathActionsMethod.toEditMode(pathElement)
      pathActionsMethod.toSelectMode(pathElement)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
      expect(mockPath.show).toHaveBeenCalledWith(false)
      expect(svgCanvas.clearSelection).toHaveBeenCalled()
    })

    it('should select element if it was the path element', () => {
      pathActionsMethod.toEditMode(pathElement)
      pathActionsMethod.toSelectMode(pathElement)

      expect(svgCanvas.call).toHaveBeenCalledWith('selected', [pathElement])
      expect(svgCanvas.addToSelection).toHaveBeenCalled()
    })
  })

  describe('addSubPath', () => {
    it('should enable subpath mode', () => {
      pathActionsMethod.addSubPath(true)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('path')
    })

    it('should disable subpath mode', () => {
      pathActionsMethod.toEditMode(pathElement)
      pathActionsMethod.addSubPath(false)

      expect(mockPath.init).toHaveBeenCalled()
    })
  })

  describe('select', () => {
    it('should select a path and enter edit mode if already current', () => {
      pathActionsMethod.select(pathElement)
      pathActionsMethod.select(pathElement)

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('pathedit')
    })
  })

  describe('reorient', () => {
    it('should reorient a rotated path', () => {
      pathElement.setAttribute('transform', 'rotate(45 50 50)')
      svgCanvas.getSelectedElements.mockReturnValue([pathElement])

      pathActionsMethod.reorient()

      expect(svgCanvas.addCommandToHistory).toHaveBeenCalled()
      expect(svgCanvas.call).toHaveBeenCalledWith('changed', [pathElement])
    })

    it('should do nothing if no element selected', () => {
      svgCanvas.getSelectedElements.mockReturnValue([])

      pathActionsMethod.reorient()

      expect(svgCanvas.addCommandToHistory).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('should clear drawn path', () => {
      const drawnPath = document.createElementNS(NS.SVG, 'path')
      drawnPath.id = 'svg_1'
      const stretchy = document.createElementNS(NS.SVG, 'path')
      stretchy.id = 'path_stretch_line'
      svgRoot.append(drawnPath)
      svgRoot.append(stretchy)

      svgCanvas.getDrawnPath.mockReturnValue(drawnPath)

      pathActionsMethod.clear()

      expect(svgCanvas.setDrawnPath).toHaveBeenCalledWith(null)
      expect(svgCanvas.setStarted).toHaveBeenCalledWith(false)
    })

    it('should switch to select mode if in pathedit mode', () => {
      svgCanvas.getCurrentMode.mockReturnValue('pathedit')
      svgCanvas.getDrawnPath.mockReturnValue(null)

      pathActionsMethod.clear()

      expect(svgCanvas.setCurrentMode).toHaveBeenCalledWith('select')
    })
  })

  describe('resetOrientation', () => {
    it('should reset path orientation', () => {
      pathElement.setAttribute('transform', 'rotate(45 50 50)')

      const result = pathActionsMethod.resetOrientation(pathElement)

      expect(svgCanvas.reorientGrads).toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should return false for non-path elements', () => {
      const rect = document.createElementNS(NS.SVG, 'rect')

      const result = pathActionsMethod.resetOrientation(rect)

      expect(result).toBe(false)
    })
  })

  describe('zoomChange', () => {
    it('should update path on zoom change in pathedit mode', () => {
      pathActionsMethod.toEditMode(pathElement)
      svgCanvas.getCurrentMode.mockReturnValue('pathedit')

      pathActionsMethod.zoomChange()

      expect(mockPath.update).toHaveBeenCalled()
    })

    it('should do nothing if not in pathedit mode', () => {
      svgCanvas.getCurrentMode.mockReturnValue('select')

      pathActionsMethod.zoomChange()

      expect(mockPath.update).not.toHaveBeenCalled()
    })
  })

  describe('getNodePoint', () => {
    it('should return selected node point', () => {
      mockPath.selected_pts = [1]
      svgCanvas.getPath_.mockReturnValue(mockPath)

      const result = pathActionsMethod.getNodePoint()

      expect(result).toEqual({
        x: 50,
        y: 50,
        type: 4
      })
    })

    it('should return first point if no selection', () => {
      mockPath.selected_pts = []
      svgCanvas.getPath_.mockReturnValue(mockPath)

      const result = pathActionsMethod.getNodePoint()

      expect(result.x).toBeDefined()
      expect(result.y).toBeDefined()
    })
  })

  describe('linkControlPoints', () => {
    it('should set link control points flag', () => {
      pathActionsMethod.linkControlPoints(true)

      expect(svgCanvas.setLinkControlPoints).toHaveBeenCalledWith(true)
    })
  })

  describe('clonePathNode', () => {
    it('should clone selected path nodes', () => {
      pathActionsMethod.toEditMode(pathElement)
      mockPath.selected_pts = [1]

      pathActionsMethod.clonePathNode()

      expect(mockPath.storeD).toHaveBeenCalled()
      expect(mockPath.addSeg).toHaveBeenCalled()
      expect(mockPath.init).toHaveBeenCalled()
      expect(mockPath.endChanges).toHaveBeenCalledWith('Clone path node(s)')
    })
  })

  describe('deletePathNode', () => {
    it('should delete selected path nodes', () => {
      pathActionsMethod.toEditMode(pathElement)
      mockPath.selected_pts = [1]

      // Mock canDeleteNodes property
      Object.defineProperty(pathActionsMethod, 'canDeleteNodes', {
        get: () => true,
        configurable: true
      })

      // Set a d attribute so getPathData can parse it (3 segments: M, L, L)
      pathElement.setAttribute('d', 'M0,0 L10,10 L20,20')

      pathActionsMethod.deletePathNode()

      expect(mockPath.storeD).toHaveBeenCalled()
      expect(mockPath.deleteSeg).toHaveBeenCalled()
      expect(mockPath.init).toHaveBeenCalled()
      expect(mockPath.clearSelection).toHaveBeenCalled()
    })

    it('reads the path data once per cleanup pass, not once per segment (#60)', () => {
      pathActionsMethod.toEditMode(pathElement)
      mockPath.selected_pts = [1]
      Object.defineProperty(pathActionsMethod, 'canDeleteNodes', {
        get: () => true,
        configurable: true
      })
      // Many segments, no redundant M/Z: cleanup() iterates every segment without
      // finding a removable one — the worst case for the per-iteration re-read.
      let d = 'M0,0'
      for (let i = 1; i <= 40; i++) d += ` L${i},${i}`
      pathElement.setAttribute('d', d)
      vi.mocked(getPathData).mockClear()

      pathActionsMethod.deletePathNode()

      // cleanup() must read the path data once per pass, not once per while-iteration.
      expect(vi.mocked(getPathData).mock.calls.length).toBeLessThanOrEqual(3)
    })
  })

  describe('smoothPolylineIntoPath', () => {
    it('should convert polyline to smooth path', () => {
      const polyline = document.createElementNS(NS.SVG, 'polyline')
      polyline.setAttribute('points', '10,10 50,50 90,10 130,50')

      const mockPoints = {
        numberOfItems: 4,
        getItem: vi.fn((i) => {
          const points = [[10, 10], [50, 50], [90, 10], [130, 50]]
          return { x: points[i]![0], y: points[i]![1] }
        })
      }
      Object.defineProperty(polyline, 'points', {
        get: () => mockPoints,
        configurable: true
      })

      const result = pathActionsMethod.smoothPolylineIntoPath(polyline)

      expect(svgCanvas.addSVGElementsFromJson).toHaveBeenCalled()
      expect(result).toBeDefined()
    })
  })

  describe('setSegType', () => {
    it('should set path segment type', () => {
      pathActionsMethod.toEditMode(pathElement)

      pathActionsMethod.setSegType(6)

      expect(mockPath.setSegType).toHaveBeenCalledWith(6)
    })
  })

  describe('moveNode', () => {
    it('should move selected path node', () => {
      pathActionsMethod.toEditMode(pathElement)
      mockPath.selected_pts = [1]

      pathActionsMethod.moveNode('x', 60)

      expect(mockPath.segs[1]!.move).toHaveBeenCalled()
      expect(mockPath.endChanges).toHaveBeenCalledWith('Move path point')
    })

    it('should do nothing if no points selected', () => {
      pathActionsMethod.toEditMode(pathElement)
      mockPath.selected_pts = []

      // When no points selected, should return early
      pathActionsMethod.moveNode('x', 60)

      // Verify no seg.move was called
      mockPath.segs.forEach(seg => {
        expect(seg.move).not.toHaveBeenCalled()
      })
    })
  })

  describe('convertPath', () => {
    it('should convert path to relative coordinates', () => {
      const path = document.createElementNS(NS.SVG, 'path')
      path.setAttribute('d', 'M10,10 L50,50 L90,10 z')

      const result = pathActionsMethod.convertPath(path, true)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result).toContain('m') // Should have relative move command
    })

    it('should convert path to absolute coordinates', () => {
      const path = document.createElementNS(NS.SVG, 'path')
      path.setAttribute('d', 'm10,10 l40,40 l40,-40 z')

      const result = pathActionsMethod.convertPath(path, false)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result).toContain('M') // Should have absolute move command
    })
  })

  describe('Private field encapsulation', () => {
    it('should not expose private fields', () => {
      const privateFields = ['subpath', 'newPoint', 'firstCtrl', 'currentPath', 'hasMoved']

      privateFields.forEach(field => {
        expect(pathActionsMethod[field]).toBeUndefined()
        expect(pathActionsMethod[`#${field}`]).toBeUndefined()
      })
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete path drawing workflow', () => {
      // Start drawing
      svgCanvas.getCurrentMode.mockReturnValue('path')
      svgCanvas.getDrawnPath.mockReturnValue(null)

      // First point
      pathActionsMethod.mouseDown({ target: svgRoot }, svgRoot, 10, 10)
      expect(svgCanvas.addPointGrip).toHaveBeenCalled()

      // Add more points
      const drawnPath = document.createElementNS(NS.SVG, 'path')
      drawnPath.setAttribute('d', 'M10,10 L50,50')
      svgCanvas.getDrawnPath.mockReturnValue(drawnPath)

      pathActionsMethod.mouseMove(50, 50)
      expect(svgCanvas.replacePathSeg).toHaveBeenCalled()
    })

    it('should handle path editing with transform', () => {
      pathElement.setAttribute('transform', 'translate(10,10) rotate(45)')
      mockPath.matrix = { a: 0.707, b: 0.707, c: -0.707, d: 0.707, e: 10, f: 10 }

      pathActionsMethod.toEditMode(pathElement)

      expect(mockPath.show).toHaveBeenCalledWith(true)
      expect(mockPath.update).toHaveBeenCalled()
    })
  })
})
