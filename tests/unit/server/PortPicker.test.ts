// @vitest-environment node
import * as net from 'node:net'
import { describe, expect, it } from 'vitest'
import { findAvailablePort, tryPort, webPortOverride } from '../../../src/server/PortPicker.js'

describe('webPortOverride', () => {
  it('parses a valid port', () => {
    expect(webPortOverride('8100')).toBe(8100)
  })
  it('returns null for invalid input', () => {
    expect(webPortOverride(undefined)).toBeNull()
    expect(webPortOverride('')).toBeNull()
    expect(webPortOverride('0')).toBeNull()
    expect(webPortOverride('70000')).toBeNull()
    expect(webPortOverride('abc')).toBeNull()
  })
})

describe('tryPort / findAvailablePort', () => {
  it('reports a held port busy and finds the next free one', async () => {
    const blocker = net.createServer()
    const port = await new Promise<number>((resolve) => {
      blocker.listen(0, () => {
        const addr = blocker.address()
        resolve(typeof addr === 'object' && addr !== null ? addr.port : 0)
      })
    })
    try {
      expect(await tryPort(port)).toBe(false)
      const found = await findAvailablePort(port, port + 50)
      expect(found).not.toBeNull()
      expect(found).toBeGreaterThan(port)
    } finally {
      blocker.close()
    }
  })

  it('returns null when the range is invalid', async () => {
    expect(await findAvailablePort(9000, 8000)).toBeNull()
  })
})
