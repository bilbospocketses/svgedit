import type Editor from './Editor.js'

let _instance: Editor | null = null

export function getSvgEditor (): Editor {
  if (!_instance) throw new Error('svgEditor not initialized')
  return _instance
}

export function setSvgEditor (editor: Editor): void {
  _instance = editor
}
