/**
 * Tools for working with units.
 * @module units
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria, 2010 Jeff Schiller
 */

import { error } from '../common/logger.js'

const NSSVG = 'http://www.w3.org/2000/svg'

const wAttrs = ['x', 'x1', 'cx', 'rx', 'width']
const hAttrs = ['y', 'y1', 'cy', 'ry', 'height']
const unitAttrs = ['r', 'radius', ...wAttrs, ...hAttrs]

/** Interface for the element container passed to init(). */
export interface ElementContainer {
  getBaseUnit(): string
  getElement(id: string): Element | null
  getHeight(): number
  getWidth(): number
  getRoundDigits(): number
}

/** Mapping of unit type to user-coordinate pixel values. */
export interface TypeMap {
  em: number
  ex: number
  in: number
  cm: number
  mm: number
  pt: number
  pc: number
  px: number
  '%': number
  [unit: string]: number
}

// Container of elements.
let elementContainer_: ElementContainer

// Stores mapping of unit type to user coordinates.
let typeMap_: TypeMap = {
  em: 0, ex: 0, in: 0, cm: 0, mm: 0, pt: 0, pc: 0, px: 1, '%': 0
}

/**
 * Initializes this module.
 */
export const init = (elementContainer: ElementContainer): void => {
  elementContainer_ = elementContainer

  // Get correct em/ex values by creating a temporary SVG.
  const svg = document.createElementNS(NSSVG, 'svg')
  document.body.append(svg)
  const rect = document.createElementNS(NSSVG, 'rect')
  rect.setAttribute('width', '1em')
  rect.setAttribute('height', '1ex')
  rect.setAttribute('x', '1in')
  svg.append(rect)
  const bb = rect.getBBox()
  svg.remove()

  const inch = bb.x
  typeMap_ = {
    em: bb.width,
    ex: bb.height,
    in: inch,
    cm: inch / 2.54,
    mm: inch / 25.4,
    pt: inch / 72,
    pc: inch / 6,
    px: 1,
    '%': 0
  }
}

/**
 * Returns the unit object with values for each unit.
 */
export const getTypeMap = (): TypeMap => {
  return typeMap_
}

/**
 * Rounds a given value to a float with number of digits defined in `round_digits`.
 * If an array of two numbers is given, returns a comma-separated string of floats.
 */
export const shortFloat = (val: string | number | [number, number]): number | string => {
  const digits = elementContainer_.getRoundDigits()
  if (!isNaN(val as number)) {
    return Number(Number(val).toFixed(digits))
  }
  if (Array.isArray(val)) {
    return `${shortFloat(val[0])},${shortFloat(val[1])}`
  }
  return Number.parseFloat(val as string).toFixed(digits) as unknown as number - 0
}

/**
 * Converts the number to given unit or baseUnit.
 */
export const convertUnit = (val: string | number, unit?: string): number | string => {
  const resolvedUnit = unit ?? elementContainer_.getBaseUnit()
  return shortFloat((val as number) / (typeMap_[resolvedUnit] ?? 1))
}

/**
 * Sets an element's attribute based on the unit in its current value.
 */
export const setUnitAttr = (elem: Element, attr: string, val: string): void => {
  elem.setAttribute(attr, val)
}

const attrsToConvert: Record<string, string[]> = {
  line: ['x1', 'x2', 'y1', 'y2'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  foreignObject: ['x', 'y', 'width', 'height'],
  rect: ['x', 'y', 'width', 'height'],
  image: ['x', 'y', 'width', 'height'],
  use: ['x', 'y', 'width', 'height'],
  text: ['x', 'y']
}

/**
 * Converts all applicable attributes to the configured baseUnit.
 */
export const convertAttrs = (element: Element): void => {
  const elName = element.tagName
  const unit = elementContainer_.getBaseUnit()
  const attrs = attrsToConvert[elName]
  if (!attrs) { return }

  attrs.forEach((attr) => {
    const cur = element.getAttribute(attr)
    if (cur && !isNaN(Number(cur))) {
      element.setAttribute(attr, (Number(cur) / (typeMap_[unit] ?? 1)) + unit)
    }
  })
}

/**
 * Converts given values to numbers. Attributes must be supplied in case a percentage is given.
 */
export const convertToNum = (attr: string, val: string): number => {
  // Return a number if that's what it already is
  if (!isNaN(Number(val))) { return Number(val) }
  if (val.substr(-1) === '%') {
    // Deal with percentage, depends on attribute
    const num = Number(val.substr(0, val.length - 1)) / 100
    const width = elementContainer_.getWidth()
    const height = elementContainer_.getHeight()

    if (wAttrs.includes(attr)) {
      return num * width
    }
    if (hAttrs.includes(attr)) {
      return num * height
    }
    return num * Math.sqrt((width * width) + (height * height)) / Math.sqrt(2)
  }
  const unit = val.slice(-2)
  const num = Number(val.slice(0, -2))
  return num * (typeMap_[unit] ?? 1)
}

/**
 * Check if an attribute's value is in a valid format.
 */
export const isValidUnit = (attr: string, val: string, selectedElement: Element): boolean => {
  if (unitAttrs.includes(attr)) {
    // True if it's just a number
    if (!isNaN(Number(val))) {
      return true
    }
    // Not a number, check if it has a valid unit
    const valLower = val.toLowerCase()
    return Object.keys(typeMap_).some((unit) => {
      const re = new RegExp(`^-?[\\d.]+${unit}$`)
      return re.test(valLower)
    })
  }
  if (attr === 'id') {
    // if we're trying to change the id, make sure it's not already present in the doc
    // and the id value is valid.

    let result = false
    // because getElement() can throw an exception in the case of an invalid id
    // (according to https://www.w3.org/TR/xml-id/ IDs must be a NCName)
    // we wrap it in an exception and only return true if the ID was valid and
    // not already present
    try {
      const elem = elementContainer_.getElement(val)
      result = (!elem || elem === selectedElement)
    } catch (e) { error('Error getting element by ID', e, 'units') }
    return result
  }
  return true
}
