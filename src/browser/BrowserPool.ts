import { chromium } from "playwright";
import chalk from "chalk";
import type {
  Browser,
  BrowserContext,
  Page,
} from "playwright";
import type { Config } from "../config/Config.js";

/**
 * @fileoverview Browser pool manager for handling multiple browser contexts.
 * Provides concurrent browser contexts with proper resource management and cleanup.
 * 
 * Key Features:
 * - Pool of browser contexts for concurrent operations
 * - Automatic context reuse and rotation
 * - Proper resource cleanup and error handling
 * - Rate limiting and throttling support
 * 
 * @example
 * ```javascript
 * const config = new Config({ maxConcurrency: 5 });
 * const browserPool = new BrowserPool(config);
 * 
 * await browserPool.initialize();
 * 
 * // Get a context for use
 * const context = await browserPool.getContext();
 * const page = await context.newPage();
 * 
 * // Use the page...
 * 
 * // Release context back to pool
 * await browserPool.releaseContext(context);
 * 
 * await browserPool.cleanup();
 * ```
 */

/**
 * Browser pool item representing a managed browser context
 */
interface PooledContext {
  /** Browser context instance */
  context: BrowserContext;
  /** Whether this context is currently in use */
  inUse: boolean;
  /** When this context was created */
  createdAt: number;
  /** When this context was last used */
  lastUsedAt: number;
  /** Number of times this context has been used */
  useCount: number;
}

/**
 * Browser pool manager for handling multiple browser contexts.
 * Manages a pool of browser contexts to enable concurrent operations
 * while respecting system resources and rate limits.
 */
export class BrowserPool {
  private readonly config: Config;
  private browser: Browser | null = null;
  private readonly contextPool: PooledContext[] = [];
  private readonly maxPoolSize: number;
  private readonly contextLifetime: number = 300000; // 5 minutes
  private readonly maxContextUses: number = 100;

  /**
   * Create a new browser pool instance.
   * 
   * @param config - Configuration instance
   * @example
   * ```typescript
   * const config = new Config({ maxConcurrency: 5 });
   * const browserPool = new BrowserPool(config);
   * ```
   */
  constructor(config: Config) {
    this.config = config;
    this.maxPoolSize = config.get("maxConcurrency") || 3;
  }

  /**
   * Initialize the browser pool.
   * Launches browser instance and pre-creates initial contexts.
   * 
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} When browser launch fails
   * @example
   * ```javascript
   * await browserPool.initialize();
   * console.log('Browser pool ready');
   * ```
   */
  async initialize(): Promise<void> {
    if (this.config.get("debug")) {
      console.log(chalk.blue(`🚀 Initializing browser pool (max: ${this.maxPoolSize} contexts)...`));
    }

    this.browser = await chromium.launch(this.config.getBrowserConfig());

    // Pre-create initial contexts (start with 1, grow as needed)
    await this.createContext();

    if (this.config.get("debug")) {
      console.log(chalk.green(`✅ Browser pool initialized with ${this.contextPool.length} contexts`));
    }
  }

