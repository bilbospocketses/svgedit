// tests/e2e/theme-chrome.spec.ts
// M1 Design System — theming invariants:
//   1. Chrome surface background changes between data-theme="light" and "dark"
//   2. Artwork fill RESOLVES identical (and stays red) across themes — no token bleed
import { test, expect } from './fixtures.js'
import { visitAndApproveStorage, setSvgSource } from './helpers.js'

test.describe('M1 theming', () => {
  test.beforeEach(async ({ page }) => {
    await visitAndApproveStorage(page)
  })

  test('chrome surface follows data-theme; artwork does not', async ({ page }) => {
    // ── Invariant 1: chrome re-themes ──────────────────────────────────────
    // .svg_editor has `background: var(--main-bg-color)` → var(--se-bg),
    // which differs between light (:root) and dark (html[data-theme="dark"]).
    const surfaceBgLight = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light')
      return getComputedStyle(document.querySelector('.svg_editor')!).backgroundColor
    })

    const surfaceBgDark = await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
      return getComputedStyle(document.querySelector('.svg_editor')!).backgroundColor
    })

    expect(surfaceBgLight).not.toBe(surfaceBgDark)

    // ── Invariant 2: artwork fill is NOT themed ────────────────────────────
    // Load a rect with an explicit red fill into the canvas, then read its
    // RESOLVED style (getComputedStyle.fill) under each theme. A static
    // getAttribute('fill') could never change with theme, so it would not
    // verify the invariant — resolved style would catch any chrome/token
    // bleed into artwork fills under dark.
    await setSvgSource(page, `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
  <g class="layer"><title>Layer 1</title>
    <rect id="m1_probe" x="10" y="10" width="20" height="20" fill="#ff0000"/>
  </g>
</svg>`)

    const probeFill = (theme: string) => page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      const svgContent = window.svgEditor.svgCanvas.getSvgContent()
      const rect = svgContent.querySelector('#m1_probe')
      return rect ? getComputedStyle(rect).fill : null
    }, theme)

    const artLight = await probeFill('light')
    const artDark = await probeFill('dark')

    // Resolved fill must be found, identical across themes, and still red.
    expect(artLight).not.toBeNull()
    expect(artDark).not.toBeNull()
    expect(artLight).toBe(artDark)
    expect(artLight).toContain('255, 0, 0')
  })

  test('toolbar icons follow data-theme; active tool differs', async ({ page }) => {
    const iconBg = (theme: string) => page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      const icon = document.querySelector('#tool_select')?.shadowRoot?.querySelector('.se-icon')
      return icon ? getComputedStyle(icon).backgroundColor : null
    }, theme)

    const light = await iconBg('light')
    const dark = await iconBg('dark')
    expect(light).not.toBeNull()
    expect(dark).not.toBeNull()
    expect(light).not.toBe(dark)            // icon ink re-themes between light and dark

    // Active/selected tool: the .pressed icon resolves to a different (accent) color.
    const activeBg = await page.evaluate(async () => {
      document.documentElement.setAttribute('data-theme', 'light')
      const btn = document.querySelector('#tool_select') as HTMLElement & { pressed: boolean; updateComplete: Promise<unknown> }
      btn.pressed = true                    // drive Lit's property (real press path), not the class directly
      await btn.updateComplete
      return getComputedStyle(btn.shadowRoot!.querySelector('.se-icon')!).backgroundColor
    })
    expect(activeBg).not.toBe(light)                 // active (accent) differs from default ink
    expect(activeBg).not.toBe('rgba(0, 0, 0, 0)')    // ...and is an actual painted color (not a broken/transparent token)
  })
})
