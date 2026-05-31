/**
 * Environment variable validation helper.
 * Call assertEnv() at the top of each API handler to fail fast with a clear error
 * instead of an opaque "Cannot read properties of undefined" crash.
 */

/**
 * Assert that all required environment variables are set.
 * Throws if any are missing, so the handler returns 500 with a clear message.
 * @param {string[]} required - List of required env var names.
 * @throws {Error} If any required variable is missing.
 */
function assertEnv(required) {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { assertEnv };
