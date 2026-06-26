import SvgCanvas from '@svgedit/svgcanvas'
import type Editor from '../Editor.js'
import {
  typedDetail,
  type SeChangeDetail,
  type SeButtonElement,
  type SeValueElement,
  type SeSvgSourceDialogElement,
  type PathActionsLike
} from '../typed-events.js'
import topPanelHTML from './TopPanel.html'

const { $qa, $id, $click, isValidUnit, getTypeMap, convertUnit } = SvgCanvas

/** Null-safe wrapper around $click — skips if element is null. */
const safeClick = (el: HTMLElement | null, handler: EventListenerOrEventListenerObject): void => {
  if (el) $click(el, handler)
}

/*
 * register actions for left panel
 */
class TopPanel {
  editor: Editor

  /**
   * @param editor svgedit handler
   */
  constructor (editor: Editor) {
    this.editor = editor
  }

  displayTool (className: string): void {
    // default display is 'none' so removing the property will make the panel visible
    $qa(`.${className}`).forEach((el: Element) => (el as HTMLElement).style.removeProperty('display'))
  }

  hideTool (className: string): void {
    $qa(`.${className}`).forEach((el: Element) => {
      ;(el as HTMLElement).style.display = 'none'
    })
  }

  get selectedElement () {
    return this.editor.selection.selectedElement
  }

  get multiselected () {
    return this.editor.selection.multiselected
  }

  get path (): PathActionsLike {
    return this.editor.svgCanvas.pathActions
  }

  setStrokeOpt (opt: HTMLElement, changeElem?: boolean): void {
    const { id } = opt
    const bits = id.split('_')
    const [pre, val] = bits

    if (changeElem) {
      // TODO: see todo #10 — likely should be this.editor.svgCanvas (pre-existing bug)
      this.editor.svgCanvas.setStrokeAttr('stroke-' + pre, val ?? '')
    }
    opt.classList.add('current')
    const parent = opt.parentElement
    if (!parent) return
    Array.from(parent.children).forEach((child: Element) => {
      if (child !== opt) {
        child.classList.remove('current')
      }
    })
  }

  /**
   * Updates the toolbar (colors, opacity, etc) based on the selected element.
   * This function also updates the opacity and id elements that are in the
   * context panel.
   */
  update () {
    let i
    let len
    // set title
    const titleEl = $qa('#title_panel > p')[0]
    if (titleEl) titleEl.textContent = this.editor.title
    if (this.selectedElement) {
      switch (this.selectedElement.tagName) {
        case 'use':
        case 'image':
        case 'foreignObject':
          break
        case 'g':
        case 'a': {
          // Look for common styles
          const childs = this.selectedElement.getElementsByTagName('*')
          let gWidth = null
          for (i = 0, len = childs.length; i < len; i++) {
            const swidth = childs.item(i)?.getAttribute('stroke-width') ?? null

            if (i === 0) {
              gWidth = swidth
            } else if (gWidth !== swidth) {
              gWidth = null
            }
          }

          const swEl = $id('stroke_width') as SeValueElement | null
          if (swEl) swEl.value = gWidth === null ? '' : gWidth
          this.editor.bottomPanel.updateColorpickers(false)
          break
        }
        default: {
          this.editor.bottomPanel.updateColorpickers(false)

          const swDefault = $id('stroke_width') as SeValueElement | null
          if (swDefault) swDefault.value = this.selectedElement.getAttribute('stroke-width') || 1
          const ssEl = $id('stroke_style') as SeValueElement | null
          if (ssEl) {
            ssEl.value = this.selectedElement.getAttribute('stroke-dasharray') || 'none'
            $id('stroke_style')?.setAttribute('value', String(ssEl.value))
          }

          let attr =
            this.selectedElement.getAttribute('stroke-linejoin') || 'miter'

          const linejoinEl = $id('linejoin_' + attr)
          if (linejoinEl) {
            this.setStrokeOpt(linejoinEl)
            $id('stroke_linejoin')?.setAttribute('value', attr)
          }

          attr = this.selectedElement.getAttribute('stroke-linecap') || 'butt'
          const linecapEl = $id('linecap_' + attr)
          if (linecapEl) {
            this.setStrokeOpt(linecapEl)
            $id('stroke_linecap')?.setAttribute('value', attr)
          }
        }
      }
    }

    // All elements including image and group have opacity
    if (this.selectedElement) {
      const opacPerc =
        (Number(this.selectedElement.getAttribute('opacity')) || 1.0) * 100
      const opacEl = $id('opacity') as SeValueElement | null
      if (opacEl) opacEl.value = opacPerc
      const elemIdEl = $id('elem_id') as SeValueElement | null
      if (elemIdEl) elemIdEl.value = this.selectedElement.id
      const elemClassEl = $id('elem_class') as SeValueElement | null
      if (elemClassEl) elemClassEl.value = this.selectedElement.getAttribute('class') ?? ''
    }

    this.editor.bottomPanel.updateToolButtonState()
  }

