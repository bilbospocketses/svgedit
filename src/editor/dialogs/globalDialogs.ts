import SePlainAlertDialog from './SePlainAlertDialog.js'
import SePromptDialog from './SePromptDialog.js'

/** Augment Window so seAlert / seConfirm / seSelect are globally accessible. */
declare global {
  interface Window {
    seAlert: (text: string) => void
    seConfirm: (text: string, choices?: string[]) => Promise<string>
    seSelect: (text: string, choices: string[]) => Promise<string>
    sePrompt: (text: string, defaultValue?: string) => Promise<string | null>
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

const sePrompt = async (text: string, defaultValue = ''): Promise<string | null> => {
  const dialog = new SePromptDialog()
  dialog.message = text
  dialog.value = defaultValue
  dialog.open()
  const response = await dialog.whenClosed()
  return response.value
}

window.seAlert = seAlert
window.seConfirm = seConfirm
window.seSelect = seSelect
window.sePrompt = sePrompt
