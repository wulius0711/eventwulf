import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

// Every rate-limit window is at most an hour (see the call sites of
// lib/ratelimit.ts), so a row whose window hasn't moved in 24h is stale.
const RETENTION_HOURS = 24;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
  const { count } = await prisma.rateLimitEntry.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return NextResponse.json({ ok: true, deleted: count, cutoff: cutoff.toISOString() });
}
