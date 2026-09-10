import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No capacity to release — a room's availability is computed live from
  // non-cancelled inquiries, so flipping the status alone frees the slot.
  // Single conditional UPDATE (not read-then-write) so a booking an admin
  // confirmed moments earlier can't be raced past.
  const { count: released } = await prisma.inquiry.updateMany({
    where: {
      status: { in: ["neu", "in_pruefung", "angebot_versendet"] },
      holdExpiresAt: { lt: new Date() },
      roomId: { not: null },
    },
    data: { status: "abgelaufen", holdExpiresAt: null },
  });

  return NextResponse.json({ released, errors: [] });
}
