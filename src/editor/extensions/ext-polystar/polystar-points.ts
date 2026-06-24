/**
 * Pure `points`-attribute generators for the polystar extension. The star and
 * regular-polygon vertex math was previously duplicated across the panel change
 * handlers and the mouseMove draw path; it lives here once so it can be tested.
 *
 * @license MIT
 */

/**
 * Build a star's `points` attribute string: `point`+1 outer vertices on the
 * circumradius circle, each optionally followed by an inner vertex on the
 * inradius (skipped when `inradius` is NaN). `orient` ('point' | 'edge' | other)
 * rotates the first vertex; `radialshift` rotates the inner vertices.
 */
export const buildStarPoints = (
  cx: number,
  cy: number,
  point: number,
  circumradius: number,
  inradius: number,
  orient: string | null,
  radialshift: number
): string => {
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
  return polyPoints
}

/**
 * Build a regular polygon's `points` attribute string: `sides`+1 vertices evenly
 * spaced on the circumradius circle (the extra vertex closes the path).
 */
export const buildRegularPolygonPoints = (
  cx: number,
  cy: number,
  sides: number,
  circumradius: number
): string => {
  let points = ''
  for (let s = 0; sides >= s; s++) {
    const angle = (2.0 * Math.PI * s) / sides
    const x = circumradius * Math.cos(angle) + cx
    const y = circumradius * Math.sin(angle) + cy

    points += x + ',' + y + ' '
  }
  return points
}
