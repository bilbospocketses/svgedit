import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

/**
 * A modal prompt dialog (message + text input + OK/Cancel) backed by a native
 * HTML5 <dialog> and a <form method="dialog"> (Enter submits = OK).
 *
 * Consumers interact imperatively via the `sePrompt` helper (globalDialogs.ts):
 *   const d = new SePromptDialog()
 *   d.message = 'Enter a name'
 *   d.value = 'default'
 *   d.open()
 *   const { value } = await d.whenClosed()   // string on OK, null on Cancel/Esc
 */
@customElement('se-prompt-dialog')
export default class SePromptDialog extends LitElement {
  static styles = css`
    dialog {
      padding: 1em;
      background: var(--se-surface);
      width: 300px;
      border: 1px solid var(--se-border);
      font-size: 0.8em;
      font-family: var(--se-font-sans);
      border-radius: var(--se-radius-sm);
      color: var(--se-text);
    }

    dialog::backdrop {
      background: var(--se-scrim);
    }

    .se-prompt-message {
      text-align: left;
      margin-bottom: var(--se-space-3);
      color: var(--se-text);
    }

    input {
      width: 100%;
      box-sizing: border-box;
      background: var(--se-surface-2);
      color: var(--se-text);
      border: 1px solid var(--se-border-strong);
      border-radius: var(--se-radius-sm);
      padding: var(--se-space-2) var(--se-space-3);
      font-family: var(--se-font-sans);
      font-size: 1em;
    }

    input:focus-visible {
      outline: 2px solid var(--se-focus-ring);
      outline-offset: 1px;
    }

    #buttonContainer {
      margin-top: 1em;
      text-align: center;
    }

    #buttonContainer button:not(:first-child) {
      margin-left: 0.5em;
    }
  `

  /** Prompt message shown above the input (arrives already translated). */
  @property() accessor message = ''

  /** Initial/default value seeded into the input. */
  @property() accessor value = ''

  private _resolve: ((result: { value: string | null }) => void) | null = null

  /** Whether the dialog is currently open. */
  get opened (): boolean {
    const dlg = this.shadowRoot?.querySelector('dialog')
    return dlg?.open ?? false
  }

  /** Show the dialog as a modal; focus + select the input (native-prompt parity). */
  open (): void {
    if (!this.isConnected) {
      document.body.append(this)
    }
    void this.updateComplete.then(() => {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (dlg && !dlg.open) {
        dlg.showModal()
        const input = this.shadowRoot?.querySelector('input')
        if (input) {
          input.focus()
          input.select()
        }
      }
    })
  }

  /** Programmatically close the dialog (resolves as cancel → null). */
  close (): void {
    const dlg = this.shadowRoot?.querySelector('dialog')
    if (dlg?.open) {
      dlg.close()
    }
  }

  /**
   * Resolves when the dialog closes: the entered string on OK, null on Cancel/Esc.
   */
  whenClosed (): Promise<{ value: string | null }> {
    return new Promise((resolve) => {
      this._resolve = resolve
    })
  }

  private _onClose = (): void => {
    const dlg = this.renderRoot.querySelector('dialog')
    const input = this.renderRoot.querySelector('input')
    const accepted = dlg?.returnValue === 'ok'
    if (this._resolve) {
      this._resolve({ value: accepted ? (input?.value ?? '') : null })
      this._resolve = null
    }
  }

  render () {
    return html`
      <dialog @close=${this._onClose}>
        <form method="dialog">
          <div class="se-prompt-message" part="message">${this.message}</div>
          <input type="text" part="input" .value=${this.value} />
          <div id="buttonContainer" part="button-container">
            <button type="submit" value="ok" part="button">OK</button>
            <button type="submit" value="cancel" part="button">Cancel</button>
          </div>
        </form>
      </dialog>
    `
  }
}
