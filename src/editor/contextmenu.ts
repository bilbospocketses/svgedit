/**
 * Adds context menu functionality.
 * @module contextmenu
 * @license Apache-2.0
 */

import SvgCanvas from '@svgedit/svgcanvas'

const { $id } = SvgCanvas

/** Action callback for a context menu item. */
type MenuItemAction = (...args: unknown[]) => unknown

/** A context menu item descriptor. */
interface MenuItem {
  id: string
  label: string
  action: MenuItemAction
  shortcut?: string
}

let contextMenuExtensions: Record<string, MenuItem> = {}

const menuItemIsValid = function (menuItem: MenuItem): boolean {
  return Boolean(menuItem && menuItem.id && menuItem.label && menuItem.action && typeof menuItem.action === 'function')
}

/**
* Register a custom context menu item; throws if invalid or duplicate id.
* @function module:contextmenu.add
* @throws {Error|TypeError}
*/
export const add = function (menuItem: MenuItem): void {
  // menuItem: {id, label, shortcut, action}
  if (!menuItemIsValid(menuItem)) {
    throw new TypeError(
      'Menu items must be defined and have at least properties: ' +
      'id, label, action, where action must be a function'
    )
  }
  if (menuItem.id in contextMenuExtensions) {
    throw new Error('Cannot add extension "' + menuItem.id + '", an extension by that name already exists"')
  }
  // Register menuItem action, see below for deferred menu dom injection
  contextMenuExtensions[menuItem.id] = menuItem
  // TODO: Need to consider how to handle custom enable/disable behavior
}

/**
* Return true if a custom handler is registered for the given key.
* @function module:contextmenu.hasCustomHandler
*/
export const hasCustomHandler = function (handlerKey: string): boolean {
  return Boolean(contextMenuExtensions[handlerKey])
}

/**
* Retrieve the action callback for a registered custom handler; throws if not found.
* @function module:contextmenu.getCustomHandler
*/
export const getCustomHandler = function (handlerKey: string): MenuItemAction {
  const ext = contextMenuExtensions[handlerKey]
  if (!ext) throw new Error(`No custom handler registered for "${handlerKey}"`)
  return ext.action
}

const injectExtendedContextMenuItemIntoDom = function (menuItem: MenuItem): void {
  const host = $id('cmenu_canvas')
  if (!host) return
  if (!Object.keys(contextMenuExtensions).length) {
    host.insertAdjacentHTML('beforeend', '<li class="separator"></li>')
  }
  const shortcut = menuItem.shortcut || ''
  host.insertAdjacentHTML('beforeend',
    `<li class="disabled"><a href="#${menuItem.id}">${menuItem.label}<span class="shortcut">${shortcut}</span></a></li>`)
}

/**
* Inject all registered extension context menu items into the canvas context menu DOM.
* @function module:contextmenu.injectExtendedContextMenuItemsIntoDom
*/
export const injectExtendedContextMenuItemsIntoDom = function (): void {
  Object.values(contextMenuExtensions).forEach((menuItem) => {
    injectExtendedContextMenuItemIntoDom(menuItem)
  })
}
/**
* Clear all registered custom context menu extensions; used between editor resets.
* @function module:contextmenu.resetCustomMenus
*/
export const resetCustomMenus = function (): void { contextMenuExtensions = {} }
