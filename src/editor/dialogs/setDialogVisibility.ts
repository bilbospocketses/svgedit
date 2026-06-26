/**
 * Toggle a dialog element's visibility through its reflected `dialog` attribute.
 *
 * Every consumer treats `dialog === 'open'` as shown and any other value as
 * hidden, so the hidden state is normalized to a single `'close'` token — some
 * call sites previously wrote `'closed'`, which read identically but invited
 * drift. Null-safe for the common `$id(...)`-may-be-missing call pattern.
 * (Audit #139 — one typed helper in place of scattered magic-string setAttribute
 * calls.)
 */
export const setDialogVisibility = (
  el: Element | null | undefined,
  open: boolean
): void => {
  el?.setAttribute('dialog', open ? 'open' : 'close')
}
