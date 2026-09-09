import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.inquiry.findMany({
    where: {
      status: { in: ["neu", "in_pruefung", "angebot_versendet"] },
      holdExpiresAt: { lt: new Date() },
      roomId: { not: null },
    },
    select: { id: true },
  });

  let released = 0;
  const errors: string[] = [];

  for (const inq of expired) {
    try {
      // No capacity to release — a room's availability is computed live from
      // non-cancelled inquiries, so flipping the status alone frees the slot.
      await prisma.inquiry.update({
        where: { id: inq.id },
        data: { status: "abgelaufen", holdExpiresAt: null },
      });
      released++;
    } catch (e) {
      errors.push(`${inq.id}: ${e}`);
    }
  }

  return NextResponse.json({ released, errors });
}
