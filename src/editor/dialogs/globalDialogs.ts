/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import SePlainAlertDialog from './SePlainAlertDialog.js'

const seAlert = (text: string): void => {
  const dialog = new SePlainAlertDialog()
  dialog.textContent = text
  ;(dialog as any).choices = ['Ok']
  ;(dialog as any).open()
}

const seConfirm = async (text: string, choices?: string[]): Promise<string> => {
  const dialog = new SePlainAlertDialog() as any
  dialog.textContent = text
  dialog.choices = (choices === undefined) ? ['Ok', 'Cancel'] : choices
  dialog.open()
  const response = await dialog.whenClosed()
  return dialog.keyChoice ?? response.choice
}

const seSelect = async (text: string, choices: string[]): Promise<string> => {
  const dialog = new SePlainAlertDialog() as any
  dialog.textContent = text
  dialog.choices = choices
  dialog.open()
  const response = await dialog.whenClosed()
  return response.choice
}

;(window as any).seAlert = seAlert
;(window as any).seConfirm = seConfirm
;(window as any).seSelect = seSelect
