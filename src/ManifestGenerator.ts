import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { ImageEntry, Manifest, ManifestImage, DownloadResult } from "./types.js";

/**
 * Generates a `vsco-images.json` manifest in the output directory
 * containing metadata for all successfully downloaded images.
 */
export function generateManifest(
  images: ImageEntry[],
  results: DownloadResult[],
  outputDir: string
): void {
  const successIds = new Set(
    results.filter((r) => r.success).map((r) => r.id)
  );

  const manifestImages: Record<string, ManifestImage> = {};

  for (const entry of images) {
    if (!successIds.has(entry.id)) continue;

    const ext = path.extname(entry.fileName) || ".jpg";
    const filename = `${entry.id}${ext}`;

    manifestImages[entry.id] = {
      image_author: entry.username,
      vsco_username: entry.username,
      vsco_url: `https://vsco.co/${entry.username}/media/${entry.id}`,
      vsco_image_id: entry.id,
      width: entry.width,
      height: entry.height,
      description: entry.description,
      direct_image_url: entry.url,
      local_path: filename,
      capture_date: new Date(entry.captureDate * 1000).toISOString(),
    };
  }

  const manifest: Manifest = {
    generated_at: new Date().toISOString(),
    version: "2.0.0",
    source: "vsco-data-export",
    image_count: Object.keys(manifestImages).length,
    images: manifestImages,
  };

  const manifestPath = path.join(outputDir, "vsco-images.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(
    chalk.blue(`📄 Manifest written: ${manifestPath} (${manifest.image_count} images)`)
  );
}
