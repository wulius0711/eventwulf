import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadConfig } from "@/lib/loadConfig";

const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";

export async function GET() {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const orgs = await prisma.organization.findMany({
    include: {
      clients: { select: { id: true, slug: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      users: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { slug, email, password } = await req.json();

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Ungültiger Slug (nur a-z, 0-9, -)" }, { status: 400 });
  }

  const defaultConfig = loadConfig("default");

  const org = await prisma.organization.create({
    data: {
      name: slug,
      clients: { create: { slug, config: JSON.stringify(defaultConfig) } },
      users: { create: { email, password: hashSync(password, 12) } },
    },
  });

  return NextResponse.json({ id: org.id, slug });
}
