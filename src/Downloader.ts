import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { ImageEntry, DownloadResult } from "./types.js";

const DEFAULT_CONCURRENCY = 5;

/**
 * Copies or downloads images to the output directory.
 * When `localImagesDir` is provided, images are copied from the local
 * VSCO data export. Otherwise falls back to downloading from CDN URLs.
 * Files that already exist on disk are skipped.
 */
export async function downloadImages(
  images: ImageEntry[],
  outputDir: string,
  localImagesDir: string | null = null,
  concurrency = DEFAULT_CONCURRENCY
): Promise<DownloadResult[]> {
  fs.mkdirSync(outputDir, { recursive: true });

  const results: DownloadResult[] = [];
  let completed = 0;

  async function processOne(entry: ImageEntry): Promise<DownloadResult> {
    const ext = path.extname(entry.fileName) || ".jpg";
    const filename = `${entry.id}${ext}`;
    const dest = path.join(outputDir, filename);

    if (fs.existsSync(dest)) {
      completed++;
      console.log(
        chalk.gray(
          `  [${completed}/${images.length}] ⏭  Skipped (exists): ${filename}`
        )
      );
      return { id: entry.id, success: true, skipped: true };
    }

    // Try local copy first
    if (localImagesDir) {
      const localSrc = path.join(localImagesDir, entry.fileName);
      if (fs.existsSync(localSrc)) {
        fs.copyFileSync(localSrc, dest);
        completed++;
        console.log(
          chalk.green(
            `  [${completed}/${images.length}] ✅ Copied: ${filename}`
          )
        );
        return { id: entry.id, success: true, skipped: false };
      }
    }

    // Fall back to CDN download
    try {
      const res = await fetch(entry.url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buffer);

      completed++;
      console.log(
        chalk.green(
          `  [${completed}/${images.length}] ✅ Downloaded: ${filename}`
        )
      );
      return { id: entry.id, success: true, skipped: false };
    } catch (err) {
      completed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(
        chalk.red(`  [${completed}/${images.length}] ❌ Failed: ${filename} — ${msg}`)
      );
      return { id: entry.id, success: false, skipped: false, error: msg };
    }
  }

  // Process in batches of `concurrency`
  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processOne));
    results.push(...batchResults);
  }

  return results;
}
