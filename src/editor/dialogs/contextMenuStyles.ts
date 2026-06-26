import { css } from 'lit'

/**
 * Shared styles for the context-menu dialogs (`se-cmenu_canvas-dialog` and
 * `se-cmenu-layers`), which previously carried byte-identical `.contextMenu`
 * rule blocks (#136).
 * @license MIT
 */
export const contextMenuStyles = css`
  .contextMenu {
    position: absolute;
    z-index: 99999;
    border: solid 1px var(--se-border);
    background: var(--se-surface);
    padding: 5px 0;
    margin: 0px;
    font: 12px/15px var(--se-font-sans);
    border-radius: var(--se-radius-sm);
    box-shadow: var(--se-shadow-overlay);
  }

  .contextMenu li {
    list-style: none;
    padding: 0px;
    margin: 0px;
  }

  .contextMenu .shortcut {
    width: 115px;
    text-align: right;
    float: right;
  }

  .contextMenu a {
    -moz-user-select: none;
    -webkit-user-select: none;
    user-select: none;
    color: var(--se-text);
    text-decoration: none;
    display: block;
    line-height: 20px;
    height: 20px;
    background-position: 6px center;
    background-repeat: no-repeat;
    outline: none;
    padding: 0px 15px 1px 20px;
  }

  .contextMenu li.hover a {
    background-color: var(--se-accent);
    color: var(--se-on-accent);
    cursor: default;
  }

  .contextMenu li.disabled a {
    color: var(--se-text-muted);
    pointer-events: none;
  }

  .contextMenu li.hover.disabled a {
    background-color: transparent;
  }

  .contextMenu li.separator {
    border-top: solid 1px var(--se-border);
    padding-top: 5px;
    margin-top: 5px;
  }
`
