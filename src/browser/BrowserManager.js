"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
const playwright_1 = require("playwright");
const chalk_1 = __importDefault(require("chalk"));
/**
 * @fileoverview Browser manager class responsible for browser lifecycle management.
 * Provides a clean interface for Playwright browser operations including initialization,
 * navigation, screenshot capture, and resource cleanup.
 *
 * Key Features:
 * - Browser and context lifecycle management
 * - Request interception for performance optimization
 * - Debug screenshot capabilities
 * - Download event handling
 * - Graceful resource cleanup
 *
 * @example
 * ```javascript
 * const config = new Config({ headless: false, debug: true });
 * const browserManager = new BrowserManager(config);
 *
 * await browserManager.initialize();
 * await browserManager.navigateToUrl('https://example.com');
 * const page = await browserManager.getPage();
 * await browserManager.cleanup();
 * ```
 */
/**
 * Browser manager class responsible for browser lifecycle management.
 * Follows the Single Responsibility Principle by handling only browser-related operations.
 * Encapsulates all Playwright interactions and provides a clean, typed interface.
 */
class BrowserManager {
    /**
     * Create a new browser manager instance.
     *
     * @param config - Configuration instance
     * @example
     * ```typescript
     * const config = new Config({ headless: false, debug: true });
     * const browserManager = new BrowserManager(config);
     * ```
     */
    constructor(config) {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.config = config;
    }
    /**
     * Initialize browser and context with configuration options.
     * Launches a Chromium browser instance, creates a context with viewport and timeout settings,
     * and sets up request interception for performance optimization.
     *
     * @returns {Promise<void>}
     * @throws {Error} When browser launch or context creation fails
     * @example
     * ```javascript
     * const browserManager = new BrowserManager(config);
     * await browserManager.initialize();
     * console.log(browserManager.isInitialized()); // true
     * ```
     */
    async initialize() {
        console.log(chalk_1.default.blue("🚀 Initializing browser..."));
        this.browser = await playwright_1.chromium.launch(this.config.getBrowserConfig());
        this.context = await this.browser.newContext(this.config.getContextConfig());
        // Temporarily disable request interception for debugging
        // await this.setupRequestInterception();
        console.log(chalk_1.default.green("✅ Browser initialized"));
    }
    /**
     * Set up request interception to block unnecessary resources for faster page loads.
     * Blocks fonts, stylesheets, and non-VSCO scripts to optimize performance
     * during image downloading operations.
     *
     * @returns {Promise<void>}
     * @throws {Error} When route setup fails
     * @private
     */
    async setupRequestInterception() {
        if (!this.context) {
            throw new Error("Browser context not initialized.");
        }
        await this.context.route("**/*", async (route) => {
            const request = route.request();
            const url = request.url();
            // Block unnecessary resources to speed up page loads, but be more permissive for VSCO
            if (request.resourceType() === "font" ||
                // Allow VSCO stylesheets but block others
                (request.resourceType() === "stylesheet" && !url.includes("vsco")) ||
                // Block third-party scripts but allow VSCO and essential scripts
                (request.resourceType() === "script" &&
                    !url.includes("vsco") &&
                    !url.includes("analytics") &&
                    !url.includes("google") &&
                    !url.includes("cdn"))) {
                await route.abort();
            }
            else {
                await route.continue();
            }
        });
    }
    /**
     * Get or create a page instance. Creates a new page if none exists,
     * otherwise returns the existing page instance.
     *
     * @returns {Promise<Page>} The current or newly created page instance
     * @throws {Error} When browser context is not initialized
     * @example
     * ```javascript
     * await browserManager.initialize();
     * const page = await browserManager.getPage();
     * await page.goto('https://example.com');
     * ```
     */
    async getPage() {
        if (!this.page) {
            if (!this.context) {
                throw new Error("Browser context not initialized. Call initialize() first.");
            }
            this.page = await this.context.newPage();
        }
        return this.page;
    }
    /**
     * Navigate to a URL and wait for the page to load.
     * Uses "networkidle" wait strategy by default and applies configured timeout.
     *
     * @param url - The target URL to navigate to
     * @param options - Additional navigation options
     * @returns The navigation response or null if navigation failed
     * @throws {Error} When navigation times out or fails
     * @example
     * ```javascript
     * await browserManager.initialize();
     * const response = await browserManager.navigateToUrl('https://unsplash.com/photos/abc123');
     * console.log(response.status()); // 200
     * ```
     */
    async navigateToUrl(url, options = {}) {
        const page = await this.getPage();
        const timeout = this.config.get("timeout");
        return await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: timeout || 30000,
            ...options,
        });
    }
    /**
     * Take a screenshot for debugging purposes when debug mode is enabled.
     * Only captures screenshots if the configuration has debug mode enabled,
     * otherwise returns null silently.
     *
     * @param filePath - Absolute path where the screenshot will be saved
     * @param options - Screenshot options (fullPage enabled by default)
     * @returns Saved file path when debug mode is on, otherwise null
     * @example
     * ```javascript
     * // Only works when debugged: true in config
     * const path = await browserManager.takeDebugScreenshot('/tmp/debug-screenshot.png');
     * if (path) {
     *   console.log('Screenshot saved to:', path);
     * }
     * ```
     */
    async takeDebugScreenshot(filePath, options = {}) {
        if (!this.config.get("debug")) {
            return null;
        }
        try {
            const page = await this.getPage();
            await page.screenshot({
                path: filePath,
                fullPage: true,
                ...options,
            });
            return filePath;
        }
        catch (error) {
            console.log(chalk_1.default.gray(`Could not save debug screenshot: ${error.message}`));
            return null;
        }
    }
    /**
     * Wait for a download event to occur on the current page.
     * Used by download operations to capture download streams.
     *
     * @param timeout - Maximum time to wait in milliseconds
     * @returns Promise that resolves when download starts
     * @throws {Error} When timeout is exceeded or page is not available
     * @example
     * ```javascript
     * // Set up download listener before clicking the download button
     * const downloadPromise = browserManager.waitForDownload(30000);
     * await page.click('[data-download-button]');
     * const download = await downloadPromise;
     * ```
     */
    async waitForDownload(timeout) {
        const page = await this.getPage();
        return await page.waitForEvent("download", { timeout });
    }
    /**
     * Clean up all browser resources in proper order.
     * Closes page, context, and browser instances gracefully.
     * Should always be called when done with browser operations.
     *
     * @returns {Promise<void>}
     * @example
     * ```javascript
     * try {
     *   await browserManager.initialize();
     *   // ... perform operations
     * } finally {
     *   await browserManager.cleanup();
     * }
     * ```
     */
    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.context) {
                await this.context.close();
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`Warning during cleanup: ${error.message}`));
        }
    }
}
exports.BrowserManager = BrowserManager;
