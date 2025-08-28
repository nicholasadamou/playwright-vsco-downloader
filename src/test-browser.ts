#!/usr/bin/env tsx
/**
 * @fileoverview Simple script to launch Playwright browser for testing purposes.
 * This script launches a browser without request interception to properly render VSCO,
 * navigates to VSCO, and keeps the browser open for manual testing.
 */

import { chromium } from "playwright";
import { Config } from "./config/Config.js";
import chalk from "chalk";
import type { Browser, BrowserContext, Page } from "playwright";

/**
 * Test Browser Manager that doesn't use request interception
 * This allows websites like VSCO to render properly with all assets
 */
class TestBrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue("🚀 Initializing test browser..."));

    // Launch browser with test-friendly settings
    this.browser = await chromium.launch({
      headless: this.config.get("headless") || false,
      devtools: this.config.get("debug") || true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });

    // Create context with same settings as main BrowserManager
    this.context = await this.browser.newContext({
      ...this.config.getContextConfig(),
      // Override with test-specific settings
      // Add extra headers to appear more like a real browser
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Create a new page
    this.page = await this.context.newPage();

    console.log(chalk.green("✅ Test browser initialized (no request blocking)"));
  }

  async navigateToUrl(url: string): Promise<void> {
    if (!this.page) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }

    console.log(chalk.blue(`🌐 Navigating to ${url}...`));
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    // Wait a bit more for dynamic content to load
    await this.page.waitForTimeout(2000);
  }

  getPage(): Page | null {
    return this.page;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.log(
        chalk.yellow(`Warning during cleanup: ${(error as Error).message}`)
      );
    }
  }
}

/**
 * Main function that launches the browser for testing
 */
async function launchTestBrowser() {
  console.log(chalk.blue("🚀 Starting Playwright Test Browser..."));
  console.log(chalk.gray("   (No request interception - full website rendering)"));

  // Create config with non-headless mode and debug enabled
  const config = new Config({
    headless: false,
    debug: true,
    timeout: 30000,
  });

  const browserManager = new TestBrowserManager(config);

  try {
    // Initialize the browser
    await browserManager.initialize();
    console.log(chalk.green("✅ Browser launched successfully"));

    // Navigate to VSCO
    await browserManager.navigateToUrl("https://vsco.co");
    
    console.log(chalk.green("✅ Browser is ready for testing!"));
    console.log(chalk.yellow("📝 The browser will stay open for manual testing."));
    console.log(chalk.yellow("   All CSS, JS, and images should load properly."));
    console.log(chalk.yellow("   Press Ctrl+C to close the browser and exit."));

    // Keep the process alive and wait for user to close
    process.on('SIGINT', async () => {
      console.log(chalk.blue("\n🧹 Closing browser..."));
      await browserManager.cleanup();
      console.log(chalk.green("✅ Browser closed. Goodbye!"));
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});

  } catch (error) {
    console.error(chalk.red("❌ Error launching browser:"), error);
    await browserManager.cleanup();
    process.exit(1);
  }
}

// Run the script
launchTestBrowser();
