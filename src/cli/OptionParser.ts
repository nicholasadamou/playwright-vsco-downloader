import path from "path";
import fs from "fs-extra";

/**
 * @fileoverview CLI option parser and validator. Converts raw Commander options
 * into normalized, validated option objects consumed by the application.
 */

/**
 * Main CLI options interface
 */
export interface MainCliOptions {
  headless: boolean;
  debug: boolean;
  timeout: string | number;
  retries: string | number;
  limit: string | number;
  dryRun?: boolean;
  username?: string;
  downloadDir?: string;
  concurrency?: string | number;
  batchSize?: string | number;
  delayBetweenBatches?: string | number;
  noBatching?: boolean;
}

/**
 * Normalized downloader options interface
 */
export interface NormalizedDownloaderOptions {
  headless: boolean;
  debug: boolean;
  timeout: number;
  retries: number;
  limit?: number;
  dryRun: boolean;
  username?: string;
  downloadDir?: string;
  maxConcurrency?: number;
  batchSize?: number;
  delayBetweenBatches?: number;
  enableBatching?: boolean;
}


/**
 * CLI option parser and validator following Single Responsibility Principle.
 * Handles parsing, validation, and normalization of command line options.
 * Converts raw CLI input into typed, validated configuration objects.
 *
 * @example
 * ```javascript
 * const optionParser = new OptionParser();
 *
 * // Parse main command options
 * const options = optionParser.parseMainOptions({
 *   headless: true,
 *   timeout: '45000',
 *   size: 'large'
 * });
 *
 * // Get default options from environment
 * const defaults = optionParser.getDefaultOptions();
 * ```
 */
export class OptionParser {

  /**
   * Create a new option parser instance.
   * Sets up validation rules and valid option values.
   */
  constructor() {
  }

  /**
   * Parse and validate main command options from raw CLI input.
   * Orchestrates the complete option processing pipeline: parsing, validation, and normalization.
   */
  public parseMainOptions(
    options: Record<string, any>
  ): NormalizedDownloaderOptions {
    const parsedOptions = this.parseNumericOptions(options);
    this.validateMainOptions(parsedOptions);
    return this.buildDownloaderOptions(parsedOptions);
  }

  /**
   * Parse string numeric options into proper number types.
   * Handles CLI input which comes as strings and converts to numbers.
   */
  private parseNumericOptions(
    options: Record<string, any>
  ): Record<string, any> {
    const timeout = parseInt(String(options.timeout));
    const retries = parseInt(String(options.retries));
    const limit = parseInt(String(options.limit));
    const concurrency = parseInt(String(options.concurrency || 3));
    const batchSize = options.batchSize ? parseInt(String(options.batchSize)) : undefined;
    const delayBetweenBatches = parseInt(String(options.delayBetweenBatches || 1000));

    return {
      ...options,
      timeout,
      retries,
      limit,
      concurrency,
      batchSize,
      delayBetweenBatches,
    };
  }

  /**
   * Validate all main command options using individual validators.
   * Calls specific validation methods for each option type.
   */
  private validateMainOptions(options: Record<string, any>): void {
    this.validateTimeout(options.timeout);
    this.validateRetries(options.retries);
    this.validateLimit(options.limit);
  }

  /**
   * Validate timeout value to ensure it meets minimum requirements.
   * Timeout must be at least 1000ms to allow reasonable operation time.
   */
  private validateTimeout(timeout: any): void {
    if (isNaN(timeout) || timeout < 1000) {
      throw new Error("Timeout must be at least 1000ms");
    }
  }

  /**
   * Validate retries value to ensure it's a positive number.
   * At least 1 retry is required for robust operation.
   */
  private validateRetries(retries: any): void {
    if (isNaN(retries) || retries < 1) {
      throw new Error("Retries must be a positive number");
    }
  }

  /**
   * Validate limit value to ensure it's non-negative.
   * 0 means no limit, positive numbers set download limits.
   */
  private validateLimit(limit: any): void {
    if (isNaN(limit) || limit < 0) {
      throw new Error("Limit must be 0 (no limit) or a positive number");
    }
  }


