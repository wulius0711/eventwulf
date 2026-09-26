import { defineConfig } from "@playwright/test";

const PORT = 3100;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// Fixed dummy credentials for third-party services and the session-signing
// key. .env.local carries the production Bunny storage key, the production
// JWT_SECRET and (until recently) a live-mode Stripe key (see
// run_tests_with_env.mjs), and the spawned server inherits process.env — so
// without this, a test could delete files in the production Bunny zone, call
// the live Stripe account, or sign sessions with the production key. Assigned to process.env (not just to
// webServer.env below) on purpose: the test workers load this config too, and
// several specs read these same variables (the webhook spec signs its payload
// with STRIPE_WEBHOOK_SECRET; the image-URL spec builds URLs from
// BUNNY_CDN_HOST), so the workers and the server must agree on the values.
// Unconditional, so a value from .env.local can never win.
//
// SUPERADMIN_SLUG is deliberately NOT pinned: the superadmin Client that the
// superadmin specs log in through lives in the test DB under the real slug
// (see scripts/one-off/replace-test-superadmin-seed.mjs), so a dummy would
// break them. It is a name, not a secret.
const TEST_SERVICE_ENV = {
  BUNNY_STORAGE_ZONE: "test-zone",
  BUNNY_STORAGE_KEY: "test-key",
  BUNNY_CDN_HOST: "cdn.test.invalid",
  STRIPE_SECRET_KEY: "sk_test_playwright_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_playwright_test_secret",
  JWT_SECRET: "playwright-test-jwt-secret-not-for-production",
};
Object.assign(process.env, TEST_SERVICE_ENV);

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
      // Dummy Bunny/Stripe/JWT credentials — see TEST_SERVICE_ENV above. Nothing in
      // the suite may reach the production storage zone or the live Stripe account.
      ...TEST_SERVICE_ENV,
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
      // See app/api/stripe/checkout/route.ts — STRIPE_SECRET_KEY here is a
      // live-mode key, so this route must never make a real Stripe API call
      // under test. Swaps in a fake client whose create() throws instead,
      // so the active-subscription guard is verifiable over real HTTP
      // without ever reaching the network.
      STRIPE_CHECKOUT_FAKE_FOR_TESTS: "true",
    },
  },
});
