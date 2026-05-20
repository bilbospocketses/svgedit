import SePlainAlertDialog from './SePlainAlertDialog.js'

const seAlert = (text: string): void => {
  const dialog = new SePlainAlertDialog()
  dialog.textContent = text
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(dialog as any).choices = ['Ok']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(dialog as any).open()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).seAlert = seAlert
