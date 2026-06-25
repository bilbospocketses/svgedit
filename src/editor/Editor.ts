/**
 * The main module for the visual SVG this.
 *
 * @license MIT
 * @module SVGEditor
 */

import './components/index.js'
import './dialogs/index.js'
import { normalizeShortcut } from './common/shortcut.js'

import { isMac } from '@svgedit/svgcanvas/common/browser'
import type { ISvgCanvas } from '@svgedit/svgcanvas'

import SvgCanvas from '@svgedit/svgcanvas'
import ConfigObj from './ConfigObj.js'
import { DocumentIO } from './DocumentIO.js'
import { ExportManager } from './ExportManager.js'
import { EditorSelection } from './EditorSelection.js'
import type Rulers from './Rulers.js'
import { initEditor } from './editorInit.js'
import LeftPanel from './panels/LeftPanel.js'
import TopPanel from './panels/TopPanel.js'
import BottomPanel from './panels/BottomPanel.js'
import LayersPanel from './panels/LayersPanel.js'
import MainMenu from './MainMenu.js'
import { getParentsUntil } from '@svgedit/svgcanvas/common/util.js'
import { EmbedServer } from '../embed/server.js'
import { setSvgEditor } from './svgEditorInstance.js'
import { typedDetail } from './typed-events.js'
import { setPaletteWithErrors } from './components/palette-store.js'
import { renderContextPanel } from './contextPanel.js'

/** Narrow i18next facade — matches the surface from locale.ts. */
interface I18nextFacade {
  t: (key: string, vars?: Record<string, unknown>) => string
  addResourceBundle: (lang: string, ns: string, dict: Record<string, unknown>) => void
}

/** Callback tuple stored by `ready()`. */
type ReadyCallback = [() => unknown, (value?: unknown) => void, (reason?: unknown) => void]

/** Shortcut definition used in the keyboard handler. */
interface ShortcutDef {
  key: string | [string, boolean?]
  fn: () => void
  sel?: string
}

const SVGEDIT_VERSION = '7.4.1'

const { $id, $click } = SvgCanvas

/** Main SVG editor class — owns the canvas, panels, keyboard shortcuts, and extension lifecycle. */
class Editor {
  // --- Properties from Editor ---
  langChanged: boolean
  showSaveWarning: boolean
  storagePromptState: 'ignore' | 'waiting' | 'closed'
  title: string
  $click: typeof $click
  callbacks: ReadyCallback[]
  curContext: string | null
  docprops: boolean
  shortcuts: ShortcutDef[]
  /** Embed-API server instance; accessible for calling .ready() and wiring canvas events. */
  public readonly _embedServer!: EmbedServer

  // --- Properties (startup own) ---
  extensionsAdded: boolean
  messageQueue: Array<{ title?: string; message?: string }>
  $container: HTMLElement

  // --- Properties (startup forward-declared) ---
  configObj: ConfigObj
  documentIO: DocumentIO
  exportManager: ExportManager
  selection: EditorSelection
  svgCanvas!: ISvgCanvas
  i18next!: I18nextFacade
  $svgEditor!: HTMLElement
  workarea!: HTMLElement
  leftPanel: LeftPanel
  bottomPanel: BottomPanel
  topPanel: TopPanel
  layersPanel: LayersPanel
  mainMenu: MainMenu
  rulers!: Rulers
  canvMenu!: HTMLElement | null
  defaultImageURL!: string
  uiContext!: string
  enableToolCancel!: boolean
  modeEvent!: CustomEvent | null
  goodLangs!: string[]
  storage!: Storage | null
  isReady!: boolean
  setPanning!: (active: boolean) => void
  setConfig!: (opts: Record<string, unknown>, cfgCfg?: { overwrite?: boolean; allowInitialUserOverride?: boolean }) => void

  // --- Export state: delegated to ExportManager (backward-compat for MainMenu / editorInit) ---
  get exportWindow (): Window | null { return this.exportManager.exportWindow }
  set exportWindow (v: Window | null) { this.exportManager.exportWindow = v }
  get exportWindowCt (): number { return this.exportManager.exportWindowCt }
  set exportWindowCt (v: number) { this.exportManager.exportWindowCt = v }
  get exportWindowName (): string | null { return this.exportManager.exportWindowName }
  set exportWindowName (v: string | null) { this.exportManager.exportWindowName = v }
  get customExportImage (): boolean { return this.exportManager.customExportImage }
  set customExportImage (v: boolean) { this.exportManager.customExportImage = v }
  get customExportPDF (): boolean { return this.exportManager.customExportPDF }
  set customExportPDF (v: boolean) { this.exportManager.customExportPDF = v }

  // --- Selection state: delegated to EditorSelection (single source of truth + change emitter) ---
  get selectedElement (): Element | null { return this.selection.selectedElement }
  set selectedElement (v: Element | null) { this.selection.selectedElement = v }
  get multiselected (): boolean { return this.selection.multiselected }
  set multiselected (v: boolean) { this.selection.multiselected = v }

