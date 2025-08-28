"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightImageDownloader = void 0;
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = __importDefault(require("dotenv"));
const Config_js_1 = require("./config/Config.js");
const BrowserManager_js_1 = require("./browser/BrowserManager.js");
const AuthenticationService_js_1 = require("./auth/AuthenticationService.js");
const StatsTracker_js_1 = require("./stats/StatsTracker.js");
const FileSystemService_js_1 = require("./fs/FileSystemService.js");
const DownloadService_js_1 = require("./download/DownloadService.js");
const VscoProfileScraper_js_1 = require("./profile/VscoProfileScraper.js");
// Load environment variables
dotenv_1.default.config();
/**
 * Main orchestrator class that coordinates all services to handle the complete
 * Playwright image download process. Manages the workflow from initialization
 * through authentication, manifest processing, downloads, and reporting.
 */
class PlaywrightImageDownloader {
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
    constructor(options = {}) {
        // Initialize configuration
        this.config = new Config_js_1.Config(options);
        // Initialize services with dependency injection
        this.browserManager = new BrowserManager_js_1.BrowserManager(this.config);
        this.authService = new AuthenticationService_js_1.AuthenticationService(this.config, this.browserManager);
        this.statsTracker = new StatsTracker_js_1.StatsTracker();
        this.fileSystemService = new FileSystemService_js_1.FileSystemService(this.config);
        this.profileScraper = new VscoProfileScraper_js_1.VscoProfileScraper(this.config, this.browserManager);
        this.downloadService = new DownloadService_js_1.DownloadService(this.config, this.browserManager, this.fileSystemService, this.statsTracker);
    }
    /**
     * Initialize all services
     */
    async initialize() {
        console.log(chalk_1.default.blue("🚀 Initializing VSCO Image Downloader..."));
        await this.browserManager.initialize();
        console.log(chalk_1.default.green("✅ All services initialized"));
    }
    /**
     * Handle authentication workflow
     * @returns true if authenticated in this session
     */
    async handleAuthentication() {
        console.log(chalk_1.default.blue("\n🔐 Authentication Step:"));
        const loginSuccessful = await this.authService.attemptLogin();
        if (!loginSuccessful) {
            console.log(chalk_1.default.yellow("⚠️  Continuing without authentication - some downloads may fail"));
        }
        return loginSuccessful;
    }
    /**
     * Scrape VSCO profile and get image entries
     */
    async scrapeProfileAndGetImages() {
        const username = this.config.get("username");
        if (!username) {
            throw new Error("Username is required for profile scraping");
        }
        console.log(chalk_1.default.blue("🔍 Starting profile scraping..."));
        // Get the limit from config
        const limit = this.config.get("limit") || 0;
        // Scrape the profile
        const profileResult = await this.profileScraper.scrapeProfile(username, limit);
        if (!profileResult || profileResult.images.length === 0) {
            console.log(chalk_1.default.yellow("⚠️  No images found in profile"));
            return null;
        }
        // Convert to image entries
        const imageEntries = this.profileScraper.getImageEntries(profileResult);
        // Set up statistics
        this.statsTracker.setTotal(imageEntries.length);
        console.log(chalk_1.default.green(`✅ Found ${imageEntries.length} images from @${username}`));
        return { imageEntries, profileData: profileResult };
    }
    /**
     * Display configuration summary
     */
    displayConfiguration() {
        this.statsTracker.displayConfiguration(this.config);
    }
    /**
     * Execute the download workflow
     * @param imageEntries Entries to download
     */
    async executeDownloads(imageEntries) {
        const results = await this.downloadService.downloadImages(imageEntries);
        return results;
    }
    /**
     * Run the complete download process
     */
    async run() {
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
            // Generate simple reports (without manifest dependencies)
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
                localManifest: null, // No manifest in profile scraping mode
                localManifestPath: '', // No manifest path
                totalStorage,
                summary,
                loginSuccessful,
                stats: this.statsTracker.getStats(),
            };
        }
        catch (error) {
            console.error(chalk_1.default.red("❌ Fatal error:"), error.message);
            if (this.config.get("debug")) {
                console.error(error.stack);
            }
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
    /**
     * Cleanup all resources
     */
    async cleanup() {
        try {
            await this.browserManager.cleanup();
            console.log(chalk_1.default.gray("🧹 Cleanup completed"));
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`Warning during cleanup: ${error.message}`));
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
exports.PlaywrightImageDownloader = PlaywrightImageDownloader;
