import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadExtension, type AddExtensionFn } from '../../src/editor/extensions/loadExtension.js'

describe('loadExtension (#36 F3 — per-extension load isolation)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes name, init and args through to addExtension on success', async () => {
    const addExtension = vi.fn<AddExtensionFn>(async () => {})
    const init = (): Record<string, never> => ({})
    await expect(
      loadExtension(addExtension, 'ext-ok', init, { langParam: 'en' }, 'ext-ok')
    ).resolves.toBeUndefined()
    expect(addExtension).toHaveBeenCalledTimes(1)
    expect(addExtension).toHaveBeenCalledWith('ext-ok', init, { langParam: 'en' })
  })

  it('isolates a rejecting extension: resolves and logs, never propagates', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('init boom')
    const addExtension = vi.fn<AddExtensionFn>(async () => {
      throw boom
    })
    // A failing extension must not abort sibling extensions or the post-load
    // extensions_added wiring; loadExtension swallows + logs it instead.
    await expect(
      loadExtension(addExtension, 'ext-bad', () => undefined, {}, 'ext-bad')
    ).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledWith('Extension failed to load: ext-bad; ', boom)
  })
})
