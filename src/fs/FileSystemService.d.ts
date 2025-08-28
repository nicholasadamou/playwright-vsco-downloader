import type { Stats } from "fs";
import type { Config } from "../config/Config.js";
import type { DownloadResult, ManifestFile } from "../types/index.js";
/**
 * Result of checking if an image exists
 */
interface ImageExistsResult {
    exists: boolean;
    filepath?: string;
    size?: number;
}
/**
 * Information about a saved file
 */
interface SavedFileInfo {
    filepath: string;
    filename: string;
    size: number;
}
/**
 * Local manifest creation result
 */
interface LocalManifestResult {
    localManifest: any;
    localManifestPath: string;
}
/**
 * Statistics provider interface
 */
interface StatsProvider {
    getSummaryForManifest(): any;
}
/**
 * @fileoverview File system service for reading/writing manifests and images,
 * ensuring directories exist, and providing helpers for paths and file stats.
 * This module encapsulates all filesystem interactions used by the downloader.
 *
 * Key Features:
 * - Image file existence checking with multiple extensions
 * - Download directory management and setup
 * - Playwright download saving with validation
 * - JSON manifest reading and writing
 * - Path manipulation and relative path calculation
 * - Debug screenshot path generation
 * - Storage calculation utilities
 *
 * File Operations:
 * - Supports multiple image formats (.jpg, .jpeg, .png, .webp)
 * - Automatic directory creation
 * - File size validation
 * - Cross-platform path handling
 *
 * @example
 * ```javascript
 * const fsService = new FileSystemService(config);
 *
 * // Check if image exists
 * const check = await fsService.imageExists('photo123');
 * if (check.exists) {
 *   console.log('Found:', check.filepath, check.size, 'bytes');
 * }
 *
 * // Save a download
 * const fileInfo = await fsService.saveDownload(download, 'photo123');
 * console.log('Saved to:', fileInfo.filepath);
 * ```
 */
/**
 * File system service for reading/writing manifests and images,
 * ensuring directories exist, and providing helpers for paths and file stats.
 * This module encapsulates all filesystem interactions used by the downloader.
 */
export declare class FileSystemService {
    private readonly config;
    /**
     * Create a new file system service instance.
     *
     * @param config - Configuration instance
     * @example
     * ```javascript
     const fsService = new FileSystemService(config);
     * ```
     */
    constructor(config: Config);
    /**
     * Check if image already exists locally
     * @param photoId Unsplash photo ID
     * @returns Promise resolving to an existence check result
     */
    imageExists(photoId: string): Promise<ImageExistsResult>;
    /**
     * Ensure download directory exists
     * @returns Absolute path to the download directory
     */
    ensureDownloadDirectory(): Promise<string>;
    /**
     * Save a download to the specified path
     * @param download Playwright Download object
     * @param photoId Photo ID used to name the file
     * @returns Information about the saved file
     */
    saveDownload(download: any, photoId: string): Promise<SavedFileInfo>;
    /**
     * Check if a file path exists
     * @param filePath Path to check
     * @returns Whether the path exists
     */
    pathExists(filePath: string): Promise<boolean>;
    /**
     * Read JSON file
     * @param filePath Path to JSON file
     * @returns Parsed JSON data
     */
    readJson(filePath: string): Promise<any>;
    /**
     * Write JSON file with formatting
     * @param filePath Path to write JSON file
     * @param data Data to write
     * @param options Formatting options
     */
    writeJson(filePath: string, data: any, options?: {
        spaces?: number;
    }): Promise<void>;
    /**
     * Get file statistics
     * @param filePath Path to file
     * @returns File statistics
     */
    getFileStats(filePath: string): Promise<Stats>;
    /**
     * Get relative path from a base directory
     * @param filePath Full path to file
     * @param basePath Base directory (optional)
     * @returns Relative path
     */
    getRelativePath(filePath: string, basePath?: string | null): string;
    /**
     * Create a local manifest file
     * @param results Download results
     * @param originalManifest Original manifest data
     * @param stats Statistics provider
     * @returns Local manifest information
     */
    createLocalManifest(results: DownloadResult[], originalManifest: ManifestFile, stats: StatsProvider): Promise<LocalManifestResult>;
    /**
     * Save image file from buffer
     * @param photoId Photo ID used to name the file
     * @param imageBuffer Image data buffer
     * @param extension File extension (without dot)
     * @returns Information about the saved file
     */
    saveImageFile(photoId: string, imageBuffer: Buffer, extension: string): Promise<SavedFileInfo>;
    /**
     * Get debug screenshot path
     * @param photoId Photo ID
     * @param attempt Attempt number
     * @returns Screenshot file path
     */
    getDebugScreenshotPath(photoId: string, attempt: number): string;
    /**
     * Calculate total storage used by results
     * @param results Download results
     * @returns Total storage in bytes
     */
    calculateTotalStorage(results: DownloadResult[]): number;
    /**
     * Validate manifest file path
     * @returns Resolved manifest path if it exists
     */
    validateManifestPath(): Promise<string>;
}
export {};
