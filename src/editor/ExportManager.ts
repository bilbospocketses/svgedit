/**
 * Export handling for the SVG editor: owns the export-window state and the
 * `exported` / `exportedPDF` canvas-event handlers (which open the export window
 * and stream the rendered output to it). Extracted from `Editor` + `editorInit`
 * as part of the #108 god-object decomposition; `Editor` exposes the state
 * fields as thin accessor delegators so `MainMenu` (export trigger) and
 * `editorInit` keep working unchanged.
 *
 * `seAlert` is an ambient global (see `global-dialogs.d.ts`).
 * @license MIT
 */

/** The slice of `Editor` that ExportManager depends on. */
export interface ExportManagerHost {
  i18next: { t: (key: string, vars?: Record<string, unknown>) => string }
  configObj: { pref: (key: string, val?: unknown, mayBeEmpty?: boolean) => unknown }
}

/** Owns export-window state and routes the canvas export events to that window. */
export class ExportManager {
  exportWindow: Window | null = null
  exportWindowCt = 0
  exportWindowName: string | null = null
  customExportImage = false
  customExportPDF = false

  #host: ExportManagerHost

  constructor (host: ExportManagerHost) {
    this.#host = host
  }

  /**
   * Handle a completed raster/SVG export: open the (named) export window and
   * stream the blob/data URI to it, then show the one-time save notice.
   * @listens module:svgcanvas.SvgCanvas#event:exported
   */
  handleExported (_win: unknown, data: { issues: string[]; exportWindowName: string; bloburl?: string; datauri?: string; type: string }): void {
    const { issues, exportWindowName } = data
    this.exportWindow = window.open('', exportWindowName) // A hack to get the window via JSON-able name without opening a new one
    if (!this.exportWindow || this.exportWindow.closed) {
      seAlert(this.#host.i18next.t('notification.popupWindowBlocked'))
      return
    }

    this.exportWindow.location.href = data.bloburl ?? data.datauri ?? ''
    const done = this.#host.configObj.pref('export_notice_done')
    if (done !== 'all') {
      let note = this.#host.i18next.t('notification.saveFromBrowser', {
        type: data.type
      })

      // Check if there are issues
      if (issues.length) {
        const pre = '\n • '
        note +=
          '\n\n' +
          this.#host.i18next.t('notification.noteTheseIssues') +
          pre +
          issues.join(pre)
      }
      // Note that this will also prevent the notice even though new issues may appear later.
      // May want to find a way to deal with that without annoying the user
      this.#host.configObj.pref('export_notice_done', 'all')
      seAlert(note)
    }
  }

  /**
   * Handle a completed PDF export: stream the PDF output to the export window.
   * @listens module:svgcanvas.SvgCanvas#event:exportedPDF
   */
  handleExportedPDF (_win: unknown, data: { output?: string; exportWindowName?: string }): void {
    if (!data.output) { // Ignore Chrome
      return
    }
    const { exportWindowName } = data
    if (exportWindowName) {
      this.exportWindow = window.open('', this.exportWindowName ?? undefined) // A hack to get the window via JSON-able name without opening a new one
    }
    if (!this.exportWindow || this.exportWindow.closed) {
      seAlert(this.#host.i18next.t('notification.popupWindowBlocked'))
      return
    }
    this.exportWindow.location.href = data.output
  }
}
