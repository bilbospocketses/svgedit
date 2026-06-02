import type Editor from './Editor.js'

let _instance: Editor | null = null

/** Return the singleton Editor instance; throws if called before `setSvgEditor` */
export function getSvgEditor (): Editor {
  if (!_instance) throw new Error('svgEditor not initialized')
  return _instance
}

/** Register the singleton Editor instance; must be called once during editor initialization */
export function setSvgEditor (editor: Editor): void {
  _instance = editor
}
