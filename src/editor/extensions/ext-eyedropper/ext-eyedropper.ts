/**
 * @file ext-eyedropper.js
 *
 * @license MIT
 *
 *
 */

import { getSvgEditor } from '../../svgEditorInstance.js'

const name = 'eyedropper'

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
    const svgCanvas = svgEditor.svgCanvas
    await loadExtensionTranslation()
    const { ChangeElementCommand } = svgCanvas.history
    const addToHistory = (cmd: InstanceType<typeof ChangeElementCommand>): void => { svgCanvas.undoMgr.addCommandToHistory(cmd) }
    const currentStyle: Record<string, string | number | null> = {}
    const { $id, $click } = svgCanvas

    // Helper to show what style is currectly picked
    const helperCursor = document.createElement('div')
    helperCursor.style.width = '14px'
    helperCursor.style.height = '14px'
    helperCursor.style.position = 'absolute'
    svgEditor.workarea.appendChild(helperCursor)

    const styleHelper = () => {
      const mode = svgCanvas.getMode()

      if (mode === name) {
        helperCursor.style.display = 'block'

        const strokeWidthNum = Number(currentStyle.strokeWidth)
        const borderStyle = currentStyle.strokeDashArray === 'none' || !currentStyle.strokeDashArray ? 'solid' : 'dotted'

        helperCursor.style.background = String(currentStyle.fillPaint ?? 'transparent')
        helperCursor.style.opacity = String(currentStyle.opacity ?? 1)
        helperCursor.style.border = (strokeWidthNum > 0 && currentStyle.strokePaint) ? `2px ${borderStyle} ${String(currentStyle.strokePaint)}` : 'none'
      }
    }

    const resetCurrentStyle = () => {
      const keys = Object.keys(currentStyle)

      keys.forEach(key => delete currentStyle[key])
    }

    const cancelHandler = () => {
      if (Object.keys(currentStyle).length > 0) {
        resetCurrentStyle()
        styleHelper()
      } else {
        svgEditor.leftPanel.clickSelect()
      }
    }

    const getStyle = (opts: { multiselected?: boolean; elems: (Element | null)[] }) => {
      let elem: Element | null = null
      if (!opts.multiselected && opts.elems[0] &&
        !['svg', 'g', 'use'].includes(opts.elems[0].nodeName)
      ) {
        elem = opts.elems[0]
        // grab the current style
        currentStyle.fillPaint = elem.getAttribute('fill') || 'black'
        currentStyle.fillOpacity = elem.getAttribute('fill-opacity') || 1.0
        currentStyle.strokePaint = elem.getAttribute('stroke')
        currentStyle.strokeOpacity = elem.getAttribute('stroke-opacity') || 1.0
        currentStyle.strokeWidth = elem.getAttribute('stroke-width')
        currentStyle.strokeDashArray = elem.getAttribute('stroke-dasharray')
        currentStyle.strokeLinecap = elem.getAttribute('stroke-linecap')
        currentStyle.strokeLinejoin = elem.getAttribute('stroke-linejoin')
        currentStyle.opacity = elem.getAttribute('opacity') || 1.0
      }
    }

    return {
      name: svgEditor.i18next.t(`${name}:name`),
      callback () {
        // Add the button and its handler(s)
        const title = `${name}:buttons.0.title`
        const key = 'ctrl+I'
        const buttonTemplate = `
        <se-button id="tool_eyedropper" title="${title}" src="eye_dropper.svg" shortcut=${key}></se-button>
        `
        svgCanvas.insertChildAtIndex($id('tools_left')!, buttonTemplate, 12)
        $click($id('tool_eyedropper')!, () => {
          if (svgEditor.leftPanel.updateLeftPanel('tool_eyedropper')) {
            svgCanvas.setMode(name)
          }
        })

        // enables helper, resets currently picked style if no element selected
        document.addEventListener('modeChange', () => {
          if (svgCanvas.getMode() === name) {
            styleHelper()
          } else {
            helperCursor.style.display = 'none'
          }
          if (svgCanvas.getSelectedElements().length === 0) {
            resetCurrentStyle()
          }
        })

        // Positions helper
        svgEditor.workarea.addEventListener('mousemove', (e: MouseEvent) => {
          const x = e.clientX
          const y = e.clientY

          if (svgCanvas.getMode() === name) {
            helperCursor.style.top = y + 'px'
            helperCursor.style.left = x + 12 + 'px'
            styleHelper()
          }
        })

        svgEditor.workarea.addEventListener('mouseleave', () => {
          helperCursor.style.display = 'none'
        })

        // Listens to Esc to reset currently picked style / set Select mode
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && svgCanvas.getMode() === name) {
            cancelHandler()
          }
        })
      },
      // if we have selected an element, grab its paint and enable the eye dropper button
      selectedChanged: getStyle,
      mouseDown (opts: { event: MouseEvent }) {
        const mode = svgCanvas.getMode()
        if (mode === name) {
          const e = opts.event
          const target = e.target as Element
          if (!['svg', 'g', 'use'].includes(target.nodeName)) {
            const changes: Record<string, string | null> = {}

            // If some style is picked - applies it to the target, if no style - picks it from the target
            if (Object.keys(currentStyle).length > 0) {
              const change = function (elem: Element, attrname: string, newvalue: string | number | null) {
                changes[attrname] = elem.getAttribute(attrname)
                elem.setAttribute(attrname, String(newvalue))
              }

              if (currentStyle.fillPaint) { change(target, 'fill', currentStyle.fillPaint) }
              if (currentStyle.fillOpacity) { change(target, 'fill-opacity', currentStyle.fillOpacity) }
              if (currentStyle.strokePaint) { change(target, 'stroke', currentStyle.strokePaint) }
              if (currentStyle.strokeOpacity) { change(target, 'stroke-opacity', currentStyle.strokeOpacity) }
              if (currentStyle.strokeWidth) { change(target, 'stroke-width', currentStyle.strokeWidth) }
              if (currentStyle.opacity) { change(target, 'opacity', currentStyle.opacity) }
              if (currentStyle.strokeLinecap) { change(target, 'stroke-linecap', currentStyle.strokeLinecap) }
              if (currentStyle.strokeLinejoin) { change(target, 'stroke-linejoin', currentStyle.strokeLinejoin) }

              if (currentStyle.strokeDashArray) {
                change(target, 'stroke-dasharray', currentStyle.strokeDashArray)
              } else {
                target.removeAttribute('stroke-dasharray')
              }

              addToHistory(new ChangeElementCommand(target, changes))
            } else {
              getStyle({ elems: [target] })
            }
          }
        }
      }
    }
  }
}
