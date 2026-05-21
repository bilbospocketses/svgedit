// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SvgEditEmbed } from '../../src/embed/client.js'

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
  let iframe
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
        data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: [] } },
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

describe('SvgEditEmbed — Proxy method dispatch', () => {
  let iframe
  beforeEach(() => {
    iframe = buildIframeWithStubPM()
  })

  const fireReady = () => window.dispatchEvent(new MessageEvent('message', {
    data: { ns: 'svgedit', v: 1, kind: 'event', name: 'ready', payload: { version: '7.4.1', protocolVersion: 1, capabilities: [] } },
    origin: 'https://editor.test',
    source: iframe.contentWindow
  }))

  it('Proxy forwards method calls via postMessage with id correlation', async () => {
    const client = new SvgEditEmbed(iframe, { allowedOrigins: ['https://editor.test'] })
    setTimeout(fireReady, 0)
    await client.ready

    const callPromise = client.editor.getZoom()

    expect(iframe.contentWindow.postMessage).toHaveBeenCalled()
    const sentEnv = iframe.contentWindow.postMessage.mock.calls[0][0]
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
    setTimeout(fireReady, 0)
    await client.ready

    const callPromise = client.editor.bogusMethod()
    const sentEnv = iframe.contentWindow.postMessage.mock.calls[0][0]
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
    const callPromise = client.editor.getZoom()

    expect(iframe.contentWindow.postMessage).not.toHaveBeenCalled()

    fireReady()
    await client.ready

    expect(iframe.contentWindow.postMessage).toHaveBeenCalled()
    const sentEnv = iframe.contentWindow.postMessage.mock.calls[0][0]
    window.dispatchEvent(new MessageEvent('message', {
      data: { ns: 'svgedit', v: 1, kind: 'result', id: sentEnv.id, result: 2.0 },
      origin: 'https://editor.test',
      source: iframe.contentWindow
    }))
    expect(await callPromise).toBe(2.0)
    client.dispose()
  })
})
