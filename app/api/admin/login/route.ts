import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { signToken, cookieName, cookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, getIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`login:${getIp(req)}`, 5, 15 * 60 * 1000))) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte warte 15 Minuten." }, { status: 429 });
  }

  const { email, password } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: {
        include: { clients: { select: { slug: true }, orderBy: { createdAt: "asc" }, take: 1 } },
      },
    },
  });
  const pwChangedAt = user?.passwordChangedAt?.getTime() ?? 0;

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
    pwChangedAt,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), token, cookieOptions());
  return res;
}
