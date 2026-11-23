# Self-hosted fonts

The WOFF2 files in this directory are copied from the pinned `@fontsource` packages
listed in `apps/site/package.json`. They are served from this deployment and are
loaded through `next/font/local`; browser visits do not contact a font provider.

The font packages are licensed under the SIL Open Font License 1.1:

- Inter: `@fontsource/inter` (SIL Open Font License 1.1)
- Playfair Display: `@fontsource/playfair-display` (SIL Open Font License 1.1)
- JetBrains Mono: `@fontsource/jetbrains-mono` (SIL Open Font License 1.1)

Only the Latin WOFF2 weights used by the site are vendored here. When changing
the selected weights or font package version, update these assets and verify
the licenses and generated preload tags in a production build.