  constructor (div: HTMLElement | null = null) {
    this.extensionsAdded = false
    this.messageQueue = []
    this.$container = (div ?? $id('svg_editor')) as HTMLElement
    this.langChanged = false
    this.showSaveWarning = false
    /**
     * Will be set to a boolean by `ext-storage.js`
     */
    this.storagePromptState = 'ignore'
    /**
     * document title
     */
    this.title = 'untitled.svg'

    this.svgCanvas = null as unknown as ISvgCanvas
    this.$click = $click
    this.isReady = false
    this.configObj = new ConfigObj(this)
    this.configObj.pref = this.configObj.pref.bind(this.configObj)
    this.setConfig = this.configObj.setConfig.bind(this.configObj)
    this.documentIO = new DocumentIO(this)
    this.exportManager = new ExportManager(this)
    this.selection = new EditorSelection()
    this.callbacks = []
    this.curContext = null
    this.docprops = false
    this.configObj.preferences = false
    this.canvMenu = null
    this.goodLangs = ['en']

    const modKey = isMac() ? 'meta+' : 'ctrl+'
    this.shortcuts = [
      // Shortcuts not associated with buttons
      {
        key: ['ctrl+ARROWLEFT', true],
        fn: () => {
          this.rotateSelected(0, 1)
        }
      },
      {
        key: 'ctrl+ARROWRIGHT',
        fn: () => {
          this.rotateSelected(1, 1)
        }
      },
      {
        key: ['shift+ctrl+ARROWLEFT', true],
        fn: () => {
          this.rotateSelected(0, 5)
        }
      },
      {
        key: 'shift+ctrl+ARROWRIGHT',
        fn: () => {
          this.rotateSelected(1, 5)
        }
      },
      {
        key: 'shift+O',
        fn: () => {
          this.svgCanvas.cycleElement(0)
        }
      },
      {
        key: 'shift+P',
        fn: () => {
          this.svgCanvas.cycleElement(1)
        }
      },
      {
        key: 'TAB',
        fn: () => {
          this.svgCanvas.cycleElement(0)
        }
      },
      {
        key: 'shift+TAB',
        fn: () => {
          this.svgCanvas.cycleElement(1)
        }
      },
      {
        key: [modKey + 'ARROWUP', true],
        fn: () => {
          this.zoomImage(2)
        }
      },
      {
        key: [modKey + 'ARROWDOWN', true],
        fn: () => {
          this.zoomImage(0.5)
        }
      },
      {
        key: [modKey + ']', true],
        fn: () => {
          this.moveUpDownSelected('Up')
        }
      },
      {
        key: [modKey + '[', true],
        fn: () => {
          this.moveUpDownSelected('Down')
        }
      },
      {
        key: ['ARROWUP', true],
        fn: () => {
          this.moveSelected(0, -1)
        }
      },
      {
        key: ['ARROWDOWN', true],
        fn: () => {
          this.moveSelected(0, 1)
        }
      },
      {
        key: ['ARROWLEFT', true],
        fn: () => {
          this.moveSelected(-1, 0)
        }
      },
      {
        key: ['ARROWRIGHT', true],
        fn: () => {
          this.moveSelected(1, 0)
        }
      },
      {
        key: 'shift+ARROWUP',
        fn: () => {
          this.moveSelected(0, -10)
        }
      },
      {
        key: 'shift+ARROWDOWN',
        fn: () => {
          this.moveSelected(0, 10)
        }
      },
      {
        key: 'shift+ARROWLEFT',
        fn: () => {
          this.moveSelected(-10, 0)
        }
      },
      {
        key: 'shift+ARROWRIGHT',
        fn: () => {
          this.moveSelected(10, 0)
        }
      },
      {
        key: ['alt+ARROWUP', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(0, -1)
        }
      },
      {
        key: ['alt+ARROWDOWN', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(0, 1)
        }
      },
      {
        key: ['alt+ARROWLEFT', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(-1, 0)
        }
      },
      {
        key: ['alt+ARROWRIGHT', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(1, 0)
        }
      },
      {
        key: ['alt+shift+ARROWUP', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(0, -10)
        }
      },
      {
        key: ['alt+shift+ARROWDOWN', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(0, 10)
        }
      },
      {
        key: ['alt+shift+ARROWLEFT', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(-10, 0)
        }
      },
      {
        key: ['alt+shift+ARROWRIGHT', true],
        fn: () => {
          this.svgCanvas.cloneSelectedElements(10, 0)
        }
      },
      {
        key: ['DELETE/BACKSPACE', true],
        fn: () => {
          if (this.selectedElement || this.multiselected) {
            this.svgCanvas.deleteSelectedElements()
          }
        }
      },
      {
        key: 'A',
        fn: () => {
          this.svgCanvas.selectAllInCurrentLayer()
        }
      },
      {
        key: [modKey + 'A', true],
        fn: () => {
          this.svgCanvas.selectAllInCurrentLayer()
        }
      },
      {
        key: modKey + 'X',
        fn: () => {
          this.cutSelected()
        }
      },
      {
        key: modKey + 'C',
        fn: () => {
          this.copySelected()
        }
      },
      {
        key: modKey + 'V',
        fn: () => {
          this.pasteInCenter()
        }
      },
      {
        key: 'ESCAPE',
        fn: () => {
          if (this.enableToolCancel) {
            this.cancelTool()
          }
        }
      }
    ]
    this.leftPanel = new LeftPanel(this)
    this.bottomPanel = new BottomPanel(this)
    this.topPanel = new TopPanel(this)
    this.layersPanel = new LayersPanel(this)
    this.mainMenu = new MainMenu(this)
    // makes svgEditor accessible as a global variable
    setSvgEditor(this)
    ;(window as unknown as Record<string, unknown>).svgEditor = this

    // Embed-API wire-in (Task 11). Activates only when ?embed=1 OR window.parent !== window.
    // Default dialog handlers wrap existing window.seAlert / window.seConfirm (see ambient declarations above).
    // svgCanvas event binding is deferred to init() where svgCanvas is actually created.
    ;(this as { _embedServer: EmbedServer })._embedServer = new EmbedServer(this as unknown as { svgCanvas: Record<string, unknown> } & Record<string, unknown>, {
      version: SVGEDIT_VERSION,
      defaultDialogHandlers: {
        alert: (msg) => { seAlert(msg); return Promise.resolve() },
        confirm: async (msg) => Boolean(await seConfirm(msg)),
        // M3 (#13): the in-app SePromptDialog is the default; hosts may still register their own handler.
        prompt: (msg, def) => sePrompt(msg, def ?? '')
      }
    })
  } // end Constructor

