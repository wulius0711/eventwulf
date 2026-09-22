import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, cookieName, cookieOptions } from "@/lib/auth";
import { validateNewPassword } from "@/lib/passwordPolicy";

async function findValidInvite(token: string) {
  if (!token) return null;
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.inviteTokenExpiresAt || user.inviteTokenExpiresAt < new Date()) return null;
  return user;
}

// Lets the invite acceptance page confirm the token is still valid (and show
// which email it's for) before rendering the "set a password" form.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const user = await findValidInvite(token);
  if (!user) return NextResponse.json({ error: "Einladung ungültig oder abgelaufen" }, { status: 400 });
  return NextResponse.json({ email: user.email });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  const user = await findValidInvite(token);
  if (!user) return NextResponse.json({ error: "Einladung ungültig oder abgelaufen" }, { status: 400 });

  const pwError = await validateNewPassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  if (!user.organizationId) return NextResponse.json({ error: "Organisation nicht gefunden" }, { status: 404 });
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { clients: { select: { slug: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const clientSlug = org?.clients[0]?.slug;
  if (!clientSlug) return NextResponse.json({ error: "Organisation nicht vollständig eingerichtet" }, { status: 500 });

  // Atomic conditional update — same pattern as reserveEventCapacity
  // (lib/eventCapacity.ts): the WHERE clause re-checks inviteToken itself
  // (not just id), so if a concurrent request already consumed this token
  // between findValidInvite() above and here, this update matches zero rows
  // instead of silently re-consuming it. Without this, two people racing on
  // the same link (or one person opening it twice) could both pass the
  // findValidInvite() check before either write lands, and both walk away
  // with a valid session for the same account.
  const passwordChangedAt = new Date();
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, inviteToken: token },
    data: {
      password: hashSync(password, 12),
      passwordChangedAt,
      inviteToken: null,
      inviteTokenExpiresAt: null,
    },
  });
  if (count !== 1) return NextResponse.json({ error: "Einladung ungültig oder abgelaufen" }, { status: 400 });

  const sessionToken = await signToken({
    userId: user.id,
    organizationId: user.organizationId,
    clientSlug,
    email: user.email,
    pwChangedAt: passwordChangedAt.getTime(),
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), sessionToken, cookieOptions());
  return res;
}
