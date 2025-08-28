import type { Config } from "../config/Config.js";
import type { BrowserManager } from "../browser/BrowserManager.js";
/**
 * @fileoverview Authentication service for VSCO. Provides automatic and
 * manual login flows using Playwright, tracks session state, and exposes
 * helpers to query/reset authentication.
 *
 * Key Features:
 * - Automatic login with environment credentials
 * - Manual login flow in non-headless mode
 * - Session state tracking
 * - Credential validation
 * - Graceful fallback handling
 *
 * Authentication Flow:
 * 1. Check if already logged in
 * 2. Attempt automatic login with credentials
 * 3. Fall back to manual login if needed
 * 4. Handle missing credentials gracefully
 *
 * @example
 * ```javascript
 * const config = new Config();
 * const browserManager = new BrowserManager(config);
 * const authService = new AuthenticationService(config, browserManager);
 *
 * await browserManager.initialize();
 * const success = await authService.attemptLogin();
 * console.log('Authenticated:', success);
 * ```
 */
/**
 * Authentication service for VSCO login operations.
 * Follows Single Responsibility Principle by handling only authentication concerns.
 * Manages both automatic and manual login workflows with proper error handling.
 */
export declare class AuthenticationService {
    private readonly config;
    private readonly browserManager;
    private isLoggedIn;
    /**
     * Create a new authentication service instance.
     *
     * @param config - Configuration instance
     * @param browserManager - Browser manager instance
     * @example
     * ```javascript
     * const config = new Config();
     * const browserManager = new BrowserManager(config);
     * const authService = new AuthenticationService(config, browserManager);
     * ```
     */
    constructor(config: Config, browserManager: BrowserManager);
    /**
     * Check if the user is already authenticated in the current session.
     * Returns the internal authentication state without performing any checks.
     *
     * @returns true if authentication was successful, false otherwise
     * @example
     * ```javascript
     * const authService = new AuthenticationService(config, browserManager);
     * console.log(authService.isAuthenticated()); // false initially
     * await authService.attemptLogin();
     * console.log(authService.isAuthenticated()); // true if login succeeded
     * ```
     */
    isAuthenticated(): boolean;
    /**
     * Attempt to log in to Unsplash using the configured authentication strategy.
     *
     * This method orchestrates the entire login flow:
     * 1. Skip if already authenticated
     * 2. Check if the session is already logged in
     * 3. Attempt automatic login with environment credentials
     * 4. Fall back to manual login in non-headless mode
     * 5. Handle missing credentials gracefully
     *
     * @returns true if authenticated by the end of the routine
     * @example
     * ```javascript
     * const authService = new AuthenticationService(config, browserManager);
     * await browserManager.initialize();
     *
     * const success = await authService.attemptLogin();
     * if (success) {
     *   console.log('Ready to download images');
     * } else {
     *   console.log('Downloads may be limited');
     * }
     * ```
     */
    attemptLogin(): Promise<boolean>;
    /**
     * Check if a user is already logged in by looking for the VSCO sign-in button.
     * If the sign-in button exists, user is NOT logged in.
     *
     * @returns true if already logged in, false otherwise
     * @private
     */
    private checkIfAlreadyLoggedIn;
    /**
     * Handle the case when authentication credentials are missing from environment.
     * Provides different strategies based on headless mode:
     * - In non-headless mode: Navigate to login page and wait for manual login
     * - In headless mode: Warn user and continue without authentication
     *
     * @returns true if the flow ends with a logged-in session
     * @example
     * ```javascript
     * // Non-headless mode - user can log in manually
     * const config = new Config({ headless: false });
     * // ... browser will open for manual login
     *
     * // Headless mode - continues without authentication
     * const config = new Config({ headless: true });
     * // ... shows warning but continues
     * ```
     * @private
     */
    private handleMissingCredentials;
    /**
     * Wait for the user to complete manual login and press Enter.
     * Creates a readline interface to pause execution until user confirms login completion.
     * Only used in non-headless mode when credentials are missing.
     *
     * @returns Resolves when user presses Enter
     * @private
     */
    private waitForManualLogin;
    /**
     * Perform automatic login using provided email and password credentials.
     * Navigates to the login page, fills form fields, submits, and verifies success.
     *
     * @param credentials - Email and password for login
     * @returns true if login succeeds, false otherwise
     * @throws Does not throw - catches and logs errors internally
     * @example
     * ```javascript
     * const credentials = { email: 'user@example.com', password: 'secret' };
     * const success = await authService.performAutomaticLogin(credentials);
     * if (success) {
     *   console.log('Auto-login successful');
     * }
     * ```
     * @private
     */
    private performAutomaticLogin;
    /**
     * Reset authentication state to unauthenticated.
     * Clears the internal login flag, useful for testing or when switching users.
     * Does not perform any browser operations - only resets internal state.
     *
     * @example
     * ```javascript
     * const authService = new AuthenticationService(config, browserManager);
     * await authService.attemptLogin();
     * console.log(authService.isAuthenticated()); // true
     *
     * authService.reset();
     * console.log(authService.isAuthenticated()); // false
     * ```
     */
    reset(): void;
}
