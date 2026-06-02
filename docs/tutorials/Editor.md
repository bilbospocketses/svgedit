# Editor

End-user guide to the svgedit editor. For the programmatic API, see
[Editor API](EditorAPI.md).

## Paths

With a path selected via the **Select** tool, clicking it once shows the
normal resize/rotate handles; clicking it again enters path-edit mode — node
handles appear and the top toolbar switches to path-editing tools. While
drawing a path, press **Enter** to finish an open path (with at least two
points) or **Escape** to cancel it.

## Tips

- **Set stroke (or fill) to "none":** shift-click the **None** swatch (the red ✕
  on white) in the palette to clear the stroke paint; click it normally to clear
  the fill.
- **Select an element hidden behind another:** select an object, then `Shift+O`
  selects the previous object and `Shift+P` the next. Wireframe mode also helps
  locate hidden objects.
- **Edit grouped elements:** double-click the group to enter its context (the
  rest of the drawing is locked while inside); press `Escape` when done.
- **Trace a raster (PNG/JPEG) image:** either set the image URL under *Document
  Properties → Editor Background* (shown but not saved with the document), or add
  a layer, place an `image` on it, and trace on a layer above.
- **Copy one object's style to others:** select the source object, `Shift`-select
  the targets, open the fill or stroke colorpicker from the bottom toolbar, and
  confirm — the targets take that paint.
