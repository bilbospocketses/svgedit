/**
 * @file ext-connector.js
 *
 * @license MIT
 *
 *
 */

import { getSvgEditor } from '../../svgEditorInstance.js'
import { loadExtensionTranslation } from '../loadExtensionTranslation.js'

const name = 'connector'

/** Bounding-box shape used throughout the connector extension. */
interface ConnBB { x: number; y: number; width: number; height: number }

/** Describes one end of a connection between two elements. */
interface Connection {
  elem: Element
  connector: SVGPolylineElement
  is_start: boolean
  start_x: number
  start_y: number
}

export default {
  name,
  async init (S: { svgroot: SVGSVGElement; selectorManager: ReturnType<typeof import('@svgedit/svgcanvas')['default']['prototype']['getSelectorManager']> }) {
    const svgEditor = getSvgEditor()
    const svgCanvas = svgEditor.svgCanvas
    const { getElement, $id, $click, addSVGElementsFromJson } = svgCanvas
    const { svgroot, selectorManager } = S
    const seNs = svgCanvas.getEditorNS()
    await loadExtensionTranslation(name, (lang) => import(`./locale/${lang}.js`))

    let startX: number
    let startY: number
    let curLine: SVGPolylineElement
    let startElem: Element
    let endElem: Element

    let started = false
    let connections: Connection[] = []

    // svgCanvas event-bus subscription replaces the historical monkey-patching of
    // svgCanvas.groupSelectedElements + svgCanvas.moveSelectedElements (audit input #1,
    // closed 2026-05-21 via PR-B). chain-to-previous pattern matches the existing
    // svgCanvas.bind() replace-semantics — if another extension binds the same event later
    // it can chain to ours via the same idiom.
    type BusHandler = (...args: unknown[]) => unknown
    const prevBeforeGroup: BusHandler | undefined = svgCanvas.bind('before-group', (...args: unknown[]) => {
      if (prevBeforeGroup) prevBeforeGroup(...args)
      // Remove connectors from selection so they're not pulled into the group
      svgCanvas.removeFromSelection(Array.from(document.querySelectorAll('[id^="conn_"]')))
    })
    const prevAfterMove: BusHandler | undefined = svgCanvas.bind('after-move', (...args: unknown[]) => {
      if (prevAfterMove) prevAfterMove(...args)
      // Update connector geometry now that selected elements have settled at new positions
      updateConnectors(svgCanvas.getSelectedElements().filter((e): e is Element => e !== null))
    })

    const getBBintersect = (x: number, y: number, bb: ConnBB, offset?: number) => {
      // Adjust bounding box if offset is provided
      if (offset) {
        bb = { ...bb } // Create a shallow copy
        bb.width += offset
        bb.height += offset
        bb.x -= offset / 2
        bb.y -= offset / 2
      }

      // Calculate center of bounding box
      const midX = bb.x + bb.width / 2
      const midY = bb.y + bb.height / 2

      // Calculate lengths from (x, y) to center
      const lenX = x - midX
      const lenY = y - midY

      // Calculate slope of line from (x, y) to center
      const slope = Math.abs(lenY / lenX)

      // Calculate ratio to find intersection point
      let ratio
      if (slope < bb.height / bb.width) {
        ratio = bb.width / 2 / Math.abs(lenX)
      } else {
        ratio = lenY ? bb.height / 2 / Math.abs(lenY) : 0
      }

      // Calculate intersection point
      return {
        x: midX + lenX * ratio,
        y: midY + lenY * ratio
      }
    }

    /**
     * getOffset
     * @param side - The side of the line ("start" or "end") where the marker may be present.
     * @returns - Returns the calculated offset if a marker is present, otherwise returns 0.
     */
    // stroke-width is scaled by this factor to approximate the marker size.
    const MARKER_SIZE_FACTOR = 5
    const getOffset = (side: string, line: Element) => {
      // Check for marker attribute on the given side ("marker-start" or "marker-end")
      const hasMarker = line.getAttribute('marker-' + side)

      // Calculate size based on stroke-width, multiplied by a constant factor (here, 5)
      // TODO: This factor should ideally be based on the actual size of the marker.
      // parseFloat handles `"2"`, `"2px"`, etc. — prior code multiplied a raw string
      // by 5 producing NaN-ish results (item #18.1 — pre-existing runtime bug).
      const size = parseFloat(line.getAttribute('stroke-width') ?? '0') * MARKER_SIZE_FACTOR

      // Return calculated size if marker is present, otherwise return 0.
      return hasMarker ? size : 0
    }

    /**
     * @param on - Determines whether to show or hide the elements.
     */
    const showPanel = (on: boolean) => {
      // Find the 'connector_rules' or create it if it doesn't exist.
      let connRules = $id('connector_rules')
      if (!connRules) {
        connRules = document.createElement('style')
        connRules.setAttribute('id', 'connector_rules')
        document.getElementsByTagName('head')[0]!.appendChild(connRules)
      }

      // Update the content of <style> element to either hide or show certain elements.
      connRules.textContent = !on
        ? ''
        : '#tool_clone, #tool_topath, #tool_angle, #xy_panel { display: none !important; }'

      // Update the display property of the <style> element itself based on the 'on' value.
      connRules.style.display = on ? 'block' : 'none'
    }

    /**
     * @param pos - The position index or "end".
     */
    const setPoint = (elem: SVGPolylineElement, pos: number | 'end', x: number, y: number, setMid?: boolean) => {
      // Create a new SVG point
      const pts = elem.points
      const pt = svgroot.createSVGPoint()
      pt.x = x
      pt.y = y

      // If position is "end", set it to the last index
      if (pos === 'end') {
        pos = pts.numberOfItems - 1
      }

      // Try replacing the point at the specified position
      pts.replaceItem(pt, pos)

      // Optionally, set the midpoint
      if (setMid) {
        const ptStart = pts.getItem(0)
        const ptEnd = pts.getItem(pts.numberOfItems - 1)
        setPoint(elem, 1, (ptEnd.x + ptStart.x) / 2, (ptEnd.y + ptStart.y) / 2)
      }
    }

    const updatePoints = (line: SVGPolylineElement, conn: Connection, bb: ConnBB, altBB: ConnBB, pre: string, altPre: string) => {
      const srcX = altBB.x + altBB.width / 2
      const srcY = altBB.y + altBB.height / 2

      const pt = getBBintersect(srcX, srcY, bb, getOffset(pre, line))
      setPoint(line, conn.is_start ? 0 : 'end', pt.x, pt.y, true)

      const pt2 = getBBintersect(pt.x, pt.y, altBB, getOffset(altPre, line))
      setPoint(line, conn.is_start ? 'end' : 0, pt2.x, pt2.y, true)
    }

    const updateLine = (diffX: number, diffY: number) => {
      const dataStorage = svgCanvas.getDataStorage()

      for (const conn of connections) {
        const {
          connector: line,
          is_start: isStart,
          start_x: connStartX,
          start_y: connStartY
        } = conn

        const pre = isStart ? 'start' : 'end'
        const altPre = isStart ? 'end' : 'start'

        // Update bbox for this element
        const bb: ConnBB = { ...(dataStorage.get(line, `${pre}_bb`) as ConnBB) }
        bb.x = connStartX + diffX
        bb.y = connStartY + diffY

        dataStorage.put(line, `${pre}_bb`, bb)

        // Get center point of connected element
        const altBB = dataStorage.get(line, `${altPre}_bb`) as ConnBB

        updatePoints(line, conn, bb, altBB, pre, altPre)
      }
    }

    // Finds connectors associated with selected elements
    const findConnectors = (elems: Element[] = []) => {
      // Fetch data storage object from svgCanvas
      const dataStorage = svgCanvas.getDataStorage()

      // Query all connector elements (id starts with conn_)
      const connectors = document.querySelectorAll('[id^="conn_"]')
      // Reset connections array
      connections = []

      // Loop through each connector
      for (const connector of connectors) {
        let addThis = false // Flag to indicate whether to add this connector
        const parts: (Element | null)[] = [] // To hold the starting and ending elements connected by the connector

        // Loop through the connector ends ("start" and "end")
        for (const [i, pos] of ['start', 'end'].entries()) {
          // Fetch connected element and its bounding box
          const partId = dataStorage.get(connector, `c_${pos}`) as string | null

          // If part is null or undefined, fetch it and store it
          if (!partId) {
            const seConnAttr = connector.getAttributeNS(seNs, 'connector')
            const partElem = $id(
              (seConnAttr ?? '').split(' ')[i] ?? ''
            )
            if (partElem) {
              dataStorage.put(connector, `c_${pos}`, partElem.id)
              dataStorage.put(
                connector,
                `${pos}_bb`,
                svgCanvas.getStrokedBBox([partElem])
              )
            }
            parts.push(partElem)
          } else {
            // If part is already stored, fetch it by ID
            parts.push($id(partId))
          }
        }

        // Loop through the starting and ending elements connected by the connector
        for (let i = 0; i < 2; i++) {
          const cElem = parts[i]
          if (!cElem) continue
          const parents = svgCanvas.getParents(cElem.parentNode) ?? []

          // Check if the element is part of a selected group
          for (const el of parents) {
            if (elems.includes(el as Element)) {
              addThis = true
              break
            }
          }

          // If parent is null, remove the connector
          if (!cElem.parentNode) {
            connector.remove()
            continue
          }

          // If element is in the selection or part of a selected group
          if (elems.includes(cElem) || addThis) {
            const bb = svgCanvas.getStrokedBBox([cElem]) as ConnBB | null
            if (!bb) continue

            // Add connection information to the connections array
            connections.push({
              elem: cElem,
              connector: connector as unknown as SVGPolylineElement,
              is_start: i === 0,
              start_x: bb.x,
              start_y: bb.y
            })
          }
        }
      }
    }

    /**
     * Updates the connectors based on selected elements.
     */
    const updateConnectors = (elems?: Element[]) => {
      const dataStorage = svgCanvas.getDataStorage()

      // Find connectors associated with selected elements
      findConnectors(elems)

      if (connections.length) {
        // Iterate through each connection to update its state
        for (const conn of connections) {
          const {
            connector: line,
            is_start: isStart,
            start_x: connStartX,
            start_y: connStartY
          } = conn

          // Determine whether the connection starts or ends with this element
          const pre = isStart ? 'start' : 'end'

          // Update the bounding box for this element
          const bb = svgCanvas.getStrokedBBox([conn.elem]) as ConnBB
          bb.x = connStartX
          bb.y = connStartY
          dataStorage.put(line, `${pre}_bb`, bb)

          // Determine the opposite end ('start' or 'end') of the connection
          const altPre = isStart ? 'end' : 'start'

          // Retrieve the bounding box for the connected element at the opposite end
          const bb2 = dataStorage.get(line, `${altPre}_bb`) as ConnBB | undefined
          if (!bb2) continue

          // Calculate the center point of the connected element
          const srcX = bb2.x + bb2.width / 2
          const srcY = bb2.y + bb2.height / 2

          // Update the point of the element being moved
          const pt = getBBintersect(srcX, srcY, bb, getOffset(pre, line))
          setPoint(line, isStart ? 0 : 'end', pt.x, pt.y, true)

          // Update the point of the connected element at the opposite end
          const pt2 = getBBintersect(
            pt.x,
            pt.y,
            dataStorage.get(line, `${altPre}_bb`) as ConnBB,
            getOffset(altPre, line)
          )
          setPoint(line, isStart ? 'end' : 0, pt2.x, pt2.y, true)
        }
      }
    }

    /**
     * Do on reset.
     */
    const reset = () => {
      const dataStorage = svgCanvas.getDataStorage()
      // Make sure all connectors have data set
      const svgContent = svgCanvas.getSvgContent()
      const elements = svgContent.querySelectorAll('*')
      elements.forEach((element: Element) => {
        const conn = element.getAttributeNS(seNs, 'connector')
        if (conn) {
          const connData = conn.split(' ')
          const sbb = svgCanvas.getStrokedBBox([getElement(connData[0] ?? '')!]) as ConnBB
          const ebb = svgCanvas.getStrokedBBox([getElement(connData[1] ?? '')!]) as ConnBB
          dataStorage.put(element, 'c_start', connData[0])
          dataStorage.put(element, 'c_end', connData[1])
          dataStorage.put(element, 'start_bb', sbb)
          dataStorage.put(element, 'end_bb', ebb)
          svgCanvas.getEditorNS(true)
        }
      })
    }

    reset()

    return {
      name: svgEditor.i18next.t(`${name}:name`),
      callback () {
        // Add the button and its handler(s)
        const buttonTemplate = document.createElement('template')
        const title = `${name}:buttons.0.title`
        buttonTemplate.innerHTML = `
         <se-button id="tool_connect" title="${title}" src="conn.svg"></se-button>
         `
        $id('tools_left')!.append(buttonTemplate.content.cloneNode(true))
        $click($id('tool_connect')!, () => {
          if (svgEditor.leftPanel.updateLeftPanel('tool_connect')) {
            svgCanvas.setMode('connector')
          }
        })
      },
      mouseDown (opts: { event: MouseEvent; start_x: number; start_y: number; selectedElements: Element[] }) {
        // Retrieve necessary data from the SVG canvas and the event object
        const dataStorage = svgCanvas.getDataStorage()
        const svgContent = svgCanvas.getSvgContent()
        const { event: e, start_x: optsStartX, start_y: optsStartY } = opts
        const mode = svgCanvas.getMode()
        const {
          curConfig: { initStroke }
        } = svgEditor.configObj

        if (mode === 'connector') {
          // Return if the line is already started
          if (started) return undefined

          const mouseTarget = e.target as Element
          const parents = svgCanvas.getParents(mouseTarget.parentNode) ?? []

          // Check if the target is a child of the main SVG content
          if (parents.includes(svgContent)) {
            // Identify the connectable element, considering foreignObject elements
            const fo = svgCanvas.getClosest(
              mouseTarget.parentNode as Element,
              'foreignObject'
            )
            startElem = fo || mouseTarget

            // Retrieve the bounding box and calculate the center of the start element
            const bb = svgCanvas.getStrokedBBox([startElem]) as ConnBB
            const x = bb.x + bb.width / 2
            const y = bb.y + bb.height / 2

            // Set the flag to indicate the line has started
            started = true

            // Create a new polyline element
            curLine = addSVGElementsFromJson({
              element: 'polyline',
              attr: {
                id: 'conn_' + svgCanvas.getNextId(),
                points: `${x},${y} ${x},${y} ${optsStartX},${optsStartY}`,
                stroke:
                  initStroke.color === 'none'
                    ? 'none'
                    : `#${initStroke.color}`,
                'stroke-width':
                  !startElem.getAttribute('stroke-width') || startElem.getAttribute('stroke-width') === '0'
                    ? initStroke.width
                    : Number(startElem.getAttribute('stroke-width')),
                fill: 'none',
                opacity: initStroke.opacity,
                style: 'pointer-events:none'
              }
            }) as unknown as SVGPolylineElement

            // Store the bounding box of the start element
            dataStorage.put(curLine, 'start_bb', bb)
          }

          return {
            started: true
          }
        }

        if (mode === 'select') {
          // Find connectors if the mode is 'select'
          findConnectors(opts.selectedElements)
        }

        return undefined
      },
      mouseMove (opts: { mouse_x: number; mouse_y: number }) {
        // Exit early if there are no connectors
        if (connections.length === 0) return

        const dataStorage = svgCanvas.getDataStorage()
        const zoom = svgCanvas.getZoom()
        const x = opts.mouse_x / zoom
        const y = opts.mouse_y / zoom
        /** @todo  We have a concern if startX or startY are undefined */
        if (!startX || !startY) return

        const diffX = x - startX
        const diffY = y - startY

        const mode = svgCanvas.getMode()
        if (mode === 'connector' && started) {
          // Set start point (adjusts based on bb)
          const pt = getBBintersect(
            x,
            y,
            dataStorage.get(curLine, 'start_bb') as ConnBB,
            getOffset('start', curLine)
          )
          startX = pt.x
          startY = pt.y

          setPoint(curLine, 0, pt.x, pt.y, true)

          // Set end point
          setPoint(curLine, 'end', x, y, true)
        } else if (mode === 'select') {
          for (const elem of svgCanvas.getSelectedElements()) {
            if (elem && dataStorage.has(elem, 'c_start')) {
              svgCanvas.removeFromSelection([elem])
              ;(elem as SVGGraphicsElement).transform.baseVal.clear()
            }
          }
          if (connections.length) {
            updateLine(diffX, diffY)
          }
        }
      },
      mouseUp (opts: { event: MouseEvent }) {
        // Get necessary data and initial setups
        const dataStorage = svgCanvas.getDataStorage()
        const svgContent = svgCanvas.getSvgContent()
        const { event: e } = opts
        let mouseTarget = e.target as Element

        // Early exit if not in connector mode
        if (svgCanvas.getMode() !== 'connector') return undefined

        // Check for a foreignObject parent and update mouseTarget if found
        const fo = svgCanvas.getClosest(mouseTarget.parentNode as Element, 'foreignObject')
        if (fo) mouseTarget = fo

        // Check if the target is a child of the main SVG content
        const parents = svgCanvas.getParents(mouseTarget.parentNode) ?? []
        const isInSvgContent = parents.includes(svgContent)

        if (mouseTarget === startElem) {
          // Case: Started drawing line via click
          started = true
          return {
            keep: true,
            element: null,
            started
          }
        }

        if (!isInSvgContent) {
          // Case: Invalid target element; remove the line
          curLine?.remove()
          started = false
          return {
            keep: false,
            element: null,
            started
          }
        }

        // Valid target element for the end of the line
        endElem = mouseTarget

        const startId = startElem?.id || ''
        const endId = endElem?.id || ''
        const connStr = `${startId} ${endId}`
        const altStr = `${endId} ${startId}`

        // Prevent duplicate connectors
        const dupe = Array.from(
          document.querySelectorAll('[id^="conn_"]')
        ).filter(
          conn =>
            conn.getAttributeNS(seNs, 'connector') === connStr ||
            conn.getAttributeNS(seNs, 'connector') === altStr
        )

        if (dupe.length) {
          curLine.remove()
          return {
            keep: false,
            element: null,
            started: false
          }
        }

        // Update the end point of the connector
        const bb = svgCanvas.getStrokedBBox([endElem]) as ConnBB
        const pt = getBBintersect(
          startX,
          startY,
          bb,
          getOffset('start', curLine)
        )
        setPoint(curLine, 'end', pt.x, pt.y, true)

        // Save metadata to the connector
        dataStorage.put(curLine, 'c_start', startId)
        dataStorage.put(curLine, 'c_end', endId)
        dataStorage.put(curLine, 'end_bb', bb)
        curLine.setAttributeNS(seNs, 'se:connector', connStr)
        curLine.setAttribute('opacity', '1')

        // Finalize the connector
        svgCanvas.addToSelection([curLine])
        svgCanvas.moveToBottomSelectedElement()
        selectorManager.requestSelector(curLine)?.showGrips(false)

        started = false
        return {
          keep: true,
          element: curLine,
          started
        }
      },
      selectedChanged (opts: { elems: (Element | null)[]; selectedElement?: Element | null; multiselected?: boolean }) {
        // Get necessary data storage and SVG content
        const dataStorage = svgCanvas.getDataStorage()
        const svgContent = svgCanvas.getSvgContent()

        // Exit early if there are no connectors
        if (!svgContent.querySelectorAll('[id^="conn_"]').length) return

        // If the current mode is 'connector', switch to 'select'
        if (svgCanvas.getMode() === 'connector') {
          svgCanvas.setMode('select')
        }

        // Get currently selected elements
        const { elems: selElems } = opts

        // Iterate through selected elements
        for (const elem of selElems) {
          // If the element has a connector start, handle it
          if (elem && dataStorage.has(elem, 'c_start')) {
            selectorManager.requestSelector(elem)?.showGrips(false)

            // Show panel depending on selection state
            showPanel(!!opts.selectedElement && !opts.multiselected)
          } else {
            // Hide panel if no connector start
            showPanel(false)
          }
        }

        // Update connectors based on selected elements
        updateConnectors(svgCanvas.getSelectedElements().filter((e): e is Element => e !== null))
      },
      elementChanged (opts: { elems: (Element | null)[] }) {
        // Get the necessary data storage
        const dataStorage = svgCanvas.getDataStorage()

        // Get the first element from the options; exit early if it's null
        let [elem] = opts.elems
        if (!elem) return

        // Reinitialize if it's the main SVG content
        if (elem.tagName === 'svg' && elem.id === 'svgcontent') {
          reset()
        }

        // Check for marker attributes and update offsets
        const markerStart = elem.getAttribute('marker-start')
        const markerMid = elem.getAttribute('marker-mid')
        const markerEnd = elem.getAttribute('marker-end')
        if (markerStart || markerMid || markerEnd) {
          curLine = elem as SVGPolylineElement
          dataStorage.put(elem, 'start_off', Boolean(markerStart))
          dataStorage.put(elem, 'end_off', Boolean(markerEnd))

          // Convert lines to polyline if there's a mid-marker
          if (elem.tagName === 'line' && markerMid) {
            const x1 = elem.getAttribute('x1') ?? '0'
            const x2 = elem.getAttribute('x2') ?? '0'
            const y1 = elem.getAttribute('y1') ?? '0'
            const y2 = elem.getAttribute('y2') ?? '0'
            const id = elem.id

            const midPt = `${(Number(x1) + Number(x2)) / 2},${
              (Number(y1) + Number(y2)) / 2
            }`
            const pline = addSVGElementsFromJson({
              element: 'polyline',
              attr: {
                points: `${x1},${y1} ${midPt} ${x2},${y2}`,
                stroke: elem.getAttribute('stroke') ?? 'none',
                'stroke-width': elem.getAttribute('stroke-width') ?? 1,
                'marker-mid': markerMid,
                fill: 'none',
                opacity: elem.getAttribute('opacity') || 1
              }
            })

            elem.insertAdjacentElement('afterend', pline)
            elem.remove()
            svgCanvas.clearSelection()
            pline.id = id
            svgCanvas.addToSelection([pline])
            elem = pline
          }
        }

        // Update connectors based on the current element
        if (elem?.id.startsWith('conn_')) {
          const start = getElement(dataStorage.get(elem, 'c_start') as string)
          if (start) updateConnectors([start])
        } else {
          updateConnectors(svgCanvas.getSelectedElements().filter((e): e is Element => e !== null))
        }
      },
      IDsUpdated (input: { elems: Array<{ attr: Record<string, string> }>; changes: Record<string, string> }) {
        const remove: string[] = []
        input.elems.forEach(function (elem) {
          if ('se:connector' in elem.attr) {
            elem.attr['se:connector'] = elem.attr['se:connector']
              .split(' ')
              .map(function (oldID) {
                return input.changes[oldID] ?? oldID
              })
              .join(' ')

            // Check validity - the field would be something like 'svg_21 svg_22', but
            // if one end is missing, it would be 'svg_21' and therefore fail this test
            if (!/. ./.test(elem.attr['se:connector'])) {
              remove.push(elem.attr.id ?? '')
            }
          }
        })
        return { remove }
      },
      toolButtonStateUpdate (opts: { nostroke: boolean }) {
        const button = $id('tool_connect') as HTMLElement & { pressed: boolean; disabled: boolean }
        if (opts.nostroke && button.pressed === true) {
          svgEditor.leftPanel.clickSelect()
        }
        button.disabled = opts.nostroke
      }
    }
  }
}
