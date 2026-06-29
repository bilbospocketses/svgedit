// @vitest-environment jsdom
// Embed RPC/origin hardening regressions (#28-#32).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbedServer } from '../../src/embed/server.js'
import { parseAllowedOrigins } from '../../src/embed/origin.js'

// Track every server so afterEach can dispose it even if an assertion throws first
// (a leaked 'message' listener would handle later tests' dispatches and corrupt them).
let servers: EmbedServer[] = []
const track = (s: EmbedServer): EmbedServer => { servers.push(s); return s }

const collectReplies = (): Array<{ env: any; origin: any }> => {
  const replies: Array<{ env: any; origin: any }> = []
  vi.spyOn(window.parent, 'postMessage').mockImplementation((env: any, origin: any) => { replies.push({ env, origin }) })
  return replies
}

const dispatchCall = (id: number, method: string, args: unknown[], origin = 'https://host.test'): Promise<void> => {
  window.dispatchEvent(new MessageEvent('message', {
    data: { ns: 'svgedit', v: 1, kind: 'call', id, method, args },
    origin,
    source: window
  }))
  return new Promise(r => setTimeout(r, 0))
}

describe('embed security', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })
  afterEach(() => {
    servers.forEach(s => s.dispose())
    servers = []
    vi.restoreAllMocks()
  })

  // ---- #29: URL-param allowedOrigins validation ----
  it('#29 parseAllowedOrigins drops "*" and malformed entries', () => {
    expect(parseAllowedOrigins('*,https://ok.test,not a url,https://a.test:8080'))
      .toEqual(['https://ok.test', 'https://a.test:8080'])
  })

  it('#29 a URL-param allowedOrigins=* does not make the server wildcard', () => {
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=*')
    const server = track(new EmbedServer({ svgCanvas: {} }))
    expect(server._allowedOriginsForTest).not.toContain('*')
  })

  it('#29 a programmatic opts.allowedOrigins=* is still honored (dev escape hatch)', () => {
    const server = track(new EmbedServer({ svgCanvas: {} }, { detectEmbedMode: () => true, allowedOrigins: ['*'] }))
    expect(server._allowedOriginsForTest).toContain('*')
  })

  // ---- #30: RPC dispatch denylist ----
  it('#30 rejects a "constructor" method call with METHOD_NOT_FOUND', async () => {
    track(new EmbedServer({ svgCanvas: {} }))
    const replies = collectReplies()
    await dispatchCall(1, 'constructor', [])
    const r = replies.map(x => x.env).find(e => e.id === 1)
    expect(r.kind).toBe('error')
    expect(r.code).toBe('METHOD_NOT_FOUND')
  })

  it('#30 rejects "__proto__" and "prototype" method calls', async () => {
    track(new EmbedServer({ svgCanvas: {} }))
    const replies = collectReplies()
    await dispatchCall(2, '__proto__', [])
    await dispatchCall(3, 'prototype', [])
    for (const id of [2, 3]) {
      const r = replies.map(x => x.env).find(e => e.id === id)
      expect(r.kind).toBe('error')
      expect(r.code).toBe('METHOD_NOT_FOUND')
    }
  })

  // ---- #31: proto-pollution guard in (de)serialize ----
  it('#31 a call arg cannot reassign the deserialized object prototype', async () => {
    let captured: any = null
    track(new EmbedServer({ svgCanvas: { take: (a: any) => { captured = a; return 'ok' } } }))
    collectReplies()
    const evilArg = JSON.parse('{"__proto__":{"polluted":true},"keep":1}')
    await dispatchCall(1, 'take', [evilArg])
    expect(captured).not.toBeNull()
    expect(captured.polluted).toBeUndefined()
    expect(Object.getPrototypeOf(captured)).toBe(Object.prototype)
    expect(captured.keep).toBe(1)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined() // no global pollution either
  })

  // ---- #28: reply targets the calling origin ----
  it('#28 posts a call result to the calling origin, not allowedOrigins[0]', async () => {
    track(new EmbedServer(
      { svgCanvas: { getZoom: () => 1.5 } },
      { detectEmbedMode: () => true, allowedOrigins: ['https://a.test', 'https://b.test'] }
    ))
    const replies = collectReplies()
    await dispatchCall(1, 'getZoom', [], 'https://b.test')
    const r = replies.find(x => x.env.id === 1 && x.env.kind === 'result')
    expect(r).toBeDefined()
    expect(r!.origin).toBe('https://b.test')
  })

  // ---- #32: element handles are instance-scoped ----
  it('#32 a handle allocated in one server does not resolve in another', async () => {
    const el = document.createElement('div'); el.id = 'h32'; document.body.appendChild(el)

    const serverA = track(new EmbedServer({ svgCanvas: { getElem: (id: string) => document.getElementById(id) } }))
    const repliesA = collectReplies()
    await dispatchCall(1, 'getElem', ['h32'])
    const handle = repliesA.find(x => x.env.id === 1)!.env.result
    expect(handle.__svgeditHandle).toBeDefined()
    serverA.dispose()

    let captured: any = 'unset'
    track(new EmbedServer({ svgCanvas: { take: (a: any) => { captured = a; return 'ok' } } }))
    const repliesB = collectReplies()
    await dispatchCall(2, 'take', [handle])
    const r = repliesB.find(x => x.env.id === 2)!.env
    expect(r.kind).toBe('error')
    expect(r.code).toBe('ELEMENT_NOT_FOUND')
    expect(captured).toBe('unset')
  })
})
