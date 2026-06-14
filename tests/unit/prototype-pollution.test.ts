/**
 * Prototype-pollution / inherited-key regression tests.
 *  - #4:  mergeDeep must ignore __proto__/constructor/prototype keys so a crafted
 *         (JSON-parsed) source cannot reassign the merged object's prototype or
 *         plant a bogus own `constructor`.
 *  - #43: ConfigObj.setConfig must not treat inherited Object/Function members
 *         (toString, valueOf, __proto__, …) as known prefs via truthiness.
 */
import { describe, expect, it } from 'vitest'
import { mergeDeep } from '../../packages/svgcanvas/common/util.js'
import ConfigObj from '../../src/editor/ConfigObj.js'

describe('mergeDeep — prototype-pollution guard (#4)', () => {
  it('ignores __proto__ keys (no reassigned result prototype, no global pollution)', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}}')
    const out = mergeDeep({ a: 1 }, malicious) as Record<string, unknown>
    expect(out.polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('does not plant a bogus own constructor from a constructor key', () => {
    const malicious = JSON.parse('{"constructor": {"prototype": {"polluted": "yes"}}}')
    const out = mergeDeep({}, malicious)
    expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('still merges ordinary nested keys', () => {
    expect(mergeDeep({ a: { x: 1 } }, { a: { y: 2 }, b: 3 }))
      .toEqual({ a: { x: 1, y: 2 }, b: 3 })
  })
})

describe('ConfigObj.setConfig — inherited-key allowlist bypass (#43)', () => {
  const stubEditor = (): unknown => ({
    storage: {
      map: new Map<string, unknown>(),
      getItem (k: string) { return (this.map as Map<string, unknown>).get(k) },
      setItem (k: string, v: unknown) { (this.map as Map<string, unknown>).set(k, v) }
    },
    loadFromDataURI: () => {},
    loadFromString: () => {},
    loadFromURL: () => {}
  })

  it('does not treat inherited Object/Function members as known prefs', () => {
    const cfg = new ConfigObj(stubEditor() as never)
    cfg.setConfig({ toString: 'evil', valueOf: 'evil', hasOwnProperty: 'evil' })
    expect(Object.prototype.hasOwnProperty.call(cfg.curPrefs, 'toString')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(cfg.curPrefs, 'valueOf')).toBe(false)
    expect(typeof cfg.curPrefs.toString).toBe('function') // still the real method
  })

  it('does not let a __proto__ key reassign curPrefs prototype', () => {
    const cfg = new ConfigObj(stubEditor() as never)
    cfg.setConfig(JSON.parse('{"__proto__": {"polluted": "yes"}}'))
    expect(Object.getPrototypeOf(cfg.curPrefs)).toBe(Object.prototype)
    expect((cfg.curPrefs as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('still accepts a real pref', () => {
    const cfg = new ConfigObj(stubEditor() as never)
    cfg.setConfig({ lang: 'fr' }, { allowInitialUserOverride: true })
    expect(cfg.defaultPrefs.lang).toBe('fr')
  })
})
