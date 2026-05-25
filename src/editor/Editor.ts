/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-non-null-assertion */
/**
 * The main module for the visual SVG this.
 *
 * @license MIT
 *
 * @copyright 2010 Alexis Deveria
 * 2010 Pavol Rusnak
 * 2010 Jeff Schiller
 * 2010 Narendra Sisodiya
 * 2014 Brett Zamir
 * 2020 OptimistikSAS
 * @module SVGEditor
 */

import './components/index.js'
import './dialogs/index.js'
import { normalizeShortcut } from './common/shortcut.js'

import { isMac } from '@svgedit/svgcanvas/common/browser'

import SvgCanvas from '@svgedit/svgcanvas'
import ConfigObj from './ConfigObj.js'
import {
  putLocale
} from './locale.js'
import {
  hasCustomHandler, getCustomHandler, injectExtendedContextMenuItemsIntoDom
} from './contextmenu.js'
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration exists yet
import editorTemplate from './templates/editorTemplate.html'
import Rulers from './Rulers.js'
import LeftPanel from './panels/LeftPanel.js'
import TopPanel from './panels/TopPanel.js'
import BottomPanel from './panels/BottomPanel.js'
import LayersPanel from './panels/LayersPanel.js'
import MainMenu from './MainMenu.js'
import { getParentsUntil } from '@svgedit/svgcanvas/common/util.js'
import { EmbedServer } from '../embed/server.js'
const SVGEDIT_VERSION = '7.4.1'

/** Make window.svgEditor accessible */
declare global {
  interface Window {
    svgEditor: Editor
  }
}

const { $id, $click, decode64, convertUnit } = SvgCanvas

/**
 *
 */
class Editor {
  // --- Properties from Editor ---
  langChanged: boolean
  showSaveWarning: boolean
  storagePromptState: 'ignore' | 'waiting' | 'closed'
  title: string
  $click: typeof $click
  customExportImage: boolean
  customExportPDF: boolean
  callbacks: any[]
  curContext: string | null
  exportWindowName: string | null
  docprops: boolean
  shortcuts: any[]
  /** Embed-API server instance; accessible for calling .ready() and wiring canvas events. */
  public readonly _embedServer!: EmbedServer

  // --- Properties (startup own) ---
  extensionsAdded: boolean
  messageQueue: any[]
  $container: HTMLElement

  // --- Properties (startup forward-declared) ---
  configObj!: any
  svgCanvas!: any
  i18next!: any
  $svgEditor!: HTMLElement
  workarea!: HTMLElement
  leftPanel!: any
  bottomPanel!: any
  topPanel!: any
  layersPanel!: any
  mainMenu!: any
  rulers!: Rulers
  canvMenu!: HTMLElement | null
  exportWindow!: Window | null
  defaultImageURL!: string
  uiContext!: string
  selectedElement!: Element | null
  multiselected!: boolean
  enableToolCancel!: boolean
  modeEvent!: any
  exportWindowCt!: number
  goodLangs!: string[]
  storage!: Storage | null
  isReady!: boolean
  setPanning!: (active: boolean) => void
  setConfig!: (...args: any[]) => any

  /**
   *
   */
  constructor (div: HTMLElement | null = null) {
    this.extensionsAdded = false
    this.messageQueue = []
    this.$container = (div ?? $id('svg_editor')) as HTMLElement
    /**
     */
    this.langChanged = false
    /**
     */
    this.showSaveWarning = false
    /**
     * Will be set to a boolean by `ext-storage.js`
     */
    this.storagePromptState = 'ignore'
    /**
     * document title
     */
    this.title = 'untitled.svg'

    this.svgCanvas = null
    this.$click = $click
    this.isReady = false
    this.customExportImage = false
    this.customExportPDF = false
    this.configObj = new ConfigObj(this)
    this.configObj.pref = this.configObj.pref.bind(this.configObj)
    this.setConfig = this.configObj.setConfig.bind(this.configObj)
    this.callbacks = []
    this.curContext = null
    this.exportWindowName = null
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
    window.svgEditor = this

    // Embed-API wire-in (Task 11). Activates only when ?embed=1 OR window.parent !== window.
    // Default dialog handlers wrap existing window.seAlert / window.seConfirm (see ambient declarations above).
    // svgCanvas event binding is deferred to init() where svgCanvas is actually created.
    ;(this as { _embedServer: EmbedServer })._embedServer = new EmbedServer(this as any, {
      version: SVGEDIT_VERSION,
      defaultDialogHandlers: {
        alert: (msg) => { seAlert(msg); return Promise.resolve() },
        confirm: async (msg) => Boolean(await seConfirm(msg)),
        prompt: (_msg, def) => {
          // V7 lacks a real prompt-with-input (audit input #4 — seStatusDialog (formerly sePromptDialog) is status-display).
          // Until #13 adds a real prompt, return the default; hosts that need real prompts must register a handler.
          return Promise.resolve(def ?? null)
        }
      }
    })
  } // end Constructor

