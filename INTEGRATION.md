# 🎭 Playwright VSCO Downloader Integration

This guide explains how to integrate this enhanced Playwright-based VSCO image downloader into another project. The tool now features comprehensive metadata extraction, high-resolution downloads, and rich manifest generation with detailed VSCO-specific information.

## 🔄 Integration Options

You can integrate this tool into your main project in one of the following ways:

1) tools/ subfolder (recommended)
- Add this repo to your main project's tools/ directory (via copy or git submodule)
- Useful when you want full control over the code

2) Git submodule
- git submodule add https://github.com/nicholasadamou/playwright-vsco-downloader tools/playwright-vsco-downloader
- Keeps the tool versioned separately and easy to update

3) Monorepo/workspace
- Include this project as a workspace package and run its scripts from the root

## 🧩 Wiring It Into Your Main Project

Add a script to your main project's package.json that calls this tool:

```json
{
  "scripts": {
    "download:images:vsco": "cd tools/playwright-vsco-downloader && pnpm run download"
  }
}
```

Then run from your main project root:

```bash
pnpm run download:images:vsco
```

This will build the TypeScript sources and execute the CLI exposed by this project.

## 📁 Suggested File Structure

```
<your-project>/
├── tools/
│   └── playwright-vsco-downloader/
│       ├── src/
│       ├── package.json
│       ├── playwright.config.js
│       ├── .env.example
│       └── README.md
└── public/
    ├── vsco-manifest.json             # Source manifest (shared)
    └── images/vsco/                   # Download directory (shared)
```

Notes:
- The manifest and output directory can be customized via CLI flags or environment variables.
- If your project does not use public/, choose any path and pass it via --manifest-path/--download-dir.

## ⚙️ Environment Setup

From the tool directory:

```bash
cd tools/playwright-vsco-downloader
pnpm install
pnpm run install-browsers
cp .env.example .env
# Edit .env with your VSCO credentials and preferences
```

Relevant environment variables supported by this project:

```bash
# Optional (enables auto-login)
VSCO_EMAIL=your_email@example.com
VSCO_PASSWORD=your_password_here

# Optional configuration overrides
PLAYWRIGHT_TIMEOUT=30000
PLAYWRIGHT_RETRIES=3
PLAYWRIGHT_PREFERRED_SIZE=original
PLAYWRIGHT_LIMIT=0
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_DEBUG=false
```

## 🚀 Running the Downloader

From your main project (via the added script):

```bash
pnpm run download:images:vsco
```

Or directly inside the tool:

```bash
# Build and run
pnpm run download

# Development mode with hot reload
pnpm run download:dev

# Visible browser (helpful for manual login or debugging)
pnpm run download -- --no-headless
pnpm run download:dev -- --no-headless

# Environment check and list-only modes
pnpm run download -- check
pnpm run download -- list
```

## 🏛️ CLI Options

The CLI supports the following options (see README for full details):

```bash
pnpm run download -- \
  --timeout 45000 \
  --retries 5 \
  --limit 10 \
  --manifest-path ./public/vsco-manifest.json \
  --download-dir ./public/images/vsco \
  --no-headless \
  --debug
```

## 🧠 Smart Path Resolution

The tool tries to find your manifest and output folders in common locations if not explicitly provided. You can always override with --manifest-path and --download-dir.

## 🤖 CI/CD Integration

Example GitHub Actions step:

```yaml
- name: Download images with Playwright
  run: |
    cd tools/playwright-vsco-downloader
    pnpm install
    pnpm run install-browsers
    pnpm run download
  env:
    VSCO_EMAIL: ${{ secrets.VSCO_EMAIL }}
    VSCO_PASSWORD: ${{ secrets.VSCO_PASSWORD }}
```

Tips:
- In CI, consider running with --headless (default) and increasing --timeout for large downloads.
- Ensure your pipeline caches pnpm and Playwright browsers where possible for speed.

## 🧩 Programmatic Usage (Optional)

You can also use the downloader as a library inside a Node.js script within your main project:

```ts
import { PlaywrightImageDownloader } from "./tools/playwright-vsco-downloader/src/index.js";

const downloader = new PlaywrightImageDownloader({
  headless: true,
  timeout: 45000,
});

const result = await downloader.run();
console.log("Downloaded:", result.stats.downloaded);
```

Adjust the import path based on where you place this tool in your project.

## 🔧 Troubleshooting Integration

Common issues and fixes:

