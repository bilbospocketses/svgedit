import { PROTOCOL_VERSION, isValidEnvelope } from './protocol.js'
import type { ReadyPayload, EmbedEventName } from './protocol.js'
import { isOriginAllowed } from './origin.js'

export type SvgEditEmbedOptions = {
  allowedOrigins?: string[]
}

type EventHandler = (payload: unknown) => void
type DialogKind = 'prompt' | 'alert' | 'confirm'
type DialogHandler = (text: string, defaultValue?: string) => Promise<unknown>

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
  private readonly eventHandlers: Map<EmbedEventName, Set<EventHandler>> = new Map()
  private readonly dialogHandlers: Map<DialogKind, DialogHandler> = new Map()

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
      this.dispatchEvent('ready', payload)
      while (this.callQueue.length > 0) {
        const q = this.callQueue.shift()
        if (q) this.dispatchCall(q.method, q.args, q.resolve, q.reject)
      }
      return
    }
    if (env.kind === 'event') {
      this.dispatchEvent(env.name, env.payload)
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
    if (env.kind === 'dialog-request') {
      void this.handleDialogRequest(env)
      return
    }
  }

  on (name: EmbedEventName, handler: EventHandler): () => void {
    let set = this.eventHandlers.get(name)
    if (!set) {
      set = new Set()
      this.eventHandlers.set(name, set)
    }
    set.add(handler)
    return () => this.off(name, handler)
  }

  off (name: EmbedEventName, handler: EventHandler): void {
    this.eventHandlers.get(name)?.delete(handler)
  }

  once (name: EmbedEventName, handler: EventHandler): () => void {
    const wrapped = (payload: unknown) => {
      this.off(name, wrapped)
      handler(payload)
    }
    return this.on(name, wrapped)
  }

  private dispatchEvent (name: EmbedEventName, payload: unknown): void {
    this.eventHandlers.get(name)?.forEach(h => h(payload))
  }

  setDialogHandler (kind: DialogKind, handler: DialogHandler): () => void {
    this.dialogHandlers.set(kind, handler)
    void this.call('__registerDialogHandler', [kind])
    return () => {
      this.dialogHandlers.delete(kind)
      void this.call('__unregisterDialogHandler', [kind])
    }
  }

  private async handleDialogRequest (env: { id: number; dialog: DialogKind; args: unknown[] }): Promise<void> {
    const handler = this.dialogHandlers.get(env.dialog)
    if (!handler) return
    const response = await handler(env.args[0] as string, env.args[1] as string | undefined)
    const respEnv = { ns: 'svgedit' as const, v: 1 as const, kind: 'dialog-response' as const, id: env.id, response }
    const cw = this.iframe.contentWindow
    if (cw) {
      cw.postMessage(respEnv, new URL(this.iframe.src, window.location.href).origin)
    }
  }

  dispose (): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
  }
}
