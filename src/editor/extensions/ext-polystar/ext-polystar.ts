/**
 * @file ext-polystar.js
 *
 *
 * @license MIT
 *
 */

import { getSvgEditor } from '../../svgEditorInstance.js'

const name = 'polystar'

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
    const { ChangeElementCommand } = svgCanvas.history
    const addToHistory = (cmd: InstanceType<typeof ChangeElementCommand>): void => { svgCanvas.undoMgr.addCommandToHistory(cmd) }
    const { $id, $click } = svgCanvas
    let selElems: (Element | null)[]
    let started = false
    let newFO: Element
    await loadExtensionTranslation()

    /**
     * @param on true=display
     * @param tool "star" or "polygone"
     */
    const showPanel = (on: boolean, tool: string) => {
      if (on) {
        $id(`${tool}_panel`)!.style.removeProperty('display')
      } else {
        $id(`${tool}_panel`)!.style.display = 'none'
      }
    }

    const setAttr = (attr: string, val: string | number) => {
      svgCanvas.changeSelectedAttribute(attr, val)
      svgCanvas.call('changed', selElems)
    }

    /**
     * @param n angle
     * @return cotangeante
     */
    const cot = (n: number): number => 1 / Math.tan(n)

    /**
     * @param n angle
     * @returns sec
     */
    const sec = (n: number): number => 1 / Math.cos(n)

    return {
      name: svgEditor.i18next.t(`${name}:name`),
      // The callback should be used to load the DOM with the appropriate UI items
      callback () {
        // Add the button and its handler(s)
        // Note: the star extension needs to be loaded before the polygon extension
        const fbtitle = `${name}:title`
        const titleStar = `${name}:buttons.0.title`
        const titlePolygon = `${name}:buttons.1.title`
        const buttonTemplate = `
            <se-flyingbutton id="tools_polygon" title="${fbtitle}">
              <se-button id="tool_star" title="${titleStar}" src="star.svg">
              </se-button>
              <se-button id="tool_polygon" title="${titlePolygon}" src="polygon.svg">
              </se-button>
            </se-flyingbutton>
          `
        svgCanvas.insertChildAtIndex($id('tools_left')!, buttonTemplate, 10)
        // handler
        $click($id('tool_star')!, () => {
          if (svgEditor.leftPanel.updateLeftPanel('tool_star')) {
            svgCanvas.setMode('star')
            showPanel(true, 'star')
            showPanel(false, 'polygon')
          }
        })
        $click($id('tool_polygon')!, () => {
          if (svgEditor.leftPanel.updateLeftPanel('tool_polygon')) {
            svgCanvas.setMode('polygon')
            showPanel(true, 'polygon')
            showPanel(false, 'star')
          }
        })
        const label0 = `${name}:contextTools.0.label`
        const title0 = `${name}:contextTools.0.title`
        const label1 = `${name}:contextTools.1.label`
        const title1 = `${name}:contextTools.1.title`
        const label2 = `${name}:contextTools.2.label`
        const title2 = `${name}:contextTools.2.title`
        const label3 = `${name}:contextTools.3.label`
        const title3 = `${name}:contextTools.3.title`
        // Add the context panel and its handler(s)
        const panelTemplate = document.createElement('template')
        panelTemplate.innerHTML = `
          <div id="star_panel">
            <se-spin-input id="starNumPoints" label="${label0}" min=1 step=1 value=5 title="${title0}">
            </se-spin-input>
            <se-spin-input id="RadiusMultiplier" label="${label1}" min=1 step=2.5 value=3 title="${title1}">
            </se-spin-input>
            <se-spin-input id="radialShift" min=0 step=1 value=0 label="${label2}" title="${title2}">
            </se-spin-input>
          </div>
          <div id="polygon_panel">
            <se-spin-input size="3" id="polySides" min=1 step=1 value=5 label="${label3}" title="${title3}">
            </se-spin-input>
          </div>
        `
        // add handlers for the panel
        $id('tools_top')!.appendChild(panelTemplate.content.cloneNode(true))
        // don't display the panels on start
        showPanel(false, 'star')
        showPanel(false, 'polygon')
        $id('starNumPoints')!.addEventListener('change', (event: Event) => {
          const point = Number((event.target as HTMLInputElement).value)
          setAttr('point', point)
          const orient = 'point'
          let i = selElems.length
          while (i--) {
            const elem = selElems[i]
            if (elem && elem.hasAttribute('r')) {
              const oldPoint = elem.getAttribute('point')
              const oldPoints = elem.getAttribute('points')
              const radialshift = Number(elem.getAttribute('radialshift'))
              let xpos = 0
              let ypos = 0
              const svgElem = elem as unknown as SVGPolygonElement
              if (svgElem.points) {
                const list = svgElem.points
                const len = list.numberOfItems
                for (let j = 0; j < len; ++j) {
                  const pt = list.getItem(j)
                  xpos += pt.x
                  ypos += pt.y
                }
                const cx = xpos / len
                const cy = ypos / len
                const circumradius = Number(elem.getAttribute('r'))
                const inradius = circumradius / Number(elem.getAttribute('starRadiusMultiplier'))

                let polyPoints = ''
                for (let s = 0; point >= s; s++) {
                  let angle = 2.0 * Math.PI * (s / point)
                  if (orient === 'point') {
                    angle -= Math.PI / 2
                  } else if (orient === 'edge') {
                    angle = angle + Math.PI / point - Math.PI / 2
                  }

                  let x = circumradius * Math.cos(angle) + cx
                  let y = circumradius * Math.sin(angle) + cy

                  polyPoints += x + ',' + y + ' '

                  if (!isNaN(inradius)) {
                    angle = 2.0 * Math.PI * (s / point) + Math.PI / point
                    if (orient === 'point') {
                      angle -= Math.PI / 2
                    } else if (orient === 'edge') {
                      angle = angle + Math.PI / point - Math.PI / 2
                    }
                    angle += radialshift

                    x = inradius * Math.cos(angle) + cx
                    y = inradius * Math.sin(angle) + cy

                    polyPoints += x + ',' + y + ' '
                  }
                }
                elem.setAttribute('points', polyPoints)
                addToHistory(new ChangeElementCommand(elem, { point: oldPoint, points: oldPoints }))
              }
            }
          }
        })
        $id('RadiusMultiplier')!.addEventListener('change', (event: Event) => {
          setAttr('starRadiusMultiplier', (event.target as HTMLInputElement).value)
        })
        $id('radialShift')!.addEventListener('change', (event: Event) => {
          setAttr('radialshift', (event.target as HTMLInputElement).value)
        })
        $id('polySides')!.addEventListener('change', (event: Event) => {
          const sides = Number((event.target as HTMLInputElement).value)
          setAttr('sides', sides)
          let i = selElems.length
          while (i--) {
            const elem = selElems[i]
            if (elem && elem.hasAttribute('edge')) {
              const oldSides = elem.getAttribute('sides')
              const oldPoints = elem.getAttribute('points')
              let xpos = 0
              let ypos = 0
              const svgElem = elem as unknown as SVGPolygonElement
              if (svgElem.points) {
                const list = svgElem.points
                const len = list.numberOfItems
                for (let j = 0; j < len; ++j) {
                  const pt = list.getItem(j)
                  xpos += pt.x
                  ypos += pt.y
                }
                const cx = xpos / len
                const cy = ypos / len
                const edg = Number(elem.getAttribute('edge'))
                const inradius = (edg / 2) * cot(Math.PI / sides)
                const circumradius = inradius * sec(Math.PI / sides)
                let points = ''
                for (let s = 0; sides >= s; s++) {
                  const angle = (2.0 * Math.PI * s) / sides
                  const x = circumradius * Math.cos(angle) + cx
                  const y = circumradius * Math.sin(angle) + cy
                  points += x + ',' + y + ' '
                }
                elem.setAttribute('points', points)
                addToHistory(new ChangeElementCommand(elem, { sides: oldSides, points: oldPoints }))
              }
            }
          }
        })
      },
      mouseDown (opts: { start_x: number; start_y: number }) {
        if (svgCanvas.getMode() === 'star') {
          const fill = svgCanvas.getColor('fill') as string
          const stroke = svgCanvas.getColor('stroke') as string
          const strokeWidth = svgCanvas.getStrokeWidth()
          started = true
          newFO = svgCanvas.addSVGElementsFromJson({
            element: 'polygon',
            attr: {
              cx: opts.start_x,
              cy: opts.start_y,
              id: svgCanvas.getNextId(),
              shape: 'star',
              point: ($id('starNumPoints') as HTMLInputElement).value,
              r: 0,
              radialshift: ($id('radialShift') as HTMLInputElement).value,
              r2: 0,
              orient: 'point',
              fill,
              stroke,
              'stroke-width': strokeWidth
            }
          })
          return {
            started: true
          }
        }
        if (svgCanvas.getMode() === 'polygon') {
          const fill = svgCanvas.getColor('fill') as string
          const stroke = svgCanvas.getColor('stroke') as string
          const strokeWidth = svgCanvas.getStrokeWidth()
          started = true
          newFO = svgCanvas.addSVGElementsFromJson({
            element: 'polygon',
            attr: {
              cx: opts.start_x,
              cy: opts.start_y,
              id: svgCanvas.getNextId(),
              shape: 'regularPoly',
              sides: ($id('polySides') as HTMLInputElement).value,
              orient: 'x',
              edge: 0,
              fill,
              stroke,
              'stroke-width': strokeWidth
            }
          })

          return {
            started: true
          }
        }
        return undefined
      },
      mouseMove (opts: { mouse_x: number; mouse_y: number }) {
        if (!started) {
          return undefined
        }
        if (svgCanvas.getMode() === 'star') {
          const cx = Number(newFO.getAttribute('cx'))
          const cy = Number(newFO.getAttribute('cy'))
          const point = Number(newFO.getAttribute('point'))
          const orient = newFO.getAttribute('orient')
          const fill = newFO.getAttribute('fill')
          const stroke = newFO.getAttribute('stroke')
          const strokeWidth = Number(newFO.getAttribute('stroke-width'))
          const radialshift = Number(newFO.getAttribute('radialshift'))

          let x = opts.mouse_x
          let y = opts.mouse_y

          const circumradius =
            Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / 1.5
          const RadiusMultiplier = ($id('RadiusMultiplier') as HTMLInputElement).value
          const inradius =
            circumradius / Number(RadiusMultiplier)
          newFO.setAttribute('r', String(circumradius))
          newFO.setAttribute('r2', String(inradius))
          newFO.setAttribute('starRadiusMultiplier', RadiusMultiplier)

          let polyPoints = ''
          for (let s = 0; point >= s; s++) {
            let angle = 2.0 * Math.PI * (s / point)
            if (orient === 'point') {
              angle -= Math.PI / 2
            } else if (orient === 'edge') {
              angle = angle + Math.PI / point - Math.PI / 2
            }

            x = circumradius * Math.cos(angle) + cx
            y = circumradius * Math.sin(angle) + cy

            polyPoints += x + ',' + y + ' '

            if (!isNaN(inradius)) {
              angle = 2.0 * Math.PI * (s / point) + Math.PI / point
              if (orient === 'point') {
                angle -= Math.PI / 2
              } else if (orient === 'edge') {
                angle = angle + Math.PI / point - Math.PI / 2
              }
              angle += radialshift

              x = inradius * Math.cos(angle) + cx
              y = inradius * Math.sin(angle) + cy

              polyPoints += x + ',' + y + ' '
            }
          }
          newFO.setAttribute('points', polyPoints)
          newFO.setAttribute('fill', fill ?? '')
          newFO.setAttribute('stroke', stroke ?? '')
          newFO.setAttribute('stroke-width', String(strokeWidth))

          return {
            started: true
          }
        }
        if (svgCanvas.getMode() === 'polygon') {
          const cx = Number(newFO.getAttribute('cx'))
          const cy = Number(newFO.getAttribute('cy'))
          const sides = Number(newFO.getAttribute('sides'))
          // const orient = newFO.getAttribute('orient');
          const fill = newFO.getAttribute('fill')
          const stroke = newFO.getAttribute('stroke')
          const strokeWidth = Number(newFO.getAttribute('stroke-width'))

          let x = opts.mouse_x
          let y = opts.mouse_y

          const edg =
            Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / 1.5
          newFO.setAttribute('edge', String(edg))

          const inradius = (edg / 2) * cot(Math.PI / sides)
          const circumradius = inradius * sec(Math.PI / sides)
          let points = ''
          for (let s = 0; sides >= s; s++) {
            const angle = (2.0 * Math.PI * s) / sides
            x = circumradius * Math.cos(angle) + cx
            y = circumradius * Math.sin(angle) + cy

            points += x + ',' + y + ' '
          }

          // const poly = newFO.createElementNS(NS.SVG, 'polygon');
          newFO.setAttribute('points', points)
          newFO.setAttribute('fill', fill ?? '')
          newFO.setAttribute('stroke', stroke ?? '')
          newFO.setAttribute('stroke-width', String(strokeWidth))
          return {
            started: true
          }
        }
        return undefined
      },
      mouseUp () {
        if (svgCanvas.getMode() === 'star') {
          const r = newFO.getAttribute('r')
          return {
            keep: r !== '0',
            element: newFO
          }
        }
        if (svgCanvas.getMode() === 'polygon') {
          const edge = newFO.getAttribute('edge')
          const keep = edge !== '0'
          // svgCanvas.addToSelection([newFO], true);
          return {
            keep,
            element: newFO
          }
        }
        return undefined
      },
      selectedChanged (opts: { elems: (Element | null)[]; selectedElement?: Element | null; multiselected?: boolean }) {
        // Use this to update the current selected elements
        selElems = opts.elems
        let i = selElems.length
        // Hide panels if nothing is selected
        if (!i) {
          showPanel(false, 'star')
          showPanel(false, 'polygon')
          return
        }
        while (i--) {
          const elem = selElems[i]
          if (elem?.getAttribute('shape') === 'star') {
            if (opts.selectedElement && !opts.multiselected) {
              ;($id('starNumPoints') as HTMLInputElement).value = elem.getAttribute('point') ?? ''
              ;($id('radialShift') as HTMLInputElement).value = elem.getAttribute('radialshift') ?? ''
              showPanel(true, 'star')
            } else {
              showPanel(false, 'star')
            }
          } else if (elem?.getAttribute('shape') === 'regularPoly') {
            if (opts.selectedElement && !opts.multiselected) {
              ;($id('polySides') as HTMLInputElement).value = elem.getAttribute('sides') ?? ''
              showPanel(true, 'polygon')
            } else {
              showPanel(false, 'polygon')
            }
          } else {
            showPanel(false, 'star')
            showPanel(false, 'polygon')
          }
        }
      }
    }
  }
}
