import { test, expect } from './fixtures.js'
import type { Page } from '@playwright/test'
import { visitAndApproveStorage } from './helpers.js'

/** Minimal shape of the `window.svgEditor` global used by the round-trip test. */
type SvgEditorWindow = Window & {
  svgEditor: { svgCanvas: { getSvgString: () => string; setSvgString: (s: string) => unknown } }
}

/**
 * Runtime validation gate for the foreignObject HTML-authoring flow (Phases A-C).
 * Exercises the full insert / edit / cancel / source-toggle / undo / round-trip path
 * through the real tool button, the canvas draw handlers (event.ts), the
 * se-foreign-html-dialog (shadow DOM), and the setForeignContent history command.
 */

const DIALOG = 'se-foreign-html-dialog'
const EDITOR = `${DIALOG} [part="editor"]`
const SOURCE = `${DIALOG} textarea[part="source"]`
const OK = `${DIALOG} button[value="ok"]`
const CANCEL = `${DIALOG} button[value="cancel"]`
const SOURCE_BTN = `${DIALOG} button[title="HTML source"]`

// Known-benign console errors emitted on plain editor load (an optional images/ probe
// 404 and an extension init-order warning) — unrelated to the foreignObject flow.
const BENIGN_ERROR = /\/images\/|svgEditor not initialized/

/**
 * Click the Insert-HTML tool and draw a foreignObject box on the canvas with a real
 * mousedown -> move -> up drag.
 *
 * Coordinates are computed from the *visible intersection* of the document rect
 * (`#canvasBackground`) with the viewport, not from its raw bounding box. Across
 * browsers the canvas is scrolled/zoomed differently (in Firefox the document rect
 * overflows into negative screen space), so a fixed `box.x + offset` can land
 * off-screen and the drag never reaches svgedit's draw handlers. Anchoring to the
 * on-screen overlap keeps both the start and end points over the canvas in every
 * browser/viewport.
 */
async function drawForeignBox (page: Page): Promise<void> {
  await page.locator('#tool_foreign').click()
  const box = await page.locator('#canvasBackground').boundingBox()
  if (!box) throw new Error('Could not determine canvas background bounds')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('No viewport size')

  // Clamp the drawable region to the part of the document rect that is actually
  // on-screen, then draw a box well inside that visible overlap.
  const left = Math.max(box.x, 0)
  const top = Math.max(box.y, 0)
  const right = Math.min(box.x + box.width, viewport.width)
  const bottom = Math.min(box.y + box.height, viewport.height)
  const sx = left + (right - left) * 0.2
  const sy = top + (bottom - top) * 0.2
  const ex = left + (right - left) * 0.6
  const ey = top + (bottom - top) * 0.6

  await page.mouse.move(sx, sy, { steps: 4 })
  await page.mouse.down()
  await page.mouse.move((sx + ex) / 2, (sy + ey) / 2, { steps: 4 })
  await page.mouse.move(ex, ey, { steps: 6 })
  await page.mouse.up()
  await expect(page.locator(DIALOG)).toBeAttached()
  await expect(page.locator(EDITOR)).toBeVisible()
}

/** Type plain text into the contenteditable editor part. */
async function typeInEditor (page: Page, text: string): Promise<void> {
  await page.locator(EDITOR).click()
  await page.keyboard.type(text)
}

/** Number of foreignObject elements on the canvas (scoped to the content layer). */
async function foreignCount (page: Page): Promise<number> {
  return page.evaluate(() =>
    document.querySelectorAll('#svgcontent foreignObject').length)
}

