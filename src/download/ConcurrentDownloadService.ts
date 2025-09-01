import chalk from "chalk";
import { basename } from "path";
import type { BrowserContext } from "playwright";
import type { Config } from "../config/Config.js";
import type { BrowserPool } from "../browser/BrowserPool.js";
import type { FileSystemService } from "../fs/FileSystemService.js";
import type { StatsTracker } from "../stats/StatsTracker.js";
import type {
  ImageData,
  DownloadResult,
  ImageEntry,
} from "../types";

/**
 * @fileoverview Concurrent download service for managing parallel image downloads.
 * Orchestrates multiple concurrent downloads while respecting rate limits and system resources.
 * 
 * Key Features:
 * - Concurrent download processing with configurable limits
 * - Batch processing with delays between batches
 * - Proper error handling and retry mechanisms
 * - Resource management and cleanup
 * - Progress tracking and statistics
 * 
 * @example
 * ```javascript
 * const concurrentDownloader = new ConcurrentDownloadService(
 *   config, browserPool, fsService, statsTracker, downloadService
 * );
 * 
 * const results = await concurrentDownloader.downloadImagesConcurrently(imageEntries);
 * console.log(`Downloaded ${results.filter(r => r.success).length} images`);
 * ```
 */

/**
 * Concurrent download service for managing parallel image downloads.
 * Coordinates multiple download workers while respecting system limits and rate limiting.
 */
export class ConcurrentDownloadService {
  private readonly config: Config;
  private readonly browserPool: BrowserPool;
  private readonly fs: FileSystemService;
  private readonly stats: StatsTracker;

  /**
   * Create a new concurrent download service instance.
   * 
   * @param config - Configuration instance
   * @param browserPool - Browser pool for managing contexts
   * @param fileSystemService - File system operations service
   * @param statsTracker - Statistics tracking service
   * @example
   * ```javascript
   * const concurrentDownloader = new ConcurrentDownloadService(
   *   config, browserPool, fsService, statsTracker
   * );
   * ```
   */
  constructor(
    config: Config,
    browserPool: BrowserPool,
    fileSystemService: FileSystemService,
    statsTracker: StatsTracker
  ) {
    this.config = config;
    this.browserPool = browserPool;
    this.fs = fileSystemService;
    this.stats = statsTracker;
  }

  /**
   * Download multiple images concurrently with batch processing and rate limiting.
   * Main orchestration method for concurrent downloads.
   * 
   * @param imageEntries - Array of image entries to download
   * @returns Array of download results
   * @example
   * ```javascript
   * const results = await concurrentDownloader.downloadImagesConcurrently(imageEntries);
   * const successful = results.filter(r => r.success);
   * console.log(`Downloaded ${successful.length} of ${results.length} images`);
   * ```
   */
  async downloadImagesConcurrently(imageEntries: ImageEntry[]): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const maxConcurrency = this.config.get("maxConcurrency") || 3;
    const enableBatching = this.config.get("enableBatching") ?? true;
    const batchSize = this.config.get("batchSize") || maxConcurrency;
    const delayBetweenBatches = this.config.get("delayBetweenBatches") || 1000;

    console.log(
      chalk.blue(
        `🚀 Starting concurrent downloads: ${imageEntries.length} images ` +
        `(concurrency: ${maxConcurrency}, batching: ${enableBatching ? 'enabled' : 'disabled'})`
      )
    );

    if (!enableBatching) {
      // Process all at once with concurrency limit
      return await this.processBatch(imageEntries, 0, imageEntries.length);
    }

    // Process in batches
    for (let i = 0; i < imageEntries.length; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, imageEntries.length);
      const batch = imageEntries.slice(i, batchEnd);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(imageEntries.length / batchSize);

      console.log(
        chalk.blue(
          `📦 Processing batch ${batchNumber}/${totalBatches} ` +
          `(${batch.length} items, ${i + 1}-${batchEnd})`
        )
      );

      const batchResults = await this.processBatch(batch, i, batchEnd);
      results.push(...batchResults);

