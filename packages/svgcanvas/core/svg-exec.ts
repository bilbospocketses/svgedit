/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-argument -- ISvgCanvas any-typed API; DOM traversal uses non-null assertions */
/**
 * Tools for svg.
 * @module svg
 * @license MIT
 */

import { jsPDF as JsPDF } from 'jspdf'
import 'svg2pdf.js'
import * as history from './history.js'
import { error } from '../common/logger.js'
import {
  text2xml,
  cleanupElement,
  findDefs,
  setHref,
  getHref,
  preventClickDefault,
  toXml,
  getStrokedBBoxDefaultVisible,
  walkTree,
  getBBox as utilsGetBBox,
  hashCode
} from './utilities.js'
import {
  transformPoint,
  transformListToTransform,
  getTransformList
} from './math.js'
import { convertUnit, shortFloat, convertToNum } from './units.js'
import { isChrome } from '../common/browser.js'
import * as pathModule from './path.js'
import { NS } from './namespaces.js'
import * as draw from './draw.js'
import { recalculateDimensions } from './recalculate.js'
import { getParents, getClosest } from '../common/util.js'

const {
  InsertElementCommand,
  RemoveElementCommand,
  ChangeElementCommand,
  BatchCommand
} = history

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/**
 * @function module:svg-exec.init
 * @param svgContext
 */
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
  svgCanvas.setSvgString = setSvgString
  svgCanvas.importSvgString = importSvgString
  svgCanvas.uniquifyElems = uniquifyElemsMethod
  svgCanvas.setUseData = setUseDataMethod
  svgCanvas.convertGradients = convertGradientsMethod
  svgCanvas.removeUnusedDefElems = removeUnusedDefElemsMethod
  svgCanvas.svgCanvasToString = svgCanvasToString
  svgCanvas.svgToString = svgToString
  svgCanvas.embedImage = embedImage
  svgCanvas.rasterExport = rasterExport
  svgCanvas.exportPDF = exportPDF
}

/**
 * Main function to set up the SVG content for output.
 * @function module:svgcanvas.SvgCanvas#svgCanvasToString
 * @returns The SVG image for output
 */
const svgCanvasToString = (): string => {
  // keep calling it until there are none to remove
  while (svgCanvas.removeUnusedDefElems() > 0) {}

  svgCanvas.pathActions.clear(true)

  // Keep generator comment on top
  const childNodesElems = svgCanvas.getSvgContent().childNodes as NodeList
  childNodesElems.forEach((node: Node, i: number) => {
    if (i && node.nodeType === 8 && (node as Comment).data.includes('Created with')) {
      svgCanvas.getSvgContent().firstChild!.before(node)
    }
  })

  // Move out of in-group editing mode
  if (svgCanvas.getCurrentGroup()) {
    draw.leaveContext()
    svgCanvas.selectOnly([svgCanvas.getCurrentGroup()!])
  }

  const nakedSvgs: Element[] = []

  // Unwrap gsvg if it has no special attributes (only id and style)
  const gsvgElems = svgCanvas.getSvgContent().querySelectorAll('g[data-gsvg]')
  Array.prototype.forEach.call(gsvgElems, (element: Element) => {
    const attrs = element.attributes
    let len = attrs.length
    for (let i = 0; i < len; i++) {
      if (attrs[i]?.nodeName === 'id' || attrs[i]?.nodeName === 'style') {
        len--
      }
    }
    // No significant attributes, so ungroup
    if (len <= 0) {
      const svg = element.firstChild as Element
      nakedSvgs.push(svg)
      element.replaceWith(svg)
    }
  })
  const output = svgCanvas.svgToString(svgCanvas.getSvgContent(), 0)

  // Rewrap gsvg
  if (nakedSvgs.length) {
    Array.prototype.forEach.call(nakedSvgs, (el: Element) => {
      svgCanvas.groupSvgElem(el)
    })
  }

  return output
}

/**
 * Sub function ran on each SVG element to convert it to a string as desired.
 * @function module:svgcanvas.SvgCanvas#svgToString
 * @param elem - The SVG element to convert
 * @param indent - Number of spaces to indent this tag
 * @returns The given element as an SVG tag
 */