  /**
   * Get an available browser context from the pool.
   * Creates new context if pool is empty and under limit.
   * 
   * @returns Promise resolving to an available browser context
   * @throws {Error} When no browser is available or pool creation fails
   * @example
   * ```javascript
   * const context = await browserPool.getContext();
   * const page = await context.newPage();
   * // Use the page...
   * await browserPool.releaseContext(context);
   * ```
   */
  async getContext(): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error("Browser pool not initialized. Call initialize() first.");
    }

    // Clean up stale contexts first
    await this.cleanupStaleContexts();

    // Find available context
    let pooledContext = this.contextPool.find(pc => !pc.inUse);

    // If no available context and we can create more
    if (!pooledContext && this.contextPool.length < this.maxPoolSize) {
      pooledContext = await this.createContext();
    }

    // If still no context available, wait for one to be released
    if (!pooledContext) {
      // In a production system, you might want to implement a queue here
      // For now, reuse the least recently used context
      pooledContext = this.contextPool
        .filter(pc => !pc.inUse)
        .sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];

      if (!pooledContext) {
        throw new Error("No browser contexts available and pool is at capacity");
      }
    }

    // Mark as in use
    pooledContext.inUse = true;
    pooledContext.lastUsedAt = Date.now();
    pooledContext.useCount++;

    if (this.config.get("debug")) {
      console.log(chalk.gray(`📱 Context acquired (pool: ${this.getPoolStats()})`));
    }

    return pooledContext.context;
  }

  /**
   * Release a browser context back to the pool.
   * Marks the context as available for reuse.
   * 
   * @param context - Browser context to release
   * @returns Promise that resolves when context is released
   * @example
   * ```javascript
   * const context = await browserPool.getContext();
   * // Use context...
   * await browserPool.releaseContext(context);
   * ```
   */
  async releaseContext(context: BrowserContext): Promise<void> {
    const pooledContext = this.contextPool.find(pc => pc.context === context);
    
    if (!pooledContext) {
      console.warn(chalk.yellow("⚠️  Attempted to release unknown context"));
      return;
    }

    // Close all pages in the context to free memory
    const pages = context.pages();
    for (const page of pages) {
      try {
        await page.close();
      } catch (error) {
        if (this.config.get("debug")) {
          console.log(chalk.gray(`Could not close page: ${(error as Error).message}`));
        }
      }
    }

    pooledContext.inUse = false;

    if (this.config.get("debug")) {
      console.log(chalk.gray(`📱 Context released (pool: ${this.getPoolStats()})`));
    }

    // If context has been used too much, replace it
    if (pooledContext.useCount >= this.maxContextUses) {
      await this.replaceContext(pooledContext);
    }
  }

  /**
   * Create a new browser context and add it to the pool.
   * 
   * @returns Promise resolving to the new pooled context
   * @throws {Error} When context creation fails
   * @private
   */
  private async createContext(): Promise<PooledContext> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const context = await this.browser.newContext(this.config.getContextConfig());
    
    const pooledContext: PooledContext = {
      context,
      inUse: false,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0,
    };

    this.contextPool.push(pooledContext);

    if (this.config.get("debug")) {
      console.log(chalk.gray(`🆕 New context created (pool size: ${this.contextPool.length})`));
    }

    return pooledContext;
  }

  /**
   * Replace a context with a fresh one.
   * Closes the old context and creates a new one in its place.
   * 
   * @param pooledContext - Context to replace
   * @returns Promise that resolves when replacement is complete
   * @private
   */
  private async replaceContext(pooledContext: PooledContext): Promise<void> {
    const index = this.contextPool.indexOf(pooledContext);
    if (index === -1) return;

    try {
      await pooledContext.context.close();
    } catch (error) {
      if (this.config.get("debug")) {
        console.log(chalk.gray(`Could not close stale context: ${(error as Error).message}`));
      }
    }

    // Remove old context
    this.contextPool.splice(index, 1);

    // Create new context if we're below max pool size
    if (this.contextPool.length < this.maxPoolSize) {
      try {
        await this.createContext();
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to create replacement context: ${(error as Error).message}`));
      }
    }
  }

  /**
   * Clean up stale or overused contexts.
   * Removes contexts that are too old or have been used too many times.
   * 
   * @returns Promise that resolves when cleanup is complete
   * @private
   */
  private async cleanupStaleContexts(): Promise<void> {
    const now = Date.now();
    const staleContexts = this.contextPool.filter(pc => 
      !pc.inUse && (
        now - pc.createdAt > this.contextLifetime ||
        pc.useCount >= this.maxContextUses
      )
    );

    for (const staleContext of staleContexts) {
      await this.replaceContext(staleContext);
    }
  }

  /**
   * Get pool statistics for debugging.
   * 
   * @returns String describing pool status
   * @private
   */
  private getPoolStats(): string {
    const total = this.contextPool.length;
    const inUse = this.contextPool.filter(pc => pc.inUse).length;
    const available = total - inUse;
    return `${inUse}/${total} in use, ${available} available`;
  }

  /**
   * Get the current pool size.
   * 
   * @returns Current number of contexts in pool
   * @example
   * ```javascript
   * console.log(`Pool size: ${browserPool.getPoolSize()}`);
   * ```
   */
  getPoolSize(): number {
    return this.contextPool.length;
  }

  /**
   * Get the number of available contexts.
   * 
   * @returns Number of contexts not currently in use
   * @example
   * ```javascript
   * console.log(`Available contexts: ${browserPool.getAvailableCount()}`);
   * ```
   */
  getAvailableCount(): number {
    return this.contextPool.filter(pc => !pc.inUse).length;
  }

  /**
   * Clean up all browser resources.
   * Closes all contexts and the browser instance.
   * Should always be called when done with the pool.
   * 
   * @returns Promise that resolves when cleanup is complete
   * @example
   * ```javascript
   * try {
   *   await browserPool.initialize();
   *   // Use the pool...
   * } finally {
   *   await browserPool.cleanup();
   * }
   * ```
   */
  async cleanup(): Promise<void> {
    try {
      // Close all contexts
      for (const pooledContext of this.contextPool) {
        try {
          await pooledContext.context.close();
        } catch (error) {
          if (this.config.get("debug")) {
            console.log(chalk.gray(`Could not close context: ${(error as Error).message}`));
          }
        }
      }

      // Clear the pool
      this.contextPool.length = 0;

      // Close the browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      if (this.config.get("debug")) {
        console.log(chalk.gray("🧹 Browser pool cleanup completed"));
      }
    } catch (error) {
      console.log(
        chalk.yellow(`Warning during browser pool cleanup: ${(error as Error).message}`)
      );
    }
  }
}
