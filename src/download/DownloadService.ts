import chalk from "chalk";
import path from "path";
import type { Config } from "../config/Config.js";
import type { BrowserManager } from "../browser/BrowserManager.js";
import type { FileSystemService } from "../fs/FileSystemService.js";
import type { StatsTracker } from "../stats/StatsTracker.js";
import type {
  ImageData,
  DownloadResult,
  ImageEntry,
  DownloadSummary,
} from "../types";

/**
 * @fileoverview VSCO download service for handling image download logic through browser automation.
 * Since VSCO doesn't provide an API, this service uses browser automation to navigate to image pages
 * and download images directly.
 *
 * Key Features:
 * - Browser-based image downloading
 * - Retry mechanism with exponential backoff
 * - Progress tracking and statistics
 * - Error handling and fallbacks
 *
 * @example
 * ```javascript
 * const downloadService = new DownloadService(config, browserManager, fsService, statsTracker);
 * 
 * const result = await downloadService.downloadImage('username/imageId', imageData);
 * if (result.success) {
 *   console.log('Downloaded:', result.filename);
 * }
 * ```
 */

/**
 * Download service for handling VSCO image download logic through browser automation.
 * Follows the Single Responsibility Principle by handling only download-related operations.
 * Coordinates with browser, filesystem, and stats services to provide complete download functionality.
 */
export class DownloadService {
  private readonly config: Config;
  private readonly browser: BrowserManager;
  private readonly fs: FileSystemService;
  private readonly stats: StatsTracker;

  /**
   * Create a new VSCO download service instance.
   *
   * @param config - Configuration instance
   * @param browserManager - Browser manager for web operations
   * @param fileSystemService - File system operations service
   * @param statsTracker - Statistics tracking service
   * @example
   * ```javascript
   * const downloadService = new VscoDownloadService(config, browserManager, fsService, statsTracker);
   * ```
   */
  constructor(
    config: Config,
    browserManager: BrowserManager,
    fileSystemService: FileSystemService,
    statsTracker: StatsTracker
  ) {
    this.config = config;
    this.browser = browserManager;
    this.fs = fileSystemService;
    this.stats = statsTracker;
  }



  /**
   * Navigate to VSCO image page and extract comprehensive metadata including upload date and available sizes.
   * Since VSCO doesn't provide direct download links, we need to navigate
   * to the image page and extract the actual image URL and metadata.
   *
   * @param imageUrl - VSCO image page URL
   * @param username - VSCO username
   * @returns Object with direct image URL and metadata
   * @throws {Error} When image URL cannot be extracted
   * @example
   * ```javascript
   * const metadata = await downloadService.extractVscoImageMetadata('https://vsco.co/user/media/12345', 'user');
   * console.log('Direct image URL:', metadata.directImageUrl);
   * console.log('Upload date:', metadata.uploadDate);
   * ```
   */
  async extractVscoImageMetadata(imageUrl: string, username: string): Promise<{
    directImageUrl: string;
    uploadDate?: string;
    availableSizes?: string[];
    srcset?: string;
    originalWidth?: number;
    originalHeight?: number;
  }> {
    const page = await this.browser.getPage();

    try {
      if (this.config.get("debug")) {
        console.log(chalk.gray(`   🌐 Navigating to: ${imageUrl}`));
      }

      // Navigate to the VSCO image page
      await page.goto(imageUrl, { waitUntil: "domcontentloaded" });

      // Wait for the image to load
      await page.waitForTimeout(2000);

      // Try multiple selectors to find the image
      const imageSelectors = [
        'img[data-test="photo"]',
        'img.responsive-image',
        'img[src*="vsco.co"]',
        'img[class*="image"]',
        '.image-container img',
        '.photo-container img'
      ];

      let directImageUrl: string | null = null;

      for (const selector of imageSelectors) {
        try {
          const imgElement = await page.locator(selector).first();
          if (await imgElement.isVisible({ timeout: 1000 })) {
            directImageUrl = await imgElement.getAttribute('src');
            if (directImageUrl) {
              if (this.config.get("debug")) {
                console.log(chalk.gray(`   ✅ Found image with selector: ${selector}`));
              }
              break;
            }
          }
        } catch (error) {
          // Try next selector
          continue;
        }
      }

      if (!directImageUrl) {
        // Try extracting from page source or JavaScript
        const imageUrls = await page.evaluate(() => {
          const urls: string[] = [];
          
          // Look for image URLs in various places
          const images = document.querySelectorAll('img');
          images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && (src.includes('vsco') || src.startsWith('http'))) {
              urls.push(src);
            }
          });

          // Also check for URLs in script tags or data attributes
          const scripts = document.querySelectorAll('script');
          scripts.forEach(script => {
            const content = script.textContent || '';
            const matches = content.match(/https:\/\/[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi);
            if (matches) {
              urls.push(...matches);
            }
          });

          return urls;
        });

        // Find the most likely candidate
        directImageUrl = imageUrls.find((url: string) => 
          url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp')
        ) || null;
      }

