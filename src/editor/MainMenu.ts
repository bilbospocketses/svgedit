import SvgCanvas from '@svgedit/svgcanvas'
import type { ISvgCanvas } from '@svgedit/svgcanvas'
import { isChrome } from '@svgedit/svgcanvas/common/browser.js'
import type ConfigObj from './ConfigObj.js'
import type Rulers from './Rulers.js'
import { typedDetail, type SeImgPropDetail, type SeEditPrefsDetail, type SeExportDetail } from './typed-events.js'

const { $id, $click, convertUnit, isValidUnit } = SvgCanvas
const homePage = 'https://github.com/bilbospocketses/svgedit'

/** Narrow i18next facade — matches the surface from locale.ts. */
interface I18nextFacade {
  t: (key: string, vars?: Record<string, unknown>) => string
  addResourceBundle: (lang: string, ns: string, dict: Record<string, unknown>) => void
}

/** Narrow interface for the Editor instance — avoids circular import. */
interface EditorInstance {
  svgCanvas: ISvgCanvas
  configObj: ConfigObj
  i18next: I18nextFacade
  rulers: Rulers
  $svgEditor: HTMLElement
  docprops: boolean
  exportWindowCt: number
  exportWindowName: string | null
  exportWindow: Window | null
  customExportImage: boolean
  customExportPDF: boolean
  updateCanvas: (center?: boolean, newCtr?: { x: number; y: number }) => void
  setBackground: (color: string, url: string) => void
}

/** Manages the main SVG-edit menu bar: doc properties, preferences, export, and homepage. */
class MainMenu {
  editor: EditorInstance

  /**
   * @param editor svgedit handler
   */
  constructor (editor: EditorInstance) {
    this.editor = editor
    this.editor.exportWindowCt = 0
  }

  /** Close the document-properties dialog and reset the img_save preference display. */
  hideDocProperties (): void {
    const $imgDialog = $id('se-img-prop')
    if (!$imgDialog) return
    $imgDialog.setAttribute('dialog', 'close')
    $imgDialog.setAttribute('save', (this.editor.configObj.pref('img_save') as string | undefined) ?? '')
    this.editor.docprops = false
  }

  /** Close the editor-preferences dialog and clear the preferences-open flag. */
  hidePreferences (): void {
    const $editDialog = $id('se-edit-prefs')
    if (!$editDialog) return
    $editDialog.setAttribute('dialog', 'close')
    this.editor.configObj.preferences = false
  }

