import SvgCanvas from '@svgedit/svgcanvas'
import type Editor from '../Editor.js'
import { typedDetail, type SeCmenuDetail, type SeCmenuElement } from '../typed-events.js'
import LayersPanelHtml from './LayersPanel.html'

const { $id, $click } = SvgCanvas

/** Null-safe wrapper around $click — skips if element is null. */
const safeClick = (el: HTMLElement | null, handler: EventListenerOrEventListenerObject): void => {
  if (el) $click(el, handler)
}

class LayersPanel {
  updateContextPanel: () => void
  editor: Editor

  constructor (editor: Editor) {
    this.updateContextPanel = editor.topPanel.updateContextPanel.bind(editor.topPanel)
    this.editor = editor
  }

  lmenuFunc (e: Event): void {
    const action = typedDetail<SeCmenuDetail>(e).trigger
    switch (action) {
      case 'dupe':
        this.cloneLayer()
        break
      case 'delete':
        this.deleteLayer()
        break
      case 'merge_down':
        this.mergeLayer()
        break
      case 'merge_all':
        this.editor.svgCanvas.mergeAllLayers()
        this.updateContextPanel()
        this.populateLayers()
        break
    }
  }

  init () {
    const template = document.createElement('template')
    const { i18next } = this.editor

    template.innerHTML = LayersPanelHtml
    this.editor.$svgEditor.append(template.content.cloneNode(true))
    // layer menu added to DOM
    const menuMore = document.createElement('se-cmenu-layers') as unknown as SeCmenuElement
    menuMore.setAttribute('id', 'se-cmenu-layers-more')
    menuMore.value = 'layer_moreopts'
    menuMore.setAttribute('leftclick', 'true')
    this.editor.$container.append(menuMore)
    menuMore.init(i18next)
    const menuLayerBox = document.createElement('se-cmenu-layers') as unknown as SeCmenuElement
    menuLayerBox.setAttribute('id', 'se-cmenu-layers-list')
    menuLayerBox.value = 'layerlist'
    menuLayerBox.setAttribute('leftclick', 'false')
    this.editor.$container.append(menuLayerBox)
    menuLayerBox.init(i18next)
    safeClick($id('layer_new'), this.newLayer.bind(this))
    safeClick($id('layer_delete'), this.deleteLayer.bind(this))
    safeClick($id('layer_up'), () => this.moveLayer.bind(this)(-1))
    safeClick($id('layer_down'), () => this.moveLayer.bind(this)(1))
    safeClick($id('layer_rename'), this.layerRename.bind(this))
    $id('se-cmenu-layers-more')?.addEventListener('change', this.lmenuFunc.bind(this))
    $id('se-cmenu-layers-list')?.addEventListener('change', (e: Event) => { this.lmenuFunc(e) })
    safeClick($id('sidepanel_handle'), () => this.toggleSidePanel())
    this.toggleSidePanel(this.editor.configObj.curConfig.showlayers)
  }

  toggleSidePanel (displayFlag?: boolean): void {
    if (displayFlag === undefined) {
      this.editor.$svgEditor.classList.toggle('open')
    } else if (displayFlag) {
      this.editor.$svgEditor.classList.add('open')
    } else {
      this.editor.$svgEditor.classList.remove('open')
    }
  }

  newLayer (): void {
    let uniqName
    let i = this.editor.svgCanvas.getCurrentDrawing().getNumLayers()
    do {
      uniqName = this.editor.i18next.t('layers.layer') + ' ' + ++i
    } while (this.editor.svgCanvas.getCurrentDrawing().hasLayer(uniqName))

    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const newName = prompt(
      this.editor.i18next.t('notification.enterUniqueLayerName'),
      uniqName
    )
    if (!newName) {
      return
    }
    if (this.editor.svgCanvas.getCurrentDrawing().hasLayer(newName)) {
      // TODO: see todo #10 — native alert(); replace with seAlert
      alert(this.editor.i18next.t('notification.dupeLayerName'))
      return
    }
    this.editor.svgCanvas.createLayer(newName)
    this.updateContextPanel()
    this.populateLayers()
  }

  deleteLayer () {
    if (this.editor.svgCanvas.deleteCurrentLayer()) {
      this.updateContextPanel()
      this.populateLayers()
      // This matches what this.editor.svgCanvas does
      // TODO: make this behavior less brittle (svg-editor should get which
      // layer is selected from the canvas and then select that one in the UI)
      document.querySelectorAll('#layerlist tr.layer').forEach((el: Element) => {
        el.classList.remove('layersel')
      })
      document.querySelector('#layerlist tr.layer')?.classList.add('layersel')
    }
  }

  cloneLayer (): void {
    const name =
      this.editor.svgCanvas.getCurrentDrawing().getCurrentLayerName() + ' copy'

    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const newName = prompt(
      this.editor.i18next.t('notification.enterUniqueLayerName'),
      name
    )
    if (!newName) {
      return
    }
    if (this.editor.svgCanvas.getCurrentDrawing().hasLayer(newName)) {
      // TODO: see todo #10 — native alert(); replace with seAlert
      alert(this.editor.i18next.t('notification.dupeLayerName'))
      return
    }
    this.editor.svgCanvas.cloneLayer(newName)
    this.updateContextPanel()
    this.populateLayers()
  }

  index (el: Element | null): number {
    if (!el) return -1
    const tbody = document.querySelector('#layerlist tbody')
    if (!tbody) return -1
    return Array.from(tbody.children).indexOf(el)
  }

  mergeLayer (): void {
    if (
      (this.index(document.querySelector('#layerlist tr.layersel')) - 1) ===
      this.editor.svgCanvas.getCurrentDrawing().getNumLayers() - 1
    ) {
      return
    }
    this.editor.svgCanvas.mergeLayer()
    this.updateContextPanel()
    this.populateLayers()
  }