const svgToString = (elem: Element, indent: number): string => {
  const curConfig = svgCanvas.getCurConfig() as { baseUnit: string; dynamicOutput?: boolean }
  const nsMap = svgCanvas.getNsMap()
  const out: string[] = []
  const unit = curConfig.baseUnit
  const unitRe = new RegExp(`^-?[\\d\\.]+${unit}$`)

  if (elem) {
    cleanupElement(elem)
    const attrs = [...elem.attributes]
    const childs = elem.childNodes
    attrs.sort((a, b) => {
      return a.name > b.name ? -1 : 1
    })

    for (let i = 0; i < indent; i++) {
      out.push(' ')
    }
    out.push('<')
    out.push(elem.localName)
    if (elem.id === 'svgcontent') {
      // Process root element separately
      const res = svgCanvas.getResolution() as { w: number | string; h: number | string }

      let vb = ''
      if (curConfig.dynamicOutput) {
        vb = elem.getAttribute('viewBox') ?? ''
        if (!vb) {
          vb = [0, 0, res.w, res.h].join(' ')
        }
        out.push(` viewBox="${vb}" xmlns="${NS.SVG}"`)
      } else {
        if (unit !== 'px') {
          res.w = convertUnit(Number(res.w), unit) + unit
          res.h = convertUnit(Number(res.h), unit) + unit
        }
        out.push(
          ' width="' + res.w + '" height="' + res.h + '" xmlns="' + NS.SVG + '"'
        )
      }

      const nsuris: Record<string, boolean> = {}

      // Check elements for namespaces, add if found
      const csElements = elem.querySelectorAll('*')
      const cElements = Array.prototype.slice.call(csElements) as Element[]
      cElements.push(elem)
      Array.prototype.forEach.call(cElements, (el: Element) => {
        const uri = el.namespaceURI
        if (
          uri &&
          !nsuris[uri] &&
          nsMap[uri] &&
          nsMap[uri] !== 'xmlns' &&
          nsMap[uri] !== 'xml'
        ) {
          nsuris[uri] = true
          out.push(` xmlns:${nsMap[uri]}="${uri}"`)
        }
        if (el.attributes.length > 0) {
          for (const [, attr] of Object.entries(el.attributes)) {
            const u = (attr).namespaceURI
            if (u && !nsuris[u] && nsMap[u] !== 'xmlns' && nsMap[u] !== 'xml') {
              nsuris[u] = true
              out.push(` xmlns:${nsMap[u]}="${u}"`)
            }
          }
        }
      })

      let i = attrs.length
      const attrNames = [
        'width',
        'height',
        'xmlns',
        'x',
        'y',
        'viewBox',
        'id',
        'overflow'
      ]
      while (i--) {
        const attr = attrs[i]
        if (!attr) continue
        const attrVal = toXml(attr.value)

        // Namespaces have already been dealt with, so skip
        if (attr.nodeName.startsWith('xmlns:')) {
          continue
        }

        // only serialize attributes we don't use internally
        if (
          attrVal !== '' &&
          !attrNames.includes(attr.localName) &&
          (!attr.namespaceURI || nsMap[attr.namespaceURI])
        ) {
          out.push(' ')
          out.push(attr.nodeName)
          out.push('="')
          out.push(attrVal)
          out.push('"')
        }
      }
    } else {
      // Skip empty defs
      if (elem.nodeName === 'defs' && !elem.firstChild) {
        return ''
      }

      // Audit-flagged: preserve _moz-math-font-style removal (svg-exec.ts:252)
      const mozAttrs = ['-moz-math-font-style', '_moz-math-font-style']
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i]
        if (!attr) continue
        let attrVal = toXml(attr.value)
        // remove bogus attributes added by Gecko
        if (mozAttrs.includes(attr.localName)) {
          continue
        }
        if (attrVal === 'null') {
          const styleName = attr.localName.replace(/-[a-z]/g, (s: string) =>
            (s[1] ?? '').toUpperCase()
          )
          if (Object.prototype.hasOwnProperty.call((elem as HTMLElement).style, styleName)) {
            continue
          }
        }
        if (attrVal !== '') {
          if (attrVal.startsWith('pointer-events')) {
            continue
          }
          if (attr.localName === 'class' && attrVal.startsWith('se_')) {
            continue
          }
          out.push(' ')
          if (attr.localName === 'd') {
            attrVal = svgCanvas.pathActions.convertPath(elem as SVGPathElement, true)
          }
          if (!isNaN(Number(attrVal))) {
            attrVal = String(shortFloat(attrVal))
          } else if (unitRe.test(attrVal)) {
            attrVal = String(shortFloat(attrVal)) + unit
          }

          // Embed images when saving
          if (
            svgCanvas.getSvgOptionApply() &&
            elem.nodeName === 'image' &&
            attr.localName === 'href' &&
            svgCanvas.getSvgOptionImages() &&
            svgCanvas.getSvgOptionImages() === 'embed'
          ) {
            const img = svgCanvas.getEncodableImages(attrVal) as string | false
            if (img) {
              attrVal = img
            }
          }

          // map various namespaces to our fixed namespace prefixes
          if (
            !attr.namespaceURI ||
            attr.namespaceURI === NS.SVG ||
            nsMap[attr.namespaceURI]
          ) {
            out.push(attr.nodeName)
            out.push('="')
            out.push(attrVal)
            out.push('"')
          }
        }
      }
    }

    if (elem.hasChildNodes()) {
      out.push('>')
      indent++
      let bOneLine = false

      for (let i = 0; i < childs.length; i++) {
        const child = childs.item(i)
        if (!child) continue
        switch (child.nodeType) {
          case 1: // element node
            out.push('\n')
            out.push(svgCanvas.svgToString(child as Element, indent))
            break
          case 3: {
            // text node
            const str = (child.nodeValue ?? '').replace(/^\s+|\s+$/g, '')
            if (str !== '') {
              bOneLine = true
              out.push(String(toXml(str)))
            }
            break
          }
          case 4: // cdata node
            out.push('\n')
            out.push(new Array(indent + 1).join(' '))
            out.push('<![CDATA[')
            out.push(child.nodeValue ?? '')
            out.push(']]>')
            break
          case 8: // comment
            out.push('\n')
            out.push(new Array(indent + 1).join(' '))
            out.push('<!--')
            out.push((child as Comment).data)
            out.push('-->')
            break
        } // switch on node type
      }
      indent--
      if (!bOneLine) {
        out.push('\n')
        for (let i = 0; i < indent; i++) {
          out.push(' ')
        }
      }
      out.push('</')
      out.push(elem.localName)
      out.push('>')
    } else {
      out.push('/>')
    }
  }
  return out.join('')
} // end svgToString()

