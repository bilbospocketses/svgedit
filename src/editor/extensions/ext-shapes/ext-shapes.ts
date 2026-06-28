/**
 * @file ext-shapes.js
 *
 * @license MIT
 *
 *
 */
import { getSvgEditor } from '../../svgEditorInstance.js'
import { isSafePathData, isSafeExtPath } from '@svgedit/svgcanvas/core/validators.js'
import { loadExtensionTranslation } from '../loadExtensionTranslation.js'
import enLocale from './locale/en.js'

const name = 'shapes'

export default {
  name,
  async init () {
    const svgEditor = getSvgEditor()
    const canv = svgEditor.svgCanvas
    const { $id, $click } = canv
    const svgroot = canv.getSvgRoot()
    let lastBBox: DOMRect | { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 }
    await loadExtensionTranslation(name, enLocale)

    const modeId = 'shapelib'
    const startClientPos: { x: number; y: number } = { x: 0, y: 0 }

    let curShape: SVGGraphicsElement
    let startX: number
    let startY: number

    return {
      callback () {
        if ($id('tool_shapelib') === null) {
          const extPath = svgEditor.configObj.curConfig.extPath
          const extPathStr = `${extPath}`
          const safeExtPath = isSafeExtPath(extPathStr) ? extPathStr : ''
          const buttonTemplate = `
          <se-explorerbutton id="tool_shapelib" title="${svgEditor.i18next.t(`${name}:buttons.0.title`)}" lib="${safeExtPath}/ext-shapes/shapelib/"
          src="shapelib.svg"></se-explorerbutton>
          `
          canv.insertChildAtIndex($id('tools_left')!, buttonTemplate, 9)
          $click($id('tool_shapelib')!, () => {
            if (svgEditor.leftPanel.updateLeftPanel('tool_shapelib')) {
              canv.setMode(modeId)
            }
          })
        }
      },
      mouseDown (opts: { start_x: number; start_y: number; event: MouseEvent }) {
        const mode = canv.getMode()
        if (mode !== modeId) { return undefined }

        const rawD = $id('tool_shapelib')!.dataset.draw ?? ''
        const currentD = isSafePathData(rawD) ? rawD : ''
        startX = opts.start_x
        const x = startX
        startY = opts.start_y
        const y = startY
        const curStyle = canv.getStyle()

        startClientPos.x = opts.event.clientX
        startClientPos.y = opts.event.clientY

        curShape = canv.addSVGElementsFromJson({
          element: 'path',
          curStyles: true,
          attr: {
            d: currentD,
            id: canv.getNextId(),
            opacity: Number(curStyle.opacity) / 2,
            style: 'pointer-events:none'
          }
        }) as SVGGraphicsElement

        curShape.setAttribute('transform', 'translate(' + x + ',' + y + ') scale(0.005) translate(' + -x + ',' + -y + ')')

        canv.recalculateDimensions(curShape)

        lastBBox = curShape.getBBox()

        return {
          started: true
        }
      },
      mouseMove (opts: { mouse_x: number; mouse_y: number; event: MouseEvent }) {
        const mode = canv.getMode()
        if (mode !== modeId) { return }

        const zoom = canv.getZoom()
        const evt = opts.event

        const x = opts.mouse_x / zoom
        const y = opts.mouse_y / zoom

        const tlist = curShape.transform.baseVal
        const box = curShape.getBBox()
        const left = box.x; const top = box.y

        const newbox = {
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          width: Math.abs(x - startX),
          height: Math.abs(y - startY)
        }

        let sx = (newbox.width / lastBBox.width) || 1
        let sy = (newbox.height / lastBBox.height) || 1

        // Not perfect, but mostly works...
        let tx = 0
        if (x < startX) {
          tx = lastBBox.width
        }
        let ty = 0
        if (y < startY) {
          ty = lastBBox.height
        }

        // update the transform list with translate,scale,translate
        const translateOrigin = svgroot.createSVGTransform()
        const scale = svgroot.createSVGTransform()
        const translateBack = svgroot.createSVGTransform()

        translateOrigin.setTranslate(-(left + tx), -(top + ty))
        if (!evt.shiftKey) {
          const max = Math.min(Math.abs(sx), Math.abs(sy))

          sx = max * (sx < 0 ? -1 : 1)
          sy = max * (sy < 0 ? -1 : 1)
        }
        scale.setScale(sx, sy)

        translateBack.setTranslate(left + tx, top + ty)
        tlist.appendItem(translateBack)
        tlist.appendItem(scale)
        tlist.appendItem(translateOrigin)

        canv.recalculateDimensions(curShape)

        lastBBox = curShape.getBBox()
      },
      mouseUp (opts: { event: MouseEvent }) {
        const mode = canv.getMode()
        if (mode !== modeId) { return undefined }

        const keepObject = (opts.event.clientX !== startClientPos.x && opts.event.clientY !== startClientPos.y)

        return {
          keep: keepObject,
          element: curShape,
          started: false
        }
      }
    }
  }
}
