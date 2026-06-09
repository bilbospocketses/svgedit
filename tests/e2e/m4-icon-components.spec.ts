// tests/e2e/m4-icon-components.spec.ts
// M4 Phase-2 follow-up regression guards:
//   ① Left-toolbar tool highlight is EXCLUSIVE — clicking a tool deselects the
//      previous one. Root cause was seButton.pressed not reflecting to an
//      attribute, so LeftPanel.updateLeftPanel's `#tools_left *[pressed]`
//      clear-loop matched nothing and accent highlights accumulated.
//   ② The flyout / zoom / menu components paint icons via the `.se-icon` mask
//      (token-themed), NOT a raw <img> (which renders currentColor SVGs black
//      and ignores the theme). These were the Phase-5 `<img>` consumers that the
//      Phase-2 currentColor art swap broke until converted.
import { test, expect } from './fixtures.js'
import { visitAndApproveStorage } from './helpers.js'

test.describe('M4 icon components', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('left-toolbar highlight is exclusive — selecting a tool clears the previous', async ({ page }) => {
    await page.waitForSelector('#tool_zoom') // core left-panel tool, always present

    // Clicked via JS (not a Playwright locator) so the assertion targets the
    // pressed-attribute logic, not element visibility. The seButton.pressed
    // reflection fix is shared by every left-toolbar se-button (including the
    // ext-panning pan button), so the core tools exercise the same mechanism.
    const clickTool = (id: string) => page.evaluate(async (i) => {
      ;(document.getElementById(i) as HTMLElement | null)?.click()
      // allow Lit to reflect the `pressed` attribute across all left-panel buttons
      await Promise.all(
        [...document.querySelectorAll('#tools_left se-button, #tools_left se-flyingbutton')]
          .map((e) => (e as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete ?? Promise.resolve())
      )
    }, id)
    const pressedIds = () => page.evaluate(() =>
      [...document.querySelectorAll('#tools_left *[pressed]')].map((e) => e.id))

    // Exactly one button is highlighted after each switch (pre-fix: this list was
    // always empty because seButton.pressed never reflected to the attribute).
    await clickTool('tool_zoom')
    expect(await pressedIds()).toEqual(['tool_zoom'])

    await clickTool('tool_fhpath')
    expect(await pressedIds()).toEqual(['tool_fhpath'])

    await clickTool('tool_select')
    expect(await pressedIds()).toEqual(['tool_select'])
  })

  test('flyout / zoom / menu icons paint via mask token (no <img>) and re-theme', async ({ page }) => {
    // No raw <img> survives in the converted components.
    const imgCounts = await page.evaluate(() => ({
      flyout: document.querySelector('#tools_rect')?.shadowRoot?.querySelectorAll('img').length ?? -1,
      zoom: document.querySelector('#zoom')?.shadowRoot?.querySelectorAll('img').length ?? -1,
      menuItems: [...document.querySelectorAll('se-menu-item[src]')]
        .reduce((n, m) => n + (m.shadowRoot?.querySelectorAll('img').length ?? 0), 0)
    }))
    expect(imgCounts.flyout).toBe(0)
    expect(imgCounts.zoom).toBe(0)
    expect(imgCounts.menuItems).toBe(0)

    // The flyout's collapsed icon is a masked .se-icon whose ink re-themes.
    const flyoutInk = (theme: string) => page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      const icon = document.querySelector('#tools_rect')?.shadowRoot?.querySelector('.se-icon')
      return icon ? getComputedStyle(icon).backgroundColor : null
    }, theme)
    const light = await flyoutInk('light')
    const dark = await flyoutInk('dark')
    expect(light).not.toBeNull()
    expect(dark).not.toBeNull()
    expect(light).not.toBe(dark)
  })
})
