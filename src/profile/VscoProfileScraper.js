"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VscoProfileScraper = void 0;
const chalk_1 = __importDefault(require("chalk"));
/**
 * VSCO Profile Scraper service for extracting image data from profile pages.
 * Uses Playwright to navigate and extract data from VSCO profiles.
 */
class VscoProfileScraper {
    /**
     * Create a new VSCO profile scraper instance.
     *
     * @param config - Configuration instance
     * @param browserManager - Browser manager instance
     */
    constructor(config, browserManager) {
        this.config = config;
        this.browserManager = browserManager;
    }
    /**
     * Scrape a VSCO profile and extract all image information.
     *
     * @param username - VSCO username to scrape
     * @param maxImages - Maximum number of images to scrape (0 = no limit)
     * @returns Promise with profile and image data
     */
    async scrapeProfile(username, maxImages = 0) {
        const page = await this.browserManager.getPage();
        const profileUrl = `https://vsco.co/${username}`;
        console.log(chalk_1.default.blue(`🔍 Scraping VSCO profile: ${username}`));
        console.log(chalk_1.default.gray(`   Profile URL: ${profileUrl}`));
        try {
            // Navigate to profile page
            await this.navigateToProfile(page, profileUrl, username);
            // Extract profile metadata
            const profileMetadata = await this.extractProfileMetadata(page, username);
            // Load and extract images
            const images = await this.extractImages(page, username, maxImages);
            const result = {
                ...profileMetadata,
                username,
                imageCount: images.length,
                images,
            };
            console.log(chalk_1.default.green(`✅ Successfully scraped ${images.length} images from @${username}`));
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(chalk_1.default.red(`❌ Failed to scrape profile @${username}: ${errorMessage}`));
            throw error;
        }
    }
    /**
     * Navigate to VSCO profile page and wait for it to load.
     *
     * @param page - Playwright page instance
     * @param profileUrl - Full profile URL
     * @param username - Username for logging
     */
    async navigateToProfile(page, profileUrl, username) {
        console.log(chalk_1.default.blue(`🌐 Navigating to profile: @${username}`));
        await page.goto(profileUrl, {
            waitUntil: 'domcontentloaded',
            timeout: this.config.get("timeout") || 30000
        });
        // Wait for main content to load - using actual VSCO gallery structure
        try {
            await page.waitForSelector('[data-testid="UserProfileGallery"], .MediaThumbnail', {
                timeout: 10000
            });
        }
        catch (error) {
            // Try to check if profile exists or is private, but handle page closure gracefully
            try {
                const pageContent = await page.textContent('body');
                if (pageContent?.includes('Page Not Found') || pageContent?.includes('User not found')) {
                    throw new Error(`VSCO profile @${username} not found`);
                }
                if (pageContent?.includes('Private') || pageContent?.includes('private')) {
                    throw new Error(`VSCO profile @${username} is private`);
                }
            }
            catch (pageError) {
                // Page might be closed, just use the original error
                if (this.config.get("debug")) {
                    console.warn(chalk_1.default.yellow(`⚠️  Could not check page content: ${pageError}`));
                }
            }
            throw new Error(`Failed to load VSCO profile @${username}`);
        }
        console.log(chalk_1.default.green(`✅ Profile page loaded: @${username}`));
    }
    /**
     * Extract profile metadata (display name, bio, stats).
     *
     * @param page - Playwright page instance
     * @param username - Username for fallback
     * @returns Profile metadata
     */
    async extractProfileMetadata(page, username) {
        try {
            const metadata = {};
            // Try to extract display name
            const displayNameSelectors = [
                '.ProfileHeader-displayName',
                '.Profile-displayName',
                '[class*="displayName"]',
                'h1',
                '[data-testid="display-name"]'
            ];
            for (const selector of displayNameSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        const displayName = await element.textContent();
                        if (displayName && displayName.trim() !== username) {
                            metadata.displayName = displayName.trim();
                            break;
                        }
                    }
                }
                catch (e) {
                    // Continue trying other selectors
                }
            }
            // Try to extract bio
            const bioSelectors = [
                '.ProfileHeader-bio',
                '.Profile-bio',
                '[class*="bio"]',
                '[data-testid="bio"]'
            ];
            for (const selector of bioSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        const bio = await element.textContent();
                        if (bio && bio.trim()) {
                            metadata.bio = bio.trim();
                            break;
                        }
                    }
                }
                catch (e) {
                    // Continue trying other selectors
                }
            }
            // Try to extract follower/following counts
            const statSelectors = [
                '.ProfileHeader-stats',
                '.Profile-stats',
                '[class*="stats"]',
                '[class*="Stats"]'
            ];
            for (const selector of statSelectors) {
                try {
                    const statsContainer = await page.$(selector);
                    if (statsContainer) {
                        const statsText = await statsContainer.textContent();
                        if (statsText) {
                            // Parse follower/following numbers from text
                            const followerMatch = statsText.match(/(\d+(?:,\d+)*)\s*(?:followers?|Followers?)/i);
                            const followingMatch = statsText.match(/(\d+(?:,\d+)*)\s*(?:following|Following)/i);
                            if (followerMatch && followerMatch[1]) {
                                metadata.followerCount = parseInt(followerMatch[1].replace(/,/g, ''));
                            }
                            if (followingMatch && followingMatch[1]) {
                                metadata.followingCount = parseInt(followingMatch[1].replace(/,/g, ''));
                            }
                        }
                        break;
                    }
                }
                catch (e) {
                    // Continue trying other selectors
                }
            }
            return metadata;
        }
        catch (error) {
            if (this.config.get("debug")) {
                console.warn(chalk_1.default.yellow(`⚠️  Could not extract profile metadata: ${error}`));
            }
            return {};
        }
    }
    /**
     * Extract images from the profile page with Load More button handling.
     *
     * @param page - Playwright page instance
     * @param username - Username for logging
     * @param maxImages - Maximum number of images to extract
     * @returns Array of image information
     */
    async extractImages(page, username, maxImages = 0) {
        console.log(chalk_1.default.blue(`📸 Extracting images from @${username}'s profile`));
        const images = [];
        let attempts = 0;
        const maxLoadMoreAttempts = 10; // Limit how many times we click "Load More"
        try {
            // Wait for the VSCO gallery to load
            await page.waitForSelector('[data-testid="UserProfileGallery"]', { timeout: 10000 });
            console.log(chalk_1.default.blue(`   Found VSCO gallery container`));
            // Wait a bit more for images to load (they might be lazy-loaded)
            await page.waitForTimeout(3000);
            // Try to wait for at least one image to be visible
            try {
                await page.waitForSelector('.MediaThumbnail img', { timeout: 5000 });
                console.log(chalk_1.default.blue(`   Found at least one MediaThumbnail image`));
            }
            catch (e) {
                console.log(chalk_1.default.yellow(`   ⚠️  No MediaThumbnail images found initially`));
            }
            // Load more images by clicking the Load More button until we have enough or no more to load
            while (true) {
                // Extract currently visible images
                const currentImages = await this.extractCurrentImages(page, username);
                // Add new images to our collection
                for (const imageInfo of currentImages) {
                    // Check for duplicates by ID and URL
                    const isDuplicateById = images.some(existing => existing.id === imageInfo.id);
                    const isDuplicateByUrl = images.some(existing => existing.url === imageInfo.url);
                    if (!isDuplicateById && !isDuplicateByUrl) {
                        images.push(imageInfo);
                        if (this.config.get("debug")) {
                            console.log(chalk_1.default.green(`   Added new image: ${imageInfo.id} (${imageInfo.url?.substring(0, 50)}...)`));
                        }
                        // Check if we've reached the limit
                        if (maxImages > 0 && images.length >= maxImages) {
                            console.log(chalk_1.default.blue(`   Reached image limit: ${maxImages}`));
                            return images.slice(0, maxImages);
                        }
                    }
                    else {
                        if (this.config.get("debug")) {
                            console.log(chalk_1.default.yellow(`   Skipped duplicate image: ${imageInfo.id} (duplicate by ${isDuplicateById ? 'ID' : 'URL'})`));
                        }
                    }
                }
                console.log(chalk_1.default.blue(`   Currently have ${images.length} images`));
                // Try to find and click the Load More button
                const loadMoreButton = page.locator('#loadMore-Button');
                const isLoadMoreVisible = await loadMoreButton.isVisible({ timeout: 3000 }).catch(() => false);
                if (!isLoadMoreVisible) {
                    console.log(chalk_1.default.blue(`   No more "Load More" button found - reached end`));
                    break;
                }
                if (attempts >= maxLoadMoreAttempts) {
                    console.log(chalk_1.default.yellow(`   Reached maximum load attempts (${maxLoadMoreAttempts})`));
                    break;
                }
                // Click the Load More button
                console.log(chalk_1.default.blue(`   Clicking "Load More" button (attempt ${attempts + 1})...`));
                await loadMoreButton.click();
                attempts++;
                // Wait for new content to load
                await page.waitForTimeout(2000);
            }
            console.log(chalk_1.default.green(`✅ Extracted ${images.length} images from @${username}`));
            return images;
        }
        catch (error) {
            console.error(chalk_1.default.red(`❌ Error extracting images: ${error}`));
            return images; // Return what we have so far
        }
    }
    /**
     * Extract images currently visible on the page.
     *
     * @param page - Playwright page instance
     * @param username - Username for context
     * @returns Array of currently visible image information
     */
    async extractCurrentImages(page, username) {
        const images = [];
        try {
            // Only select images within the UserProfileGallery to avoid profile/avatar images
            const selectors = [
                '[data-testid="UserProfileGallery"] figure.MediaThumbnail img',
                '[data-testid="UserProfileGallery"] .MediaThumbnail img',
                '[data-testid="UserProfileGallery"] img'
            ];
            let mediaThumbnails = [];
            let usedSelector = '';
            for (const selector of selectors) {
                const elements = await page.$$(selector);
                if (this.config.get("debug")) {
                    console.log(chalk_1.default.blue(`   Selector '${selector}': Found ${elements.length} elements`));
                }
                if (elements.length > mediaThumbnails.length) {
                    mediaThumbnails = elements;
                    usedSelector = selector;
                }
            }
            console.log(chalk_1.default.blue(`   Using selector '${usedSelector}': Found ${mediaThumbnails.length} img elements`));
            // Count MediaThumbnail figures inside the gallery (for debug/visibility only)
            const mediaThumbnailFigures = await page.$$('[data-testid="UserProfileGallery"] .MediaThumbnail');
            if (this.config.get("debug")) {
                console.log(chalk_1.default.blue(`   MediaThumbnail figures in gallery: ${mediaThumbnailFigures.length}`));
            }
            for (let i = 0; i < mediaThumbnails.length; i++) {
                const img = mediaThumbnails[i];
                try {
                    const src = await img.getAttribute('src');
                    const srcset = await img.getAttribute('srcset');
                    if (this.config.get("debug")) {
                        console.log(chalk_1.default.gray(`     Image ${i + 1} src: ${src ? src.substring(0, 150) : 'no src'}`));
                        if (srcset) {
                            console.log(chalk_1.default.gray(`     Image ${i + 1} srcset: ${srcset.substring(0, 150)}...`));
                        }
                    }
                    if (src && src.includes('vsco')) {
                        const imageInfo = await this.extractImageInfo(img, src, username);
                        if (imageInfo) {
                            images.push(imageInfo);
                            if (this.config.get("debug")) {
                                console.log(chalk_1.default.green(`     ✅ Successfully extracted image ${i + 1}: ${imageInfo.id}`));
                            }
                        }
                        else {
                            if (this.config.get("debug")) {
                                console.log(chalk_1.default.yellow(`     ⚠️  Failed to extract info for image ${i + 1}`));
                            }
                        }
                    }
                    else {
                        if (this.config.get("debug")) {
                            console.log(chalk_1.default.yellow(`     ⚠️  Image ${i + 1} doesn't contain 'vsco' in src`));
                        }
                    }
                }
                catch (error) {
                    if (this.config.get("debug")) {
                        console.warn(chalk_1.default.yellow(`⚠️  Error extracting image ${i + 1} info: ${error}`));
                    }
                }
            }
        }
        catch (error) {
            if (this.config.get("debug")) {
                console.warn(chalk_1.default.yellow(`⚠️  Error finding MediaThumbnail images: ${error}`));
            }
        }
        return images;
    }
    /**
     * Extract detailed information from an image element.
     *
     * @param imgElement - Playwright element handle for image
     * @param src - Image source URL
     * @param username - Username for context
     * @returns Image information or null if extraction fails
     */
    async extractImageInfo(imgElement, src, username) {
        try {
            // Extract image ID from URL or generate one
            const imageId = this.extractImageIdFromUrl(src) || this.generateImageId(src);
            if (!imageId) {
                return null;
            }
            // Get image dimensions if available
            let width;
            let height;
            try {
                width = await imgElement.evaluate((el) => el.naturalWidth);
                height = await imgElement.evaluate((el) => el.naturalHeight);
            }
            catch (e) {
                // Dimensions not available
            }
            // Try to get alt text as description
            let description;
            try {
                description = await imgElement.getAttribute('alt');
                if (!description || description.trim() === '') {
                    description = undefined;
                }
            }
            catch (e) {
                // No description available
            }
            // Generate different quality URLs
            const originalUrl = this.generateOriginalUrl(src);
            const thumbnailUrl = this.generateThumbnailUrl(src);
            if (this.config.get("debug")) {
                console.log(chalk_1.default.gray(`     Final URLs - Original: ${originalUrl}, Thumbnail: ${thumbnailUrl}`));
            }
            const result = {
                id: imageId,
                url: originalUrl || src,
                thumbnailUrl: thumbnailUrl || src,
            };
            if (originalUrl) {
                result.originalUrl = originalUrl;
            }
            if (width !== undefined) {
                result.width = width;
            }
            if (height !== undefined) {
                result.height = height;
            }
            if (description !== undefined) {
                result.description = description;
            }
            return result;
        }
        catch (error) {
            if (this.config.get("debug")) {
                console.warn(chalk_1.default.yellow(`⚠️  Could not extract image info: ${error}`));
            }
            return null;
        }
    }
    /**
     * Extract image ID from VSCO URL patterns.
     *
     * @param url - Image URL
     * @returns Image ID or null
     */
    extractImageIdFromUrl(url) {
        try {
            // VSCO image URLs often contain the image ID
            // Example: //im.vsco.co/aws-us-west-2/a49b24/66449757/60f6042f56ee7b3727dc1786/vsco60f604326085a.jpg
            const patterns = [
                /\/([a-f0-9]{24})\/vsco[a-f0-9]+\.(jpg|png|webp)/i, // Match the 24-char ID before /vsco
                /\/([a-f0-9]{24})\/[^/]+\.(jpg|png|webp)/i, // Match any 24-char hex ID
                /\/([a-f0-9]+)(?:\.|\/|$)/i,
                /\/media\/([a-f0-9]+)/i,
                /\/gallery\/([a-f0-9]+)/i,
                /id=([a-f0-9]+)/i,
                /vsco([a-f0-9]+)\./i, // Match after 'vsco' prefix
            ];
            if (this.config.get("debug")) {
                console.log(chalk_1.default.gray(`     Extracting ID from URL: ${url}`));
            }
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    if (this.config.get("debug")) {
                        console.log(chalk_1.default.gray(`     Matched pattern, extracted ID: ${match[1]}`));
                    }
                    return match[1];
                }
            }
            if (this.config.get("debug")) {
                console.log(chalk_1.default.gray(`     No pattern matched for URL`));
            }
            return null;
        }
        catch (error) {
            if (this.config.get("debug")) {
                console.log(chalk_1.default.gray(`     Error extracting ID: ${error}`));
            }
            return null;
        }
    }
    /**
     * Generate a unique image ID from URL if pattern extraction fails.
     *
     * @param url - Image URL
     * @returns Generated ID
     */
    generateImageId(url) {
        // Use last part of URL path or hash of URL
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            if (lastPart && lastPart.length > 5) {
                return lastPart.replace(/\.[^/.]+$/, ''); // Remove file extension
            }
            // Fallback: use hash of URL
            return url.split('').reduce((hash, char) => {
                const chr = char.charCodeAt(0);
                hash = ((hash << 5) - hash) + chr;
                return hash & hash; // Convert to 32bit integer
            }, 0).toString(36);
        }
        catch (error) {
            return Date.now().toString(36);
        }
    }
    /**
     * Generate original quality URL from a thumbnail URL.
     *
     * @param url - Thumbnail URL
     * @returns Original URL or null
     */
    generateOriginalUrl(url) {
        try {
            // For VSCO URLs like: //im.vsco.co/aws-us-west-2/a49b24/66449757/60f6042f56ee7b3727dc1786/vsco60f604326085a.jpg?w=480
            // We want to remove the ?w=480 part to get the original size
            // But keep the main URL structure intact
            if (this.config.get("debug")) {
                console.log(chalk_1.default.gray(`     Original URL processing: ${url}`));
            }
            // Remove width/quality parameters but keep the core URL
            let processedUrl = url
                .replace(/\?w=\d+.*$/, '') // Remove ?w=480&dpr=2 etc
                .replace(/\&w=\d+.*$/, '') // Remove &w=480 etc
                .replace(/\?dpr=\d+.*$/, '') // Remove ?dpr=2 etc
                .replace(/\&dpr=\d+.*$/, ''); // Remove &dpr=2 etc
            // Ensure we have a protocol
            if (processedUrl.startsWith('//')) {
                processedUrl = 'https:' + processedUrl;
            }
            if (this.config.get("debug")) {
                console.log(chalk_1.default.gray(`     Processed URL: ${processedUrl}`));
            }
            return processedUrl;
        }
        catch (error) {
            if (this.config.get("debug")) {
                console.log(chalk_1.default.gray(`     Error processing URL: ${error}`));
            }
            return null;
        }
    }
    /**
     * Generate thumbnail URL from an original URL.
     *
     * @param url - Original URL
     * @returns Thumbnail URL or null
     */
    generateThumbnailUrl(url) {
        try {
            // For thumbnails, we might want smaller versions
            // This is a placeholder - actual implementation would depend on VSCO's URL structure
            return url;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Convert scraped profile data to manifest-compatible image entries.
     *
     * @param profileResult - Scraped profile data
     * @returns Array of image entries
     */
    getImageEntries(profileResult) {
        return profileResult.images.map(image => {
            const imageData = {
                image_author: profileResult.displayName || profileResult.username,
                vsco_username: profileResult.username,
                vsco_url: `https://vsco.co/${profileResult.username}/media/${image.id}`,
                vsco_image_id: image.id,
                width: image.width || 0,
                height: image.height || 0,
                description: image.description || '',
                direct_image_url: image.url,
            };
            return [`${profileResult.username}/${image.id}`, imageData];
        });
    }
    /**
     * Validate if a username looks like a valid VSCO username.
     *
     * @param username - Username to validate
     * @returns true if valid format
     */
    static isValidUsername(username) {
        return /^[a-zA-Z0-9_-]+$/.test(username) && username.length >= 2 && username.length <= 50;
    }
    /**
     * Clean and normalize a username.
     *
     * @param input - Raw username input
     * @returns Cleaned username or null if invalid
     */
    static cleanUsername(input) {
        try {
            // Remove common prefixes/suffixes
            let cleaned = input.trim()
                .replace(/^@/, '')
                .replace(/^https?:\/\/(www\.)?vsco\.co\//, '')
                .replace(/\/.*$/, ''); // Remove path parts
            if (this.isValidUsername(cleaned)) {
                return cleaned.toLowerCase();
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
}
exports.VscoProfileScraper = VscoProfileScraper;
