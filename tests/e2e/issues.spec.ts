import { test, expect } from './fixtures.js'
import { setRotationAngle, setSvgSource, visitAndApproveStorage } from './helpers.js'
import type { Page } from '@playwright/test'

/**
 * Move the currently selected element(s) via the svgCanvas API.
 *
 * Arrow-key shortcuts are only bound after the extensions_added event fires,
 * which is fire-and-forget in e2e, so the keyboard handler may never attach.
 * Calling moveSelectedElements() directly exercises the same transform logic
 * deterministically, decoupled from the shortcut-registration lifecycle.
 */
async function moveSelected (page: Page, dx: number, dy: number) {
  await page.evaluate<void, [number, number]>(([dx, dy]) => {
    window.svgEditor.svgCanvas.moveSelectedElements(dx, dy)
  }, [dx, dy])
}

test.describe('Regression issues', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('issue 359: undo/redo on simple rect', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
       <title>Layer 1</title>
        <rect fill="#ffff00" height="70" width="165" x="179.5" y="146.5"/>
      </g>
     </svg>`)
    // The fixture rect has no id, so select it by element type within the content layer.
    await expect(page.locator('#svgcontent rect')).toHaveCount(1)
    await page.locator('#tool_undo').click()
    await expect(page.locator('#svgcontent rect')).toHaveCount(0)
    await page.locator('#tool_redo').click()
    await expect(page.locator('#svgcontent rect')).toHaveCount(1)
  })

  test('issue 407: ellipse rotation preserves center', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <title>Layer 1</title>
        <ellipse cx="217.5" cy="139.5" id="svg_1" rx="94.5" ry="71.5" stroke="#000000" stroke-width="5" fill="#FF0000"/>
      </g>
    </svg>`)
    await page.locator('#svg_1').click()
    await setRotationAngle(page, 15)
    const cx = await page.locator('#svg_1').getAttribute('cx')
    const cy = await page.locator('#svg_1').getAttribute('cy')
    expect(cx).toBe('217.5')
    expect(cy).toBe('139.5')
  })

  test('issue 408: blur filter applied without NaN', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
       <title>Layer 1</title>
        <rect id="svg_1" width="100" height="100" x="50" y="50" fill="#00ff00" />
      </g>
     </svg>`)
    await page.locator('#svg_1').click()
    await page.locator('#blur').evaluate(el => {
      const input = el.shadowRoot!.querySelector('input')!
      input.value = '5'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const filter = await page.locator('#svg_1').getAttribute('filter')
    expect(filter || '').not.toContain('NaN')
  })

  test('issue 423: deleting grouped elements works', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g id="svg_1">
        <rect x="10" y="10" width="50" height="50" fill="#f00"></rect>
        <rect x="70" y="10" width="50" height="50" fill="#0f0"></rect>
      </g>
    </svg>`)
    await page.evaluate(() => document.getElementById('svg_1')?.remove())
    await expect(page.locator('#svg_1')).toHaveCount(0)
  })

  test('issue 660: polygon rotation stays within canvas', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <polygon id="svg_1" points="295.5 211.5 283.09 227.51 284.46 247.19 268.43 234.81 248.83 240.08 255.5 221.5 244.03 205.5 264.5 205.5 276.5 188.19 279.5 208.5 298.5 215.5 295.5 211.5" fill="#FF0000" stroke="#000000" stroke-width="5"/>
      </g>
    </svg>`)
    await page.locator('#svg_1').click()
    await setRotationAngle(page, 25)
    const points = await page.locator('#svg_1').getAttribute('points')
    expect(points).toBeTruthy()
  })

  test('issue 699: zooming preserves selection', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <rect id="svg_1" x="50" y="50" width="100" height="100" fill="#00f"/>
      </g>
    </svg>`)
    await page.locator('#svg_1').click()
    const result = await page.evaluate(() => {
      const c = window.svgEditor.svgCanvas
      const before = c.getSelectedElements().filter(Boolean).length
      c.setZoom(c.getZoom() * 1.5)
      const sel = c.getSelectedElements().filter(Boolean)
      return { before, after: sel.length, id: sel[0]?.id }
    })
    // selecting then zooming must keep the same element selected
    expect(result.before).toBe(1)
    expect(result.after).toBe(1)
    expect(result.id).toBe('svg_1')
  })

  test('issue 726: text element loads from source and is selectable', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <text id="svg_1" x="50" y="50">hello</text>
      </g>
    </svg>`)
    await page.locator('#svg_1').click()
    const result = await page.evaluate(() => {
      const sel = window.svgEditor.svgCanvas.getSelectedElements().filter(Boolean)
      return { count: sel.length, tag: sel[0]?.tagName, text: sel[0]?.textContent }
    })
    expect(result.count).toBe(1)
    expect(result.tag).toBe('text')
    expect(result.text).toBe('hello')
  })

  test('issue 752: changing the base unit does not corrupt stored geometry', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <rect id="svg_1" x="100" y="100" width="200" height="100"/>
      </g>
    </svg>`)
    const result = await page.evaluate(() => {
      const before = document.getElementById('svg_1')!.getAttribute('width')
      window.svgEditor.setConfig({ baseUnit: 'cm' })
      const after = document.getElementById('svg_1')!.getAttribute('width')
      return { before, after }
    })
    // the stored geometry is unit-agnostic; switching the display unit must not rewrite it
    expect(result.before).toBe('200')
    expect(result.after).toBe('200')
  })

  test('issue 462: dragging element with complex matrix transforms stays stable', async ({ page }) => {
    // This tests the fix for issue #462 where elements with complex matrix transforms
    // in nested groups would jump around when dragged
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <title>Layer 1</title>
        <g id="svg_1" transform="skewX(30) translate(-3,4) rotate(3)">
          <g id="svg_2" transform="skewX(10) translate(-3,4) rotate(10)">
            <circle cx="40.61157" cy="40" fill="blue" id="svg_3" r="20" stroke="#000000" stroke-width="2" transform="translate(250,-50) rotate(45) scale(1.5)"/>
          </g>
        </g>
      </g>
    </svg>`)

    // Clicking the deeply-nested circle selects the outermost group #svg_1.
    const circle = page.locator('#svg_3')
    await circle.click()
    await expect.poll(() => page.evaluate(() =>
      window.svgEditor.svgCanvas.getSelectedElements().filter(Boolean)[0]?.id
    )).toBe('svg_1')

    const bbox = () => circle.evaluate(el => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })

    // The real #462 fix is about STABILITY: an element under stacked skew /
    // rotate / scale transforms must move by the *same* screen amount for the
    // *same* nudge, every time — it must not "jump around" or drift. We assert
    // that directly: capture the bbox delta of one move, repeat the identical
    // move, and require the second delta to equal the first (repeatable
    // increments) while being non-zero (the move actually took effect).
    //
    // Movement is driven through svgCanvas.moveSelectedElements rather than arrow
    // keys: the arrow-key handler is bound only after the extensions_added event,
    // which is fire-and-forget in e2e, so a real ArrowRight press is a silent
    // no-op here (verified: zero bbox change). The old test pressed arrow keys and
    // then asserted only `delta < 100`, which passed trivially because the element
    // never moved at all — it never exercised the #462 transform path.
    const STEP = 10

    const b0 = await bbox()
    await moveSelected(page, STEP, STEP)
    const b1 = await bbox()
    await moveSelected(page, STEP, STEP)
    const b2 = await bbox()

    const d1 = { x: b1.x - b0.x, y: b1.y - b0.y, w: b1.width - b0.width, h: b1.height - b0.height }
    const d2 = { x: b2.x - b1.x, y: b2.y - b1.y, w: b2.width - b1.width, h: b2.height - b1.height }

    // Each move must actually displace the element (non-zero, and never a wild jump).
    expect(Math.hypot(d1.x, d1.y)).toBeGreaterThan(1)
    expect(Math.hypot(d1.x, d1.y)).toBeLessThan(100)

    // Stability: the second identical move produces the same delta as the first,
    // within 1px. Equal repeatable increments are exactly what #462 guarantees;
    // a regression (jumping / drift) would make d2 diverge from d1.
    expect(Math.abs(d2.x - d1.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(d2.y - d1.y)).toBeLessThanOrEqual(1)

    // No distortion: dimensions stay constant across both moves (translation only).
    expect(Math.abs(d1.w)).toBeLessThanOrEqual(1)
    expect(Math.abs(d1.h)).toBeLessThanOrEqual(1)
    expect(Math.abs(d2.w)).toBeLessThanOrEqual(1)
    expect(Math.abs(d2.h)).toBeLessThanOrEqual(1)
  })

  // Issue #391: after ungrouping `<g transform="translate(100,100)">`, the selection
  // box and the path-edit point grips must sit on the rendered path. Ungroup leaves the
  // child path a `matrix(1 0 0 1 100 100)` transform by design (group-transforms.spec.ts
  // "ungroup preserves element positions"), and Path.update() used to apply the grip
  // matrix only for a rotation, so the grips rendered at the path's LOCAL coords, off by
  // exactly the translate (fixed in core/path-method.ts, #30 / PR #224).
  //
  // The ungroup and the path edit are driven through the canvas API, the same calls the
  // UI makes. The old test pressed Ctrl+Shift+G, which was never an svgedit shortcut
  // (ungroup's key is plain G, on #tool_group_elements), so nothing ungrouped. The
  // ungroup button, the G button with a group selected, and the context menu all call
  // svgCanvas.ungroupSelectedElement(), and so does this test. The old test's
  // double-click never created #pathpointgrip_*; this test calls the path-edit entry
  // directly instead. Every check below runs unconditionally.
  test('issue 391: selection box position after ungrouping and path edit', async ({ page }) => {
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <title>Layer 1</title>
        <g id="svg_1" transform="translate(100, 100)">
          <path id="svg_2" d="M 0,0 L 50,0 L 50,50 L 0,50 Z" fill="#ff0000" stroke="#000000" stroke-width="2"/>
          <path id="svg_3" d="M 60,0 L 110,0 L 110,50 L 60,50 Z" fill="#00ff00" stroke="#000000" stroke-width="2"/>
        </g>
      </g>
    </svg>`)

    // Ungroup: select the group and call what the ungroup button and context menu call.
    await page.evaluate(() => {
      const c = window.svgEditor.svgCanvas
      c.selectOnly([document.getElementById('svg_1')!])
      c.ungroupSelectedElement()
    })
    await expect(page.locator('#svg_1')).toHaveCount(0)

    // The scenario #391 needs: the path left the group but kept the group's translate
    // on itself, so its local coordinates are NOT its canvas coordinates. Without this
    // the grip checks below would pass even with the bug.
    const path = page.locator('#svg_2')
    const ctm = await path.evaluate(el => {
      const m = (el as SVGGraphicsElement).getCTM()!
      const parentM = (el.parentNode as SVGGraphicsElement).getCTM()!
      const local = parentM.inverse().multiply(m)
      return { a: local.a, b: local.b, c: local.c, d: local.d, e: local.e, f: local.f }
    })
    expect(ctm).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 100, f: 100 })

    // One synchronous read of where the path's four corners render on screen (its own
    // coordinates through the browser's screen matrix) and of where the elements
    // matching `selector` render. Entering path edit moved the whole canvas 40 px on
    // screen between two separate reads (measured 2026-11-04, chromium), so each
    // comparison takes both sides from one snapshot.
    type Box = { id: string, x: number, y: number, width: number, height: number }
    const snapshot = (selector: string) => page.evaluate((sel) => {
      const m = (document.getElementById('svg_2') as unknown as SVGGraphicsElement).getScreenCTM()!
      const corners = [[0, 0], [50, 0], [50, 50], [0, 50]].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(m)
        return { x: p.x, y: p.y }
      })
      const boxes = [...document.querySelectorAll(sel)]
        .filter(el => el.getAttribute('display') !== 'none')
        .map(el => {
          const r = el.getBoundingClientRect()
          return { id: el.id, x: r.x, y: r.y, width: r.width, height: r.height }
        })
      return { corners, boxes }
    }, selector)
    const centerOf = (r: Box) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })

    // Selection box: select the path alone; its outline must be centered on the path.
    await page.evaluate(() => {
      window.svgEditor.svgCanvas.selectOnly([document.getElementById('svg_2')!], true)
    })
    await expect(page.locator('#selectedBox0')).toBeVisible()
    const sel = await snapshot('#selectedBox0')
    const selReport = JSON.stringify(sel)
    expect(sel.boxes.length, selReport).toBe(1)
    const boxRect = sel.boxes[0]!
    const [c0, c1, c2, c3] = sel.corners as [{ x: number, y: number }, { x: number, y: number }, { x: number, y: number }, { x: number, y: number }]
    const boxCenter = centerOf(boxRect)
    expect(Math.abs(boxCenter.x - (c0.x + c2.x) / 2), selReport).toBeLessThanOrEqual(1)
    expect(Math.abs(boxCenter.y - (c0.y + c2.y) / 2), selReport).toBeLessThanOrEqual(1)
    // The box encloses the path rather than being a stray point near it.
    expect(boxRect.width, selReport).toBeGreaterThanOrEqual(c1.x - c0.x)
    expect(boxRect.height, selReport).toBeGreaterThanOrEqual(c3.y - c0.y)

    // Path edit: what a mouseup with no movement on an already-selected path calls
    // (core/event.ts mouseUp -> pathActions.select -> toEditMode). It runs
    // synchronously, so the mode it returns is already the final one.
    const mode = await page.evaluate(() => {
      const c = window.svgEditor.svgCanvas
      c.pathActions.toEditMode(document.getElementById('svg_2')!)
      return c.getCurrentMode()
    })
    expect(mode).toBe('pathedit')

    // The point grips must sit on the corners of the rendered path: every corner has a
    // grip on it, and no grip is anywhere else. With the #391 bug the grips sit at the
    // path's local coordinates, 100 canvas units up and left of the path.
    const gripSelector = '#pathpointgrip_container [id^="pathpointgrip_"]'
    await expect(page.locator(gripSelector).first()).toBeVisible()
    const { corners, boxes } = await snapshot(gripSelector)
    const grips = boxes.map(b => ({ id: b.id, ...centerOf(b) }))
    const near = (a: { x: number, y: number }, b: { x: number, y: number }) =>
      Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1
    const gripReport = JSON.stringify({ grips, corners })
    expect(grips.length, gripReport).toBeGreaterThanOrEqual(corners.length)
    for (const corner of corners) {
      expect(grips.some(g => near(g, corner)), `no grip on corner ${JSON.stringify(corner)}: ${gripReport}`).toBe(true)
    }
    for (const grip of grips) {
      expect(corners.some(c => near(grip, c)), `${grip.id} is on no corner: ${gripReport}`).toBe(true)
    }
  })

  test('issue 404: border width during resize at zoom', async ({ page }) => {
    // This tests the fix for issue #404 where the selection-box border width
    // rendered incorrectly during a resize while zoom was not at 100%.
    //
    // The invariant #404 guarantees: the selection outline (#selectedBox0) is a
    // zoom-compensated overlay, so its border renders at a constant 1px on screen
    // at ANY zoom and at every moment of a resize drag (core/select.ts computes
    // offset = 1/zoom for the outline). A regression made the border balloon with
    // zoom during the drag. The old test never resized at all — it only pressed an
    // arrow key (a no-op headless) and re-read the element's stroke-width attribute,
    // so it never touched the resize-at-zoom path this issue is about.
    await setSvgSource(page, `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
      <g class="layer">
        <title>Layer 1</title>
        <rect id="svg_1" x="100" y="100" width="200" height="150" fill="#00ff00" stroke="#000000" stroke-width="10"/>
      </g>
    </svg>`)

    // Zoom to 150% — the whole point of #404 is non-100% zoom.
    await page.evaluate(() => { window.svgEditor.svgCanvas.setZoom(1.5) })
    await expect.poll(() => page.evaluate(() => window.svgEditor.svgCanvas.getZoom())).toBe(1.5)

    const rect = page.locator('#svg_1')
    await rect.click({ force: true })

    // The selection outline appears once the element is selected.
    const outline = page.locator('#selectedBox0')
    await expect(outline).toBeAttached()

    // Rendered (on-screen) border width of the selection outline. Computed style
    // is in px; this is what the user actually sees and what #404 is about.
    const outlineBorderPx = () => outline.evaluate(el =>
      parseFloat(getComputedStyle(el).strokeWidth)
    )
    // Read the SE resize-grip's current screen centre so we can drag it.
    const seGripCentre = () => page.evaluate(() => {
      const g = document.getElementById('selectorGrip_resize_se')
      if (!g) return null
      const r = g.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })

    // Border is 1px on screen at 150% zoom before resizing.
    expect(await outlineBorderPx()).toBeCloseTo(1, 1)

    const grip = await seGripCentre()
    expect(grip).not.toBeNull()

    // Drive a REAL resize: press the SE grip and drag it outward. We sample the
    // border mid-drag (while currentMode === 'resize') and again after release.
    await page.mouse.move(grip!.x, grip!.y)
    await page.mouse.down()
    await page.mouse.move(grip!.x + 45, grip!.y + 30, { steps: 6 })

    // Mid-resize the canvas is genuinely in resize mode (proves the drag took).
    expect(await page.evaluate(() => window.svgEditor.svgCanvas.getCurrentMode())).toBe('resize')
    // Core assertion: the outline border is STILL 1px on screen during the resize
    // at 150% zoom — it must not scale with zoom. This is the #404 invariant.
    expect(await outlineBorderPx()).toBeCloseTo(1, 1)

    await page.mouse.up()

    // And it remains 1px after the resize commits.
    expect(await outlineBorderPx()).toBeCloseTo(1, 1)

    // Sanity: the resize actually changed the element (a scale was baked into its
    // transform), so the border assertions above were exercised against a real
    // resize rather than a vacuous no-op.
    const committedTransform = await rect.getAttribute('transform')
    expect(committedTransform).toMatch(/matrix\(/)
    const m = committedTransform!.match(/matrix\(([^)]+)\)/)![1]!.trim().split(/[\s,]+/).map(Number)
    expect(m[0]).toBeGreaterThan(1) // x-scale grew
    expect(m[3]).toBeGreaterThan(1) // y-scale grew

    // The element's own stroke-width attribute is untouched by the resize.
    expect(await rect.getAttribute('stroke-width')).toBe('10')
  })
})