  /**
   * Build normalized downloader options from parsed and validated CLI options.
   * Transforms CLI input into the format expected by the downloader service.
   */
  private buildDownloaderOptions(
    options: Record<string, any>
  ): NormalizedDownloaderOptions {
    const downloaderOptions: any = {
      headless: options.headless,
      debug: options.debug,
      timeout: options.timeout,
      retries: options.retries,
      limit: options.limit > 0 ? options.limit : undefined,
      dryRun: options.dryRun || false,
    };

    // Set username if provided (validate and clean it)
    if (options.username) {
      const cleanedUsername = this.cleanAndValidateUsername(options.username);
      downloaderOptions.username = cleanedUsername;
    }

    // Set custom download directory if provided
    if (options.downloadDir) {
      downloaderOptions.downloadDir = path.resolve(options.downloadDir);
    }

    // Set concurrency options
    if (options.concurrency !== undefined) {
      downloaderOptions.maxConcurrency = Math.max(1, Math.min(10, options.concurrency));
    }

    if (options.batchSize !== undefined) {
      downloaderOptions.batchSize = Math.max(1, options.batchSize);
    }

    if (options.delayBetweenBatches !== undefined) {
      downloaderOptions.delayBetweenBatches = Math.max(0, options.delayBetweenBatches);
    }

    // Handle batching toggle
    if (options.noBatching === true) {
      downloaderOptions.enableBatching = false;
    }

    return downloaderOptions;
  }

  /**
   * Parse list command options and resolve manifest path.
   * Uses built-in path resolution for intelligent manifest path finding.
   */
  public parseListOptions(options: Record<string, any>): {
    manifestPath: string;
  } {
    const manifestPath = options.manifestPath
      ? path.resolve(options.manifestPath)
      : this.getSmartManifestPath();
      
    return { manifestPath };
  }
  
  /**
   * Get smart default manifest path using sync path resolution.
   * Fallback method for use in CLI parsing where async operations aren't available.
   * 
   * @returns string - Resolved manifest path
   */
  private getSmartManifestPath(): string {
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
    
    // Check parent directories (up to 3 levels)
    for (let level = 1; level <= 3; level++) {
      const parentDir = path.resolve(workingDir, "../".repeat(level));
      
      // Check parent directory directly
      const parentPath = path.resolve(parentDir, filename);
      if (fs.existsSync(parentPath)) {
        return parentPath;
      }
      
      // Check common subdirectories in parent
      for (const commonDir of commonDirs) {
        const parentCommonPath = path.resolve(parentDir, commonDir, filename);
        if (fs.existsSync(parentCommonPath)) {
          return parentCommonPath;
        }
      }
    }
    
    // If no existing manifest found, return most likely location
    // Prefer public directory if it exists, otherwise current directory
    const publicDir = path.resolve(workingDir, "public");
    if (fs.existsSync(publicDir)) {
      return path.resolve(publicDir, filename);
    }
    
    return currentPath;
  }

  /**
   * Clean and validate a VSCO username.
   * 
   * @param input - Raw username input
   * @returns Cleaned username
   * @throws {Error} When username is invalid
   */
  private cleanAndValidateUsername(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new Error("Username is required");
    }

    // Remove common prefixes/suffixes and clean input
    let cleaned = input.trim()
      .replace(/^@/, '') // Remove @ prefix
      .replace(/^https?:\/\/(www\.)?vsco\.co\//, '') // Remove VSCO URL prefix
      .replace(/\/.*$/, '') // Remove any path parts
      .toLowerCase();

    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
      throw new Error("Username can only contain letters, numbers, underscores, and hyphens");
    }

    if (cleaned.length < 2 || cleaned.length > 50) {
      throw new Error("Username must be between 2 and 50 characters long");
    }

    return cleaned;
  }

  /**
   * Get default CLI options from environment variables.
   * Provides fallback values when CLI options are not specified.
   */
  public getDefaultOptions(): Record<string, any> {
    return {
      headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
      debug: process.env.PLAYWRIGHT_DEBUG === "true",
      timeout: process.env.PLAYWRIGHT_TIMEOUT || "30000",
      retries: process.env.PLAYWRIGHT_RETRIES || "3",
      limit: process.env.PLAYWRIGHT_LIMIT || "0",
    };
  }
}