  async promptImgURL ({ cancelDeletes = false } = {}): Promise<void> {
    const selectedEl = this.editor.selection.selectedElement
    if (!selectedEl) return
    let curhref = this.editor.svgCanvas.getHref(selectedEl) ?? ''
    curhref = curhref.startsWith('data:') ? '' : curhref
    const url = await sePrompt(
      this.editor.i18next.t('notification.enterNewImgURL'),
      curhref
    )
    if (url) {
      this.setImageURL(url)
    } else if (cancelDeletes) {
      this.editor.svgCanvas.deleteSelectedElements()
    }
  }

  /**
   * Updates the context panel tools based on the selected element.
   */
  updateContextPanel () {
    let elem = this.editor.selection.selectedElement
    // If element has just been deleted, consider it null
    if (!elem?.parentNode) {
      elem = null
    }
    const currentLayerName = this.editor.svgCanvas
      .getCurrentDrawing()
      .getCurrentLayerName()
    const currentMode = this.editor.svgCanvas.getMode()
    const unit =
      this.editor.configObj.curConfig.baseUnit !== 'px'
        ? this.editor.configObj.curConfig.baseUnit
        : null

    const isNode = currentMode === 'pathedit'
    const menuItems = $id('se-cmenu_canvas')
    this.hideTool('selected_panel')
    this.hideTool('multiselected_panel')
    this.hideTool('g_panel')
    this.hideTool('rect_panel')
    this.hideTool('circle_panel')
    this.hideTool('ellipse_panel')
    this.hideTool('line_panel')
    this.hideTool('text_panel')
    this.hideTool('image_panel')
    this.hideTool('container_panel')
    this.hideTool('use_panel')
    this.hideTool('a_panel')
    this.hideTool('xy_panel')
    if (elem) {
      const elname = elem.nodeName

      const angle = this.editor.svgCanvas.getRotationAngle(elem)
      const angleEl = $id('angle') as SeValueElement | null
      if (angleEl) angleEl.value = angle

      const blurval = Number(this.editor.svgCanvas.getBlur(elem)) * 10
      const blurEl = $id('blur') as SeValueElement | null
      if (blurEl) blurEl.value = blurval

      if (
        this.editor.svgCanvas.addedNew &&
        elname === 'image' &&
        this.editor.svgCanvas.getMode() === 'image' &&
        !(this.editor.svgCanvas.getHref(elem) ?? '').startsWith('data:')
      ) {
        // Fire-and-forget: updateContextPanel stays synchronous. `addedNew` is cleared later
        // in this method, so the modal resolving asynchronously (setImageURL / delete) re-triggers
        // updateContextPanel without re-prompting the user.
        void this.promptImgURL({ cancelDeletes: true })
      }

      if (!isNode && currentMode !== 'pathedit') {
        this.displayTool('selected_panel')
        // Elements in this array already have coord fields
        if (['line', 'circle', 'ellipse', 'polygon'].includes(elname)) {
          this.hideTool('xy_panel')
        } else {
          let x
          let y

          // Get BBox vals for g, polyline and path
          if (['g', 'polyline', 'path'].includes(elname)) {
            const bb = this.editor.svgCanvas.getStrokedBBox([elem])
            if (bb) {
              ;({ x, y } = bb)
            }
          } else {
            x = elem.getAttribute('x')
            y = elem.getAttribute('y')
          }

          if (unit) {
            x = convertUnit(x ?? 0)
            y = convertUnit(y ?? 0)
          }
          /** Updates the value of an input field if needed */
          const updateValue = (id: string, newValue: number) => {
            const el = $id(id) as SeValueElement | null
            if (!el) return
            const currentValue = el.value // Get current value from the field
            // do nothing if nothing changed...
            if (parseFloat(String(currentValue)) === newValue) {
              return
            }
            el.value = newValue
          }

          updateValue('selected_x', Number(x ?? 0))
          updateValue('selected_y', Number(y ?? 0))

          this.displayTool('xy_panel')
        }

        // Elements in this array cannot be converted to a path
        if (['image', 'text', 'path', 'g', 'use'].includes(elname)) {
          this.hideTool('tool_topath')
        } else {
          this.displayTool('tool_topath')
        }
        if (elname === 'path') {
          this.displayTool('tool_reorient')
        } else {
          this.hideTool('tool_reorient')
        }
        const reorientEl = $id('tool_reorient') as SeButtonElement | null
        if (reorientEl) reorientEl.disabled = angle === 0
      } else {
        const point = this.path.getNodePoint()
        const addSubpathEl = $id('tool_add_subpath') as SeButtonElement | null
        if (addSubpathEl) addSubpathEl.pressed = false
        const nodeDeleteEl = $id('tool_node_delete')
        if (nodeDeleteEl) {
          if (!this.path.canDeleteNodes) {
            nodeDeleteEl.classList.add('disabled')
          } else {
            nodeDeleteEl.classList.remove('disabled')
          }
        }


        if (point) {
          const segType = $id('seg_type') as SeValueElement | null
          let px: string | number = point.x
          let py: string | number = point.y
          if (unit) {
            px = convertUnit(point.x)
            py = convertUnit(point.y)
          }
          const pnxEl = $id('path_node_x') as SeValueElement | null
          if (pnxEl) pnxEl.value = px
          const pnyEl = $id('path_node_y') as SeValueElement | null
          if (pnyEl) pnyEl.value = py
          if (point.type) {
            if (segType) {
              segType.value = point.type
              ;(segType as HTMLElement).removeAttribute('disabled')
            }
          } else {
            if (segType) {
              segType.value = 4
              ;(segType as HTMLElement).setAttribute('disabled', 'disabled')
            }
          }
        }
        return
      }

      const panels: Record<string, string[]> = {
        g: [],
        a: [],
        rect: ['rx', 'width', 'height'],
        image: ['width', 'height'],
        circle: ['cx', 'cy', 'r'],
        ellipse: ['cx', 'cy', 'rx', 'ry'],
        line: ['x1', 'y1', 'x2', 'y2'],
        polyline: [],
        polygon: [],
        text: [],
        use: []
      }

      const { tagName } = elem

      let linkHref = null
      if (tagName === 'a') {
        linkHref = this.editor.svgCanvas.getHref(elem)
        this.displayTool('g_panel')
      }
      // siblings
      const parentEl = elem.parentElement
      if (parentEl) {
        const siblings = Array.from(parentEl.children).filter(
          (child: Element) => child !== elem
        )
        if (parentEl.tagName === 'a' && !siblings.length) {
          this.displayTool('a_panel')
          linkHref = this.editor.svgCanvas.getHref(parentEl)
        }
      }

      // Hide/show the make_link buttons
      if (linkHref) {
        this.displayTool('tool_make_link')
        this.displayTool('tool_make_link_multi')
        const linkUrlEl = $id('link_url') as SeValueElement | null
        if (linkUrlEl) linkUrlEl.value = linkHref
      } else {
        this.hideTool('tool_make_link')
        this.hideTool('tool_make_link_multi')
      }

      const curPanel = panels[tagName]
      if (curPanel) {
        this.displayTool(tagName + '_panel')

        curPanel.forEach((item) => {
          let attrVal: string | number = elem.getAttribute(item) ?? ''
          const svgEl = elem as SVGElement & Record<string, { baseVal: { value: number } } | undefined>
          const svgProp = svgEl[item]
          if (this.editor.configObj.curConfig.baseUnit !== 'px' && svgProp) {
            const bv = svgProp.baseVal.value
            attrVal = convertUnit(bv)
          }
          const panelEl = $id(`${tagName}_${item}`) as SeValueElement | null
          if (panelEl) panelEl.value = attrVal || 0
        })

        if (tagName === 'text') {
          this.displayTool('text_panel')
          const italicEl = $id('tool_italic') as SeButtonElement | null
          if (italicEl) italicEl.pressed = this.editor.svgCanvas.getItalic()
          const boldEl = $id('tool_bold') as SeButtonElement | null
          if (boldEl) boldEl.pressed = this.editor.svgCanvas.getBold()
          const underlineEl = $id('tool_text_decoration_underline') as SeButtonElement | null
          if (underlineEl) underlineEl.pressed = this.editor.svgCanvas.hasTextDecoration('underline')
          const linethroughEl = $id('tool_text_decoration_linethrough') as SeButtonElement | null
          if (linethroughEl) linethroughEl.pressed = this.editor.svgCanvas.hasTextDecoration('line-through')
          const overlineEl = $id('tool_text_decoration_overline') as SeButtonElement | null
          if (overlineEl) overlineEl.pressed = this.editor.svgCanvas.hasTextDecoration('overline')
          const fontFamilyEl = $id('tool_font_family') as SeValueElement | null
          if (fontFamilyEl) fontFamilyEl.value = elem.getAttribute('font-family') ?? ''
          $id('tool_text_anchor')?.setAttribute(
            'value',
            elem.getAttribute('text-anchor') ?? ''
          )
          const fontSizeEl = $id('font_size') as SeValueElement | null
          if (fontSizeEl) fontSizeEl.value = elem.getAttribute('font-size') ?? ''
          const letterSpEl = $id('tool_letter_spacing') as SeValueElement | null
          if (letterSpEl) letterSpEl.value = elem.getAttribute('letter-spacing') ?? 0
          const wordSpEl = $id('tool_word_spacing') as SeValueElement | null
          if (wordSpEl) wordSpEl.value = elem.getAttribute('word-spacing') ?? 0
          const textLenEl = $id('tool_text_length') as SeValueElement | null
          if (textLenEl) textLenEl.value = elem.getAttribute('textLength') ?? 0
          const lenAdjEl = $id('tool_length_adjust') as SeValueElement | null
          if (lenAdjEl) lenAdjEl.value = elem.getAttribute('lengthAdjust') ?? 0
          const textEl = $id('text') as SeValueElement | null
          if (textEl) textEl.value = elem.textContent ?? ''
          if (this.editor.svgCanvas.addedNew) {
            // TODO: see todo #10 — IE9 setTimeout workaround; safe to remove when IE9 support dropped
            // Timeout needed for IE9
            setTimeout(() => {
              const focusEl = $id('text') as HTMLInputElement | null
              focusEl?.focus()
              focusEl?.select()
            }, 100)
          }
          // text
        } else if (
          tagName === 'image' &&
          this.editor.svgCanvas.getMode() === 'image'
        ) {
          this.editor.svgCanvas.setImageURL(this.editor.svgCanvas.getHref(elem) ?? '')
          // image
        } else if (tagName === 'g' || tagName === 'use') {
          this.displayTool('container_panel')
          const title = this.editor.svgCanvas.getTitle()
          const gTitleEl = $id('g_title') as SeValueElement | null
          if (gTitleEl) gTitleEl.value = title ?? ''
          const gTitleBtn = $id('g_title') as SeButtonElement | null
          if (gTitleBtn) gTitleBtn.disabled = tagName === 'use'
        }
      }
      menuItems?.setAttribute(
        (tagName === 'g' ? 'en' : 'dis') + 'ablemenuitems',
        '#ungroup'
      )
      menuItems?.setAttribute(
        (tagName === 'g' || !this.multiselected ? 'dis' : 'en') +
          'ablemenuitems',
        '#group'
      )

      // if (elem)
    } else if (this.multiselected) {
      // Check if all selected elements are 'text' nodes, if yes enable text panel
      const selElems = this.editor.svgCanvas.getSelectedElements()
      if (selElems.filter((el): el is Element => el !== null).every((el) => el.tagName === 'text')) {
        this.displayTool('text_panel')
      }

      this.displayTool('multiselected_panel')
      menuItems?.setAttribute('enablemenuitems', '#group')
      menuItems?.setAttribute('disablemenuitems', '#ungroup')
    } else {
      menuItems?.setAttribute(
        'disablemenuitems',
        '#delete,#cut,#copy,#group,#ungroup,#move_front,#move_up,#move_down,#move_back'
      )
    }

    // update history buttons
    const undoEl = $id('tool_undo') as SeButtonElement | null
    if (undoEl) undoEl.disabled = this.editor.svgCanvas.undoMgr.getUndoStackSize() === 0
    const redoEl = $id('tool_redo') as SeButtonElement | null
    if (redoEl) redoEl.disabled = this.editor.svgCanvas.undoMgr.getRedoStackSize() === 0

    this.editor.svgCanvas.addedNew = false

    if ((elem && !isNode) || this.multiselected) {
      // update the selected elements' layer
      const layerNamesEl = $id('selLayerNames')
      layerNamesEl?.removeAttribute('disabled')
      const layerNamesValEl = layerNamesEl as SeValueElement | null
      if (layerNamesValEl) layerNamesValEl.value = currentLayerName
      layerNamesEl?.setAttribute('value', currentLayerName)

      // Enable regular menu options
      $id('se-cmenu_canvas')?.setAttribute(
        'enablemenuitems',
        '#delete,#cut,#copy,#move_front,#move_up,#move_down,#move_back'
      )
    } else {
      $id('selLayerNames')?.setAttribute('disabled', 'disabled')
    }
  }