- "Manifest not found"
  - Pass --manifest-path explicitly or place the file in a common location like ./public/vsco-manifest.json
- "Browser installation failed"
  - Run pnpm run install-browsers and ensure your build agents have necessary system dependencies
- "Permission denied"
  - Ensure the download directory exists and your process can write to it
- "Login failed"
  - Verify VSCO_EMAIL/VSCO_PASSWORD or run with --no-headless for manual login

Use debug mode to diagnose:

```bash
cd tools/playwright-vsco-downloader
pnpm run download -- --no-headless --debug
```

## ✨ Enhanced Features

The updated VSCO downloader now includes:

### 🎯 Profile-Specific Scraping
- **Gallery-Only Extraction**: Uses `[data-testid="UserProfileGallery"]` selector to avoid profile avatars
- **Clean Image Selection**: Only downloads actual gallery content, not profile pictures

### 📅 Enhanced Metadata Extraction
- **Upload Dates**: Extracts actual upload timestamps from individual VSCO pages
- **Available Sizes**: Parses `srcset` attributes to catalog all available image resolutions
- **Srcset Data**: Stores complete responsive image information
- **High-Resolution URLs**: Obtains direct links to highest quality images (up to 2048px)

### 📄 Rich Manifest Generation
Generates comprehensive VSCO manifest with:
```json
{
  "profile": {
    "username": "photographer123",
    "display_name": "Amazing Photographer",
    "profile_url": "https://vsco.co/photographer123",
    "total_images_found": 45
  },
  "images": {
    "photographer123/60f6042f56ee7b3727dc1786": {
      "upload_date": "2021-07-19T23:01:06.386Z",
      "available_sizes": ["300w", "480w", "600w", "640w", "960w", "1136w", "1200w"],
      "srcset": "//im.vsco.co/.../vsco60f604326085a.jpg?w=300 300w, ...",
      "direct_image_url": "https://im.vsco.co/.../vsco60f604326085a.jpg?w=2048&dpr=1"
    }
  }
}
```

### 🚀 Smart Processing
- **Metadata for Existing Files**: Even skipped files get metadata extraction for complete manifests
- **High-Res Downloads**: Automatically downloads highest available resolution
- **Enhanced Debugging**: Detailed logging shows metadata extraction process

## 📊 Example Output (Enhanced VSCO Service)

```
🎭 Playwright VSCO Downloader
🚀 Initializing VSCO Image Downloader...
✅ Browser initialized
📊 Configuration:
   • Download directory: /path/to/images/vsco
   • Timeout: 30000ms
   • Retries: 3
   • Headless: false
   • Image limit: 5

🔍 Starting profile scraping...
🔍 Scraping VSCO profile: photographer123
   Profile URL: https://vsco.co/photographer123
🌐 Navigating to profile: @photographer123
✅ Profile page loaded: @photographer123
📸 Extracting images from @photographer123's profile
   Found VSCO gallery container
   Using selector '[data-testid="UserProfileGallery"] figure.MediaThumbnail img': Found 14 img elements
   ✅ Successfully extracted image 1: 60f6042f56ee7b3727dc1786
   Reached image limit: 5
✅ Successfully scraped 5 images from @photographer123

🚀 Starting downloads for 5 images...
📥 [1/5] Processing: photographer123/60f6042f56ee7b3727dc1786
   🌐 Navigating to: https://vsco.co/photographer123/media/60f6042f56ee7b3727dc1786
   ✅ Found image with selector: img[src*="vsco.co"]
   📸 Extracted image URL: https://im.vsco.co/.../vsco60f604326085a.jpg?w=2048&dpr=1
   📅 Upload date: 2021-07-19T23:01:06.386Z
   📏 Available sizes: 300w, 480w, 600w, 640w, 960w, 1136w, 1200w
   ✅ Downloaded: photographer123/60f6042f56ee7b3727dc1786.jpg (1.4 MB)

📝 Generating VSCO manifest...
📄 Generated VSCO manifest: public/images/vsco/manifest.json
   📊 Processed 5 images

📊 Download Results:
   ✅ Successfully downloaded: 4
   ⏭️  Skipped (already exist): 1
   ❌ Failed to download: 0
   ⏱️  Total time: 45.2s
   ✨ Success rate: 100%
   💾 Storage used: 12.67 MB
🎉 Download process completed successfully!
```

## 📞 Support

- See this repository's README for full documentation
- Run in debug mode for visual troubleshooting
- Verify your VSCO account credentials if using authentication
