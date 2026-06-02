import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'

/**
 * A status-display dialog (formerly sePromptDialog).
 *
 * Shows a message with a Cancel button. Used by ext-opensave to indicate
 * loading state. The `close` attribute is a TOGGLE — setting it alternates
 * the dialog open/closed regardless of value.
 */
@customElement('se-status-dialog')
export class SeStatusDialog extends LitElement {
  static styles = css`
    dialog {
      padding: 1em;
      background: var(--se-surface);
      width: 300px;
      border: 1px solid var(--se-border);
      font-size: 0.8em;
      font-family: var(--se-font-sans);
      border-radius: var(--se-radius-sm);
    }

    dialog::backdrop {
      background: var(--se-scrim);
    }

    .content {
      height: 95px;
      background: var(--se-surface-2);
      overflow: auto;
      text-align: left;
      border: 1px solid var(--se-border-strong);
      padding: 1em;
      border-radius: var(--se-radius-sm);
    }

    .choice-button-container {
      margin-top: 1em;
      text-align: center;
    }
  `

  static get observedAttributes (): string[] {
    return ['title', 'close']
  }

  @state() accessor _statusText = ''

  // Override title getter/setter to redirect to attribute (not tooltip)
  get title (): string {
    return this.getAttribute('title') ?? ''
  }

  set title (value: string) {
    if (value) {
      this.setAttribute('title', value)
    } else {
      this.removeAttribute('title')
    }
  }

  get close (): string | null {
    return this.getAttribute('close')
  }

  set close (value: string | boolean | null) {
    if (value) {
      this.setAttribute('close', 'true')
    } else {
      this.removeAttribute('close')
    }
  }

  attributeChangedCallback (name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue)
    switch (name) {
      case 'title': {
        const dlg = this.shadowRoot?.querySelector('dialog')
        if (dlg?.open) dlg.close()
        this._statusText = newValue ?? ''
        void this.updateComplete.then(() => {
          const d = this.shadowRoot?.querySelector('dialog')
          if (d && !d.open) d.showModal()
        })
        break
      }
      case 'close': {
        // TOGGLE: close if open, open if closed. Regardless of value.
        const dlg = this.shadowRoot?.querySelector('dialog')
        if (dlg?.open) {
          dlg.close()
        } else {
          void this.updateComplete.then(() => {
            const d = this.shadowRoot?.querySelector('dialog')
            if (d && !d.open) d.showModal()
          })
        }
        break
      }
      default:
        break
    }
  }

  private _onCancelClick = (): void => {
    this.shadowRoot?.querySelector('dialog')?.close()
  }

  render () {
    return html`
      <dialog>
        <div class="content">${this._statusText}</div>
        <div class="choice-button-container">
          <button type="button" @click=${this._onCancelClick}>Cancel</button>
        </div>
      </dialog>
    `
  }
}
