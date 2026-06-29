import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../../src/editor/dialogs/imagePropertiesDialog.js'

const mount = async (): Promise<any> => {
  const el = document.createElement('se-img-prop-dialog') as any
  document.body.append(el)
  await el.updateComplete
  return el
}

describe('imagePropertiesDialog _onSave validation (#11, #12)', () => {
  beforeEach(() => { document.body.replaceChildren() })

  it('#11/#12: an invalid HEIGHT blocks the save dispatch (height must validate against h, not w)', async () => {
    const el = await mount()
    el._canvasWidth.value = '640'          // valid
    el._canvasHeight.value = 'not-a-size'  // invalid — but currently checked against width
    const spy = vi.fn()
    el.addEventListener('change', spy)
    el._onSave()
    expect(spy).not.toHaveBeenCalled()
  })

  it('valid dimensions still dispatch the save (#12 regression guard)', async () => {
    const el = await mount()
    el._canvasWidth.value = '640'
    el._canvasHeight.value = '480'
    const spy = vi.fn()
    el.addEventListener('change', spy)
    el._onSave()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
