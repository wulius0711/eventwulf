import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SUPERADMIN = process.env.SUPERADMIN_SLUG ?? "admin";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.clientSlug !== SUPERADMIN) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const { orgName, email } = await req.json();
  const org = await prisma.organization.findFirst({ where: { name: orgName }, include: { users: true } });
  if (!org) return NextResponse.json({ error: "Org nicht gefunden" }, { status: 404 });
  const user = org.users[0];
  if (!user) return NextResponse.json({ error: "Kein User" }, { status: 404 });
  await prisma.user.update({ where: { id: user.id }, data: { email } });
  return NextResponse.json({ ok: true, oldEmail: user.email, newEmail: email });
}
