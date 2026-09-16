import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findUnavailableRoomIds } from "@/lib/roomAvailability";
import { isValidDate } from "@/lib/validate";
import { hasFeature, isPlan } from "@/lib/plan";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json([], { status: 200 });

  // Client lookup and its rooms combined into one round trip (nested select)
  // instead of two sequential queries — this endpoint is on the critical path
  // for the room picker's initial render.
  const client = await prisma.client.findUnique({
    where: { slug },
    select: {
      id: true,
      organization: { select: { plan: true } },
      rooms: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          image: true,
          capacity: true,
        },
      },
    },
  });
  if (!client) return NextResponse.json([], { status: 200 });

  // Rooms are a Pro+ feature — see app/page.tsx for the matching gate on the
  // initial server-rendered list.
  const orgPlan = isPlan(client.organization?.plan) ? client.organization.plan : "basis";
  const rooms = hasFeature(orgPlan, "rooms") ? client.rooms : [];

  // Optional: annotate each room with whether it's free for a given date range, so
  // the room picker can gray out rooms already occupied before a room is chosen.
  const datumVon = req.nextUrl.searchParams.get("datumVon");
  const datumBis = req.nextUrl.searchParams.get("datumBis");
  if (isValidDate(datumVon) && isValidDate(datumBis)) {
    const unavailable = await findUnavailableRoomIds(rooms.map((r) => r.id), datumVon, datumBis);
    return NextResponse.json(rooms.map((r) => ({ ...r, available: !unavailable.has(r.id) })));
  }

  return NextResponse.json(rooms);
}
