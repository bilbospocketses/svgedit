/**
 * @file ext-layer_view.js
 *
 * @license MIT
 *
 *
 */

import { getSvgEditor } from '../../svgEditorInstance.js'
import { loadExtensionTranslation } from '../loadExtensionTranslation.js'

const name = 'layer_view'

export default {
  name,
  async init () {
    const svgEditor = getSvgEditor()
    const svgCanvas = svgEditor.svgCanvas
    const { $id, $click } = svgCanvas
    await loadExtensionTranslation(name, (lang) => import(`./locale/${lang}.js`))

    const clickLayerView = () => {
      const btn = $id('tool_layerView') as HTMLElement & { pressed: boolean }
      btn.pressed = !btn.pressed
      updateLayerView()
    }

    const updateLayerView = () => {
      const drawing = svgCanvas.getCurrentDrawing()
      const curLayer = drawing.getCurrentLayerName()
      let layer = drawing.getNumLayers()
      while (layer--) {
        const name = drawing.getLayerName(layer)
        if (name !== curLayer && ($id('tool_layerView') as HTMLElement & { pressed: boolean }).pressed) {
          drawing.setLayerVisibility(name, false)
        } else {
          drawing.setLayerVisibility(name, true)
        }
      }
      $id('layerlist')!.querySelectorAll('tr.layer').forEach(
        function (el: Element) {
          const layervis = el.querySelector('td.layervis')
          const vis = el.classList.contains('layersel') || !($id('tool_layerView') as HTMLElement & { pressed: boolean }).pressed ? 'layervis' : 'layerinvis layervis'
          layervis?.setAttribute('class', vis)
        }
      )
    }

    return {
      name: svgEditor.i18next.t(`${name}:name`),
      // The callback should be used to load the DOM with the appropriate UI items
      layersChanged () {
        if (($id('tool_layerView') as HTMLElement & { pressed: boolean }).pressed) {
          updateLayerView()
        } if (svgEditor.configObj.curConfig.layerView) {
          svgEditor.configObj.curConfig.layerView = false
          ;($id('tool_layerView') as HTMLElement & { pressed: boolean }).pressed = true
          updateLayerView()
        }
      },
      layerVisChanged () {
        const btn = $id('tool_layerView') as HTMLElement & { pressed: boolean }
        if (btn.pressed) {
          btn.pressed = false
        }
      },
      callback () {
        const buttonTemplate = document.createElement('template')
        const title = `${name}:buttons.0.title`
        const key = svgEditor.i18next.t(`${name}:buttons.0.key`)
        buttonTemplate.innerHTML = `
      <se-button id="tool_layerView" title="${title}" shortcut="${key}" src="layer_view.svg"></se-button>`
        $id('editor_panel')!.append(buttonTemplate.content.cloneNode(true))
        $click($id('tool_layerView')!, clickLayerView.bind(this))
      }
    }
  }
}
