import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { loadConfigFromDB } from "@/lib/loadConfig";
import type { InquiryFormData } from "@/lib/types";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { cancelToken: token },
    include: { client: true },
  });

  if (!inquiry) {
    return NextResponse.redirect(new URL("/storniert?status=invalid", req.url));
  }

  if (inquiry.cancelledAt || inquiry.status === "storniert") {
    return NextResponse.redirect(new URL("/storniert?status=already", req.url));
  }

  await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { status: "storniert", cancelledAt: new Date() },
  });

  // Notify admin
  try {
    const config = await loadConfigFromDB(inquiry.client.slug);
    const notifyEmail = config.notifyEmail ?? process.env.NOTIFY_EMAIL ?? "";
    if (notifyEmail) {
      const data = JSON.parse(inquiry.data) as InquiryFormData;
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: `${config.company.name} <noreply@resend.dev>`,
        to: notifyEmail,
        subject: `Anfrage storniert: ${data.artTitel} – ${data.nameGruppenleitung}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2rem">
            <h2 style="margin:0 0 0.5rem;font-size:1.2rem;color:#1a1612">Anfrage storniert</h2>
            <p style="margin:0 0 1.5rem;color:#6b7280;font-size:0.9rem">
              Der Anfragende hat seine Buchungsanfrage selbst storniert.
            </p>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:5px 12px 5px 0;color:#6b7280;font-size:0.85rem">Veranstaltung</td><td style="padding:5px 0;font-size:0.85rem;font-weight:600">${data.artTitel}</td></tr>
              <tr><td style="padding:5px 12px 5px 0;color:#6b7280;font-size:0.85rem">Gruppenleitung</td><td style="padding:5px 0;font-size:0.85rem">${data.nameGruppenleitung}</td></tr>
              <tr><td style="padding:5px 12px 5px 0;color:#6b7280;font-size:0.85rem">E-Mail</td><td style="padding:5px 0;font-size:0.85rem">${data.email}</td></tr>
              <tr><td style="padding:5px 12px 5px 0;color:#6b7280;font-size:0.85rem">Zeitraum</td><td style="padding:5px 0;font-size:0.85rem">${fmt(data.datumVon)} – ${fmt(data.datumBis)}</td></tr>
              <tr><td style="padding:5px 12px 5px 0;color:#6b7280;font-size:0.85rem">Teilnehmer</td><td style="padding:5px 0;font-size:0.85rem">${data.personenAnzahl}</td></tr>
            </table>
          </div>
        `,
      });
    }
  } catch (e) {
    console.error("Failed to send cancellation notification:", e);
  }

  return NextResponse.redirect(new URL("/storniert?status=ok", req.url));
}
