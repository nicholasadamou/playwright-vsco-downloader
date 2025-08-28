import type { ConfigOptions, DownloadResult, DownloadSummary, ImageEntry } from "./types";
import { BrowserManager } from "./browser/BrowserManager.js";
import { DownloadService } from "./download/DownloadService.js";
/**
 * @fileoverview Main orchestrator class that coordinates all services to handle the complete
 * VSCO image download process. Manages the workflow from initialization
 * through authentication, manifest processing, downloads, and reporting.
 *
 * Key Features:
 * - Service orchestration with dependency injection
 * - Complete VSCO download workflow management
 * - Error handling and graceful cleanup
 * - Progress tracking and reporting
 * - VSCO authentication management
 * - Configurable operation modes
 *
 * Workflow:
 * 1. Initialize all services
 * 2. Handle VSCO authentication (if credentials provided)
 * 3. Scrape VSCO profile and extract images
 * 4. Execute downloads with progress tracking
 * 5. Generate reports and display results
 * 6. Display completion status
 *
 * @example
 * ```javascript
 * const downloader = new PlaywrightVscoDownloader({
 *   headless: false,
 *   debug: true,
 *   timeout: 45000,
 * });
 *
 * try {
 *   const result = await downloader.run();
 *   console.log('Downloaded:', result.stats.downloaded, 'images');
 *   console.log('Local manifest:', result.localManifestPath);
 * } finally {
 *   await downloader.cleanup();
 * }
 * ```
 */
/**
 * Return type for the run method
 */
export interface DownloadRunResult {
    results: DownloadResult[];
    localManifest: any;
    localManifestPath: string;
    totalStorage: number;
    summary: DownloadSummary;
    loginSuccessful: boolean;
    stats: {
        total: number;
        downloaded: number;
        failed: number;
        skipped: number;
    };
}
/**
 * Main orchestrator class that coordinates all services to handle the complete
 * Playwright image download process. Manages the workflow from initialization
 * through authentication, manifest processing, downloads, and reporting.
 */
export declare class PlaywrightImageDownloader {
    private readonly config;
    private readonly browserManager;
    private readonly authService;
    private readonly statsTracker;
    private readonly fileSystemService;
    private readonly profileScraper;
    private readonly downloadService;
    /**
     * Create a new Playwright Image Downloader instance.
     * Initializes all services with a dependency injection pattern.
     *
     * @param options - Configuration options
     * @throws {Error} When configuration validation fails
     * @example
     * ```typescript
     * // Create with default
     * const downloader = new PlaywrightImageDownloader();
     *
     * // Create with custom options
     * const downloader = new PlaywrightImageDownloader({
     *   headless: false,
     *   debug: true,
     *   timeout: 60000,
     *   retries: 5,
     *   limit: 50,
     *   dryRun: true
     * });
     * ```
     */
    constructor(options?: ConfigOptions);
    /**
     * Initialize all services
     */
    initialize(): Promise<void>;
    /**
     * Handle authentication workflow
     * @returns true if authenticated in this session
     */
    handleAuthentication(): Promise<boolean>;
    /**
     * Scrape VSCO profile and get image entries
     */
    scrapeProfileAndGetImages(): Promise<{
        imageEntries: ImageEntry[];
        profileData: any;
    } | null>;
    /**
     * Display configuration summary
     */
    displayConfiguration(): void;
    /**
     * Execute the download workflow
     * @param imageEntries Entries to download
     */
    executeDownloads(imageEntries: ImageEntry[]): Promise<DownloadResult[]>;
    /**
     * Run the complete download process
     */
    run(): Promise<DownloadRunResult | void>;
    /**
     * Cleanup all resources
     */
    cleanup(): Promise<void>;
    /**
     * Get current configuration
     * @returns {object} Plain object of configuration values
     */
    getConfig(): ConfigOptions;
    /**
     * Get current statistics
     * @returns {{total:number, downloaded:number, failed:number, skipped:number}}
     */
    getStats(): import("./types").StatsData;
    /**
     * Check if authenticated
     * @returns {boolean}
     */
    isAuthenticated(): boolean;
    /**
     * Reset authentication state (useful for testing)
     * @returns {void}
     */
    resetAuthentication(): void;
    /**
     * Reset statistics (useful for multiple runs)
     * @returns {void}
     */
    resetStats(): void;
    /**
     * Get browser manager (for advanced use cases)
     * @returns {BrowserManager}
     */
    getBrowserManager(): BrowserManager;
    /**
     * Get download service (for advanced use cases)
     * @returns {DownloadService}
     */
    getDownloadService(): DownloadService;
}
