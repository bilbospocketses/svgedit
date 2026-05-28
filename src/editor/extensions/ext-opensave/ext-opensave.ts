/**
 * @file ext-opensave.js
 *
 * @license MIT
 *
 *
 */

/**
   * @param wind
   * @param svg The SVG source
   * @listens module:svgcanvas.SvgCanvas#event:saved
   */
import { fileOpen, fileSave } from 'browser-fs-access'
import { getSvgEditor } from '../../svgEditorInstance.js'

const name = 'opensave'
let handle: FileSystemFileHandle | null = null

const loadExtensionTranslation = async function (): Promise<void> {
  const svgEditor = getSvgEditor()
  let translationModule: Record<string, unknown>
  const lang = svgEditor.configObj.pref('lang')
  try {
    translationModule = await import(`./locale/${String(lang)}.js`) as Record<string, unknown>
  } catch (_error) {
    console.warn(`Missing translation (${String(lang)}) for ${name} - using 'en'`)
    translationModule = await import('./locale/en.js')
  }
  svgEditor.i18next.addResourceBundle(lang as string, 'translation', translationModule.default as Record<string, unknown>)
}

export default {
  name,
  async init () {
    const svgEditor = getSvgEditor()
    const svgCanvas = svgEditor.svgCanvas
    const { $id, $click } = svgCanvas
    await loadExtensionTranslation()
    /**
    * @param e
    */
    const importImage = (e: Event) => {
      // This handler runs for both file-input `change` events (e.target is HTMLInputElement)
      // and `drop` events on the drop zone (e is DragEvent with e.dataTransfer).
      const target = e.target as HTMLInputElement | null
      const fileInput = (target && target.type === 'file') ? target : null
      const resetFileInput = () => {
        if (fileInput) {
          fileInput.value = ''
        }
      }
      // only import files
      const dragE = e as DragEvent
      if (dragE.dataTransfer && !dragE.dataTransfer.types?.includes('Files')) return

      $id('se-status-dialog')!.title = svgEditor.i18next.t('notification.loadingImage')
      $id('se-status-dialog')!.setAttribute('close', 'false')
      e.stopPropagation()
      e.preventDefault()
      const file = (e.type === 'drop' && dragE.dataTransfer)
        ? dragE.dataTransfer.files[0]
        : (e.currentTarget as HTMLInputElement).files?.[0]
      if (!file) {
        $id('se-status-dialog')!.setAttribute('close', 'true')
        resetFileInput()
        return
      }

      if (!file.type.includes('image')) {
        resetFileInput()
        return
      }
      // Detected an image
      // svg handling
      let reader: FileReader
      if (file.type.includes('svg')) {
        reader = new FileReader()
        reader.onloadend = (ev) => {
          // imgImport.shiftKey (shift key pressed or not) will determine if import should preserve dimension)
          const result = ev.target?.result as string | null
          const newElement = svgCanvas.importSvgString(result ?? '', imgImport.shiftKey)
          svgCanvas.alignSelectedElements('m', 'page')
          svgCanvas.alignSelectedElements('c', 'page')
          // highlight imported element, otherwise we get strange empty selectbox
          if (newElement) svgCanvas.selectOnly([newElement])
          $id('se-status-dialog')!.setAttribute('close', 'true')
          resetFileInput()
        }
        reader.readAsText(file)
      } else {
        // bitmap handling
        reader = new FileReader()
        reader.onloadend = (ev2) => {
          const result = ev2.target?.result as string
          /**
              * Insert the new image until we know its dimensions.
              * @param imageWidth
              * @param imageHeight
              */
          const insertNewImage = (imageWidth: number, imageHeight: number) => {
            const newImage = svgCanvas.addSVGElementsFromJson({
              element: 'image',
              attr: {
                x: 0,
                y: 0,
                width: imageWidth,
                height: imageHeight,
                id: svgCanvas.getNextId(),
                style: 'pointer-events:inherit'
              }
            })
            svgCanvas.setHref(newImage, result)
            svgCanvas.selectOnly([newImage])
            svgCanvas.alignSelectedElements('m', 'page')
            svgCanvas.alignSelectedElements('c', 'page')
            svgEditor.topPanel.updateContextPanel()
            $id('se-status-dialog')!.setAttribute('close', 'true')
            resetFileInput()
          }
          // create dummy img so we know the default dimensions
          let imgWidth = 100
          let imgHeight = 100
          const img = new Image()
          img.style.opacity = '0'
          img.addEventListener('load', () => {
            imgWidth = img.offsetWidth || img.naturalWidth || img.width
            imgHeight = img.offsetHeight || img.naturalHeight || img.height
            insertNewImage(imgWidth, imgHeight)
          })
          img.src = result
        }
        reader.readAsDataURL(file)
      }
    }
    // create an input with type file to open the filesystem dialog
    const imgImport = document.createElement('input') as HTMLInputElement & { shiftKey?: boolean }
    imgImport.type = 'file'
    imgImport.addEventListener('change', importImage)
    // dropping a svg file will import it in the svg as well
    svgEditor.workarea.addEventListener('drop', importImage)

    const clickClear = async function () {
      const [x, y] = svgEditor.configObj.curConfig.dimensions as [number | string, number]
      const ok = await seConfirm(svgEditor.i18next.t('notification.QwantToClear'))
      if (ok === 'Cancel') {
        return
      }
      svgEditor.leftPanel.clickSelect()
      svgEditor.svgCanvas.clear()
      svgEditor.svgCanvas.setResolution(x as number | 'fit', y)
      svgEditor.updateCanvas(true)
      svgEditor.zoomImage()
      svgEditor.layersPanel.populateLayers()
      svgEditor.topPanel.updateContextPanel()
      svgEditor.topPanel.updateTitle('untitled.svg')
    }

    /**
     * By default,  this.editor.svgCanvas.open() is a no-op. It is up to an extension
     *  mechanism (opera widget, etc.) to call `setCustomHandlers()` which
     *  will make it do something.
     */
    const clickOpen = async function () {
      // ask user before clearing an unsaved SVG
      const response = await svgEditor.openPrep()
      if (response === 'Cancel') { return }
      svgCanvas.clear()
      try {
        const blob = await fileOpen({
          mimeTypes: ['image/*']
        })
        const svgContent = await blob.text()
        svgEditor.loadSvgString(svgContent)
        svgEditor.updateCanvas()
        handle = blob.handle ?? null
        svgEditor.topPanel.updateTitle(blob.name)
        svgEditor.svgCanvas.runExtensions({
          action: 'onOpenedDocument',
          vars: {
            name: blob.name,
            lastModified: blob.lastModified,
            size: blob.size,
            type: blob.type
          }
        })
        svgEditor.layersPanel.populateLayers()
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          return console.error(err)
        }
      }
    }
    const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
      const byteCharacters = atob(b64Data)
      const byteArrays = []
      for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize)
        const byteNumbers = new Array(slice.length)
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        byteArrays.push(byteArray)
      }
      const blob = new Blob(byteArrays, { type: contentType })
      return blob
    }

    const clickSave = async function (type: string) {
      const $editorDialog = $id('se-svg-editor-dialog')
      const editingsource = $editorDialog?.getAttribute('dialog') === 'open'
      if (editingsource) {
        void svgEditor.saveSourceEditor(new CustomEvent('save', { detail: { value: '' } }))
      } else {
        // In the future, more options can be provided here
        const saveOpts = {
          images: svgEditor.configObj.pref('img_save'),
          round_digits: 2
        }
        // remove the selected outline before serializing
        svgCanvas.clearSelection()
        // Update save options if provided
        if (saveOpts) {
          const saveOptions = svgCanvas.mergeDeep(svgCanvas.getSvgOption(), saveOpts)
          for (const [key, value] of Object.entries(saveOptions)) {
            svgCanvas.setSvgOption(key, value)
          }
        }
        svgCanvas.setSvgOption('apply', true)

        // no need for doctype, see https://jwatt.org/svg/authoring/#doctype-declaration
        const svg = '<?xml version="1.0"?>\n' + svgCanvas.svgCanvasToString()
        const b64Data = svgCanvas.encode64(svg)
        const blob = b64toBlob(b64Data, 'image/svg+xml')
        try {
          if (type === 'save' && handle !== null) {
            const throwIfExistingHandleNotGood = false
            handle = await fileSave(blob, {
              fileName: 'untitled.svg',
              extensions: ['.svg']
            }, handle, throwIfExistingHandleNotGood)
          } else {
            handle = await fileSave(blob, {
              fileName: svgEditor.title,
              extensions: ['.svg']
            })
          }
          // browser-fs-access returns null on Firefox's download fallback (no
          // File System Access API support); returns a FileSystemFileHandle on
          // Chromium. Save succeeded either way -- clear the dirty flag first
          // so a null handle doesn't skip it via TypeError on handle.name.
          svgEditor.markSaved()
          if (handle) {
            svgEditor.topPanel.updateTitle(handle.name)
            svgCanvas.runExtensions({
              action: 'onSavedDocument',
              vars: { name: handle.name, kind: handle.kind }
            })
          }
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            return console.error(err)
          }
        }
      }
    }

    return {
      name: svgEditor.i18next.t(`${name}:name`),
      // The callback should be used to load the DOM with the appropriate UI items
      callback () {
        const buttonTemplate = `
        <se-menu-item id="tool_clear" label="opensave.new_doc" shortcut="N" src="new.svg"></se-menu-item>`
        svgCanvas.insertChildAtIndex($id('main_button')!, buttonTemplate, 0)
        const openButtonTemplate = '<se-menu-item id="tool_open" label="opensave.open_image_doc" src="open.svg"></se-menu-item>'
        svgCanvas.insertChildAtIndex($id('main_button')!, openButtonTemplate, 1)
        const saveButtonTemplate = '<se-menu-item id="tool_save" label="opensave.save_doc" shortcut="S" src="saveImg.svg"></se-menu-item>'
        svgCanvas.insertChildAtIndex($id('main_button')!, saveButtonTemplate, 2)
        const saveAsButtonTemplate = '<se-menu-item id="tool_save_as" label="opensave.save_as_doc" src="saveImg.svg"></se-menu-item>'
        svgCanvas.insertChildAtIndex($id('main_button')!, saveAsButtonTemplate, 3)
        const importButtonTemplate = '<se-menu-item id="tool_import" label="tools.import_doc" src="importImg.svg"></se-menu-item>'
        svgCanvas.insertChildAtIndex($id('main_button')!, importButtonTemplate, 4)

        // handler
        $click($id('tool_clear')!, () => { void clickClear() })
        $click($id('tool_open')!, () => { void clickOpen() })
        $click($id('tool_save')!, () => { void clickSave('save') })
        $click($id('tool_save_as')!, () => { void clickSave('saveas') })
        // tool_import pressed with shiftKey will not scale the SVG
        $click($id('tool_import')!, (ev: Event) => { imgImport.shiftKey = (ev as MouseEvent).shiftKey; imgImport.click() })
      }
    }
  }
}
