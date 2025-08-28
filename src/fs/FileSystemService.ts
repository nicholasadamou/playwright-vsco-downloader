import fs from "fs-extra";
import path from "path";
import type { Stats } from "fs";
import type { Config } from "../config/Config.js";
import type { DownloadResult, ManifestFile } from "../types/index.js";

/**
 * Result of checking if an image exists
 */
interface ImageExistsResult {
  exists: boolean;
  filepath?: string;
  size?: number;
}

/**
 * Information about a saved file
 */
interface SavedFileInfo {
  filepath: string;
  filename: string;
  size: number;
}

/**
 * Local manifest creation result
 */
interface LocalManifestResult {
  localManifest: any;
  localManifestPath: string;
}

/**
 * Statistics provider interface
 */
interface StatsProvider {
  getSummaryForManifest(): any;
}

/**
 * @fileoverview File system service for reading/writing manifests and images,
 * ensuring directories exist, and providing helpers for paths and file stats.
 * This module encapsulates all filesystem interactions used by the downloader.
 *
 * Key Features:
 * - Image file existence checking with multiple extensions
 * - Download directory management and setup
 * - Playwright download saving with validation
 * - JSON manifest reading and writing
 * - Path manipulation and relative path calculation
 * - Debug screenshot path generation
 * - Storage calculation utilities
 *
 * File Operations:
 * - Supports multiple image formats (.jpg, .jpeg, .png, .webp)
 * - Automatic directory creation
 * - File size validation
 * - Cross-platform path handling
 *
 * @example
 * ```javascript
 * const fsService = new FileSystemService(config);
 *
 * // Check if image exists
 * const check = await fsService.imageExists('photo123');
 * if (check.exists) {
 *   console.log('Found:', check.filepath, check.size, 'bytes');
 * }
 *
 * // Save a download
 * const fileInfo = await fsService.saveDownload(download, 'photo123');
 * console.log('Saved to:', fileInfo.filepath);
 * ```
 */

/**
 * File system service for reading/writing manifests and images,
 * ensuring directories exist, and providing helpers for paths and file stats.
 * This module encapsulates all filesystem interactions used by the downloader.
 */
export class FileSystemService {
  private readonly config: Config;

  /**
   * Create a new file system service instance.
   *
   * @param config - Configuration instance
   * @example
   * ```javascript
   const fsService = new FileSystemService(config);
   * ```
   */
  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Check if image already exists locally
   * @param photoId Unsplash photo ID
   * @returns Promise resolving to an existence check result
   */
  async imageExists(photoId: string): Promise<ImageExistsResult> {
    const possibleExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const downloadDir = this.config.get("downloadDir");

    if (!downloadDir) {
      throw new Error("Download directory not configured");
    }

    for (const ext of possibleExtensions) {
      const filepath = path.join(downloadDir, `${photoId}${ext}`);
      if (await fs.pathExists(filepath)) {
        const stats = await fs.stat(filepath);
        return { exists: true, filepath, size: stats.size };
      }
    }

    return { exists: false };
  }

  /**
   * Ensure download directory exists
   * @returns Absolute path to the download directory
   */
  async ensureDownloadDirectory(): Promise<string> {
    const downloadDir = this.config.get("downloadDir");

    if (!downloadDir) {
      throw new Error("Download directory not configured");
    }

    await fs.ensureDir(downloadDir);
    return downloadDir;
  }

  /**
   * Save a download to the specified path
   * @param download Playwright Download object
   * @param photoId Photo ID used to name the file
   * @returns Information about the saved file
   */
  async saveDownload(
    download: any,
    photoId: string
  ): Promise<SavedFileInfo> {
    const downloadDir = await this.ensureDownloadDirectory();

    // Get the suggested filename or create one
    const suggestedFilename = await download.suggestedFilename();
    const extension = path.extname(suggestedFilename) || ".jpg";
    const filename = `${photoId}${extension}`;
    const filepath = path.join(downloadDir, filename);

    // Save the download
    await download.saveAs(filepath);

    // Verify file exists and has content
    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error("Downloaded file is empty");
    }

