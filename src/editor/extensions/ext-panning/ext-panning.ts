/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-vars */
// svgCanvas / extension API surface is loosely typed; cleanup deferred to #3 or follow-up
/**
 * @file ext-panning.js
 *
 * @license MIT
 *
 * @copyright 2013 Luis Aguirre
 *
 */
/*
  This is a very basic svgedit extension to let tablet/mobile devices pan without problem
*/

const name = 'panning'

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
  async init (this: any) {
    const svgEditor: any = this
    await loadExtensionTranslation(svgEditor)
    const {
      svgCanvas
    } = svgEditor
    const { $id, $click } = svgCanvas
    const insertAfter = (referenceNode: any, newNode: any) => {
      referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling)
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
        insertAfter($id('tool_zoom'), buttonTemplate.content.cloneNode(true))
        $click($id('ext-panning'), () => {
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
