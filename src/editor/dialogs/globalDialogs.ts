import SePlainAlertDialog from './SePlainAlertDialog.js'

/** Augment Window so seAlert / seConfirm / seSelect are globally accessible. */
declare global {
  interface Window {
    seAlert: (text: string) => void
    seConfirm: (text: string, choices?: string[]) => Promise<string>
    seSelect: (text: string, choices: string[]) => Promise<string>
  }
}

const seAlert = (text: string): void => {
  const dialog = new SePlainAlertDialog()
  dialog.textContent = text
  dialog.choices = ['Ok']
  dialog.open()
}

const seConfirm = async (text: string, choices?: string[]): Promise<string> => {
  const dialog = new SePlainAlertDialog()
  dialog.textContent = text
  dialog.choices = (choices === undefined) ? ['Ok', 'Cancel'] : choices
  dialog.open()
  const response = await dialog.whenClosed()
  return dialog.keyChoice ?? response.choice
}

const seSelect = async (text: string, choices: string[]): Promise<string> => {
  const dialog = new SePlainAlertDialog()
  dialog.textContent = text
  dialog.choices = choices
  dialog.open()
  const response = await dialog.whenClosed()
  return response.choice
}

window.seAlert = seAlert
window.seConfirm = seConfirm
window.seSelect = seSelect
