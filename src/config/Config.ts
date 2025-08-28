import path from "path";
import fs from "fs-extra";
import type {
  ConfigOptions,
  BrowserConfiguration,
  ContextConfiguration,
  AuthCredentials,
} from "../types";

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
export class Config {
  private readonly options: ConfigOptions;

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
  constructor(options: ConfigOptions = {}) {
    this.options = this.validateAndSetDefaults(options);
  }

  /**
   * Validate and merge provided options with defaults. Sets up default paths
   * using smart path resolution and validates all configuration values.
   *
   * @param options - User-provided configuration options
   * @returns Validated and merged configuration object
   * @throws {Error} When any configuration value fails validation
   */
  private validateAndSetDefaults(options: ConfigOptions): ConfigOptions {
    // Use smart path resolution for defaults instead of hardcoded paths
    const smartDownloadDir = this.getSmartDownloadDir(options);
    const smartManifestPath = this.getSmartManifestPath(options);
    
    const defaults = {
      headless: true,
      debug: false,
      downloadDir: smartDownloadDir,
      manifestPath: smartManifestPath,
      timeout: 30000,
      retries: 3,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      dryRun: false,
    } satisfies Required<Omit<ConfigOptions, "limit" | "username">>;

    const config: ConfigOptions = {
      ...defaults,
      ...options,
    };

    this.validateConfig(config);
    return config;
  }

  /**
   * Get smart download directory with simple path resolution.
   * Resolves download directory relative to provided options or uses intelligent defaults.
   * 
   * @param options - User-provided options that may contain custom download directory
   * @returns Resolved download directory path
   */
  private getSmartDownloadDir(options: ConfigOptions): string {
    // If user provided download directory, resolve it
    if (options.downloadDir) {
      return path.resolve(options.downloadDir);
    }

    // Try common download directories
    const workingDir = process.cwd();
    const commonDownloadDirs = [
      path.resolve(workingDir, "public", "images", "vsco"),
      path.resolve(workingDir, "downloads", "vsco"),
      path.resolve(workingDir, "images", "vsco"),
      path.resolve(workingDir, "assets", "images", "vsco")
    ];

    // Check if any parent directory exists and use it
    for (const downloadDir of commonDownloadDirs) {
      const parentDir = path.dirname(downloadDir);
      if (fs.existsSync(parentDir)) {
        return downloadDir;
      }
    }

    // Default to downloads/vsco in current working directory
    return path.resolve(workingDir, "downloads", "vsco");
  }
  
  /**
   * Get smart manifest path with environment variable support and path resolution.
   * Checks environment variable first, then falls back to intelligent path searching.
   * 
   * @param options - User-provided options that may contain custom manifest path
   * @returns Resolved manifest path
   */
  private getSmartManifestPath(options: ConfigOptions): string {
    // If user provided manifest path in options, use it
    if (options.manifestPath) {
      return path.resolve(options.manifestPath);
    }

    // Check environment variable
    if (process.env.MANIFEST_PATH) {
      return path.resolve(process.env.MANIFEST_PATH);
    }

    // Use sync path resolution as fallback
    return this.getManifestPathSync();
  }

  /**
   * Synchronous fallback for manifest path resolution.
   * Used during config initialization when async operations aren't available.
   * 
   * @returns string - Resolved manifest path
   */
  private getManifestPathSync(): string {
    const workingDir = process.cwd();
    const filename = "vsco-manifest.json";
    const commonDirs = ["public", "assets", "data", "static", "resources", "content"];
    
    // Check current directory
    const currentPath = path.resolve(workingDir, filename);
    if (fs.existsSync(currentPath)) {
      return currentPath;
    }
    
    // Check common subdirectories and nested paths
    for (const dir of commonDirs) {
      const dirPath = path.resolve(workingDir, dir, filename);
      if (fs.existsSync(dirPath)) {
        return dirPath;
      }
      
      // Also check nested common paths
      const nestedPaths = [
        path.resolve(workingDir, dir, "images", filename),
        path.resolve(workingDir, dir, "assets", filename),
        path.resolve(workingDir, dir, "data", filename),
        path.resolve(workingDir, dir, "vsco", filename),
        path.resolve(workingDir, dir, "images", "vsco", filename)
      ];
      
      for (const nestedPath of nestedPaths) {
        if (fs.existsSync(nestedPath)) {
          return nestedPath;
        }
      }
    }
    
    // Check if public directory exists, prefer it as default
    const publicDir = path.resolve(workingDir, "public");
    if (fs.existsSync(publicDir)) {
      return path.resolve(publicDir, filename);
    }
    
    // Default to current directory
    return currentPath;
  }

  /**
   * Validate all configuration values against expected types and ranges.
   * Ensures timeout and retries are positive numbers and boolean flags are properly typed.
   *
   * @param config - Configuration object to validate
   * @throws {Error} When any validation rule fails
   */
  private validateConfig(config: ConfigOptions): void {
    if (
      config.timeout &&
      (typeof config.timeout !== "number" || config.timeout <= 0)
    ) {
      throw new Error("Timeout must be a positive number");
    }

    if (
      config.retries &&
      (typeof config.retries !== "number" || config.retries < 0)
    ) {
      throw new Error("Retries must be a non-negative number");
    }

    if (
      config.limit &&
      (typeof config.limit !== "number" || config.limit <= 0)
    ) {
      throw new Error("Limit must be a positive number");
    }


    if (typeof config.headless !== "boolean") {
      throw new Error("Headless must be a boolean");
    }

    if (typeof config.debug !== "boolean") {
      throw new Error("Debug must be a boolean");
    }

    if (typeof config.dryRun !== "boolean") {
      throw new Error("DryRun must be a boolean");
    }
  }

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
  get<K extends keyof ConfigOptions>(key: K): ConfigOptions[K] {
    return this.options[key];
  }

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
  getAll(): ConfigOptions {
    return { ...this.options };
  }

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
  getBrowserConfig(): BrowserConfiguration {
    return {
      headless: this.options.headless!,
      devtools: this.options.debug!,
    };
  }

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
  getContextConfig(): ContextConfiguration {
    return {
      userAgent: this.options.userAgent!,
      viewport: { width: 1920, height: 1080 },
      acceptDownloads: true,
      navigationTimeout: this.options.timeout!,
      actionTimeout: this.options.timeout! / 2,
    };
  }


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
  getAuthCredentials(): AuthCredentials {
    const credentials: AuthCredentials = {};
    if (process.env.VSCO_EMAIL) {
      credentials.email = process.env.VSCO_EMAIL;
    }
    if (process.env.VSCO_PASSWORD) {
      credentials.password = process.env.VSCO_PASSWORD;
    }
    return credentials;
  }

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
  hasAuthCredentials(): boolean {
    const credentials = this.getAuthCredentials();
    return !!(credentials.email && credentials.password);
  }
}
