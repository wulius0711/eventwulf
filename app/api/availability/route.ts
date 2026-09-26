import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIp } from "@/lib/ratelimit";
import { BLOCKING_STATUSES } from "@/lib/roomAvailability";

export async function GET(req: NextRequest) {
  if (!(await rateLimit(`availability:${getIp(req)}`, 30, 60 * 1000))) {
    return NextResponse.json([], { status: 429 });
  }
  const slug = req.nextUrl.searchParams.get("slug") ?? "default";
  const roomId = req.nextUrl.searchParams.get("roomId");
  // Mirrors the room picker's own `raeume` filter (see app/page.tsx /
  // app/api/rooms/route.ts) — before a specific room is picked, narrows the
  // event list to just the rooms a filtered embed actually offers, instead
  // of leaking every room's events into a widget that doesn't even list them.
  const raeume = req.nextUrl.searchParams.get("raeume");
  const roomIds = raeume ? raeume.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  try {
    const { prisma } = await import("@/lib/db");
    // Client lookup combined with blockedDates/events/room-inquiries into one
    // round trip (nested select) instead of a lookup followed by three more
    // queries — this endpoint fires on every calendar render.
    const client = await prisma.client.findUnique({
      where: { slug },
      select: {
        id: true,
        blockedDates: { orderBy: { startDate: "asc" } },
        events: {
          where: { isActive: true },
          orderBy: { startDate: "asc" },
          include: { room: { select: { name: true } } },
        },
        inquiries: roomId
          ? {
              where: { roomId, status: { in: BLOCKING_STATUSES } },
              // No id: this response is public, and an Inquiry id is the key to
              // /api/ical/[id] (guest name, title, participant count). Audit
              // 2026-09-26, H2 — the calendar never read it.
              select: { data: true },
            }
          : false,
      },
    });
    if (!client) return NextResponse.json([]);

    const blocked = client.blockedDates;
    const events = client.events;
    const roomInquiries = client.inquiries ?? [];

    // A room's occupied date ranges live inside each Inquiry's JSON `data` blob
    // (datumVon/datumBis), not as real columns — parse them here rather than in
    // the Calendar component, so a malformed row is just skipped, not fatal.
    const roomBlockedEntries = roomInquiries.flatMap((inq) => {
      try {
        const d = JSON.parse(inq.data) as { datumVon?: string; datumBis?: string };
        if (!d.datumVon || !d.datumBis) return [];
        return [{
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
          silent: true, // the Event's own colored banner already explains the block
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
    // Before a room is picked, a `raeume` filter (filtered embed) narrows this the
    // same way — only wider (any offered room), not down to one exact room yet.
    const relevantEvents = roomId
      ? events.filter((e) => !e.roomId || e.roomId === roomId)
      : roomIds
        ? events.filter((e) => !e.roomId || roomIds.includes(e.roomId))
        : events;

    const eventEntries = relevantEvents.map((e) => ({
      id: e.id,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      label: e.name,
      type: "event" as const,
      color: e.color,
      maxCapacity: e.maxParticipants,
      bookedCount: e.bookedCount,
      showCapacity: e.showCapacity,
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
