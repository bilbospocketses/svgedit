import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { getCurrentTheme, toggleTheme, type Theme } from '../styles/theme.js'

/**
 * A one-click light/dark theme toggle (sun/moon). Emits `toggle-theme`
 * (detail = the new theme) so the host editor can persist the choice.
 */
@customElement('se-theme-toggle')
export default class SeThemeToggle extends LitElement {
  static styles = css`
    button {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--se-tool-size, 26px); height: var(--se-tool-size, 26px);
      padding: 0; border: 1px solid transparent; border-radius: var(--se-radius-sm, 6px);
      background: transparent; color: var(--se-text); cursor: pointer;
    }
    button:hover { background: var(--se-accent-subtle); }
    button:focus-visible { outline: 2px solid var(--se-focus-ring); outline-offset: 1px; }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }
  `

  @state() accessor _theme: Theme = getCurrentTheme()

  connectedCallback (): void {
    super.connectedCallback()
    document.addEventListener('svgedit-themechange', this._onThemeChange)
  }

  disconnectedCallback (): void {
    document.removeEventListener('svgedit-themechange', this._onThemeChange)
    super.disconnectedCallback()
  }

  private _onThemeChange = (e: Event): void => {
    this._theme = (e as CustomEvent<{ theme: Theme }>).detail.theme
  }

  private _onClick = (): void => {
    const next = toggleTheme()
    this.dispatchEvent(new CustomEvent('toggle-theme', { detail: { theme: next }, bubbles: true, composed: true }))
  }

  render () {
    const moon = html`<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>`
    const sun = html`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>`
    return html`
      <button type="button" title="Toggle light/dark theme" aria-label="Toggle light/dark theme" @click=${this._onClick}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${this._theme === 'dark' ? sun : moon}</svg>
      </button>`
  }
}
