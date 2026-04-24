import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { signToken, cookieName } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: {
        include: { clients: { select: { slug: true }, orderBy: { createdAt: "asc" }, take: 1 } },
      },
    },
  });

  if (!user || !compareSync(password, user.password)) {
    return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
  }

  if (!user.organization) {
    return NextResponse.json({ error: "Kein Zugriff konfiguriert" }, { status: 403 });
  }

  const clientSlug = user.organization.clients[0]?.slug ?? "";

  const token = await signToken({
    userId: user.id,
    organizationId: user.organization.id,
    clientSlug,
    email: user.email,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