  /**
  * Auto-run after a Promise microtask.
  * @function module:SVGthis.init
  */
  async init () {
    if ('localStorage' in window) {
      this.storage = window.localStorage
    }
    this.configObj.load()
    const { i18next } = await putLocale(this.configObj.pref('lang'), this.goodLangs)
    this.i18next = i18next
    await import('./components/index.js')
    await import('./dialogs/index.js')
    try {
      // add editor components to the DOM
      const template = document.createElement('template')
      template.innerHTML = editorTemplate
      this.$container.append(template.content.cloneNode(true))
      this.$svgEditor = this.$container.querySelector('.svg_editor') as HTMLElement
      // allow to prepare the dom without display
      this.$svgEditor.style.visibility = 'hidden'
      this.workarea = $id('workarea') as HTMLElement
      // Image props dialog added to DOM
      const newSeImgPropDialog = document.createElement('se-img-prop-dialog') as any
      newSeImgPropDialog.setAttribute('id', 'se-img-prop')
      this.$container.append(newSeImgPropDialog)
      newSeImgPropDialog.init(this.i18next)
      // editor prefences dialoag added to DOM
      const newSeEditPrefsDialog = document.createElement('se-edit-prefs-dialog') as any
      newSeEditPrefsDialog.setAttribute('id', 'se-edit-prefs')
      this.$container.append(newSeEditPrefsDialog)
      newSeEditPrefsDialog.init(this.i18next)
      // canvas menu added to DOM
      const dialogBox = document.createElement('se-cmenu_canvas-dialog') as any
      dialogBox.setAttribute('id', 'se-cmenu_canvas')
      this.$container.append(dialogBox)
      dialogBox.init(this.i18next)
      // alertDialog added to DOM
      const alertBox = document.createElement('se-alert-dialog') as any
      alertBox.setAttribute('id', 'se-alert-dialog')
      this.$container.append(alertBox)
      // promptDialog added to DOM
      const promptBox = document.createElement('se-status-dialog') as any
      promptBox.setAttribute('id', 'se-status-dialog')
      this.$container.append(promptBox)
      // Export dialog added to DOM
      const exportDialog = document.createElement('se-export-dialog') as any
      exportDialog.setAttribute('id', 'se-export-dialog')
      this.$container.append(exportDialog)
      exportDialog.init(this.i18next)
    } catch (err) {
      console.error(err)
    }

    /**
    * @name module:SVGthis.canvas
    */
    this.svgCanvas = new SvgCanvas(
      $id('svgcanvas') as HTMLElement,
      this.configObj.curConfig
    )

    // once svgCanvas is init - adding listener to the changes of the current mode
    this.modeEvent = this.svgCanvas.modeEvent
    document.addEventListener('modeChange', (evt) => this.modeListener(evt))

    /** if true - selected tool can be cancelled with Esc key
     * disables on dragging (mousedown) to avoid changing mode in the middle of drawing
    */
    this.enableToolCancel = true

    this.leftPanel.init()
    this.bottomPanel.init()
    this.topPanel.init()
    this.layersPanel.init()
    this.mainMenu.init()

    const { undoMgr } = this.svgCanvas
    this.canvMenu = $id('se-cmenu_canvas')
    this.exportWindow = null
    this.defaultImageURL = `${this.configObj.curConfig.imgPath}/logo.svg`
    const zoomInIcon = 'crosshair'
    const zoomOutIcon = 'crosshair'
    this.uiContext = 'toolbars'

    // For external openers — let the opener/parent know svgedit is ready
    const w = window.opener || window.parent
    if (w) {
      try {
        w.document.documentElement.dispatchEvent(
          new w.CustomEvent('svgEditorReady', { bubbles: true, cancelable: true })
        )
      } catch { /* cross-origin — ignore */ }
    }

    this.rulers = new Rulers(this)

    this.layersPanel.populateLayers()
    this.selectedElement = null
    this.multiselected = false

    const aLink = $id('cur_context_panel')

    $click(aLink as EventTarget, (evt: Event) => {
      const link = evt.target as Element | null
      if (link?.hasAttribute('data-root')) {
        this.svgCanvas.leaveContext()
      } else {
        this.svgCanvas.setContext(link?.textContent ?? '')
      }
      this.svgCanvas.clearSelection()
      return false
    })

    // bind the selected event to our function that handles updates to the UI
    this.svgCanvas.bind('selected', this.selectedChanged.bind(this))
    this.svgCanvas.bind('transition', this.elementTransition.bind(this))
    this.svgCanvas.bind('changed', this.elementChanged.bind(this))
    this.svgCanvas.bind('exported', this.exportHandler.bind(this))
    this.svgCanvas.bind('exportedPDF', (_win: any, data: any) => {
      if (!data.output) { // Ignore Chrome
        return
      }
      const { exportWindowName } = data
      if (exportWindowName) {
        this.exportWindow = window.open('', this.exportWindowName ?? undefined) // A hack to get the window via JSON-able name without opening a new one
      }
      if (!this.exportWindow || this.exportWindow.closed) {
        seAlert(this.i18next.t('notification.popupWindowBlocked'))
        return
      }
      this.exportWindow.location.href = data.output
    })
    this.svgCanvas.bind('zoomed', this.zoomChanged.bind(this))
    this.svgCanvas.bind('zoomDone', this.zoomDone.bind(this))
    this.svgCanvas.bind(
      'updateCanvas',
      /**
     * @param win
     * @param centerInfo
     * @param centerInfo.center
     * @param centerInfo.newCtr
     * @listens module:svgcanvas.SvgCanvas#event:updateCanvas
     */
      (_win: any, { center, newCtr }: { center: boolean; newCtr: { x: number; y: number } }) => {
        this.updateCanvas(center, newCtr)
      }
    )
    this.svgCanvas.bind('contextset', this.contextChanged.bind(this))
    this.svgCanvas.bind('extension_added', this.extAdded.bind(this))
    this.svgCanvas.bind('elementRenamed', this.elementRenamed.bind(this))

    this.svgCanvas.bind('beforeClear', this.beforeClear.bind(this))
    this.svgCanvas.bind('afterClear', this.afterClear.bind(this))

    this.svgCanvas.textActions.setInputElem($id('text'))

    this.setBackground(String(this.configObj.pref('bkgd_color') ?? ''), String(this.configObj.pref('bkgd_url') ?? ''))

    // update resolution option with actual resolution
    const res = this.svgCanvas.getResolution()
    if (this.configObj.curConfig.baseUnit !== 'px') {
      res.w = convertUnit(res.w) + this.configObj.curConfig.baseUnit
      res.h = convertUnit(res.h) + this.configObj.curConfig.baseUnit
    }
    $id('se-img-prop')?.setAttribute('dialog', 'close')
    $id('se-img-prop')?.setAttribute('title', this.svgCanvas.getDocumentTitle())
    $id('se-img-prop')?.setAttribute('width', String(res.w))
    $id('se-img-prop')?.setAttribute('height', String(res.h))
    $id('se-img-prop')?.setAttribute('save', String(this.configObj.pref('img_save') ?? ''))

    // Lose focus for select elements when changed (Allows keyboard shortcuts to work better)
    const selElements = document.querySelectorAll('select')
    Array.from(selElements).forEach(function (element) {
      element.addEventListener('change', function (evt) {
        ;(evt.currentTarget as HTMLElement)?.blur()
      })
    })

    // fired when user wants to move elements to another layer
    let promptMoveLayerOnce = false
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    $id('selLayerNames')?.addEventListener('change', async (evt) => {
      const destLayer = (evt as any).detail.value
      if (!destLayer) return
      if (promptMoveLayerOnce) {
        promptMoveLayerOnce = true
        this.svgCanvas.moveSelectedToLayer(destLayer)
        this.svgCanvas.clearSelection()
        this.layersPanel.populateLayers()
      } else {
        const confirmStr = this.i18next.t('notification.QmoveElemsToLayer').replace('%s', destLayer)
        const ok = await seConfirm(confirmStr)
        if (ok === 'Cancel') return
        promptMoveLayerOnce = true
        this.svgCanvas.moveSelectedToLayer(destLayer)
        this.svgCanvas.clearSelection()
        this.layersPanel.populateLayers()
      }
    })
    $id('tool_font_family')?.addEventListener('change', (evt) => {
      this.svgCanvas.setFontFamily((evt as any).detail.value)
    })

    $id('seg_type')?.addEventListener('change', (evt) => {
      this.svgCanvas.setSegType((evt as any).detail.value)
    })

    const addListenerMulti = (element: HTMLElement, eventNames: string, listener: EventListener) => {
      eventNames.split(' ').forEach((eventName) => element.addEventListener(eventName, listener, false))
    }

    addListenerMulti($id('text') as HTMLElement, 'keyup input', (evt: Event) => {
      this.svgCanvas.setTextContent((evt.currentTarget as HTMLInputElement).value)
    })

    $id('link_url')?.addEventListener('change', (evt) => {
      const val = (evt.currentTarget as HTMLInputElement).value
      if (val.length) {
        this.svgCanvas.setLinkURL(val)
      } else {
        this.svgCanvas.removeHyperlink()
      }
    })

    $id('g_title')?.addEventListener('change', (evt) => {
      this.svgCanvas.setGroupTitle((evt.currentTarget as HTMLInputElement).value)
    })

    let lastX = 0; let lastY = 0
    let panning = false; let keypan = false
    let previousMode = 'select'

    $id('svgcanvas')?.addEventListener('mouseup', (evt) => {
      if (panning === false) { return true }

      this.workarea.scrollLeft -= (evt.clientX - lastX)
      this.workarea.scrollTop -= (evt.clientY - lastY)

      lastX = evt.clientX
      lastY = evt.clientY

      if (evt.type === 'mouseup') { panning = false }
      return false
    })
    $id('svgcanvas')?.addEventListener('mousemove', (evt) => {
      if (panning === false) { return true }

      this.workarea.scrollLeft -= (evt.clientX - lastX)
      this.workarea.scrollTop -= (evt.clientY - lastY)

      lastX = evt.clientX
      lastY = evt.clientY

      if (evt.type === 'mouseup') { panning = false }
      return false
    })
    $id('svgcanvas')?.addEventListener('mousedown', (evt) => {
      this.enableToolCancel = false
      if (evt.button === 1 || keypan === true) {
        // prDefault to avoid firing of browser's panning on mousewheel
        evt.preventDefault()
        panning = true
        previousMode = this.svgCanvas.getMode()
        this.svgCanvas.setMode('ext-panning')
        this.workarea.style.cursor = 'grab'
        lastX = evt.clientX
        lastY = evt.clientY
        return false
      }
      return true
    })

    // preventing browser's scaling with Ctrl+wheel
    this.$container.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    })

    window.addEventListener('mouseup', (evt) => {
      this.enableToolCancel = true
      if (evt.button === 1) {
        this.svgCanvas.setMode(previousMode ?? 'select')
      }
      panning = false
    })

    // Allows quick change to the select mode while panning mode is active
    this.workarea.addEventListener('dblclick', (_evt) => {
      if (this.svgCanvas.getMode() === 'ext-panning') {
        this.leftPanel.clickSelect()
      }
    })

    document.addEventListener('keydown', (e) => {
      if ((e.target as Element)?.nodeName !== 'BODY') return
      if (e.code.toLowerCase() === 'space') {
        this.svgCanvas.spaceKey = keypan = true
        e.preventDefault()
      } else if ((e.key.toLowerCase() === 'shift') && (this.svgCanvas.getMode() === 'zoom')) {
        this.workarea.style.cursor = zoomOutIcon
        e.preventDefault()
      }
    })

    // Add a new shortcut for zoom in/out : Alt + Wheels
    this.workarea.addEventListener('wheel', (e) => {
      if (e.altKey) {
        e.preventDefault()
        this.svgCanvas.setZoom(e.deltaY > 0 ? this.svgCanvas.getZoom() * 0.9 : this.svgCanvas.getZoom() * 1.1, true)
        this.updateCanvas(true)
        ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (this.svgCanvas.getZoom() * 100).toFixed(1))
      }
    })

    document.addEventListener('keyup', (e) => {
      if ((e.target as Element)?.nodeName !== 'BODY') return
      if (e.code.toLowerCase() === 'space') {
        this.svgCanvas.spaceKey = keypan = false
        this.svgCanvas.setMode(previousMode === 'ext-panning' ? 'select' : previousMode ?? 'select')
        e.preventDefault()
      } else if ((e.key.toLowerCase() === 'shift') && (this.svgCanvas.getMode() === 'zoom')) {
        this.workarea.style.cursor = zoomInIcon
        e.preventDefault()
      }
    })

    /**
     * @function module:SVGthis.setPanning
     * @param active
     */
    this.setPanning = (active) => {
      this.svgCanvas.spaceKey = keypan = active
    }
    let inp: HTMLElement | null = null
    /**
      *
      */
    const unfocus = () => {
      inp?.blur()
    }

    const liElems = this.$svgEditor.querySelectorAll('button, select, input:not(#text)')
    Array.prototype.forEach.call(liElems, (el: HTMLElement) => {
      el.addEventListener('focus', (e) => {
        inp = e.currentTarget as HTMLElement
        this.uiContext = 'toolbars'
        this.workarea.addEventListener('mousedown', unfocus)
      })
      el.addEventListener('blur', () => {
        this.uiContext = 'canvas'
        this.workarea.removeEventListener('mousedown', unfocus)
        // Go back to selecting text if in textedit mode
        if (this.svgCanvas.getMode() === 'textedit') {
          $id('text')?.focus()
        }
      })
    })
    // ref: https://stackoverflow.com/a/1038781
    const getMaxDimension = (prop: 'Width' | 'Height') =>
      Math.max(
        (document.body as any)[`scroll${prop}`],
        (document.documentElement as any)[`scroll${prop}`],
        (document.body as any)[`offset${prop}`],
        (document.documentElement as any)[`offset${prop}`],
        (document.documentElement as any)[`client${prop}`]
      )
    const winWh = {
      width: getMaxDimension('Width'),
      height: getMaxDimension('Height')
    }

    window.addEventListener('resize', () => {
      Object.entries(winWh).forEach(([type, val]) => {
        const curval = (type === 'width') ? window.innerWidth - 15 : window.innerHeight
        const scrollProp = ('scroll' + (type === 'width' ? 'Left' : 'Top')) as 'scrollLeft' | 'scrollTop'
        this.workarea[scrollProp] -= (curval - val) / 2
        ;(winWh as Record<string, number>)[type] = curval
      })
    })

    this.workarea.addEventListener('scroll', () => {
      this.rulers.manageScroll()
    })

    if ($id('stroke_width')) ($id('stroke_width') as HTMLInputElement).value = String(this.configObj.curConfig.initStroke.width)
    if ($id('opacity')) ($id('opacity') as HTMLInputElement).value = String(this.configObj.curConfig.initOpacity * 100)
    const elements = document.getElementsByClassName('push_button')
    Array.from(elements).forEach(function (element) {
      element.addEventListener('mousedown', function (event) {
        const cur = (event.currentTarget as HTMLElement)
        if (!cur.classList.contains('disabled')) {
          cur.classList.add('push_button_pressed')
          cur.classList.remove('push_button')
        }
      })
      element.addEventListener('mouseout', function (event) {
        const cur = (event.currentTarget as HTMLElement)
        cur.classList.add('push_button')
        cur.classList.remove('push_button_pressed')
      })
      element.addEventListener('mouseup', function (event) {
        const cur = (event.currentTarget as HTMLElement)
        cur.classList.add('push_button')
        cur.classList.remove('push_button_pressed')
      })
    })

    this.layersPanel.populateLayers()

    const centerCanvas = () => {
      // this centers the canvas vertically in the this.workarea (horizontal handled in CSS)
      this.workarea.style.lineHeight = this.workarea.style.height
    }

    ;['load', 'resize'].forEach((ev) => window.addEventListener(ev, centerCanvas))

    // Prevent browser from erroneously repopulating fields
    const inputEles = document.querySelectorAll('input')
    Array.from(inputEles).forEach(function (inputEle) {
      inputEle.setAttribute('autocomplete', 'off')
    })
    const selectEles = document.querySelectorAll('select')
    Array.from(selectEles).forEach(function (inputEle) {
      inputEle.setAttribute('autocomplete', 'off')
    })

    $id('se-svg-editor-dialog')?.addEventListener('change', (e: any) => {
      if (e?.detail?.copy === 'click') {
        void this.cancelOverlays(e)
      } else if (e?.detail?.dialog === 'dynamic') {
        this.toggleDynamicOutput(e)
      } else if (e?.detail?.dialog === 'closed') {
        this.hideSourceEditor()
      } else {
        void this.saveSourceEditor(e)
      }
    })
    $id('se-cmenu_canvas')?.addEventListener('change', (e: any) => {
      const action = e?.detail?.trigger
      switch (action) {
        case 'delete':
          this.svgCanvas.deleteSelectedElements()
          break
        case 'cut':
          this.cutSelected()
          break
        case 'copy':
          this.copySelected()
          break
        case 'paste':
          this.svgCanvas.pasteElements()
          break
        case 'paste_in_place':
          this.svgCanvas.pasteElements('in_place')
          break
        case 'group':
        case 'group_elements':
          this.svgCanvas.groupSelectedElements()
          break
        case 'ungroup':
          this.svgCanvas.ungroupSelectedElement()
          break
        case 'move_front':
          this.svgCanvas.moveToTopSelectedElement()
          break
        case 'move_up':
          this.moveUpDownSelected('Up')
          break
        case 'move_down':
          this.moveUpDownSelected('Down')
          break
        case 'move_back':
          this.svgCanvas.moveToBottomSelectedElement()
          break
        default:
          if (hasCustomHandler(action)) {
            getCustomHandler(action).call(null)
          }
          break
      }
    })

    // Select given tool
    void this.ready(() => {
      const preTool = $id(`tool_${this.configObj.curConfig.initTool}`)
      const regTool = $id(this.configObj.curConfig.initTool)
      const selectTool = $id('tool_select')
      const $editDialog = $id('se-edit-prefs')

      if (preTool) {
        preTool.click()
      } else if (regTool) {
        regTool.click()
      } else {
        selectTool?.click()
      }

      if (this.configObj.curConfig.wireframe) {
        $id('tool_wireframe')?.click()
      }

      if (this.configObj.curConfig.showRulers) {
        this.rulers.display(true)
      } else {
        this.rulers.display(false)
      }

      if (this.configObj.curConfig.showRulers) {
        $editDialog?.setAttribute('showrulers', 'true')
      }

      if (this.configObj.curConfig.baseUnit) {
        $editDialog?.setAttribute('baseunit', this.configObj.curConfig.baseUnit)
      }

      if (this.configObj.curConfig.gridSnapping) {
        $editDialog?.setAttribute('gridsnappingon', 'true')
      }

      if (this.configObj.curConfig.snappingStep) {
        $editDialog?.setAttribute('gridsnappingstep', String(this.configObj.curConfig.snappingStep))
      }

      if (this.configObj.curConfig.gridColor) {
        $editDialog?.setAttribute('gridcolor', this.configObj.curConfig.gridColor)
      }

      if (this.configObj.curConfig.dynamicOutput) {
        $editDialog?.setAttribute('dynamicoutput', 'true')
      }
    })

    // zoom
    ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (this.svgCanvas.getZoom() * 100).toFixed(1))
    this.canvMenu?.setAttribute('disableallmenu', 'true')
    this.canvMenu?.setAttribute('enablemenuitems', '#delete,#cut,#copy')

    this.enableOrDisableClipboard()

    window.addEventListener('storage', (e) => {
      if (e.key !== 'svgedit_clipboard') { return }

      this.enableOrDisableClipboard()
    })

    window.addEventListener('beforeunload', (e) => {
    // Suppress warning if page is empty
      if (undoMgr.getUndoStackSize() === 0) {
        this.showSaveWarning = false
      }

      // showSaveWarning is cleared by Editor.markSaved(), called from save
      // extensions (ext-opensave) after the document is successfully persisted.
      if (!this.configObj.curConfig.no_save_warning && this.showSaveWarning) {
      // Browser already asks question about closing the page
        e.returnValue = this.i18next.t('notification.unsavedChanges') // Firefox needs this when beforeunload set by addEventListener (even though message is not used)
        return this.i18next.t('notification.unsavedChanges')
      }
      return true
    })

    // Use HTML5 File API: http://www.w3.org/TR/FileAPI/
    // if browser has HTML5 File API support, then we will show the open menu item
    // and provide a file input to click. When that change event fires, it will
    // get the text contents of the file and send it to the canvas

    this.workarea.addEventListener('dragenter', this.onDragEnter.bind(this))
    this.workarea.addEventListener('dragover', this.onDragOver.bind(this))
    this.workarea.addEventListener('dragleave', this.onDragLeave.bind(this))

    this.updateCanvas(true)
    // Load extensions
    void this.extAndLocaleFunc()
    // Defer injection to wait out initial menu processing. This probably goes
    //    away once all context menu behavior is brought to context menu.
    void this.ready(() => {
      injectExtendedContextMenuItemsIntoDom()
    })
    // run callbacks stored by this.ready
    await this.runCallbacks()
    // Signal readiness to same-document listeners (tests/debugging hooks)
    document.dispatchEvent(new CustomEvent('svgedit:ready', { detail: this }))

    // Embed-API: fire ready() now that svgCanvas exists and all callbacks have run (Task 11).
    this._embedServer?.ready()

    // Wire svgCanvas events to embed event channel (Task 11).
    // svgCanvas.bind() REPLACES the existing handler (returns the previous one). The editor binds
    // its own selectedChanged + elementChanged earlier in init() — we must chain to them, not clobber.
    type ScHandler = (...args: unknown[]) => unknown
    const sc = this.svgCanvas as { bind?: (name: string, fn: ScHandler) => ScHandler | undefined } | null
    if (sc != null && typeof sc.bind === 'function') {
      let changeTimer: ReturnType<typeof setTimeout> | null = null
      const scheduleChange = (): void => {
        if (changeTimer) clearTimeout(changeTimer)
        changeTimer = setTimeout(() => { this._embedServer?.emit('change', {}) }, 200)
      }
      const prevChanged = sc.bind('changed', (...args: unknown[]) => {
        if (prevChanged) prevChanged(...args)
        scheduleChange()
      })
      // 'sourcechanged' fires when loadFromString/loadFromURL replaces the whole document;
      // the 'changed' event is NOT fired in that path, so we must bind both.
      const prevSourceChanged = sc.bind('sourcechanged', (...args: unknown[]) => {
        if (prevSourceChanged) prevSourceChanged(...args)
        scheduleChange()
      })
      const prevSelected = sc.bind('selected', (...args: unknown[]) => {
        if (prevSelected) prevSelected(...args)
        // svgCanvas.call invokes handlers with (window, arg) — selection array is args[1].
        const selected = args[1]
        const arr = Array.isArray(selected) ? selected as Element[] : []
        this._embedServer?.emit('selection-changed', {
          count: arr.length,
          ids: arr.map(e => e?.id).filter((s): s is string => typeof s === 'string' && s.length > 0)
        })
      })
      // v1.1 (PR-B audit #1) — bridge the 4 new group/move bus events to the embed channel.
      // Payloads are empty: hosts can call getSelectedElements / etc. if details are needed.
      // Chain-to-previous keeps ext-connector's bindings working (it binds before-group + after-move).
      const prevBeforeGroup = sc.bind('before-group', (...args: unknown[]) => {
        if (prevBeforeGroup) prevBeforeGroup(...args)
        this._embedServer?.emit('before-group', {})
      })
      const prevAfterGroup = sc.bind('after-group', (...args: unknown[]) => {
        if (prevAfterGroup) prevAfterGroup(...args)
        this._embedServer?.emit('after-group', {})
      })
      const prevBeforeMove = sc.bind('before-move', (...args: unknown[]) => {
        if (prevBeforeMove) prevBeforeMove(...args)
        this._embedServer?.emit('before-move', {})
      })
      const prevAfterMove = sc.bind('after-move', (...args: unknown[]) => {
        if (prevAfterMove) prevAfterMove(...args)
        this._embedServer?.emit('after-move', {})
      })
    }
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
            const imported = await import(/* @vite-ignore */ `${this.configObj.curConfig.extPath}/${encodeURIComponent(extname)}/${encodeURIComponent(extname)}.js`)
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
            const imported = await import(/* @vite-ignore */ encodeURI(pathName))
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
        * @param _win
        * @param _data
        * @listens module:SvgCanvas#event:extensions_added
        */
        (_win: any, _data: any) => {
          this.extensionsAdded = true
          this.setAll()

          if (this.storagePromptState === 'ignore') {
            this.updateCanvas(true)
          }

          this.messageQueue.forEach(
            /**
             * @param messageObj
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
   * @param mode
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
   * @param str SVG string
   * @param [opts={}]
   * @param [opts.noAlert]
   * @throws {Error} Upon failure to load SVG
   */
  loadSvgString (str: string, { noAlert }: { noAlert?: boolean | undefined } = {}): void {
    const success = this.svgCanvas.setSvgString(str) !== false
    if (success) {
      this.updateCanvas(false, undefined)
      return
    }
    if (!noAlert) seAlert(this.i18next.t('notification.errorLoadingSVG'))
    throw new Error('Error loading SVG')
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
   * @function module:SVGthis.randomizeIds
   * @param arg
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

    this.shortcuts.forEach((shortcut: any) => {
      // Bind function to shortcut key
      if (shortcut.key) {
        // Set shortcut based on options
        // TODO: see todo #10 — audit-flagged shortcut normalization at :410-412; preserved verbatim
        let keyval = shortcut.key
        let pd = false
        if (Array.isArray(shortcut.key)) {
          keyval = shortcut.key[0]
          if (shortcut.key.length > 1) {
            pd = shortcut.key[1]
          }
        }
        keyval = String(keyval)
        const { fn } = shortcut
        // Split on '/' for alternative keys (e.g., 'DELETE/BACKSPACE'). The dict
        // lookup must use the canonical UPPERCASE_KEY form per normalizeShortcut().
        ;(keyval as string).split('/').forEach((key: string) => {
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      keyHandler[key]!.fn()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      if (keyHandler[key]!.pd) {
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

  /**
   * @param sel Selector to match
   */
  getButtonData (sel: string): any {
    return Object.values(this.shortcuts).find((btn: any) => {
      return btn.sel === sel
    })
  }

  /**
   * @param win
   * @param data
   * @listens module:svgcanvas.SvgCanvas#event:exported
   */
  exportHandler (_win: any, data: any): void {
    const { issues, exportWindowName } = data
    this.exportWindow = window.open('', exportWindowName) // A hack to get the window via JSON-able name without opening a new one
    if (!this.exportWindow || this.exportWindow.closed) {
      seAlert(this.i18next.t('notification.popupWindowBlocked'))
      return
    }

    this.exportWindow.location.href = data.bloburl || data.datauri
    const done = this.configObj.pref('export_notice_done')
    if (done !== 'all') {
      let note = this.i18next.t('notification.saveFromBrowser', {
        type: data.type
      })

      // Check if there are issues
      if (issues.length) {
        const pre = '\n \u2022 '
        note +=
          '\n\n' +
          this.i18next.t('notification.noteTheseIssues') +
          pre +
          issues.join(pre)
      }
      // Note that this will also prevent the notice even though new issues may appear later.
      // May want to find a way to deal with that without annoying the user
      this.configObj.pref('export_notice_done', 'all')
      seAlert(note)
    }
  }

  /**
   *
   * @param color
   * @param url
   */
  setBackground (color: string, url: string): void {
    // if (color == this.configObj.pref('bkgd_color') && url == this.configObj.pref('bkgd_url')) { return; }
    this.configObj.pref('bkgd_color', color)
    this.configObj.pref('bkgd_url', url, true)

    // This should be done in  this.svgCanvas.js for the borderRect fill
    this.svgCanvas.setBackground(color, url)
  }

  /**
   * @function module:SVGthis.updateCanvas
   * @param center
   * @param newCtr
   */
  updateCanvas (center?: boolean, newCtr?: { x: number; y: number }): void {
    const zoom = this.svgCanvas.getZoom()
    const { workarea } = this
    const cnvs = $id('svgcanvas')

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
      parseFloat(getComputedStyle(cnvs!, null).height.replace('px', '')) / 2
    const oldCanX =
      parseFloat(getComputedStyle(cnvs!, null).width.replace('px', '')) / 2

    cnvs!.style.width = w + 'px'
    cnvs!.style.height = h + 'px'
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
      if ($id('dialog_box') != null) $id('dialog_box')!.style.display = 'none'
    }
  }

  /**
   *
   */
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
   * @param win
   * @param elems Array of elements that were selected
   * @listens module:svgcanvas.SvgCanvas#event:selected
   * @fires module:svgcanvas.SvgCanvas#event:ext_selectedChanged
   */
  selectedChanged (_win: any, elems: any[]): void {
    const mode = this.svgCanvas.getMode()
    if (mode === 'select') {
      this.leftPanel.clickSelect()
    }
    const isNode = mode === 'pathedit'
    // if this.elems[1] is present, then we have more than one element
    this.selectedElement = elems.length === 1 || !elems[1] ? elems[0] : null
    this.multiselected = elems.length >= 2 && !!elems[1]
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
   * @param win
   * @param elems
   * @listens module:svgcanvas.SvgCanvas#event:transition
   * @fires module:svgcanvas.SvgCanvas#event:ext_elementTransition
   */
  elementTransition (_win: any, elems: any[]): void {
    const mode = this.svgCanvas.getMode()
    const elem = elems[0]

    if (!elem) {
      return
    }

    this.multiselected = elems.length >= 2 && elems[1]
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
   * @param win
   * @param elems
   * @listens module:svgcanvas.SvgCanvas#event:changed
   * @fires module:svgcanvas.SvgCanvas#event:ext_elementChanged
   */
  elementChanged (_win: any, elems: any[]): void {
    const mode = this.svgCanvas.getMode()
    if (mode === 'select') {
      this.leftPanel.clickSelect()
    }

    elems.forEach((elem) => {
      const isSvgElem = elem?.tagName === 'svg'
      if (isSvgElem || this.svgCanvas.isLayer(elem)) {
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
      this.bottomPanel.updateColorpickers()
    }

    this.svgCanvas.runExtensions({
      action: 'elementChanged',
      vars: { elems }
    })
  }

  /**
   */
  elementRenamed (_win: any, renameObj: any): void {
    this.svgCanvas.runExtensions({
      action: 'elementRenamed',
      vars: { renameObj }
    })
  }

  /**
   */
  afterClear (_win: any): void {
    this.svgCanvas.runExtensions({ action: 'afterClear' })
  }

  /**
   */
  beforeClear (_win: any): void {
    this.svgCanvas.runExtensions({ action: 'beforeClear' })
  }

  /**
   */
  zoomDone () {
    for (const el of this.svgCanvas.selectedElements) {
      this.svgCanvas.selectorManager.requestSelector(el).resize()
    }
    this.updateWireFrame()
  }

  /**
   * @function module:svgcanvas.SvgCanvas#zoomChanged
   * @param win
   * @param bbox
   * @param autoCenter
   * @listens module:svgcanvas.SvgCanvas#event:zoomed
   * @fires module:svgcanvas.SvgCanvas#event:ext_zoomChanged
   */
  zoomChanged (_win: any, bbox: any, autoCenter?: boolean): void {
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
    const bb = zInfo.bbox

    if (zoomlevel < 0.001) {
      this.bottomPanel.changeZoom(0.1)
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
   * @param win
   * @param context
   * @listens module:svgcanvas.SvgCanvas#event:contextset
   */
  contextChanged (_win: any, context: Element | null): void {
    let linkStr = ''
    if (context) {
      let str = ''
      linkStr =
        '<a href="#" data-root="y">' +
        this.svgCanvas.getCurrentDrawing().getCurrentLayerName() +
        '</a>'
      const parentsUntil = getParentsUntil(context, '#svgcontent') ?? []
      ;(parentsUntil as Element[]).forEach(function (parent: Element) {
        if (parent.id) {
          str += ' > ' + parent.id
          linkStr +=
            parent !== context
              ? ` > <a href="#">${parent.id}</a>`
              : ` > ${parent.id}`
        }
      })

      this.curContext = str
    } else {
      this.curContext = null
    }
    $id('cur_context_panel')!.style.display = context ? 'block' : 'none'
    $id('cur_context_panel')!.innerHTML = linkStr
  }

  /**
   * @function module:SVGEditor.setIcon
   * @param elem
   * @param iconId
   */
  setIcon (elem: string, iconId: string): void {
    const img = document.createElement('img')
    img.src = this.configObj.curConfig.imgPath + iconId
    // TODO: see todo #10 — setIcon investigation at :905; preserved verbatim
    const icon = typeof iconId === 'string' ? img : (iconId as any).cloneNode(true)
    if (!icon) {
      console.warn('NOTE: Icon image missing: ' + iconId)
      // Audit input #6 — surface missing-icon to embed host so hosts can act on the gap; standalone callers still see the console.warn.
      this._embedServer?.emit('error', { message: `Icon image missing: ${iconId}`, source: 'missing-icon' })
      return
    }
    // empty()
    while ($id(elem)?.firstChild) {
      $id(elem)!.removeChild($id(elem)!.firstChild!)
    }
    $id(elem)?.appendChild(icon)
  }

  /**
   * @param win
   * @param ext
   * @listens module:svgcanvas.SvgCanvas#event:extension_added
   * @returns Resolves to `undefined`
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async extAdded (_win: any, ext: any): Promise<void> {
    if (!ext) {
      return undefined
    }
    let cbCalled = false

    /**
     *
     */
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

  /**
   * @param multiplier
   */
  zoomImage (multiplier?: number): void {
    const resolution = this.svgCanvas.getResolution()
    multiplier = multiplier ? resolution.zoom * multiplier : 1
    // setResolution(res.w * multiplier, res.h * multiplier, true);
    ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (multiplier * 100).toFixed(1))
    this.svgCanvas.setCurrentZoom(multiplier)
    this.zoomDone()
    this.updateCanvas(true, undefined)
  }

  /**
   *
   */
  cutSelected () {
    if (this.selectedElement || this.multiselected) {
      this.svgCanvas.cutSelectedElements()
    }
  }

  /**
   * @function copySelected
   */
  copySelected () {
    if (this.selectedElement || this.multiselected) {
      this.svgCanvas.copySelectedElements()
    }
  }

  /**
   *
   */
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

  /**
   * @param dir
   */
  moveUpDownSelected (dir: 'Up' | 'Down'): void {
    if (this.selectedElement) {
      this.svgCanvas.moveUpDownSelected(dir)
    }
  }

  /**
   * @param dx
   * @param dy
   */
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

  /**
   *
   */
  selectNext () {
    this.svgCanvas.cycleElement(1)
  }

  /**
   *
   */
  selectPrev () {
    this.svgCanvas.cycleElement(0)
  }

  /**
   * @param cw
   * @param step
   */
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

  /**
   *
   */
  hideSourceEditor (): void {
    const $editorDialog = $id('se-svg-editor-dialog')
    $editorDialog?.setAttribute('dialog', 'closed')
  }

  /**
   * @param e
   * @returns Resolves to `undefined`
   */
  async saveSourceEditor (e: CustomEvent): Promise<void> {
    const $editorDialog = $id('se-svg-editor-dialog')
    if ($editorDialog?.getAttribute('dialog') !== 'open') return
    const saveChanges = () => {
      this.svgCanvas.clearSelection()
      this.hideSourceEditor()
      this.zoomImage()
      this.layersPanel.populateLayers()
    }

    if (!this.svgCanvas.setSvgString(e.detail.value)) {
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

  /**
   * @param e
   * @returns Resolves to `undefined`
   */
  async cancelOverlays (e: CustomEvent): Promise<void> {
    if ($id('dialog_box') != null) $id('dialog_box')!.style.display = 'none'
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
      if (origSource !== e.detail.value) {
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

  /**
   */
  toggleDynamicOutput (e: any): void {
    this.configObj.curConfig.dynamicOutput = e.detail.dynamic
    this.svgCanvas.setConfig(this.configObj.curConfig)
    const $editorDialog = $id('se-svg-editor-dialog')
    const origSource = this.svgCanvas.getSvgString()
    $editorDialog?.setAttribute('dialog', 'open')
    $editorDialog?.setAttribute('value', origSource)
  }

  /**
   */
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
   * @function module:SVGthis.openPrep
   * @returns Resolves to boolean indicating `true` if there were no changes
   *  and `false` after the user confirms.
   */
  async openPrep () {
    if (this.svgCanvas.undoMgr.getUndoStackSize() === 0) {
      return true
    }
    return await seConfirm(this.i18next.t('notification.QwantToOpen'))
  }

  /**
   *
   * @param e
   */
  onDragEnter (e: DragEvent): void {
    e.stopPropagation()
    e.preventDefault()
    // and indicator should be displayed here, such as "drop files here"
  }

  /**
   *
   * @param e
   */
  onDragOver (e: DragEvent): void {
    e.stopPropagation()
    e.preventDefault()
  }

  /**
   *
   * @param e
   */
  onDragLeave (e: DragEvent): void {
    e.stopPropagation()
    e.preventDefault()
    // hypothetical indicator should be removed here
  }

  /**
   * @function module:SVGthis.setLang
   * @param lang The language code
   * @param allStrings See {@tutorial LocaleDocs}
   * @fires module:svgcanvas.SvgCanvas#event:ext_langReady
   * @fires module:svgcanvas.SvgCanvas#event:ext_langChanged
   * @returns A Promise which resolves to `undefined`
   */
  setLang (lang: string): void {
    this.langChanged = true
    this.configObj.pref('lang', lang)
    const $editDialog = $id('se-edit-prefs')
    $editDialog?.setAttribute('lang', lang)
    const oldLayerName = $id('#layerlist')
      ? $id('#layerlist')!.querySelector('tr.layersel td.layername')?.textContent
      : ''
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
   * @param cb Callback to be queued to invoke
   * @returns Resolves when all callbacks, including the supplied have resolved
   */
  ready (cb: () => any): Promise<any> {
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
   * @function module:SVGthis.loadFromString
   * @param str The SVG string to load
   * @param [opts={}]
   * @param [opts.noAlert=false] Option to avoid alert to user and instead get rejected promise
   */
  loadFromString (str: string, { noAlert }: { noAlert?: boolean | undefined } = {}): Promise<any> {
    return this.ready(() => {
      try {
        this.loadSvgString(str, { noAlert })
      } catch (err) {
        if (noAlert) {
          throw err
        }
      }
    })
  }

  /**
   * @callback module:SVGthis.URLLoadCallback
   * @param success
   */
  /**
   * @function module:SVGthis.loadFromURL
   * @param url URL from which to load an SVG string via Ajax
   * @param [opts={}] May contain properties: `cache`, `callback`
   * @param [opts.cache]
   * @param [opts.noAlert]
   * @returns Resolves to `undefined` or rejects upon bad loading of
   *   the SVG (or upon failure to parse the loaded string) when `noAlert` is
   *   enabled
   */
  loadFromURL (url: string, { cache, noAlert }: { cache?: boolean | undefined; noAlert?: boolean | undefined } = {}): Promise<any> {
    return this.ready(() => {
      return new Promise<void>((resolve, reject) => {
        fetch(url, { cache: cache ? 'force-cache' : 'no-cache' })
          .then((response) => {
            if (!response.ok) {
              if (noAlert) {
                reject(new Error('URLLoadFail'))
                return
              }
              seAlert(this.i18next.t('notification.URLLoadFail'))
              resolve()
            }
            return response.text()
          })
          .then((str) => {
            this.loadSvgString(str as string, { noAlert })
            resolve()
          })
          .catch((error) => {
            if (noAlert) {
              reject(new Error('URLLoadFail'))
              return
            }
            seAlert(
              this.i18next.t('notification.URLLoadFail') + ': \n' + error
            )
            resolve()
          })
      })
    })
  }

  /**
   * @function module:SVGthis.loadFromDataURI
   * @param str The Data URI to base64-decode (if relevant) and load
   * @param [opts={}]
   * @param [opts.noAlert]
   * @returns Resolves to `undefined` and rejects if loading SVG string fails and `noAlert` is enabled
   */
  loadFromDataURI (str: string, { noAlert }: { noAlert?: boolean | undefined } = {}): Promise<any> {
    return this.ready(() => {
      let base64 = false
      let preMatch = str.match(/^data:image\/svg\+xml;base64,/)
      if (preMatch) {
        base64 = true
      } else {
        preMatch = str.match(/^data:image\/svg\+xml(?:;|;utf8)?,/)
      }
      const pre = preMatch ? preMatch[0] : null
      const src = str.slice((pre ?? '').length)
      return this.loadSvgString(
        base64 ? decode64(src) : decodeURIComponent(src),
        { noAlert }
      )
    })
  }

  /**
   * @function module:SVGthis.addExtension
   * @param name Used internally; no need for i18n.
   * @param initfn Config to be invoked on this module
   * @param initArgs
   * @throws {Error} If called too early
   * @returns Resolves to `undefined`
   */
  addExtension (name: string, initfn: any, initArgs: any): Promise<void> {
    // Note that we don't want this on this.ready since some extensions
    // may want to run before then (like server_opensave).
    if (!this.svgCanvas) {
      throw new Error('Extension added too early')
    }
    return this.svgCanvas.addExtension(name, initfn, initArgs)
  }
}

export default Editor
