import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

describe('flipSelectedElements', () => {
  let svgCanvas: ReturnType<typeof createSvgCanvasFixture>

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('flips a simple line horizontally and records history', () => {
    const line = svgCanvas.addSVGElementsFromJson({
      element: 'line',
      attr: {
        id: 'line-basic',
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 20,
        stroke: '#000'
      }
    })

    svgCanvas.selectOnly([line], true)
    const undoSize = svgCanvas.undoMgr.getUndoStackSize()

    svgCanvas.flipSelectedElements(-1, 1)

    expect(Number(line.getAttribute('x1'))).toBe(30)
    expect(Number(line.getAttribute('x2'))).toBe(10)
    expect(line.hasAttribute('transform')).toBe(false)
    expect(svgCanvas.undoMgr.getUndoStackSize()).toBe(undoSize + 1)
  })

  it('flips around the visual center when a transform exists and can be undone', () => {
    const line = svgCanvas.addSVGElementsFromJson({
      element: 'line',
      attr: {
        id: 'line-transformed',
        x1: 10,
        y1: 0,
        x2: 30,
        y2: 0,
        stroke: '#000',
        transform: 'translate(100,0)'
      }
    })

    svgCanvas.selectOnly([line], true)
    svgCanvas.flipSelectedElements(-1, 1)

    expect(Number(line.getAttribute('x1'))).toBe(130)
    expect(Number(line.getAttribute('x2'))).toBe(110)
    expect(line.hasAttribute('transform')).toBe(false)

    svgCanvas.undoMgr.undo()

    expect(Number(line.getAttribute('x1'))).toBe(10)
    expect(Number(line.getAttribute('x2'))).toBe(30)
    expect(line.getAttribute('transform')).toMatch(/translate\(100[ ,]0\)/)
  })
})
