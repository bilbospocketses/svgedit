/**
 * @file ext-panning.js
 *
 * @license MIT
 *
 *
 */
/*
  This is a very basic svgedit extension to let tablet/mobile devices pan without problem
*/

import { getSvgEditor } from '../../svgEditorInstance.js'

const name = 'panning'

const loadExtensionTranslation = async function (): Promise<void> {
  const svgEditor = getSvgEditor()
  let translationModule: Record<string, unknown>
  const lang = svgEditor.configObj.pref('lang')
  try {
    translationModule = await import(`./locale/${String(lang)}.js`) as Record<string, unknown>
  } catch (_error) {
    console.warn(`Missing translation (${String(lang)}) for ${name} - using 'en'`)
    translationModule = await import('./locale/en.js')
  }
  svgEditor.i18next.addResourceBundle(lang as string, name, translationModule.default as Record<string, unknown>)
}

export default {
  name,
  async init () {
    const svgEditor = getSvgEditor()
    await loadExtensionTranslation()
    const svgCanvas = svgEditor.svgCanvas
    const { $id, $click } = svgCanvas
    const insertAfter = (referenceNode: Element, newNode: Node) => {
      referenceNode.parentNode!.insertBefore(newNode, referenceNode.nextSibling)
    }
    return {
      name: svgEditor.i18next.t(`${name}:name`),
      callback () {
        const btitle = `${svgEditor.i18next.t(`${name}:buttons.0.title`)} ${svgEditor.i18next.t(`${name}:buttons.0.key`)}`
        // Add the button and its handler(s)
        const buttonTemplate = document.createElement('template')
        buttonTemplate.innerHTML = `
        <se-button id="ext-panning" title="${btitle}" src="panning.svg"></se-button>
        `
        insertAfter($id('tool_zoom')!, buttonTemplate.content.cloneNode(true))
        $click($id('ext-panning')!, () => {
          if (svgEditor.leftPanel.updateLeftPanel('ext-panning')) {
            svgCanvas.setMode('ext-panning')
          }
        })
      },
      mouseDown () {
        if (svgCanvas.getMode() === 'ext-panning') {
          svgEditor.setPanning(true)
          return {
            started: true
          }
        }
        return undefined
      },
      mouseUp () {
        if (svgCanvas.getMode() === 'ext-panning') {
          svgEditor.setPanning(false)
          return {
            keep: false,
            element: null
          }
        }
        return undefined
      }
    }
  }
}
