import type { Config } from "../config/Config.js";
import type { BrowserManager } from "../browser/BrowserManager.js";
import type { ImageEntry } from "../types/index.js";
/**
 * @fileoverview VSCO Profile Scraper service for extracting image metadata and URLs
 * from VSCO profile pages. Handles navigation, pagination, and data extraction.
 *
 * Key Features:
 * - Profile page navigation and loading
 * - Infinite scroll handling for image loading
 * - Image metadata extraction (URLs, dimensions, descriptions)
 * - Rate limiting and respectful scraping
 * - Error handling and retry logic
 * - Progress reporting
 *
 * @example
 * ```javascript
 * const scraper = new VscoProfileScraper(config, browserManager);
 *
 * // Scrape a profile
 * const images = await scraper.scrapeProfile("username");
 * console.log(`Found ${images.length} images`);
 *
 * // Get image entries in manifest format
 * const entries = await scraper.getImageEntries("username");
 * ```
 */
/**
 * Scraped image information from VSCO
 */
export interface VscoImageInfo {
    id: string;
    url: string;
    thumbnailUrl: string;
    originalUrl?: string;
    width?: number;
    height?: number;
    description?: string;
    uploadDate?: string;
    likes?: number;
}
/**
 * Profile scraping result
 */
export interface VscoProfileResult {
    username: string;
    displayName?: string;
    bio?: string;
    followerCount?: number;
    followingCount?: number;
    imageCount: number;
    images: VscoImageInfo[];
}
/**
 * VSCO Profile Scraper service for extracting image data from profile pages.
 * Uses Playwright to navigate and extract data from VSCO profiles.
 */
export declare class VscoProfileScraper {
    private readonly config;
    private readonly browserManager;
    /**
     * Create a new VSCO profile scraper instance.
     *
     * @param config - Configuration instance
     * @param browserManager - Browser manager instance
     */
    constructor(config: Config, browserManager: BrowserManager);
    /**
     * Scrape a VSCO profile and extract all image information.
     *
     * @param username - VSCO username to scrape
     * @param maxImages - Maximum number of images to scrape (0 = no limit)
     * @returns Promise with profile and image data
     */
    scrapeProfile(username: string, maxImages?: number): Promise<VscoProfileResult>;
    /**
     * Navigate to VSCO profile page and wait for it to load.
     *
     * @param page - Playwright page instance
     * @param profileUrl - Full profile URL
     * @param username - Username for logging
     */
    private navigateToProfile;
    /**
     * Extract profile metadata (display name, bio, stats).
     *
     * @param page - Playwright page instance
     * @param username - Username for fallback
     * @returns Profile metadata
     */
    private extractProfileMetadata;
    /**
     * Extract images from the profile page with Load More button handling.
     *
     * @param page - Playwright page instance
     * @param username - Username for logging
     * @param maxImages - Maximum number of images to extract
     * @returns Array of image information
     */
    private extractImages;
    /**
     * Extract images currently visible on the page.
     *
     * @param page - Playwright page instance
     * @param username - Username for context
     * @returns Array of currently visible image information
     */
    private extractCurrentImages;
    /**
     * Extract detailed information from an image element.
     *
     * @param imgElement - Playwright element handle for image
     * @param src - Image source URL
     * @param username - Username for context
     * @returns Image information or null if extraction fails
     */
    private extractImageInfo;
    /**
     * Extract image ID from VSCO URL patterns.
     *
     * @param url - Image URL
     * @returns Image ID or null
     */
    private extractImageIdFromUrl;
    /**
     * Generate a unique image ID from URL if pattern extraction fails.
     *
     * @param url - Image URL
     * @returns Generated ID
     */
    private generateImageId;
    /**
     * Generate original quality URL from a thumbnail URL.
     *
     * @param url - Thumbnail URL
     * @returns Original URL or null
     */
    private generateOriginalUrl;
    /**
     * Generate thumbnail URL from an original URL.
     *
     * @param url - Original URL
     * @returns Thumbnail URL or null
     */
    private generateThumbnailUrl;
    /**
     * Convert scraped profile data to manifest-compatible image entries.
     *
     * @param profileResult - Scraped profile data
     * @returns Array of image entries
     */
    getImageEntries(profileResult: VscoProfileResult): ImageEntry[];
    /**
     * Validate if a username looks like a valid VSCO username.
     *
     * @param username - Username to validate
     * @returns true if valid format
     */
    static isValidUsername(username: string): boolean;
    /**
     * Clean and normalize a username.
     *
     * @param input - Raw username input
     * @returns Cleaned username or null if invalid
     */
    static cleanUsername(input: string): string | null;
}
