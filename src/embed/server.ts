// src/embed/server.ts
import { PROTOCOL_VERSION, isValidEnvelope, isElementHandle, ERROR_CODES } from './protocol.js'
import type { EmbedEnvelope, EmbedCall, ElementHandle, ChromeState, ChromePreset } from './protocol.js'
import { isOriginAllowed } from './origin.js'
import { parseEmbedURLParams } from './url-params.js'
import { applyChrome, resolveChromePreset } from './chrome.js'
import { applyTheme, resolveInitialTheme } from './theme.js'

export type DialogKind = 'prompt' | 'alert' | 'confirm'
export type DialogHandlers = {
  prompt: (text: string, defaultValue: string) => Promise<string | null>
  alert: (text: string) => Promise<void>
  confirm: (text: string) => Promise<boolean>
}

export type EmbedServerOptions = {
  detectEmbedMode?: (params: { embedMode: boolean }) => boolean
  allowedOrigins?: string[]
  dialogTimeoutMs?: number
  version?: string
  defaultDialogHandlers?: DialogHandlers
}

let handleCounter = 0
const handleMap = new WeakMap<Element, string>()
const reverseHandleMap = new Map<string, Element>()

function allocateHandle (el: Element): ElementHandle {
  let key = handleMap.get(el)
  if (!key) {
    handleCounter += 1
    key = `el-${handleCounter}`
    handleMap.set(el, key)
    reverseHandleMap.set(key, el)
  }
  return { __svgeditHandle: key }
}

function resolveHandle (h: ElementHandle): Element | undefined {
  return reverseHandleMap.get(h.__svgeditHandle)
}

function serializeForPostMessage (v: unknown): unknown {
  if (v instanceof Element) return allocateHandle(v)
  if (Array.isArray(v)) return v.map(serializeForPostMessage)
  if (v && typeof v === 'object' && !isElementHandle(v)) {
    const proto: unknown = Object.getPrototypeOf(v)
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {}
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        out[k] = serializeForPostMessage(vv)
      }
      return out
    }
  }
  return v
}

function deserializeArg (v: unknown): unknown {
  if (isElementHandle(v)) {
    const el = resolveHandle(v)
    if (!el) {
      throw Object.assign(new Error(`element handle not found: ${v.__svgeditHandle}`), { code: ERROR_CODES.ELEMENT_NOT_FOUND })
    }
    return el
  }
  if (Array.isArray(v)) return v.map(deserializeArg)
  if (v && typeof v === 'object') {
    const proto: unknown = Object.getPrototypeOf(v)
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {}
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        out[k] = deserializeArg(vv)
      }
      return out
    }
  }
  return v
}

export class EmbedServer {
  protected readonly editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>
  protected readonly allowedOrigins: readonly string[]
  protected dialogTimeoutMs: number
  protected readonly version: string
  private listener: ((e: MessageEvent) => void) | null = null
  private readonly defaultDialogHandlers: DialogHandlers
  private readonly hostHandlersRegistered: Set<DialogKind> = new Set()
  private readonly pendingDialogReplies: Map<number, (response: unknown) => void> = new Map()
  private dialogIdCounter = 0

  constructor (editor: { svgCanvas: Record<string, unknown> } & Record<string, unknown>, opts: EmbedServerOptions = {}) {
    this.editor = editor
    const params = parseEmbedURLParams(new URLSearchParams(window.location.search))
    const embedMode = opts.detectEmbedMode
      ? opts.detectEmbedMode(params)
      : params.embedMode || window.parent !== window
    const resolvedOrigins = opts.allowedOrigins ?? params.allowedOrigins
    this.allowedOrigins = resolvedOrigins.length > 0 ? resolvedOrigins : [window.location.origin]
    this.dialogTimeoutMs = opts.dialogTimeoutMs ?? params.dialogTimeoutMs
    this.version = opts.version ?? '0.0.0-unknown'
    this.defaultDialogHandlers = opts.defaultDialogHandlers ?? {
      alert: (msg) => { window.alert(msg); return Promise.resolve() },
      confirm: (msg) => Promise.resolve(window.confirm(msg)),
      prompt: (msg, def) => Promise.resolve(window.prompt(msg, def))
    }

    if (!embedMode) return

    if (params.chrome) applyChrome(document.body, resolveChromePreset(params.chrome))
    else applyChrome(document.body, resolveChromePreset('none'))

    if (params.theme) applyTheme(resolveInitialTheme(params.theme))

    if (params.palette) this.callEditorPalette(params.palette)

    this.listener = (e: MessageEvent) => { void this.handleMessage(e) }
    window.addEventListener('message', this.listener)
  }

  protected async handleMessage (e: MessageEvent): Promise<void> {
    if (!isOriginAllowed(e.origin, this.allowedOrigins)) {
      console.warn(`EmbedServer: rejected message from unauthorized origin: ${e.origin}`)
      return
    }
    if (!isValidEnvelope(e.data)) return

    const env = e.data
    switch (env.kind) {
      case 'call':
        await this.handleCall(env)
        return
      case 'dialog-response': {
        const resolve = this.pendingDialogReplies.get(env.id)
        if (resolve) {
          this.pendingDialogReplies.delete(env.id)
          resolve(env.response)
        }
        return
      }
      default:
        return
    }
  }

