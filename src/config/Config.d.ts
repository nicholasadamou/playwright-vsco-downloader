import type { ConfigOptions, BrowserConfiguration, ContextConfiguration, AuthCredentials } from "../types";
/**
 * @fileoverview Centralized configuration manager for the Playwright Image Downloader.
 * Validates user-provided options, applies defaults, and exposes typed accessors
 * used by browser, download, and manifest services.
 *
 * Responsibilities:
 * - Merge options with sane defaults
 * - Validate shape and types of configuration
 * - Provide derived configs for browser/context
 *
 * @example
 * ```typescript
 * const config = new Config({
 *   headless: false,
 *   debug: true,
 *   timeout: 45000
 * });
 * console.log(config.get('timeout')); // 45000
 * ```
 */
/**
 * Centralized configuration manager that validates, normalizes, and provides
 * typed access to configuration options used throughout the application.
 */
export declare class Config {
    private readonly options;
    /**
     * Create a new configuration instance.
     *
     * @param options - Configuration options to merge with defaults
     * @throws {Error} When validation fails for any provided option
     * @example
     * ```typescript
     * // Create with defaults
     * const config = new Config();
     *
     * // Create with custom options
     * const config = new Config({
     *   headless: false,
     *   debug: true,
     *   timeout: 45000,
     * });
     * ```
     */
    constructor(options?: ConfigOptions);
    /**
     * Validate and merge provided options with defaults. Sets up default paths
     * using smart path resolution and validates all configuration values.
     *
     * @param options - User-provided configuration options
     * @returns Validated and merged configuration object
     * @throws {Error} When any configuration value fails validation
     */
    private validateAndSetDefaults;
    /**
     * Get smart download directory with simple path resolution.
     * Resolves download directory relative to provided options or uses intelligent defaults.
     *
     * @param options - User-provided options that may contain custom download directory
     * @returns Resolved download directory path
     */
    private getSmartDownloadDir;
    /**
     * Get smart manifest path with environment variable support and path resolution.
     * Checks environment variable first, then falls back to intelligent path searching.
     *
     * @param options - User-provided options that may contain custom manifest path
     * @returns Resolved manifest path
     */
    private getSmartManifestPath;
    /**
     * Synchronous fallback for manifest path resolution.
     * Used during config initialization when async operations aren't available.
     *
     * @returns string - Resolved manifest path
     */
    private getManifestPathSync;
    /**
     * Validate all configuration values against expected types and ranges.
     * Ensures timeout and retries are positive numbers and boolean flags are properly typed.
     *
     * @param config - Configuration object to validate
     * @throws {Error} When any validation rule fails
     */
    private validateConfig;
    /**
     * Get a configuration value by its key.
     *
     * @param key - The configuration key to retrieve
     * @returns The value associated with the key
     * @example
     * ```typescript
     * const config = new Config({ timeout: 45000 });
     * console.log(config.get('timeout')); // 45000
     * console.log(config.get('headless')); // true (default)
     * ```
     */
    get<K extends keyof ConfigOptions>(key: K): ConfigOptions[K];
    /**
     * Get a copy of all configuration options.
     * Returns a shallow copy to prevent external modification.
     *
     * @returns Complete configuration object
     * @example
     * ```typescript
     * const config = new Config({ debug: true });
     * const allOptions = config.getAll();
     * console.log(allOptions.debug); // true
     * ```
     */
    getAll(): ConfigOptions;
    /**
     * Get a browser-specific configuration for Playwright browser launch.
     * Maps debug an option to devtools and include headless setting.
     *
     * @returns Browser launch options
     * @example
     * ```typescript
     * const config = new Config({ headless: false, debug: true });
     * const browserConfig = config.getBrowserConfig();
     * // { headless: false, devtools: true }
     * ```
     */
    getBrowserConfig(): BrowserConfiguration;
    /**
     * Get browser context configuration for Playwright context creation.
     * Includes viewport size, timeouts, and user agent settings.
     *
     * @returns Browser context options
     * @example
     * ```typescript
     * const config = new Config({ timeout: 60000 });
     * const contextConfig = config.getContextConfig();
     * // { navigationTimeout: 60000, actionTimeout: 30000, ... }
     * ```
     */
    getContextConfig(): ContextConfiguration;
    /**
     * Get authentication credentials from environment variables.
     * Reads VSCO_EMAIL and VSCO_PASSWORD from process.env.
     *
     * @returns Email and password from environment
     * @example
     * ```typescript
     * // Assuming environment variables are set
     * const config = new Config();
     * const creds = config.getAuthCredentials();
     * // { email: "user@example.com", password: "secret" }
     * ```
     */
    getAuthCredentials(): AuthCredentials;
    /**
     * Check if both email and password credentials are available in environment.
     * Used to determine if automatic login can be attempted.
     *
     * @returns true if both email and password are set
     * @example
     * ```typescript
     * const config = new Config();
     * if (config.hasAuthCredentials()) {
     *   console.log("Auto-login available");
     * } else {
     *   console.log("Manual login required");
     * }
     * ```
     */
    hasAuthCredentials(): boolean;
}
