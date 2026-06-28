import type { Page } from '@playwright/test'

/**
 * Browser-side perf instrumentation for the e2e count-assertion specs.
 *
 * `instrumentInit` is injected via `page.addInitScript` BEFORE any editor script
 * runs, so it can wrap expensive host APIs with counters. A perf spec then drives
 * an action (zoom / scroll / drag / a direct method call) and asserts how many
 * times the redundant call fired. The count is high on the un-fixed code (RED) and
 * drops when the redundancy fix lands (GREEN); the spec then stands as a regression
 * guard. These findings are NOT jsdom-testable — the host APIs either return empty
 * (`getComputedStyle`) or are unimplemented (`canvas`), so the redundant work only
 * actually runs in a real browser.
 *
 * Counts are keyed both globally (e.g. `getComputedStyle`) and per target element
 * id/tag (e.g. `getComputedStyle:workarea`) so a spec can isolate one function's
 * reads from unrelated ones (rulers, panels).
 */
function instrumentInit (): void {
  const w = window as unknown as { __perf?: unknown }
  if (w.__perf) return // addInitScript re-runs on every navigation; wrap once per document.

  const counts: Record<string, number> = {}
  const bump = (key: string): void => { counts[key] = (counts[key] ?? 0) + 1 }
  const elemKey = (el: unknown): string => {
    const e = el as { id?: string, tagName?: string } | null
    return (e && (e.id || (e.tagName && e.tagName.toLowerCase()))) || 'unknown'
  }

  const realGetComputedStyle = window.getComputedStyle
  window.getComputedStyle = function (el: Element, pseudo?: string | null) {
    bump('getComputedStyle')
    bump('getComputedStyle:' + elemKey(el))
    return realGetComputedStyle.call(window, el, pseudo ?? undefined)
  } as typeof window.getComputedStyle

  ;(window as unknown as { __perf: unknown }).__perf = {
    counts,
    reset (): void { for (const k of Object.keys(counts)) delete counts[k] }
  }
}

/** Install the perf counters. Call BEFORE navigating (addInitScript applies on the next load). */
export async function installPerfCounters (page: Page): Promise<void> {
  await page.addInitScript(instrumentInit)
}

/** Reset counts, run `action`, return a snapshot of the counts it produced. */
export async function measure (
  page: Page,
  action: () => Promise<unknown>
): Promise<Record<string, number>> {
  await page.evaluate(() => { (window as unknown as { __perf: { reset: () => void } }).__perf.reset() })
  await action()
  return page.evaluate(() => ({ ...(window as unknown as { __perf: { counts: Record<string, number> } }).__perf.counts }))
}
