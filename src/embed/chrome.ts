import type { ChromePreset, ChromeState } from './protocol.js'

const CHROME_ELEMENTS = ['menu', 'toolbox', 'layers', 'palette', 'statusbar', 'header'] as const
const CHROME_PRESETS = ['full', 'minimal', 'none'] as const

/** Runtime guard for the {@link ChromePreset} union (URL/RPC inputs are untrusted). */
export function isChromePreset (v: unknown): v is ChromePreset {
  return typeof v === 'string' && (CHROME_PRESETS as readonly string[]).includes(v)
}

export function resolveChromePreset (preset: ChromePreset): Required<ChromeState> {
  switch (preset) {
    case 'full':
      return { menu: true, toolbox: true, layers: true, palette: true, statusbar: true, header: true }
    case 'minimal':
      return { menu: false, toolbox: true, layers: false, palette: false, statusbar: false, header: false }
    case 'none':
      return { menu: false, toolbox: false, layers: false, palette: false, statusbar: false, header: false }
    default: {
      const _exhaustive: never = preset
      throw new Error(`unknown chrome preset: ${String(_exhaustive)}`)
    }
  }
}

export function applyChrome (body: HTMLElement, state: ChromeState): void {
  body.classList.add('embed')
  for (const el of CHROME_ELEMENTS) {
    const visible = state[el]
    if (visible === false) {
      body.classList.add(`no-${el}`)
    } else if (visible === true) {
      body.classList.remove(`no-${el}`)
    }
  }
}
