import { timingSafeEqual } from "crypto";

// Shared primitive for every secret comparison in the project (cron auth
// here, and PROVISIONING_SECRET in /api/provision) — length-checked first
// since timingSafeEqual itself throws on mismatched buffer lengths rather
// than returning false.
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

// Vercel sends the CRON_SECRET value as `Authorization: Bearer <secret>` on
// scheduled invocations (not a custom header) — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization") ?? "";
  return timingSafeEqualStrings(authHeader, `Bearer ${cronSecret}`);
}
