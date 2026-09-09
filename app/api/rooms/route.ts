import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findUnavailableRoomIds } from "@/lib/roomAvailability";
import { isValidDate } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json([], { status: 200 });

  const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
  if (!client) return NextResponse.json([], { status: 200 });

  const rooms = await prisma.room.findMany({
    where: { clientId: client.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      capacity: true,
    },
  });

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