  /**
  * Auto-run after a Promise microtask.
  * @function module:SVGthis.init
  */
  async init () {
    await initEditor(this)
  }

  /**
   * @fires module:svgcanvas.SvgCanvas#event:ext_addLangData
   * @fires module:svgcanvas.SvgCanvas#event:ext_langReady
   * @fires module:svgcanvas.SvgCanvas#event:ext_langChanged
   * @fires module:svgcanvas.SvgCanvas#event:extensions_added
   * @returns Resolves to result of {@link module:locale.readLang}
   */
  async extAndLocaleFunc () {
    this.$svgEditor.style.visibility = 'visible'
    try {
      // load standard extensions
      await Promise.all(
        this.configObj.curConfig.extensions.map(async (extname: string) => {
          try {
            // Vite cannot statically analyze these dynamic extension imports.
            const imported = await import(/* @vite-ignore */ `${this.configObj.curConfig.extPath}/${encodeURIComponent(extname)}/${encodeURIComponent(extname)}.js`) as { default: { name?: string; init?: (...args: unknown[]) => unknown } }
            const { name = extname, init: initfn } = imported.default
            return this.addExtension(name, (initfn && initfn.bind(this)), { langParam: 'en' }) /** @todo  change to current lng */
          } catch (err) {
            // Todo: Add config to alert any errors
            console.error('Extension failed to load: ' + extname + '; ', err)
            return undefined
          }
        })
      )
      // load user extensions (given as pathNames)
      await Promise.all(
        this.configObj.curConfig.userExtensions.map(async ({ pathName, config }: { pathName: string; config: unknown }) => {
          try {
            const imported = await import(/* @vite-ignore */ encodeURI(pathName)) as { default: { name: string; init?: (...args: unknown[]) => unknown } }
            const { name, init: initfn } = imported.default
            return this.addExtension(name, (initfn && initfn.bind(this, config)), {})
          } catch (err) {
            // Todo: Add config to alert any errors
            console.error('Extension failed to load: ' + pathName + '; ', err)
            return undefined
          }
        })
      )
      this.svgCanvas.bind(
        'extensions_added',
        /**
        * @listens module:SvgCanvas#event:extensions_added
        */
        (_win: unknown, _data: unknown) => {
          this.extensionsAdded = true
          this.setAll()

          if (this.storagePromptState === 'ignore') {
            this.updateCanvas(true)
          }

          this.messageQueue.forEach(
            /**
             * @fires module:svgcanvas.SvgCanvas#event:message
             */
            (messageObj) => {
              this.svgCanvas.call('message', messageObj)
            }
          )
        }
      )
      this.svgCanvas.call('extensions_added')
    } catch (err) {
      // Todo: Report errors through the UI
      console.error(err)
    }
  }

  /**
 * Listens to the mode change, listener is to be added on document
* @param evt custom modeChange event
*/
  modeListener (_evt: Event): void {
    const mode = this.svgCanvas.getMode()

    this.setCursorStyle(mode)
  }

  /**
   * sets cursor styling for workarea depending on the current mode
   */
  setCursorStyle (mode: string): void {
    let cs = 'auto'
    switch (mode) {
      case 'ext-panning':
        cs = 'grab'
        break
      case 'zoom':
      case 'shapelib':
        cs = 'crosshair'
        break
      case 'circle':
      case 'ellipse':
      case 'rect':
      case 'square':
      case 'star':
      case 'polygon':
        cs = `url("./images/cursors/${mode}_cursor.svg"), crosshair`
        break
      case 'text':
        cs = 'text'
        break
      default:
        cs = 'auto'
    }

    this.workarea.style.cursor = cs
  }

  /**
   * Listens for Esc key to be pressed to cancel active mode, sets mode to Select
   */
  cancelTool () {
    const mode = this.svgCanvas.getMode()
    // list of modes that are currently save to cancel
    const modesToCancel = ['zoom', 'rect', 'square', 'circle', 'ellipse', 'line', 'text', 'star', 'polygon', 'shapelib', 'image']
    if (modesToCancel.includes(mode)) {
      this.leftPanel.clickSelect()
    }
  }

  /**
   *
   * @throws {Error} Upon failure to load SVG
   */
  loadSvgString (str: string, opts: { noAlert?: boolean | undefined } = {}): void {
    this.documentIO.loadSvgString(str, opts)
  }

