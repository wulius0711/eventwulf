import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIp } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  if (!rateLimit(`availability:${getIp(req)}`, 30, 60 * 1000)) {
    return NextResponse.json([], { status: 429 });
  }
  const slug = req.nextUrl.searchParams.get("slug") ?? "default";
  const roomId = req.nextUrl.searchParams.get("roomId");

  try {
    const { prisma } = await import("@/lib/db");
    const client = await prisma.client.findUnique({ where: { slug } });
    if (!client) return NextResponse.json([]);

    const [blocked, events, roomInquiries] = await Promise.all([
      prisma.blockedDate.findMany({ where: { clientId: client.id }, orderBy: { startDate: "asc" } }),
      prisma.event.findMany({ where: { clientId: client.id, isActive: true }, orderBy: { startDate: "asc" } }),
      roomId
        ? prisma.inquiry.findMany({
            where: { clientId: client.id, roomId, status: { notIn: ["storniert", "abgelehnt", "abgelaufen"] } },
            select: { id: true, data: true },
          })
        : Promise.resolve([]),
    ]);

    // A room's occupied date ranges live inside each Inquiry's JSON `data` blob
    // (datumVon/datumBis), not as real columns — parse them here rather than in
    // the Calendar component, so a malformed row is just skipped, not fatal.
    const roomBlockedEntries = roomInquiries.flatMap((inq) => {
      try {
        const d = JSON.parse(inq.data) as { datumVon?: string; datumBis?: string };
        if (!d.datumVon || !d.datumBis) return [];
        return [{
          id: inq.id,
          startDate: new Date(d.datumVon).toISOString(),
          endDate: new Date(d.datumBis).toISOString(),
          label: "Raum belegt",
          type: "blocked" as const,
          color: "",
          maxCapacity: null,
          bookedCount: 0,
          intern: true,
        }];
      } catch {
        return [];
      }
    });

    // Legacy shape (type/color/maxCapacity/bookedCount) kept for the current Calendar
    // component, which still expects a single merged list. `intern` is new — the
    // Calendar rewrite in a later phase will use it to decide what actually blocks.
    const blockedEntries = blocked.map((b) => ({
      id: b.id,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      label: b.label,
      type: "blocked" as const,
      color: "",
      maxCapacity: null,
      bookedCount: 0,
      intern: true,
    }));

    const eventEntries = events.map((e) => ({
      id: e.id,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      label: e.name,
      type: "event" as const,
      color: e.color,
      maxCapacity: e.maxParticipants,
      bookedCount: e.bookedCount,
      intern: e.intern,
    }));

    return NextResponse.json([...blockedEntries, ...eventEntries, ...roomBlockedEntries]);
  } catch {
    return NextResponse.json([]);
  }
}
