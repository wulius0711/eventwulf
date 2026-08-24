import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json([], { status: 200 });

  const client = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
  if (!client) return NextResponse.json([], { status: 200 });

  const events = await prisma.event.findMany({
    where: { clientId: client.id, isActive: true, endDate: { gte: new Date() } },
    orderBy: [{ startDate: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      startDate: true,
      endDate: true,
      color: true,
      pricePerPerson: true,
      minParticipants: true,
      maxParticipants: true,
      bookedCount: true,
    },
  });

  return NextResponse.json(events);
}