  /**
   * All methods are optional.
   * @interface module:SVGthis.CustomHandler
   */
  /**
   * Its responsibilities are:
   *  - invoke a file chooser dialog in 'open' mode
   *  - let user pick a SVG file
   *  - calls [svgCanvas.setSvgString()]{@link module:svgcanvas.SvgCanvas#setSvgString} with the string contents of that file.
   * Not passed any parameters.
   * @function module:SVGthis.CustomHandler#open
   */
  /**
   * Its responsibilities are:
   *  - accept the string contents of the current document
   *  - invoke a file chooser dialog in 'save' mode
   *  - save the file to location chosen by the user.
   * @function module:SVGthis.CustomHandler#save
   * @param win
   * @param svgStr A string of the SVG
   * @listens module:svgcanvas.SvgCanvas#event:saved
   */
  /**
   * Its responsibilities (with regard to the object it is supplied in its 2nd argument) are:
   *  - inform user of any issues supplied via the "issues" property
   *  - convert the "svg" property SVG string into an image for export;
   *    utilize the properties "type" (currently 'PNG', 'JPEG', 'BMP',
   *    'WEBP', 'PDF'), "mimeType", and "quality" (for 'JPEG' and 'WEBP'
   *    types) to determine the proper output.
   * @function module:SVGthis.CustomHandler#exportImage
   * @param win
   * @param data
   * @listens module:svgcanvas.SvgCanvas#event:exported
   */
  /**
   * @function module:SVGthis.CustomHandler#exportPDF
   * @param win
   * @param data
   * @listens module:svgcanvas.SvgCanvas#event:exportedPDF
   */

  /**
   * Toggle randomized element ID generation on the canvas.
   * @function module:SVGthis.randomizeIds
   */
  randomizeIds (arg: boolean): void {
    this.svgCanvas.randomizeIds(arg)
  }

  /**
   * Clear the unsaved-changes warning. Called by save extensions after the
   * document has been successfully persisted (e.g., ext-opensave after
   * `fileSave` resolves). Any subsequent edit re-arms the warning via
   * the `elementChanged` handler.
   */
  markSaved () {
    this.showSaveWarning = false
  }

  /**
   *  @lends module:SVGEditor~Actions */
  /**
   * editor shortcuts init
   */
  setAll (): void {
    const keyHandler: Record<string, { fn: () => void; pd: boolean }> = {} // will contain the action for each pressed key

    this.shortcuts.forEach((shortcut) => {
      // Bind function to shortcut key
      if (shortcut.key) {
        // Set shortcut based on options
        // TODO: see todo #10 — audit-flagged shortcut normalization at :410-412; preserved verbatim
        let keyval = shortcut.key
        let pd = false
        if (Array.isArray(shortcut.key)) {
          keyval = shortcut.key[0]
          if (shortcut.key.length > 1) {
            pd = shortcut.key[1] ?? false
          }
        }
        keyval = String(keyval)
        const { fn } = shortcut
        // Split on '/' for alternative keys (e.g., 'DELETE/BACKSPACE'). The dict
        // lookup must use the canonical UPPERCASE_KEY form per normalizeShortcut().
        ;keyval.split('/').forEach((key: string) => {
          keyHandler[key] = { fn, pd }
        })
      }
      return true
    })
    // register the keydown event
    document.addEventListener('keydown', (e) => {
      // only track keyboard shortcuts for the body containing the svgedit editor
      if ((e.target as Element)?.nodeName !== 'BODY') return
      // normalize key (canonical: alt+shift+meta+ctrl+UPPERCASE_KEY)
      const key = normalizeShortcut(e)
      // return if no shortcut defined for this key
      if (!keyHandler[key]) return
      // launch associated handler and preventDefault if necessary
      keyHandler[key].fn()
      if (keyHandler[key].pd) {
        e.preventDefault()
      }
    })

    // Misc additional actions

    // Make 'return' keypress trigger the change event
    const elements = document.getElementsByClassName('attr_changer')
    Array.from(elements).forEach(function (element) {
      element.addEventListener('keydown', function (evt) {
        ;(evt.currentTarget as HTMLElement)?.dispatchEvent(new Event('change'))
        evt.preventDefault()
      })
    })
    $id('image_url')?.addEventListener('keydown', function (evt) {
      ;(evt.currentTarget as HTMLElement)?.dispatchEvent(new Event('change'))
      evt.preventDefault()
    })
  }

  getButtonData (sel: string): ShortcutDef | undefined {
    return Object.values(this.shortcuts).find((btn) => {
      return btn.sel === sel
    })
  }

  /**
   * @listens module:svgcanvas.SvgCanvas#event:exported
   */
  exportHandler (_win: unknown, data: { issues: string[]; exportWindowName: string; bloburl?: string; datauri?: string; type: string }): void {
    this.exportManager.handleExported(_win, data)
  }

  setBackground (color: string, url: string): void {
    // if (color == this.configObj.pref('bkgd_color') && url == this.configObj.pref('bkgd_url')) { return; }
    this.configObj.pref('bkgd_color', color)
    this.configObj.pref('bkgd_url', url, true)

    // This should be done in  this.svgCanvas.js for the borderRect fill
    this.svgCanvas.setBackground(color, url)
  }