  /**
   * @param [e] Not used.
   */
  showSourceEditor (_e?: Event, forSaving?: boolean): void {
    const $editorDialog = $id('se-svg-editor-dialog')
    if (!$editorDialog || $editorDialog.getAttribute('dialog') === 'open') return
    const origSource = this.editor.svgCanvas.getSvgString()
    $editorDialog.setAttribute('dialog', 'open')
    $editorDialog.setAttribute('value', origSource)
    $editorDialog.setAttribute('copysec', String(Boolean(forSaving)))
    $editorDialog.setAttribute('applysec', String(!forSaving))
  }

  clickWireframe () {
    const wfBtn = $id('tool_wireframe') as SeButtonElement | null
    if (wfBtn) wfBtn.pressed = !wfBtn.pressed
    this.editor.workarea.classList.toggle('wireframe')

    const wfRules = $id('wireframe_rules')
    if (!wfRules) {
      const fcRules = document.createElement('style')
      fcRules.setAttribute('id', 'wireframe_rules')
      ;(document.getElementsByTagName('head')[0] as HTMLElement).appendChild(fcRules)
    } else {
      while (wfRules.firstChild) {
        wfRules.removeChild(wfRules.firstChild)
      }
    }
    this.editor.updateWireFrame()
  }

  clickUndo () {
    const { undoMgr, textActions } = this.editor.svgCanvas
    if (undoMgr.getUndoStackSize() > 0) {
      undoMgr.undo()
      this.editor.layersPanel.populateLayers()
      if (this.editor.svgCanvas.getMode() === 'textedit') {
        textActions.clear()
      }
    }
  }

