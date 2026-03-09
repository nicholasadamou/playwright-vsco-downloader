# VSCO Downloader

A simple CLI tool that processes a [VSCO data export](https://vsco.co/settings/account) and organizes your images with a metadata manifest.

## How It Works

1. Request your data export from VSCO (Settings → Account → Request Data Export)
2. Download the export archive — it contains `images.json` (metadata) and `images/` (your photos)
3. Run this tool to copy images into an output directory with consistent `{id}.jpg` naming and a `vsco-images.json` manifest

No browser automation, no API scraping, no Cloudflare issues.

## Quick Start

```bash
pnpm install
pnpm run build
node dist/cli.js \
  --export-path ~/Downloads/vsco-your-username-12345/ \
  --output-dir ./output
```

## CLI Options

```
--export-path <path>    Path to VSCO data export directory or images.json (required)
--output-dir <path>     Directory to save images (required)
--concurrency <number>  Number of concurrent operations (default: 5)
```

## Output

```
output/
├── {image-id-1}.jpg
├── {image-id-2}.jpg
├── ...
└── vsco-images.json      # Manifest with metadata for all images
```

### Manifest Structure

```json
{
  "generated_at": "2025-01-01T00:00:00.000Z",
  "version": "2.0.0",
  "source": "vsco-data-export",
  "image_count": 74,
  "images": {
    "60f6042f56ee7b3727dc1786": {
      "image_author": "username",
      "vsco_username": "username",
      "vsco_url": "https://vsco.co/username/media/60f6042f56ee7b3727dc1786",
      "vsco_image_id": "60f6042f56ee7b3727dc1786",
      "width": 2048,
      "height": 1536,
      "description": "",
      "direct_image_url": "https://im.vsco.co/...",
      "local_path": "60f6042f56ee7b3727dc1786.jpg",
      "capture_date": "2021-07-19T23:01:06.000Z"
    }
  }
}
```

## Integration

Add to your project as a git submodule:

```bash
git submodule add https://github.com/nicholasadamou/playwright-vsco-downloader tools/playwright-vsco-downloader
```

Then add a script to your `package.json`:

```json
{
  "scripts": {
    "download:images:vsco": "node tools/playwright-vsco-downloader/dist/cli.js --export-path tools/playwright-vsco-downloader/data/images.json --output-dir public/images/vsco"
  }
}
```

## Development

```bash
pnpm install
pnpm run dev -- --export-path ./data/images.json --output-dir ./output
pnpm run type-check
```

## License

See [LICENSE](LICENSE).
