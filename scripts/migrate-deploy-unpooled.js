// prisma migrate deploy's internal migration lock is a session-scoped
// pg_advisory_lock, which doesn't survive Neon's pooled/transaction-mode
// backend reuse (the same issue fixed for the test DB in playwright.config.ts's
// pretest step — see the launch-readiness audit notes on Fund 10). Derive the
// unpooled host from DATABASE_URL here rather than requiring a second
// correctly-configured env var in Vercel, which would be one more thing to
// get wrong or forget.
const { execSync } = require("child_process");

const pooled = process.env.DATABASE_URL;
if (!pooled) {
  console.error("DATABASE_URL is not set — cannot run migrate deploy.");
  process.exit(1);
}

const unpooled = pooled.replace("-pooler.", ".");

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: unpooled },
});
