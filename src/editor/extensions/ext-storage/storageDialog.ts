import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

/**
 * Storage-preferences dialog (formerly elix-backed).
 *
 * External API contract (preserved):
 * - Tag: `se-storage-dialog`
 * - `init(i18next)` — sets ok/cancel/notification/preferences/remember labels
 * - `dialog` attribute: 'open' -> showModal; else -> close
 * - `storage` attribute: 'true' enables first option; else disables it
 * - Dispatches: CustomEvent('change', { detail: { trigger, select, checkbox } })
 */
@customElement('se-storage-dialog')
export class SeStorageDialog extends LitElement {
  static styles = css`
    dialog {
      padding: 0;
      background: var(--se-bg);
      max-width: 440px;
      border: 1px solid var(--se-border-strong);
      font-family: var(--se-font-sans);
      font-size: 0.8em;
      border-radius: 5px;
      text-align: center;
    }

    dialog::backdrop {
      background: var(--se-scrim);
    }

    #dialog_content {
      margin: 10px 10px 5px 10px;
      background: var(--se-surface);
      overflow: auto;
      text-align: left;
      border: 1px solid var(--se-border-strong);
      border-radius: 5px;
    }

    #dialog_content p,
    #dialog_content select,
    #dialog_content label {
      margin: 10px;
      line-height: 1.3em;
    }

    #dialog_buttons {
      padding: 5px;
    }

    #dialog_buttons button {
      margin: 0 1em;
    }
  `

  @state() accessor _okLabel = ''
  @state() accessor _cancelLabel = ''
  @state() accessor _notificationText = ''
  @state() accessor _prefsAndContentLabel = ''
  @state() accessor _prefsOnlyLabel = ''
  @state() accessor _noPrefsOrContentLabel = ''
  @state() accessor _rememberLabel = ''
  @state() accessor _rememberTitle = ''
  @state() accessor _storageEnabled = false

  @property({ reflect: true }) accessor dialog = ''
  @property({ reflect: true }) accessor storage = ''

  init (i18next: { t: (key: string) => string }): void {
    this._okLabel = i18next.t('common.ok')
    this._cancelLabel = i18next.t('common.cancel')
    this._notificationText = i18next.t('notification.editorPreferencesMsg')
    this._prefsAndContentLabel = i18next.t('properties.prefs_and_content')
    this._prefsOnlyLabel = i18next.t('properties.prefs_only')
    this._noPrefsOrContentLabel = i18next.t('properties.no_prefs_or_content')
    this._rememberLabel = i18next.t('tools.remember_this_choice')
    this._rememberTitle = i18next.t('tools.remember_this_choice_title')
  }

  protected updated (changed: Map<string, unknown>): void {
    if (changed.has('dialog')) {
      const dlg = this.shadowRoot?.querySelector('dialog')
      if (this.dialog === 'open') {
        if (dlg && !dlg.open) dlg.showModal()
      } else {
        if (dlg?.open) dlg.close()
      }
    }
    if (changed.has('storage')) {
      this._storageEnabled = this.storage === 'true'
    }
  }

  private _onOkClick = (): void => {
    const select = this.shadowRoot?.querySelector<HTMLSelectElement>('#se-storage-pref')
    const checkbox = this.shadowRoot?.querySelector<HTMLInputElement>('#se-remember')
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        trigger: 'ok',
        select: select?.value ?? '',
        checkbox: checkbox?.checked ?? false
      }
    }))
  }

  private _onCancelClick = (): void => {
    const select = this.shadowRoot?.querySelector<HTMLSelectElement>('#se-storage-pref')
    const checkbox = this.shadowRoot?.querySelector<HTMLInputElement>('#se-remember')
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        trigger: 'cancel',
        select: select?.value ?? '',
        checkbox: checkbox?.checked ?? false
      }
    }))
  }

  render () {
    return html`
      <dialog aria-label="svgedit storage preferences">
        <div id="dialog_content">
          <p id="notificationNote">${this._notificationText}</p>
          <select id="se-storage-pref">
            <option value="prefsAndContent" ?disabled=${!this._storageEnabled}>${this._prefsAndContentLabel}</option>
            <option value="prefsOnly">${this._prefsOnlyLabel}</option>
            <option value="noPrefsOrContent">${this._noPrefsOrContentLabel}</option>
          </select>
          <label title=${this._rememberTitle} id="se-remember-title">
            ${this._rememberLabel}
            <input type="checkbox" id="se-remember" checked>
          </label>
        </div>
        <div id="dialog_buttons">
          <button type="button" id="storage_ok" @click=${this._onOkClick}>${this._okLabel}</button>
          <button type="button" id="storage_cancel" @click=${this._onCancelClick}>${this._cancelLabel}</button>
        </div>
      </dialog>
    `
  }
}
