import { describe, expect, test } from 'vitest'
import { putLocale, t } from '../src/editor/locale.js'

describe('locale shim (English-only)', () => {
  test('putLocale resolves with langParam "en" and an i18next-compat facade', async () => {
    const result = await putLocale()
    expect(result.langParam).toBe('en')
    expect(typeof result.i18next.t).toBe('function')
    expect(typeof result.i18next.addResourceBundle).toBe('function')
  })

  test('t looks up dotted keys in the default bundle', () => {
    expect(t('common.ok')).toBe('OK')
    expect(t('common.cancel')).toBe('Cancel')
    expect(t('misc.powered_by')).toBe('Powered by')
  })

  test('t returns the key itself for unknown paths', () => {
    expect(t('does.not.exist')).toBe('does.not.exist')
    expect(t('common.does_not_exist')).toBe('common.does_not_exist')
  })

  test('t interpolates {{var}} placeholders when vars are passed', () => {
    expect(t('notification.saveFromBrowser', { type: 'SVG' }))
      .toContain('SVG')
    expect(t('config.pick_paint_opavity', { newValue: 'Stroke' }))
      .toBe('Pick a Stroke Paint and Opacity')
  })

  test('t leaves unmatched placeholders intact when vars are missing', () => {
    expect(t('config.pick_paint_opavity'))
      .toBe('Pick a {{newValue}} Paint and Opacity')
  })

  test('t supports namespace lookups via "ns:key" after addResourceBundle', async () => {
    const { i18next } = await putLocale()
    i18next.addResourceBundle('en', 'demo', { greet: 'Hello {{who}}' })
    expect(t('demo:greet', { who: 'World' })).toBe('Hello World')
  })

  test('t passes non-string keys through (defensive)', () => {
    expect(t(42)).toBe(42)
    expect(t(null)).toBe(null)
  })
})
