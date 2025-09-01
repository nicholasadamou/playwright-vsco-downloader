/**
 * Core type definitions for the Playwright Image Downloader.
 * Contains all shared types, interfaces, and enums used throughout the application.
 */

import type {
  Browser,
  BrowserContext,
  Page,
  Download,
  Response,
} from "playwright";
import type { Stats } from "fs";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the image downloader.
 */
export interface ConfigOptions {
  /** Run browser in headless mode */
  headless?: boolean;
  /** Enable debug mode with DevTools */
  debug?: boolean;
  /** Directory where images will be saved */
  downloadDir?: string;
  /** Path to the manifest file */
  manifestPath?: string;
  /** VSCO username to scrape */
  username?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Maximum number of images to process (undefined = no limit) */
  limit?: number;
  /** Custom user agent string */
  userAgent?: string;
  /** Simulate downloads without actually downloading */
  dryRun?: boolean;
  /** Maximum number of concurrent downloads (default: 3) */
  maxConcurrency?: number;
  /** Delay between batches in milliseconds (default: 1000) */
  delayBetweenBatches?: number;
  /** Number of downloads per batch (default: same as maxConcurrency) */
  batchSize?: number;
  /** Enable progressive downloading with batches (default: true) */
  enableBatching?: boolean;
}


/**
 * Browser configuration for Playwright browser launch.
 */
export interface BrowserConfiguration {
  /** Whether to run browser in headless mode */
  headless: boolean;
  /** Whether to enable DevTools */
  devtools: boolean;
}

/**
 * Browser context configuration for Playwright context creation.
 */
export interface ContextConfiguration {
  /** User agent string */
  userAgent: string;
  /** Browser viewport dimensions */
  viewport: { width: number; height: number };
  /** Whether to accept downloads */
  acceptDownloads: boolean;
  /** Navigation timeout in milliseconds */
  navigationTimeout: number;
  /** Action timeout in milliseconds */
  actionTimeout: number;
}


/**
 * Authentication credentials from environment variables.
 */
export interface AuthCredentials {
  /** Email from environment variables */
  email?: string;
  /** Password from environment variables */
  password?: string;
}

// ============================================================================
// Playwright Types (Re-exported for convenience)
// ============================================================================

export type { Browser, BrowserContext, Page, Download, Response };

// ============================================================================
// Image and Manifest Types
// ============================================================================

/**
 * Image metadata from the manifest.
 */
export interface ImageData {
  /** Photographer name */
  image_author?: string;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;

  // VSCO-specific fields
  /** VSCO username */
  vsco_username?: string;
  /** VSCO profile URL */
  vsco_url?: string;
  /** VSCO image ID */
  vsco_image_id?: string;
  /** Direct image URL from VSCO */
  direct_image_url?: string;
  /** VSCO thumbnail URL */
  thumbnail_url?: string;
  /** Upload date/time */
  upload_date?: string;

  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Image entry tuple: [photoId, imageData].
 */
export type ImageEntry = [string, ImageData];

/**
 * Result of processing the manifest.
 */
export interface ProcessedManifestResult {
  /** Array of [photoId, imageData] tuples */
  imageEntries: ImageEntry[];
  /** The original manifest object */
  originalManifest: ManifestFile;
  /** Total number of images to process */
  totalImages: number;
}

/**
 * Structure of the manifest file.
 */
export interface ManifestFile {
  /** When the manifest was generated */
  generated_at: string;
  /** Manifest version */
  version?: string;
  /** Collection of images keyed by photo ID */
  images: Record<string, ImageData>;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Statistics about images in the manifest.
 */
export interface ImageStatistics {
  /** Total number of images */
  total: number;
  /** List of unique author names */
  authors: string[];
  /** Count of unique authors */
  uniqueAuthors: number;
  /** Average image width in pixels */
  averageWidth: number;
  /** Average image height in pixels */
  averageHeight: number;
  /** Count of images with dimension data */
  imagesWithDimensions: number;
}

// ============================================================================
// Download Types
// ============================================================================

/**
 * Result of a single image download attempt.
 */
export interface DownloadResult {
  /** Whether the download succeeded */
  success: boolean;
  /** The photo ID */
  photoId: string;
  /** Full path to downloaded file (if successful) */
  filepath?: string;
  /** Name of downloaded file (if successful) */
  filename?: string;
  /** File size in bytes (if successful) */
  size?: number;
  /** Image author (if available) */
  author?: string;
  /** Author's profile URL (if available) */
  authorUrl?: string;
  /** Direct image URL used for download */
  imageUrl?: string;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Error message (if failed) */
  error?: string;
  /** Whether download was skipped (file exists) */
  skipped?: boolean;
  /** Whether this was a dry run simulation */
  dryRun?: boolean;

