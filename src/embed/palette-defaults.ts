// src/embed/palette-defaults.ts
// Default swatch palette for se-palette. Defined in the embed layer so the embed
// entry (index.ts) can re-export it to hosts without breaching tsconfig.embed.json
// (rootDir: src/embed). The editor's palette-store imports it as its default.
export const DEFAULT_PALETTE: readonly string[] = [
  'none',
  '#000000', '#3f3f3f', '#7f7f7f', '#bfbfbf', '#ffffff',
  '#ff0000', '#ff7f00', '#ffff00', '#7fff00', '#00ff00',
  '#00ff7f', '#00ffff', '#007fff', '#0000ff', '#7f00ff',
  '#ff00ff', '#ff007f', '#7f0000', '#7f3f00', '#7f7f00',
  '#3f7f00', '#007f00', '#007f3f', '#007f7f', '#003f7f',
  '#00007f', '#3f007f', '#7f007f', '#7f003f', '#ffaaaa',
  '#ffd4aa', '#ffffaa', '#d4ffaa', '#aaffaa', '#aaffd4',
  '#aaffff', '#aad4ff', '#aaaaff', '#d4aaff', '#ffaaff',
  '#ffaad4'
]