  clickRedo () {
    const { undoMgr } = this.editor.svgCanvas
    if (undoMgr.getRedoStackSize() > 0) {
      undoMgr.redo()
      this.editor.layersPanel.populateLayers()
    }
  }

  changeRectRadius (e: Event): void {
    this.editor.svgCanvas.setRectRadius((e.target as HTMLInputElement).value)
  }

  changeFontSize (e: Event): void {
    this.editor.svgCanvas.setFontSize(Number((e.target as HTMLInputElement).value))
  }

  changeRotationAngle (e: Event): void {
    const val = (e.target as HTMLInputElement).value
    this.editor.svgCanvas.setRotationAngle(val)
    const reorientEl = $id('tool_reorient')
    if (reorientEl) {
      if (Number.parseInt(val) === 0) {
        reorientEl.classList.add('disabled')
      } else {
        reorientEl.classList.remove('disabled')
      }
    }
  }

  changeBlur (e: Event): void {
    this.editor.svgCanvas.setBlur(Number((e.target as HTMLInputElement).value) / 10, true)
  }

  clickGroup () {
    // group
    if (this.editor.selection.multiselected) {
      this.editor.svgCanvas.groupSelectedElements()
      // ungroup
    } else if (this.editor.selection.selectedElement) {
      this.editor.svgCanvas.ungroupSelectedElement()
    }
  }

