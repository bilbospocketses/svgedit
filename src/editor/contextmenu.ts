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
    const sep = document.createElement('li')
    sep.className = 'separator'
    host.append(sep)
  }
  // Build via the DOM API (not an interpolated HTML string) so an extension's
  // id / label / shortcut cannot inject markup into the context menu (#46).
  const li = document.createElement('li')
  li.className = 'disabled'
  const a = document.createElement('a')
  a.setAttribute('href', `#${menuItem.id}`)
  a.append(document.createTextNode(menuItem.label))
  const span = document.createElement('span')
  span.className = 'shortcut'
  span.textContent = menuItem.shortcut || ''
  a.append(span)
  li.append(a)
  host.append(li)
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
