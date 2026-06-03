import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const { slug, patch } = await req.json();
  const client = await prisma.client.findUnique({ where: { slug } });
  if (!client) return NextResponse.json({ error: "Client nicht gefunden" }, { status: 404 });
  const config = { ...JSON.parse(client.config), ...patch };
  await prisma.client.update({ where: { slug }, data: { config: JSON.stringify(config) } });
  return NextResponse.json({ ok: true });
}
