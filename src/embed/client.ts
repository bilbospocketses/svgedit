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
  private readonly pendingCalls: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map()
  private callIdCounter = 0
  private readonly callQueue: Array<{ method: string; args: unknown[]; resolve: (v: unknown) => void; reject: (e: Error) => void }> = []
  private isReady = false

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

  get editor (): Record<string, (...args: unknown[]) => Promise<unknown>> {
    return new Proxy<Record<string, (...args: unknown[]) => Promise<unknown>>>({}, {
      get: (_target, prop: string) => (...args: unknown[]) => this.call(prop, args)
    })
  }

  protected call (method: string, args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.isReady) {
        this.callQueue.push({ method, args, resolve, reject })
        return
      }
      this.dispatchCall(method, args, resolve, reject)
    })
  }

  private dispatchCall (method: string, args: unknown[], resolve: (v: unknown) => void, reject: (e: Error) => void): void {
    this.callIdCounter += 1
    const id = this.callIdCounter
    this.pendingCalls.set(id, { resolve, reject })
    const env = { ns: 'svgedit' as const, v: 1 as const, kind: 'call' as const, id, method, args }
    const cw = this.iframe.contentWindow
    if (cw) {
      cw.postMessage(env, new URL(this.iframe.src, window.location.href).origin)
    }
  }

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
      this.isReady = true
      this._resolveReady(payload)
      while (this.callQueue.length > 0) {
        const q = this.callQueue.shift()
        if (q) this.dispatchCall(q.method, q.args, q.resolve, q.reject)
      }
      return
    }
    if (env.kind === 'result') {
      const pending = this.pendingCalls.get(env.id)
      if (pending) {
        this.pendingCalls.delete(env.id)
        pending.resolve(env.result)
      }
      return
    }
    if (env.kind === 'error') {
      const pending = this.pendingCalls.get(env.id)
      if (pending) {
        this.pendingCalls.delete(env.id)
        const err = new Error(env.message)
        if (env.code) (err as unknown as Record<string, unknown>).code = env.code
        pending.reject(err)
      }
      return
    }
  }

  dispose (): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
  }
}
