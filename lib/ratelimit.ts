import { createHash } from "crypto";
import { prisma } from "@/lib/db";

// Fixed-window counter kept in Postgres: one atomic UPSERT, so the count is
// shared and race-safe across concurrent serverless instances (an in-memory
// Map isn't — every instance has its own). Keys are hashed so no IP addresses
// or e-mail addresses are stored. Stale rows are removed by
// /api/cron/cleanup-rate-limits.
//
// Returns true while the caller is within the limit. If the database call
// itself fails, the request is let through (and logged): a broken counter
// shouldn't take the booking form or the login down with it.
export async function rateLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  // Only set in the test webServer env (playwright.config.ts) — regression tests fire
  // many requests from the same IP in quick succession and must not trip this limiter.
  if (process.env.RATELIMIT_DISABLED === "true") return true;

  const hashedKey = createHash("sha256").update(key).digest("hex");
  const windowStart = new Date(Date.now() - windowMs);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitEntry" (key, count, "windowStart")
      VALUES (${hashedKey}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "RateLimitEntry"."windowStart" < ${windowStart} THEN 1 ELSE "RateLimitEntry".count + 1 END,
        "windowStart" = CASE WHEN "RateLimitEntry"."windowStart" < ${windowStart} THEN now() ELSE "RateLimitEntry"."windowStart" END
      RETURNING count;
    `;
    return rows[0].count <= maxRequests;
  } catch (e) {
    console.error("[ratelimit] counter unavailable, letting the request through:", e);
    return true;
  }
}

// Durchgang 1, Fund 6: empirically verified against a real Vercel deployment
// (a temporary diagnostic route, sending fabricated X-Forwarded-For/X-Real-IP
// values) — Vercel's edge overwrites all of these with the genuine client IP
// before the app ever sees them; a client-supplied value is discarded, never
// forwarded. So this isn't an active spoofing vector on the current
// deployment. Two hardenings kept anyway, matching Vercel's own guidance:
// x-vercel-forwarded-for first (per Vercel's docs, this is the one that
// stays trustworthy even if something else proxies in front of Vercel
// someday, whereas plain x-forwarded-for could then be overwritten again by
// that new layer); and the LAST entry of a comma-separated list, not the
// first, in case such a chain ever legitimately exists — the first entry is
// the earliest (potentially client-supplied, least-trusted) hop, the last
// is the one closest to us.
export function getIp(req: Request): string {
  const headers = req.headers as Headers;
  const raw = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
  if (!raw) return "unknown";
  const parts = raw.split(",").map((p) => p.trim());
  return parts[parts.length - 1] || "unknown";
}
