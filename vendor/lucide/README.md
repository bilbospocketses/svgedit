# Lucide — vendored snapshot

Raw upstream [Lucide](https://github.com/lucide-icons/lucide) icon sources, pinned for
reproducibility. The **adapted copies** (the actual UI glyphs) live in
`src/editor/images/` at svgedit's stable filenames — see
`docs/superpowers/plans/2026-06-09-svgedit-m4-phase2-lucide-remap.md` for the
filename→Lucide mapping.

| | |
| --- | --- |
| Source | <https://github.com/lucide-icons/lucide> |
| Pinned tag | `1.17.0` |
| Commit SHA | `896aba0d195a4fec38ad7c4a90d00cb3389ebfea` |
| Raw URL pattern | `https://raw.githubusercontent.com/lucide-icons/lucide/1.17.0/icons/<name>.svg` |
| License | ISC — see `LICENSE` here and the repo-root `THIRD-PARTY-NOTICES.md` |

Files in `icons/` are **verbatim upstream sources**. The only adaptation applied when
copying into `src/editor/images/` is stripping any runtime-injected `class="lucide …"`
attribute (the raw sources here generally don't carry it). At runtime the glyphs are
painted theme-aware via CSS `mask` + the `--se-icon` token (M4 Phase 1), so each source's
`stroke="currentColor"` is irrelevant — only the shape is used as a stencil.

To refresh: re-fetch from the pinned tag (or bump it here + in `THIRD-PARTY-NOTICES.md`),
then re-run the per-batch adaptation.
