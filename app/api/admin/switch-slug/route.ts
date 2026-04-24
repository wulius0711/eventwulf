import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, cookieName } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await req.json();

  const client = await prisma.client.findFirst({
    where: { slug, organizationId: session.organizationId },
  });
  if (!client) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const token = await signToken({ ...session, clientSlug: slug });
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
