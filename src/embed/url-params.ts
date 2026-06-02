import { parseAllowedOrigins } from './origin.js'
import type { ChromePreset } from './protocol.js'

export type EmbedURLParams = {
  embedMode: boolean
  chrome: ChromePreset | undefined
  theme: string | undefined
  palette: string[] | undefined
  allowedOrigins: string[]
  dialogTimeoutMs: number
}

const CHROME_PRESETS: readonly ChromePreset[] = ['full', 'minimal', 'none']
const DEFAULT_DIALOG_TIMEOUT_MS = 30000

export function parseEmbedURLParams (params: URLSearchParams): EmbedURLParams {
  const embedRaw = params.get('embed')
  const embedMode = embedRaw === '1' || embedRaw === 'true'

  const chromeRaw = params.get('chrome')
  const chrome = chromeRaw && (CHROME_PRESETS as readonly string[]).includes(chromeRaw)
    ? chromeRaw as ChromePreset
    : undefined

  const themeRaw = params.get('theme')
  const theme = themeRaw && themeRaw.length > 0 ? themeRaw : undefined

  const paletteRaw = params.get('palette')
  const paletteList = (paletteRaw ?? '').split(',').map(c => c.trim()).filter(c => c.length > 0)
  const palette = paletteList.length > 0 ? paletteList : undefined

  const allowedOrigins = parseAllowedOrigins(params.get('allowedOrigins') ?? '')

  const timeoutRaw = params.get('dialogTimeout')
  const timeoutParsed = timeoutRaw === null ? NaN : Number(timeoutRaw)
  const dialogTimeoutMs = Number.isInteger(timeoutParsed) && timeoutParsed > 0
    ? timeoutParsed
    : DEFAULT_DIALOG_TIMEOUT_MS

  return { embedMode, chrome, theme, palette, allowedOrigins, dialogTimeoutMs }
}
