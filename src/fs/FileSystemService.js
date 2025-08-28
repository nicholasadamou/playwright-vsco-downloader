"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemService = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
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
class FileSystemService {
    /**
     * Create a new file system service instance.
     *
     * @param config - Configuration instance
     * @example
     * ```javascript
     const fsService = new FileSystemService(config);
     * ```
     */
    constructor(config) {
        this.config = config;
    }
    /**
     * Check if image already exists locally
     * @param photoId Unsplash photo ID
     * @returns Promise resolving to an existence check result
     */
    async imageExists(photoId) {
        const possibleExtensions = [".jpg", ".jpeg", ".png", ".webp"];
        const downloadDir = this.config.get("downloadDir");
        if (!downloadDir) {
            throw new Error("Download directory not configured");
        }
        for (const ext of possibleExtensions) {
            const filepath = path_1.default.join(downloadDir, `${photoId}${ext}`);
            if (await fs_extra_1.default.pathExists(filepath)) {
                const stats = await fs_extra_1.default.stat(filepath);
                return { exists: true, filepath, size: stats.size };
            }
        }
        return { exists: false };
    }
    /**
     * Ensure download directory exists
     * @returns Absolute path to the download directory
     */
    async ensureDownloadDirectory() {
        const downloadDir = this.config.get("downloadDir");
        if (!downloadDir) {
            throw new Error("Download directory not configured");
        }
        await fs_extra_1.default.ensureDir(downloadDir);
        return downloadDir;
    }
    /**
     * Save a download to the specified path
     * @param download Playwright Download object
     * @param photoId Photo ID used to name the file
     * @returns Information about the saved file
     */
    async saveDownload(download, photoId) {
        const downloadDir = await this.ensureDownloadDirectory();
        // Get the suggested filename or create one
        const suggestedFilename = await download.suggestedFilename();
        const extension = path_1.default.extname(suggestedFilename) || ".jpg";
        const filename = `${photoId}${extension}`;
        const filepath = path_1.default.join(downloadDir, filename);
        // Save the download
        await download.saveAs(filepath);
        // Verify file exists and has content
        const stats = await fs_extra_1.default.stat(filepath);
        if (stats.size === 0) {
            throw new Error("Downloaded file is empty");
        }
        return {
            filepath,
            filename,
            size: stats.size,
        };
    }
    /**
     * Check if a file path exists
     * @param filePath Path to check
     * @returns Whether the path exists
     */
    async pathExists(filePath) {
        return await fs_extra_1.default.pathExists(filePath);
    }
    /**
     * Read JSON file
     * @param filePath Path to JSON file
     * @returns Parsed JSON data
     */
    async readJson(filePath) {
        if (!(await this.pathExists(filePath))) {
            throw new Error(`File not found: ${filePath}`);
        }
        return await fs_extra_1.default.readJson(filePath);
    }
    /**
     * Write JSON file with formatting
     * @param filePath Path to write JSON file
     * @param data Data to write
     * @param options Formatting options
     */
    async writeJson(filePath, data, options = {}) {
        const defaultOptions = { spaces: 2 };
        return await fs_extra_1.default.writeJson(filePath, data, {
            ...defaultOptions,
            ...options,
        });
    }
    /**
     * Get file statistics
     * @param filePath Path to file
     * @returns File statistics
     */
    async getFileStats(filePath) {
        return await fs_extra_1.default.stat(filePath);
    }
    /**
     * Get relative path from a base directory
     * @param filePath Full path to file
     * @param basePath Base directory (optional)
     * @returns Relative path
     */
    getRelativePath(filePath, basePath = null) {
        const base = basePath || path_1.default.join(process.cwd());
        return path_1.default.relative(base, filePath);
    }
    /**
     * Create a local manifest file
     * @param results Download results
     * @param originalManifest Original manifest data
     * @param stats Statistics provider
     * @returns Local manifest information
     */
    async createLocalManifest(results, originalManifest, stats) {
        const downloadDir = this.config.get("downloadDir");
        if (!downloadDir) {
            throw new Error("Download directory not configured");
        }
        const localManifest = {
            generated_at: new Date().toISOString(),
            version: "2.0.0",
            source_manifest: originalManifest.generated_at,
            download_method: "playwright",
            images: {},
            stats: stats.getSummaryForManifest(),
        };
        // Add successful downloads and skipped files
        results.forEach((result) => {
            if (result.success && result.filepath) {
                const relativePath = this.getRelativePath(result.filepath);
                localManifest.images[result.photoId] = {
                    local_path: `/${relativePath.replace(/\\/g, "/")}`,
                    downloaded_at: new Date().toISOString(),
                    author: result.author || "Unknown author",
                    author_url: result.authorUrl,
                    image_url: result.imageUrl,
                    size_bytes: result.size,
                    width: result.width,
                    height: result.height,
                    description: result.description,
                    location: result.location,
                    camera: result.camera,
                    likes: result.likes,
                    skipped: result.skipped || false,
                    download_method: "playwright",
                };
            }
        });
        const localManifestPath = path_1.default.join(downloadDir, "local-manifest.json");
        await this.writeJson(localManifestPath, localManifest);
        return { localManifest, localManifestPath };
    }
    /**
     * Save image file from buffer
     * @param photoId Photo ID used to name the file
     * @param imageBuffer Image data buffer
     * @param extension File extension (without dot)
     * @returns Information about the saved file
     */
    async saveImageFile(photoId, imageBuffer, extension) {
        const downloadDir = await this.ensureDownloadDirectory();
        const filename = `${photoId}.${extension}`;
        const filepath = path_1.default.join(downloadDir, filename);
        // Write the buffer to file
        await fs_extra_1.default.writeFile(filepath, imageBuffer);
        // Verify file exists and has content
        const stats = await fs_extra_1.default.stat(filepath);
        if (stats.size === 0) {
            throw new Error("Saved file is empty");
        }
        return {
            filepath,
            filename,
            size: stats.size,
        };
    }
    /**
     * Get debug screenshot path
     * @param photoId Photo ID
     * @param attempt Attempt number
     * @returns Screenshot file path
     */
    getDebugScreenshotPath(photoId, attempt) {
        const downloadDir = this.config.get("downloadDir");
        if (!downloadDir) {
            throw new Error("Download directory not configured");
        }
        return path_1.default.join(downloadDir, `debug-${photoId}-attempt-${attempt}.png`);
    }
    /**
     * Calculate total storage used by results
     * @param results Download results
     * @returns Total storage in bytes
     */
    calculateTotalStorage(results) {
        return results
            .filter((r) => r.success && r.size)
            .reduce((sum, r) => sum + (r.size || 0), 0);
    }
    /**
     * Validate manifest file path
     * @returns Resolved manifest path if it exists
     */
    async validateManifestPath() {
        const manifestPath = this.config.get("manifestPath");
        if (!manifestPath) {
            throw new Error("Manifest path not configured");
        }
        if (!(await this.pathExists(manifestPath))) {
            throw new Error(`Manifest file not found: ${manifestPath}`);
        }
        return manifestPath;
    }
}
exports.FileSystemService = FileSystemService;
