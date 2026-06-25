/**
 * Recalculate dimensions and transformations of SVG elements.
 * @module recalculate
 * @license MIT
 */


import { convertToNum } from './units.js'
import {
  getRotationAngle,
  getBBox,
  getRefElem,
  findDefs
} from './utilities.js'
import { BatchCommand, ChangeElementCommand } from './history.js'
import { remapElement } from './coords.js'
import {
  isIdentity,
  matrixMultiply,
  transformPoint,
  transformListToTransform,
  hasMatrixTransform,
  getTransformList
} from './math.js'
import { mergeDeep } from '../common/util.js'

import type { ISvgCanvas } from './svgcanvas-types.js'

let svgCanvas = null as unknown as ISvgCanvas

/**
 * Initialize the recalculate module with the SVG canvas.
 * @function module:recalculate.init
 */
export const init = (canvas: ISvgCanvas): void => {
  svgCanvas = canvas
}

/**
 * Translate every "x,y" coordinate pair in a polyline/polygon `points`
 * attribute by (tx, ty) and write the result back; a no-op for an empty value.
 * Shared by the two clipPath point-shifting branches in {@link updateClipPath}.
 * Point coordinates are unitless user-space numbers, so plain `Number()` (not
 * `convertToNum`, which resolves units against a named attribute) is correct.
 */
const translatePolyPoints = (poly: Element, tx: number, ty: number): void => {
  const points = (poly.getAttribute('points') ?? '').trim()
  if (!points) return
  const updated = points.split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',')
    return `${Number(x) + tx},${Number(y) + ty}`
  })
  poly.setAttribute('points', updated.join(' '))
}

/**
 * Updates a `<clipPath>` element's values based on the given translation.
 * @function module:recalculate.updateClipPath
 * @param attr - The clip-path attribute value containing the clipPath's ID
 * @param [elem] - The element referencing the clipPath
 */
export const updateClipPath = (attr: string, tx: number, ty: number, elem?: Element): string | undefined => {
  const clipPath = getRefElem(attr)
  if (!clipPath) return undefined
  if (elem && clipPath.id) {
    const svgContent = svgCanvas.getSvgContent?.() as Element | null
    if (svgContent) {
      const refSelector = `[clip-path="url(#${clipPath.id})"]`
      const users = svgContent.querySelectorAll(refSelector)
      if (users.length > 1) {
        const newClipPath = clipPath.cloneNode(true) as Element
        newClipPath.id = svgCanvas.getNextId()
        findDefs().append(newClipPath)
        elem.setAttribute('clip-path', `url(#${newClipPath.id})`)
        return updateClipPath(`url(#${newClipPath.id})`, tx, ty)
      }
    }
  }
  const path = clipPath.firstElementChild
  if (!path) return attr
  const cpXform = getTransformList(path)
  if (!cpXform) {
    const tag = (path.tagName || '').toLowerCase()
    if (tag === 'rect') {
      const x = convertToNum('x', path.getAttribute('x') ?? '0') + tx
      const y = convertToNum('y', path.getAttribute('y') ?? '0') + ty
      path.setAttribute('x', String(x))
      path.setAttribute('y', String(y))
    } else if (tag === 'circle' || tag === 'ellipse') {
      const cx = convertToNum('cx', path.getAttribute('cx') ?? '0') + tx
      const cy = convertToNum('cy', path.getAttribute('cy') ?? '0') + ty
      path.setAttribute('cx', String(cx))
      path.setAttribute('cy', String(cy))
    } else if (tag === 'line') {
      path.setAttribute('x1', String(convertToNum('x1', path.getAttribute('x1') ?? '0') + tx))
      path.setAttribute('y1', String(convertToNum('y1', path.getAttribute('y1') ?? '0') + ty))
      path.setAttribute('x2', String(convertToNum('x2', path.getAttribute('x2') ?? '0') + tx))
      path.setAttribute('y2', String(convertToNum('y2', path.getAttribute('y2') ?? '0') + ty))
    } else if (tag === 'polyline' || tag === 'polygon') {
      translatePolyPoints(path, tx, ty)
    } else {
      path.setAttribute('transform', `translate(${tx},${ty})`)
    }
    return attr
  }
  if (cpXform.numberOfItems) {
    const translate = svgCanvas.getSvgRoot().createSVGMatrix()
    translate.e = tx
    translate.f = ty
    const combined = matrixMultiply(transformListToTransform(cpXform).matrix, translate)
    const merged = svgCanvas.getSvgRoot().createSVGTransform()
    merged.setMatrix(combined)
    cpXform.clear()
    cpXform.appendItem(merged)
    return attr
  }
  const tag = (path.tagName || '').toLowerCase()
  if ((tag === 'polyline' || tag === 'polygon') && !(path as SVGPolygonElement | SVGPolylineElement).points?.numberOfItems) {
    translatePolyPoints(path, tx, ty)
    return attr
  }
  const newTranslate = svgCanvas.getSvgRoot().createSVGTransform()
  newTranslate.setTranslate(tx, ty)

  cpXform.appendItem(newTranslate)
  recalculateDimensions(path)
  return attr
}