/**
 * This function sets the current drawing as the input SVG XML.
 * @function module:svgcanvas.SvgCanvas#setSvgString
 * @param xmlString - The SVG as XML text.
 * @param [preventUndo=false] - Indicates if we want to do the
 * changes without adding them to the undo stack - e.g. for initializing a
 * drawing on page load.
 * @fires module:svgcanvas.SvgCanvas#event:setnonce
 * @fires module:svgcanvas.SvgCanvas#event:unsetnonce
 * @fires module:svgcanvas.SvgCanvas#event:changed
 * @returns This function returns `false` if the set was
 *     unsuccessful, `true` otherwise.
 */
const setSvgString = (xmlString: string, preventUndo?: boolean): boolean => {
  const curConfig = svgCanvas.getCurConfig() as { show_outside_canvas?: boolean; dimensions?: number[] }
  const dataStorage = svgCanvas.getDataStorage()
  try {
    // convert string into XML document
    const newDoc = text2xml(xmlString)
    if (
      newDoc.firstElementChild &&
      newDoc.firstElementChild.namespaceURI !== NS.SVG
    ) {
      return false
    }

    svgCanvas.prepareSvg(newDoc)

    const batchCmd = new BatchCommand('Change Source')

    // remove old svg document
    const { nextSibling } = svgCanvas.getSvgContent()

    svgCanvas.getSvgContent().remove()
    const oldzoom = svgCanvas.getSvgContent()
    batchCmd.addSubCommand(
      new RemoveElementCommand(oldzoom, nextSibling, svgCanvas.getSvgRoot())
    )

    // set new svg document
    if (svgCanvas.getDOMDocument().adoptNode) {
      svgCanvas.setSvgContent(
        svgCanvas.getDOMDocument().adoptNode(newDoc.documentElement) as unknown as SVGSVGElement
      )
    } else {
      svgCanvas.setSvgContent(
        svgCanvas.getDOMDocument().importNode(newDoc.documentElement, true) as unknown as SVGSVGElement
      )
    }

    svgCanvas.getSvgRoot().append(svgCanvas.getSvgContent())
    const content = svgCanvas.getSvgContent() as Element

    svgCanvas.currentDrawing = new draw.Drawing(
      svgCanvas.getSvgContent(),
      svgCanvas.getIdPrefix()
    )

    // retrieve or set the nonce
    const nonce = svgCanvas.getCurrentDrawing().getNonce() as string | null
    if (nonce) {
      svgCanvas.call('setnonce', nonce)
    } else {
      svgCanvas.call('unsetnonce')
    }

    // change image href vals if possible
    const elements = content.querySelectorAll('image')
    Array.prototype.forEach.call(elements, (image: Element) => {
      preventClickDefault(image)
      const val = svgCanvas.getHref(image)
      if (val) {
        if (val.startsWith('data:')) {
          const m = val.match(/svgedit_url=(.*?);/)
          if (m) {
            const url = decodeURIComponent(m[1] ?? '')
            const iimg = new Image()
            iimg.addEventListener('load', () => {
              setHref(image, val)
            })
            iimg.src = url
          }
        }
        // Add to encodableImages if it loads
        void svgCanvas.embedImage(val)
      }
    })
    // Duplicate id replace changes
    const nodes = content.querySelectorAll('[id]')
    const ids: Record<string, number> = {}
    const totalNodes = nodes.length

    for (let i = 0; i < totalNodes; i++) {
      const node = nodes[i]
      if (!node) continue
      const currentId = node.id ? node.id : 'undefined'
      if (isNaN(ids[currentId] ?? NaN)) {
        ids[currentId] = 0
      }
      ids[currentId] = (ids[currentId] ?? 0) + 1
    }

    Object.entries(ids).forEach(([key, value]) => {
      if (value > 1) {
        const nodes = content.querySelectorAll(`[id="${key}"]`)
        for (let i = 1; i < nodes.length; i++) {
          nodes[i]?.setAttribute('id', svgCanvas.getNextId())
        }
      }
    })

    // Wrap child SVGs in group elements
    const svgElements = content.querySelectorAll('svg')
    Array.prototype.forEach.call(svgElements, (element: Element) => {
      // Skip if it's in a <defs>
      if (getClosest(element.parentNode as Element | null, 'defs')) {
        return
      }

      // Audit-flagged: uniquifyElems on svg import (svg-exec.ts:516 setUseData) — preserve
      svgCanvas.uniquifyElems(element)

      const pa = element.parentNode as Element
      if (pa.childNodes.length === 1 && pa.nodeName === 'g') {
        dataStorage.put(pa, 'gsvg', element)
        pa.id = pa.id || svgCanvas.getNextId()
      } else {
        svgCanvas.groupSvgElem(element)
      }
    })

    // Audit-flagged: setUseData on undo/redo of object addition (svg-exec.ts:516) — preserve as-is
    svgCanvas.setUseData(content)

    svgCanvas.convertGradients(content)

    const attrs: Record<string, string | number> = {
      id: 'svgcontent',
      overflow: curConfig.show_outside_canvas ? 'visible' : 'hidden'
    }

    let percs = false

    // determine proper size
    if (content.getAttribute('viewBox')) {
      const viBox = content.getAttribute('viewBox') ?? ''
      const vb = viBox.split(/[ ,]+/)
      const vbWidth = Number(vb[2])
      const vbHeight = Number(vb[3])
      if (Number.isFinite(vbWidth)) {
        attrs.width = vbWidth
      }
      if (Number.isFinite(vbHeight)) {
        attrs.height = vbHeight
      }
    } else {
      ;(['width', 'height'] as const).forEach((dim) => {
        const val = content.getAttribute(dim) ?? '100%'
        if (String(val).slice(-1) === '%') {
          percs = true
        } else {
          attrs[dim] = convertToNum(dim, val)
        }
      })
    }

    // identify layers
    draw.identifyLayers()

    // Give ID for any visible layer children missing one
    const chiElems = content.children
    Array.prototype.forEach.call(chiElems, (chiElem: Element) => {
      const visElems = chiElem.querySelectorAll(svgCanvas.getVisElems())
      Array.prototype.forEach.call(visElems, (elem: Element) => {
        if (!elem.id) {
          elem.id = svgCanvas.getNextId()
        }
      })
    })

    // Percentage width/height, so let's base it on visible elements
    if (percs) {
      const bb = getStrokedBBoxDefaultVisible()
      if (bb && typeof bb === 'object') {
        attrs.width = bb.width + bb.x
        attrs.height = bb.height + bb.y
      } else {
        if (attrs.width === null || attrs.width === undefined) {
          attrs.width = 100
        }
        if (attrs.height === null || attrs.height === undefined) {
          attrs.height = 100
        }
      }
    }

    // Just in case negative numbers are given or
    // result from the percs calculation
    if (!Number.isFinite(Number(attrs.width)) || Number(attrs.width) <= 0) {
      attrs.width = 100
    }
    if (!Number.isFinite(Number(attrs.height)) || Number(attrs.height) <= 0) {
      attrs.height = 100
    }

    for (const [key, value] of Object.entries(attrs)) {
      content.setAttribute(key, String(value))
    }
    svgCanvas.contentW = Number(attrs.width)
    svgCanvas.contentH = Number(attrs.height)

    batchCmd.addSubCommand(new InsertElementCommand(svgCanvas.getSvgContent()))
    // update root to the correct size
    const width = content.getAttribute('width')
    const height = content.getAttribute('height')
    const changes = { width, height }
    batchCmd.addSubCommand(
      new ChangeElementCommand(svgCanvas.getSvgRoot(), changes)
    )

    // reset zoom
    svgCanvas.setZoom(1)

    svgCanvas.clearSelection()
    pathModule.clearData()
    svgCanvas.getSvgRoot().append(svgCanvas.selectorManager.selectorParentGroup!)

    if (!preventUndo) svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.call('sourcechanged', [svgCanvas.getSvgContent()])
  } catch (e) {
    error('Error setting SVG string', e, 'svg-exec')
    return false
  }

  return true
}

