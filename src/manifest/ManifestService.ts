import chalk from "chalk";
import type { Config } from "../config/Config.js";
import type { FileSystemService } from "../fs/FileSystemService.js";
import type {
  ImageEntry,
  ProcessedManifestResult,
  ImageStatistics,
  LocalManifestResult,
  DownloadResult,
  ManifestFile,
} from "../types";

/**
 * Statistics provider interface
 */
interface StatsProvider {
  getSummaryForManifest(): any;
}

/**
 * @fileoverview Manifest service for handling manifest loading, parsing, and local manifest creation.
 * Provides comprehensive manifest operations including validation, processing, statistics generation,
 * and local manifest creation for downloaded images from VSCO.
 *
 * Key Features:
 * - Manifest file loading and validation
 * - VSCO-specific image entry processing and filtering
 * - Limit application and entry validation
 * - Statistics calculation and display
 * - Local manifest generation
 * - Progress tracking integration
 *
 * Manifest Structure:
 * - Supports VSCO manifest format with profile/image metadata
 * - Processes VSCO URL patterns and image IDs
 * - Generates local manifests with download results
 * - Tracks image statistics and author metadata
 *
 * @example
 * ```javascript
 * const manifestService = new ManifestService(config, fsService);
 *
 * // Load and process manifest
 * const { imageEntries, originalManifest, totalImages } =
 *   await manifestService.getProcessedImageEntries();
 *
 * console.log(`Processing ${totalImages} images`);
 *
 * // Create local manifest after downloading
 * const { localManifest, localManifestPath } =
 *   await manifestService.createLocalManifest(results, originalManifest, statsTracker);
 * ```
 */

/**
 * Manifest service for handling manifest loading, parsing, and local manifest creation.
 * Follows the Single Responsibility Principle by handling only manifest-related operations.
 * Coordinates with filesystem service to provide complete manifest management functionality.
 */
export class ManifestService {
  private readonly config: Config;
  private readonly fs: FileSystemService;

  /**
   * Create a new manifest service instance.
   *
   * @param config - Configuration instance
   * @param fileSystemService - File system service
   * @example
   * ```javascript
   * const manifestService = new ManifestService(config, fsService);
   * ```
   */
  constructor(config: Config, fileSystemService: FileSystemService) {
    this.config = config;
    this.fs = fileSystemService;
  }

