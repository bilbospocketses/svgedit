/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import SvgCanvas from '@svgedit/svgcanvas'
import { isChrome } from '@svgedit/svgcanvas/common/browser.js'

const { $id, $click, convertUnit, isValidUnit } = SvgCanvas
const homePage = 'https://github.com/bilbospocketses/svgedit'

/** `seAlert` is a custom element dialog registered globally at runtime. */
declare function seAlert (msg: string): void

/** The editor instance — typed loosely to avoid circular reference. */
type EditorInstance = any

/**
 *
 */
class MainMenu {
  editor: EditorInstance

  /**
   * @param editor svgedit handler
   */
  constructor (editor: EditorInstance) {
    this.editor = editor
    /**
     */
    this.editor.exportWindowCt = 0
  }

  /**
   *
   */
  hideDocProperties (): void {
    const $imgDialog = $id('se-img-prop')
    if (!$imgDialog) return
    $imgDialog.setAttribute('dialog', 'close')
    $imgDialog.setAttribute('save', String(this.editor.configObj.pref('img_save') ?? ''))
    this.editor.docprops = false
  }

  /**
   *
   */
  hidePreferences (): void {
    const $editDialog = $id('se-edit-prefs')
    if (!$editDialog) return
    $editDialog.setAttribute('dialog', 'close')
    this.editor.configObj.preferences = false
  }

  /**
   * @param e
   * @returns Whether there were problems saving the document properties
   */
  saveDocProperties (e: any): boolean {
    // set title
    const { title, w, h, save } = e.detail
    // set document title
    this.editor.svgCanvas.setDocumentTitle(title)

    // @ts-expect-error: isValidUnit called with 2 args; pre-existing pattern — selectedElement optional in practice
    if (w !== 'fit' && !isValidUnit('width', w)) {
      seAlert(this.editor.i18next.t('notification.invalidAttrValGiven'))
      return false
    }
    // @ts-expect-error: isValidUnit called with 2 args; pre-existing pattern — selectedElement optional in practice
    if (h !== 'fit' && !isValidUnit('height', h)) {
      seAlert(this.editor.i18next.t('notification.invalidAttrValGiven'))
      return false
    }
    if (!this.editor.svgCanvas.setResolution(w, h)) {
      seAlert(this.editor.i18next.t('notification.noContentToFitTo'))
      return false
    }
    // Set image save option
    this.editor.configObj.pref('img_save', save)
    this.editor.updateCanvas()
    this.hideDocProperties()
    return true
  }

  /**
   * Save user preferences based on current values in the UI.
   * @param e
   * @function module:SVGthis.savePreferences
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async savePreferences (e: any): Promise<void> {
    const {
      lang,
      bgcolor,
      bgurl,
      gridsnappingon,
      gridsnappingstep,
      gridcolor,
      showrulers,
      baseunit
    } = e.detail
    // Set background
    this.editor.setBackground(bgcolor, bgurl)

    // set language
    if (lang && lang !== this.editor.configObj.pref('lang')) {
      this.editor.configObj.pref('lang', lang)
      seAlert('Changing the language needs reload')
    }

    // set grid setting
    this.editor.configObj.curConfig.gridSnapping = gridsnappingon
    this.editor.configObj.curConfig.snappingStep = gridsnappingstep
    this.editor.configObj.curConfig.gridColor = gridcolor
    this.editor.configObj.curConfig.showRulers = showrulers
    if (this.editor.configObj.curConfig.showRulers) {
      this.editor.rulers.updateRulers()
    }
    this.editor.configObj.curConfig.baseUnit = baseunit
    this.editor.svgCanvas.setConfig(this.editor.configObj.curConfig)
    this.editor.updateCanvas()
    this.hidePreferences()
  }

  /**
   *
   * @param e
   * @returns Resolves to `undefined`
   */
  async clickExport (e: any): Promise<void> {
    if (e?.detail?.trigger !== 'ok' || e?.detail?.imgType === undefined) {
      return
    }
    const imgType = e?.detail?.imgType
    const quality = e?.detail?.quality ? e?.detail?.quality / 100 : 1
    // Open placeholder window (prevents popup)
    let exportWindowName: string | undefined

    /**
     *
     */
    const openExportWindow = () => {
      if (this.editor.configObj.curConfig.exportWindowType === 'new') {
        this.editor.exportWindowCt++
      }
      this.editor.exportWindowName =
        this.editor.configObj.curConfig.canvasName + this.editor.exportWindowCt
    }
    const chrome = isChrome()
    if (imgType === 'PDF') {
      if (!this.editor.customExportPDF && !chrome) {
        openExportWindow()
      }
      this.editor.svgCanvas.exportPDF(exportWindowName)
    } else {
      if (!this.editor.customExportImage) {
        openExportWindow()
      }
      /* const results = */ await this.editor.svgCanvas.rasterExport(
        imgType,
        quality,
        this.editor.exportWindowName
      )
    }
  }