/**
 * This function imports the input SVG XML as a `<symbol>` in the `<defs>`, then adds a
 * `<use>` to the current layer.
 * @function module:svgcanvas.SvgCanvas#importSvgString
 * @param xmlString - The SVG as XML text.
 * @param [preserveDimension] - A boolean to force to preserve initial dimension of the imported svg
 * @fires module:svgcanvas.SvgCanvas#event:changed
 * @returns This function returns null if the import was unsuccessful, or the element otherwise.
 */
const importSvgString = (xmlString: string, preserveDimension?: boolean): Element | null => {
  const dataStorage = svgCanvas.getDataStorage()
  let j: number
  let ts: string
  let useEl: Element | undefined
  try {
    // Get unique ID
    const uid = String(hashCode(xmlString))

    let useExisting = false
    // Look for symbol and make sure symbol exists in image
    if (svgCanvas.getImportIds(uid) && svgCanvas.getImportIds(uid).symbol) {
      const parents = getParents(svgCanvas.getImportIds(uid).symbol, '#svgroot')
      if (parents?.length) {
        useExisting = true
      } else {
        svgCanvas.setImportIds(uid, null)
      }
    }

    const batchCmd = new BatchCommand('Import Image')
    let symbol: Element
    if (useExisting) {
      symbol = svgCanvas.getImportIds(uid).symbol
      ts = svgCanvas.getImportIds(uid).xform
    } else {
      // convert string into XML document
      const newDoc = text2xml(xmlString)

      svgCanvas.prepareSvg(newDoc)

      // import new svg document into our document
      const svg: Element = svgCanvas.getDOMDocument().adoptNode
        ? svgCanvas.getDOMDocument().adoptNode(newDoc.documentElement)
        : svgCanvas.getDOMDocument().importNode(newDoc.documentElement, true)

      svgCanvas.uniquifyElems(svg)

      const innerw = convertToNum('width', svg.getAttribute('width') ?? '')
      const innerh = convertToNum('height', svg.getAttribute('height') ?? '')
      const innervb = svg.getAttribute('viewBox')
      // if no explicit viewbox, create one out of the width and height
      const vb: number[] = innervb ? innervb.split(/[ ,]+/).map(Number) : [0, 0, innerw, innerh]
      for (j = 0; j < 4; ++j) {
        vb[j] = Number(vb[j] ?? 0)
      }

      const rawCanvash = Number(svgCanvas.getSvgContent().getAttribute('height'))
      const canvash =
        Number.isFinite(rawCanvash) && rawCanvash > 0
          ? rawCanvash
          : (Number(svgCanvas.getCurConfig().dimensions?.[1]) || 100)

      const vbMinX = vb[0] ?? 0
      const vbMinY = vb[1] ?? 0
      const vbWidth = vb[2] ?? 0
      const vbHeight = vb[3] ?? 0
      const importW = Number.isFinite(vbWidth) && vbWidth > 0 ? vbWidth : (innerw > 0 ? innerw : 100)
      const importH = Number.isFinite(vbHeight) && vbHeight > 0 ? vbHeight : (innerh > 0 ? innerh : 100)
      const safeImportW = Number.isFinite(importW) && importW > 0 ? importW : 100
      const safeImportH = Number.isFinite(importH) && importH > 0 ? importH : 100
      const scale = safeImportH > safeImportW
        ? canvash / 3 / safeImportH
        : canvash / 3 / safeImportW

      // Account for non-zero viewBox origin + scale
      const originOffset = (vbMinX !== 0 || vbMinY !== 0)
        ? `translate(${-vbMinX},${-vbMinY}) `
        : ''
      ts = `translate(0) scale(${scale}) ${originOffset}translate(0)`

      symbol = svgCanvas.getDOMDocument().createElementNS(NS.SVG, 'symbol')
      while (svg.firstChild) {
        const first = svg.firstChild
        symbol.append(first)
      }
      const attrs = svg.attributes
      for (const attr of Array.from(attrs)) {
        symbol.setAttribute(attr.nodeName, attr.value)
      }
      symbol.id = svgCanvas.getNextId()

      // Store data
      svgCanvas.setImportIds(uid, {
        symbol,
        xform: ts
      })

      findDefs().append(symbol)
      batchCmd.addSubCommand(new InsertElementCommand(symbol))
    }

    useEl = svgCanvas.getDOMDocument().createElementNS(NS.SVG, 'use')
    useEl.id = svgCanvas.getNextId()
    svgCanvas.setHref(useEl, '#' + symbol.id)
    ;(
      svgCanvas.getCurrentGroup() ||
      svgCanvas.getCurrentDrawing().getCurrentLayer()
    )!.append(useEl)
    batchCmd.addSubCommand(new InsertElementCommand(useEl))
    svgCanvas.clearSelection()

    if (!preserveDimension) {
      useEl.setAttribute('transform', ts)
      recalculateDimensions(useEl)
    }
    dataStorage.put(useEl, 'symbol', symbol)
    dataStorage.put(useEl, 'ref', symbol)
    svgCanvas.addToSelection([useEl])

    svgCanvas.addCommandToHistory(batchCmd)
    svgCanvas.call('changed', [svgCanvas.getSvgContent()])
  } catch (e) {
    // Audit-flagged: console.error vs error() logger (svg-exec.ts:985) — preserve as-is
    error('Error importing SVG string', e, 'svg-exec')
    return null
  }

  // we want to return the element so we can automatically select it
  return useEl ?? null
}