  /**
   * Resize and reposition the canvas element, adjusting scroll to maintain the current view center.
   * @function module:SVGthis.updateCanvas
   */
  updateCanvas (center?: boolean, newCtr?: { x: number; y: number }): void {
    const zoom = this.svgCanvas.getZoom()
    const { workarea } = this
    const cnvs = $id('svgcanvas')
    if (!cnvs) return

    let w = parseFloat(
      getComputedStyle(workarea, null).width.replace('px', '')
    )
    let h = parseFloat(
      getComputedStyle(workarea, null).height.replace('px', '')
    )
    const wOrig = w
    const hOrig = h
    const oldCtr = {
      x: workarea.scrollLeft + wOrig / 2,
      y: workarea.scrollTop + hOrig / 2
    }
    const multi = this.configObj.curConfig.canvas_expansion
    w = Math.max(wOrig, this.svgCanvas.contentW * zoom * multi)
    h = Math.max(hOrig, this.svgCanvas.contentH * zoom * multi)

    if (w === wOrig && h === hOrig) {
      workarea.style.overflow = 'hidden'
    } else {
      workarea.style.overflow = 'scroll'
    }

    const oldCanY =
      parseFloat(getComputedStyle(cnvs, null).height.replace('px', '')) / 2
    const oldCanX =
      parseFloat(getComputedStyle(cnvs, null).width.replace('px', '')) / 2

    cnvs.style.width = w + 'px'
    cnvs.style.height = h + 'px'
    const newCanY = h / 2
    const newCanX = w / 2
    const offset = this.svgCanvas.updateCanvas(w, h)

    const ratio = newCanX / oldCanX

    const scrollX = w / 2 - wOrig / 2
    const scrollY = h / 2 - hOrig / 2

    if (!newCtr) {
      const oldDistX = oldCtr.x - oldCanX
      const newX = newCanX + oldDistX * ratio

      const oldDistY = oldCtr.y - oldCanY
      const newY = newCanY + oldDistY * ratio

      newCtr = {
        x: newX,
        y: newY
      }
    } else {
      newCtr.x += offset.x
      newCtr.y += offset.y
    }

    if (center) {
      // Go to top-left for larger documents
      if (
        this.svgCanvas.contentW >
        parseFloat(getComputedStyle(workarea, null).width.replace('px', ''))
      ) {
        // Top-left
        workarea.scrollLeft = offset.x - 10
        workarea.scrollTop = offset.y - 10
      } else {
        // Center
        workarea.scrollLeft = scrollX
        workarea.scrollTop = scrollY
      }
    } else {
      workarea.scrollLeft = newCtr.x - wOrig / 2
      workarea.scrollTop = newCtr.y - hOrig / 2
    }
    if (this.configObj.curConfig.showRulers) {
      this.rulers.updateRulers(cnvs, zoom)
      workarea.scroll()
    }

    if (
      this.configObj.urldata.storagePrompt !== true &&
      this.storagePromptState === 'ignore'
    ) {
      $id('dialog_box')?.style.setProperty('display', 'none')
    }
  }

  updateWireFrame () {
    const rule = `
      #workarea.wireframe #svgcontent * {
        stroke-width: ${1 / this.svgCanvas.getZoom()}px;
      }
    `
    if (document.querySelectorAll('#wireframe_rules').length > 0) {
      ;(document.querySelector('#wireframe_rules') as HTMLElement).textContent =
        this.workarea.classList.contains('wireframe') ? rule : ''
    }
  }

  // called when we've selected a different element
  /**
   *
   * @listens module:svgcanvas.SvgCanvas#event:selected
   * @fires module:svgcanvas.SvgCanvas#event:ext_selectedChanged
   */
  selectedChanged (_win: unknown, elems: Element[]): void {
    const mode = this.svgCanvas.getMode()
    if (mode === 'select') {
      this.leftPanel.clickSelect()
    }
    const isNode = mode === 'pathedit'
    // if this.elems[1] is present, then we have more than one element
    this.selection.setSelection(
      elems.length === 1 || !elems[1] ? elems[0] ?? null : null,
      elems.length >= 2 && !!elems[1]
    )
    if (this.selectedElement && !isNode) {
      this.topPanel.update()
    } // if (elem)

    // Deal with pathedit mode
    this.topPanel.togglePathEditMode(isNode, elems)
    this.topPanel.updateContextPanel()
    this.svgCanvas.runExtensions({
      action: 'selectedChanged',
      vars: {
        elems,
        selectedElement: this.selectedElement,
        multiselected: this.multiselected
      }
    })
  }

  // Call when part of element is in process of changing, generally
  // on mousemove actions like rotate, move, etc.
  /**
   * @listens module:svgcanvas.SvgCanvas#event:transition
   * @fires module:svgcanvas.SvgCanvas#event:ext_elementTransition
   */
  elementTransition (_win: unknown, elems: Element[]): void {
    const mode = this.svgCanvas.getMode()
    const elem = elems[0]

    if (!elem) {
      return
    }

    this.multiselected = elems.length >= 2 && !!elems[1]
    // Only updating fields for single elements for now
    if (!this.multiselected) {
      switch (mode) {
        case 'rotate': {
          const ang = this.svgCanvas.getRotationAngle(elem)
          ;($id('angle') as HTMLInputElement | null)?.setAttribute('value', String(ang))
          if (ang === 0) {
            $id('tool_reorient')?.classList.add('disabled')
          } else {
            $id('tool_reorient')?.classList.remove('disabled')
          }
          break
        }
      }
    }
    this.svgCanvas.runExtensions({
      action: 'elementTransition',
      vars: { elems }
    })
  }

  // called when any element has changed
  /**
   * @listens module:svgcanvas.SvgCanvas#event:changed
   * @fires module:svgcanvas.SvgCanvas#event:ext_elementChanged
   */
  elementChanged (_win: unknown, elems: Element[]): void {
    const mode = this.svgCanvas.getMode()
    if (mode === 'select') {
      this.leftPanel.clickSelect()
    }

    elems.forEach((elem) => {
      const isSvgElem = elem?.tagName === 'svg'
      if (isSvgElem || this.svgCanvas.isLayer(elem as SVGGElement)) {
        this.layersPanel.populateLayers()
        // if the element changed was the svg, then it could be a resolution change
        if (isSvgElem) {
          this.updateCanvas(false, undefined)
        }
        // Update selectedElement if element is no longer part of the image.
        // This occurs for the text elements in Firefox
      } else if (elem && !this.selectedElement?.parentNode) {
        this.selectedElement = elem
      }
    })

    this.showSaveWarning = true

    // we update the contextual panel with potentially new
    // positional/sizing information (we DON'T want to update the
    // toolbar here as that creates an infinite loop)
    // also this updates the history buttons

    // we tell it to skip focusing the text control if the
    // text element was previously in focus
    this.topPanel.updateContextPanel()

    // In the event a gradient was flipped:
    if (this.selectedElement && mode === 'select') {
      this.bottomPanel.updateColorpickers(false)
    }

    this.svgCanvas.runExtensions({
      action: 'elementChanged',
      vars: { elems }
    })
  }

