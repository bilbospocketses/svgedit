// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbedServer } from '../../src/embed/server.ts'

const makeFakeEditor = () => ({
  svgCanvas: { getZoom: () => 1.5, clearSelection: vi.fn() }
})

describe('EmbedServer — constructor + listener setup', () => {
  let activeServer = null
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/')
    activeServer = null
  })
  afterEach(() => {
    if (activeServer) { activeServer.dispose(); activeServer = null }
  })

  it('does not attach when embedMode is false', () => {
    const editor = makeFakeEditor()
    const spy = vi.spyOn(window, 'addEventListener')
    new EmbedServer(editor, { detectEmbedMode: () => false })
    expect(spy).not.toHaveBeenCalledWith('message', expect.anything())
    spy.mockRestore()
  })

  it('attaches message listener when embedMode is true', () => {
    const editor = makeFakeEditor()
    const spy = vi.spyOn(window, 'addEventListener')
    activeServer = new EmbedServer(editor, { detectEmbedMode: () => true, allowedOrigins: ['https://host.test'] })
    expect(spy).toHaveBeenCalledWith('message', expect.any(Function))
    spy.mockRestore()
  })

  it('applies URL-param chrome state on init', () => {
    window.history.replaceState({}, '', '/?embed=1&chrome=minimal')
    const editor = makeFakeEditor()
    activeServer = new EmbedServer(editor)
    expect(document.body.classList.contains('embed')).toBe(true)
    expect(document.body.classList.contains('no-menu')).toBe(true)
    expect(document.body.classList.contains('no-toolbox')).toBe(false)
  })

  it('applies URL-param theme on init', () => {
    window.history.replaceState({}, '', '/?embed=1&theme=dark')
    const editor = makeFakeEditor()
    activeServer = new EmbedServer(editor)
    expect(document.body.classList.contains('theme-dark')).toBe(true)
  })

  it('applies URL-param palette on init via editor.setCustomPalette', () => {
    window.history.replaceState({}, '', '/?embed=1&palette=%23ff0000,none')
    const setCustomPalette = vi.fn()
    const editor = { svgCanvas: {}, setCustomPalette }
    activeServer = new EmbedServer(editor)
    expect(setCustomPalette).toHaveBeenCalledWith(['#ff0000', 'none'])
  })
})

describe('EmbedServer — call dispatch', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('dispatches call to svgCanvas method and replies with result', async () => {
    const editor = { svgCanvas: { getZoom: () => 1.5 } }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 1, method: 'getZoom', args: [] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(replies).toContainEqual({ ns: 'svgedit', v: 1, kind: 'result', id: 1, result: 1.5 })
    server.dispose()
  })

  it('replies with METHOD_NOT_FOUND error for unknown method', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 2, method: 'doesNotExist', args: [] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(replies.some(r => r.kind === 'error' && r.id === 2 && r.code === 'METHOD_NOT_FOUND')).toBe(true)
    server.dispose()
  })

  it('drops messages from unauthorized origin (no reply)', async () => {
    const editor = { svgCanvas: { getZoom: () => 1.5 } }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 3, method: 'getZoom', args: [] },
      origin: 'https://evil.com',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(replies).toEqual([])
    server.dispose()
  })

  it('serializes Element return value to handle object', async () => {
    const el = document.createElement('div')
    el.id = 'test-element'
    document.body.appendChild(el)
    const editor = { svgCanvas: { getElem: (id) => document.getElementById(id) } }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 4, method: 'getElem', args: ['test-element'] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    const result = replies.find(r => r.kind === 'result' && r.id === 4)
    expect(result).toBeDefined()
    expect(result.result).toMatchObject({ __svgeditHandle: expect.any(String) })
    server.dispose()
  })

  it('deserializes inbound handle object into Element argument', async () => {
    const el = document.createElement('div')
    el.id = 'handle-test'
    document.body.appendChild(el)
    let captured = null
    const editor = {
      svgCanvas: {
        takesElement: (arg) => { captured = arg; return 'ok' },
        getElem: (id) => document.getElementById(id)
      }
    }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 5, method: 'getElem', args: ['handle-test'] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))
    const handle = replies.find(r => r.id === 5).result

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 6, method: 'takesElement', args: [handle] },
      origin: 'https://host.test',
      source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(captured).toBe(el)
    server.dispose()
  })
})

