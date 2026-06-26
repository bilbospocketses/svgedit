import { LitElement } from 'lit'

/**
 * Shared workarea right-click listener lifecycle for the two context-menu dialogs
 * (`se-cmenu_canvas-dialog` and `se-cmenu-layers`). Both bind their open/close
 * handlers to a workarea element on connect and tear them down on disconnect,
 * guarded by a single "attached" flag so a re-entrant attach is a no-op. The
 * concrete listener sets differ between the two menus, so each subclass supplies
 * them via the bind/unbind hooks. (Audit #137 — de-duplicate the attach/detach
 * skeleton that was copied across both dialogs.)
 */
export abstract class CMenuDialogBase extends LitElement {
  protected _workarea: Element | null = null
  protected _workareaListenersAttached = false

  /** Bind this menu's listeners to the (guaranteed non-null) workarea. */
  protected abstract _bindWorkareaListeners(workarea: Element): void

  /** Remove every listener added by {@link _bindWorkareaListeners}. */
  protected abstract _unbindWorkareaListeners(): void

  protected _attachWorkareaListeners(): void {
    if (this._workareaListenersAttached || this._workarea === null) return
    this._workareaListenersAttached = true
    this._bindWorkareaListeners(this._workarea)
  }

  protected _detachWorkareaListeners(): void {
    if (!this._workareaListenersAttached) return
    this._unbindWorkareaListeners()
    this._workareaListenersAttached = false
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._detachWorkareaListeners()
  }
}