  elementRenamed (_win: unknown, renameObj: unknown): void {
    this.svgCanvas.runExtensions({
      action: 'elementRenamed',
      vars: { renameObj }
    })
  }

  afterClear (_win: unknown): void {
    this.svgCanvas.runExtensions({ action: 'afterClear' })
  }

  beforeClear (_win: unknown): void {
    this.svgCanvas.runExtensions({ action: 'beforeClear' })
  }

  zoomDone () {
    for (const el of this.svgCanvas.selectedElements) {
      if (el) this.svgCanvas.selectorManager.requestSelector(el)?.resize()
    }
    this.updateWireFrame()
  }

  /**
   * Handle a zoom event by computing the new zoom level and updating the canvas scroll position.
   * @function module:svgcanvas.SvgCanvas#zoomChanged
   * @listens module:svgcanvas.SvgCanvas#event:zoomed
   * @fires module:svgcanvas.SvgCanvas#event:ext_zoomChanged
   */
  zoomChanged (_win: unknown, bbox: unknown, autoCenter?: boolean): void {
    const scrbar = 15
    const zInfo = this.svgCanvas.setBBoxZoom(
      bbox,
      parseFloat(
        getComputedStyle(this.workarea, null).width.replace('px', '')
      ) - scrbar,
      parseFloat(
        getComputedStyle(this.workarea, null).height.replace('px', '')
      ) - scrbar
    )
    if (!zInfo) {
      return
    }
    const zoomlevel = zInfo.zoom
    const bb = zInfo.bbox as { x: number; y: number; width: number; height: number }

    if (zoomlevel < 0.001) {
      this.bottomPanel.changeZoom(String(0.1))
      return
    }

    ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (this.svgCanvas.getZoom() * 100).toFixed(1))

    if (autoCenter) {
      this.updateCanvas(false, undefined)
    } else {
      this.updateCanvas(false, {
        x: bb.x * zoomlevel + (bb.width * zoomlevel) / 2,
        y: bb.y * zoomlevel + (bb.height * zoomlevel) / 2
      })
    }

    if (this.svgCanvas.getMode() === 'zoom' && bb.width) {
      // Go to select if a zoom box was drawn
      this.leftPanel.clickSelect()
    }

    this.zoomDone()

