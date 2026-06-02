# Frequently Asked Questions

**Q: Can svgedit save to a server?**

A: No. This fork saves and exports entirely client-side — files download
through the browser (via the File System Access API where supported, with a
plain download fallback). The old PHP server-save extension was removed.

**Q: Which languages does the UI support?**

A: English only. The multi-language (`i18next`) layer and the non-English
locale files were removed in this fork; see [LocaleDocs](LocaleDocs.md).

**Q: Where are the usage tips?**

A: See the [Editor](Editor.md) guide.
