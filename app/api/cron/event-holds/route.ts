import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { releaseEventCapacity } from "@/lib/eventCapacity";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.inquiry.findMany({
    where: {
      status: { in: ["neu", "in_pruefung", "angebot_versendet"] },
      holdExpiresAt: { lt: new Date() },
      eventId: { not: null },
    },
  });

  let released = 0;
  const errors: string[] = [];

  for (const inq of expired) {
    try {
      if (inq.eventId && inq.participantCount > 0) {
        await releaseEventCapacity(inq.eventId, inq.participantCount);
      }
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
