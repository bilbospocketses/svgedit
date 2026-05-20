/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
// svgCanvas / extension API surface is loosely typed; cleanup deferred to #3 or follow-up
/**
 * @file ext-layer_view.js
 *
 * @license MIT
 *
 *
 */

const name = 'layer_view'

const loadExtensionTranslation = async function (svgEditor: any): Promise<void> {
  let translationModule
  const lang = svgEditor.configObj.pref('lang')
  try {
    translationModule = await import(`./locale/${lang}.js`)
  } catch (_error) {
    console.warn(`Missing translation (${lang}) for ${name} - using 'en'`)
    translationModule = await import('./locale/en.js')
  }
  svgEditor.i18next.addResourceBundle(lang, name, translationModule.default)
}

export default {
  name,
  async init (this: any, _S: any) {
    const svgEditor: any = this
    const { svgCanvas } = svgEditor
    const { $id, $click } = svgCanvas
    await loadExtensionTranslation(svgEditor)

    const clickLayerView = (e?: any) => {
      $id('tool_layerView').pressed = !$id('tool_layerView').pressed
      updateLayerView(e)
    }

    const updateLayerView = (_e?: any) => {
      const drawing = svgCanvas.getCurrentDrawing()
      const curLayer = drawing.getCurrentLayerName()
      let layer = drawing.getNumLayers()
      while (layer--) {
        const name = drawing.getLayerName(layer)
        if (name !== curLayer && $id('tool_layerView').pressed) {
          drawing.setLayerVisibility(name, false)
        } else {
          drawing.setLayerVisibility(name, true)
        }
      }
      $id('layerlist').querySelectorAll('tr.layer').forEach(
        function (el: any) {
          const layervis = el.querySelector('td.layervis')
          const vis = el.classList.contains('layersel') || !$id('tool_layerView').pressed ? 'layervis' : 'layerinvis layervis'
          layervis.setAttribute('class', vis)
        }
      )
    }

    return {
      name: svgEditor.i18next.t(`${name}:name`),
      // The callback should be used to load the DOM with the appropriate UI items
      layersChanged () {
        if ($id('tool_layerView').pressed) {
          updateLayerView()
        } if (svgEditor.configObj.curConfig.layerView) {
          svgEditor.configObj.curConfig.layerView = false
          $id('tool_layerView').pressed = true
          updateLayerView()
        }
      },
      layerVisChanged () {
        if ($id('tool_layerView').pressed) {
          $id('tool_layerView').pressed = !$id('tool_layerView').pressed
        }
      },
      callback () {
        const buttonTemplate = document.createElement('template')
        const title = `${name}:buttons.0.title`
        const key = `${name}:buttons.0.key`
        buttonTemplate.innerHTML = `
      <se-button id="tool_layerView" title="${title}" shortcut="${key}" src="layer_view.svg"></se-button>`
        $id('editor_panel').append(buttonTemplate.content.cloneNode(true))
        $click($id('tool_layerView'), clickLayerView.bind(this))
      }
    }
  }
}
