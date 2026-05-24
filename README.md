# logseq-open-file-location

A Logseq plugin that reveals and selects a local asset file in the system file
explorer when you **Ctrl+Click** (or **Cmd+Click** on macOS) on an asset link in
your graph.

This is useful when you want to immediately locate the backing file for a PDF,
image, audio clip, video, or other attachment stored in `assets/`.

## Supported link types

- PDF files
- Images (PNG, JPG, GIF, SVG, WebP, …)
- Audio and video files
- Any other local file with an extension (except `.md` pages)

## Installation

1. In Logseq, go to **Settings → Advanced** and enable **Developer mode**.
2. Open the `...` menu → **Plugins** → **Load unpacked plugin**.
3. Select this folder.

Once the plugin is published to the Logseq marketplace, you will also be able to
install it directly from the Extension Hub.

## Usage

`Ctrl+Click` (Windows/Linux) or `Cmd+Click` (macOS) any local asset link.
The file will be revealed and selected in your system file explorer.

## Notes

- Works with local asset links such as PDFs, images, audio, video, and other
  files with an extension
- Ignores `.md` page links
- Uses Logseq's Electron desktop bridge, so this plugin is intended for the
  desktop app rather than Logseq web

## Development

Run the local tests with:

```bash
node test/path-utils.test.js
node test/detect-asset.test.js
```

## Marketplace publishing

This repository includes:

- `manifest.json` for marketplace metadata
- `.github/workflows/publish.yml` to attach release archives on tag push

To publish a new version:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then create or verify the GitHub release and confirm the generated `.zip` asset
is attached.
