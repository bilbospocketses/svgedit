/**
 * Standalone initialisation function extracted from Editor.init().
 *
 * Receives the full Editor instance and wires up the DOM, SvgCanvas,
 * event listeners, extensions, and the embed-API bridge.
 *
 * @license MIT
 * @module editorInit
 */

import {
  putLocale
} from './locale.js'
import {
  hasCustomHandler, getCustomHandler, injectExtendedContextMenuItemsIntoDom
} from './contextmenu.js'
import editorTemplate from './templates/editorTemplate.html'
import Rulers from './Rulers.js'
import SvgCanvas from '@svgedit/svgcanvas'
import type Editor from './Editor.js'
import { typedDetail, type SeChangeDetail, type SeSvgSourceDetail, type SeCmenuDetail } from './typed-events.js'
import { applyInitialTheme } from './styles/theme.js'

const { $id, $click, convertUnit } = SvgCanvas

/** Custom element that supports an `.init(i18next)` lifecycle method. */
interface InitableElement extends HTMLElement {
  init: (i18next: unknown) => void
}

/** Wire up DOM, SvgCanvas, event listeners, extensions, and embed-API bridge for the editor. */
export async function initEditor (editor: Editor): Promise<void> {
  if ('localStorage' in window) {
    editor.storage = window.localStorage
  }
  editor.configObj.load()
  applyInitialTheme(editor.configObj.pref('theme') as string)
  const { i18next } = await putLocale(editor.configObj.pref('lang'), editor.goodLangs)
  editor.i18next = i18next
  await import('./components/index.js')
  await import('./dialogs/index.js')
  try {
    // add editor components to the DOM
    const template = document.createElement('template')
    template.innerHTML = editorTemplate
    editor.$container.append(template.content.cloneNode(true))
    editor.$svgEditor = editor.$container.querySelector('.svg_editor') as HTMLElement
    // allow to prepare the dom without display
    editor.$svgEditor.style.visibility = 'hidden'
    editor.workarea = $id('workarea') as HTMLElement
    // Image props dialog added to DOM
    const newSeImgPropDialog = document.createElement('se-img-prop-dialog') as unknown as InitableElement
    newSeImgPropDialog.setAttribute('id', 'se-img-prop')
    editor.$container.append(newSeImgPropDialog)
    newSeImgPropDialog.init(editor.i18next)
    // editor prefences dialoag added to DOM
    const newSeEditPrefsDialog = document.createElement('se-edit-prefs-dialog') as unknown as InitableElement
    newSeEditPrefsDialog.setAttribute('id', 'se-edit-prefs')
    editor.$container.append(newSeEditPrefsDialog)
    newSeEditPrefsDialog.init(editor.i18next)
    // canvas menu added to DOM
    const dialogBox = document.createElement('se-cmenu_canvas-dialog') as unknown as InitableElement
    dialogBox.setAttribute('id', 'se-cmenu_canvas')
    editor.$container.append(dialogBox)
    dialogBox.init(editor.i18next)
    // alertDialog added to DOM
    const alertBox = document.createElement('se-alert-dialog')
    alertBox.setAttribute('id', 'se-alert-dialog')
    editor.$container.append(alertBox)
    // promptDialog added to DOM
    const promptBox = document.createElement('se-status-dialog')
    promptBox.setAttribute('id', 'se-status-dialog')
    editor.$container.append(promptBox)
    // Export dialog added to DOM
    const exportDialog = document.createElement('se-export-dialog') as unknown as InitableElement
    exportDialog.setAttribute('id', 'se-export-dialog')
    editor.$container.append(exportDialog)
    exportDialog.init(editor.i18next)
  } catch (err) {
    console.error(err)
  }

  /**
  * @name module:SVGthis.canvas
  */
  editor.svgCanvas = new SvgCanvas(
    $id('svgcanvas') as HTMLElement,
    editor.configObj.curConfig
  )

  // once svgCanvas is init - adding listener to the changes of the current mode
  editor.modeEvent = editor.svgCanvas.modeEvent
  document.addEventListener('modeChange', (evt) => editor.modeListener(evt))

  /** if true - selected tool can be cancelled with Esc key
   * disables on dragging (mousedown) to avoid changing mode in the middle of drawing
  */
  editor.enableToolCancel = true

  editor.leftPanel.init()
  editor.bottomPanel.init()
  editor.topPanel.init()
  editor.layersPanel.init()
  editor.mainMenu.init()

  const { undoMgr } = editor.svgCanvas
  editor.canvMenu = $id('se-cmenu_canvas')
  editor.exportWindow = null
  editor.defaultImageURL = `${editor.configObj.curConfig.imgPath}/logo.svg`
  const zoomInIcon = 'crosshair'
  const zoomOutIcon = 'crosshair'
  editor.uiContext = 'toolbars'

  // For external openers -- let the opener/parent know svgedit is ready
  const w: Window | null = (window.opener as Window | null) ?? window.parent
  if (w) {
    try {
      const CE = (w as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent ?? CustomEvent
      w.document.documentElement.dispatchEvent(
        new CE('svgEditorReady', { bubbles: true, cancelable: true })
      )
    } catch { /* cross-origin -- ignore */ }
  }

  editor.rulers = new Rulers(editor)

  editor.layersPanel.populateLayers()
  editor.selectedElement = null
  editor.multiselected = false

  const aLink = $id('cur_context_panel')

  $click(aLink as EventTarget, (evt: Event) => {
    const link = evt.target as Element | null
    if (link?.hasAttribute('data-root')) {
      editor.svgCanvas.leaveContext()
    } else {
      editor.svgCanvas.setContext(link?.textContent ?? '')
    }
    editor.svgCanvas.clearSelection()
    return false
  })

  // bind the selected event to our function that handles updates to the UI
  editor.svgCanvas.bind('selected', editor.selectedChanged.bind(editor))
  editor.svgCanvas.bind('transition', editor.elementTransition.bind(editor))
  editor.svgCanvas.bind('changed', editor.elementChanged.bind(editor))
  editor.svgCanvas.bind('exported', editor.exportHandler.bind(editor))
  editor.svgCanvas.bind('exportedPDF', (_win: unknown, data: { output?: string; exportWindowName?: string }) => {
    if (!data.output) { // Ignore Chrome
      return
    }
    const { exportWindowName } = data
    if (exportWindowName) {
      editor.exportWindow = window.open('', editor.exportWindowName ?? undefined) // A hack to get the window via JSON-able name without opening a new one
    }
    if (!editor.exportWindow || editor.exportWindow.closed) {
      seAlert(editor.i18next.t('notification.popupWindowBlocked'))
      return
    }
    editor.exportWindow.location.href = data.output
  })
  editor.svgCanvas.bind('zoomed', editor.zoomChanged.bind(editor))
  editor.svgCanvas.bind('zoomDone', editor.zoomDone.bind(editor))
  editor.svgCanvas.bind(
    'updateCanvas',
    /**
   * @listens module:svgcanvas.SvgCanvas#event:updateCanvas
   */
    (_win: unknown, { center, newCtr }: { center: boolean; newCtr: { x: number; y: number } }) => {
      editor.updateCanvas(center, newCtr)
    }
  )
  editor.svgCanvas.bind('contextset', editor.contextChanged.bind(editor))
  editor.svgCanvas.bind('extension_added', editor.extAdded.bind(editor))
  editor.svgCanvas.bind('elementRenamed', editor.elementRenamed.bind(editor))

  editor.svgCanvas.bind('beforeClear', editor.beforeClear.bind(editor))
  editor.svgCanvas.bind('afterClear', editor.afterClear.bind(editor))

  editor.svgCanvas.textActions.setInputElem($id('text') as HTMLInputElement)

  editor.setBackground((editor.configObj.pref('bkgd_color') as string | undefined) ?? '', (editor.configObj.pref('bkgd_url') as string | undefined) ?? '')

  // update resolution option with actual resolution
  const res = editor.svgCanvas.getResolution()
  let resW: string | number = res.w
  let resH: string | number = res.h
  if (editor.configObj.curConfig.baseUnit !== 'px') {
    resW = convertUnit(res.w) + editor.configObj.curConfig.baseUnit
    resH = convertUnit(res.h) + editor.configObj.curConfig.baseUnit
  }
  $id('se-img-prop')?.setAttribute('dialog', 'close')
  $id('se-img-prop')?.setAttribute('title', editor.svgCanvas.getDocumentTitle() ?? '')
  $id('se-img-prop')?.setAttribute('width', String(resW))
  $id('se-img-prop')?.setAttribute('height', String(resH))
  $id('se-img-prop')?.setAttribute('save', (editor.configObj.pref('img_save') as string | undefined) ?? '')

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
    const destLayer = typedDetail<SeChangeDetail>(evt).value
    if (!destLayer) return
    if (promptMoveLayerOnce) {
      promptMoveLayerOnce = true
      editor.svgCanvas.moveSelectedToLayer(destLayer)
      editor.svgCanvas.clearSelection()
      editor.layersPanel.populateLayers()
    } else {
      const confirmStr = editor.i18next.t('notification.QmoveElemsToLayer').replace('%s', destLayer)
      const ok = await seConfirm(confirmStr)
      if (ok === 'Cancel') return
      promptMoveLayerOnce = true
      editor.svgCanvas.moveSelectedToLayer(destLayer)
      editor.svgCanvas.clearSelection()
      editor.layersPanel.populateLayers()
    }
  })
  $id('tool_font_family')?.addEventListener('change', (evt) => {
    editor.svgCanvas.setFontFamily(typedDetail<SeChangeDetail>(evt).value)
  })

  $id('seg_type')?.addEventListener('change', (evt) => {
    editor.svgCanvas.setSegType(Number(typedDetail<SeChangeDetail>(evt).value))
  })

  const addListenerMulti = (element: HTMLElement, eventNames: string, listener: EventListener) => {
    eventNames.split(' ').forEach((eventName) => element.addEventListener(eventName, listener, false))
  }

  addListenerMulti($id('text') as HTMLElement, 'keyup input', (evt: Event) => {
    editor.svgCanvas.setTextContent((evt.currentTarget as HTMLInputElement).value)
  })

  $id('link_url')?.addEventListener('change', (evt) => {
    const val = (evt.currentTarget as HTMLInputElement).value
    if (val.length) {
      editor.svgCanvas.setLinkURL(val)
    } else {
      editor.svgCanvas.removeHyperlink()
    }
  })

  $id('g_title')?.addEventListener('change', (evt) => {
    editor.svgCanvas.setGroupTitle((evt.currentTarget as HTMLInputElement).value)
  })

  let lastX = 0; let lastY = 0
  let panning = false; let keypan = false
  let previousMode = 'select'

  $id('svgcanvas')?.addEventListener('mouseup', (evt) => {
    if (panning === false) { return true }

    editor.workarea.scrollLeft -= (evt.clientX - lastX)
    editor.workarea.scrollTop -= (evt.clientY - lastY)

    lastX = evt.clientX
    lastY = evt.clientY

    if (evt.type === 'mouseup') { panning = false }
    return false
  })
  $id('svgcanvas')?.addEventListener('mousemove', (evt) => {
    if (panning === false) { return true }

    editor.workarea.scrollLeft -= (evt.clientX - lastX)
    editor.workarea.scrollTop -= (evt.clientY - lastY)

    lastX = evt.clientX
    lastY = evt.clientY

    if (evt.type === 'mouseup') { panning = false }
    return false
  })
  $id('svgcanvas')?.addEventListener('mousedown', (evt) => {
    editor.enableToolCancel = false
    if (evt.button === 1 || keypan === true) {
      // prDefault to avoid firing of browser's panning on mousewheel
      evt.preventDefault()
      panning = true
      previousMode = editor.svgCanvas.getMode()
      editor.svgCanvas.setMode('ext-panning')
      editor.workarea.style.cursor = 'grab'
      lastX = evt.clientX
      lastY = evt.clientY
      return false
    }
    return true
  })

  // preventing browser's scaling with Ctrl+wheel
  editor.$container.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault()
    }
  })

  window.addEventListener('mouseup', (evt) => {
    editor.enableToolCancel = true
    if (evt.button === 1) {
      editor.svgCanvas.setMode(previousMode ?? 'select')
    }
    panning = false
  })

  // Allows quick change to the select mode while panning mode is active
  editor.workarea.addEventListener('dblclick', (_evt) => {
    if (editor.svgCanvas.getMode() === 'ext-panning') {
      editor.leftPanel.clickSelect()
    }
  })

  document.addEventListener('keydown', (e) => {
    if ((e.target as Element)?.nodeName !== 'BODY') return
    if (e.code.toLowerCase() === 'space') {
      editor.svgCanvas.spaceKey = keypan = true
      e.preventDefault()
    } else if ((e.key.toLowerCase() === 'shift') && (editor.svgCanvas.getMode() === 'zoom')) {
      editor.workarea.style.cursor = zoomOutIcon
      e.preventDefault()
    }
  })

  // Add a new shortcut for zoom in/out : Alt + Wheels
  editor.workarea.addEventListener('wheel', (e) => {
    if (e.altKey) {
      e.preventDefault()
      editor.svgCanvas.setZoom(e.deltaY > 0 ? editor.svgCanvas.getZoom() * 0.9 : editor.svgCanvas.getZoom() * 1.1)
      editor.updateCanvas(true)
      ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (editor.svgCanvas.getZoom() * 100).toFixed(1))
    }
  })

  document.addEventListener('keyup', (e) => {
    if ((e.target as Element)?.nodeName !== 'BODY') return
    if (e.code.toLowerCase() === 'space') {
      editor.svgCanvas.spaceKey = keypan = false
      editor.svgCanvas.setMode(previousMode === 'ext-panning' ? 'select' : previousMode ?? 'select')
      e.preventDefault()
    } else if ((e.key.toLowerCase() === 'shift') && (editor.svgCanvas.getMode() === 'zoom')) {
      editor.workarea.style.cursor = zoomInIcon
      e.preventDefault()
    }
  })

  /**
   * Enable or disable space-key panning mode on the canvas.
   * @function module:SVGthis.setPanning
   */
  editor.setPanning = (active) => {
    editor.svgCanvas.spaceKey = keypan = active
  }
  let inp: HTMLElement | null = null
  const unfocus = () => {
    inp?.blur()
  }

  const liElems = editor.$svgEditor.querySelectorAll('button, select, input:not(#text)')
  Array.prototype.forEach.call(liElems, (el: HTMLElement) => {
    el.addEventListener('focus', (e) => {
      inp = e.currentTarget as HTMLElement
      editor.uiContext = 'toolbars'
      editor.workarea.addEventListener('mousedown', unfocus)
    })
    el.addEventListener('blur', () => {
      editor.uiContext = 'canvas'
      editor.workarea.removeEventListener('mousedown', unfocus)
      // Go back to selecting text if in textedit mode
      if (editor.svgCanvas.getMode() === 'textedit') {
        $id('text')?.focus()
      }
    })
  })
  // ref: https://stackoverflow.com/a/1038781
  const getMaxDimension = (prop: 'Width' | 'Height'): number => {
    const scrollKey = `scroll${prop}` as const
    const offsetKey = `offset${prop}` as const
    const clientKey = `client${prop}` as const
    return Math.max(
      document.body[scrollKey],
      document.documentElement[scrollKey],
      document.body[offsetKey],
      document.documentElement[offsetKey],
      document.documentElement[clientKey]
    )
  }
  const winWh = {
    width: getMaxDimension('Width'),
    height: getMaxDimension('Height')
  }

  window.addEventListener('resize', () => {
    Object.entries(winWh).forEach(([type, val]) => {
      const curval = (type === 'width') ? window.innerWidth - 15 : window.innerHeight
      const scrollProp = ('scroll' + (type === 'width' ? 'Left' : 'Top')) as 'scrollLeft' | 'scrollTop'
      editor.workarea[scrollProp] -= (curval - val) / 2
      ;(winWh as Record<string, number>)[type] = curval
    })
  })

  editor.workarea.addEventListener('scroll', () => {
    editor.rulers.manageScroll()
  })

  if ($id('stroke_width')) ($id('stroke_width') as HTMLInputElement).value = String(editor.configObj.curConfig.initStroke.width)
  if ($id('opacity')) ($id('opacity') as HTMLInputElement).value = String(editor.configObj.curConfig.initOpacity * 100)
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

  editor.layersPanel.populateLayers()

  const centerCanvas = () => {
    // this centers the canvas vertically in the editor.workarea (horizontal handled in CSS)
    editor.workarea.style.lineHeight = editor.workarea.style.height
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

  $id('se-svg-editor-dialog')?.addEventListener('change', (e: Event) => {
    const detail = typedDetail<SeSvgSourceDetail>(e)
    if (detail && 'copy' in detail && detail.copy === 'click') {
      void editor.cancelOverlays(e as CustomEvent)
    } else if (detail && 'dialog' in detail && detail.dialog === 'dynamic') {
      editor.toggleDynamicOutput(e)
    } else if (detail && 'dialog' in detail && detail.dialog === 'closed') {
      editor.hideSourceEditor()
    } else {
      void editor.saveSourceEditor(e as CustomEvent)
    }
  })
  $id('se-cmenu_canvas')?.addEventListener('change', (e: Event) => {
    const action = typedDetail<SeCmenuDetail>(e)?.trigger
    switch (action) {
      case 'delete':
        editor.svgCanvas.deleteSelectedElements()
        break
      case 'cut':
        editor.cutSelected()
        break
      case 'copy':
        editor.copySelected()
        break
      case 'paste':
        editor.svgCanvas.pasteElements()
        break
      case 'paste_in_place':
        editor.svgCanvas.pasteElements('in_place')
        break
      case 'group':
      case 'group_elements':
        editor.svgCanvas.groupSelectedElements()
        break
      case 'ungroup':
        editor.svgCanvas.ungroupSelectedElement()
        break
      case 'move_front':
        editor.svgCanvas.moveToTopSelectedElement()
        break
      case 'move_up':
        editor.moveUpDownSelected('Up')
        break
      case 'move_down':
        editor.moveUpDownSelected('Down')
        break
      case 'move_back':
        editor.svgCanvas.moveToBottomSelectedElement()
        break
      default:
        if (hasCustomHandler(action)) {
          getCustomHandler(action).call(null)
        }
        break
    }
  })

  // Select given tool
  void editor.ready(() => {
    const preTool = $id(`tool_${editor.configObj.curConfig.initTool}`)
    const regTool = $id(editor.configObj.curConfig.initTool)
    const selectTool = $id('tool_select')
    const $editDialog = $id('se-edit-prefs')

    if (preTool) {
      preTool.click()
    } else if (regTool) {
      regTool.click()
    } else {
      selectTool?.click()
    }

    if (editor.configObj.curConfig.wireframe) {
      $id('tool_wireframe')?.click()
    }

    if (editor.configObj.curConfig.showRulers) {
      editor.rulers.display(true)
    } else {
      editor.rulers.display(false)
    }

    if (editor.configObj.curConfig.showRulers) {
      $editDialog?.setAttribute('showrulers', 'true')
    }

    if (editor.configObj.curConfig.baseUnit) {
      $editDialog?.setAttribute('baseunit', editor.configObj.curConfig.baseUnit)
    }

    if (editor.configObj.curConfig.gridSnapping) {
      $editDialog?.setAttribute('gridsnappingon', 'true')
    }

    if (editor.configObj.curConfig.snappingStep) {
      $editDialog?.setAttribute('gridsnappingstep', String(editor.configObj.curConfig.snappingStep))
    }

    if (editor.configObj.curConfig.gridColor) {
      $editDialog?.setAttribute('gridcolor', editor.configObj.curConfig.gridColor)
    }

    if (editor.configObj.curConfig.dynamicOutput) {
      $editDialog?.setAttribute('dynamicoutput', 'true')
    }
  })

  // zoom
  ;($id('zoom') as HTMLInputElement | null)?.setAttribute('value', (editor.svgCanvas.getZoom() * 100).toFixed(1))
  editor.canvMenu?.setAttribute('disableallmenu', 'true')
  editor.canvMenu?.setAttribute('enablemenuitems', '#delete,#cut,#copy')

  editor.enableOrDisableClipboard()

  window.addEventListener('storage', (e) => {
    if (e.key !== 'svgedit_clipboard') { return }

    editor.enableOrDisableClipboard()
  })

  window.addEventListener('beforeunload', (e) => {
  // Suppress warning if page is empty
    if (undoMgr.getUndoStackSize() === 0) {
      editor.showSaveWarning = false
    }

    // showSaveWarning is cleared by Editor.markSaved(), called from save
    // extensions (ext-opensave) after the document is successfully persisted.
    if (!editor.configObj.curConfig.no_save_warning && editor.showSaveWarning) {
    // Browser already asks question about closing the page
      e.returnValue = editor.i18next.t('notification.unsavedChanges') // Firefox needs this when beforeunload set by addEventListener (even though message is not used)
      return editor.i18next.t('notification.unsavedChanges')
    }
    return true
  })

  // Use HTML5 File API: http://www.w3.org/TR/FileAPI/
  // if browser has HTML5 File API support, then we will show the open menu item
  // and provide a file input to click. When that change event fires, it will
  // get the text contents of the file and send it to the canvas

  editor.workarea.addEventListener('dragenter', editor.onDragEnter.bind(editor))
  editor.workarea.addEventListener('dragover', editor.onDragOver.bind(editor))
  editor.workarea.addEventListener('dragleave', editor.onDragLeave.bind(editor))

  editor.updateCanvas(true)
  // Load extensions
  void editor.extAndLocaleFunc()
  // Defer injection to wait out initial menu processing. This probably goes
  //    away once all context menu behavior is brought to context menu.
  void editor.ready(() => {
    injectExtendedContextMenuItemsIntoDom()
  })
  // run callbacks stored by editor.ready
  await editor.runCallbacks()
  // Signal readiness to same-document listeners (tests/debugging hooks)
  document.dispatchEvent(new CustomEvent('svgedit:ready', { detail: editor }))

  // Embed-API: fire ready() now that svgCanvas exists and all callbacks have run (Task 11).
  editor._embedServer?.ready()

  // Wire svgCanvas events to embed event channel (Task 11).
  // svgCanvas.bind() REPLACES the existing handler (returns the previous one). The editor binds
  // its own selectedChanged + elementChanged earlier in init() -- we must chain to them, not clobber.
  type ScHandler = (...args: unknown[]) => unknown
  const sc = editor.svgCanvas as { bind?: (name: string, fn: ScHandler) => ScHandler | undefined } | null
  if (sc != null && typeof sc.bind === 'function') {
    let changeTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleChange = (): void => {
      if (changeTimer) clearTimeout(changeTimer)
      changeTimer = setTimeout(() => { editor._embedServer?.emit('change', {}) }, 200)
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
      // svgCanvas.call invokes handlers with (window, arg) -- selection array is args[1].
      const selected = args[1]
      const arr = Array.isArray(selected) ? selected as Element[] : []
      editor._embedServer?.emit('selection-changed', {
        count: arr.length,
        ids: arr.map(e => e?.id).filter((s): s is string => typeof s === 'string' && s.length > 0)
      })
    })
    // v1.1 (PR-B audit #1) -- bridge the 4 new group/move bus events to the embed channel.
    // Payloads are empty: hosts can call getSelectedElements / etc. if details are needed.
    // Chain-to-previous keeps ext-connector's bindings working (it binds before-group + after-move).
    const prevBeforeGroup = sc.bind('before-group', (...args: unknown[]) => {
      if (prevBeforeGroup) prevBeforeGroup(...args)
      editor._embedServer?.emit('before-group', {})
    })
    const prevAfterGroup = sc.bind('after-group', (...args: unknown[]) => {
      if (prevAfterGroup) prevAfterGroup(...args)
      editor._embedServer?.emit('after-group', {})
    })
    const prevBeforeMove = sc.bind('before-move', (...args: unknown[]) => {
      if (prevBeforeMove) prevBeforeMove(...args)
      editor._embedServer?.emit('before-move', {})
    })
    const prevAfterMove = sc.bind('after-move', (...args: unknown[]) => {
      if (prevAfterMove) prevAfterMove(...args)
      editor._embedServer?.emit('after-move', {})
    })
  }
}
