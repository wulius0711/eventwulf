import { timingSafeEqual } from "crypto";

// Vercel sends the CRON_SECRET value as `Authorization: Bearer <secret>` on
// scheduled invocations (not a custom header) — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  return authBuf.length === expectedBuf.length && timingSafeEqual(authBuf, expectedBuf);
}
