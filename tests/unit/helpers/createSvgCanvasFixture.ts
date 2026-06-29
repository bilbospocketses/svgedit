import SvgCanvas from '../../../packages/svgcanvas/svgcanvas.js'

/**
 * Shared SvgCanvas bootstrap for unit tests.
 *
 * Builds the minimal DOM scaffold the canvas expects
 * (#svg_editor > #workarea > #svgcanvas, plus #tools_left) and returns a fresh
 * SvgCanvas instance wired to #svgcanvas. The config object is byte-identical to
 * the per-file `createSvgCanvas` definitions this replaces, so behaviour is
 * unchanged; callers assign the return value to their own `svgCanvas` variable.
 */
export const createSvgCanvasFixture = () => {
  document.body.textContent = ''
  const svgEditor = document.createElement('div')
  svgEditor.id = 'svg_editor'
  const svgcanvas = document.createElement('div')
  svgcanvas.style.visibility = 'hidden'
  svgcanvas.id = 'svgcanvas'
  const workarea = document.createElement('div')
  workarea.id = 'workarea'
  workarea.append(svgcanvas)
  const toolsLeft = document.createElement('div')
  toolsLeft.id = 'tools_left'
  svgEditor.append(workarea, toolsLeft)
  document.body.append(svgEditor)

  return new SvgCanvas(document.getElementById('svgcanvas')!, {
    canvas_expansion: 3,
    dimensions: [640, 480],
    initFill: {
      color: 'FF0000',
      opacity: 1
    },
    initStroke: {
      width: 5,
      color: '000000',
      opacity: 1
    },
    initOpacity: 1,
    imgPath: '../editor/images',
    langPath: 'locale/',
    extPath: 'extensions/',
    extensions: [],
    initTool: 'select',
    wireframe: false
  })
}