describe('EmbedServer — event emission', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('emit() posts envelope to window.parent', () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    const sent = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => sent.push(env))
    server.emit('ready', { version: '7.4.1', protocolVersion: 1, capabilities: ['chrome'] })
    expect(sent).toContainEqual({
      ns: 'svgedit', v: 1, kind: 'event', name: 'ready',
      payload: { version: '7.4.1', protocolVersion: 1, capabilities: ['chrome'] }
    })
    server.dispose()
  })

  it('ready() helper emits ready event with declared capabilities', () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, { version: '7.4.1' })
    const sent = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => sent.push(env))
    server.ready()
    const readyEvent = sent.find(s => s.kind === 'event' && s.name === 'ready')
    expect(readyEvent).toBeDefined()
    expect(readyEvent.payload.protocolVersion).toBe(1)
    expect(readyEvent.payload.capabilities).toEqual(expect.arrayContaining(['chrome', 'theme', 'dialog-hooks', 'palette']))
    server.dispose()
  })
})

describe('EmbedServer — dialog hook', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('falls back to default alert handler when no host-registered handler', async () => {
    let internalCalled = false
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, {
      defaultDialogHandlers: {
        alert: async () => { internalCalled = true; return undefined },
        confirm: async () => true,
        prompt: async () => 'default-input'
      }
    })
    const result = await server.requestDialog('alert', ['hello'])
    expect(internalCalled).toBe(true)
    expect(result).toBeUndefined()
    server.dispose()
  })

  it('uses registered host handler via postMessage round-trip', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, {
      defaultDialogHandlers: {
        alert: async () => undefined,
        confirm: async () => true,
        prompt: async () => 'default'
      }
    })
    server.markHostHandlerRegistered('prompt')

    const sent = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => sent.push(env))

    const p = server.requestDialog('prompt', ['enter name', ''])

    const reqEnv = sent.find(s => s.kind === 'dialog-request' && s.dialog === 'prompt')
    expect(reqEnv).toBeDefined()

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'dialog-response', id: reqEnv.id, response: 'jamie' },
      origin: 'https://host.test',
      source: window
    }))

    const result = await p
    expect(result).toBe('jamie')
    server.dispose()
  })

  it('falls back to default if host handler times out', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor, {
      dialogTimeoutMs: 50,
      defaultDialogHandlers: {
        alert: async () => undefined,
        confirm: async () => true,
        prompt: async () => 'TIMED-OUT-FALLBACK'
      }
    })
    server.markHostHandlerRegistered('prompt')

    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const result = await server.requestDialog('prompt', ['enter name', ''])
    expect(result).toBe('TIMED-OUT-FALLBACK')
    server.dispose()
  })
})

describe('EmbedServer — control messages', () => {
  beforeEach(() => {
    document.body.className = ''
    window.history.replaceState({}, '', '/?embed=1&allowedOrigins=https://host.test')
  })

  it('__registerDialogHandler marks handler registered', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 100, method: '__registerDialogHandler', args: ['prompt'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(server._isHostHandlerRegistered('prompt')).toBe(true)
    server.dispose()
  })

  it('__unregisterDialogHandler unmarks it', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    server.markHostHandlerRegistered('alert')

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 101, method: '__unregisterDialogHandler', args: ['alert'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(server._isHostHandlerRegistered('alert')).toBe(false)
    server.dispose()
  })

  it('__setTheme applies theme via theme module', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 102, method: '__setTheme', args: ['dark'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(document.body.classList.contains('theme-dark')).toBe(true)
    server.dispose()
  })

  it('__setChrome with preset string applies preset', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 103, method: '__setChrome', args: ['minimal'] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(document.body.classList.contains('no-menu')).toBe(true)
    expect(document.body.classList.contains('no-toolbox')).toBe(false)
    server.dispose()
  })

  it('__setChrome with object applies per-element state', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 104, method: '__setChrome', args: [{ menu: true }] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(document.body.classList.contains('no-menu')).toBe(false)
    server.dispose()
  })

  it('__setPalette forwards args to editor.setCustomPalette and replies', async () => {
    const setCustomPalette = vi.fn()
    const editor = { svgCanvas: {}, setCustomPalette }
    const server = new EmbedServer(editor)
    const replies = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((env) => replies.push(env))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 106, method: '__setPalette', args: [['#ff0000', 'none']] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(setCustomPalette).toHaveBeenCalledWith(['#ff0000', 'none'])
    expect(replies).toContainEqual({ ns: 'svgedit', v: 1, kind: 'result', id: 106, result: null })
    server.dispose()
  })

  it('__setDialogTimeout updates timeout (positive integer only)', async () => {
    const editor = { svgCanvas: {} }
    const server = new EmbedServer(editor)
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'call', id: 105, method: '__setDialogTimeout', args: [5000] },
      origin: 'https://host.test', source: window
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(server._dialogTimeoutForTest()).toBe(5000)
    server.dispose()
  })
})
