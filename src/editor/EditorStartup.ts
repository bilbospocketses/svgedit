/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import {
  putLocale
} from './locale.js'
import {
  hasCustomHandler, getCustomHandler, injectExtendedContextMenuItemsIntoDom
} from './contextmenu.js'
// @ts-expect-error: *.html imported as string via vite-plugin-string; no ambient module declaration exists yet
import editorTemplate from './templates/editorTemplate.html'
import SvgCanvas from '@svgedit/svgcanvas'
import Rulers from './Rulers.js'

/**
   * @fires module:svgcanvas.SvgCanvas#event:svgEditorReady
   */
const readySignal = () => {
  // let the opener know svgedit is ready (now that config is set up)
  const w = window.opener || window.parent
  if (w) {
    try {
      /**
         * Triggered on a containing `document` (of `window.opener`
         * or `window.parent`) when the editor is loaded.
         * @event module:SVGEditor#event:svgEditorReadyEvent
         * @property {true} bubbles
         * @property {true} cancelable
         */
      /**
         * @name module:SVGthis.svgEditorReadyEvent
         */
      const svgEditorReadyEvent = new w.CustomEvent('svgEditorReady', {
        bubbles: true,
        cancelable: true
      })
      w.document.documentElement.dispatchEvent(svgEditorReadyEvent)
    } catch { /* empty fn */ }
  }
}

const { $id, $click, convertUnit } = SvgCanvas

/**
 *
 */
class EditorStartup {
  // Own properties initialized in this constructor
  extensionsAdded: boolean
  messageQueue: any[]
  $container: HTMLElement

  // Properties set by the Editor subclass — declared here so init() can use them
  declare configObj: any
  declare svgCanvas: any
  declare i18next: any
  declare $svgEditor: HTMLElement
  declare workarea: HTMLElement
  declare leftPanel: any
  declare bottomPanel: any
  declare topPanel: any
  declare layersPanel: any
  declare mainMenu: any
  declare rulers: Rulers
  declare canvMenu: HTMLElement | null
  declare exportWindow: Window | null
  declare defaultImageURL: string
  declare uiContext: string
  declare selectedElement: Element | null
  declare multiselected: boolean
  declare enableToolCancel: boolean
  declare modeEvent: any
  declare exportWindowCt: number
  declare exportWindowName: string | null
  declare goodLangs: string[]
  declare storage: Storage | null
  declare storagePromptState: string
  declare showSaveWarning: boolean
  declare callbacks: any[]
  declare isReady: boolean
  declare shortcuts: any[]
  declare setPanning: (active: boolean) => void
  // Properties/methods from Editor subclass, accessed via init() — typed loosely to avoid
  // TS2425 conflict between 'declare' property and actual method in subclass.
  // These are accessed through 'this' which is always the Editor instance at runtime.
  [key: string]: any

  /**
   *
   */
  constructor (div?: HTMLElement | null) {
    this.extensionsAdded = false
    this.messageQueue = []
    this.$container = (div ?? $id('svg_editor')) as HTMLElement
  }

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

    // For external openers
    readySignal()

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
    function getWidth () {
      return Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.offsetWidth,
        document.documentElement.clientWidth
      )
    }

    function getHeight () {
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      )
    }
    const winWh = {
      width: getWidth(),
      height: getHeight()
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
        this.cancelOverlays(e)
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

    this.workarea.addEventListener('dragenter', this.onDragEnter)
    this.workarea.addEventListener('dragover', this.onDragOver)
    this.workarea.addEventListener('dragleave', this.onDragLeave)

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
        // #TODO: Cursor should be changed back to default after text element was created
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
}

export default EditorStartup