  clickClone () {
    this.editor.svgCanvas.cloneSelectedElements(20, 20)
  }

  clickAlignEle (evt: Event): void {
    this.editor.svgCanvas.alignSelectedElements(typedDetail<SeChangeDetail>(evt).value, 'page')
  }

  /**
   * @param pos indicate the alignment relative to top, bottom, middle etc..
   */
  clickAlign (pos: string): void {
    let value = ($id('tool_align_relative') as SeValueElement | null)?.value ?? ''
    if (value === '') {
      value = 'selected'
    }
    this.editor.svgCanvas.alignSelectedElements(pos, String(value))
  }

  attrChanger (e: Event): boolean | void {
    const target = e.target as HTMLInputElement
    const attr = target.getAttribute('data-attr') ?? ''
    let val: string | number = target.value
    const valid = isValidUnit(attr, val, this.selectedElement)

    if (!valid) {
      target.value = this.selectedElement?.getAttribute(attr) ?? ''
      seAlert(this.editor.i18next.t('notification.invalidAttrValGiven'))
      return false
    }

    if (attr !== 'id' && attr !== 'class') {
      if (isNaN(Number(val))) {
        val = this.editor.svgCanvas.convertToNum(attr, val)
      } else if (this.editor.configObj.curConfig.baseUnit !== 'px') {
        // Convert unitless value to one with given unit

        const unitData = getTypeMap()

        const selEl = this.editor.selection.selectedElement as (Element & Record<string, unknown>) | null
        if (
          selEl?.[attr] ||
          this.editor.svgCanvas.getMode() === 'pathedit' ||
          attr === 'x' ||
          attr === 'y'
        ) {
          val = Number(val) * (unitData[this.editor.configObj.curConfig.baseUnit] ?? 1)
        }
      }
    }

    this.editor.svgCanvas.changeSelectedAttribute(attr, val)
    return true
  }