      if (!directImageUrl) {
        throw new Error("Could not extract image URL from VSCO page");
      }

      // Ensure the URL is absolute
      if (directImageUrl.startsWith('//')) {
        directImageUrl = 'https:' + directImageUrl;
      } else if (directImageUrl.startsWith('/')) {
        directImageUrl = 'https://vsco.co' + directImageUrl;
      }

      // Extract additional metadata from the page
      const metadata = await page.evaluate(() => {
        const result: {
          uploadDate?: string;
          availableSizes?: string[];
          srcset?: string;
          originalWidth?: number;
          originalHeight?: number;
        } = {};

        // Extract upload date from <time> element
        const timeElement = document.querySelector('time[datetime]');
        if (timeElement) {
          const datetime = timeElement.getAttribute('datetime');
          if (datetime) {
            result.uploadDate = datetime;
          }
        }

        // Extract available image sizes from srcset attribute
        const imgWithSrcset = document.querySelector('img[srcset]');
        if (imgWithSrcset) {
          const srcset = imgWithSrcset.getAttribute('srcset');
          if (srcset) {
            result.srcset = srcset;
            
            // Parse available sizes from srcset
            const sizes: string[] = [];
            const srcsetEntries = srcset.split(', ');
            srcsetEntries.forEach(entry => {
              const match = entry.match(/(\d+)w$/);
              if (match) {
                sizes.push(match[1] + 'w');
              }
            });
            result.availableSizes = sizes;
          }

          // Extract original dimensions
          const width = imgWithSrcset.getAttribute('width');
          const height = imgWithSrcset.getAttribute('height');
          if (width && height) {
            const parsedWidth = parseInt(width.replace('%', ''));
            const parsedHeight = parseInt(height);
            if (!isNaN(parsedWidth)) result.originalWidth = parsedWidth;
            if (!isNaN(parsedHeight)) result.originalHeight = parsedHeight;
          }
        }

        return result;
      });

      if (this.config.get("debug")) {
        console.log(chalk.gray(`   📸 Extracted image URL: ${directImageUrl}`));
        if (metadata.uploadDate) {
          console.log(chalk.gray(`   📅 Upload date: ${metadata.uploadDate}`));
        }
        if (metadata.availableSizes) {
          console.log(chalk.gray(`   📏 Available sizes: ${metadata.availableSizes.join(', ')}`));
        }
      }

      const result: {
        directImageUrl: string;
        uploadDate?: string;
        availableSizes?: string[];
        srcset?: string;
        originalWidth?: number;
        originalHeight?: number;
      } = { directImageUrl };
      