/**
 * Converts a given image file to a data URL when possible, then runs a given callback.
 * @function module:svgcanvas.SvgCanvas#embedImage
 * @param src - The path/URL of the image
 * @returns Resolves to a Data URL (string|false)
 */
const embedImage = (src: string): Promise<string | false> => {
  return new Promise((resolve, reject) => {
    const imgI = new Image()
    imgI.addEventListener('load', (e: Event) => {
      const target = e.currentTarget as HTMLImageElement
      const cvs = document.createElement('canvas')
      cvs.width = target.width
      cvs.height = target.height
      cvs.getContext('2d')?.drawImage(target, 0, 0)
      try {
        let urldata = ';svgedit_url=' + encodeURIComponent(src)
        urldata = cvs.toDataURL().replace(';base64', urldata + ';base64')
        svgCanvas.setEncodableImages(src, urldata)
      } catch {
        svgCanvas.setEncodableImages(src, false)
      }
      svgCanvas.setGoodImage(src)
      resolve(svgCanvas.getEncodableImages(src) as string | false)
    })
    imgI.addEventListener('error', (e: Event) => {
      const target = e.currentTarget as HTMLImageElement
      reject(
        new Error(
          `error loading image: ${target.attributes.getNamedItem('src')?.value ?? src}`
        )
      )
    })
    imgI.setAttribute('src', src)
  })
}

const getIssues = (): { issues: string[]; issueCodes: string[] } => {
  const uiStrings = svgCanvas.getUIStrings()
  // remove the selected outline before serializing
  svgCanvas.clearSelection()

  const issues: string[] = []
  const issueCodes: string[] = []

  const issueList: Record<string, string> = {
    feGaussianBlur: uiStrings.NoBlur ?? '',
    foreignObject: uiStrings.NoforeignObject ?? '',
    '[stroke-dasharray]': uiStrings.NoDashArray ?? ''
  }
  const content = svgCanvas.getSvgContent() as Element

  // Add font/text check if Canvas Text API is not implemented
  const canvasEl = document.querySelector('canvas')
  if (canvasEl && !('font' in canvasEl.getContext('2d')!)) {
    issueList.text = uiStrings.NoText ?? ''
  }

  for (const [sel, descr] of Object.entries(issueList)) {
    if (content.querySelectorAll(sel).length) {
      issueCodes.push(sel)
      issues.push(descr)
    }
  }
  return { issues, issueCodes }
}

/**
 * Utility function to convert all external image links in an SVG element to Base64 data URLs.
 * @param svgElement - The SVG element to process.
 */
