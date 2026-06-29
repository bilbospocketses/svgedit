import { test, expect } from './fixtures.js'
import type { Page } from '@playwright/test'
import { visitAndApproveStorage } from './helpers.js'

const layerNames = async (page: Page) => {
  const texts = await page.locator('#layerlist tbody tr.layer td.layername').allTextContents()
  return texts.map((t: string) => t.trim())
}

const toggleVisibilityFor = async (page: Page, name: string) => {
  const row = page.locator('#layerlist tbody tr.layer', {
    has: page.locator('td.layername', { hasText: name })
  })
  await row.locator('td.layervis').click()
}

test.describe('Layers panel', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
    const panelHandle = page.locator('div#sidepanel_handle').first()
    await panelHandle.waitFor({ state: 'visible' })
    await panelHandle.click()
    await page.waitForSelector('#layer_new', { state: 'visible' })
  })

  test('creates, renames, toggles and deletes layers', async ({ page }) => {
    const initialNames = await layerNames(page)
    expect(initialNames.length).toBeGreaterThan(0)

    await page.click('#layer_new')
    await page.waitForFunction(
      () => document.querySelector('se-prompt-dialog')?.shadowRoot?.querySelector('dialog')?.open === true
    )
    await page.locator('se-prompt-dialog input').fill('Layer 2')
    await page.locator('se-prompt-dialog input').press('Enter')
    await (expect.poll(() => layerNames(page)) as unknown as ReturnType<typeof expect<string[]>>).resolves.toContain('Layer 2')

    await page.locator('#layerlist td.layername', { hasText: 'Layer 2' }).click()
    await page.click('#layer_rename')
    await page.waitForFunction(
      () => document.querySelector('se-prompt-dialog')?.shadowRoot?.querySelector('dialog')?.open === true
    )
    await page.locator('se-prompt-dialog input').fill('Renamed Layer')
    await page.locator('se-prompt-dialog input').press('Enter')
    await (expect.poll(() => layerNames(page)) as unknown as ReturnType<typeof expect<string[]>>).resolves.toContain('Renamed Layer')

    await toggleVisibilityFor(page, 'Renamed Layer')
    const renamedRow = page.locator('#layerlist tbody tr.layer', {
      has: page.locator('td.layername', { hasText: 'Renamed Layer' })
    })
    await expect(renamedRow.locator('td.layervis')).toHaveClass(/layerinvis/)

    const panelHandle = page.locator('div#sidepanel_handle').first()
    await panelHandle.click()
    await panelHandle.click()

    await page.locator('#layerlist td.layername', { hasText: 'Renamed Layer' }).click()
    await page.click('#layer_delete')
    await (expect.poll(() => layerNames(page)) as unknown as ReturnType<typeof expect<string[]>>).resolves.not.toContain('Renamed Layer')
  })

  test('cancelling the new-layer prompt creates no layer', async ({ page }) => {
    const before = await layerNames(page)
    await page.click('#layer_new')
    await page.waitForFunction(
      () => document.querySelector('se-prompt-dialog')?.shadowRoot?.querySelector('dialog')?.open === true
    )
    await page.locator('se-prompt-dialog input').press('Escape')
    await (expect.poll(() => layerNames(page)) as unknown as ReturnType<typeof expect<string[]>>).resolves.toEqual(before)
  })

  // C3 (audit #29 / #140): the layer rows are operable cells (role=button + tabindex)
  // with screen-reader labels and keyboard activation. jsdom has no real focus/a11y
  // model, so these run in the browser.
  test('C3 layer rows expose button roles and screen-reader labels', async ({ page }) => {
    const visCell = page.locator('#layerlist tbody tr.layer td.layervis').first()
    const nameCell = page.locator('#layerlist tbody tr.layer td.layername').first()
    await expect(visCell).toHaveAttribute('role', 'button')
    await expect(visCell).toHaveAttribute('tabindex', '0')
    await expect(visCell).toHaveAttribute('aria-label', /^Toggle visibility of layer /)
    await expect(visCell).toHaveAttribute('aria-pressed', /^(true|false)$/)
    await expect(nameCell).toHaveAttribute('role', 'button')
    await expect(nameCell).toHaveAttribute('tabindex', '0')
    await expect(nameCell).toHaveAttribute('aria-label', /^Select layer /)
  })

  test('C3 the visibility cell toggles with the keyboard (Enter)', async ({ page }) => {
    const visCell = page.locator('#layerlist tbody tr.layer td.layervis').first()
    await expect(visCell).toHaveAttribute('aria-pressed', 'true')
    await visCell.focus()
    await visCell.press('Enter')
    await expect(visCell).toHaveClass(/layerinvis/)
    await expect(visCell).toHaveAttribute('aria-pressed', 'false')
  })
})
