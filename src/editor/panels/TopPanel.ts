/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-expressions */
// editor / panel API surface is loosely typed; full typing deferred to follow-up

import SvgCanvas from '@svgedit/svgcanvas'
// @ts-expect-error: TopPanel.html imported as string via vite-plugin-string; no ambient module declaration
import topPanelHTML from './TopPanel.html'

const { $qa, $id, $click, isValidUnit, getTypeMap, convertUnit } = SvgCanvas

/*
 * register actions for left panel
 */
/**
 *
 */
class TopPanel {
  editor: any

  /**
   * @param editor svgedit handler
   */
  constructor (editor: any) {
    this.editor = editor
  }

  /**
   */
  displayTool (className: string): void {
    // default display is 'none' so removing the property will make the panel visible
    $qa(`.${className}`).map((el: any) => el.style.removeProperty('display'))
  }

  /**
   */
  hideTool (className: string): void {
    $qa(`.${className}`).forEach((el: any) => {
      el.style.display = 'none'
    })
  }

  /**
   */
  get selectedElement () {
    return this.editor.selectedElement
  }

  /**
   */
  get multiselected () {
    return this.editor.multiselected
  }

  /**
   */
  get path () {
    return this.editor.svgCanvas.pathActions
  }

  /**
   *
   * @param opt
   * @param changeElem
   */
  setStrokeOpt (opt: HTMLElement, changeElem?: boolean): void {
    const { id } = opt
    const bits = id.split('_')
    const [pre, val] = bits

    if (changeElem) {
      // TODO: see todo #10 — likely should be this.editor.svgCanvas (pre-existing bug)
      ;(this as any).svgCanvas.setStrokeAttr('stroke-' + pre, val)
    }
    opt.classList.add('current')
    const parent = opt.parentElement
    if (!parent) return
    const elements = Array.prototype.filter.call(
      parent.children,
      function (child) {
        return child !== opt
      }
    )
    Array.from(elements).forEach(function (element) {
      element.classList.remove('current')
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
    ;($qa('#title_panel > p') as any)[0].textContent = this.editor.title
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
            const swidth = childs[i].getAttribute('stroke-width')

            if (i === 0) {
              gWidth = swidth
            } else if (gWidth !== swidth) {
              gWidth = null
            }
          }

          ;($id('stroke_width') as any).value = gWidth === null ? '' : gWidth
          this.editor.bottomPanel.updateColorpickers(false)
          break
        }
        default: {
          this.editor.bottomPanel.updateColorpickers(false)

          ;($id('stroke_width') as any).value =
            this.selectedElement.getAttribute('stroke-width') || 1
          ;($id('stroke_style') as any).value =
            this.selectedElement.getAttribute('stroke-dasharray') || 'none'
          ;($id('stroke_style') as any).setAttribute('value', ($id('stroke_style') as any).value)

          let attr =
            this.selectedElement.getAttribute('stroke-linejoin') || 'miter'

          const linejoinEl = $id('linejoin_' + attr)
          if (linejoinEl) {
            this.setStrokeOpt(linejoinEl)
            ;($id('stroke_linejoin') as any).setAttribute('value', attr)
          }

          attr = this.selectedElement.getAttribute('stroke-linecap') || 'butt'
          const linecapEl = $id('linecap_' + attr)
          if (linecapEl) {
            this.setStrokeOpt(linecapEl)
            ;($id('stroke_linecap') as any).setAttribute('value', attr)
          }
        }
      }
    }

    // All elements including image and group have opacity
    if (this.selectedElement) {
      const opacPerc =
        (this.selectedElement.getAttribute('opacity') || 1.0) * 100
      ;($id('opacity') as any).value = opacPerc
      ;($id('elem_id') as any).value = this.selectedElement.id
      ;($id('elem_class') as any).value = this.selectedElement.getAttribute('class') ?? ''
    }

    this.editor.bottomPanel.updateToolButtonState()
  }

  /**
   * @param [opts={}]
   * @param [opts.cancelDeletes=false]
   * @returns Resolves to `undefined`
   */
  promptImgURL ({ cancelDeletes = false } = {}) {
    let curhref = this.editor.svgCanvas.getHref(this.editor.selectedElement)
    curhref = curhref.startsWith('data:') ? '' : curhref
    // TODO: see todo #10 — native prompt(); replace with custom dialog
    const url = prompt(
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
    let elem = this.editor.selectedElement
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
    const menuItems = $id('se-cmenu_canvas') as any
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
      ;($id('angle') as any).value = angle

      const blurval = this.editor.svgCanvas.getBlur(elem) * 10
      ;($id('blur') as any).value = blurval

      if (
        this.editor.svgCanvas.addedNew &&
        elname === 'image' &&
        this.editor.svgCanvas.getMode() === 'image' &&
        !this.editor.svgCanvas.getHref(elem).startsWith('data:')
      ) {
        /* await */ this.promptImgURL({ cancelDeletes: true })
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
            x = convertUnit(x)
            y = convertUnit(y)
          }
          /**
           * Updates the value of an input field if needed
           * @param id - The ID of the input element to be updated.
           * @param newValue - The new numeric value to set in the input field.
           */
          const updateValue = (id: string, newValue: number) => {
            const currentValue = ($id(id) as any).value // Get current value from the field
            // do nothing if nothing changed...
            if (parseFloat(currentValue) === newValue) {
              return
            }
            ;($id(id) as any).value = newValue
          }

          updateValue('selected_x', x)
          updateValue('selected_y', y)

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
        ;($id('tool_reorient') as any).disabled = angle === 0
      } else {
        const point = this.path.getNodePoint()
        ;($id('tool_add_subpath') as any).pressed = false
        !this.path.canDeleteNodes
          ? ($id('tool_node_delete') as any).classList.add('disabled')
          : ($id('tool_node_delete') as any).classList.remove('disabled')

        // Show open/close button based on selected point
        // setIcon('#tool_openclose_path', path.closed_subpath ? 'open_path' : 'close_path');

        if (point) {
          const segType = ($id('seg_type') as any)
          if (unit) {
            point.x = convertUnit(point.x)
            point.y = convertUnit(point.y)
          }
          ;($id('path_node_x') as any).value = point.x
          ;($id('path_node_y') as any).value = point.y
          if (point.type) {
            segType.value = point.type
            segType.removeAttribute('disabled')
          } else {
            segType.value = 4
            segType.setAttribute('disabled', 'disabled')
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
      if (elem.parentNode) {
        const selements = Array.prototype.filter.call(
          elem.parentNode.children,
          function (child) {
            return child !== elem
          }
        )
        if (elem.parentNode.tagName === 'a' && !selements.length) {
          this.displayTool('a_panel')
          linkHref = this.editor.svgCanvas.getHref(elem.parentNode)
        }
      }

      // Hide/show the make_link buttons
      if (linkHref) {
        this.displayTool('tool_make_link')
        this.displayTool('tool_make_link_multi')
        ;($id('link_url') as any).value = linkHref
      } else {
        this.hideTool('tool_make_link')
        this.hideTool('tool_make_link_multi')
      }

      if ((panels as any)[tagName]) {
        const curPanel = (panels as any)[tagName]
        this.displayTool(tagName + '_panel')

        curPanel.forEach((item: any) => {
          let attrVal = elem.getAttribute(item)
          if (this.editor.configObj.curConfig.baseUnit !== 'px' && elem[item]) {
            const bv = elem[item].baseVal.value
            attrVal = convertUnit(bv)
          }
          ;($id(`${tagName}_${item}`) as any).value = attrVal || 0
        })

        if (tagName === 'text') {
          this.displayTool('text_panel')
          ;($id('tool_italic') as any).pressed = this.editor.svgCanvas.getItalic()
          ;($id('tool_bold') as any).pressed = this.editor.svgCanvas.getBold()
          ;($id('tool_text_decoration_underline') as any).pressed =
            this.editor.svgCanvas.hasTextDecoration('underline')
          ;($id('tool_text_decoration_linethrough') as any).pressed =
            this.editor.svgCanvas.hasTextDecoration('line-through')
          ;($id('tool_text_decoration_overline') as any).pressed =
            this.editor.svgCanvas.hasTextDecoration('overline')
          ;($id('tool_font_family') as any).value = elem.getAttribute('font-family')
          ;($id('tool_text_anchor') as any).setAttribute(
            'value',
            elem.getAttribute('text-anchor')
          )
          ;($id('font_size') as any).value = elem.getAttribute('font-size')
          ;($id('tool_letter_spacing') as any).value =
            elem.getAttribute('letter-spacing') ?? 0
          ;($id('tool_word_spacing') as any).value =
            elem.getAttribute('word-spacing') ?? 0
          ;($id('tool_text_length') as any).value = elem.getAttribute('textLength') ?? 0
          ;($id('tool_length_adjust') as any).value =
            elem.getAttribute('lengthAdjust') ?? 0
          ;($id('text') as any).value = elem.textContent
          if (this.editor.svgCanvas.addedNew) {
            // TODO: see todo #10 — IE9 setTimeout workaround; safe to remove when IE9 support dropped
            // Timeout needed for IE9
            setTimeout(() => {
              ;($id('text') as any).focus()
              ;($id('text') as any).select()
            }, 100)
          }
          // text
        } else if (
          tagName === 'image' &&
          this.editor.svgCanvas.getMode() === 'image'
        ) {
          this.editor.svgCanvas.setImageURL(this.editor.svgCanvas.getHref(elem))
          // image
        } else if (tagName === 'g' || tagName === 'use') {
          this.displayTool('container_panel')
          const title = this.editor.svgCanvas.getTitle()
          const label = ($id('g_title') as any)
          label.value = title
          ;($id('g_title') as any).disabled = tagName === 'use'
        }
      }
      menuItems.setAttribute(
        (tagName === 'g' ? 'en' : 'dis') + 'ablemenuitems',
        '#ungroup'
      )
      menuItems.setAttribute(
        (tagName === 'g' || !this.multiselected ? 'dis' : 'en') +
          'ablemenuitems',
        '#group'
      )

      // if (elem)
    } else if (this.multiselected) {
      // Check if all selected elements are 'text' nodes, if yes enable text panel
      const selElems = this.editor.svgCanvas.getSelectedElements()
      if (selElems.every((elem: any) => elem.tagName === 'text')) {
        this.displayTool('text_panel')
      }

      this.displayTool('multiselected_panel')
      menuItems.setAttribute('enablemenuitems', '#group')
      menuItems.setAttribute('disablemenuitems', '#ungroup')
    } else {
      menuItems.setAttribute(
        'disablemenuitems',
        '#delete,#cut,#copy,#group,#ungroup,#move_front,#move_up,#move_down,#move_back'
      )
    }

    // update history buttons
    ;($id('tool_undo') as any).disabled =
      this.editor.svgCanvas.undoMgr.getUndoStackSize() === 0
    ;($id('tool_redo') as any).disabled =
      this.editor.svgCanvas.undoMgr.getRedoStackSize() === 0

    this.editor.svgCanvas.addedNew = false

    if ((elem && !isNode) || this.multiselected) {
      // update the selected elements' layer
      ;($id('selLayerNames') as any).removeAttribute('disabled')
      ;($id('selLayerNames') as any).value = currentLayerName
      ;($id('selLayerNames') as any).setAttribute('value', currentLayerName)

      // Enable regular menu options
      const canCMenu = $id('se-cmenu_canvas') as any
      canCMenu.setAttribute(
        'enablemenuitems',
        '#delete,#cut,#copy,#move_front,#move_up,#move_down,#move_back'
      )
    } else {
      ;($id('selLayerNames') as any).setAttribute('disabled', 'disabled')
    }
  }

  /**
   * @param [e] Not used.
   * @param forSaving
   */
  showSourceEditor (_e?: any, forSaving?: boolean): void {
    const $editorDialog = $id('se-svg-editor-dialog') as any
    if ($editorDialog.getAttribute('dialog') === 'open') return
    const origSource = this.editor.svgCanvas.getSvgString()
    $editorDialog.setAttribute('dialog', 'open')
    $editorDialog.setAttribute('value', origSource)
    $editorDialog.setAttribute('copysec', Boolean(forSaving))
    $editorDialog.setAttribute('applysec', !forSaving)
  }

  /**
   *
   */
  clickWireframe () {
    ;($id('tool_wireframe') as any).pressed = !($id('tool_wireframe') as any).pressed
    this.editor.workarea.classList.toggle('wireframe')

    const wfRules = ($id('wireframe_rules') as any)
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

  /**
   *
   */
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

  /**
   *
   */
  clickRedo () {
    const { undoMgr } = this.editor.svgCanvas
    if (undoMgr.getRedoStackSize() > 0) {
      undoMgr.redo()
      this.editor.layersPanel.populateLayers()
    }
  }

  /**
   */
  changeRectRadius (e: any): void {
    this.editor.svgCanvas.setRectRadius(e.target.value)
  }

  /**
   */
  changeFontSize (e: any): void {
    this.editor.svgCanvas.setFontSize(e.target.value)
  }

  /**
   */
  changeRotationAngle (e: any): void {
    this.editor.svgCanvas.setRotationAngle(e.target.value)
    if (Number.parseInt(e.target.value) === 0) {
      ;($id('tool_reorient') as any).classList.add('disabled')
    } else {
      ;($id('tool_reorient') as any).classList.remove('disabled')
    }
  }

  /**
   * @param e
   */
  changeBlur (e: any): void {
    this.editor.svgCanvas.setBlur(e.target.value / 10, true)
  }

  /**
   *
   */
  clickGroup () {
    // group
    if (this.editor.multiselected) {
      this.editor.svgCanvas.groupSelectedElements()
      // ungroup
    } else if (this.editor.selectedElement) {
      this.editor.svgCanvas.ungroupSelectedElement()
    }
  }

  /**
   *
   */
  clickClone () {
    this.editor.svgCanvas.cloneSelectedElements(20, 20)
  }

  /**
   * @param evt
   */
  clickAlignEle (evt: any): void {
    this.editor.svgCanvas.alignSelectedElements(evt.detail.value, 'page')
  }

  /**
   * @param pos indicate the alignment relative to top, bottom, middle etc..
   */
  clickAlign (pos: string): void {
    let value = ($id('tool_align_relative') as any).value
    if (value === '') {
      value = 'selected'
    }
    this.editor.svgCanvas.alignSelectedElements(pos, value)
  }

  /**
   *
   */
  attrChanger (e: any): boolean | void {
    const attr = e.target.getAttribute('data-attr')
    let val = e.target.value
    const valid = isValidUnit(attr, val, this.selectedElement)

    if (!valid) {
      e.target.value = this.selectedElement.getAttribute(attr)
      // TODO: see todo #10 — native alert(); replace with seAlert
      alert(this.editor.i18next.t('notification.invalidAttrValGiven'))
      return false
    }

    if (attr !== 'id' && attr !== 'class') {
      if (isNaN(val)) {
        val = this.editor.svgCanvas.convertToNum(attr, val)
      } else if (this.editor.configObj.curConfig.baseUnit !== 'px') {
        // Convert unitless value to one with given unit

        const unitData = getTypeMap()

        if (
          this.editor.selectedElement[attr] ||
          this.editor.svgCanvas.getMode() === 'pathedit' ||
          attr === 'x' ||
          attr === 'y'
        ) {
          val *= (unitData as any)[this.editor.configObj.curConfig.baseUnit]
        }
      }
    }

    this.editor.svgCanvas.changeSelectedAttribute(attr, val)
    return true
  }

  /**
   *
   */
  convertToPath () {
    if (this.editor.selectedElement) {
      this.editor.svgCanvas.convertToPath()
    }
  }

  /**
   *
   */
  reorientPath () {
    if (this.editor.selectedElement) {
      this.path.reorient()
    }
  }

  /**
   * Flip selected element(s) horizontally.
   */
  clickFlipHorizontal () {
    if (this.editor.selectedElement || this.multiselected) {
      this.editor.svgCanvas.flipSelectedElements(-1, 1)
    }
  }

  /**
   * Flip selected element(s) vertically.
   */
  clickFlipVertical () {
    if (this.editor.selectedElement || this.multiselected) {
      this.editor.svgCanvas.flipSelectedElements(1, -1)
    }
  }

  /**
   *
   * @returns Resolves to `undefined`
   */
  makeHyperlink (): void {
    if (this.editor.selectedElement || this.multiselected) {
      // TODO: see todo #10 — native prompt(); replace with custom dialog
      const url = prompt(
        this.editor.i18next.t('notification.enterNewLinkURL'),
        'http://'
      )
      if (url) {
        this.editor.svgCanvas.makeHyperlink(url)
      }
    }
  }

  /**
   *
   */
  linkControlPoints () {
    ;($id('tool_node_link') as any).pressed = !($id('tool_node_link') as any).pressed
    const linked = !!($id('tool_node_link') as any).pressed
    this.path.linkControlPoints(linked)
  }

  /**
   *
   */
  clonePathNode () {
    if (this.path.getNodePoint()) {
      this.path.clonePathNode()
    }
  }

  /**
   *
   */
  deletePathNode () {
    if (this.path.getNodePoint()) {
      this.path.deletePathNode()
    }
  }

  /**
   *
   */
  addSubPath () {
    const button = ($id('tool_add_subpath') as any)
    const sp = !button.classList.contains('pressed')
    button.pressed = sp
    // button.toggleClass('push_button_pressed tool_button');
    this.path.addSubPath(sp)
  }

  /**
   *
   */
  opencloseSubPath () {
    this.path.opencloseSubPath()
  }

  /**
   * Delete is a contextual tool that only appears in the ribbon if
   * an element has been selected.
   */
  deleteSelected () {
    if (this.editor.selectedElement || this.editor.multiselected) {
      this.editor.svgCanvas.deleteSelectedElements()
    }
  }

  /**
   *
   */
  moveToTopSelected () {
    if (this.editor.selectedElement) {
      this.editor.svgCanvas.moveToTopSelectedElement()
    }
  }

  /**
   *
   */
  moveToBottomSelected () {
    if (this.editor.selectedElement) {
      this.editor.svgCanvas.moveToBottomSelectedElement()
    }
  }

  /**
   * Checks if there are currently selected text elements to avoid firing of bold,italic when no text selected
   */
  get anyTextSelected () {
    const selected = this.editor.svgCanvas.getSelectedElements()
    return selected.filter((el: any) => el.tagName === 'text').length > 0
  }

  /**
   *
   */
  clickBold () {
    if (this.anyTextSelected) {
      this.editor.svgCanvas.setBold(!this.editor.svgCanvas.getBold())
      this.updateContextPanel()
      return false
    }
  }

  /**
   *
   */
  clickItalic () {
    if (this.anyTextSelected) {
      this.editor.svgCanvas.setItalic(!this.editor.svgCanvas.getItalic())
      this.updateContextPanel()
      return false
    }
  }

  /**
   * Handles the click on the text decoration buttons
   *
   * @param value The text decoration value
   * @returns false
   */
  clickTextDecoration (value: any): boolean | void {
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
  clickTextAnchor (evt: any): boolean | void {
    this.editor.svgCanvas.setTextAnchor(evt.detail.value)
    return false
  }

  /**
   */
  changeLetterSpacing (e: any): void {
    this.editor.svgCanvas.setLetterSpacing(e.target.value)
  }

  /**
   */
  changeWordSpacing (e: any): void {
    this.editor.svgCanvas.setWordSpacing(e.target.value)
  }

  /**
   */
  changeTextLength (e: any): void {
    this.editor.svgCanvas.setTextLength(e.target.value)
  }

  /**
   */
  changeLengthAdjust (evt: any): void {
    this.editor.svgCanvas.setLengthAdjust(evt.detail.value)
  }

  /**
   * Set a selected image's URL.
   * @function module:SVGthis.setImageURL
   * @param url
   */
  setImageURL (url: string): void {
    const { editor } = this
    if (!url) {
      url = editor.defaultImageURL
    }
    editor.svgCanvas.setImageURL(url)
    ;($id('image_url') as any).value = url

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
              editor.svgCanvas.getSelectedElements(),
              true
            )
          },
          (error: any) => {
            console.error('error =', error)
            seAlert(editor.i18next.t('tools.no_embed'))
            editor.svgCanvas.deleteSelectedElements()
          }
        )
      this.displayTool('image_url')
    }
  }

  /**
   *
   */
  updateTitle (title?: any): void {
    if (title) this.editor.title = title
    const titleElement = $qa('#title_panel > p')[0]
    if (titleElement) titleElement.textContent = this.editor.title
  }

  /**
   * @param editmode
   * @param elems
   */
  togglePathEditMode (editMode: any, elems: any): void {
    if (editMode) {
      this.displayTool('path_node_panel')
    } else {
      this.hideTool('path_node_panel')
    }
    if (editMode) {
      // Change select icon
      ;($id('tool_path') as any).pressed = false
      ;($id('tool_select') as any).pressed = true
      ;($id('tool_select') as any).setAttribute('src', 'select_node.svg')
      this.editor.multiselected = false
      if (elems.length) {
        this.editor.selectedElement = elems[0]
      }
    } else {
      setTimeout(() => {
        ;($id('tool_select') as any).setAttribute('src', 'select.svg')
      }, 1000)
    }
  }

  /**
   */
  init () {
    // add Top panel
    const template = document.createElement('template')
    const { i18next } = this.editor
    template.innerHTML = topPanelHTML
    this.editor.$svgEditor.append(template.content.cloneNode(true))
    // svg editor source dialoag added to DOM
    const newSeEditorDialog = document.createElement(
      'se-svg-source-editor-dialog'
    ) as any
    newSeEditorDialog.setAttribute('id', 'se-svg-editor-dialog')
    this.editor.$container.append(newSeEditorDialog)
    this.updateTitle()
    newSeEditorDialog.init(i18next)
    ;($id('tool_link_url') as any).setAttribute('title', i18next.t('tools.set_link_url'))
    // register action to top panel buttons
    $click($id('tool_source')!, (e: any) => this.showSourceEditor(e))
    $click($id('tool_wireframe')!, this.clickWireframe.bind(this))
    $click($id('tool_undo')!, this.clickUndo.bind(this))
    $click($id('tool_redo')!, this.clickRedo.bind(this))
    $click($id('tool_clone')!, this.clickClone.bind(this))
    $click($id('tool_clone_multi')!, this.clickClone.bind(this))
    $click($id('tool_delete')!, this.deleteSelected.bind(this))
    $click($id('tool_delete_multi')!, this.deleteSelected.bind(this))
    $click($id('tool_move_top')!, this.moveToTopSelected.bind(this))
    $click($id('tool_move_bottom')!, this.moveToBottomSelected.bind(this))
    $click($id('tool_topath')!, this.convertToPath.bind(this))
    $click($id('tool_make_link')!, this.makeHyperlink.bind(this))
    $click($id('tool_make_link_multi')!, this.makeHyperlink.bind(this))
    $click($id('tool_reorient')!, this.reorientPath.bind(this))
    $click($id('tool_flip_h')!, this.clickFlipHorizontal.bind(this))
    $click($id('tool_flip_v')!, this.clickFlipVertical.bind(this))
    $click($id('tool_group_elements')!, this.clickGroup.bind(this))
    $id('tool_position')!.addEventListener('change', evt =>
      this.clickAlignEle.bind(this)(evt)
    )
    $click($id('tool_align_left')!, () => this.clickAlign.bind(this)('left'))
    $click($id('tool_align_right')!, () => this.clickAlign.bind(this)('right'))
    $click($id('tool_align_center')!, () => this.clickAlign.bind(this)('center'))
    $click($id('tool_align_top')!, () => this.clickAlign.bind(this)('top'))
    $click($id('tool_align_bottom')!, () => this.clickAlign.bind(this)('bottom'))
    $click($id('tool_align_middle')!, () => this.clickAlign.bind(this)('middle'))
    $click($id('tool_align_distrib_horiz')!, () =>
      this.clickAlign.bind(this)('distrib_horiz')
    )
    $click($id('tool_align_distrib_verti')!, () =>
      this.clickAlign.bind(this)('distrib_verti')
    )
    $click($id('tool_node_clone')!, this.clonePathNode.bind(this))
    $click($id('tool_node_delete')!, this.deletePathNode.bind(this))
    $click($id('tool_openclose_path')!, this.opencloseSubPath.bind(this))
    $click($id('tool_add_subpath')!, this.addSubPath.bind(this))
    $click($id('tool_node_link')!, this.linkControlPoints.bind(this))
    $id('angle')!.addEventListener('change', this.changeRotationAngle.bind(this))
    $id('blur')!.addEventListener('change', this.changeBlur.bind(this))
    $id('rect_rx')!.addEventListener('change', this.changeRectRadius.bind(this))
    $id('font_size')!.addEventListener('change', this.changeFontSize.bind(this))
    $click($id('tool_ungroup')!, this.clickGroup.bind(this))
    $click($id('tool_bold')!, this.clickBold.bind(this))
    $click($id('tool_italic')!, this.clickItalic.bind(this))
    $click($id('tool_text_decoration_underline')!, () =>
      this.clickTextDecoration.bind(this)('underline')
    )
    $click($id('tool_text_decoration_linethrough')!, () =>
      this.clickTextDecoration.bind(this)('line-through')
    )
    $click($id('tool_text_decoration_overline')!, () =>
      this.clickTextDecoration.bind(this)('overline')
    )
    $id('tool_text_anchor')!.addEventListener('change', evt =>
      this.clickTextAnchor.bind(this)(evt)
    )
    $id('tool_letter_spacing')!.addEventListener(
      'change',
      this.changeLetterSpacing.bind(this)
    )
    $id('tool_word_spacing')!.addEventListener(
      'change',
      this.changeWordSpacing.bind(this)
    )
    $id('tool_text_length')!.addEventListener(
      'change',
      this.changeTextLength.bind(this)
    )
    $id('tool_length_adjust')!.addEventListener('change', evt =>
      this.changeLengthAdjust.bind(this)(evt)
    )
    $click($id('tool_unlink_use')!, this.clickGroup.bind(this))
    $id('image_url')!.addEventListener('change', (evt: any) => {
      this.setImageURL(evt.currentTarget.value)
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
      $id(attrId)!.addEventListener('change', this.attrChanger.bind(this))
    )
  }
}

export default TopPanel
