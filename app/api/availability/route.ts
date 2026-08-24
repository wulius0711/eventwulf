import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIp } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  if (!rateLimit(`availability:${getIp(req)}`, 30, 60 * 1000)) {
    return NextResponse.json([], { status: 429 });
  }
  const slug = req.nextUrl.searchParams.get("slug") ?? "default";

  try {
    const { prisma } = await import("@/lib/db");
    const client = await prisma.client.findUnique({ where: { slug } });
    if (!client) return NextResponse.json([]);

    const [blocked, events] = await Promise.all([
      prisma.blockedDate.findMany({ where: { clientId: client.id }, orderBy: { startDate: "asc" } }),
      prisma.event.findMany({ where: { clientId: client.id, isActive: true }, orderBy: { startDate: "asc" } }),
    ]);

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

    return NextResponse.json([...blockedEntries, ...eventEntries]);
  } catch {
    return NextResponse.json([]);
  }
}