  /**
   * Load and parse the manifest file
   * @returns Promise with loaded manifest data
   */
  async loadManifest(): Promise<ProcessedManifestResult> {
    try {
      console.log(chalk.blue("📄 Loading manifest..."));

      const manifestPath = await this.fs.validateManifestPath();
      const manifestContent = await this.fs.readJson(manifestPath);

      const imageEntries = Object.entries(
        manifestContent.images || {}
      ) as ImageEntry[];

      console.log(
        chalk.green(`✅ Loaded ${imageEntries.length} images from manifest`)
      );

      return {
        imageEntries,
        originalManifest: manifestContent,
        totalImages: imageEntries.length,
      };
    } catch (error) {
      console.error(
        chalk.red("❌ Error loading manifest:"),
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * Apply limit to image entries if specified
   * @param imageEntries Array of image entries
   * @returns Limited array of image entries
   */
  applyLimit(imageEntries: ImageEntry[]): ImageEntry[] {
    const limit = this.config.get("limit");

    if (!limit || limit <= 0) {
      return imageEntries;
    }

    if (imageEntries.length > limit) {
      console.log(
        chalk.yellow(
          `⚠️  Limited to first ${limit} images (out of ${imageEntries.length} total)`
        )
      );
      return imageEntries.slice(0, limit);
    }

    return imageEntries;
  }

  /**
   * Validate image entries format
   * @param imageEntries Array to validate
   * @returns true if valid
   * @throws {Error} When format is invalid
   */
  validateImageEntries(imageEntries: ImageEntry[]): true {
    if (!Array.isArray(imageEntries)) {
      throw new Error("Image entries must be an array");
    }

    if (imageEntries.length === 0) {
      throw new Error("No images found in manifest");
    }

    // Validate each entry has required fields
    for (const [photoId, imageData] of imageEntries) {
      if (!photoId) {
        throw new Error("Image entry missing photo ID");
      }

      if (!imageData || typeof imageData !== "object") {
        throw new Error(`Invalid image data for photo ID: ${photoId}`);
      }
    }

    return true;
  }

  /**
   * Get processed image entries with validation and limit applied
   * @returns Processed manifest data
   */
  async getProcessedImageEntries(): Promise<ProcessedManifestResult> {
    const { imageEntries, originalManifest, totalImages } =
      await this.loadManifest();

    if (totalImages === 0) {
      console.log(chalk.yellow("⚠️  No images found in manifest"));
      return {
        imageEntries: [],
        originalManifest,
        totalImages: 0,
      };
    }

    // Validate format
    this.validateImageEntries(imageEntries);

    // Apply limit if specified
    const limitedEntries = this.applyLimit(imageEntries);

    return {
      imageEntries: limitedEntries,
      originalManifest,
      totalImages: limitedEntries.length,
    };
  }

  /**
   * Create a local manifest with download results
   * @param results Download results
   * @param originalManifest Original manifest
   * @param stats Statistics provider
   * @returns Local manifest information
   */
  async createLocalManifest(
    results: DownloadResult[],
    originalManifest: ManifestFile,
    stats: StatsProvider
  ): Promise<LocalManifestResult> {
    console.log(chalk.blue("\n📝 Creating local manifest..."));

    const { localManifest, localManifestPath } =
      await this.fs.createLocalManifest(results, originalManifest, stats);

    console.log(
      chalk.blue(
        `   📄 Local manifest: ${this.fs.getRelativePath(localManifestPath, process.cwd())}`
      )
    );

    return { localManifest, localManifestPath };
  }

  /**
   * Get image statistics from entries
   * @param imageEntries Array of image entries
   * @returns Image statistics
   */
  getImageStatistics(imageEntries: ImageEntry[]): ImageStatistics {
    if (imageEntries.length === 0) {
      return {
        total: 0,
        authors: [],
        uniqueAuthors: 0,
        averageWidth: 0,
        averageHeight: 0,
        imagesWithDimensions: 0,
      };
    }

    const authors = new Set<string>();
    let totalWidth = 0;
    let totalHeight = 0;
    let validDimensionCount = 0;

    imageEntries.forEach(([, data]) => {
      if (data.image_author) {
        authors.add(data.image_author);
      }

      if (data.width && data.height) {
        totalWidth += data.width;
        totalHeight += data.height;
        validDimensionCount++;
      }
    });

    return {
      total: imageEntries.length,
      authors: Array.from(authors),
      uniqueAuthors: authors.size,
      averageWidth:
        validDimensionCount > 0
          ? Math.round(totalWidth / validDimensionCount)
          : 0,
      averageHeight:
        validDimensionCount > 0
          ? Math.round(totalHeight / validDimensionCount)
          : 0,
      imagesWithDimensions: validDimensionCount,
    };
  }

  /**
   * Display manifest statistics
   * @param imageEntries Array of image entries
   */
  displayManifestStats(imageEntries: ImageEntry[]): void {
    const stats = this.getImageStatistics(imageEntries);

    console.log(chalk.blue("📊 Manifest Statistics:"));
    console.log(chalk.gray(`   • Total images: ${stats.total}`));
    console.log(chalk.gray(`   • Unique authors: ${stats.uniqueAuthors}`));

    if (stats.imagesWithDimensions > 0) {
      console.log(
        chalk.gray(
          `   • Average dimensions: ${stats.averageWidth}×${stats.averageHeight}`
        )
      );
      console.log(
        chalk.gray(`   • Images with dimensions: ${stats.imagesWithDimensions}`)
      );
    }
  }

  /**
   * Extract VSCO username from a URL or return as-is if already a username.
   *
   * @param vscoUrl - VSCO URL or username
   * @returns Username string or null if invalid
   * @example
   * ```javascript
   * const username = service.extractUsername('https://vsco.co/username');
   * // Returns: 'username'
   * 
   * const username = service.extractUsername('username');
   * // Returns: 'username'
   * ```
   */
  extractUsername(vscoUrl: string): string | null {
    try {
      // If it's already just a username, return it
      if (!vscoUrl.includes('/') && !vscoUrl.includes('.')) {
        return vscoUrl.toLowerCase();
      }

      // Parse VSCO URL patterns:
      // https://vsco.co/username
      // https://vsco.co/username/gallery/imageId
      const urlPattern = /(?:https?:\/\/)?(?:www\.)?vsco\.co\/([a-zA-Z0-9_-]+)/;
      const match = vscoUrl.match(urlPattern);
      
      return match && match[1] ? match[1].toLowerCase() : null;
    } catch (error) {
      if (this.config.get("debug")) {
        console.log(chalk.red(`   Failed to extract username from: ${vscoUrl}`));
      }
      return null;
    }
  }

  /**
   * Extract VSCO image ID from a URL.
   *
   * @param vscoUrl - Full VSCO image URL
   * @returns Image ID string or null if invalid
   * @example
   * ```javascript
   * const imageId = service.extractImageId('https://vsco.co/username/gallery/1234567890');
   * // Returns: '1234567890'
   * ```
   */
  extractImageId(vscoUrl: string): string | null {
    try {
      // Parse VSCO image URL patterns:
      // https://vsco.co/username/gallery/imageId
      // https://vsco.co/username/media/imageId
      const imagePattern = /vsco\.co\/[^\/]+\/(?:gallery|media)\/([a-f0-9]+)/;
      const match = vscoUrl.match(imagePattern);
      
      return match && match[1] ? match[1] : null;
    } catch (error) {
      if (this.config.get("debug")) {
        console.log(chalk.red(`   Failed to extract image ID from: ${vscoUrl}`));
      }
      return null;
    }
  }

  /**
   * Validate if a URL is a valid VSCO URL.
   *
   * @param url - URL to validate
   * @returns true if valid VSCO URL, false otherwise
   * @example
   * ```javascript
   * const isValid = service.isValidVscoUrl('https://vsco.co/username');
   * // Returns: true
   * ```
   */
  isValidVscoUrl(url: string): boolean {
    try {
      const vscoPattern = /^(?:https?:\/\/)?(?:www\.)?vsco\.co\//;
      return vscoPattern.test(url);
    } catch {
      return false;
    }
  }

  /**
   * Process VSCO-specific image entries and validate URLs/IDs.
   * Ensures all entries have valid VSCO format and extracts necessary metadata.
   *
   * @param imageEntries - Raw image entries from manifest
   * @returns Processed and validated entries
   * @throws {Error} When entries contain invalid VSCO data
   */
  processVscoImageEntries(imageEntries: ImageEntry[]): ImageEntry[] {
    const processedEntries: ImageEntry[] = [];

    for (const [photoId, imageData] of imageEntries) {
      try {
        // For VSCO, we might have different ID formats
        // The photoId could be a URL, username, or direct image ID
        let processedId = photoId;
        let processedData = { ...imageData };

        // If photoId looks like a URL, extract the relevant parts
        if (this.isValidVscoUrl(photoId)) {
          const username = this.extractUsername(photoId);
          const imageId = this.extractImageId(photoId);

          if (username && imageId) {
            processedId = `${username}/${imageId}`;
            processedData.vsco_username = username;
            processedData.vsco_image_id = imageId;
            processedData.vsco_url = photoId;
          } else if (username) {
            processedId = username;
            processedData.vsco_username = username;
            processedData.vsco_url = photoId;
          }
        }

        // Ensure we have required VSCO metadata
        if (!processedData.vsco_username && !processedData.image_author) {
          console.warn(
            chalk.yellow(`⚠️  Entry ${processedId} missing VSCO username or author`)
          );
        }

        processedEntries.push([processedId, processedData]);
      } catch (error) {
        console.warn(
          chalk.yellow(
            `⚠️  Skipping invalid entry ${photoId}: ${(error as Error).message}`
          )
        );
      }
    }

    return processedEntries;
  }
}
