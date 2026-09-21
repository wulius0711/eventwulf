import { NextRequest, NextResponse } from "next/server";
import { hashSync, compareSync } from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateNewPassword } from "@/lib/passwordPolicy";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  const pwError = await validateNewPassword(newPassword);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });

  if (!compareSync(currentPassword, user.password)) {
    return NextResponse.json({ error: "Aktuelles Passwort falsch" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashSync(newPassword, 12), passwordChangedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
