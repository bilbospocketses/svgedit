/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// i18next is passed as `any` from the editor; typing deferred to #3 (full i18n type pass)
import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { map } from 'lit/directives/map.js'
import { classMap } from 'lit/directives/class-map.js'

/**
 * @class SeEditPrefsDialog
 *
 * Editor Preferences dialog — language, background, grid, rulers, base unit.
 * Converted from elix-dialog + external HTML template to Lit 3 LitElement
 * with native HTML5 <dialog>.
 */
@customElement('se-edit-prefs-dialog')
export class SeEditPrefsDialog extends LitElement {
  static styles = css`
    :not(:defined) {
      display: none;
    }

    dialog {
      padding: 0;
      border: none;
      background: transparent;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.3);
    }

    .toolbar_button button {
      border: 1px solid #dedede;
      line-height: 130%;
      float: left;
      background: #E8E8E8 none;
      padding: 5px 10px 5px 7px;
      line-height: 17px;
      margin: 5px 20px 0 0;
      border: 1px var(--border-color) solid;
      border-top-color: #FFF;
      border-left-color: #FFF;
      border-radius: 5px;
      -moz-border-radius: 5px;
      -webkit-border-radius: 5px;
      cursor: pointer;
    }

    .toolbar_button button:hover {
      border: 1px #e0a874 solid;
      border-top-color: #fcd9ba;
      border-left-color: #fcd9ba;
      background-color: #FFC;
    }

    .toolbar_button button:active {
      background-color: #F4E284;
      border-left: 1px solid #663300;
      border-top: 1px solid #663300;
    }

    .toolbar_button button .svg_icon {
      margin: 0 3px -3px 0 !important;
      padding: 0;
      border: none;
      width: 16px;
      height: 16px;
    }

    .color_block {
      top: 0;
      left: 0;
    }

    .color_block svg {
      display: block;
    }

    #bg_blocks {
      overflow: auto;
      margin-left: 30px;
    }

    #bg_blocks .color_block {
      position: static;
    }

    #svginfo_bg_note {
      font-size: .9em;
      font-style: italic;
      color: #444;
    }

    #svg_prefs_container {
      padding: 10px;
      background-color: #5a6162;
      color: #c5c5c5;
      border: 1px outset #777;
      opacity: 1.0;
      font-family: Verdana, Helvetica, sans-serif;
      font-size: .8em;
      z-index: 20001;
    }

    #tool_prefs_back {
      margin-left: 1em;
      overflow: auto;
    }

    #tool_prefs_save {
      width: 30%;
      background-color: #c79605;
      margin-left: 20%;
    }

    #tool_prefs_cancel {
      width: 30%;
      background-color: #c8c8c8;
    }

    #svg_prefs_container fieldset + fieldset {
      float: right;
    }

    legend {
      max-width: 195px;
    }

    #svg_prefs_container > fieldset > legend {
      font-weight: bold;
      font-size: 1.1em;
    }

    fieldset {
      padding: 5px;
      margin: 5px;
      border: 1px solid #DDD;
    }

    #svg_prefs_container label {
      display: block;
      margin: .5em;
    }

    #svg_prefs_container div.color_block {
      float: left;
      margin: 2px;
      padding: 20px;
      border: 1px solid #6f6f6f;
    }

    #change_background div.cur_background {
      border: 2px solid blue;
      padding: 19px;
    }

    #canvas_bg_url {
      display: block;
      width: 96%;
    }

    button {
      margin-top: 0;
      margin-bottom: 5px;
    }
  `

  /** Background color swatches */
  colorBlocks: string[] = ['#FFF', '#888', '#000', 'chessboard']

  // --- i18n label state ---
  @state() accessor _labelOk = ''
  @state() accessor _labelCancel = ''
  @state() accessor _labelEditorPrefs = ''
  @state() accessor _labelLanguage = ''
  @state() accessor _labelBackground = ''
  @state() accessor _labelBgUrl = ''
  @state() accessor _labelBgNote = ''
  @state() accessor _labelGrid = ''
  @state() accessor _labelSnapOnOff = ''
  @state() accessor _labelSnapStep = ''
  @state() accessor _labelGridColor = ''
  @state() accessor _labelUnitsRulers = ''
  @state() accessor _labelShowRulers = ''
  @state() accessor _labelBaseUnit = ''

  // --- form field state ---
  @state() accessor _lang = 'en'
  @state() accessor _selectedBg = '#FFF'
  @state() accessor _bgUrl = ''
  @state() accessor _gridSnappingOn = false
  @state() accessor _gridSnappingStep = '10'
  @state() accessor _gridColor = '#000'
  @state() accessor _showRulers = true
  @state() accessor _baseUnit = 'px'

  static get observedAttributes (): string[] {
    return [...super.observedAttributes, 'lang', 'canvasbg', 'bgurl', 'gridsnappingon', 'gridsnappingstep', 'gridcolor', 'showrulers', 'baseunit']
  }

