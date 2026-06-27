import { createSvgCanvasFixture } from './helpers/createSvgCanvasFixture'

// Regression guard for audit #29 perf finding #61. The finding claimed the
// freehand path tool "re-creates control-point grips every move". It does not:
// addCtrlGrip looks the grip up by id and returns the existing element, creating
// one only on first use (the per-move work is just repositioning it). This test
// pins that reuse so a future change can't silently reintroduce per-move
// element creation.
describe('addCtrlGrip', () => {
  let svgCanvas

  beforeEach(() => {
    svgCanvas = createSvgCanvasFixture()
    sessionStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
    sessionStorage.clear()
  })

  it('returns the same grip element for a given id instead of recreating it (#61)', () => {
    const first = svgCanvas.addCtrlGrip('1c1')
    const second = svgCanvas.addCtrlGrip('1c1')
    const third = svgCanvas.addCtrlGrip('1c1')

    expect(second).toBe(first)
    expect(third).toBe(first)
    // Exactly one such grip exists in the DOM — no per-call duplication.
    expect(svgCanvas.getSvgRoot().querySelectorAll('#ctrlpointgrip_1c1')).toHaveLength(1)
  })

  it('creates distinct grip elements for distinct ids', () => {
    const a = svgCanvas.addCtrlGrip('1c1')
    const b = svgCanvas.addCtrlGrip('0c2')

    expect(a).not.toBe(b)
    expect(a.id).toBe('ctrlpointgrip_1c1')
    expect(b.id).toBe('ctrlpointgrip_0c2')
  })
})
