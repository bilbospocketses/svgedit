import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('Path tool keyboard shortcuts: Enter completes, Escape cancels', () => {
  // Regression for todo #10 (Investigations): pressing Enter while drawing
  // a path should complete it open (>= 2 points); pressing Escape should
  // discard the in-progress drawing. Input-focus guard: keys must not be
  // intercepted while the user is typing in inputs/textareas.

  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('Enter completes the path open when 2+ points placed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { svgCanvas } = window.svgEditor
      svgCanvas.setMode('path')
      // Synthesize a 3-point in-progress drawing by directly driving pathActions.
      // Each mousedown in path mode adds a point.
      const dispatchMouseDown = (x, y) => {
        const evt = new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y, button: 0 })
        document.getElementById('svgroot').dispatchEvent(evt)
      }
      dispatchMouseDown(200, 200)
      dispatchMouseDown(250, 200)
      dispatchMouseDown(250, 250)
      const drawnBefore = Boolean(svgCanvas.getDrawnPath())
      const modeBefore = svgCanvas.getCurrentMode()
      // Now fire the Enter key.
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      document.dispatchEvent(enter)
      const drawnAfter = svgCanvas.getDrawnPath()
      const modeAfter = svgCanvas.getCurrentMode()
      const pathInDom = Boolean(document.querySelector('path[id^="svg_"]'))
      return { drawnBefore, modeBefore, drawnAfter, modeAfter, pathInDom }
    })

    expect(result.drawnBefore).toBe(true)
    expect(result.modeBefore).toBe('path')
    expect(result.drawnAfter).toBeNull()
    expect(result.modeAfter).toBe('pathedit')
    expect(result.pathInDom).toBe(true)
  })

  test('Enter is a no-op when fewer than 2 points are placed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { svgCanvas } = window.svgEditor
      svgCanvas.setMode('path')
      const evt = new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 200, button: 0 })
      document.getElementById('svgroot').dispatchEvent(evt)
      const drawnBefore = Boolean(svgCanvas.getDrawnPath())
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      document.dispatchEvent(enter)
      return {
        drawnBefore,
        drawnAfter: Boolean(svgCanvas.getDrawnPath()),
        mode: svgCanvas.getCurrentMode()
      }
    })

    expect(result.drawnBefore).toBe(true)
    expect(result.drawnAfter).toBe(true)
    expect(result.mode).toBe('path')
  })

  test('Escape cancels the in-progress path and stays in path mode', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { svgCanvas } = window.svgEditor
      svgCanvas.setMode('path')
      const dispatchMouseDown = (x, y) => {
        const evt = new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y, button: 0 })
        document.getElementById('svgroot').dispatchEvent(evt)
      }
      dispatchMouseDown(200, 200)
      dispatchMouseDown(250, 200)
      const drawnBefore = Boolean(svgCanvas.getDrawnPath())
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      document.dispatchEvent(escape)
      return {
        drawnBefore,
        drawnAfter: svgCanvas.getDrawnPath(),
        mode: svgCanvas.getCurrentMode(),
        pathInDom: Boolean(document.querySelector('path[id^="svg_"]:not(#path_stretch_line)'))
      }
    })

    expect(result.drawnBefore).toBe(true)
    expect(result.drawnAfter).toBeNull()
    expect(result.mode).toBe('path')
    expect(result.pathInDom).toBe(false)
  })

  test('Enter inside the Source-editor textarea is NOT intercepted', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { svgCanvas } = window.svgEditor
      svgCanvas.setMode('path')
      // Place 2 points so finishPath would complete if intercepted.
      const dispatchMouseDown = (x, y) => {
        const evt = new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y, button: 0 })
        document.getElementById('svgroot').dispatchEvent(evt)
      }
      dispatchMouseDown(200, 200)
      dispatchMouseDown(250, 200)
      // Now create a textarea, focus it, dispatch Enter from there.
      const ta = document.createElement('textarea')
      document.body.appendChild(ta)
      ta.focus()
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      ta.dispatchEvent(enter)
      // Path mode state should be unchanged (still drawing).
      const stillDrawing = Boolean(svgCanvas.getDrawnPath())
      const mode = svgCanvas.getCurrentMode()
      ta.remove()
      return { stillDrawing, mode }
    })

    expect(result.stillDrawing).toBe(true)
    expect(result.mode).toBe('path')
  })
})
