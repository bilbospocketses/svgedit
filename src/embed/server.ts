import { PROTOCOL_VERSION } from './protocol.ts'
import { parseEmbedURLParams } from './url-params.ts'
import { applyChrome, resolveChromePreset } from './chrome.ts'
import { applyTheme } from './theme.ts'

export type EmbedServerOptions = {
  detectEmbedMode?: (params: { embedMode: boolean }) => boolean
  allowedOrigins?: string[]
  dialogTimeoutMs?: number
}

export class EmbedServer {
  protected readonly editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>
  protected readonly allowedOrigins: readonly string[]
  protected dialogTimeoutMs: number
  private listener: ((e: MessageEvent) => void) | null = null

  constructor (editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>, opts: EmbedServerOptions = {}) {
    this.editor = editor
    const params = parseEmbedURLParams(new URLSearchParams(window.location.search))
    const embedMode = opts.detectEmbedMode
      ? opts.detectEmbedMode(params)
      : params.embedMode || window.parent !== window
    this.allowedOrigins = opts.allowedOrigins ?? params.allowedOrigins
    this.dialogTimeoutMs = opts.dialogTimeoutMs ?? params.dialogTimeoutMs

    if (!embedMode) return

    if (params.chrome) applyChrome(document.body, resolveChromePreset(params.chrome))
    else applyChrome(document.body, resolveChromePreset('none'))

    if (params.theme) applyTheme(document.body, params.theme)

    this.listener = (e: MessageEvent) => this.handleMessage(e)
    window.addEventListener('message', this.listener)
  }

  protected handleMessage (_e: MessageEvent): void {
    // Filled in by Task 7
  }

  dispose (): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
  }

  get _allowedOriginsForTest (): readonly string[] { return this.allowedOrigins }
}

export const _protocolVersion = PROTOCOL_VERSION
export type { ReadyPayload } from './protocol.ts'
