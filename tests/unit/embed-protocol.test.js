import { describe, expect, it } from 'vitest'
import { isValidEnvelope, PROTOCOL_VERSION } from '../../src/embed/protocol.ts'

describe('embed protocol', () => {
  it('PROTOCOL_VERSION is 1', () => {
    expect(PROTOCOL_VERSION).toBe(1)
  })

  it('isValidEnvelope accepts a well-formed call envelope', () => {
    const env = { ns: 'svgedit', v: 1, kind: 'call', id: 1, method: 'getZoom', args: [] }
    expect(isValidEnvelope(env)).toBe(true)
  })

  it('isValidEnvelope rejects foreign namespace', () => {
    const env = { ns: 'other', v: 1, kind: 'call', id: 1, method: 'x', args: [] }
    expect(isValidEnvelope(env)).toBe(false)
  })

  it('isValidEnvelope rejects missing fields', () => {
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'call' })).toBe(false)
    expect(isValidEnvelope(null)).toBe(false)
    expect(isValidEnvelope({})).toBe(false)
  })

  it('isValidEnvelope accepts each kind', () => {
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'result', id: 1, result: null })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'error', id: 1, message: 'x' })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: {} })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'dialog-request', id: 1, dialog: 'alert', args: ['hi'] })).toBe(true)
    expect(isValidEnvelope({ ns: 'svgedit', v: 1, kind: 'dialog-response', id: 1, response: null })).toBe(true)
  })
})