  convertToPath () {
    if (this.editor.selection.selectedElement) {
      this.editor.svgCanvas.convertToPath()
    }
  }

  reorientPath () {
    if (this.editor.selection.selectedElement) {
      this.path.reorient()
    }
  }

  /**
   * Flip selected element(s) horizontally.
   */
  clickFlipHorizontal () {
    if (this.editor.selection.selectedElement || this.multiselected) {
      this.editor.svgCanvas.flipSelectedElements(-1, 1)
    }
  }

  /**
   * Flip selected element(s) vertically.
   */
  clickFlipVertical () {
    if (this.editor.selection.selectedElement || this.multiselected) {
      this.editor.svgCanvas.flipSelectedElements(1, -1)
    }
  }

  async makeHyperlink (): Promise<void> {
    if (this.editor.selection.selectedElement || this.multiselected) {
      const url = await sePrompt(
        this.editor.i18next.t('notification.enterNewLinkURL'),
        'http://'
      )
      if (url) {
        this.editor.svgCanvas.makeHyperlink(url)
      }
    }
  }

  linkControlPoints () {
    const nodeLinkEl = $id('tool_node_link') as SeButtonElement | null
    if (nodeLinkEl) nodeLinkEl.pressed = !nodeLinkEl.pressed
    const linked = !!(nodeLinkEl?.pressed)
    this.path.linkControlPoints(linked)
  }

  clonePathNode () {
    if (this.path.getNodePoint()) {
      this.path.clonePathNode()
    }
  }

  deletePathNode () {
    if (this.path.getNodePoint()) {
      this.path.deletePathNode()
    }
  }

  addSubPath () {
    const button = $id('tool_add_subpath') as SeButtonElement | null
    const sp = !(button?.pressed ?? false)
    if (button) button.pressed = sp
    // button.toggleClass('push_button_pressed tool_button');
    this.path.addSubPath(sp)
  }

  opencloseSubPath () {
    this.path.opencloseSubPath()
  }

  /**
   * Delete is a contextual tool that only appears in the ribbon if
   * an element has been selected.
   */
  deleteSelected () {
    if (this.editor.selection.selectedElement || this.editor.selection.multiselected) {
      this.editor.svgCanvas.deleteSelectedElements()
    }
  }

  moveToTopSelected () {
    if (this.editor.selection.selectedElement) {
      this.editor.svgCanvas.moveToTopSelectedElement()
    }
  }

  moveToBottomSelected () {
    if (this.editor.selection.selectedElement) {
      this.editor.svgCanvas.moveToBottomSelectedElement()
    }
  }

  /**
   * Checks if there are currently selected text elements to avoid firing of bold,italic when no text selected
   */
  get anyTextSelected () {
    const selected = this.editor.svgCanvas.getSelectedElements()
    return selected.filter((el): el is Element => el !== null).filter((el) => el.tagName === 'text').length > 0
  }

  clickBold () {
    if (this.anyTextSelected) {
      this.editor.svgCanvas.setBold(!this.editor.svgCanvas.getBold())
      this.updateContextPanel()
      return false
    }
  }

  clickItalic () {
    if (this.anyTextSelected) {
      this.editor.svgCanvas.setItalic(!this.editor.svgCanvas.getItalic())
      this.updateContextPanel()
      return false
    }
  }

  /**
   * Handles the click on the text decoration buttons
   */
  clickTextDecoration (value: string): boolean | void {
    if (this.editor.svgCanvas.hasTextDecoration(value)) {
      this.editor.svgCanvas.removeTextDecoration(value)
    } else {
      this.editor.svgCanvas.addTextDecoration(value)
    }
    this.updateContextPanel()
    return false
  }

