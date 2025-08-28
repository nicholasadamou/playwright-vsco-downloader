import type { StatsData, ManifestSummary, DownloadResult } from "../types/index.js";
import type { Config } from "../config/Config.js";
/**
 * @fileoverview Statistics tracker for download metrics and reporting.
 * Provides comprehensive tracking, calculation, and display of download statistics
 * including success rates, timing, progress tracking, and formatted output.
 *
 * Key Features:
 * - Download progress tracking (total, downloaded, failed, skipped)
 * - Timing and performance metrics
 * - Success rate calculations
 * - Progress percentage tracking
 * - Formatted output and reporting
 * - Configuration display utilities
 * - Manifest summary generation
 *
 * Statistics Tracking:
 * - Real-time counter updates
 * - Duration measurement
 * - Rate calculations
 * - Storage usage tracking
 * - Progress indicators
 *
 * @example
 * ```javascript
 * const statsTracker = new StatsTracker();
 *
 * // Set up tracking
 * statsTracker.setTotal(100);
 * statsTracker.startTiming();
 *
 * // Update counters during downloads
 * statsTracker.incrementDownloaded();
 * statsTracker.incrementFailed();
 * statsTracker.incrementSkipped();
 *
 * // Display final results
 * statsTracker.endTiming();
 * statsTracker.displayResults(totalStorageBytes);
 *
 * console.log('Success rate:', statsTracker.getSuccessRate() + '%');
 * ```
 */
/**
 * Statistics tracker for download metrics and reporting.
 * Follows the Single Responsibility Principle by handling only statistics-related operations.
 * Provides real-time tracking and comprehensive reporting of download operations.
 */
export declare class StatsTracker {
    private stats;
    private startTime;
    private endTime;
    constructor();
    /**
     * Reset all statistics to initial state
     */
    reset(): void;
    /**
     * Start timing the operation
     */
    startTiming(): void;
    /**
     * End timing the operation
     */
    endTiming(): void;
    /**
     * Get elapsed time in seconds
     */
    getElapsedTime(): number;
    /**
     * Set the total number of items to process
     */
    setTotal(total: number): void;
    /**
     * Increment downloaded count
     */
    incrementDownloaded(): void;
    /**
     * Increment failed count
     */
    incrementFailed(): void;
    /**
     * Increment skipped count
     */
    incrementSkipped(): void;
    /**
     * Get current statistics
     */
    getStats(): StatsData;
    /**
     * Get progress percentage
     */
    getProgress(): number;
    /**
     * Check if all items have been processed
     */
    isComplete(): boolean;
    /**
     * Get summary statistics object for manifests
     */
    getSummaryForManifest(): ManifestSummary;
    /**
     * Get success rate as percentage
     */
    getSuccessRate(): number;
    /**
     * Display configuration summary
     */
    displayConfiguration(config: Config): void;
    /**
     * Display final results summary
     */
    displayResults(totalStorageBytes?: number): void;
    /**
     * Display progress during downloads
     */
    displayProgress(currentItem: any, photoId: string): void;
    /**
     * Display failed items summary
     */
    displayFailedItems(failedResults: DownloadResult[]): void;
    /**
     * Get a formatted duration string
     */
    getFormattedDuration(): string;
    /**
     * Display completion message
     */
    displayCompletion(): void;
}