const convertImagesToBase64 = async (svgElement: Element): Promise<void> => {
  const imageElements = svgElement.querySelectorAll('image')
  const promises = Array.from(imageElements).map(async (img: Element) => {
    const href = img.getAttribute('xlink:href') ?? img.getAttribute('href')
    if (href && !href.startsWith('data:')) {
      try {
        const response = await fetch(href)
        const blob = await response.blob()
        const reader = new FileReader()
        return new Promise<void>(resolve => {
          reader.onload = () => {
            setHref(img, reader.result as string)
            resolve()
          }
          reader.readAsDataURL(blob)
        })
      } catch (err) {
        error('Failed to fetch image', err, 'svg-exec')
      }
    }
  })
  await Promise.all(promises)
}

/**
 * Generates a raster image (PNG, JPEG, etc.) from the SVG content.
 * @param [imgType='PNG'] - The image type to generate.
 * @param [quality=1.0] - The image quality (for JPEG).
 * @param [windowName='Exported Image'] - The window name.
 * @param [opts={}] - Additional options.
 * @returns Resolves to an object containing export data.
 */
const rasterExport = (
  imgType = 'PNG',
  quality = 1.0,
  windowName = 'Exported Image',
  opts: Record<string, unknown> = {}
): Promise<Record<string, unknown>> => {
  return new Promise((resolve, reject) => {
    const type = imgType === 'ICO' ? 'BMP' : imgType
    const mimeType = `image/${type.toLowerCase()}`
    const { issues, issueCodes } = getIssues()
    const svgElement = svgCanvas.getSvgContent() as Element

    const svgClone = svgElement.cloneNode(true) as Element

    convertImagesToBase64(svgClone)
      .then(() => {
        const svgData = new XMLSerializer().serializeToString(svgClone)
        const svgBlob = new Blob([svgData], {
          type: 'image/svg+xml;charset=utf-8'
        })
        const url = URL.createObjectURL(svgBlob)

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'))
          return
        }

        const res = svgCanvas.getResolution() as { w: number; h: number }
        const width = res.w
        const height = res.h
        canvas.width = width
        canvas.height = height

        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height)
          URL.revokeObjectURL(url)

          const datauri = canvas.toDataURL(mimeType, quality)
          let blobUrl: string

          const onExportComplete = (bUrl: string): void => {
            const exportObj: Record<string, unknown> = {
              datauri,
              bloburl: bUrl,
              svg: svgData,
              issues,
              issueCodes,
              type: imgType,
              mimeType,
              quality,
              windowName
            }
            if (!opts.avoidEvent) {
              svgCanvas.call('exported', exportObj)
            }
            resolve(exportObj)
          }

          canvas.toBlob(
            (blob: Blob | null) => {
              blobUrl = URL.createObjectURL(blob!)
              onExportComplete(blobUrl)
            },
            mimeType,
            quality
          )
        }

        img.onerror = (err: Event | string) => {
          // Audit-flagged: console.error vs error() logger consistency (svg-exec.ts:985) — preserve
          console.error('Failed to load SVG into image element:', err)
          reject(new Error(typeof err === 'string' ? err : 'Image load error'))
        }

        img.src = url
      })
      .catch(reject)
  })
}

/**
 * Exports the SVG content as a PDF.
 * @param [windowName='svg.pdf'] - The window name or file name.
 * @param [outputType] - The output type for jsPDF.
 * @returns Resolves to an object containing PDF export data.
 */
const exportPDF = (
  windowName = 'svg.pdf',
  outputType: string = isChrome() ? 'save' : 'dataurlstring'
): Promise<Record<string, unknown>> => {
  return new Promise((resolve, reject) => {
    const res = svgCanvas.getResolution() as { w: number; h: number }
    const orientation = res.w > res.h ? 'landscape' : 'portrait'
    const unit = 'pt'
    const svgElement = svgCanvas.getSvgContent().cloneNode(true) as Element

    convertImagesToBase64(svgElement)
      .then(() => {
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const svgBlob = new Blob([svgData], {
          type: 'image/svg+xml;charset=utf-8'
        })
        const url = URL.createObjectURL(svgBlob)

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = res.w
        canvas.height = res.h

        const img = new Image()
        img.onload = () => {
          ctx?.drawImage(img, 0, 0, res.w, res.h)
          URL.revokeObjectURL(url)

          const imgData = canvas.toDataURL('image/png')
          const doc = new JsPDF({ orientation, unit, format: [res.w, res.h] })

          const docTitle = svgCanvas.getDocumentTitle() as string
          doc.setProperties({ title: docTitle })
          doc.addImage(imgData, 'PNG', 0, 0, res.w, res.h)

          const { issues, issueCodes } = getIssues()
          const obj: Record<string, unknown> = { issues, issueCodes, windowName, outputType }

          obj.output = (doc.output as (type: string, name?: string) => unknown)(
            outputType,
            outputType === 'save' ? windowName : undefined
          )

          svgCanvas.call('exportedPDF', obj)
          resolve(obj)
        }

        img.onerror = (err: Event | string) => {
          error('Failed to load SVG into image element', err, 'svg-exec')
          reject(new Error(typeof err === 'string' ? err : 'PDF image load error'))
        }

        img.src = url
      })
      .catch(reject)
  })
}

/**
 * Ensure each element has a unique ID.
 * @function module:svgcanvas.SvgCanvas#uniquifyElems
 * @param g - The parent element of the tree to give unique IDs
 */
