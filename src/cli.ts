#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { readExport } from "./ExportReader.js";
import { downloadImages } from "./Downloader.js";
import { generateManifest } from "./ManifestGenerator.js";

const program = new Command();

program
  .name("vsco-downloader")
  .description("Download images from a VSCO data export")
  .requiredOption(
    "--export-path <path>",
    "Path to VSCO data export directory or images.json"
  )
  .requiredOption("--output-dir <path>", "Directory to save downloaded images")
  .option(
    "--concurrency <number>",
    "Number of concurrent downloads",
    "5"
  )
  .action(async (opts: { exportPath: string; outputDir: string; concurrency: string }) => {
    console.log(chalk.bold("\n🎨 VSCO Image Downloader\n"));

    try {
      const { images, imagesDir } = readExport(opts.exportPath);

      if (images.length === 0) {
        console.log(chalk.yellow("No images found in export."));
        return;
      }

      console.log(chalk.blue(`⬇️  Downloading to: ${opts.outputDir}\n`));

      const results = await downloadImages(
        images,
        opts.outputDir,
        imagesDir,
        parseInt(opts.concurrency, 10)
      );

      generateManifest(images, results, opts.outputDir);

      const succeeded = results.filter((r) => r.success && !r.skipped).length;
      const skipped = results.filter((r) => r.skipped).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(chalk.bold("\n📊 Summary:"));
      console.log(chalk.green(`  ✅ Downloaded: ${succeeded}`));
      console.log(chalk.gray(`  ⏭  Skipped:    ${skipped}`));
      if (failed > 0) {
        console.log(chalk.red(`  ❌ Failed:     ${failed}`));
      }
      console.log();
    } catch (err) {
      console.error(
        chalk.red(`\n❌ Error: ${err instanceof Error ? err.message : err}`)
      );
      process.exit(1);
    }
  });

program.parse();
