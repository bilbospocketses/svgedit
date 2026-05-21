// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
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