  /**
   *
   */
  showDocProperties (): void {
    if (this.editor.docprops) {
      return
    }
    this.editor.docprops = true
    const $imgDialog = $id('se-img-prop')
    if (!$imgDialog) return

    // update resolution option with actual resolution
    const resolution = this.editor.svgCanvas.getResolution()
    if (this.editor.configObj.curConfig.baseUnit !== 'px') {
      resolution.w =
        convertUnit(resolution.w) + this.editor.configObj.curConfig.baseUnit
      resolution.h =
        convertUnit(resolution.h) + this.editor.configObj.curConfig.baseUnit
    }
    $imgDialog.setAttribute('save', String(this.editor.configObj.pref('img_save') ?? ''))
    $imgDialog.setAttribute('width', String(resolution.w))
    $imgDialog.setAttribute('height', String(resolution.h))
    $imgDialog.setAttribute('title', this.editor.svgCanvas.getDocumentTitle())
    $imgDialog.setAttribute('dialog', 'open')
  }

  /**
   *
   */
  showPreferences (): void {
    if (this.editor.configObj.preferences) {
      return
    }
    this.editor.configObj.preferences = true
    const $editDialog = $id('se-edit-prefs')
    if (!$editDialog) return
    // Update background color with current one
    const canvasBg = this.editor.configObj.curPrefs.bkgd_color
    const url = this.editor.configObj.pref('bkgd_url')
    if (url) {
      $editDialog.setAttribute('bgurl', String(url))
    }
    $editDialog.setAttribute(
      'gridsnappingon',
      String(this.editor.configObj.curConfig.gridSnapping)
    )
    $editDialog.setAttribute(
      'gridsnappingstep',
      String(this.editor.configObj.curConfig.snappingStep)
    )
    $editDialog.setAttribute(
      'gridcolor',
      String(this.editor.configObj.curConfig.gridColor)
    )
    $editDialog.setAttribute('canvasbg', String(canvasBg ?? ''))
    $editDialog.setAttribute('dialog', 'open')
  }

  /**
   *
   */
  openHomePage (): void {
    window.open(homePage, '_blank')
  }

  /**
   */
  init (): void {
    // add Top panel
    const template = document.createElement('template')
    template.innerHTML = `
    <se-menu id="main_button" label="svgedit" src="logo.svg" alt="logo">
        <se-menu-item id="tool_export" label="tools.export_img" src="export.svg"></se-menu-item>
        <se-menu-item id="tool_docprops" label="tools.docprops" shortcut="shift+D" src="docprop.svg"></se-menu-item>
        <se-menu-item id="tool_editor_prefs" label="config.editor_prefs" src="editPref.svg"></se-menu-item>
        <se-menu-item id="tool_editor_homepage" label="tools.editor_homepage" src="logo.svg"></se-menu-item>
    </se-menu>`
    this.editor.$svgEditor.append(template.content.cloneNode(true))

    // register action to main menu entries
    /**
     * Associate all button actions as well as non-button keyboard shortcuts.
     */
    $click($id('tool_export') as EventTarget, function () {
      document
        .getElementById('se-export-dialog')
        ?.setAttribute('dialog', 'open')
    })
    $id('se-export-dialog')?.addEventListener(
      'change',
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.clickExport.bind(this)
    )
    $id('tool_docprops')?.addEventListener(
      'click',
      this.showDocProperties.bind(this)
    )
    $id('tool_editor_prefs')?.addEventListener(
      'click',
      this.showPreferences.bind(this)
    )
    $id('tool_editor_homepage')?.addEventListener(
      'click',
      this.openHomePage.bind(this)
    )
    $id('se-img-prop')?.addEventListener(
      'change',
      ((e: any) => {
        if (e.detail.dialog === 'closed') {
          this.hideDocProperties()
        } else {
          this.saveDocProperties(e)
        }
      })
    )
    $id('se-edit-prefs')?.addEventListener(
      'change',
      ((e: any) => {
        if (e.detail.dialog === 'closed') {
          this.hidePreferences()
        } else {
          void this.savePreferences(e)
        }
      })
    )
  }
}

export default MainMenu