const uniquifyElemsMethod = (g: Element): void => {
  const ids: Record<string, { elem: Element | null; attrs: Attr[]; hrefs: Element[] }> = {}
  const refElems = [
    'a',
    'filter',
    'image',
    'linearGradient',
    'pattern',
    'radialGradient',
    'symbol',
    'textPath',
    'use'
  ]

  walkTree(g, (n: Node) => {
    if (n.nodeType === 1) {
      const el = n as Element
      if (el.id) {
        if (!(el.id in ids)) {
          ids[el.id] = { elem: null, attrs: [], hrefs: [] }
        }
         
        ids[el.id]!.elem = el
      }

      svgCanvas.getRefAttrs().forEach((attr: string) => {
        const attrnode = el.getAttributeNode(attr)
        if (attrnode) {
          const url = svgCanvas.getUrlFromAttr(attrnode.value)
          const refid = url ? url.substr(1) : null
          if (refid) {
            if (!(refid in ids)) {
              ids[refid] = { elem: null, attrs: [], hrefs: [] }
            }
             
            ids[refid]!.attrs.push(attrnode)
          }
        }
      })

      // Audit-flagged: image/a internal refs not handled (svg-exec.ts:1117) — preserve
      const href = svgCanvas.getHref(el)
      if (href && refElems.includes(el.nodeName)) {
        const refid = href.substr(1)
        if (refid) {
          if (!(refid in ids)) {
            ids[refid] = { elem: null, attrs: [], hrefs: [] }
          }
           
          ids[refid]!.hrefs.push(el)
        }
      }
    }
  })

  // in ids, we now have a map of ids, elements and attributes, let's re-identify
  for (const oldid in ids) {
    if (!oldid) {
      continue
    }
    const idEntry = ids[oldid]
    if (!idEntry) continue
    const { elem } = idEntry
    if (elem) {
      const newid = svgCanvas.getNextId()

      elem.id = newid

      const { attrs } = idEntry
      let j = attrs.length
      while (j--) {
        const attr = attrs[j]
        attr?.ownerElement?.setAttribute(attr.name, `url(#${newid})`)
      }

      // Audit-flagged: symbol-not-removed bug in uniquifyElems (svg-exec.ts:1112) — preserve
      const hreffers = idEntry.hrefs
      let k = hreffers.length
      while (k--) {
        const hreffer = hreffers[k]
        if (hreffer) svgCanvas.setHref(hreffer, '#' + newid)
      }
    }
  }
}

/**
 * Assigns reference data for each use element.
 * @function module:svgcanvas.SvgCanvas#setUseData
 * @param parent
 */
const setUseDataMethod = (parent: Element): void => {
  let elems: Element | NodeListOf<Element> = parent

  if (parent.tagName !== 'use') {
    elems = parent.querySelectorAll('use')
  }

  // Audit-flagged: setUseData on undo/redo of object addition (svg-exec.ts:516 real bug) — preserve
  Array.prototype.forEach.call(elems, (el: Element) => {
    const dataStorage = svgCanvas.getDataStorage()
    const href = svgCanvas.getHref(el)
    if (!href || !href.startsWith('#')) {
      return
    }
    const id = href.substr(1)
    const refElem = svgCanvas.getElement(id)
    if (!refElem) {
      return
    }
    dataStorage.put(el, 'ref', refElem)
    if (refElem.tagName === 'symbol' || refElem.tagName === 'svg') {
      dataStorage.put(el, 'symbol', refElem)
      dataStorage.put(el, 'ref', refElem)
    }
  })
}

/**
 * Looks at DOM elements inside the `<defs>` to see if they are referred to,
 * removes them from the DOM if they are not.
 * @function module:svgcanvas.SvgCanvas#removeUnusedDefElems
 * @returns The number of elements that were removed
 */
const removeUnusedDefElemsMethod = (): number => {
  const defs = svgCanvas.getSvgContent().getElementsByTagNameNS(NS.SVG, 'defs') as HTMLCollectionOf<Element>
  if (!defs || !defs.length) {
    return 0
  }

  const defelemUses: string[] = []
  let numRemoved = 0
  const attrs = [
    'fill',
    'stroke',
    'filter',
    'marker-start',
    'marker-mid',
    'marker-end'
  ]
  const alen = attrs.length

  const allEls = svgCanvas.getSvgContent().getElementsByTagNameNS(NS.SVG, '*') as HTMLCollectionOf<Element>
  const allLen = allEls.length

  let i: number
  let j: number
  for (i = 0; i < allLen; i++) {
    const el = allEls[i]
    if (!el) continue
    for (j = 0; j < alen; j++) {
      const ref = svgCanvas.getUrlFromAttr(el.getAttribute(attrs[j] ?? ''))
      if (ref) {
        defelemUses.push(ref.substr(1))
      }
    }

    // gradients can refer to other gradients
    const href = getHref(el)
    if (href && href.startsWith('#')) {
      defelemUses.push(href.substr(1))
    }
  }

  Array.prototype.forEach.call(defs, (def: Element, _i: number) => {
    const defelems = def.querySelectorAll(
      'linearGradient, radialGradient, filter, marker, svg, symbol'
    )
    let idx = defelems.length
    while (idx--) {
      const defelem = defelems[idx]
      if (!defelem) continue
      const { id } = defelem
      if (!defelemUses.includes(id)) {
        // Not found, so remove (but remember)
        svgCanvas.setRemovedElements(id, defelem)
        defelem.remove()
        numRemoved++
      }
    }
  })

  return numRemoved
}