      if (metadata.uploadDate) result.uploadDate = metadata.uploadDate;
      if (metadata.availableSizes) result.availableSizes = metadata.availableSizes;
      if (metadata.srcset) result.srcset = metadata.srcset;
      if (metadata.originalWidth) result.originalWidth = metadata.originalWidth;
      if (metadata.originalHeight) result.originalHeight = metadata.originalHeight;
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to extract VSCO image URL: ${errorMessage}`);
    }
  }

  /**
   * Download a single VSCO image with retry logic and error handling.
   * Main orchestration method that coordinates metadata fetching, URL extraction,
   * and file downloading.
   *
   * @param photoId - VSCO photo identifier (could be username/imageId format)
   * @param imageData - Manifest image data
   * @returns Download result with success status and metadata
   * @example
   * ```javascript
   * const result = await downloadService.downloadImage('user/abc123', imageData);
   * if (result.success) {
   *   console.log('Downloaded:', result.filename, result.size, 'bytes');
   * } else {
   *   console.error('Failed:', result.error);
   * }
   * ```
   */
  async downloadImage(
    photoId: string,
    imageData: ImageData
  ): Promise<DownloadResult> {
    const retries = this.config.get("retries") || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.attemptDownload(photoId, imageData, attempt);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(
            chalk.yellow(
              `   ⚠️  Attempt ${attempt} failed, retrying in ${delay / 1000}s...`
            )
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    this.stats.incrementFailed();
    console.log(chalk.red(`   ❌ Failed after ${retries} attempts`));
    
    return {
      success: false,
      photoId,
      error: lastError?.message || "Unknown error after all retries",
      author: imageData.image_author || '',
    };
  }

  /**
   * Attempt to download an image (single try).
   * Internal method that performs the actual download logic for a single attempt.
   *
   * @param photoId - VSCO photo identifier
   * @param imageData - Manifest image data
   * @param attempt - Current attempt number (for logging)
   * @returns Download result
   * @throws {Error} When download fails
   * @private
   */
  private async attemptDownload(
    photoId: string,
    imageData: ImageData,
    attempt: number
  ): Promise<DownloadResult> {
    if (this.config.get("debug")) {
      console.log(chalk.gray(`   🔄 Attempt ${attempt} for ${photoId}`));
    }

    // Check if file already exists
    const existingFile = await this.fs.imageExists(photoId);
    if (existingFile.exists) {
      console.log(chalk.gray(`   ⏭️  Skipped (exists): ${existingFile.filepath}`));
      this.stats.incrementSkipped();
      
      // Still extract metadata for manifest generation, even for existing files
      try {
        const parts = photoId.split('/');
        const username = parts[0];
        const imageId = parts[1] || photoId;

        // Build VSCO image URL
        let vscoImageUrl = '';
        if (imageData.vsco_url) {
          vscoImageUrl = imageData.vsco_url as string;
        } else if (username && imageId && imageId !== username) {
          vscoImageUrl = `https://vsco.co/${username}/media/${imageId}`;
        } else {
          vscoImageUrl = `https://vsco.co/${username}`;
        }

        // Extract comprehensive metadata from VSCO page
        const vscoMetadata = await this.extractVscoImageMetadata(vscoImageUrl, username || '');
        
        const result: DownloadResult = {
          success: true,
          photoId,
          filepath: existingFile.filepath!,
          filename: path.basename(existingFile.filepath!),
          size: existingFile.size ?? 0,
          skipped: true,
          author: imageData.image_author || '',
        };
        
        // Conditionally add metadata only when defined
        if (vscoMetadata.uploadDate) result.uploadDate = vscoMetadata.uploadDate;
        if (vscoMetadata.availableSizes) result.availableSizes = vscoMetadata.availableSizes;
        if (vscoMetadata.srcset) result.srcset = vscoMetadata.srcset;
        if (vscoMetadata.originalWidth) result.originalWidth = vscoMetadata.originalWidth;
        if (vscoMetadata.originalHeight) result.originalHeight = vscoMetadata.originalHeight;
        
        return result;
      } catch (error) {
        // If metadata extraction fails, still return basic info
        if (this.config.get("debug")) {
          console.log(chalk.yellow(`   ⚠️  Could not extract metadata for existing file: ${error}`));
        }
        return {
          success: true,
          photoId,
          filepath: existingFile.filepath!,
          filename: path.basename(existingFile.filepath!),
          size: existingFile.size ?? 0,
          skipped: true,
          author: imageData.image_author || '',
        };
      }
    }

    // Handle dry run mode
    if (this.config.get("dryRun")) {
      console.log(chalk.blue(`   🏃 Dry run: would download ${photoId}`));
      this.stats.incrementDownloaded();
      
      return {
        success: true,
        photoId,
        dryRun: true,
        author: imageData.image_author || '',
      };
    }

    try {
      // Extract username and image ID from photoId
      const parts = photoId.split('/');
      const username = parts[0];
      const imageId = parts[1] || photoId;

      // Build VSCO image URL
      let vscoImageUrl = '';
      if (imageData.vsco_url) {
        vscoImageUrl = imageData.vsco_url as string;
      } else if (username && imageId && imageId !== username) {
        vscoImageUrl = `https://vsco.co/${username}/media/${imageId}`;
      } else {
        vscoImageUrl = `https://vsco.co/${username}`;
      }

      // No API available, use existing metadata from scraping

      // Extract comprehensive metadata from VSCO page including upload date and sizes
      const vscoMetadata = await this.extractVscoImageMetadata(vscoImageUrl, username || '');

      // Download the image using the direct URL
      const downloadResult = await this.downloadFromDirectUrl(
        vscoMetadata.directImageUrl,
        photoId,
        {
          ...imageData,
          uploadDate: vscoMetadata.uploadDate,
          availableSizes: vscoMetadata.availableSizes,
          srcset: vscoMetadata.srcset,
          originalWidth: vscoMetadata.originalWidth,
          originalHeight: vscoMetadata.originalHeight,
        }
      );

      if (downloadResult.success) {
        this.stats.incrementDownloaded();
        console.log(
          chalk.green(
            `   ✅ Downloaded: ${downloadResult.filename} (${this.formatFileSize(downloadResult.size || 0)})`
          )
        );
      }

      return downloadResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (this.config.get("debug")) {
        console.log(chalk.red(`   ❌ Download attempt failed: ${errorMessage}`));
      }
      
      throw error;
    }
  }

  /**
   * Download image from a direct URL.
   * Handles the actual HTTP download and file saving.
   *
   * @param imageUrl - Direct image URL
   * @param photoId - Photo identifier for filename
   * @param metadata - Combined metadata from manifest and API
   * @returns Download result
   * @throws {Error} When download fails
   * @private
   */
  private async downloadFromDirectUrl(
    imageUrl: string,
    photoId: string,
    metadata: any
  ): Promise<DownloadResult> {
    const page = await this.browser.getPage();

    try {
      // Navigate to the image URL directly to trigger download
      const response = await page.goto(imageUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.config.get("timeout") || 30000,
      });

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response?.status()}: Failed to fetch image`);
      }

      // Get the response body as buffer
      const imageBuffer = await response.body();
      
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error("Empty image data received");
      }

      // Save the image file
      const savedFile = await this.fs.saveImageFile(
        photoId,
        imageBuffer,
        'jpg' // Default extension, could be enhanced to detect actual format
      );

      return {
        success: true,
        photoId,
        filepath: savedFile.filepath,
        filename: savedFile.filename,
        size: savedFile.size,
        author: metadata.author || metadata.image_author,
        authorUrl: metadata.authorUrl,
        imageUrl: imageUrl,
        width: metadata.width,
        height: metadata.height,
        // Pass through VSCO-specific metadata
        uploadDate: metadata.uploadDate,
        availableSizes: metadata.availableSizes,
        srcset: metadata.srcset,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to download from direct URL: ${errorMessage}`);
    }
  }

  /**
   * Format file size in human-readable format.
   *
   * @param bytes - File size in bytes
   * @returns Formatted file size string
   * @private
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Process multiple images with concurrency control.
   * Orchestrates the download of multiple images while respecting rate limits.
   * Now supports both concurrent and sequential processing modes.
   *
   * @param imageEntries - Array of image entries to download
   * @returns Array of download results
   * @example
   * ```javascript
   * const results = await downloadService.downloadImages(imageEntries);
   * const successful = results.filter(r => r.success);
   * console.log(`Downloaded ${successful.length} of ${results.length} images`);
   * ```
   */
  async downloadImages(imageEntries: ImageEntry[]): Promise<DownloadResult[]> {
    const maxConcurrency = this.config.get("maxConcurrency") || 1;
    
    // If concurrency is 1 or not enabled, use sequential processing (legacy behavior)
    if (maxConcurrency === 1) {
      return await this.downloadImagesSequentially(imageEntries);
    }
    
    // For concurrent processing, we need to create a browser pool and use the concurrent service
    console.log(
      chalk.blue(
        `🚀 Starting downloads for ${imageEntries.length} images ` +
        `(concurrent mode: ${maxConcurrency} workers)...`
      )
    );
    
    // Import the required classes dynamically to avoid circular dependencies
    const { BrowserPool } = await import("../browser/BrowserPool.js");
    const { ConcurrentDownloadService } = await import("./ConcurrentDownloadService.js");
    
    const browserPool = new BrowserPool(this.config);
    
    try {
      await browserPool.initialize();
      
      const concurrentDownloader = new ConcurrentDownloadService(
        this.config,
        browserPool,
        this.fs,
        this.stats
      );
      
      return await concurrentDownloader.downloadImagesConcurrently(imageEntries);
      
    } finally {
      await browserPool.cleanup();
    }
  }
  
  /**
   * Process images sequentially (legacy behavior).
   * Used when concurrency is disabled or set to 1.
   *
   * @param imageEntries - Array of image entries to download
   * @returns Array of download results
   * @private
   */
  private async downloadImagesSequentially(imageEntries: ImageEntry[]): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    
    console.log(chalk.blue(`🚀 Starting sequential downloads for ${imageEntries.length} images...`));

    // Process images sequentially
    for (let i = 0; i < imageEntries.length; i++) {
      const entry = imageEntries[i];
      if (!entry) continue;
      const [photoId, imageData] = entry;
      
      console.log(
        chalk.blue(`📥 [${i + 1}/${imageEntries.length}] Processing: ${photoId}`)
      );

      const result = await this.downloadImage(photoId, imageData);
      results.push(result);

      // Add a small delay between downloads to be respectful to VSCO
      if (i < imageEntries.length - 1) {
        const delay = this.config.get("delayBetweenBatches") || 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * Generate a summary of download results.
   * Calculates statistics and categorizes results for reporting.
   *
   * @param results - Array of download results
   * @returns Download summary with statistics and failed items
   * @example
   * ```javascript
   * const summary = downloadService.getDownloadSummary(results);
   * console.log(`Success rate: ${(summary.successful / results.length * 100).toFixed(1)}%`);
   * ```
   */
  getDownloadSummary(results: DownloadResult[]): DownloadSummary {
    const successful = results.filter(r => r.success && !r.skipped).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.success && r.skipped).length;
    
    const totalStorage = results
      .filter(r => r.success && r.size)
      .reduce((sum, r) => sum + (r.size || 0), 0);
    
    const failedResults = results.filter(r => !r.success);

    return {
      successful,
      failed,
      skipped,
      totalStorage,
      failedResults,
    };
  }
}
