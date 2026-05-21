/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import SePlainAlertDialog from './SePlainAlertDialog.js'

const seAlert = (text: string): void => {
  const dialog = new SePlainAlertDialog()
  dialog.textContent = text
   
  ;(dialog as any).choices = ['Ok']
   
  ;(dialog as any).open()
}

 
;(window as any).seAlert = seAlert
