import { parseAllowedOrigins } from './origin.ts'
import type { ChromePreset } from './protocol.ts'

export type EmbedURLParams = {
  embedMode: boolean
  chrome: ChromePreset | undefined
  theme: string | undefined
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

  const allowedOrigins = parseAllowedOrigins(params.get('allowedOrigins') ?? '')

  const timeoutRaw = params.get('dialogTimeout')
  const timeoutParsed = timeoutRaw === null ? NaN : Number(timeoutRaw)
  const dialogTimeoutMs = Number.isInteger(timeoutParsed) && timeoutParsed > 0
    ? timeoutParsed
    : DEFAULT_DIALOG_TIMEOUT_MS

  return { embedMode, chrome, theme, allowedOrigins, dialogTimeoutMs }
}
