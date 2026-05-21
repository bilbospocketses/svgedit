import { PROTOCOL_VERSION, isValidEnvelope } from './protocol.js'
import type { ReadyPayload } from './protocol.js'
import { isOriginAllowed } from './origin.js'

export type SvgEditEmbedOptions = {
  allowedOrigins?: string[]
}

export class SvgEditEmbed {
  protected readonly iframe: HTMLIFrameElement
  protected readonly allowedOrigins: readonly string[]
  private listener: ((e: MessageEvent) => void) | null = null
  private readonly _ready: Promise<ReadyPayload>
  private _resolveReady!: (p: ReadyPayload) => void
  private _rejectReady!: (e: Error) => void

  constructor (iframe: HTMLIFrameElement, opts: SvgEditEmbedOptions = {}) {
    this.iframe = iframe
    this.allowedOrigins = opts.allowedOrigins ?? [new URL(iframe.src, window.location.href).origin]

    this._ready = new Promise<ReadyPayload>((resolve, reject) => {
      this._resolveReady = resolve
      this._rejectReady = reject
    })

    this.listener = (e: MessageEvent) => this.handleMessage(e)
    window.addEventListener('message', this.listener)
  }

  get ready (): Promise<ReadyPayload> { return this._ready }

  protected handleMessage (e: MessageEvent): void {
    if (e.source !== this.iframe.contentWindow) return
    if (!isOriginAllowed(e.origin, this.allowedOrigins)) {
      console.warn(`SvgEditEmbed: rejected message from unauthorized origin: ${e.origin}`)
      return
    }
    if (!isValidEnvelope(e.data)) return
    const env = e.data
    if (env.kind === 'event' && env.name === 'ready') {
      const payload = env.payload as ReadyPayload
      if (payload.protocolVersion !== PROTOCOL_VERSION) {
        this._rejectReady(new Error(`svgedit embed: protocolVersion mismatch — host expects ${PROTOCOL_VERSION}, editor reports ${payload.protocolVersion}`))
        return
      }
      this._resolveReady(payload)
    }
  }

  dispose (): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
  }
}