  moveLayer (pos: number): void {
    const curPos = this.editor.svgCanvas.indexCurrentLayer()
    if (curPos !== -1) {
      this.editor.svgCanvas.setCurrentLayerPosition(curPos - pos)
      this.populateLayers()
    }
  }

  layerRename (): void {
    const ele = document.querySelector('#layerlist tr.layersel td.layername')
    const oldName = (ele) ? ele.textContent : ''
    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const newName = prompt(this.editor.i18next.t('notification.enterNewLayerName'), '')
    if (!newName) {
      return
    }
    if (
      oldName === newName ||
      this.editor.svgCanvas.getCurrentDrawing().hasLayer(newName)
    ) {
      // TODO: see todo #10 — native alert(); replace with seAlert
      alert(this.editor.i18next.t('notification.layerHasThatName'))
      return
    }
    this.editor.svgCanvas.renameCurrentLayer(newName)
    this.populateLayers()
  }

  /**
   * This function highlights the layer passed in (by fading out the other layers).
   * If no layer is passed in, this function restores the other layers.
   */
  toggleHighlightLayer (layerNameToHighlight?: string): void {
    let i
    const curNames = []
    const numLayers = this.editor.svgCanvas.getCurrentDrawing().getNumLayers()
    for (i = 0; i < numLayers; i++) {
      curNames[i] = this.editor.svgCanvas.getCurrentDrawing().getLayerName(i)
    }

    if (layerNameToHighlight) {
      curNames.forEach((curName) => {
        if (curName !== layerNameToHighlight) {
          this.editor.svgCanvas
            .getCurrentDrawing()
            .setLayerOpacity(curName, 0.5)
        }
      })
    } else {
      curNames.forEach((curName) => {
        this.editor.svgCanvas.getCurrentDrawing().setLayerOpacity(curName, 1.0)
      })
    }
  }

  populateLayers (): void {
    this.editor.svgCanvas.clearSelection()
    const layerlist = $id('layerlist')?.querySelector('tbody')
    if (!layerlist) return
    while (layerlist.firstChild) { layerlist.removeChild(layerlist.firstChild) }

    $id('selLayerNames')?.setAttribute('options', '')
    const drawing = this.editor.svgCanvas.getCurrentDrawing()
    const currentLayerName = drawing.getCurrentLayerName()
    let layer = this.editor.svgCanvas.getCurrentDrawing().getNumLayers()
    // we get the layers in the reverse z-order (the layer rendered on top is listed first)
    let values = ''
    let text = ''
    while (layer--) {
      const name = drawing.getLayerName(layer)
      const layerTr = document.createElement('tr')
      layerTr.className = (name === currentLayerName) ? 'layer layersel' : 'layer'
      const layerVis = document.createElement('td')
      layerVis.className = (!drawing.getLayerVisibility(name)) ? 'layerinvis layervis' : 'layervis'

      // fix the eye icon lost at right layers
      const _eye = document.createElement('img')
      _eye.src = './images/eye.svg'
      _eye.style.width = '14px'
      _eye.style.height = '14px'
      layerVis.appendChild(_eye)

      const layerName = document.createElement('td')
      layerName.className = 'layername'
      layerName.textContent = name
      layerTr.appendChild(layerVis)
      layerTr.appendChild(layerName)
      layerlist.appendChild(layerTr)
      values = (values) ? values + '::' + name : name
      text = (text) ? text + ',' + name : name
    }
    $id('selLayerNames')?.setAttribute('options', text)
    $id('selLayerNames')?.setAttribute('values', values)
    // handle selection of layer
    const nelements = $id('layerlist')?.querySelectorAll('td.layername') ?? []
    nelements.forEach((element: Element) => {
      element.addEventListener('mouseup', (evt: Event) => {
        const trElements = $id('layerlist')?.querySelectorAll('tr.layer') ?? []
        trElements.forEach((trEl: Element) => {
          trEl.classList.remove('layersel')
        })
        const target = evt.currentTarget as HTMLElement
        target.parentElement?.classList.add('layersel')
        this.editor.svgCanvas.setCurrentLayer(target.textContent ?? '')
        // run extension when different layer is selected from listener
        this.editor.svgCanvas.runExtensions({ action: 'layersChanged' })
        evt.preventDefault()
      })
      element.addEventListener('mouseover', (evt: Event) => {
        this.toggleHighlightLayer((evt.currentTarget as HTMLElement).textContent ?? undefined)
      })
      element.addEventListener('mouseout', () => {
        this.toggleHighlightLayer()
      })
    })
    const elements = $id('layerlist')?.querySelectorAll('td.layervis') ?? []
    elements.forEach((element: Element) => {
      safeClick(element as HTMLElement, (evt: Event) => {
        const target = evt.currentTarget as HTMLElement
        const ele = target.parentElement?.querySelector('td.layername')
        const name = ele?.textContent ?? ''
        const vis = target.classList.contains('layerinvis')
        this.editor.svgCanvas.setLayerVisibility(name, vis)
        target.classList.toggle('layerinvis')
        // run extension if layer visibility is changed from listener
        this.editor.svgCanvas.runExtensions({ action: 'layerVisChanged' })
      })
    })

    // if there were too few rows, let's add a few to make it not so lonely
    let num = 5 - ($id('layerlist')?.querySelectorAll('tr.layer').length ?? 0)
    while (num-- > 0) {
      // TODO: there must a better way to do this
      const tlayer = document.createElement('tr')
      tlayer.innerHTML = '<td style="color:white">_</td><td/>'
      layerlist.append(tlayer)
    }
    // run extension when layer panel is populated
    this.editor.svgCanvas.runExtensions({ action: 'layersChanged' })
  }
}

export default LayersPanel
