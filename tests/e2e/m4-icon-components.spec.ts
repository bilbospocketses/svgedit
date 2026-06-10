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

  test('no icon component leaks an <img> — every glyph paints via the mask token', async ({ page }) => {
    // The converted components must not fall back to <img>, which renders Lucide
    // currentColor glyphs black and ignores the theme. seMenu (svgedit logo) and
    // sePalette (no-color swatch) legitimately use <img> and are excluded here.
    const tags = [
      'se-button', 'se-flyingbutton', 'se-menu-item', 'se-zoom', 'se-explorerbutton',
      'se-list-item', 'se-spin-input', 'se-list', 'se-input', 'se-dropdown', 'se-colorpicker'
    ]
    const leaks = await page.evaluate((tagList) => {
      const out: Record<string, number> = {}
      for (const tag of tagList) {
        let n = 0
        for (const el of document.querySelectorAll(tag)) {
          n += el.shadowRoot?.querySelectorAll('img').length ?? 0
        }
        if (n) out[tag] = n
      }
      return out
    }, tags)
    expect(leaks).toEqual({})
  })

  test('theme toggle renders visible SVG geometry (svg tag, not inert html namespace)', async ({ page }) => {
    // Regression: seThemeToggle built its sun/moon with Lit's `html` tag, so the
    // <circle>/<path> landed in the HTML namespace — inert, zero geometry, invisible.
    // getBBox() must report real dimensions (it is 0x0 for html-namespace nodes).
    const bbox = await page.evaluate(() => {
      const svg = document.getElementById('theme_toggle')?.shadowRoot?.querySelector('svg') as SVGGraphicsElement | null
      if (!svg) return null
      const b = svg.getBBox()
      return { w: b.width, h: b.height }
    })
    expect(bbox).not.toBeNull()
    expect(bbox!.w).toBeGreaterThan(0)
    expect(bbox!.h).toBeGreaterThan(0)
  })

  test('icon spans are decorative — aria-hidden, not a generic role="img" label', async ({ page }) => {
    // The masked .se-icon spans carry no semantic content (the button title is the
    // accessible name), so every one must be aria-hidden — never role="img"
    // aria-label="icon", which announces a meaningless "icon" to screen readers.
    const a11y = await page.evaluate(() => {
      const spans = [...document.querySelectorAll(
        'se-button, se-flyingbutton, se-menu-item, se-zoom, se-explorerbutton, se-list-item, se-spin-input, se-list, se-input, se-dropdown, se-colorpicker'
      )].flatMap((el) => [...((el as HTMLElement).shadowRoot?.querySelectorAll('.se-icon') ?? [])])
      return {
        total: spans.length,
        hidden: spans.filter((s) => s.getAttribute('aria-hidden') === 'true').length,
        roleImg: spans.filter((s) => s.getAttribute('role') === 'img').length,
        labelled: spans.filter((s) => s.getAttribute('aria-label') === 'icon').length
      }
    })
    expect(a11y.total).toBeGreaterThan(0)
    expect(a11y.roleImg).toBe(0)
    expect(a11y.labelled).toBe(0)
    expect(a11y.hidden).toBe(a11y.total)
  })
})
