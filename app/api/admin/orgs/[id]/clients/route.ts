import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfig } from "@/lib/loadConfig";

const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const { slug } = await req.json();

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Ungültiger Slug (nur a-z, 0-9, -)" }, { status: 400 });
  }

  const existing = await prisma.client.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Slug bereits vergeben" }, { status: 400 });

  const defaultConfig = loadConfig("default");
  const client = await prisma.client.create({
    data: { slug, config: JSON.stringify(defaultConfig), organizationId: id },
  });

  return NextResponse.json({ slug: client.slug });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const { slug } = await req.json();

  const client = await prisma.client.findFirst({ where: { slug, organizationId: id } });
  if (!client) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  if (slug === SUPERADMIN) {
    return NextResponse.json({ error: "Superadmin-Slug kann nicht gelöscht werden" }, { status: 400 });
  }

  // Prevent deleting the last slug of an org
  const count = await prisma.client.count({ where: { organizationId: id } });
  if (count <= 1) return NextResponse.json({ error: "Letzter Slug kann nicht gelöscht werden" }, { status: 400 });

  await prisma.inquiry.deleteMany({ where: { clientId: client.id } });
  await prisma.blockedDate.deleteMany({ where: { clientId: client.id } });
  await prisma.client.delete({ where: { id: client.id } });

  return NextResponse.json({ ok: true });
}
