import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { map } from 'lit/directives/map.js'

/**
 * A modal alert/confirm/select dialog backed by a native HTML5 <dialog>.
 *
 * Consumers interact imperatively:
 *   const d = new SePlainAlertDialog()
 *   d.textContent = 'Are you sure?'
 *   d.choices = ['Ok', 'Cancel']
 *   d.open()
 *   const { choice } = await d.whenClosed()
 */
@customElement('se-plain-alert-dialog')
export default class SePlainAlertDialog extends LitElement {
  static styles = css`
    dialog {
      padding: 1em;
      background: #CCC;
      width: 300px;
      border: 1px outset #777;
      font-size: 0.8em;
      font-family: Verdana, Helvetica, sans-serif;
      border-radius: 5px;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.3);
    }

    #se-content-alert {
      height: 95px;
      background: #DDD;
      overflow: auto;
      text-align: left;
      border: 1px solid #5a6162;
      padding: 1em;
      border-radius: 5px;
    }

    #choiceButtonContainer {
      margin-top: 1em;
      text-align: center;
    }

    #choiceButtonContainer button:not(:first-child) {
      margin-left: 0.5em;
    }
  `

  @state() accessor _choices: string[] = ['Ok']

  /**
   * Tracks if user wants to cancel (close dialog without any changes) with Esc.
   * If null, seConfirm will use response.choice.
   */
  keyChoice: string | null = null

  private _resolve: ((value: { choice: string }) => void) | null = null

  /** Setter for choice button labels. */
  set choices(val: string[]) {
    this._choices = val
  }

  get choices(): string[] {
    return this._choices
  }

  /** Whether the dialog is currently open. */
  get opened(): boolean {
    const dlg = this.shadowRoot?.querySelector('dialog')
    return dlg?.open ?? false
  }

  /** Show the dialog as a modal. Resets keyChoice. */
  open(): void {
    this.keyChoice = null
    // Ensure the element is in the DOM before showing
    if (!this.isConnected) {
      document.body.append(this)
    }
    void this.updateComplete.then(() => {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (dlg && !dlg.open) {
        dlg.showModal()
      }
    })
  }

  /** Programmatically close the dialog. */
  close(): void {
    const dlg = this.shadowRoot?.querySelector('dialog')
    if (dlg?.open) {
      dlg.close()
    }
  }

  /**
   * Returns a Promise that resolves when the dialog is closed,
   * with the label of the choice button that was clicked.
   */
  whenClosed(): Promise<{ choice: string }> {
    return new Promise((resolve) => {
      this._resolve = resolve
    })
  }

  private _onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.keyChoice = 'Cancel'
      // Native <dialog> handles the actual close on Esc; the close event fires next.
    }
  }

  private _onChoiceClick = (label: string): void => {
    this.keyChoice = null
    const dlg = this.shadowRoot?.querySelector('dialog')
    if (dlg) {
      dlg.close(label)
    }
  }

  private _onClose = (): void => {
    const dlg = this.renderRoot.querySelector('dialog')
    const choice = dlg?.returnValue || this._choices[0] || 'Ok'
    if (this._resolve) {
      this._resolve({ choice })
      this._resolve = null
    }
  }

  render() {
    return html`
      <dialog
        @keydown=${this._onKeydown}
        @close=${this._onClose}
      >
        <div id="se-content-alert">
          <slot></slot>
        </div>
        <div id="choiceButtonContainer" part="choice-button-container">
          ${map(this._choices, (label) => html`
            <button
              type="button"
              part="choice-button"
              @click=${() => this._onChoiceClick(label)}
            >${label}</button>
          `)}
        </div>
      </dialog>
    `
  }
}
