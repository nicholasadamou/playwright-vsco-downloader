import chalk from "chalk";
import dotenv from "dotenv";
import type {
  ConfigOptions,
  DownloadResult,
  LocalManifestResult,
  DownloadSummary,
  ImageEntry,
  ManifestFile,
} from "./types";
import { Config } from "./config/Config.js";
import { BrowserManager } from "./browser/BrowserManager.js";
import { AuthenticationService } from "./auth/AuthenticationService.js";
import { StatsTracker } from "./stats/StatsTracker.js";
import { FileSystemService } from "./fs/FileSystemService.js";
import { DownloadService } from "./download/DownloadService.js";
import { VscoProfileScraper } from "./profile/VscoProfileScraper.js";

// Load environment variables
dotenv.config();

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
  stats: { total: number; downloaded: number; failed: number; skipped: number };
}

/**
 * Main orchestrator class that coordinates all services to handle the complete
 * Playwright image download process. Manages the workflow from initialization
 * through authentication, manifest processing, downloads, and reporting.
 */
export class PlaywrightImageDownloader {
  private readonly config: Config;
  private readonly browserManager: BrowserManager;
  private readonly authService: AuthenticationService;
  private readonly statsTracker: StatsTracker;
  private readonly fileSystemService: FileSystemService;
  private readonly profileScraper: VscoProfileScraper;
  private readonly downloadService: DownloadService;

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
  constructor(options: ConfigOptions = {}) {
    // Initialize configuration
    this.config = new Config(options);

    // Initialize services with dependency injection
    this.browserManager = new BrowserManager(this.config);

    this.authService = new AuthenticationService(
      this.config,
      this.browserManager
    );

    this.statsTracker = new StatsTracker();

    this.fileSystemService = new FileSystemService(this.config);

    this.profileScraper = new VscoProfileScraper(
      this.config,
      this.browserManager
    );

    this.downloadService = new DownloadService(
      this.config,
      this.browserManager,
      this.fileSystemService,
      this.statsTracker
    );
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    console.log(chalk.blue("🚀 Initializing VSCO Image Downloader..."));

    await this.browserManager.initialize();
    console.log(chalk.green("✅ All services initialized"));
  }

  /**
   * Handle authentication workflow
   * @returns true if authenticated in this session
   */
  async handleAuthentication(): Promise<boolean> {
    console.log(chalk.blue("\n🔐 Authentication Step:"));
    const loginSuccessful = await this.authService.attemptLogin();

    if (!loginSuccessful) {
      console.log(
        chalk.yellow(
          "⚠️  Continuing without authentication - some downloads may fail"
        )
      );
    }

    return loginSuccessful;
  }

  /**
   * Scrape VSCO profile and get image entries
   */
  async scrapeProfileAndGetImages(): Promise<{
    imageEntries: ImageEntry[];
    profileData: any;
  } | null> {
    const username = this.config.get("username");
    if (!username) {
      throw new Error("Username is required for profile scraping");
    }

    console.log(chalk.blue("🔍 Starting profile scraping..."));
    
    // Get the limit from config
    const limit = this.config.get("limit") || 0;
    
    // Scrape the profile
    const profileResult = await this.profileScraper.scrapeProfile(username, limit);
    
    if (!profileResult || profileResult.images.length === 0) {
      console.log(chalk.yellow("⚠️  No images found in profile"));
      return null;
    }

    // Convert to image entries
    const imageEntries = this.profileScraper.getImageEntries(profileResult);
    
    // Set up statistics
    this.statsTracker.setTotal(imageEntries.length);

    console.log(chalk.green(`✅ Found ${imageEntries.length} images from @${username}`));
    
    return { imageEntries, profileData: profileResult };
  }

  /**
   * Display configuration summary
   */
  displayConfiguration(): void {
    this.statsTracker.displayConfiguration(this.config);
  }

  /**
   * Execute the download workflow
   * @param imageEntries Entries to download
   */
  async executeDownloads(
    imageEntries: ImageEntry[]
  ): Promise<DownloadResult[]> {
    const results = await this.downloadService.downloadImages(imageEntries);
    return results;
  }


  /**
   * Run the complete download process
   */
  async run(): Promise<DownloadRunResult | void> {
    try {
      // Initialize services
      await this.initialize();

      // Display configuration
      this.displayConfiguration();

      // Handle authentication first (before scraping)
      const loginSuccessful = await this.handleAuthentication();

      // Scrape VSCO profile and get images
      const profileData = await this.scrapeProfileAndGetImages();
      if (!profileData) {
        return;
      }

      const { imageEntries, profileData: profile } = profileData;

      // Execute downloads
      const results = await this.executeDownloads(imageEntries);

      // Generate comprehensive VSCO manifest
      let manifestResult = null;
      try {
        console.log(chalk.blue("\n📝 Generating VSCO manifest..."));
        manifestResult = await this.fileSystemService.createVscoManifest(
          results,
          profile,
          this.statsTracker
        );
      } catch (error) {
        console.warn(
          chalk.yellow("⚠️  Warning: Failed to create VSCO manifest:"),
          (error as Error).message
        );
      }

      // Generate simple reports
      const totalStorage = this.fileSystemService.calculateTotalStorage(results);
      const summary = this.downloadService.getDownloadSummary(results);

      // Display final results
      this.statsTracker.displayResults(totalStorage);

      // Display failed items if any
      if (summary.failedResults.length > 0) {
        this.statsTracker.displayFailedItems(summary.failedResults);
      }

      // Display completion message
      this.statsTracker.displayCompletion();

      return {
        results,
        localManifest: manifestResult?.localManifest || null,
        localManifestPath: manifestResult?.localManifestPath || '',
        totalStorage,
        summary,
        loginSuccessful,
        stats: this.statsTracker.getStats(),
      };
    } catch (error) {
      console.error(chalk.red("❌ Fatal error:"), (error as Error).message);
      if (this.config.get("debug")) {
        console.error((error as Error).stack);
      }
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.browserManager.cleanup();
      console.log(chalk.gray("🧹 Cleanup completed"));
    } catch (error) {
      console.log(
        chalk.yellow(`Warning during cleanup: ${(error as Error).message}`)
      );
    }
  }

  /**
   * Get current configuration
   * @returns {object} Plain object of configuration values
   */
  getConfig() {
    return this.config.getAll();
  }

  /**
   * Get current statistics
   * @returns {{total:number, downloaded:number, failed:number, skipped:number}}
   */
  getStats() {
    return this.statsTracker.getStats();
  }

  /**
   * Check if authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.authService.isAuthenticated();
  }

  /**
   * Reset authentication state (useful for testing)
   * @returns {void}
   */
  resetAuthentication() {
    this.authService.reset();
  }

  /**
   * Reset statistics (useful for multiple runs)
   * @returns {void}
   */
  resetStats() {
    this.statsTracker.reset();
  }

  /**
   * Get browser manager (for advanced use cases)
   * @returns {BrowserManager}
   */
  getBrowserManager() {
    return this.browserManager;
  }


  /**
   * Get download service (for advanced use cases)
   * @returns {DownloadService}
   */
  getDownloadService() {
    return this.downloadService;
  }
}
