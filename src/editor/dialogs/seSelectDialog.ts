/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
// elix custom-element base classes ship as 'any'; cleanup deferred to #3 (Lit migration)
import SePlainAlertDialog from './SePlainAlertDialog.js'

const seSelect = async (text: string, choices: string[]): Promise<string> => {
   
  const dialog = new SePlainAlertDialog() as any
  dialog.textContent = text
  dialog.choices = choices
  dialog.open()
  const response = await dialog.whenClosed()
  return response.choice
}

 
;(window as any).seSelect = seSelect
