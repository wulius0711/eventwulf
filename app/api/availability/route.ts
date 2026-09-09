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
      prisma.event.findMany({
        where: { clientId: client.id, isActive: true },
        orderBy: { startDate: "asc" },
        include: { room: { select: { name: true } } },
      }),
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

    // An Event assigned to the selected room occupies it for its whole date range,
    // regardless of the Event's own `intern` flag (which only governs the general
    // calendar) — a room can't be double-booked by an inquiry during that Event.
    const roomEventBlockedEntries = roomId
      ? events.filter((e) => e.roomId === roomId).map((e) => ({
          id: `event-${e.id}`,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate.toISOString(),
          label: "Raum belegt (Event)",
          type: "blocked" as const,
          color: "",
          maxCapacity: null,
          bookedCount: 0,
          intern: true,
        }))
      : [];

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

    // Once a specific room is selected, an Event assigned to a DIFFERENT room is
    // irrelevant to it — it shouldn't show up there at all, not even informationally.
    // Room-less events (unknown which space) still show everywhere, same as before.
    const relevantEvents = roomId ? events.filter((e) => !e.roomId || e.roomId === roomId) : events;

    const eventEntries = relevantEvents.map((e) => ({
      id: e.id,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      label: e.name,
      type: "event" as const,
      color: e.color,
      maxCapacity: e.maxParticipants,
      bookedCount: e.bookedCount,
      // Once an Event is tied to a specific room, its "intern" blocking is scoped to
      // that room (via roomEventBlockedEntries) — it must not also block every other
      // room's calendar or the general no-room-selected view. Only a room-less intern
      // Event (we don't know which physical space it occupies) keeps blocking everything.
      intern: e.roomId ? false : e.intern,
      roomName: e.room?.name ?? null,
    }));

    return NextResponse.json([...blockedEntries, ...eventEntries, ...roomBlockedEntries, ...roomEventBlockedEntries]);
  } catch {
    return NextResponse.json([]);
  }
}
