import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "default";

  try {
    const { prisma } = await import("@/lib/db");
    const client = await prisma.client.findUnique({ where: { slug } });
    if (!client) return NextResponse.json([]);

    const blocked = await prisma.blockedDate.findMany({
      where: { clientId: client.id },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(
      blocked.map((b) => ({
        id: b.id,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        label: b.label,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
