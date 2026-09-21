import { defineConfig } from "@playwright/test";

const PORT = 3100;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set — regression tests must run against the dedicated Neon test branch, never the dev/production DATABASE_URL."
  );
}

export default defineConfig({
  testDir: "./__tests__",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    // next start (not next dev) so route-compilation-on-first-request doesn't
    // skew the timing of the advisory-lock concurrency test.
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      // Deliberately invalid — /api/submit no longer depends on email delivery
      // for its success response (Phase 1, Fund 9), so tests don't need real
      // Resend sends and must not spam the production account/quota.
      RESEND_API_KEY: "test_invalid_key",
      // See lib/ratelimit.ts — regression tests fire many requests from the
      // same IP in quick succession and must not trip the 5-req/10min limiter.
      RATELIMIT_DISABLED: "true",
      // The Have-I-Been-Pwned lookup needs the network and would reject the fixed test passwords.
      PASSWORD_BREACH_CHECK_DISABLED: "true",
      // Not set anywhere else locally, so cron endpoints 401 without this —
      // fixed value only for the test server, never used against real data.
      CRON_SECRET: "test-cron-secret",
      // Same reasoning as CRON_SECRET, for /api/provision.
      PROVISIONING_SECRET: "test-provisioning-secret",
    },
  },
});
