"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationService = void 0;
const chalk_1 = __importDefault(require("chalk"));
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
class AuthenticationService {
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
    constructor(config, browserManager) {
        this.config = config;
        this.browserManager = browserManager;
        this.isLoggedIn = false;
    }
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
    isAuthenticated() {
        return this.isLoggedIn;
    }
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
    async attemptLogin() {
        if (this.isLoggedIn) {
            console.log(chalk_1.default.gray("⏭️  Already logged in, skipping authentication"));
            return true;
        }
        console.log(chalk_1.default.blue("🔐 Attempting to login to VSCO..."));
        try {
            // Check if already logged in by visiting homepage first
            await this.browserManager.navigateToUrl("https://vsco.co");
            // Check if we're already logged in
            if (await this.checkIfAlreadyLoggedIn()) {
                console.log(chalk_1.default.green("✅ Already logged in"));
                this.isLoggedIn = true;
                return true;
            }
            console.log(chalk_1.default.yellow("🔐 Login required..."));
            const credentials = this.config.getAuthCredentials();
            if (!this.config.hasAuthCredentials()) {
                return await this.handleMissingCredentials();
            }
            return await this.performAutomaticLogin(credentials);
        }
        catch (error) {
            console.error(chalk_1.default.red("❌ Error during login attempt:"), error.message);
            return false;
        }
    }
    /**
     * Check if a user is already logged in by looking for the VSCO sign-in button.
     * If the sign-in button exists, user is NOT logged in.
     *
     * @returns true if already logged in, false otherwise
     * @private
     */
    async checkIfAlreadyLoggedIn() {
        try {
            const page = await this.browserManager.getPage();
            // Wait for page to load properly
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            // Check for the specific VSCO sign-in button
            // Based on the provided HTML: <a href="https://vsco.co/user/login" class="button is-outline is-alternate w-inline-block"><div>SIGN IN<br></div></a>
            const signInButton = page.locator('a[href="https://vsco.co/user/login"]');
            const isSignInVisible = await signInButton.isVisible({ timeout: 5000 });
            if (isSignInVisible) {
                console.log(chalk_1.default.gray(`❌ Found VSCO sign-in button - user not logged in`));
                return false;
            }
            else {
                console.log(chalk_1.default.gray(`✅ VSCO sign-in button not found - user is logged in`));
                return true;
            }
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`Warning checking login status: ${error.message}`));
            // If we can't check, assume not logged in for safety
            return false;
        }
    }
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
    async handleMissingCredentials() {
        console.log(chalk_1.default.yellow("⚠️  No credentials found in environment variables."));
        console.log(chalk_1.default.yellow("⚠️  Set VSCO_EMAIL and VSCO_PASSWORD to enable auto-login."));
        if (!this.config.get("headless")) {
            console.log(chalk_1.default.yellow("⚠️  Please log in manually in the browser..."));
            // In non-headless mode, navigate to login page for manual login
            await this.browserManager.navigateToUrl("https://vsco.co/user/login");
            console.log(chalk_1.default.yellow("⏳ Waiting for manual login... (Press Enter when done)"));
            // Wait for user to complete login manually
            await this.waitForManualLogin();
            this.isLoggedIn = true;
            return true;
        }
        else {
            console.log(chalk_1.default.yellow("⚠️  Running in headless mode without credentials."));
            console.log(chalk_1.default.yellow("⚠️  Downloads may be limited or fail."));
            return false;
        }
    }
    /**
     * Wait for the user to complete manual login and press Enter.
     * Creates a readline interface to pause execution until user confirms login completion.
     * Only used in non-headless mode when credentials are missing.
     *
     * @returns Resolves when user presses Enter
     * @private
     */
    async waitForManualLogin() {
        const readline = await Promise.resolve().then(() => __importStar(require("readline")));
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return new Promise((resolve) => {
            rl.question("Press Enter after logging in...", () => {
                rl.close();
                resolve();
            });
        });
    }
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
    async performAutomaticLogin(credentials) {
        try {
            // Navigate directly to login page
            console.log(chalk_1.default.blue("🔗 Navigating to login page..."));
            await this.browserManager.navigateToUrl("https://vsco.co/user/login");
            const page = await this.browserManager.getPage();
            // Wait for VSCO login form to appear - using actual field names
            await page.waitForSelector('input[name="identity"]', {
                timeout: 10000,
            });
            console.log(chalk_1.default.blue("📝 Filling in credentials..."));
            // Fill in email/username (VSCO uses 'identity' field name)
            await page.fill('input[name="identity"]', credentials.email);
            // Wait for the password field and fill it
            await page.waitForSelector('input[name="password"][type="password"]', { timeout: 5000 });
            await page.fill('input[name="password"][type="password"]', credentials.password);
            console.log(chalk_1.default.blue("🚀 Submitting login form..."));
            // Submit login form - VSCO may use different button text
            const loginSubmitButton = page
                .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"], input[type="submit"]')
                .first();
            await loginSubmitButton.click();
            // Wait for navigation
            console.log(chalk_1.default.blue("⏳ Waiting for login to complete..."));
            // Wait a moment for the login to process
            await page.waitForTimeout(3000);
            // Navigate to homepage to ensure we're in the right place
            await this.browserManager.navigateToUrl("https://vsco.co");
            // Verify login was successful - check if login button is still visible
            const stillNeedsLogin = await page
                .locator('a:has-text("Log in"), a:has-text("Sign in"), button:has-text("Log in")')
                .isVisible({ timeout: 3000 })
                .catch(() => false);
            if (stillNeedsLogin) {
                throw new Error("Login did not complete successfully");
            }
            console.log(chalk_1.default.green("✅ Successfully logged in"));
            this.isLoggedIn = true;
            return true;
        }
        catch (error) {
            console.log(chalk_1.default.yellow("⚠️  Auto-login failed:", error.message));
            console.log(chalk_1.default.yellow("⚠️  Continuing without authentication..."));
            return false;
        }
    }
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
    reset() {
        this.isLoggedIn = false;
    }
}
exports.AuthenticationService = AuthenticationService;