test.describe('foreignObject HTML authoring', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('insert: draw -> type -> OK puts HTML on the canvas', async ({ page }) => {
    await drawForeignBox(page)
    await typeInEditor(page, 'Hello world')
    await page.locator(OK).click()

    await expect(page.locator(DIALOG)).toHaveCount(0)
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    await expect(fo).toContainText('Hello world')
    // The injected child must carry the editor root class.
    await expect(fo.locator('.se-fo-root')).toHaveCount(1)
  })

  test('cancel removes the empty box and raises no console error', async ({ page }) => {
    await drawForeignBox(page)
    await expect.poll(() => foreignCount(page)).toBe(1)

    // Capture only the errors raised by the cancel action itself.
    const errors: string[] = []
    const onConsole = (msg: { type: () => string, text: () => string }): void => {
      if (msg.type() === 'error' && !BENIGN_ERROR.test(msg.text())) errors.push(msg.text())
    }
    const onPageError = (err: Error): void => {
      if (!BENIGN_ERROR.test(err.message)) errors.push(err.message)
    }
    page.on('console', onConsole)
    page.on('pageerror', onPageError)

    await page.locator(CANCEL).click()
    await expect(page.locator(DIALOG)).toHaveCount(0)

    // Cancel must leave zero foreignObjects: the controller removes the just-drawn box,
    // and the deferred InsertElementCommand for the (now detached) node must not
    // resurrect it on the canvas.
    await expect.poll(() => foreignCount(page)).toBe(0)
    // Give any deferred command a tick, then re-confirm it stayed at zero.
    await page.waitForTimeout(200)
    expect(await foreignCount(page)).toBe(0)
    expect(errors, `unexpected console errors on cancel: ${errors.join(' | ')}`).toEqual([])

    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  })

  test('edit via double-click reopens preloaded and updates content', async ({ page }) => {
    // Insert one.
    await drawForeignBox(page)
    await typeInEditor(page, 'Original')
    await page.locator(OK).click()
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    await expect(fo).toContainText('Original')

    // Switch to select tool, then double-click the foreignObject to re-open the dialog.
    await page.locator('#tool_select').click()
    await fo.dblclick()
    await expect(page.locator(DIALOG)).toBeAttached()
    // The dialog must be preloaded with the existing content.
    await expect(page.locator(EDITOR)).toContainText('Original')

    // Replace the content: select-all inside the editor, retype, OK.
    await page.locator(EDITOR).click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Edited')
    await page.locator(OK).click()

    await expect(page.locator(DIALOG)).toHaveCount(0)
    await expect(fo).toHaveCount(1)
    await expect(fo).toContainText('Edited')
    await expect(fo).not.toContainText('Original')
  })

  test('source toggle injects raw HTML', async ({ page }) => {
    await drawForeignBox(page)
    // Flip to HTML-source mode, type raw markup into the textarea, OK.
    await page.locator(SOURCE_BTN).click()
    await expect(page.locator(SOURCE)).toBeVisible()
    await page.locator(SOURCE).fill('<h2>Sourced</h2>')
    await page.locator(OK).click()

    await expect(page.locator(DIALOG)).toHaveCount(0)
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    const h2 = fo.locator('h2')
    await expect(h2).toHaveCount(1)
    await expect(h2).toContainText('Sourced')
  })

  test('undo reverts an edit to the previous content', async ({ page }) => {
    // Insert "First".
    await drawForeignBox(page)
    await typeInEditor(page, 'First')
    await page.locator(OK).click()
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toContainText('First')

    // Edit to "Second".
    await page.locator('#tool_select').click()
    await fo.dblclick()
    await expect(page.locator(DIALOG)).toBeAttached()
    await page.locator(EDITOR).click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Second')
    await page.locator(OK).click()
    await expect(fo).toContainText('Second')

    // Undo the edit -> content returns to "First" (setForeignContent history command).
    await page.locator('#svgcontent foreignObject').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.locator('#svgcontent foreignObject')).toContainText('First')
    await expect(page.locator('#svgcontent foreignObject')).not.toContainText('Second')
  })

  test('cancel then undo+redo never resurrects the cancelled box', async ({ page }) => {
    await drawForeignBox(page)
    await expect.poll(() => foreignCount(page)).toBe(1)

    // Capture errors raised by the cancel/undo/redo sequence itself.
    const errors: string[] = []
    const onConsole = (msg: { type: () => string, text: () => string }): void => {
      if (msg.type() === 'error' && !BENIGN_ERROR.test(msg.text())) errors.push(msg.text())
    }
    const onPageError = (err: Error): void => {
      if (!BENIGN_ERROR.test(err.message)) errors.push(err.message)
    }
    page.on('console', onConsole)
    page.on('pageerror', onPageError)

    // Cancel removes the just-drawn (uncommitted) box.
    await page.locator(CANCEL).click()
    await expect(page.locator(DIALOG)).toHaveCount(0)
    await expect.poll(() => foreignCount(page)).toBe(0)

    // Undo then redo: because the cancelled box was never committed to history,
    // redo must NOT bring it back (the old deferred-insert bug).
    await page.locator('#svgcanvas').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('ControlOrMeta+z')
    await page.keyboard.press('ControlOrMeta+y')
    await page.waitForTimeout(200)
    expect(await foreignCount(page)).toBe(0)
    expect(errors, `unexpected console errors: ${errors.join(' | ')}`).toEqual([])

    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  })

  test('insert content then a single undo removes the whole foreignObject (atomic)', async ({ page }) => {
    await drawForeignBox(page)
    await typeInEditor(page, 'Atomic')
    await page.locator(OK).click()
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    await expect(fo).toContainText('Atomic')

    // One Ctrl+Z must remove the entire box (insert + content are one batch),
    // not just the content (which would leave an empty foreignObject behind).
    await fo.click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => foreignCount(page)).toBe(0)
  })

  test('save -> reload round-trip preserves the foreignObject content', async ({ page }) => {
    await drawForeignBox(page)
    await typeInEditor(page, 'Persist me')
    await page.locator(OK).click()
    await expect(page.locator('#svgcontent foreignObject')).toContainText('Persist me')

    // Serialize then re-parse via the real canvas API (the critical sanitize round-trip).
    const svg = await page.evaluate(() => (window as unknown as SvgEditorWindow).svgEditor.svgCanvas.getSvgString())
    expect(svg).toContain('foreignObject')
    const applied = await page.evaluate(
      (s) => (window as unknown as SvgEditorWindow).svgEditor.svgCanvas.setSvgString(s) !== false, svg)
    expect(applied).toBe(true)

    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    await expect(fo).toContainText('Persist me')
    await expect(fo.locator('.se-fo-root')).toHaveCount(1)
  })

  // ---------------------------------------------------------------------------
  // Behavioral XSS guards. These run in a REAL browser, so an `<img onerror>` or
  // an inline `<script>` in source-mode markup that reaches an innerHTML sink will
  // actually execute and flip `window.__xssFired`. The unit tests assert the DOM is
  // pruned; these assert nothing *fires* — catching the regression locally in seconds
  // instead of waiting on the CodeQL workflow. The fix (inert DOMParser parse + prune
  // in foreign-html-serialize.ts) keeps the flag false and strips the <img>/<script>.
  // ---------------------------------------------------------------------------

  // Payload: an onerror image + an inline script (both would set the flag if executed),
  // plus a benign marker that MUST survive sanitisation and render on the canvas.
  const XSS_PAYLOAD =
    '<img src="x" onerror="window.__xssFired=true"><script>window.__xssFired=true</' +
    'script><p>safe-marker</p>'

  /** Reset the flag on the live page (the payload runs against the already-loaded window). */
  async function armXssFlag (page: Page): Promise<void> {
    // Cover any future navigation/reload too, then set it on the current document.
    await page.addInitScript(() => { (window as Window & { __xssFired?: boolean }).__xssFired = false })
    await page.evaluate(() => { (window as Window & { __xssFired?: boolean }).__xssFired = false })
  }

  /** Fill the source textarea (dialog already in source mode) with the payload and OK. */
  async function injectSourcePayload (page: Page): Promise<void> {
    await page.locator(SOURCE_BTN).click()
    await expect(page.locator(SOURCE)).toBeVisible()
    await page.locator(SOURCE).fill(XSS_PAYLOAD)
    await page.locator(OK).click()
  }

  /** Assert no script/onerror fired and the markup was rendered inert (marker only). */
  async function expectInertResult (page: Page): Promise<void> {
    await expect(page.locator(DIALOG)).toHaveCount(0)
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    // The benign marker survives; the dangerous nodes are gone.
    await expect(fo).toContainText('safe-marker')
    await expect(page.locator('foreignObject img')).toHaveCount(0)
    await expect(page.locator('foreignObject script')).toHaveCount(0)
    // onerror is async — give the browser a beat before reading the flag.
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => (window as Window & { __xssFired?: boolean }).__xssFired)).toBe(false)
  }

  test('source-mode XSS payload neither executes nor renders', async ({ page }) => {
    await armXssFlag(page)
    await drawForeignBox(page)
    await injectSourcePayload(page)
    await expectInertResult(page)
  })

  test('edit-mode source XSS payload neither executes nor renders', async ({ page }) => {
    await armXssFlag(page)
    // Insert a benign box first.
    await drawForeignBox(page)
    await typeInEditor(page, 'benign')
    await page.locator(OK).click()
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    await expect(fo).toContainText('benign')

    // Re-open via double-click, then inject the payload through source mode.
    await page.locator('#tool_select').click()
    await fo.dblclick()
    await expect(page.locator(DIALOG)).toBeAttached()
    await injectSourcePayload(page)
    await expectInertResult(page)
  })

  test('edit then empty-OK deletes the box; undo restores it', async ({ page }) => {
    await drawForeignBox(page)
    await typeInEditor(page, 'DeleteMe')
    await page.locator(OK).click()
    const fo = page.locator('#svgcontent foreignObject')
    await expect(fo).toHaveCount(1)
    await expect(fo).toContainText('DeleteMe')

    // Re-open, clear all content, OK -> the box is deleted.
    await page.locator('#tool_select').click()
    await fo.dblclick()
    await expect(page.locator(DIALOG)).toBeAttached()
    await page.locator(EDITOR).click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Delete')
    await page.locator(OK).click()
    await expect(page.locator(DIALOG)).toHaveCount(0)
    await expect.poll(() => foreignCount(page)).toBe(0)

    // Undo restores the deleted box with its content (undoable RemoveElementCommand).
    await page.locator('#svgcanvas').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => foreignCount(page)).toBe(1)
    await expect(page.locator('#svgcontent foreignObject')).toContainText('DeleteMe')
  })

  test('drawing a box then OK with no content removes it', async ({ page }) => {
    await drawForeignBox(page)
    await expect.poll(() => foreignCount(page)).toBe(1)
    // OK without typing -> empty -> the just-drawn (uncommitted) box is removed.
    await page.locator(OK).click()
    await expect(page.locator(DIALOG)).toHaveCount(0)
    await expect.poll(() => foreignCount(page)).toBe(0)
  })
})
