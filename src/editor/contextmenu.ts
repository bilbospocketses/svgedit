/**
 * Adds context menu functionality.
 * @module contextmenu
 * @license Apache-2.0
 * @author Adam Bender
 */

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

/**
* @param menuItem
*/
const menuItemIsValid = function (menuItem: MenuItem): boolean {
  return Boolean(menuItem && menuItem.id && menuItem.label && menuItem.action && typeof menuItem.action === 'function')
}

/**
* @function module:contextmenu.add
* @param menuItem
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
* @function module:contextmenu.hasCustomHandler
* @param handlerKey
*/
export const hasCustomHandler = function (handlerKey: string): boolean {
  return Boolean(contextMenuExtensions[handlerKey])
}

/**
* @function module:contextmenu.getCustomHandler
* @param handlerKey
*/
export const getCustomHandler = function (handlerKey: string): MenuItemAction {
  // Non-null assertion: callers check hasCustomHandler first
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return contextMenuExtensions[handlerKey]!.action
}

/**
* @param menuItem
*/
const injectExtendedContextMenuItemIntoDom = function (menuItem: MenuItem): void {
  if (!Object.keys(contextMenuExtensions).length) {
    // all menuItems appear at the bottom of the menu in their own container.
    // if this is the first extension menu we need to add the separator.
    // TODO: see todo #10 — appendChild with string arg is a pre-existing bug (should be a Node)
    // @ts-expect-error: pre-existing bug — appendChild expects Node not string; preserved verbatim
    document.getElementById('cmenu_canvas').appendChild('<li class=\'separator\'>')
  }
  const shortcut = menuItem.shortcut || ''
  // TODO: see todo #10 — appendChild with string arg is a pre-existing bug (should be a Node)
  // @ts-expect-error: pre-existing bug — appendChild expects Node not string; preserved verbatim
  document.getElementById('cmenu_canvas').appendChild(`
    <li class='disabled'><a href='#${menuItem.id}'>${menuItem.label}<span class='shortcut'>${shortcut}</span></a></li>`)
}

/**
* @function module:contextmenu.injectExtendedContextMenuItemsIntoDom
*/
export const injectExtendedContextMenuItemsIntoDom = function (): void {
  Object.values(contextMenuExtensions).forEach((menuItem) => {
    injectExtendedContextMenuItemIntoDom(menuItem)
  })
}
/**
* @function module:contextmenu.resetCustomMenus
*/
export const resetCustomMenus = function (): void { contextMenuExtensions = {} }