  /** Apply title, dimensions, and img_save preference from the doc-properties dialog event; returns false on invalid input. */
  saveDocProperties (e: CustomEvent): boolean {
    // set title
    const { title, w, h, save } = typedDetail<SeImgPropDetail>(e)
    // set document title
    this.editor.svgCanvas.setDocumentTitle(title)

    if (w !== 'fit' && !isValidUnit('width', w)) {
      seAlert(this.editor.i18next.t('notification.invalidAttrValGiven'))
      return false
    }
    if (h !== 'fit' && !isValidUnit('height', h)) {
      seAlert(this.editor.i18next.t('notification.invalidAttrValGiven'))
      return false
    }
    const resW = w === 'fit' ? 'fit' as const : Number(w)
    const resH = h === 'fit' ? Number(h) : Number(h)
    if (!this.editor.svgCanvas.setResolution(resW, resH)) {
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
   * @function module:SVGthis.savePreferences
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async savePreferences (e: CustomEvent): Promise<void> {
    const {
      lang,
      bgcolor,
      bgurl,
      gridsnappingon,
      gridsnappingstep,
      gridcolor,
      showrulers,
      baseunit
    } = typedDetail<SeEditPrefsDetail>(e)
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

  /** Handle the export-dialog confirm event; dispatches PDF or raster export via svgCanvas. */
  async clickExport (e?: Event | { detail: SeExportDetail }): Promise<void> {
    const detail: SeExportDetail | undefined = e ? (e as CustomEvent<SeExportDetail>).detail : undefined
    if (!detail || detail.trigger !== 'ok' || detail.imgType === undefined) {
      return
    }
    const imgType = detail.imgType
    const quality = detail.quality ? detail.quality / 100 : 1
    // Open placeholder window (prevents popup)
    let exportWindowName: string | undefined

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
      void this.editor.svgCanvas.exportPDF(exportWindowName)
    } else {
      if (!this.editor.customExportImage) {
        openExportWindow()
      }
      /* const results = */ await this.editor.svgCanvas.rasterExport(
        imgType,
        quality,
        this.editor.exportWindowName ?? undefined
      )
    }
  }

  /** Open the document-properties dialog, populating current resolution and save settings. */
  showDocProperties (): void {
    if (this.editor.docprops) {
      return
    }
    this.editor.docprops = true
    const $imgDialog = $id('se-img-prop')
    if (!$imgDialog) return

    // update resolution option with actual resolution
    const resolution = this.editor.svgCanvas.getResolution()
    let resW: string | number = resolution.w
    let resH: string | number = resolution.h
    if (this.editor.configObj.curConfig.baseUnit !== 'px') {
      resW = convertUnit(resolution.w) + this.editor.configObj.curConfig.baseUnit
      resH = convertUnit(resolution.h) + this.editor.configObj.curConfig.baseUnit
    }
    $imgDialog.setAttribute('save', (this.editor.configObj.pref('img_save') as string | undefined) ?? '')
    $imgDialog.setAttribute('width', String(resW))
    $imgDialog.setAttribute('height', String(resH))
    $imgDialog.setAttribute('title', this.editor.svgCanvas.getDocumentTitle() ?? '')
    $imgDialog.setAttribute('dialog', 'open')
  }

  /** Open the editor-preferences dialog, pre-filling current grid, ruler, and background values. */
  showPreferences (): void {
    if (this.editor.configObj.preferences) {
      return
    }
    this.editor.configObj.preferences = true
    const $editDialog = $id('se-edit-prefs')
    if (!$editDialog) return
    // Update background color with current one
    const canvasBg = this.editor.configObj.curPrefs.bkgd_color
    const url = this.editor.configObj.pref('bkgd_url') as string | undefined
    if (url) {
      $editDialog.setAttribute('bgurl', url)
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

  /** Navigate to the SVG-edit project homepage in a new browser tab. */
  openHomePage (): void {
    window.open(homePage, '_blank')
  }

  /** Inject the main menu template into the editor DOM and bind all menu-item click handlers. */
  init (): void {
    // add Top panel
    const template = document.createElement('template')
    template.innerHTML = `
    <se-menu id="main_button" label="svgedit" src="logo.svg" alt="logo">
        <se-menu-item id="tool_export" label="tools.export_img" src="export.svg"></se-menu-item>
        <se-menu-item id="tool_docprops" label="tools.docprops" shortcut="shift+D" src="docprop.svg"></se-menu-item>
        <se-menu-item id="tool_editor_prefs" label="config.editor_prefs" src="editPref.svg"></se-menu-item>
        <se-menu-item id="tool_editor_homepage" label="tools.editor_homepage" src="logo.svg"></se-menu-item>
    </se-menu>
    <se-theme-toggle id="theme_toggle"></se-theme-toggle>`
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
      ((e: Event) => {
        const detail = typedDetail<SeImgPropDetail>(e)
        if (detail.dialog === 'closed') {
          this.hideDocProperties()
        } else {
          this.saveDocProperties(e as CustomEvent)
        }
      })
    )
    $id('se-edit-prefs')?.addEventListener(
      'change',
      ((e: Event) => {
        const detail = typedDetail<SeEditPrefsDetail>(e)
        if (detail.dialog === 'closed') {
          this.hidePreferences()
        } else {
          void this.savePreferences(e as CustomEvent)
        }
      })
    )
    $id('theme_toggle')?.addEventListener('toggle-theme', (e) => {
      this.editor.configObj.pref('theme', (e as CustomEvent<{ theme: string }>).detail.theme)
    })
  }
}

export default MainMenu