  protected async handleCall (env: EmbedCall): Promise<void> {
    if (env.method === '__registerDialogHandler') {
      this.markHostHandlerRegistered(env.args[0] as DialogKind)
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
      return
    }
    if (env.method === '__unregisterDialogHandler') {
      this.unmarkHostHandlerRegistered(env.args[0] as DialogKind)
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
      return
    }
    if (env.method === '__setTheme') {
      applyTheme(resolveInitialTheme(env.args[0] as string))
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
      return
    }
    if (env.method === '__setPalette') {
      this.callEditorPalette(env.args[0])
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
      return
    }
    if (env.method === '__setChrome') {
      const arg = env.args[0]
      const state: ChromeState = typeof arg === 'string'
        ? resolveChromePreset(arg as ChromePreset)
        : arg as ChromeState
      applyChrome(document.body, state)
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
      return
    }
    if (env.method === '__setDialogTimeout') {
      const ms = env.args[0]
      if (typeof ms === 'number' && Number.isInteger(ms) && ms > 0) {
        this.dialogTimeoutMs = ms
      }
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result: null })
      return
    }
    try {
      const target = this.editor.svgCanvas[env.method] !== undefined ? this.editor.svgCanvas : this.editor
      const fn = target[env.method]
      if (typeof fn !== 'function') {
        throw Object.assign(new Error(`method not found: ${env.method}`), { code: ERROR_CODES.METHOD_NOT_FOUND })
      }
      const deserializedArgs = env.args.map(deserializeArg)
      const raw = await (fn as (...args: unknown[]) => unknown).apply(target, deserializedArgs)
      const result = serializeForPostMessage(raw)
      this.reply({ ns: 'svgedit', v: 1, kind: 'result', id: env.id, result })
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      this.reply({
        ns: 'svgedit', v: 1, kind: 'error', id: env.id,
        message: error.message ?? String(err),
        ...(error.stack !== undefined && { stack: error.stack }),
        ...(error.code !== undefined && { code: error.code })
      })
    }
  }

  protected reply (env: EmbedEnvelope): void {
    const targetOrigin = this.allowedOrigins[0] === '*' ? '*' : (this.allowedOrigins[0] ?? window.location.origin)
    window.parent.postMessage(env, targetOrigin)
  }

  private callEditorPalette (colors: unknown): void {
    const ed = this.editor as Record<string, unknown>
    if (typeof ed.setCustomPalette === 'function') {
      (ed.setCustomPalette as (colors: unknown) => unknown)(colors)
    }
  }

  emit (name: import('./protocol.js').EmbedEventName, payload: unknown): void {
    this.reply({ ns: 'svgedit', v: 1, kind: 'event', name, payload })
  }

  ready (capabilities: string[] = ['chrome', 'theme', 'dialog-hooks', 'palette']): void {
    this.emit('ready', { version: this.version, protocolVersion: PROTOCOL_VERSION, capabilities })
  }

  markHostHandlerRegistered (kind: DialogKind): void { this.hostHandlersRegistered.add(kind) }
  unmarkHostHandlerRegistered (kind: DialogKind): void { this.hostHandlersRegistered.delete(kind) }
  _isHostHandlerRegistered (kind: DialogKind): boolean { return this.hostHandlersRegistered.has(kind) }
  _dialogTimeoutForTest (): number { return this.dialogTimeoutMs }

  async requestDialog (kind: DialogKind, args: unknown[]): Promise<unknown> {
    if (!this.hostHandlersRegistered.has(kind)) {
      return this.invokeDefaultDialog(kind, args)
    }
    this.dialogIdCounter += 1
    const id = this.dialogIdCounter
    const responsePromise = new Promise<unknown>((resolve) => {
      this.pendingDialogReplies.set(id, resolve)
    })
    this.reply({ ns: 'svgedit', v: 1, kind: 'dialog-request', id, dialog: kind, args })
    const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
      setTimeout(() => resolve({ timeout: true }), this.dialogTimeoutMs)
    )
    const winner = await Promise.race([responsePromise, timeoutPromise])
    if (typeof winner === 'object' && winner !== null && 'timeout' in winner) {
      this.pendingDialogReplies.delete(id)
      this.emit('error', { message: 'dialog handler timed out', source: 'dialog-handler-timeout' })
      return this.invokeDefaultDialog(kind, args)
    }
    return winner
  }

  private async invokeDefaultDialog (kind: DialogKind, args: unknown[]): Promise<unknown> {
    switch (kind) {
      case 'alert':   return this.defaultDialogHandlers.alert(args[0] as string)
      case 'confirm': return this.defaultDialogHandlers.confirm(args[0] as string)
      case 'prompt':  return this.defaultDialogHandlers.prompt(args[0] as string, (args[1] ?? '') as string)
    }
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