/**
 * Converts gradients from userSpaceOnUse to objectBoundingBox.
 * @function module:svgcanvas.SvgCanvas#convertGradients
 * @param elem
 */
const convertGradientsMethod = (elem: Element): void => {
  const elems = elem.querySelectorAll('linearGradient, radialGradient')
  Array.prototype.forEach.call(elems, (grad: Element) => {
    if (grad.getAttribute('gradientUnits') === 'userSpaceOnUse') {
      const svgContent = svgCanvas.getSvgContent() as Element
      // Audit-flagged: multi-element gradient duplication bug (svg-exec.ts:1278) — preserve
      let fillStrokeElems = svgContent.querySelectorAll(
        '[fill="url(#' + grad.id + ')"],[stroke="url(#' + grad.id + ')"]'
      )
      if (!fillStrokeElems.length) {
        const tmpFillStrokeElems = svgContent.querySelectorAll(
          '[*|href="#' + grad.id + '"]'
        )
        if (!tmpFillStrokeElems.length) {
          return
        } else {
          const first = tmpFillStrokeElems[0]
          if (
            first &&
            (first.tagName === 'linearGradient' ||
              first.tagName === 'radialGradient') &&
            first.getAttribute('gradientUnits') ===
              'userSpaceOnUse'
          ) {
            fillStrokeElems = svgContent.querySelectorAll(
              '[fill="url(#' +
                first.id +
                ')"],[stroke="url(#' +
                first.id +
                ')"]'
            )
          } else {
            return
          }
        }
      }
      const convertGradForBBox = (g: Element, bb: { x: number; y: number; width: number; height: number }): void => {
        if (g.tagName === 'linearGradient') {
          const gCoords = {
            x1: Number(g.getAttribute('x1') ?? 0),
            y1: Number(g.getAttribute('y1') ?? 0),
            x2: Number(g.getAttribute('x2') ?? 1),
            y2: Number(g.getAttribute('y2') ?? 0)
          }
          const tlist = getTransformList(g)
          if (tlist && tlist.numberOfItems > 0) {
            const m = transformListToTransform(tlist).matrix
            const pt1 = transformPoint(gCoords.x1, gCoords.y1, m)
            const pt2 = transformPoint(gCoords.x2, gCoords.y2, m)
            gCoords.x1 = pt1.x
            gCoords.y1 = pt1.y
            gCoords.x2 = pt2.x
            gCoords.y2 = pt2.y
            g.removeAttribute('gradientTransform')
          }
          g.setAttribute('x1', String((gCoords.x1 - bb.x) / bb.width))
          g.setAttribute('y1', String((gCoords.y1 - bb.y) / bb.height))
          g.setAttribute('x2', String((gCoords.x2 - bb.x) / bb.width))
          g.setAttribute('y2', String((gCoords.y2 - bb.y) / bb.height))
          g.removeAttribute('gradientUnits')
        } else if (g.tagName === 'radialGradient') {
          const getNum = (value: string | null, fallback: number): number => {
            const num = Number(value)
            return Number.isFinite(num) ? num : fallback
          }
          let cx = getNum(g.getAttribute('cx'), 0.5)
          let cy = getNum(g.getAttribute('cy'), 0.5)
          let r = getNum(g.getAttribute('r'), 0.5)
          let fx = getNum(g.getAttribute('fx'), cx)
          let fy = getNum(g.getAttribute('fy'), cy)
          const tlist = getTransformList(g)
          if (tlist && tlist.numberOfItems > 0) {
            const m = transformListToTransform(tlist).matrix
            const cpt = transformPoint(cx, cy, m)
            const fpt = transformPoint(fx, fy, m)
            const rpt = transformPoint(cx + r, cy, m)
            cx = cpt.x
            cy = cpt.y
            fx = fpt.x
            fy = fpt.y
            r = Math.hypot(rpt.x - cpt.x, rpt.y - cpt.y)
            g.removeAttribute('gradientTransform')
          }
          if (!bb.width || !bb.height) return
          g.setAttribute('cx', String((cx - bb.x) / bb.width))
          g.setAttribute('cy', String((cy - bb.y) / bb.height))
          g.setAttribute('fx', String((fx - bb.x) / bb.width))
          g.setAttribute('fy', String((fy - bb.y) / bb.height))
          g.setAttribute('r', String(r / Math.max(bb.width, bb.height)))
          g.removeAttribute('gradientUnits')
        }
      }

      const firstBb = fillStrokeElems[0] ? utilsGetBBox(fillStrokeElems[0]) : null
      if (!firstBb) return

      // Clone gradient per-element when multiple elements share it
      for (let idx = 1; idx < fillStrokeElems.length; idx++) {
        const el = fillStrokeElems[idx]
        if (!el) continue
        const elBb = utilsGetBBox(el)
        if (!elBb) continue
        const clone = grad.cloneNode(true) as Element
        clone.id = svgCanvas.getNextId()
        grad.parentNode?.insertBefore(clone, grad.nextSibling)
        convertGradForBBox(clone, elBb)
        const attr = el.getAttribute('fill')?.includes(grad.id) ? 'fill' : 'stroke'
        el.setAttribute(attr, `url(#${clone.id})`)
      }

      convertGradForBBox(grad, firstBb)
    }
  })
}
