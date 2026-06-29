// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { SvgEditEmbed } from '../../src/embed/client.js'
import type { EmbedEnvelope, EmbedDialogResponse } from '../../src/embed/protocol.js'

const buildIframe = (src = 'https://editor.test/') => {
  document.body.replaceChildren()
  const iframe = document.createElement('iframe')
  iframe.id = 'svge'
  iframe.src = src
  document.body.appendChild(iframe)
  Object.defineProperty(iframe, 'contentWindow', { value: window, configurable: true })
  return iframe
}

describe('SvgEditEmbed — constructor + ready', () => {
  let iframe: HTMLIFrameElement
  beforeEach(() => {
    iframe = buildIframe()
  })

  it('does not throw with default options', () => {
    expect(() => new SvgEditEmbed(iframe, {})).not.toThrow()
  })

  it('exposes a ready Promise that resolves on ready event', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready',
                payload: { version: '7.4.1', protocolVersion: 1, capabilities: ['chrome', 'theme', 'dialog-hooks'] } },
        origin: 'https://editor.test',
        source: iframe.contentWindow
      }))
    }, 0)
    const payload = await client.ready
    expect(payload.version).toBe('7.4.1')
    expect(payload.protocolVersion).toBe(1)
    client.dispose()
  })

  it('rejects ready if protocolVersion mismatches', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready',
                payload: { version: '8.0.0', protocolVersion: 2, capabilities: [] } },
        origin: 'https://editor.test',
        source: iframe.contentWindow
      }))
    }, 0)
    await expect(client.ready).rejects.toThrow(/protocolVersion mismatch/)
    client.dispose()
  })

  it('drops messages from unauthorized origin', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '9.9.9', protocolVersion: 1, capabilities: [] } },
        origin: 'https://evil.com',
        source: iframe.contentWindow
      }))
      window.dispatchEvent(new MessageEvent('message', {
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: [] } },
        origin: 'https://editor.test',
        source: iframe.contentWindow
      }))
    }, 0)
    const payload = await client.ready
    expect(payload.version).toBe('7.4.1')
    client.dispose()
  })
})

const buildIframeWithStubPM = () => {
  document.body.replaceChildren()
  const iframe = document.createElement('iframe')
  iframe.id = 'svge'
  iframe.src = 'https://editor.test/'
  document.body.appendChild(iframe)
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true })
  return iframe
}

const fireReady = (iframe: HTMLIFrameElement, { capabilities = [] }: { capabilities?: string[] } = {}) => window.dispatchEvent(new MessageEvent('message', {
  data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities } },
  origin: 'https://editor.test',
  source: iframe.contentWindow
}))

describe('SvgEditEmbed — Proxy method dispatch', () => {
  let iframe: HTMLIFrameElement
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  it('Proxy forwards method calls via postMessage with id correlation', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => fireReady(iframe), 0)
    await client.ready

    const callPromise = client.editor.getZoom!()

    expect(iframe.contentWindow!.postMessage).toHaveBeenCalled()
    const sentEnv = (iframe.contentWindow!.postMessage as unknown as Mock).mock.calls[0]![0]
    expect(sentEnv.kind).toBe('call')
    expect(sentEnv.method).toBe('getZoom')
    expect(sentEnv.args).toEqual([])

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'result', id: sentEnv.id, result: 1.5 },
      origin: 'https://editor.test',
      source: iframe.contentWindow
    }))

    const result = await callPromise
    expect(result).toBe(1.5)
    client.dispose()
  })

  it('Proxy rejects Promise on error reply', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(() => fireReady(iframe), 0)
    await client.ready

    const callPromise = client.editor.bogusMethod!()
    const sentEnv = (iframe.contentWindow!.postMessage as unknown as Mock).mock.calls[0]![0]
    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'error', id: sentEnv.id, message: 'method not found: bogusMethod', code: 'METHOD_NOT_FOUND' },
      origin: 'https://editor.test',
      source: iframe.contentWindow
    }))

    await expect(callPromise).rejects.toThrow(/method not found/)
    client.dispose()
  })

  it('queued calls before ready are flushed after ready resolves', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const callPromise = client.editor.getZoom!()

    expect(iframe.contentWindow!.postMessage).not.toHaveBeenCalled()

    fireReady(iframe)
    await client.ready

    expect(iframe.contentWindow!.postMessage).toHaveBeenCalled()
    const sentEnv = (iframe.contentWindow!.postMessage as unknown as Mock).mock.calls[0]![0]
    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'result', id: sentEnv.id, result: 2.0 },
      origin: 'https://editor.test',
      source: iframe.contentWindow
    }))
    expect(await callPromise).toBe(2.0)
    client.dispose()
  })
})

