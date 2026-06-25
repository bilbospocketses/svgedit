import ConfigObj, { regexEscape } from '../../src/editor/ConfigObj.js'

describe('ConfigObj', () => {
  const stubEditor = () => ({
    storage: {
      map: new Map(),
      getItem (k) { return this.map.get(k) },
      setItem (k, v) { this.map.set(k, v) }
    },
    loadFromDataURI: () => { stubEditor.loaded = 'data' },
    loadFromString: () => { stubEditor.loaded = 'string' },
    loadFromURL: () => { stubEditor.loaded = 'url' }
  })

  it('escapes regex characters', () => {
    expect(regexEscape('a+b?')).toBe('a\\+b\\?')
  })

  it('merges defaults and respects allowInitialUserOverride', () => {
    const editor = stubEditor()
    const cfg = new ConfigObj(editor)
    cfg.setConfig({ gridSnapping: true, userExtensions: ['custom'] })
    cfg.setupCurConfig()

    expect(cfg.curConfig.gridSnapping).toBe(true)
    expect(cfg.curConfig.extensions).toContain('ext-grid')
    expect(cfg.curConfig.extensions.includes('custom') || cfg.curConfig.userExtensions.includes('custom')).toBe(true)

    cfg.setConfig({ lang: 'fr' }, { allowInitialUserOverride: true })
    expect(cfg.defaultPrefs.lang).toBe('fr')
  })

  it('prefers existing values when overwrite is false', () => {
    const editor = stubEditor()
    const cfg = new ConfigObj(editor)
    cfg.curConfig.preventAllURLConfig = true
    cfg.curPrefs.lang = 'es'

    cfg.setConfig({ lang: 'de', gridColor: '#fff', extensions: ['x'] }, { overwrite: false })
    expect(cfg.curPrefs.lang).toBe('es')
    expect(cfg.curConfig.gridColor).toBeUndefined()
    expect(cfg.curConfig.extensions).toEqual([])
  })

  it('honors per-branch skip conditions with overwrite:false (no preventAllURLConfig)', () => {
    const cfg = new ConfigObj(stubEditor())
    // Pre-set values that each branch's guard should refuse to overwrite.
    cfg.curPrefs.lang = 'es' // pref already set -> pref branch skips
    cfg.curConfig.gridColor = '#abc' // config own-prop set -> config branch skips
    cfg.curConfig.lockExtensions = true // extensions locked -> array branch skips

    cfg.setConfig({
      lang: 'de',
      gridColor: '#fff',
      extensions: ['x'],
      allowedOrigins: ['https://evil.example'] // allowedOrigins always skipped on overwrite:false
    }, { overwrite: false })

    expect(cfg.curPrefs.lang).toBe('es')
    expect(cfg.curConfig.gridColor).toBe('#abc')
    expect(cfg.curConfig.extensions).not.toContain('x')
    expect(cfg.curConfig.allowedOrigins ?? []).not.toContain('https://evil.example')
  })
})