  /**
   * Sets the text anchor value
   *
   */
  clickTextAnchor (evt: Event): boolean | void {
    this.editor.svgCanvas.setTextAnchor(typedDetail<SeChangeDetail>(evt).value)
    return false
  }

  changeLetterSpacing (e: Event): void {
    this.editor.svgCanvas.setLetterSpacing((e.target as HTMLInputElement).value)
  }

  changeWordSpacing (e: Event): void {
    this.editor.svgCanvas.setWordSpacing((e.target as HTMLInputElement).value)
  }

  changeTextLength (e: Event): void {
    this.editor.svgCanvas.setTextLength((e.target as HTMLInputElement).value)
  }

  changeLengthAdjust (evt: Event): void {
    this.editor.svgCanvas.setLengthAdjust(typedDetail<SeChangeDetail>(evt).value)
  }

  /**
   * Set a selected image's URL.
   * @function module:SVGthis.setImageURL
   */
  setImageURL (url: string): void {
    const { editor } = this
    if (!url) {
      url = editor.defaultImageURL
    }
    editor.svgCanvas.setImageURL(url)
    const imgUrlEl = $id('image_url') as SeValueElement | null
    if (imgUrlEl) imgUrlEl.value = url

    if (url.startsWith('data:')) {
      // data URI found
      this.hideTool('image_url')
    } else {
      // regular URL
      const promised = editor.svgCanvas.embedImage(url)
      promised
        .then(
          () => {
            // switch into "select" mode if we've clicked on an element
            editor.svgCanvas.setMode('select')
            editor.svgCanvas.selectOnly(
              editor.svgCanvas.getSelectedElements().filter((el): el is Element => el !== null),
              true
            )
          },
          (error: unknown) => {
            console.error('error =', error)
            seAlert(editor.i18next.t('tools.no_embed'))
            editor.svgCanvas.deleteSelectedElements()
          }
        )
      this.displayTool('image_url')
    }
  }

  updateTitle (title?: string): void {
    if (title) this.editor.title = title
    const titleElement = $qa('#title_panel > p')[0]
    if (titleElement) titleElement.textContent = this.editor.title
  }

  togglePathEditMode (editMode: boolean, elems: Element[]): void {
    if (editMode) {
      this.displayTool('path_node_panel')
    } else {
      this.hideTool('path_node_panel')
    }
    if (editMode) {
      // Change select icon
      const pathBtn = $id('tool_path') as SeButtonElement | null
      if (pathBtn) pathBtn.pressed = false
      const selectBtn = $id('tool_select') as SeButtonElement | null
      if (selectBtn) {
        selectBtn.pressed = true
        selectBtn.src = 'select_node.svg'
      }
      this.editor.selection.multiselected = false
      if (elems.length) {
        this.editor.selection.selectedElement = elems[0] ?? null
      }
    } else {
      setTimeout(() => {
        const selectBtn = $id('tool_select') as SeButtonElement | null
        if (selectBtn) selectBtn.src = 'select.svg'
      }, 1000)
    }
  }

