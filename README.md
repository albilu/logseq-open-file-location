# logseq-open-file-location

A Logseq plugin that reveals and selects a local asset file in the system file
explorer when you **Ctrl+Click** (or **Cmd+Click** on macOS) on an asset link in
your graph.

This is useful when you want to immediately locate the backing file for a PDF,
image, audio clip, video, or other attachment stored in `assets/`.

## Supported link types

- PDF files
- Images (PNG, JPG, GIF, SVG, WebP, …), including embedded images
- Audio and video files, including embedded players
- Any other local file with an extension (except `.md` pages)

## Installation

1. In Logseq, go to **Settings → Advanced** and enable **Developer mode**.
2. Open the `...` menu → **Plugins** → **Load unpacked plugin**.
3. Select this folder.

For a downloaded release, extract the archive and select its plugin folder.
The SDK is bundled locally, so loading the plugin also works offline; no build
or dependency installation is required.

Once the plugin is published to the Logseq marketplace, you will also be able to
install it directly from the Extension Hub.

## Usage

`Ctrl+Click` (Windows/Linux) or `Cmd+Click` (macOS) any local asset link.
The file will be revealed and selected in your system file explorer. Embedded
images and audio/video players support the same modified click. Ordinary clicks
and media controls keep their normal behavior.

## Demo

![Open File Location demo](./24-05-2026%2021-46.gif)

## Notes

- Works with local asset links such as PDFs, images, audio, video, and other
  files with an extension
- Ignores `.md` page links
- Leaves external URLs and email links unchanged
- Supports encoded file URLs, graph asset paths, and Windows network shares
- Shows a message for missing files and reported opening errors
- If native file selection is unavailable, opens the containing folder
- Uses Logseq's Electron desktop bridge, so this plugin is intended for the
  desktop app rather than Logseq web

## Development

From a repository checkout with Node.js 24, run the tests against the actual
runtime with:

```bash
npm test
```

To verify the pinned SDK and prepare the release directory:

```bash
npm ci --ignore-scripts
npm run check
npm run package
```

The package is written to `dist/logseq-open-file-location`. Runtime code lives in
`index.js`, loaded by `index.html`; there are no separate test-only helper copies.
Both pull-request validation and tag publishing run the checks. Native Windows
and macOS file-manager behavior still requires testing on those systems.

## Marketplace publishing

This repository includes:

- `manifest.json` for marketplace metadata
- `.github/workflows/publish.yml` to attach release archives on tag push

Update the versions in `package.json` and `package-lock.json`, run the checks,
and commit the release changes. Then publish that version:

```bash
release_tag="v$(node -p "require('./package.json').version")"
git tag -a "$release_tag" -m "Release $release_tag"
git push origin master "$release_tag"
```

Then create or verify the GitHub release and confirm the generated `.zip` asset
is attached.
