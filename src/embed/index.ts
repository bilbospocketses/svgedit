// src/embed/index.ts
export { SvgEditEmbed } from './client.js'
export type { SvgEditEmbedOptions } from './client.js'
export { PROTOCOL_VERSION, ERROR_CODES } from './protocol.js'
export type {
  EmbedEnvelope, EmbedEventName, ReadyPayload, ChromeState, ChromePreset, ElementHandle
} from './protocol.js'
export { DEFAULT_PALETTE } from './palette-defaults.js'