      // Add delay between batches (except for the last batch)
      if (batchEnd < imageEntries.length && delayBetweenBatches > 0) {
        console.log(
          chalk.gray(`⏱️  Waiting ${delayBetweenBatches}ms before next batch...`)
        );
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  /**
   * Process a batch of downloads concurrently.
   * 
   * @param batch - Array of image entries to process in this batch
   * @param startIndex - Starting index for progress display
   * @param endIndex - Ending index for progress display
   * @returns Array of download results for this batch
   * @private
   */
  private async processBatch(
    batch: ImageEntry[],
    startIndex: number,
    endIndex: number
  ): Promise<DownloadResult[]> {
    const maxConcurrency = this.config.get("maxConcurrency") || 3;
    const concurrency = Math.min(batch.length, maxConcurrency);

    // Create a semaphore to limit concurrency
    const semaphore = new Semaphore(concurrency);
    
    // Process all items in the batch concurrently
    const promises = batch.map((entry, batchIndex) =>
      semaphore.acquire(() =>
        this.downloadSingleImage(entry, startIndex + batchIndex + 1, endIndex)
      )
    );

    return await Promise.all(promises);
  }

  /**
   * Download a single image using a browser context from the pool.
   * 
   * @param entry - Image entry to download [photoId, imageData]
   * @param currentIndex - Current image index for progress display
   * @param totalCount - Total number of images for progress display
   * @returns Download result
   * @private
   */
  private async downloadSingleImage(
    entry: ImageEntry,
    currentIndex: number,
    totalCount: number
  ): Promise<DownloadResult> {
    const [photoId, imageData] = entry;
    let context: BrowserContext | null = null;

    try {
      // Get a context from the pool
      context = await this.browserPool.getContext();

      console.log(
        chalk.blue(
          `📥 [${currentIndex}/${totalCount}] Processing: ${photoId}`
        )
      );

      // Use the context to download the image
      const result = await this.downloadImageWithContext(context, photoId, imageData);

      if (result.success && !result.skipped) {
        this.stats.incrementDownloaded();
        console.log(
          chalk.green(
            `   ✅ Downloaded: ${result.filename} (${this.formatFileSize(result.size || 0)})`
          )
        );
      } else if (result.skipped) {
        this.stats.incrementSkipped();
        console.log(
          chalk.gray(
            `   ⏭️  Skipped: ${photoId} (already exists)`
          )
        );
      } else {
        this.stats.incrementFailed();
        console.log(
          chalk.red(
            `   ❌ Failed: ${photoId} - ${result.error}`
          )
        );
      }

      return result;

    } catch (error) {
      this.stats.incrementFailed();
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      console.log(
        chalk.red(
          `   ❌ Failed: ${photoId} - ${errorMessage}`
        )
      );

      return {
        success: false,
        photoId,
        error: errorMessage,
        author: imageData.image_author || '',
      };

    } finally {
      // Always release the context back to the pool
      if (context) {
        try {
          await this.browserPool.releaseContext(context);
        } catch (error) {
          console.warn(
            chalk.yellow(`⚠️  Failed to release context: ${(error as Error).message}`)
          );
        }
      }
    }
  }

  /**
   * Download an image using a specific browser context.
   * Core download logic that handles the actual image downloading.
   * 
   * @param context - Browser context to use for downloading
   * @param photoId - VSCO photo identifier
   * @param imageData - Image metadata from manifest
   * @returns Download result
   * @private
   */
  private async downloadImageWithContext(
    context: BrowserContext,
    photoId: string,
    imageData: ImageData
  ): Promise<DownloadResult> {
    const retries = this.config.get("retries") || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.attemptDownloadWithContext(context, photoId, imageData, attempt);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(
            chalk.yellow(
              `   ⚠️  Attempt ${attempt} failed for ${photoId}, retrying in ${delay / 1000}s...`
            )
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      photoId,
      error: lastError?.message || "Unknown error after all retries",
      author: imageData.image_author || '',
    };
  }

  /**
   * Attempt to download an image (single try) using a specific context.
   * 
   * @param context - Browser context to use
   * @param photoId - VSCO photo identifier
   * @param imageData - Image metadata
   * @param attempt - Current attempt number
   * @returns Download result
   * @throws {Error} When download fails
   * @private
   */
  private async attemptDownloadWithContext(
    context: BrowserContext,
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
      return {
        success: true,
        photoId,
        filepath: existingFile.filepath!,
        filename: basename(existingFile.filepath!),
        size: existingFile.size ?? 0,
        skipped: true,
        author: imageData.image_author || '',
      };
    }

    // Handle dry run mode
    if (this.config.get("dryRun")) {
      return {
        success: true,
        photoId,
        dryRun: true,
        author: imageData.image_author || '',
      };
    }

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

    // Create a new page in this context
    const page = await context.newPage();
    
    try {
      // Extract comprehensive metadata from VSCO page
      const vscoMetadata = await this.extractVscoImageMetadata(page, vscoImageUrl, username || '');
      
      // Download the image using the direct URL
      const downloadResult = await this.downloadFromDirectUrl(
        page,
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

      return downloadResult;

    } finally {
      try {
        await page.close();
      } catch (error) {
        if (this.config.get("debug")) {
          console.log(chalk.gray(`Could not close page: ${(error as Error).message}`));
        }
      }
    }
  }

  /**
   * Navigate to VSCO image page and extract comprehensive metadata.
   * 
   * @param page - Playwright page instance
   * @param imageUrl - VSCO image page URL
   * @param username - VSCO username
   * @returns Object with direct image URL and metadata
   * @private
   */
  private async extractVscoImageMetadata(page: any, imageUrl: string, username: string): Promise<{
    directImageUrl: string;
    uploadDate?: string;
    availableSizes?: string[];
    srcset?: string;
    originalWidth?: number;
    originalHeight?: number;
  }> {
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
            const matches = content.match(/https:\/\/[^\"'\\s]*\.(?:jpg|jpeg|png|webp)/gi);
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
              const match = entry.match(/(\\d+)w$/);
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
   * Download image from a direct URL using a specific page.
   * 
   * @param page - Playwright page instance
   * @param imageUrl - Direct image URL
   * @param photoId - Photo identifier for filename
   * @param metadata - Combined metadata from manifest and extraction
   * @returns Download result
   * @private
   */
  private async downloadFromDirectUrl(
    page: any,
    imageUrl: string,
    photoId: string,
    metadata: any
  ): Promise<DownloadResult> {
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
}

/**
 * Simple semaphore implementation for controlling concurrency.
 * Limits the number of concurrent operations to a specified maximum.
 */
class Semaphore {
  private readonly maxConcurrent: number;
  private currentCount = 0;
  private readonly queue: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Acquire a slot in the semaphore and execute the provided function.
   * 
   * @param fn - Function to execute when a slot is available
   * @returns Promise resolving to the result of the function
   */
  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.currentCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.currentCount--;
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
          }
        }
      };

      if (this.currentCount < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }
}
