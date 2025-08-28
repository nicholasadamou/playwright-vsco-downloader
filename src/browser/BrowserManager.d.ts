import type { Page, Response, Download } from "playwright";
import type { Config } from "../config/Config.js";
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
export declare class BrowserManager {
    private readonly config;
    private browser;
    private context;
    private page;
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
    constructor(config: Config);
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
    initialize(): Promise<void>;
    /**
     * Set up request interception to block unnecessary resources for faster page loads.
     * Blocks fonts, stylesheets, and non-VSCO scripts to optimize performance
     * during image downloading operations.
     *
     * @returns {Promise<void>}
     * @throws {Error} When route setup fails
     * @private
     */
    private setupRequestInterception;
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
    getPage(): Promise<Page>;
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
    navigateToUrl(url: string, options?: Record<string, any>): Promise<Response | null>;
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
    takeDebugScreenshot(filePath: string, options?: Record<string, any>): Promise<string | null>;
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
    waitForDownload(timeout: number): Promise<Download>;
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
    cleanup(): Promise<void>;
}
