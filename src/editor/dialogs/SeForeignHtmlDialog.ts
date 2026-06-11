import { LitElement, html, css, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { serialize, deserialize } from './foreign-html-serialize.js'
import type { BlockTag, Align, FontPreset } from './foreign-html-commands.js'
import * as cmd from './foreign-html-commands.js'

/**
 * Modal rich-HTML editor for foreignObject content. Consumed via the `seForeignHtml`
 * helper (globalDialogs.ts). `value` seeds edit mode; `whenClosed()` resolves the
 * serialized XHTML string on OK, or null on Cancel/Esc.
 */
@customElement('se-foreign-html-dialog')
export default class SeForeignHtmlDialog extends LitElement {
  static styles = css`
    dialog {
      padding: 0;
      width: 560px;
      max-width: 92vw;
      background: var(--se-surface);
      color: var(--se-text);
      border: 1px solid var(--se-border);
      border-radius: var(--se-radius-sm);
      font-family: var(--se-font-sans);
    }

    dialog::backdrop {
      background: var(--se-scrim);
    }

    .title {
      padding: var(--se-space-3);
      font-weight: 600;
      border-bottom: 1px solid var(--se-border);
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--se-space-2);
      padding: var(--se-space-2) var(--se-space-3);
      border-bottom: 1px solid var(--se-border);
      background: var(--se-surface-2);
    }

    .toolbar button,
    .toolbar select,
    .toolbar input {
      background: var(--se-surface);
      color: var(--se-text);
      border: 1px solid var(--se-border-strong);
      border-radius: var(--se-radius-sm);
      padding: 2px 8px;
      font-size: .85em;
      cursor: pointer;
    }

    [part="editor"] {
      min-height: 160px;
      padding: var(--se-space-3);
      outline: none;
    }

    [part="editor"]:focus-visible {
      outline: 2px solid var(--se-focus-ring);
      outline-offset: -2px;
    }

    textarea {
      display: none;
      width: 100%;
      min-height: 160px;
      box-sizing: border-box;
      border: none;
      padding: var(--se-space-3);
      font-family: monospace;
      background: var(--se-surface-2);
      color: var(--se-text);
    }

    :host([source]) [part="editor"] {
      display: none;
    }

    :host([source]) textarea {
      display: block;
    }

    .foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--se-space-3);
      border-top: 1px solid var(--se-border);
    }

    .foot button {
      padding: 4px 14px;
      border-radius: var(--se-radius-sm);
      font-size: .9em;
      cursor: pointer;
    }

    button[value="ok"] {
      background: var(--se-accent);
      color: var(--se-on-accent);
      border: none;
    }
  `

  @property() accessor value = ''
  @property({ type: Boolean, reflect: true }) accessor source = false

  private _resolve: ((r: { html: string | null }) => void) | null = null
  private _color = '#000000' // hex-guard-allow

  private get _editor (): HTMLElement | null {
    return this.shadowRoot?.querySelector<HTMLElement>('[part="editor"]') ?? null
  }

  private get _sourceEl (): HTMLTextAreaElement | null {
    return this.shadowRoot?.querySelector<HTMLTextAreaElement>('textarea') ?? null
  }

  get opened (): boolean {
    return this.shadowRoot?.querySelector('dialog')?.open ?? false
  }

  override updated (changedProperties: PropertyValues): void {
    // Re-seed the editor whenever `value` changes (covers first render + later assignments).
    // Only seed if the editor is currently empty to avoid clobbering in-progress edits.
    if (changedProperties.has('value')) {
      const editor = this._editor
      if (this.value && editor && editor.childNodes.length === 0) {
        editor.replaceChildren(deserialize(this.value))
      }
    }
  }

  open (): void {
    if (!this.isConnected) {
      document.body.append(this)
    }
    void this.updateComplete.then(() => {
      const dlg = this.shadowRoot?.querySelector('dialog')
      const editor = this._editor
      // Seed if not already populated (value may have been set before open() was called)
      if (editor && this.value && editor.childNodes.length === 0) {
        editor.replaceChildren(deserialize(this.value))
      }
      if (dlg && !dlg.open) {
        dlg.showModal()
        editor?.focus()
      }
    })
  }

  close (): void {
    this.shadowRoot?.querySelector('dialog')?.close()
  }

  whenClosed (): Promise<{ html: string | null }> {
    return new Promise((resolve) => {
      this._resolve = resolve
    })
  }

  private _onClose = (): void => {
    const dlg = this.renderRoot.querySelector('dialog')
    const editor = this._editor
    const accepted = dlg?.returnValue === 'ok'
    let out: string | null = null
    if (accepted) {
      if (editor) {
        const srcEl = this._sourceEl
        if (this.source && srcEl) {
          editor.innerHTML = srcEl.value
        }
        out = serialize(editor)
      } else {
        out = ''
      }
    }
    if (this._resolve) {
      this._resolve({ html: out })
      this._resolve = null
    }
    this.remove()
  }

  private _onPaste = (e: ClipboardEvent): void => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    // insertText is the only execCommand still broadly supported for contenteditable paste
    document.execCommand('insertText', false, text)
  }

  private _toggleSource = (): void => {
    const editor = this._editor
    const src = this._sourceEl
    if (!editor || !src) return
    if (!this.source) {
      src.value = serialize(editor)
    } else {
      editor.innerHTML = src.value
    }
    this.source = !this.source
  }

  private _run (fn: (root: Element) => void): void {
    const editor = this._editor
    if (!editor) return
    editor.focus()
    fn(editor)
  }

  private _onLink = async (): Promise<void> => {
    const url = await sePrompt('Enter the link URL (https://...)')
    if (url) this._run((root) => cmd.insertLink(root, url))
  }

  private _onBlockChange = (e: Event): void => {
    const val = (e.target as HTMLSelectElement).value as BlockTag
    this._run((root) => cmd.setBlock(root, val))
  }

  private _onAlignChange = (e: Event): void => {
    const val = (e.target as HTMLSelectElement).value as Align
    this._run((root) => cmd.setAlign(root, val))
  }

  private _onFontSizeChange = (e: Event): void => {
    const val = (e.target as HTMLSelectElement).value as FontPreset
    this._run((root) => cmd.setFontSize(root, val))
  }

  private _onColorChange = (e: Event): void => {
    this._color = (e.target as HTMLInputElement).value
    this._run((root) => cmd.setColor(root, this._color))
  }

  render () {
    return html`
      <dialog @close=${this._onClose}>
        <div class="title">Insert / Edit HTML</div>
        <div class="toolbar" part="toolbar">
          <select title="Block style" @change=${this._onBlockChange}>
            <option value="p">Normal</option>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
          </select>
          <button type="button" title="Bold" @click=${() => this._run((r) => cmd.toggleInline(r, 'strong'))}><b>B</b></button>
          <button type="button" title="Italic" @click=${() => this._run((r) => cmd.toggleInline(r, 'em'))}><i>I</i></button>
          <button type="button" title="Underline" @click=${() => this._run((r) => cmd.toggleInline(r, 'u'))}><u>U</u></button>
          <button type="button" title="Strikethrough" @click=${() => this._run((r) => cmd.toggleInline(r, 's'))}><s>S</s></button>
          <button type="button" title="Bulleted list" @click=${() => this._run((r) => cmd.toggleList(r, 'ul'))}>&bull;</button>
          <button type="button" title="Numbered list" @click=${() => this._run((r) => cmd.toggleList(r, 'ol'))}>1.</button>
          <button type="button" title="Link" @click=${this._onLink}>&#128279;</button>
          <input type="color" title="Text color" .value=${this._color} @change=${this._onColorChange} />
          <select title="Align" @change=${this._onAlignChange}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <select title="Font size" @change=${this._onFontSizeChange}>
            <option value="M">Size</option>
            <option value="S">S</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
          </select>
          <button type="button" title="Clear formatting" @click=${() => this._run((r) => cmd.clearFormatting(r))}>&#10006;</button>
          <button type="button" title="HTML source" @click=${this._toggleSource}>&lt;/&gt;</button>
        </div>
        <div part="editor" contenteditable="true" @paste=${this._onPaste}></div>
        <textarea part="source"></textarea>
        <form method="dialog" class="foot">
          <span></span>
          <span>
            <button value="cancel">Cancel</button>
            <button value="ok">OK</button>
          </span>
        </form>
      </dialog>
    `
  }
}