describe('SvgEditEmbed — event subscription', () => {
  let iframe: HTMLIFrameElement
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  it('on(name, handler) receives matching events', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const received: unknown[] = []
    client.on('save', (payload) => received.push(payload))

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'save', payload: { svgString: '<svg/>' } },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    expect(received).toEqual([{ svgString: '<svg/>' }])
    client.dispose()
  })

  it('off(name, handler) removes the subscription', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const received: unknown[] = []
    const handler = (payload: unknown) => received.push(payload)
    client.on('change', handler)
    client.off('change', handler)

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'change', payload: {} },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    expect(received).toEqual([])
    client.dispose()
  })

  it('once(name, handler) fires only once', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    let count = 0
    client.once('change', () => count += 1)

    const fire = () => window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'change', payload: {} },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    fire(); fire(); fire()
    expect(count).toBe(1)
    client.dispose()
  })

  it('multiple subscribers all receive the same event', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    let a = 0, b = 0
    client.on('change', () => a += 1)
    client.on('change', () => b += 1)

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'event', name: 'change', payload: {} },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    expect(a).toBe(1)
    expect(b).toBe(1)
    client.dispose()
  })
})

describe('SvgEditEmbed — dialog handlers', () => {
  let iframe: HTMLIFrameElement
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  it('setDialogHandler routes dialog-request to handler and posts response', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady(iframe)
    await client.ready

    client.setDialogHandler('prompt', async (text, def) => `${text}=${def}`)

    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'dialog-request', id: 99, dialog: 'prompt', args: ['name?', 'anon'] },
      origin: 'https://editor.test', source: iframe.contentWindow
    }))
    await new Promise(r => setTimeout(r, 10))

    const respEnv = (iframe.contentWindow!.postMessage as unknown as Mock).mock.calls
      .map((c: unknown[]) => c[0] as EmbedEnvelope).find((e: EmbedEnvelope): e is EmbedDialogResponse => e.kind === 'dialog-response' && e.id === 99)
    expect(respEnv).toBeDefined()
    expect(respEnv!.response).toBe('name?=anon')
    client.dispose()
  })

  it('setDialogHandler returns an unregister function', () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    const off = client.setDialogHandler('alert', async () => undefined)
    expect(typeof off).toBe('function')
    off()
    client.dispose()
  })
})

describe('SvgEditEmbed — convenience methods', () => {
  let iframe: HTMLIFrameElement
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  it('setTheme posts a __setTheme call', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady(iframe, { capabilities: ['chrome', 'theme'] })
    await client.ready

    void client.setTheme('dark')
    const sent = (iframe.contentWindow!.postMessage as unknown as Mock).mock.calls.map((c: unknown[]) => c[0] as EmbedEnvelope)
    expect(sent.some((e: EmbedEnvelope) => e.kind === 'call' && e.method === '__setTheme' && e.args[0] === 'dark')).toBe(true)
    client.dispose()
  })

  it('setChrome posts a __setChrome call with preset', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady(iframe, { capabilities: ['chrome', 'theme'] })
    await client.ready

    void client.setChrome('minimal')
    const sent = (iframe.contentWindow!.postMessage as unknown as Mock).mock.calls.map((c: unknown[]) => c[0] as EmbedEnvelope)
    expect(sent.some((e: EmbedEnvelope) => e.kind === 'call' && e.method === '__setChrome' && e.args[0] === 'minimal')).toBe(true)
    client.dispose()
  })

  it('setDialogTimeout posts a __setDialogTimeout call', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    fireReady(iframe, { capabilities: ['chrome', 'theme'] })
    await client.ready

    void client.setDialogTimeout(15000)
    const sent = (iframe.contentWindow!.postMessage as unknown as Mock).mock.calls.map((c: unknown[]) => c[0] as EmbedEnvelope)
    expect(sent.some((e: EmbedEnvelope) => e.kind === 'call' && e.method === '__setDialogTimeout' && e.args[0] === 15000)).toBe(true)
    client.dispose()
  })
})