/**
 * Recalculates the dimensions and transformations of a selected element.
 * @function module:recalculate.recalculateDimensions
 * @returns Undo command object with the resulting change, or null if no change
 */
export const recalculateDimensions = (selected: Element): InstanceType<typeof BatchCommand> | null => {
  if (!selected) return null

  // Don't recalculate dimensions for groups - this would push their transforms down to children
  // Groups should maintain their transform attribute on the group element itself
  if (selected.tagName === 'g' || selected.tagName === 'a') {
    return null
  }

  if (
    (selected.getAttribute?.('clip-path')) &&
    selected.querySelector?.('[clip-path]')
  ) {
    // Keep transforms when clip-paths are present to avoid mutating defs.
    return null
  }
  const svgroot = svgCanvas.getSvgRoot()
  const dataStorage = svgCanvas.getDataStorage()
  const tlistMaybe = getTransformList(selected)

  // Remove any unnecessary transforms (identity matrices, zero-degree rotations)
  if (tlistMaybe && tlistMaybe.numberOfItems > 0) {
    const tlistCleaning = tlistMaybe
    let k = tlistCleaning.numberOfItems
    const noi = k
    while (k--) {
      const xform = tlistCleaning.getItem(k)
      if (xform.type === SVGTransform.SVG_TRANSFORM_MATRIX) {
        if (isIdentity(xform.matrix)) {
          if (noi === 1) {
            // Remove the 'transform' attribute if only identity matrix remains
            selected.removeAttribute('transform')
            return null
          }
          tlistCleaning.removeItem(k)
        }
      } else if (
        xform.type === SVGTransform.SVG_TRANSFORM_ROTATE &&
        xform.angle === 0
      ) {
        tlistCleaning.removeItem(k) // Remove zero-degree rotations
      } else if (
        xform.type === SVGTransform.SVG_TRANSFORM_TRANSLATE &&
        xform.matrix.e === 0 &&
        xform.matrix.f === 0
      ) {
        tlistCleaning.removeItem(k) // Remove zero translations
      }
    }

    // End here if all it has is a rotation
    if (tlistCleaning.numberOfItems === 1 && getRotationAngle(selected)) {
      return null
    }
  }
  const tlist = tlistMaybe

  // If this element had no transforms, we are done
  if (!tlist || tlist.numberOfItems === 0) {
    selected.removeAttribute('transform')
    return null
  }

  // Avoid remapping transforms on <use> to preserve referenced positioning/rotation
  if (selected.tagName === 'use') {
    return null
  }

  // Set up undo command
  const batchCmd = new BatchCommand('Transform')

  // Handle special cases for specific elements
  switch (selected.tagName) {
    // Ignore these elements, as they can absorb the [M] transformation
    case 'line':
    case 'polyline':
    case 'polygon':
    case 'path':
      break
    default:
      // For elements like 'use', ensure transforms are handled correctly
      if (
        (tlist.numberOfItems === 1 &&
          tlist.getItem(0).type === SVGTransform.SVG_TRANSFORM_MATRIX) ||
        (tlist.numberOfItems === 2 &&
          tlist.getItem(0).type === SVGTransform.SVG_TRANSFORM_MATRIX &&
          tlist.getItem(1).type === SVGTransform.SVG_TRANSFORM_ROTATE)
      ) {
        return null
      }
  }

  // Grouped SVG element (special handling for 'gsvg')
  const gsvg: Element | undefined = dataStorage.has(selected, 'gsvg')
    ? dataStorage.get(selected, 'gsvg') as Element
    : undefined

  // Store initial values affected by reducing the transform list
  let changes: Record<string, unknown> = {}
  let initial: Record<string, unknown> | null = null
  let attrs: string[] = []

  // Determine which attributes to adjust based on element type
  switch (selected.tagName) {
    case 'line':
      attrs = ['x1', 'y1', 'x2', 'y2']
      break
    case 'circle':
      attrs = ['cx', 'cy', 'r']
      break
    case 'ellipse':
      attrs = ['cx', 'cy', 'rx', 'ry']
      break
    case 'foreignObject':
    case 'rect':
    case 'image':
      attrs = ['width', 'height', 'x', 'y']
      break
    case 'text':
    case 'tspan':
      attrs = ['x', 'y']
      break
    case 'polygon':
    case 'polyline': {
      initial = {}
      initial.points = selected.getAttribute('points')
      const list = (selected as SVGPolygonElement | SVGPolylineElement).points
      const len = list.numberOfItems
      changes.points = new Array(len) as Array<{ x: number; y: number }>
      for (let i = 0; i < len; ++i) {
        const pt = list.getItem(i)
        ;(changes.points as Array<{ x: number; y: number }>)[i] = { x: pt.x, y: pt.y }
      }
      break
    }
    case 'path':
      initial = {}
      initial.d = selected.getAttribute('d')
      changes.d = selected.getAttribute('d')
      break
  }

  // Collect initial attribute values
  if (attrs.length) {
    attrs.forEach(attr => {
      changes[attr] = convertToNum(attr, selected.getAttribute(attr) ?? '')
    })
  } else if (gsvg) {
    // Special case for GSVG elements
    changes = {
      x: Number(gsvg.getAttribute('x')) || 0,
      y: Number(gsvg.getAttribute('y')) || 0
    }
  }

  // If initial values were not set for polygon/polyline/path, create a copy
  if (!initial) {
    initial = mergeDeep({}, changes)
    for (const [attr, val] of Object.entries(initial)) {
      initial[attr] = convertToNum(attr, typeof val === 'string' ? val : (typeof val === 'number' ? String(val) : ''))
    }
  }
  // Save the start transform value
  initial.transform = svgCanvas.getStartTransform() || ''

  let oldcenter: { x: number; y: number } | undefined
  let newcenter: { x: number; y: number } | undefined

  // Non-group elements

  // Get the bounding box of the element
  const box = getBBox(selected)

  // Handle elements without a bounding box (e.g., <defs>, <metadata>)
  if (!box && selected.tagName !== 'path') return null

  let m: SVGMatrix | undefined

  // Adjust for elements with x and y attributes
  let x = 0
  let y = 0
  if (['use', 'image', 'text', 'tspan'].includes(selected.tagName)) {
    x = convertToNum('x', selected.getAttribute('x') ?? '0')
    y = convertToNum('y', selected.getAttribute('y') ?? '0')
  }

  // Handle rotation transformations
  const angle = getRotationAngle(selected)
  if (angle) {
    if (selected.localName === 'image') {
      const xAttr = convertToNum('x', selected.getAttribute('x') ?? '0')
      const yAttr = convertToNum('y', selected.getAttribute('y') ?? '0')
      const width = convertToNum('width', selected.getAttribute('width') ?? '0')
      const height = convertToNum('height', selected.getAttribute('height') ?? '0')
      const cx = xAttr + width / 2
      const cy = yAttr + height / 2
      oldcenter = { x: cx, y: cy }
      const transform = transformListToTransform(tlist).matrix
      newcenter = transformPoint(cx, cy, transform)
    } else if (selected.localName === 'text') {
      if (box) {
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        oldcenter = { x: cx, y: cy }
        newcenter = transformPoint(cx, cy, transformListToTransform(tlist).matrix)
      }
    } else {
      if (box) {
        oldcenter = {
          x: box.x + box.width / 2 + x,
          y: box.y + box.height / 2 + y
        }
        newcenter = transformPoint(
          box.x + box.width / 2 + x,
          box.y + box.height / 2 + y,
          transformListToTransform(tlist).matrix
        )
      }
    }

    // Remove the rotation transform from the list
    for (let i = 0; i < tlist.numberOfItems; ++i) {
      const xform = tlist.getItem(i)
      if (xform.type === SVGTransform.SVG_TRANSFORM_ROTATE) {
        tlist.removeItem(i)
        break
      }
    }
  }

  const N = tlist.numberOfItems

  // Handle specific transformation cases
  if (
    N >= 3 &&
    tlist.getItem(N - 3).type === SVGTransform.SVG_TRANSFORM_TRANSLATE &&
    tlist.getItem(N - 2).type === SVGTransform.SVG_TRANSFORM_SCALE &&
    tlist.getItem(N - 1).type === SVGTransform.SVG_TRANSFORM_TRANSLATE
  ) {
    // Scaling operation
    m = transformListToTransform(tlist, N - 3, N - 1).matrix
    tlist.removeItem(N - 1)
    tlist.removeItem(N - 2)
    tlist.removeItem(N - 3)

    remapElement(selected, changes, m)

    if (angle) {
      const matrix = transformListToTransform(tlist).matrix
      const oldRotation = svgroot.createSVGTransform()
      oldRotation.setRotate(angle, oldcenter?.x ?? 0, oldcenter?.y ?? 0)
      const oldRotMatrix = oldRotation.matrix
      const newRotation = svgroot.createSVGTransform()
      newRotation.setRotate(angle, newcenter?.x ?? 0, newcenter?.y ?? 0)
      const newRotInvMatrix = newRotation.matrix.inverse()
      const matrixInv = matrix.inverse()
      const extraTransform = matrixMultiply(
        matrixInv,
        newRotInvMatrix,
        oldRotMatrix,
        matrix
      )

      remapElement(selected, changes, extraTransform)

      if (tlist.numberOfItems) {
        tlist.insertItemBefore(newRotation, 0)
      } else {
        tlist.appendItem(newRotation)
      }
    }
  } else if (
    (N === 1 ||
      (N > 1 &&
        tlist.getItem(1).type !== SVGTransform.SVG_TRANSFORM_SCALE)) &&
    tlist.getItem(0).type === SVGTransform.SVG_TRANSFORM_TRANSLATE
  ) {
    // Translation operation
    const oldTranslate = tlist.getItem(0).matrix
    const remainingTransforms = transformListToTransform(tlist, 1).matrix
    const remainingTransformsInv = remainingTransforms.inverse()
    m = matrixMultiply(
      remainingTransformsInv,
      oldTranslate,
      remainingTransforms
    )
    tlist.removeItem(0)

    remapElement(selected, changes, m)

    if (angle) {
      if (!hasMatrixTransform(tlist)) {
        newcenter = {
          x: (oldcenter?.x ?? 0) + m.e,
          y: (oldcenter?.y ?? 0) + m.f
        }
      }
      const newRot = svgroot.createSVGTransform()
      newRot.setRotate(angle, newcenter?.x ?? 0, newcenter?.y ?? 0)
      if (tlist.numberOfItems) {
        tlist.insertItemBefore(newRot, 0)
      } else {
        tlist.appendItem(newRot)
      }
    }
  } else if (
    N === 1 &&
    tlist.getItem(0).type === SVGTransform.SVG_TRANSFORM_MATRIX &&
    !angle
  ) {
    // Matrix operation
    m = transformListToTransform(tlist).matrix
    tlist.clear()

    remapElement(selected, changes, m)
  } else {
    // Rotation or other transformations
    if (angle) {
      const newRot = svgroot.createSVGTransform()
      newRot.setRotate(angle, newcenter?.x ?? 0, newcenter?.y ?? 0)

      if (tlist.numberOfItems) {
        tlist.insertItemBefore(newRot, 0)
      } else {
        tlist.appendItem(newRot)
      }
    }
    if (tlist.numberOfItems === 0) {
      selected.removeAttribute('transform')
    }
    return null
  }

  // Remove the 'transform' attribute if no transforms remain
  if (tlist.numberOfItems === 0) {
    selected.removeAttribute('transform')
  }

  // Record the changes for undo functionality
  batchCmd.addSubCommand(new ChangeElementCommand(selected, initial as Record<string, string | null>))

  return batchCmd
}
