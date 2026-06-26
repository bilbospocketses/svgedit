/**
 * @file ext-storage.js
 *
 * This extension allows automatic saving of the SVG canvas contents upon
 *  page unload (which can later be automatically retrieved upon future
 *  editor loads).
 *
 *  The functionality was originally part of the svgedit editor, but moved to a
 *  separate extension to make the setting behavior optional, and adapted
 *  to inform the user of its setting of local data.
 *
 * @license MIT
 *
 * @todo Revisit on whether to use `svgEditor.pref` over directly setting
 * `curConfig` in all extensions for a more public API (not only for `extPath`
 * and `imagePath`, but other currently used config in the extensions)
 * @todo We might provide control of storage settings through the UI besides the
 *   initial (or URL-forced) dialog. *
 */
import './storageDialog.js'
import { getSvgEditor } from '../../svgEditorInstance.js'
import { setDialogVisibility } from '../../dialogs/setDialogVisibility.js'
import { contentStorageKey, titleStorageKey, saveSvgContent } from './content-store.js'

/**
 * Expire the storage cookie.
 */
const removeStoragePrefCookie = () => {
  expireCookie('svgeditstore')
}
/**
 * Set the cookie to expire.
 */
const expireCookie = (cookie: string) => {
  document.cookie =
    encodeURIComponent(cookie) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

/**
 * Set or remove the `storagePrompt` query parameter and navigate, via the URL
 * API rather than brittle regex string-surgery (#112). A truthy `val` sets the
 * param; a falsy one (empty / undefined) removes it, matching the prior behaviour.
 */
const replaceStoragePrompt = (val?: string) => {
  const loc = top!.location // Allow this to work with the embedded editor as well
  const url = new URL(loc.href)
  if (val) {
    url.searchParams.set('storagePrompt', val)
  } else {
    url.searchParams.delete('storagePrompt')
  }
  loc.href = url.href
}

export default {
  name: 'storage',
  init () {
    const svgEditor = getSvgEditor()
    const svgCanvas = svgEditor.svgCanvas
    const storage = svgEditor.storage
    const { $id } = svgCanvas

    // We could empty any already-set data for users when they decline storage,
    //  but it would be a risk for users who wanted to store but accidentally
    // said "no"; instead, we'll let those who already set it, delete it themselves;
    // to change, set the "emptyStorageOnDecline" config setting to true
    // in svgedit-config-iife.js/svgedit-config-es.js.
    const {
      // When the code in svg-editor.js prevents local storage on load per
      //  user request, we also prevent storing on unload here so as to
      //  avoid third-party sites making XSRF requests or providing links
      // which would cause the user's local storage not to load and then
      // upon page unload (such as the user closing the window), the storage
      //  would thereby be set with an empty value, erasing any of the
      // user's prior work. To change this behavior so that no use of storage
      // or adding of new storage takes place regardless of settings, set
      // the "noStorageOnLoad" config setting to true in svgedit-config-*.js.
      noStorageOnLoad,
      forceStorage,
      canvasName
    } = svgEditor.configObj.curConfig

    // LOAD STORAGE CONTENT IF ANY
    if (
      storage && // Cookies do not have enough available memory to hold large documents
      (forceStorage ||
        (!noStorageOnLoad &&
          /(?:^|;\s*)svgeditstore=prefsAndContent/.test(document.cookie)))
    ) {
      const key = contentStorageKey(canvasName)
      const cached = storage.getItem(key)
      if (cached) {
        void svgEditor.loadFromString(cached)
        const storedName = storage.getItem(titleStorageKey(canvasName)) ?? 'untitled.svg'
        svgEditor.topPanel.updateTitle(storedName)
        svgEditor.layersPanel.populateLayers()
      }
    }

    // storageDialog added to DOM
    const storageBox = document.createElement('se-storage-dialog') as HTMLElement & {
      init: (i18n: typeof svgEditor.i18next) => void
    }
    storageBox.setAttribute('id', 'se-storage-dialog')
    svgEditor.$container.append(storageBox)
    storageBox.init(svgEditor.i18next)

    // manage the change in the storageDialog

    storageBox.addEventListener('change', (e: Event) => {
      setDialogVisibility(storageBox, false)
      const detail = (e as CustomEvent<{ trigger?: string; select?: string; checkbox?: boolean }>).detail
      if (detail?.trigger === 'ok') {
        if (detail?.select !== 'noPrefsOrContent') {

          const storagePrompt = new URL(top!.location.href).searchParams.get(
            'storagePrompt'
          )
          document.cookie =
            'svgeditstore=' +
            encodeURIComponent(detail.select ?? '') +
            '; expires=Fri, 31 Dec 9999 23:59:59 GMT'
          if (storagePrompt === 'true' && detail?.checkbox) {
            replaceStoragePrompt()
            return
          }
        } else {
          removeStoragePrefCookie()
          if (
            svgEditor.configObj.curConfig.emptyStorageOnDecline &&
            detail?.checkbox
          ) {
            setSvgContentStorage('')
            Object.keys(svgEditor.configObj.curPrefs).forEach(prefName => {
              const storageName = 'svg-edit-' + prefName
              if (svgEditor.storage) {
                svgEditor.storage.removeItem(storageName)
              }
              expireCookie(storageName)
            })
          }
          if (detail?.select && detail?.checkbox) {
            replaceStoragePrompt('false')
            return
          }
        }
      } else if (detail?.trigger === 'cancel') {
        removeStoragePrefCookie()
      }
      setupBeforeUnloadListener()
      svgEditor.storagePromptState = 'closed'
      svgEditor.updateCanvas(true)
    })

    /**
     * Sets SVG content as a string with "svgedit-" and the current
     *   canvas name as namespace.
     */
    const setSvgContentStorage = (svgString: string) => {
      if (!storage) return
      saveSvgContent(storage, svgEditor.configObj.curConfig.canvasName, svgString, svgEditor.title)
    }

    /**
     * Listen for unloading: If and only if opted in by the user, set the content
     *   document and preferences into storage:
     * 1. Prevent save warnings (since we're automatically saving unsaved
     *       content into storage)
     * 2. Use localStorage to set SVG contents (potentially too large to allow in cookies)
     * 3. Use localStorage (where available) or cookies to set preferences.
     */
    const setupBeforeUnloadListener = () => {
      window.addEventListener('beforeunload', function () {
        // Don't save anything unless the user opted in to storage
        if (
          !/(?:^|;\s*)svgeditstore=(?:prefsAndContent|prefsOnly)/.test(
            document.cookie
          )
        ) {
          return
        }
        if (/(?:^|;\s*)svgeditstore=prefsAndContent/.test(document.cookie)) {
          setSvgContentStorage(svgCanvas.getSvgString())
        }

        svgEditor.setConfig({ no_save_warning: true }) // No need for explicit saving at all once storage is on

        const { curPrefs } = svgEditor.configObj

        Object.entries(curPrefs).forEach(([prefKey, val]) => {
          if (val === undefined || val === null) {
            return
          }
          const storageKey = 'svg-edit-' + prefKey
          const valStr = typeof val === 'string' ? val : JSON.stringify(val)
          if (storage) {
            storage.setItem(storageKey, valStr)
          } else {
            const encoded = encodeURIComponent(valStr)
            document.cookie =
              encodeURIComponent(storageKey) +
              '=' +
              encoded +
              '; expires=Fri, 31 Dec 9999 23:59:59 GMT'
          }
        })
      })
    }

    let loaded = false
    return {
      name: 'storage',
      callback () {

        const storagePrompt = new URL(top!.location.href).searchParams.get(
          'storagePrompt'
        )
        // No need to run this one-time dialog again just because the user
        //   changes the language
        if (loaded) {
          return
        }
        loaded = true

        // Note that the following can load even if "noStorageOnLoad" is
        //   set to false; to avoid any chance of storage, avoid this
        //   extension! (and to avoid using any prior storage, set the
        //   config option "noStorageOnLoad" to true).
        if (
          !forceStorage &&
          // If the URL has been explicitly set to always prompt the
          //  user (e.g., so one can be pointed to a URL where one
          // can alter one's settings, say to prevent future storage)...
          (storagePrompt === 'true' ||
            // ...or...if the URL at least doesn't explicitly prevent a
            //  storage prompt (as we use for users who
            // don't want to set cookies at all but who don't want
            // continual prompts about it)...
            (storagePrompt !== 'false' &&
              // ...and this user hasn't previously indicated a desire for storage
              !/(?:^|;\s*)svgeditstore=(?:prefsAndContent|prefsOnly)/.test(
                document.cookie
              )))
          // ...then show the storage prompt.
        ) {
          const options = Boolean(storage)
          // Open select-with-checkbox dialog
          // From svg-editor.js
          svgEditor.storagePromptState = 'waiting'
          const $storageDialog = $id('se-storage-dialog')!
          setDialogVisibility($storageDialog, true)
          $storageDialog.setAttribute('storage', String(options))
        } else if (!noStorageOnLoad || forceStorage) {
          setupBeforeUnloadListener()
        }
      }
    }
  }
}
