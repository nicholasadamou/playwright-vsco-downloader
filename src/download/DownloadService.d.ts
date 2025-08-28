import type { Config } from "../config/Config.js";
import type { BrowserManager } from "../browser/BrowserManager.js";
import type { FileSystemService } from "../fs/FileSystemService.js";
import type { StatsTracker } from "../stats/StatsTracker.js";
import type { ImageData, DownloadResult, ImageEntry, DownloadSummary } from "../types";
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
export declare class DownloadService {
    private readonly config;
    private readonly browser;
    private readonly fs;
    private readonly stats;
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
    constructor(config: Config, browserManager: BrowserManager, fileSystemService: FileSystemService, statsTracker: StatsTracker);
    /**
     * Navigate to VSCO image page and extract download URL.
     * Since VSCO doesn't provide direct download links, we need to navigate
     * to the image page and extract the actual image URL.
     *
     * @param imageUrl - VSCO image page URL
     * @param username - VSCO username
     * @returns Direct image URL for downloading
     * @throws {Error} When image URL cannot be extracted
     * @example
     * ```javascript
     * const directUrl = await downloadService.extractVscoImageUrl('https://vsco.co/user/gallery/12345', 'user');
     * console.log('Direct image URL:', directUrl);
     * ```
     */
    extractVscoImageUrl(imageUrl: string, username: string): Promise<string>;
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
    downloadImage(photoId: string, imageData: ImageData): Promise<DownloadResult>;
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
    private attemptDownload;
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
    private downloadFromDirectUrl;
    /**
     * Format file size in human-readable format.
     *
     * @param bytes - File size in bytes
     * @returns Formatted file size string
     * @private
     */
    private formatFileSize;
    /**
     * Process multiple images with concurrency control.
     * Orchestrates the download of multiple images while respecting rate limits.
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
    downloadImages(imageEntries: ImageEntry[]): Promise<DownloadResult[]>;
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
    getDownloadSummary(results: DownloadResult[]): DownloadSummary;
}
