import SePlainAlertDialog from './SePlainAlertDialog.js'

const seConfirm = async (text: string, choices?: string[]): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dialog = new SePlainAlertDialog() as any
  dialog.textContent = text
  dialog.choices = (choices === undefined) ? ['Ok', 'Cancel'] : choices
  dialog.open()
  const response = await dialog.whenClosed()
  return dialog.keyChoice ?? response.choice
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).seConfirm = seConfirm