  /**
   * @function init
   * @param i18next - i18next instance
   */
  init (i18next: any): void {
    this._labelOk = i18next.t('common.ok')
    this._labelCancel = i18next.t('common.cancel')
    this._labelEditorPrefs = i18next.t('config.editor_prefs')
    this._labelLanguage = i18next.t('config.language')
    this._labelBackground = i18next.t('config.background')
    this._labelBgUrl = i18next.t('common.url')
    this._labelBgNote = i18next.t('config.editor_bg_note')
    this._labelGrid = i18next.t('config.grid')
    this._labelSnapOnOff = i18next.t('config.snapping_onoff')
    this._labelSnapStep = i18next.t('config.snapping_stepsize')
    this._labelGridColor = i18next.t('config.grid_color')
    this._labelUnitsRulers = i18next.t('config.units_and_rulers')
    this._labelShowRulers = i18next.t('config.show_rulers')
    this._labelBaseUnit = i18next.t('config.base_unit')
  }

  attributeChangedCallback (name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue)
    if (oldValue === newValue) return
    switch (name) {
      case 'lang':
        this._lang = newValue ?? 'en'
        break
      case 'canvasbg':
        if (newValue) {
          this._selectedBg = newValue
        } else {
          this._selectedBg = '#FFF'
        }
        break
      case 'bgurl':
        this._bgUrl = newValue ?? ''
        break
      case 'gridsnappingon':
        this._gridSnappingOn = newValue === 'true'
        break
      case 'gridsnappingstep':
        this._gridSnappingStep = newValue ?? '10'
        break
      case 'gridcolor':
        this._gridColor = newValue ?? '#000'
        break
      case 'showrulers':
        this._showRulers = newValue === 'true'
        break
      case 'baseunit':
        this._baseUnit = newValue ?? 'px'
        break
      default:
        break
    }
  }

  // --- property getters/setters for external API ---
  get lang (): string { return this.getAttribute('lang') ?? '' }
  set lang (value: string) { this.setAttribute('lang', value) }

  get canvasbg (): string | null { return this.getAttribute('canvasbg') }
  set canvasbg (value: string) { this.setAttribute('canvasbg', value) }

  get bgurl (): string | null { return this.getAttribute('bgurl') }
  set bgurl (value: string) { this.setAttribute('bgurl', value) }

  @property({ reflect: true }) accessor dialog = ''

  protected updated (changed: Map<string, unknown>): void {
    if (changed.has('dialog')) {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (this.dialog === 'open') {
        if (dlg && !dlg.open) dlg.showModal()
      } else {
        if (dlg?.open) dlg.close()
      }
    }
  }

  get gridsnappingon (): string | null { return this.getAttribute('gridsnappingon') }
  set gridsnappingon (value: string) { this.setAttribute('gridsnappingon', value) }

  get gridsnappingstep (): string | null { return this.getAttribute('gridsnappingstep') }
  set gridsnappingstep (value: string) { this.setAttribute('gridsnappingstep', value) }

  get gridcolor (): string | null { return this.getAttribute('gridcolor') }
  set gridcolor (value: string) { this.setAttribute('gridcolor', value) }

  get showrulers (): string | null { return this.getAttribute('showrulers') }
  set showrulers (value: string) { this.setAttribute('showrulers', value) }

  get baseunit (): string | null { return this.getAttribute('baseunit') }
  set baseunit (value: string) { this.setAttribute('baseunit', value) }

  // --- event handlers ---
  private _onBgBlockClick (color: string): void {
    this._selectedBg = color
  }

  private _onSave = (): void => {
    const closeEvent = new CustomEvent('change', {
      detail: {
        lang: this._lang,
        dialog: 'close',
        bgcolor: this._selectedBg || '#FFF',
        bgurl: this._bgUrl,
        gridsnappingon: this._gridSnappingOn,
        gridsnappingstep: this._gridSnappingStep,
        showrulers: this._showRulers,
        baseunit: this._baseUnit
      }
    })
    this.dispatchEvent(closeEvent)
    const dlg = this.shadowRoot?.querySelector('dialog')
    if (dlg?.open) dlg.close()
  }

  private _onCancel = (): void => {
    const closeEvent = new CustomEvent('change', {
      detail: {
        dialog: 'closed'
      }
    })
    this.dispatchEvent(closeEvent)
    const dlg = this.shadowRoot?.querySelector('dialog')
    if (dlg?.open) dlg.close()
  }

  private _onDialogClose = (): void => {
    // Native <dialog> fires 'close' on Esc as well; treat as cancel
    const closeEvent = new CustomEvent('change', {
      detail: {
        dialog: 'closed'
      }
    })
    this.dispatchEvent(closeEvent)
  }

  render () {
    return html`
      <dialog @close=${this._onDialogClose}>
        <div id="svg_prefs_container">
          <div id="tool_prefs_back" class="toolbar_button">
            <button id="tool_prefs_save" @click=${this._onSave}>${this._labelOk}</button>
            <button id="tool_prefs_cancel" @click=${this._onCancel}>${this._labelCancel}</button>
          </div>
          <fieldset>
            <legend id="svginfo_editor_prefs">${this._labelEditorPrefs}</legend>
            <label>
              <span id="svginfo_lang">${this._labelLanguage}</span>
              <select id="lang_select" .value=${this._lang} @change=${(e: Event) => { this._lang = (e.target as HTMLSelectElement).value }}>
                <option value="ar">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</option>
                <option value="cs">&#268;e&#353;tina</option>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="es">Espa&#241;ol</option>
                <option value="fa">&#1601;&#1575;&#1585;&#1587;&#1740;</option>
                <option value="fr">Fran&#231;ais</option>
                <option value="fy">Frysk</option>
                <option value="hi">&#2361;&#2367;&#2344;&#2381;&#2342;&#2368;, &#2361;&#2367;&#2306;&#2342;&#2368;</option>
                <option value="it">Italiano</option>
                <option value="ja">&#26085;&#26412;&#35486;</option>
                <option value="nl">Nederlands</option>
                <option value="pl">Polski</option>
                <option value="pt-BR">Portugu&#234;s (BR)</option>
                <option value="ro">Rom&#226;n&#259;</option>
                <option value="ru">&#1056;&#1091;&#1089;&#1089;&#1082;&#1080;&#1081;</option>
                <option value="sk">Sloven&#269;ina</option>
                <option value="sl">Sloven&#353;&#269;ina</option>
                <option value="sv">Svenska</option>
                <option value="tr">T&#252;rk&#231;e</option>
                <option value="uk">&#1059;&#1082;&#1088;&#1072;&#1111;&#1085;&#1089;&#1100;&#1082;&#1072;</option>
                <option value="zh-CN">&#31616;&#20307;&#20013;&#25991;</option>
                <option value="zh-TW">&#32321;&#39636;&#20013;&#25991;</option>
              </select>
            </label>
            <fieldset id="change_background">
              <legend id="svginfo_change_background">${this._labelBackground}</legend>
              <div id="bg_blocks">
                ${map(this.colorBlocks, (color) => html`
                  <div
                    class=${classMap({ color_block: true, cur_background: this._selectedBg === color })}
                    data-bg-color=${color}
                    style=${color === 'chessboard'
                      ? 'background-image: url(data:image/gif;base64,R0lGODlhEAAQAIAAAP///9bW1iH5BAAAAAAALAAAAAAQABAAAAIfjG+gq4jM3IFLJgpswNly/XkcBpIiVaInlLJr9FZWAQA7)'
                      : `background-color: ${color}`}
                    @click=${() => this._onBgBlockClick(color)}
                  ></div>
                `)}
              </div>
              <label>
                <span id="svginfo_bg_url">${this._labelBgUrl}</span>
                <input type="text" id="canvas_bg_url" .value=${this._bgUrl} @change=${(e: Event) => { this._bgUrl = (e.target as HTMLInputElement).value }} />
              </label>
              <p id="svginfo_bg_note">${this._labelBgNote}</p>
            </fieldset>
            <fieldset id="change_grid">
              <legend id="svginfo_grid_settings">${this._labelGrid}</legend>
              <label for="grid_snapping_on">
                <span id="svginfo_snap_onoff">${this._labelSnapOnOff}</span>
                <input type="checkbox" id="grid_snapping_on" .checked=${this._gridSnappingOn} @change=${(e: Event) => { this._gridSnappingOn = (e.target as HTMLInputElement).checked }} />
              </label>
              <label for="grid_snapping_step">
                <span id="svginfo_snap_step">${this._labelSnapStep}</span>
                <input type="text" id="grid_snapping_step" size="3" .value=${this._gridSnappingStep} @change=${(e: Event) => { this._gridSnappingStep = (e.target as HTMLInputElement).value }} />
              </label>
              <label>
                <span id="svginfo_grid_color">${this._labelGridColor}</span>
                <input type="text" id="grid_color" size="3" .value=${this._gridColor} @change=${(e: Event) => { this._gridColor = (e.target as HTMLInputElement).value }} />
              </label>
            </fieldset>
            <fieldset id="units_rulers">
              <legend id="svginfo_units_rulers">${this._labelUnitsRulers}</legend>
              <label>
                <span id="svginfo_rulers_onoff">${this._labelShowRulers}</span>
                <input id="show_rulers" type="checkbox" .checked=${this._showRulers} @change=${(e: Event) => { this._showRulers = (e.target as HTMLInputElement).checked }} />
              </label>
              <label>
                <span id="svginfo_unit">${this._labelBaseUnit}</span>
                <select id="base_unit" .value=${this._baseUnit} @change=${(e: Event) => { this._baseUnit = (e.target as HTMLSelectElement).value }}>
                  <option value="px">Pixels</option>
                  <option value="cm">Centimeters</option>
                  <option value="mm">Millimeters</option>
                  <option value="in">Inches</option>
                  <option value="pt">Points</option>
                  <option value="pc">Picas</option>
                  <option value="em">Ems</option>
                  <option value="ex">Exs</option>
                </select>
              </label>
            </fieldset>
          </fieldset>
        </div>
      </dialog>
    `
  }
}
