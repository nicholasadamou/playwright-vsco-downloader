import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { VscoExportImage, ImageEntry } from "./types.js";

export interface ExportData {
  images: ImageEntry[];
  /** Absolute path to the local `images/` directory, if it exists. */
  imagesDir: string | null;
}

/**
 * Reads a VSCO data export's `images.json` and converts entries
 * to a normalized list of images ready for download / copy.
 */
export function readExport(exportPath: string): ExportData {
  const isJsonFile = exportPath.endsWith(".json");
  const imagesJsonPath = isJsonFile
    ? exportPath
    : path.join(exportPath, "images.json");

  if (!fs.existsSync(imagesJsonPath)) {
    throw new Error(`VSCO export not found: ${imagesJsonPath}`);
  }

  const exportDir = path.dirname(imagesJsonPath);
  const localImagesDir = path.join(exportDir, "images");
  const imagesDir =
    fs.existsSync(localImagesDir) && fs.statSync(localImagesDir).isDirectory()
      ? localImagesDir
      : null;

  const raw: VscoExportImage[] = JSON.parse(
    fs.readFileSync(imagesJsonPath, "utf-8")
  );

  const images: ImageEntry[] = [];

  for (const entry of raw) {
    if (entry.is_video) continue;
    if (!entry.responsive_url) continue;

    const url = entry.responsive_url.startsWith("http")
      ? entry.responsive_url
      : `https://${entry.responsive_url}`;

    images.push({
      id: entry.id,
      url,
      fileName: entry.file_name,
      width: entry.width,
      height: entry.height,
      username: entry.perma_subdomain,
      captureDate: entry.capture_date,
      description: entry.description ?? "",
    });
  }

  console.log(
    chalk.blue(`📦 Loaded ${images.length} images from VSCO data export`)
  );
  if (imagesDir) {
    console.log(chalk.blue(`📂 Local images directory found: ${imagesDir}`));
  }

  return { images, imagesDir };
}