    return {
      filepath,
      filename,
      size: stats.size,
    };
  }

  /**
   * Check if a file path exists
   * @param filePath Path to check
   * @returns Whether the path exists
   */
  async pathExists(filePath: string): Promise<boolean> {
    return await fs.pathExists(filePath);
  }

  /**
   * Read JSON file
   * @param filePath Path to JSON file
   * @returns Parsed JSON data
   */
  async readJson(filePath: string): Promise<any> {
    if (!(await this.pathExists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }
    return await fs.readJson(filePath);
  }

  /**
   * Write JSON file with formatting
   * @param filePath Path to write JSON file
   * @param data Data to write
   * @param options Formatting options
   */
  async writeJson(
    filePath: string,
    data: any,
    options: { spaces?: number } = {}
  ): Promise<void> {
    const defaultOptions = { spaces: 2 };
    return await fs.writeJson(filePath, data, {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * Get file statistics
   * @param filePath Path to file
   * @returns File statistics
   */
  async getFileStats(filePath: string): Promise<Stats> {
    return await fs.stat(filePath);
  }

  /**
   * Get relative path from a base directory
   * @param filePath Full path to file
   * @param basePath Base directory (optional)
   * @returns Relative path
   */
  getRelativePath(filePath: string, basePath: string | null = null): string {
    const base = basePath || path.join(process.cwd());
    return path.relative(base, filePath);
  }

  /**
   * Create a local manifest file
   * @param results Download results
   * @param originalManifest Original manifest data
   * @param stats Statistics provider
   * @returns Local manifest information
   */
  async createLocalManifest(
    results: DownloadResult[],
    originalManifest: ManifestFile,
    stats: StatsProvider
  ): Promise<LocalManifestResult> {
    const downloadDir = this.config.get("downloadDir");

    if (!downloadDir) {
      throw new Error("Download directory not configured");
    }

    const localManifest = {
      generated_at: new Date().toISOString(),
      version: "2.0.0",
      source_manifest: originalManifest.generated_at,
      download_method: "playwright",
      images: {} as Record<string, any>,
      stats: stats.getSummaryForManifest(),
    };

    // Add successful downloads and skipped files
    results.forEach((result) => {
      if (result.success && result.filepath) {
        const relativePath = this.getRelativePath(result.filepath);

        localManifest.images[result.photoId] = {
          local_path: `/${relativePath.replace(/\\/g, "/")}`,
          downloaded_at: new Date().toISOString(),
          author: result.author || "Unknown author",
          author_url: result.authorUrl,
          image_url: result.imageUrl,
          size_bytes: result.size,
          width: result.width,
          height: result.height,
          skipped: result.skipped || false,
          download_method: "playwright",
        };
      }
    });

    const localManifestPath = path.join(downloadDir, "local-manifest.json");
    await this.writeJson(localManifestPath, localManifest);

    return { localManifest, localManifestPath };
  }

  /**
   * Create a comprehensive VSCO manifest file with detailed metadata.
   * Generates a manifest.json in the same directory as the images with complete
   * information about each image including VSCO URLs, author info, dimensions, etc.
   * 
   * @param results Download results from VSCO scraping
   * @param profileData Original profile scraping data
   * @param stats Statistics provider
   * @returns VSCO manifest information
   */
  async createVscoManifest(
    results: DownloadResult[],
    profileData: any,
    stats: StatsProvider
  ): Promise<LocalManifestResult> {
    const downloadDir = this.config.get("downloadDir");

    if (!downloadDir) {
      throw new Error("Download directory not configured");
    }

    const username = this.config.get("username");
    if (!username) {
      throw new Error("Username is required for VSCO manifest creation");
    }

    const vscoManifest = {
      generated_at: new Date().toISOString(),
      version: "1.0.0-vsco",
      source: "vsco_profile_scraper",
      download_method: "playwright",
      profile: {
        username: username,
        display_name: profileData?.displayName || username,
        profile_url: `https://vsco.co/${username}`,
        total_images_found: profileData?.imageCount || results.length,
      },
      images: {} as Record<string, any>,
      stats: stats.getSummaryForManifest(),
    };

    // Add comprehensive metadata for each successfully processed image
    results.forEach((result) => {
      if (result.success) {
        const imageId = result.photoId.split('/')[1] || result.photoId;
        const relativePath = result.filepath ? this.getRelativePath(result.filepath) : null;
        
        // Find original image data from profile scraping
        const originalImageData = profileData?.images?.find((img: any) => 
          img.id === imageId || result.photoId.includes(img.id)
        );

        vscoManifest.images[result.photoId] = {
          // File information
          local_path: relativePath ? `/${relativePath.replace(/\\/g, "/")}` : null,
          filename: result.filename || null,
          file_size_bytes: result.size || 0,
          downloaded_at: new Date().toISOString(),
          skipped: result.skipped || false,
          
          // VSCO metadata
          vsco_image_id: imageId,
          vsco_image_url: `https://vsco.co/${username}/media/${imageId}`,
          vsco_profile_url: `https://vsco.co/${username}`,
          direct_image_url: result.imageUrl || originalImageData?.url || null,
          thumbnail_url: originalImageData?.thumbnailUrl || null,
          
          // Image properties
          width_px: result.width || originalImageData?.width || null,
          height_px: result.height || originalImageData?.height || null,
          dimensions: result.width && result.height ? 
            `${result.width} x ${result.height}` : null,
          
          // Author information
          author: result.author || profileData?.displayName || username,
          vsco_username: username,
          
          // Content metadata (removed description as requested)
          upload_date: result.uploadDate || originalImageData?.uploadDate || null,
          
          // Enhanced VSCO metadata from individual page extraction
          available_sizes: result.availableSizes || null,
          srcset: result.srcset || null,
          
          // Technical metadata
          download_method: "playwright",
          extracted_at: new Date().toISOString(),
        };
      }
    });

    const manifestPath = path.join(downloadDir, "manifest.json");
    await this.writeJson(manifestPath, vscoManifest, { spaces: 2 });

    console.log(`📄 Generated VSCO manifest: ${this.getRelativePath(manifestPath)}`);
    console.log(`   📊 Processed ${Object.keys(vscoManifest.images).length} images`);

    return { 
      localManifest: vscoManifest, 
      localManifestPath: manifestPath 
    };
  }

  /**
   * Save image file from buffer
   * @param photoId Photo ID used to name the file
   * @param imageBuffer Image data buffer
   * @param extension File extension (without dot)
   * @returns Information about the saved file
   */
  async saveImageFile(
    photoId: string,
    imageBuffer: Buffer,
    extension: string
  ): Promise<SavedFileInfo> {
    const downloadDir = await this.ensureDownloadDirectory();
    const filename = `${photoId}.${extension}`;
    const filepath = path.join(downloadDir, filename);

    // Write the buffer to file
    await fs.writeFile(filepath, imageBuffer);

    // Verify file exists and has content
    const stats = await fs.stat(filepath);
    if (stats.size === 0) {
      throw new Error("Saved file is empty");
    }

    return {
      filepath,
      filename,
      size: stats.size,
    };
  }

  /**
   * Get debug screenshot path
   * @param photoId Photo ID
   * @param attempt Attempt number
   * @returns Screenshot file path
   */
  getDebugScreenshotPath(photoId: string, attempt: number): string {
    const downloadDir = this.config.get("downloadDir");

    if (!downloadDir) {
      throw new Error("Download directory not configured");
    }

    return path.join(downloadDir, `debug-${photoId}-attempt-${attempt}.png`);
  }

  /**
   * Calculate total storage used by results
   * @param results Download results
   * @returns Total storage in bytes
   */
  calculateTotalStorage(results: DownloadResult[]): number {
    return results
      .filter((r) => r.success && r.size)
      .reduce((sum, r) => sum + (r.size || 0), 0);
  }

  /**
   * Validate manifest file path
   * @returns Resolved manifest path if it exists
   */
  async validateManifestPath(): Promise<string> {
    const manifestPath = this.config.get("manifestPath");

    if (!manifestPath) {
      throw new Error("Manifest path not configured");
    }

    if (!(await this.pathExists(manifestPath))) {
      throw new Error(`Manifest file not found: ${manifestPath}`);
    }

    return manifestPath;
  }
}