  // VSCO-specific metadata
  /** Upload date from VSCO */
  uploadDate?: string;
  /** Available image sizes from srcset */
  availableSizes?: string[];
  /** Full srcset attribute */
  srcset?: string;
  /** Original image width from VSCO */
  originalWidth?: number;
  /** Original image height from VSCO */
  originalHeight?: number;
}


/**
 * Information about a saved file.
 */
export interface SavedFileInfo {
  /** Full path to saved file */
  filepath: string;
  /** Name of saved file */
  filename: string;
  /** File size in bytes */
  size: number;
}

/**
 * Result of checking if an image exists.
 */
export interface ImageExistsResult {
  /** Whether the image file exists */
  exists: boolean;
  /** Full path to existing file (if exists) */
  filepath?: string;
  /** File size in bytes (if exists) */
  size?: number;
}

/**
 * Download session summary.
 */
export interface DownloadSummary {
  /** Number of successful downloads */
  successful: number;
  /** Number of failed downloads */
  failed: number;
  /** Number of skipped (existing) files */
  skipped: number;
  /** Total storage used in bytes */
  totalStorage: number;
  /** Details of failed downloads */
  failedResults: DownloadResult[];
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Statistics data tracked during downloads.
 */
export interface StatsData {
  /** Total number of items to process */
  total: number;
  /** Number of successfully downloaded items */
  downloaded: number;
  /** Number of failed downloads */
  failed: number;
  /** Number of skipped items (already exist) */
  skipped: number;
}

/**
 * Manifest summary for statistics reporting.
 */
export interface ManifestSummary {
  /** Total images processed */
  total_images: number;
  /** Successfully downloaded count */
  downloaded: number;
  /** Failed download count */
  failed: number;
  /** Skipped download count */
  skipped: number;
  /** Success percentage */
  success_rate: number;
  /** Total operation time in seconds */
  duration_seconds: number;
}

// ============================================================================
// CLI Types
// ============================================================================

/**
 * CLI command option configuration.
 */
export interface CommandOptionConfig {
  /** CLI flag definition (e.g., "-t, --timeout <number>") */
  flag: string;
  /** Human-readable description for the option */
  description: string;
  /** Optional default value passed to Commander */
  defaultValue?: unknown;
}

/**
 * Raw CLI options from Commander (main command).
 */
export interface MainCliOptions {
  /** Run browser in headless mode */
  headless?: boolean;
  /** Enable debug/devtools */
  debug?: boolean;
  /** Timeout in ms (string accepted from env/CLI, parsed to number) */
  timeout?: string | number;
  /** Number of retries (string accepted, parsed to number) */
  retries?: string | number;
  /** Limit images processed (0 means no limit) */
  limit?: string | number;
  /** Do not actually download, simulate */
  dryRun?: boolean;
  /** Optional manifest path */
  manifestPath?: string;
  /** Optional download directory */
  downloadDir?: string;
}

/**
 * Normalized options for the downloader.
 */
export interface NormalizedDownloaderOptions {
  headless: boolean;
  debug: boolean;
  timeout: number;
  retries: number;
  limit?: number;
  dryRun: boolean;
  manifestPath?: string;
  downloadDir?: string;
}

/**
 * List command options.
 */
export interface ListCommandOptions {
  /** Path to manifest file */
  manifestPath?: string;
  /** Output format (table, json, csv) */
  format?: string;
  /** Limit number of items displayed */
  limit?: number;
  /** Filter by author name */
  author?: string;
  /** Filter by minimum width */
  minWidth?: number;
  /** Filter by minimum height */
  minHeight?: number;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment variable check configuration.
 */
export interface EnvironmentCheck {
  /** Environment variable name */
  name: string;
  /** Current value from process.env */
  value: string | undefined;
  /** Whether the variable is required */
  required: boolean;
  /** Human-readable description */
  description: string;
  /** If true, value should be masked in output */
  hideValue?: boolean;
  /** Logical category */
  category: "authentication" | "api" | "playwright";
  /** Derived display status (e.g., ✅/❌/⚠️) */
  status?: string;
  /** Derived masked/shortened value for display */
  displayValue?: string;
}

/**
 * Environment check result.
 */
export interface EnvironmentCheckResult {
  /** Individual environment checks */
  checks: EnvironmentCheck[];
  /** Whether environment is properly configured */
  isValid: boolean;
  /** Missing required variables */
  requiredMissing: string[];
  /** Summary statistics */
  summary: EnvironmentSummary;
}

/**
 * Environment check summary.
 */
export interface EnvironmentSummary {
  /** Total number of variables checked */
  total: number;
  /** Number of variables that are set */
  set: number;
  /** Number of required variables */
  required: number;
  /** Number of required variables that are set */
  requiredSet: number;
  /** Number of optional variables */
  optional: number;
  /** Number of optional variables that are set */
  optionalSet: number;
}

// ============================================================================
// Command Handler Interface
// ============================================================================

/**
 * Interface for CLI command handlers.
 */
export interface CommandHandler {
  /** Returns the command name */
  getName(): string;
  /** Returns the command description */
  getDescription(): string;
  /** Returns option configurations */
  getOptionsConfig(): CommandOptionConfig[];
  /** Executes the command */
  execute(options: Record<string, unknown>): Promise<unknown>;
  /** Handles command result */
  handleResult(result: unknown, options: Record<string, unknown>): void;
  /** Validates prerequisites before execution */
  validatePrerequisites?(
    options: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }>;
}

// ============================================================================
// Local Manifest Types
// ============================================================================

/**
 * Local manifest data structure.
 */
export interface LocalManifest {
  /** When the local manifest was generated */
  generated_at: string;
  /** Local manifest version */
  version: string;
  /** Reference to source manifest generation time */
  source_manifest: string;
  /** Download method used */
  download_method: string;
  /** Collection of downloaded images */
  images: Record<string, LocalImageEntry>;
  /** Download statistics */
  stats: ManifestSummary;
}

/**
 * Local image entry in the manifest.
 */
export interface LocalImageEntry {
  /** Relative path to local file */
  local_path: string;
  /** When the image was downloaded */
  downloaded_at: string;
  /** Image author */
  author: string;
  /** Author's profile URL */
  author_url?: string;
  /** Direct image URL used for download */
  image_url?: string;
  /** File size in bytes */
  size_bytes: number;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Whether download was skipped (file existed) */
  skipped: boolean;
  /** Download method used */
  download_method: string;
}

/**
 * VSCO-specific local image entry in the manifest with comprehensive metadata.
 */
export interface VscoLocalImageEntry {
  /** Relative path to local file */
  local_path: string;
  /** When the image was downloaded */
  downloaded_at: string;
  /** Image author/photographer */
  author: string;
  /** VSCO username */
  vsco_username: string;
  /** VSCO profile URL (e.g., https://vsco.co/username) */
  vsco_profile_url: string;
  /** VSCO image page URL (e.g., https://vsco.co/username/media/imageId) */
  vsco_image_url: string;
  /** VSCO image ID */
  vsco_image_id: string;
  /** Direct image URL used for download */
  direct_image_url: string;
  /** Thumbnail image URL */
  thumbnail_url?: string;
  /** File size in bytes */
  file_size_bytes: number;
  /** Image width in pixels */
  width_px?: number;
  /** Image height in pixels */
  height_px?: number;
  /** Upload date from VSCO */
  upload_date?: string;
  /** Whether download was skipped (file existed) */
  skipped: boolean;
  /** Download method used */
  download_method: string;
}

/**
 * Result of creating a local manifest.
 */
export interface LocalManifestResult {
  /** Generated local manifest object */
  localManifest: LocalManifest;
  /** Path where manifest was saved */
  localManifestPath: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Additional validation data */
  result?: unknown;
}
