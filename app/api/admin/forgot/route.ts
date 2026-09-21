import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { isValidEmail } from "@/lib/validate";
import { getIp, rateLimit } from "@/lib/ratelimit";
import { RESET_TTL_MS } from "@/lib/passwordToken";
import { resolveBaseUrl } from "@/app/api/submit/route";

// Always answers the same way, whether or not the address belongs to an
// account — so the form can't be used to find out who is registered.
const GENERIC_OK = { ok: true };

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`forgot:${getIp(req)}`, 5, 15 * 60 * 1000))) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte warte 15 Minuten." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) return NextResponse.json({ error: "E-Mail ungültig" }, { status: 400 });

  // One mail per address and hour at most — stops the form being used to spam someone.
  if (!(await rateLimit(`forgot-mail:${email}`, 3, 60 * 60 * 1000))) return NextResponse.json(GENERIC_OK);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, organizationId: true } });
  if (!user?.organizationId) return NextResponse.json(GENERIC_OK);

  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { inviteToken: token, inviteTokenExpiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });

  const { host, proto } = resolveBaseUrl(process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL, req.headers.get("host") ?? "");
  const resetUrl = `${proto}://${host}/admin/reset/${token}`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "eventwulf <anfrage@eventwulf.at>",
      to: email,
      subject: "Passwort zurücksetzen — eventwulf",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
          <h2 style="margin:0 0 0.5rem;font-size:1.2rem;color:#1a1612">Passwort zurücksetzen</h2>
          <p style="margin:0 0 1.5rem;color:#6b7280;font-size:0.9rem">
            Du hast ein neues Passwort für eventwulf angefordert. Über den Button kannst du eines festlegen.
          </p>
          <p style="margin:0 0 1.5rem"><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#996C1E;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">Neues Passwort festlegen</a></p>
          <p style="margin:0;color:#6b7280;font-size:0.8rem">Der Link ist 1 Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren, dein Passwort bleibt unverändert.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error(`Failed to send password reset mail for ${email}:`, e);
  }
  return NextResponse.json(GENERIC_OK);
}
