import { NextRequest, NextResponse } from "next/server";
import { cookieName, cookieOptions } from "@/lib/auth";
import { findUserByToken, setPasswordFromToken } from "@/lib/passwordToken";
import { getIp, rateLimit } from "@/lib/ratelimit";

// Lets the reset page confirm the link is still valid (and show which email
// it is for) before rendering the "new password" form.
export async function GET(req: NextRequest) {
  if (!rateLimit(`reset-check:${getIp(req)}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte warte 15 Minuten." }, { status: 429 });
  }
  const user = await findUserByToken(req.nextUrl.searchParams.get("token"));
  if (!user) return NextResponse.json({ error: "Link ungültig oder abgelaufen" }, { status: 400 });
  return NextResponse.json({ email: user.email });
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`reset:${getIp(req)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte warte 15 Minuten." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await setPasswordFromToken(body.token, body.password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), result.sessionToken, cookieOptions());
  return res;
}
