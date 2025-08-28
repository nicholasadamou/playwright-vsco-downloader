"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PlaywrightImageDownloader_js_1 = require("./src/PlaywrightImageDownloader.js");
async function testGalleryFilter() {
    const downloader = new PlaywrightImageDownloader_js_1.PlaywrightImageDownloader({
        headless: false,
        debug: true,
        limit: 5, // Just test with 5 images
        timeout: 30000,
        dryRun: true // Don't actually download
    });
    // Test with a specific profile
    const config = downloader.getConfig();
    config.username = "nicholasadamou"; // Use the profile from your example
    try {
        console.log("🧪 Testing UserProfileGallery filtering...");
        // Initialize browser
        await downloader.initialize();
        // Scrape profile (this will use our updated logic)
        const profileData = await downloader.scrapeProfileAndGetImages();
        if (profileData) {
            console.log(`✅ Successfully extracted ${profileData.imageEntries.length} gallery images`);
            console.log("📋 Image IDs found:");
            profileData.imageEntries.slice(0, 5).forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry[1].vsco_image_id} - ${entry[1].direct_image_url?.substring(0, 80)}...`);
            });
        }
        else {
            console.log("❌ No profile data returned");
        }
    }
    catch (error) {
        console.error("❌ Test failed:", error);
    }
    finally {
        await downloader.cleanup();
    }
}
// Run the test
testGalleryFilter().catch(console.error);