  init () {
    // add Top panel
    const template = document.createElement('template')
    const { i18next } = this.editor
    template.innerHTML = topPanelHTML
    this.editor.$svgEditor.append(template.content.cloneNode(true))
    // svg editor source dialoag added to DOM
    const newSeEditorDialog = document.createElement(
      'se-svg-source-editor-dialog'
    ) as unknown as SeSvgSourceDialogElement
    newSeEditorDialog.setAttribute('id', 'se-svg-editor-dialog')
    this.editor.$container.append(newSeEditorDialog)
    this.updateTitle()
    newSeEditorDialog.init(i18next)
    $id('tool_link_url')?.setAttribute('title', i18next.t('tools.set_link_url'))
    // register action to top panel buttons
    safeClick($id('tool_source'), (e: Event) => this.showSourceEditor(e))
    safeClick($id('tool_wireframe'), this.clickWireframe.bind(this))
    safeClick($id('tool_undo'), this.clickUndo.bind(this))
    safeClick($id('tool_redo'), this.clickRedo.bind(this))
    safeClick($id('tool_clone'), this.clickClone.bind(this))
    safeClick($id('tool_clone_multi'), this.clickClone.bind(this))
    safeClick($id('tool_delete'), this.deleteSelected.bind(this))
    safeClick($id('tool_delete_multi'), this.deleteSelected.bind(this))
    safeClick($id('tool_move_top'), this.moveToTopSelected.bind(this))
    safeClick($id('tool_move_bottom'), this.moveToBottomSelected.bind(this))
    safeClick($id('tool_topath'), this.convertToPath.bind(this))
    safeClick($id('tool_make_link'), () => { void this.makeHyperlink() })
    safeClick($id('tool_make_link_multi'), () => { void this.makeHyperlink() })
    safeClick($id('tool_reorient'), this.reorientPath.bind(this))
    safeClick($id('tool_flip_h'), this.clickFlipHorizontal.bind(this))
    safeClick($id('tool_flip_v'), this.clickFlipVertical.bind(this))
    safeClick($id('tool_group_elements'), this.clickGroup.bind(this))
    $id('tool_position')?.addEventListener('change', (evt: Event) =>
      this.clickAlignEle(evt)
    )
    safeClick($id('tool_align_left'), () => this.clickAlign.bind(this)('left'))
    safeClick($id('tool_align_right'), () => this.clickAlign.bind(this)('right'))
    safeClick($id('tool_align_center'), () => this.clickAlign.bind(this)('center'))
    safeClick($id('tool_align_top'), () => this.clickAlign.bind(this)('top'))
    safeClick($id('tool_align_bottom'), () => this.clickAlign.bind(this)('bottom'))
    safeClick($id('tool_align_middle'), () => this.clickAlign.bind(this)('middle'))
    safeClick($id('tool_align_distrib_horiz'), () =>
      this.clickAlign.bind(this)('distrib_horiz')
    )
    safeClick($id('tool_align_distrib_verti'), () =>
      this.clickAlign.bind(this)('distrib_verti')
    )
    safeClick($id('tool_node_clone'), this.clonePathNode.bind(this))
    safeClick($id('tool_node_delete'), this.deletePathNode.bind(this))
    safeClick($id('tool_openclose_path'), this.opencloseSubPath.bind(this))
    safeClick($id('tool_add_subpath'), this.addSubPath.bind(this))
    safeClick($id('tool_node_link'), this.linkControlPoints.bind(this))
    $id('angle')?.addEventListener('change', this.changeRotationAngle.bind(this))
    $id('blur')?.addEventListener('change', this.changeBlur.bind(this))
    $id('rect_rx')?.addEventListener('change', this.changeRectRadius.bind(this))
    $id('font_size')?.addEventListener('change', this.changeFontSize.bind(this))
    safeClick($id('tool_ungroup'), this.clickGroup.bind(this))
    safeClick($id('tool_bold'), this.clickBold.bind(this))
    safeClick($id('tool_italic'), this.clickItalic.bind(this))
    safeClick($id('tool_text_decoration_underline'), () =>
      this.clickTextDecoration.bind(this)('underline')
    )
    safeClick($id('tool_text_decoration_linethrough'), () =>
      this.clickTextDecoration.bind(this)('line-through')
    )
    safeClick($id('tool_text_decoration_overline'), () =>
      this.clickTextDecoration.bind(this)('overline')
    )
    $id('tool_text_anchor')?.addEventListener('change', (evt: Event) =>
      this.clickTextAnchor(evt)
    )
    $id('tool_letter_spacing')?.addEventListener(
      'change',
      this.changeLetterSpacing.bind(this)
    )
    $id('tool_word_spacing')?.addEventListener(
      'change',
      this.changeWordSpacing.bind(this)
    )
    $id('tool_text_length')?.addEventListener(
      'change',
      this.changeTextLength.bind(this)
    )
    $id('tool_length_adjust')?.addEventListener('change', (evt: Event) =>
      this.changeLengthAdjust(evt)
    )
    safeClick($id('tool_unlink_use'), this.clickGroup.bind(this))
    $id('image_url')?.addEventListener('change', (evt: Event) => {
      this.setImageURL((evt.currentTarget as HTMLInputElement).value)
    })

    // all top panel attributes
    ;[
      'elem_id',
      'elem_class',
      'circle_cx',
      'circle_cy',
      'circle_r',
      'ellipse_cx',
      'ellipse_cy',
      'ellipse_rx',
      'ellipse_ry',
      'selected_x',
      'selected_y',
      'rect_width',
      'rect_height',
      'line_x1',
      'line_x2',
      'line_y1',
      'line_y2',
      'image_width',
      'image_height',
      'path_node_x',
      'path_node_y'
    ].forEach(attrId =>
      $id(attrId)?.addEventListener('change', this.attrChanger.bind(this))
    )
  }
}

export default TopPanel
