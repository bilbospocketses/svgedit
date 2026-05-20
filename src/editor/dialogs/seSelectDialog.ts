import SePlainAlertDialog from './SePlainAlertDialog.js'

const seSelect = async (text: string, choices: string[]): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dialog = new SePlainAlertDialog() as any
  dialog.textContent = text
  dialog.choices = choices
  dialog.open()
  const response = await dialog.whenClosed()
  return response.choice
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).seSelect = seSelect
