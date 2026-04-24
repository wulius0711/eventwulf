import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { signToken, cookieName } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { client: true },
  });

  if (!user || !compareSync(password, user.password)) {
    return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
  }

  const token = await signToken({
    userId: user.id,
    clientId: user.clientId,
    clientSlug: user.client.slug,
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
