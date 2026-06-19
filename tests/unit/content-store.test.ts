import { describe, it, expect } from 'vitest'
import { contentStorageKey, titleStorageKey, saveSvgContent } from '../../src/editor/extensions/ext-storage/content-store.js'

function makeStorage () {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) }
  }
}

describe('ext-storage content-store (#52 — title key mismatch)', () => {
  it('saves and reads the title back under the same key', () => {
    const storage = makeStorage()
    saveSvgContent(storage, 'mydoc', '<svg/>', 'My Drawing')
    expect(storage.getItem(contentStorageKey('mydoc'))).toBe('<svg/>')
    expect(storage.getItem(titleStorageKey('mydoc'))).toBe('My Drawing')
  })

  it('clearing the content also removes the stored title (no stale title left behind)', () => {
    const storage = makeStorage()
    saveSvgContent(storage, 'mydoc', '<svg/>', 'My Drawing')
    saveSvgContent(storage, 'mydoc', '', 'My Drawing')
    expect(storage.getItem(contentStorageKey('mydoc'))).toBeNull()
    expect(storage.getItem(titleStorageKey('mydoc'))).toBeNull()
  })
})
