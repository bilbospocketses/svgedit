export const PROTOCOL_VERSION = 1

export type EmbedEventName =
  | 'ready' | 'change' | 'save' | 'selection-changed'
  | 'theme-changed' | 'extension-error' | 'error' | 'destroy'

export type ChromePreset = 'full' | 'minimal' | 'none'

export type ChromeState = {
  menu?: boolean
  toolbox?: boolean
  layers?: boolean
  palette?: boolean
  statusbar?: boolean
  header?: boolean
}

export const ERROR_CODES = {
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  PROTOCOL_VERSION_MISMATCH: 'PROTOCOL_VERSION_MISMATCH',
  DIALOG_HANDLER_TIMEOUT: 'DIALOG_HANDLER_TIMEOUT'
} as const
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

export type EmbedCall =
  { ns: 'svgedit'; v: 1; kind: 'call'; id: number; method: string; args: unknown[] }
export type EmbedResult =
  { ns: 'svgedit'; v: 1; kind: 'result'; id: number; result: unknown }
export type EmbedError =
  { ns: 'svgedit'; v: 1; kind: 'error'; id: number; message: string; stack?: string; code?: string }
export type EmbedEvent =
  { ns: 'svgedit'; v: 1; kind: 'event'; name: EmbedEventName; payload: unknown }
export type EmbedDialogRequest =
  { ns: 'svgedit'; v: 1; kind: 'dialog-request'; id: number; dialog: 'prompt' | 'alert' | 'confirm'; args: unknown[] }
export type EmbedDialogResponse =
  { ns: 'svgedit'; v: 1; kind: 'dialog-response'; id: number; response: unknown }

export type EmbedEnvelope =
  | EmbedCall | EmbedResult | EmbedError | EmbedEvent | EmbedDialogRequest | EmbedDialogResponse

export type ElementHandle = { __svgeditHandle: string }
export function isElementHandle (v: unknown): v is ElementHandle {
  return typeof v === 'object' && v !== null && typeof (v as { __svgeditHandle?: unknown }).__svgeditHandle === 'string'
}

export type ReadyPayload = {
  version: string
  protocolVersion: number
  capabilities: string[]
}

const KINDS = new Set(['call', 'result', 'error', 'event', 'dialog-request', 'dialog-response'])

export function isValidEnvelope (env: unknown): env is EmbedEnvelope {
  if (typeof env !== 'object' || env === null) return false
  const e = env as Record<string, unknown>
  if (e.ns !== 'svgedit') return false
  if (e.v !== 1) return false
  if (typeof e.kind !== 'string' || !KINDS.has(e.kind)) return false
  switch (e.kind) {
    case 'call':
      return typeof e.id === 'number' && typeof e.method === 'string' && Array.isArray(e.args)
    case 'result':
      return typeof e.id === 'number' && 'result' in e
    case 'error':
      return typeof e.id === 'number' && typeof e.message === 'string'
    case 'event':
      return typeof e.name === 'string' && 'payload' in e
    case 'dialog-request':
      return typeof e.id === 'number' && (e.dialog === 'prompt' || e.dialog === 'alert' || e.dialog === 'confirm') && Array.isArray(e.args)
    case 'dialog-response':
      return typeof e.id === 'number' && 'response' in e
    default:
      return false
  }
}