    this.svgCanvas.runExtensions({
      action: 'zoomChanged',
      vars: this.svgCanvas.getZoom()
    })
  }

  /**
   * @listens module:svgcanvas.SvgCanvas#event:contextset
   */
  contextChanged (_win: unknown, context: Element | null): void {
    let str = ''
    let parents: Element[] = []
    if (context) {
      parents = (getParentsUntil(context, '#svgcontent') ?? []) as Element[]
      parents.forEach((parent: Element) => {
        if (parent.id) { str += ' > ' + parent.id }
      })
      this.curContext = str
    } else {
      this.curContext = null
    }
    const ctxPanel = $id('cur_context_panel')
    if (ctxPanel) {
      ctxPanel.style.display = context ? 'block' : 'none'
      // Build the breadcrumb via the DOM API — a selected element's id or the layer
      // title is untrusted (both survive the import sanitizer unvalidated) (#47).
      if (context) {
        renderContextPanel(ctxPanel, this.svgCanvas.getCurrentDrawing().getCurrentLayerName(), parents, context)
      } else {
        ctxPanel.replaceChildren()
      }
    }
  }

  /**
   * Replace the child content of a toolbar element with an icon image loaded from the configured imgPath.
   * @function module:SVGEditor.setIcon
   */
  setIcon (elem: string, iconId: string): void {
    const img = document.createElement('img')
    img.src = this.configObj.curConfig.imgPath + iconId
    // iconId is always a string (param type), so this branch always takes the img path.
    // The else branch is dead code preserved for historical compatibility.
    const icon: Node = img
    if (!icon) {
      console.warn('NOTE: Icon image missing: ' + iconId)
      // Audit input #6 — surface missing-icon to embed host so hosts can act on the gap; standalone callers still see the console.warn.
      this._embedServer?.emit('error', { message: `Icon image missing: ${iconId}`, source: 'missing-icon' })
      return
    }
    // empty()
    const target = $id(elem)
    if (!target) return
    while (target.firstChild) {
      target.removeChild(target.firstChild)
    }
    target.appendChild(icon)
  }

  /**
   * Replace the editor's swatch palette (the se-palette strip). Drives the core
   * palette store; se-palette re-renders via its subscription. Non-array input is
   * treated as empty (→ default palette). Invalid colours are dropped and surfaced
   * to embed hosts via an `error` event (mirrors the missing-icon pattern above).
   */
  setCustomPalette (colors: readonly unknown[]): void {
    setPaletteWithErrors(colors, (message) => {
      this._embedServer?.emit('error', { message, source: 'invalid-palette-color' })
    })
  }

  /**
   * @listens module:svgcanvas.SvgCanvas#event:extension_added
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async extAdded (_win: unknown, ext: { callback?: () => void; events?: { id: string; click: () => void } } | null): Promise<void> {
    if (!ext) {
      return undefined
    }
    let cbCalled = false

    const runCallback = () => {
      if (ext.callback && !cbCalled) {
        cbCalled = true
        ext.callback.call(this)
      }
    }

    if (ext.events) {
      this.leftPanel.add(ext.events.id, ext.events.click)
    }
    return runCallback()
  }

  zoomImage (multiplier?: number): void {
    const resolution = this.svgCanvas.getResolution()
    multiplier = multiplier ? resolution.zoom * multiplier : 1
    // setResolution(res.w * multiplier, res.h * multiplier, true);
    ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (multiplier * 100).toFixed(1))
    this.svgCanvas.setCurrentZoom(multiplier)
    this.zoomDone()
    this.updateCanvas(true, undefined)
  }

  cutSelected () {
    if (this.selectedElement || this.multiselected) {
      this.svgCanvas.cutSelectedElements()
    }
  }

  /**
   * Copy the currently selected element(s) to the internal clipboard.
   * @function copySelected
   */
  copySelected () {
    if (this.selectedElement || this.multiselected) {
      this.svgCanvas.copySelectedElements()
    }
  }

  pasteInCenter () {
    const { workarea } = this
    const zoom = this.svgCanvas.getZoom()
    const x =
      (workarea.scrollLeft +
        parseFloat(getComputedStyle(workarea, null).width.replace('px', '')) /
          2) /
        zoom -
      this.svgCanvas.contentW
    const y =
      (workarea.scrollTop +
        parseFloat(getComputedStyle(workarea, null).height.replace('px', '')) /
          2) /
        zoom -
      this.svgCanvas.contentH
    this.svgCanvas.pasteElements('point', x, y)
  }

  moveUpDownSelected (dir: 'Up' | 'Down'): void {
    if (this.selectedElement) {
      this.svgCanvas.moveUpDownSelected(dir)
    }
  }

  moveSelected (dx: number, dy: number): void {
    if (this.selectedElement || this.multiselected) {
      if (this.configObj.curConfig.gridSnapping) {
        // Use grid snap value regardless of zoom level
        const multi =
          this.svgCanvas.getZoom() * this.configObj.curConfig.snappingStep
        dx *= multi
        dy *= multi
      }
      this.svgCanvas.moveSelectedElements(dx, dy)
    }
  }

  selectNext () {
    this.svgCanvas.cycleElement(1)
  }

  selectPrev () {
    this.svgCanvas.cycleElement(0)
  }

  rotateSelected (cw: 0 | 1, step: number): void {
    if (!this.selectedElement || this.multiselected) {
      return
    }
    if (!cw) {
      step *= -1
    }
    const angle = Number.parseFloat(($id('angle') as HTMLInputElement | null)?.value ?? '0') + step
    this.svgCanvas.setRotationAngle(angle)
    this.topPanel.updateContextPanel()
  }

  hideSourceEditor (): void {
    const $editorDialog = $id('se-svg-editor-dialog')
    $editorDialog?.setAttribute('dialog', 'closed')
  }

  async saveSourceEditor (e: CustomEvent): Promise<void> {
    const $editorDialog = $id('se-svg-editor-dialog')
    if ($editorDialog?.getAttribute('dialog') !== 'open') return
    const saveChanges = () => {
      this.svgCanvas.clearSelection()
      this.hideSourceEditor()
      this.zoomImage()
      this.layersPanel.populateLayers()
    }

    if (!this.svgCanvas.setSvgString(typedDetail<{ value: string }>(e).value)) {
      const ok = await seConfirm(
        this.i18next.t('notification.QerrorsRevertToSource')
      )
      if (ok === 'Cancel') {
        return
      }
      saveChanges()
      return
    }
    saveChanges()
    this.leftPanel.clickSelect()
  }

  async cancelOverlays (e: CustomEvent): Promise<void> {
    $id('dialog_box')?.style.setProperty('display', 'none')
    const $editorDialog = $id('se-svg-editor-dialog')
    const editingsource = $editorDialog?.getAttribute('dialog') === 'open'
    if (!editingsource && !this.docprops && !this.configObj.preferences) {
      if (this.curContext) {
        this.svgCanvas.leaveContext()
      }
      return
    }

    if (editingsource) {
      const origSource = this.svgCanvas.getSvgString()
      if (origSource !== typedDetail<{ value: string }>(e).value) {
        const ok = await seConfirm(
          this.i18next.t('notification.QignoreSourceChanges')
        )
        if (ok !== 'Cancel') {
          this.hideSourceEditor()
        }
      } else {
        this.hideSourceEditor()
      }
    }
  }

  toggleDynamicOutput (e: Event): void {
    const detail = typedDetail<{ dynamic: boolean }>(e)
    this.configObj.curConfig.dynamicOutput = detail.dynamic
    this.svgCanvas.setConfig(this.configObj.curConfig)
    const $editorDialog = $id('se-svg-editor-dialog')
    const origSource = this.svgCanvas.getSvgString()
    $editorDialog?.setAttribute('dialog', 'open')
    $editorDialog?.setAttribute('value', origSource)
  }

  enableOrDisableClipboard () {
    let svgeditClipboard
    try {
      svgeditClipboard = this.storage?.getItem('svgedit_clipboard')
    } catch {
      /* empty fn */
    }
    this.canvMenu?.setAttribute(
      (svgeditClipboard ? 'en' : 'dis') + 'ablemenuitems',
      '#paste,#paste_in_place'
    )
  }

  /**
   * Prompt the user to confirm discarding unsaved changes before opening a new file.
   * @function module:SVGthis.openPrep
   * @returns Resolves to boolean indicating `true` if there were no changes
   *  and `false` after the user confirms.
   */
  openPrep (): Promise<boolean | string> {
    return this.documentIO.openPrep()
  }

  onDragEnter (e: DragEvent): void {
    e.stopPropagation()
    e.preventDefault()
    // and indicator should be displayed here, such as "drop files here"
  }

  onDragOver (e: DragEvent): void {
    e.stopPropagation()
    e.preventDefault()
  }

  onDragLeave (e: DragEvent): void {
    e.stopPropagation()
    e.preventDefault()
    // hypothetical indicator should be removed here
  }

  /**
   * Switch the editor UI language and rename the default layer if it used the old locale string.
   * @function module:SVGthis.setLang
   * @param allStrings See {@tutorial LocaleDocs}
   * @fires module:svgcanvas.SvgCanvas#event:ext_langReady
   * @fires module:svgcanvas.SvgCanvas#event:ext_langChanged
   */
  setLang (lang: string): void {
    this.langChanged = true
    this.configObj.pref('lang', lang)
    const $editDialog = $id('se-edit-prefs')
    $editDialog?.setAttribute('lang', lang)
    const oldLayerName = $id('#layerlist')?.querySelector('tr.layersel td.layername')?.textContent ?? ''
    const renameLayer =
      oldLayerName === this.i18next.t('notification.common.layer') + ' 1'

    // setTitles() — removed: method never existed; the index signature masked the TS error

    if (renameLayer) {
      this.svgCanvas.renameCurrentLayer(
        this.i18next.t('layers.layer') + ' 1'
      )
      this.layersPanel.populateLayers()
    }

    this.svgCanvas.runExtensions({
      action: 'langChanged',
      vars: lang
    })
  }

  /**
   * @callback module:SVGthis.ReadyCallback
   */
  /**
   * Queues a callback to be invoked when the editor is ready (or
   *   to be invoked immediately if it is already ready--i.e.,
   *   if `runCallbacks` has been run).
   * @function module:SVGthis.ready
   * @returns Resolves when all callbacks, including the supplied have resolved
   */
  ready (cb: () => unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve(cb())
        return
      }
      this.callbacks.push([cb, resolve, reject])
    })
  }

  /**
   * Invokes the callbacks previous set by `svgthis.ready`
   * @function module:SVGthis.runCallbacks
   * @returns Resolves to `undefined` if all callbacks succeeded and rejects otherwise
   */
  async runCallbacks () {
    try {
      await Promise.all(
        this.callbacks.map(([cb]) => {
          return cb()
        })
      )
    } catch (err) {
      this.callbacks.forEach(([, , reject]) => {
        reject()
      })
      throw err
    }
    this.callbacks.forEach(([, resolve]) => {
      resolve()
    })
    this.isReady = true
  }

  /**
   * Load an SVG string into the editor, waiting until the editor is ready before applying it.
   * @function module:SVGthis.loadFromString
   * @param [opts.noAlert=false] Option to avoid alert to user and instead get rejected promise
   */
  loadFromString (str: string, opts: { noAlert?: boolean | undefined } = {}): Promise<unknown> {
    return this.documentIO.loadFromString(str, opts)
  }

  /**
   * @callback module:SVGthis.URLLoadCallback
   */
  /**
   * Fetch an SVG from a URL and load it into the editor, waiting for the editor to be ready.
   * @function module:SVGthis.loadFromURL
   * @param url URL from which to load an SVG string via Ajax
   * @param [opts={}] May contain properties: `cache`, `callback`
   * @returns Resolves to `undefined` or rejects upon bad loading of
   *   the SVG (or upon failure to parse the loaded string) when `noAlert` is
   *   enabled
   */
  loadFromURL (url: string, opts: { cache?: boolean | undefined; noAlert?: boolean | undefined } = {}): Promise<unknown> {
    return this.documentIO.loadFromURL(url, opts)
  }

  /**
   * Decode a data URI (base64 or percent-encoded) and load the resulting SVG into the editor.
   * @function module:SVGthis.loadFromDataURI
   * @param str The Data URI to base64-decode (if relevant) and load
   * @returns Resolves to `undefined` and rejects if loading SVG string fails and `noAlert` is enabled
   */
  loadFromDataURI (str: string, opts: { noAlert?: boolean | undefined } = {}): Promise<unknown> {
    return this.documentIO.loadFromDataURI(str, opts)
  }

  /**
   * Register and initialize an extension by delegating to the canvas; must be called after canvas creation.
   * @function module:SVGthis.addExtension
   * @param name Used internally; no need for i18n.
   * @throws {Error} If called too early
   */
  addExtension (name: string, initfn: ((...args: unknown[]) => unknown) | false | undefined, initArgs: Record<string, unknown>): Promise<void> {
    // Note that we don't want this on this.ready since some extensions
    // may want to run before then (like server_opensave).
    if (!this.svgCanvas) {
      throw new Error('Extension added too early')
    }
    // Extensions may pass false/undefined when they have no init function.
    const fn = initfn || (() => ({}))
    return this.svgCanvas.addExtension(name, fn, initArgs as { importLocale: unknown })
  }
}

export default Editor
